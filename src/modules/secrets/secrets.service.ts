import fs from 'fs/promises';
import pQueue from 'p-queue';
import path from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { Secrets } from './secrets.interface';

@Injectable()
export class SecretsService {
  public importDirectoryPath: string | null = null;

  private readonly logger = new Logger(SecretsService.name);
  private readonly secrets = new Map<string, Secrets>();

  public getOne(username: string): Secrets | null {
    if (this.secrets.size === 0) return null;

    const secret = this.secrets.get(username) || this.secrets.get(username.toLowerCase());
    if (!secret) return null;

    return secret;
  }

  public getCount() {
    return this.secrets.size;
  }

  public async import() {
    const directoryPath = this.importDirectoryPath;
    if (!directoryPath) return;

    try {
      await fs.access(directoryPath, fs.constants.F_OK | fs.constants.R_OK);
    } catch (error) {
      this.logger.verbose(`Directory ${directoryPath} does not exist or is not readable`);
      return;
    }

    let files: string[];
    try {
      files = await fs.readdir(directoryPath);
    } catch (error) {
      this.logger.debug(new Error(`Error reading directory ${directoryPath}`), { cause: error });
      return;
    }

    files = files.filter((file) => file.toLowerCase().endsWith('.mafile'));

    const queue = new pQueue({ concurrency: 512 });
    for (const file of files) queue.add(() => this.importFromFile(path.join(directoryPath, file)));

    await queue.onIdle();
    this.logger.verbose(`Directory ${directoryPath} successfully imported`);
  }

  private async importFromFile(filePath: string) {
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

    const username = account_name || path.basename(filePath).replace(/\.mafile$/i, '');

    const secret = { username, sharedSecret: shared_secret, identitySecret: identity_secret };
    this.secrets.set(username, secret);

    this.logger.verbose(`File ${filePath} successfully imported`);
  }
}
