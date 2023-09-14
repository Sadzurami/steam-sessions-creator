import fs from 'fs/promises';
import path from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { Secrets } from './secrets.interface';

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);

  private readonly secrets: Secrets[] = [];

  public getAll() {
    return this.secrets;
  }

  public getCount() {
    return this.secrets.length;
  }

  public findOne(username: string): Secrets | null {
    if (this.secrets.length === 0) return null;

    const secret = this.secrets.find((secret) => secret.username === username);
    if (!secret) return null;

    return secret;
  }

  public async importAll(filePath: string) {
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

      // some maFiles may have wrong format, so we try to fix it
      fileContent = fileContent
        .trim()
        .replace(/},\s*}/g, '}}')
        .replace(/'/, '"');
    } catch (error) {
      this.logger.debug(new Error(`Error reading file ${filePath}`, { cause: error }));
      return;
    }

    let parsedContent: any;
    try {
      parsedContent = JSON.parse(fileContent);
      if (!parsedContent) throw new Error('Empty file');
    } catch (error) {
      this.logger.debug(new Error(`Error parsing file ${filePath}`, { cause: error }));
      return;
    }

    const { shared_secret, identity_secret, account_name } = parsedContent;
    if (!shared_secret || !identity_secret) {
      this.logger.verbose(`File ${filePath} does not contain all required fields`);
      return;
    }

    const username = account_name || path.basename(filePath, '.maFile');

    this.secrets.push({ username, sharedSecret: shared_secret, identitySecret: identity_secret });
    this.logger.verbose(`File ${filePath} successfully imported`);
  }
}
