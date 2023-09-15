import fs from 'fs/promises';
import pQueue from 'p-queue';
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

  public async importAll(directoryPath: string) {
    const queue = new pQueue({ concurrency: 512 });

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

    files = files.filter((file) => file.endsWith('.maFile'));

    for (const file of files) queue.add(() => this.importOne(`${directoryPath}/${file}`));

    await queue.onIdle();
    this.logger.verbose(`Directory ${directoryPath} successfully imported`);
  }

  public async importOne(filePath: string) {
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
