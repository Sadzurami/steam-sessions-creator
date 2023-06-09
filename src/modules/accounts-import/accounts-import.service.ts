import fs from 'fs/promises';
import inquirer from 'inquirer';
import pQueue from 'p-queue';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';

import { Account as IAccount } from '../../interfaces/account.interface';

class Account implements IAccount {
  public readonly username: string;
  public readonly password: string;
  public readonly sharedSecret: string | null = null;
  public readonly identitySecret: string | null = null;

  constructor(account: string) {
    account = account.trim();
    if (account.length === 0) throw new Error('Invalid account');

    const parts = account.split(':').map((part) => part.trim());
    if (parts.length < 2) throw new Error('Invalid account');

    const [username, password, sharedSecret, identitySecret] = parts;

    this.username = username;
    this.password = password;
    if (sharedSecret) this.sharedSecret = sharedSecret;
    if (identitySecret) this.identitySecret = identitySecret;
  }
}

@Injectable()
export class AccountsImportService {
  private readonly logger = new Logger(AccountsImportService.name);
  private readonly readFilesQueue = new pQueue({ concurrency: 100 });

  public async loadAccounts(input: string[] | string) {
    if (!input) return [];
    if (!Array.isArray(input)) input = [input];
    if (input.length === 0) return [];

    let accounts: Account[] = [];
    const errors: string[] = [];

    const readResults = await Promise.all(input.map((input) => this.readAccountsFromInput(input)));
    for (const result of readResults) {
      accounts.push(...result.values);
      errors.push(...result.errors);
    }

    accounts = this.removeDuplicates(accounts);

    if (errors.length > 0 && accounts.length > 0) {
      this.logger.warn(`The following account sources are invalid:\n${errors.join('\n')}`);
      await delay(1000);

      const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'Continue with the valid accounts?',
        default: false,
      });

      if (!confirm) throw new Error('Aborted by user');
    }

    return accounts;
  }

  private removeDuplicates(accounts: Account[]) {
    const map = new Map<string, Account>();
    for (const account of accounts) map.set(account.username, account);
    return [...map.values()];
  }

  private async readAccountsFromInput(input: string) {
    const inputType = await this.inferInputType(input);
    if (inputType === 'file') return this.readAccountsFromFile(input);
    if (inputType === 'string') return this.readAccountFromString(input);
    if (inputType === 'directory') return { values: [], errors: [input] };
  }

  private async readAccountsFromFile(filePath: string) {
    const result: { values: Account[]; errors: string[] } = { values: [], errors: [] };

    try {
      let content = await this.readFilesQueue.add(() => fs.readFile(filePath, 'utf-8'));
      content = content.trim();

      if (content.length === 0) throw new Error('Empty file');

      // session file
      if (filePath.endsWith('.steamsession')) {
        const readResults = this.readAccountFromSessionFile(content);
        result.values.push(...readResults.values);
        if (readResults.errors.length > 0) result.errors.push(filePath);

        return result;
      }

      // asf json
      if (filePath.endsWith('.json') && content.includes('"SteamLogin"')) {
        const readResults = this.readAccountFromAsfJson(content);
        result.values.push(...readResults.values);
        if (readResults.errors.length > 0) result.errors.push(filePath);

        return result;
      }

      // plain text
      if (content.includes(':')) {
        const lines = content
          .split(/\s+|\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) throw new Error('Empty file');

        for (const line of lines) {
          const readResults = this.readAccountFromString(line);
          result.values.push(...readResults.values);
          if (readResults.errors.length > 0) result.errors.push(line);
        }

        return result;
      }

      throw new Error('Unsupported file format');
    } catch (error) {
      result.errors.push(filePath);
    }

    return result;
  }

  private readAccountFromString(str: string) {
    const result: { values: Account[]; errors: string[] } = { values: [], errors: [] };

    try {
      const account = new Account(str);
      result.values.push(account);
    } catch (error) {
      result.errors.push(str);
    }

    return result;
  }

  private readAccountFromAsfJson(fileContent: string) {
    const result: { values: Account[]; errors: string[] } = { values: [], errors: [] };

    try {
      const { SteamLogin: username, SteamPassword: password } = JSON.parse(fileContent);

      if (!username) throw new Error('Invalid username');
      if (!password) throw new Error('Invalid password');

      const account = new Account(`${username}:${password}`);
      result.values.push(account);
    } catch (error) {
      result.errors.push(fileContent);
    }

    return result;
  }

  private readAccountFromSessionFile(fileContent: string) {
    const result: { values: Account[]; errors: string[] } = { values: [], errors: [] };

    try {
      const { Username, Password, SharedSecret, IdentitySecret } = JSON.parse(fileContent);
      if (!Username) throw new Error('Invalid username');
      if (!Password) throw new Error('Invalid password');

      const account = new Account(`${Username}:${Password}:${SharedSecret || ''}:${IdentitySecret || ''}`);
      result.values.push(account);
    } catch (error) {
      result.errors.push(fileContent);
    }

    return result;
  }

  private async inferInputType(input: string) {
    if (typeof input !== 'string') throw new Error(`Invalid input type: '${typeof input}'`);

    try {
      const stats = await fs.stat(input);
      if (stats.isFile()) return 'file';
      if (stats.isDirectory()) return 'directory';
    } catch (error) {
      return 'string';
    }
  }
}
