import fs from 'fs/promises';
import pQueue from 'p-queue';
import path from 'path';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';

import { Account } from '../accounts/account.interface';
import { SteamService } from '../steam/steam.service';
import { Session } from './session.interface';

@Injectable()
export class SessionsService {
  public importDirectoryPath: string | null = null;
  public exportDirectoryPath: string | null = null;

  private readonly logger = new Logger(SessionsService.name);
  private readonly sessions: Map<string, Session> = new Map();

  private readonly schemaVersion: number = 3;

  constructor(private readonly steam: SteamService) {}

  public async create(account: Account) {
    try {
      const desktopRefreshToken = await this.steam.createRefreshToken(account, 'desktop');
      await delay(30 * 1000);

      const webRefreshToken = await this.steam.createRefreshToken(account, 'web');
      await delay(30 * 1000);

      const mobileRefreshToken = await this.steam.createRefreshToken(account, 'mobile');

      const { sub: steamId } = this.steam.decodeRefreshToken(desktopRefreshToken);
      if (!steamId) throw new Error('Failed find SteamID in decoded desktop refresh token');

      const session: Session = {
        Username: account.username,
        Password: account.password,

        SharedSecret: account.sharedSecret || null,
        IdentitySecret: account.identitySecret || null,

        SteamId: steamId,

        WebRefreshToken: webRefreshToken,
        MobileRefreshToken: mobileRefreshToken,
        DesktopRefreshToken: desktopRefreshToken,

        Proxy: null,

        SchemaVersion: this.schemaVersion,
      };

      this.sessions.set(session.Username, session);

      return session;
    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  public getOne(username: string) {
    if (this.sessions.size === 0) return null;

    const session = this.sessions.get(username) || this.sessions.get(username.toLowerCase());
    if (!session) return null;

    return session;
  }

  public getAll() {
    return [...this.sessions.values()];
  }

  public getCount() {
    return this.sessions.size;
  }

  public async import() {
    const directoryPath = this.importDirectoryPath;
    if (!directoryPath) return;

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

    files = files.filter((file) => file.endsWith('.steamsession'));

    for (const file of files) queue.add(() => this.importFromFile(path.join(directoryPath, file)));

    await queue.onIdle();
    this.logger.verbose(`Directory ${directoryPath} successfully imported`);
  }

  public async exportOne(session: Session) {
    try {
      await fs.access(this.exportDirectoryPath, fs.constants.F_OK | fs.constants.W_OK);
    } catch (error) {
      await fs.mkdir(this.exportDirectoryPath, { recursive: true });
    }

    const filePath = path.join(this.exportDirectoryPath, `${session.Username}.steamsession`);
    const fileContent = JSON.stringify(session, null, 2);

    await fs.writeFile(filePath, fileContent, 'utf8');
    this.logger.verbose(`File ${filePath} successfully exported`);
  }

  public validateOne(session: Session) {
    const requiredFields = [
      'Username',
      'Password',
      'SteamId',
      'WebRefreshToken',
      'MobileRefreshToken',
      'DesktopRefreshToken',
    ];

    if (!requiredFields.every((field) => session[field])) return false;

    try {
      let expiry = this.steam.decodeRefreshToken(session.DesktopRefreshToken).exp;
      if (expiry - Date.now() / 1000 < 60 * 60 * 24 * 30) return false;

      expiry = this.steam.decodeRefreshToken(session.WebRefreshToken).exp;
      if (expiry - Date.now() / 1000 < 60 * 60 * 24 * 30) return false;

      expiry = this.steam.decodeRefreshToken(session.MobileRefreshToken).exp;
      if (expiry - Date.now() / 1000 < 60 * 60 * 24 * 30) return false;
    } catch (error) {
      return false;
    }

    return true;
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
    } catch (error) {
      this.logger.debug(new Error(`Error reading file ${filePath}`, { cause: error }));
      return;
    }

    let parsedContent: Partial<Session>;
    try {
      parsedContent = JSON.parse(fileContent);
      if (!parsedContent) throw new Error('Empty file');
    } catch (error) {
      this.logger.debug(new Error(`Error parsing file ${filePath}`, { cause: error }));
      return;
    }

    const { Username, Password, SchemaVersion } = parsedContent;
    if (!Username || !Password || !SchemaVersion) {
      this.logger.verbose(`File ${filePath} does not contain all required fields`);
      return;
    }

    const session: Session = {
      Username,
      Password,
      SteamId: parsedContent.SteamId || '',
      SharedSecret: parsedContent.SharedSecret || null,
      IdentitySecret: parsedContent.IdentitySecret || null,
      WebRefreshToken: parsedContent.WebRefreshToken || '',
      MobileRefreshToken: parsedContent.MobileRefreshToken || '',
      DesktopRefreshToken: parsedContent.DesktopRefreshToken || '',
      Proxy: parsedContent.Proxy || null,
      SchemaVersion,
    };

    this.sessions.set(session.Username, session);
    this.logger.verbose(`File ${filePath} successfully imported`);
  }
}
