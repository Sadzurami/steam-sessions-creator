import fs from 'fs/promises';
import pQueue from 'p-queue';
import path from 'path';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Config, SessionsConfig } from '../../config/config.source';
import { Account } from '../accounts/account.interface';
import { SteamService } from '../steam/steam.service';
import { Session } from './session.interface';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly sessions: Session[] = [];
  private readonly schemaVersion: number;

  constructor(
    private readonly config: ConfigService<Config>,
    private readonly steam: SteamService,
  ) {
    this.schemaVersion = this.config.getOrThrow<SessionsConfig>('sessions').schemaVersion;
  }

  public async create(account: Account) {
    try {
      const desktopRefreshToken = await this.steam.createRefreshToken(account, 'desktop');
      await delay(1000 * 31);

      const webRefreshToken = await this.steam.createRefreshToken(account, 'web');
      await delay(1000 * 31);

      const mobileRefreshToken = await this.steam.createRefreshToken(account, 'mobile');

      const { sub: steamId } = this.steam.decodeRefreshToken(desktopRefreshToken);

      const session: Session = {
        Username: account.username,
        Password: account.password,

        SharedSecret: account.sharedSecret || null,
        IdentitySecret: account.identitySecret || null,

        SteamId: steamId,

        WebRefreshToken: webRefreshToken,
        MobileRefreshToken: mobileRefreshToken,
        DesktopRefreshToken: desktopRefreshToken,

        SchemaVersion: this.schemaVersion,
      };

      this.sessions.push(session);

      this.logger.verbose(`Session for ${account.username} successfully created`);

      return session;
    } catch (error) {
      error = new Error('Failed to create session', { cause: error });

      this.logger.debug(error);
      throw error;
    }
  }

  public getAll() {
    return this.sessions;
  }

  public getCount() {
    return this.sessions.length;
  }

  public clear() {
    this.sessions.splice(0, this.sessions.length);
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
      SchemaVersion,
    };

    this.sessions.push(session);
    this.logger.verbose(`File ${filePath} successfully imported`);
  }

  public async exportOne(session: Session, directoryPath: string) {
    const filePath = path.join(directoryPath, `${session.Username}.steamsession`);
    const fileContent = JSON.stringify(session, null, 2);

    try {
      await fs.writeFile(filePath, fileContent, 'utf8');
    } catch (error) {
      error = new Error(`Error writing file ${filePath}`, { cause: error });

      this.logger.debug(error);
      throw error;
    }

    this.logger.verbose(`File ${filePath} successfully exported`);
  }

  public async validateOne(session: Session) {
    const requiredFields = [
      'Username',
      'Password',
      'SteamId',
      'WebRefreshToken',
      'MobileRefreshToken',
      'DesktopRefreshToken',
      'SchemaVersion',
    ];

    if (!requiredFields.every((field) => session[field])) return false;

    if (session.SchemaVersion !== this.schemaVersion) return false;

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

  public convertToAccount(session: Session): Account {
    return {
      username: session.Username,
      password: session.Password,
      sharedSecret: session.SharedSecret,
      identitySecret: session.IdentitySecret,
    };
  }
}
