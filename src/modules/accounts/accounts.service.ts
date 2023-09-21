import fs from 'fs/promises';

import { Injectable, Logger } from '@nestjs/common';

import { Account } from './account.interface';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  private readonly accounts: Account[] = [];

  public getAll() {
    return this.accounts;
  }

  public getCount() {
    return this.accounts.length;
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
    } catch (error) {
      this.logger.debug(new Error(`Error reading file ${filePath}`, { cause: error }));
      return;
    }

    const lines = fileContent.split(/\s+|\r?\n/).map((line) => line.trim());
    if (lines.length === 0) return;

    const accounts: Account[] = [];

    let lineIndex = 0;
    for (const line of lines) {
      lineIndex++;

      const parts = line.split(':');

      const username = parts[0];
      const password = parts[1];
      let sharedSecret = parts[2];
      let identitySecret = parts[3];

      if (!username || !password) {
        this.logger.verbose(`Invalid account on line ${lineIndex}`);
        continue;
      }

      sharedSecret =
        sharedSecret && Buffer.from(sharedSecret, 'base64').toString('base64') === sharedSecret ? sharedSecret : null;

      identitySecret =
        identitySecret && Buffer.from(identitySecret, 'base64').toString('base64') === identitySecret
          ? identitySecret
          : null;

      accounts.push({ username, password, sharedSecret, identitySecret });
    }

    this.accounts.push(...accounts);
    this.logger.verbose(`File ${filePath} successfully imported`);
  }
}
