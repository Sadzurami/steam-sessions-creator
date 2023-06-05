import fs from 'fs/promises';
import inquirer from 'inquirer';
import pQueue from 'p-queue';
import path from 'path';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';

import { Secrets as ISecrets } from '../../interfaces/secrets.interface';

class Secrets implements ISecrets {
  public readonly username: string;
  public readonly sharedSecret: string;
  public readonly identitySecret: string;

  constructor(secrets: string) {
    let parsedSecrets: any;

    try {
      parsedSecrets = JSON.parse(secrets);
    } catch (error) {}

    if (typeof parsedSecrets !== 'object' || parsedSecrets === null) throw new Error('Secrets string is invalid');

    const { shared_secret, identity_secret, account_name } = parsedSecrets;

    if (!shared_secret) throw new Error('Shared secret is missing');
    this.sharedSecret = shared_secret;

    if (!identity_secret) throw new Error('Identity secret is missing');
    this.identitySecret = identity_secret;

    if (!account_name) throw new Error('Account name is missing');
    this.username = account_name;
  }
}

@Injectable()
export class SecretsImportService {
  private readonly logger = new Logger(SecretsImportService.name);
  private readonly readFilesQueue = new pQueue({ concurrency: 100 });

  public async loadSecrets(input: string[] | string) {
    if (!input) return [];
    if (!Array.isArray(input)) input = [input];
    if (input.length === 0) return [];

    const readResults = await Promise.all(input.map((input) => this.readSecretsFromInput(input)));

    const secrets: Secrets[] = [];
    const errors: string[] = [];

    for (const result of readResults) {
      secrets.push(...result.values);
      errors.push(...result.errors);
    }

    if (errors.length > 0) {
      this.logger.warn(`The following secret sources are invalid:\n${errors.join('\n')}`);

      await delay(1000);

      const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message:
          secrets.length > 0 ? `Continue with ${secrets.length} valid secrets?` : 'Continue without any secrets?',
        default: false,
      });

      if (!confirm) throw new Error('Aborted by user');
    }

    return secrets;
  }

  private async readSecretsFromInput(input: string) {
    const inputType = await this.inferInputType(input);
    if (inputType === 'file') return this.readSecretsFromFile(input);
    if (inputType === 'string') return { values: [], errors: [input] };
    if (inputType === 'directory') return { values: [], errors: [input] };
  }

  private async readSecretsFromFile(filePath: string) {
    const result: { values: Secrets[]; errors: string[] } = { values: [], errors: [] };

    try {
      const fileExtension = path.extname(filePath);

      // mafile
      if (fileExtension.toLowerCase() === '.mafile') {
        const readResult = await this.readSecretsFromMaFile(filePath);
        result.values.push(...readResult.values);
        if (readResult.errors.length > 0) result.errors.push(filePath);
        return result;
      }

      // asf db
      if (fileExtension === '.db') {
        const readResult = await this.readSecretsFromAsfDbFile(filePath);
        result.values.push(...readResult.values);
        if (readResult.errors.length > 0) result.errors.push(filePath);
        return result;
      }

      throw new Error('Unsupported file format');
    } catch (error) {
      result.errors.push(filePath);
    }

    return result;
  }

  private async readSecretsFromMaFile(filePath: string) {
    const result: { values: Secrets[]; errors: string[] } = { values: [], errors: [] };

    try {
      let content = await this.readFilesQueue.add(() => fs.readFile(filePath, 'utf-8'));
      content = content.trim().replace(/},\s*}/g, '}}');

      const secrets = new Secrets(content);
      result.values.push(secrets);
    } catch (error) {
      result.errors.push(filePath);
    }

    return result;
  }

  private async readSecretsFromAsfDbFile(filePath: string) {
    const result: { values: Secrets[]; errors: string[] } = { values: [], errors: [] };

    try {
      let content = await this.readFilesQueue.add(() => fs.readFile(filePath, 'utf-8'));

      const parsedContent = JSON.parse(content)['_MobileAuthenticator'];
      parsedContent['account_name'] = path.basename(filePath, path.extname(filePath));

      content = JSON.stringify(parsedContent);

      const secrets = new Secrets(content);
      result.values.push(secrets);
    } catch (error) {
      result.errors.push(filePath);
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
