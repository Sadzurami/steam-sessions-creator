import fs from 'fs/promises';

import { Injectable, Logger } from '@nestjs/common';

import { SecretsService } from '../secrets/secrets.service';
import { Account } from './account.interface';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);
  private readonly accounts: Account[] = [];

  private _importFilePath: string | null = null;

  constructor(private readonly secrets: SecretsService) {}

  public get importFilePath() {
    return this._importFilePath;
  }

  public set importFilePath(value: string) {
    this._importFilePath = value;
  }

  public getAll() {
    return this.accounts;
  }

  public getCount() {
    return this.accounts.length;
  }

  public async import() {
    const filePath = this.importFilePath;
    if (!filePath) return;

    try {
      await fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
    } catch (error) {
      this.logger.verbose(`File ${filePath} does not exist or is not readable`);
      return;
    }

    let fileContent: string;
    try {
      fileContent = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      this.logger.debug(new Error(`Error reading file ${filePath}`, { cause: error }));
      return;
    }

    const lines = fileContent.split(/\r?\n/);
    if (lines.length === 0) return;

    const accounts = new Map<string, Account>();

    let lineIndex = 0;
    for (const line of lines) {
      lineIndex++;

      const parts = line.split(':');

      const [username, password] = parts;
      if (!username || !password) {
        this.logger.verbose(`Invalid account on line ${lineIndex}`);
        continue;
      }

      const account: Account = { username, password, sharedSecret: null, identitySecret: null };
      const secrets = this.secrets.getOne(account.username);

      account.sharedSecret =
        parts[2] && Buffer.from(parts[2], 'base64').toString('base64') === parts[2] ? parts[2] : null;
      account.sharedSecret = account.sharedSecret || secrets?.sharedSecret || null;

      account.identitySecret =
        parts[3] && Buffer.from(parts[3], 'base64').toString('base64') === parts[3] ? parts[3] : null;
      account.identitySecret = account.identitySecret || secrets?.identitySecret || null;

      accounts.set(account.username, account);
    }

    this.accounts.push(...accounts.values());
    this.logger.verbose(`File ${filePath} successfully imported`);
  }
}
