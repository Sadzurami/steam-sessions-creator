import pQueue from 'p-queue';
import pRetry from 'p-retry';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Account } from '../../interfaces/account.interface';
import { Secrets } from '../../interfaces/secrets.interface';
import { Session as ISession } from '../../interfaces/session.interface';
import { ExportSessionsService } from '../../modules/export-sessions/export-sessions.service';
import { SteamTokensService } from '../../modules/steam-tokens/steam-tokens.service';

class Session implements ISession {
  public readonly username: string;
  public readonly password: string;
  public readonly steamId: string;
  public readonly webRefreshToken: string;
  public readonly mobileRefreshToken: string;
  public readonly desktopRefreshToken: string;
  public readonly sharedSecret: string | null = null;
  public readonly identitySecret: string | null = null;
  public readonly schemaVersion: number = 0;

  constructor(data: ISession) {
    if (!data.username) throw new Error('Invalid username');
    this.username = data.username;

    if (!data.password) throw new Error('Invalid password');
    this.password = data.password;

    if (!data.steamId) throw new Error('Invalid steamId');
    this.steamId = data.steamId;

    if (!data.webRefreshToken) throw new Error('Invalid webRefreshToken');
    this.webRefreshToken = data.webRefreshToken;

    if (!data.mobileRefreshToken) throw new Error('Invalid mobileRefreshToken');
    this.mobileRefreshToken = data.mobileRefreshToken;

    if (!data.desktopRefreshToken) throw new Error('Invalid desktopRefreshToken');
    this.desktopRefreshToken = data.desktopRefreshToken;

    if (data.sharedSecret) this.sharedSecret = data.sharedSecret;
    if (data.identitySecret) this.identitySecret = data.identitySecret;

    if (data.schemaVersion) this.schemaVersion = data.schemaVersion;
  }
}

@Injectable()
export class CreateSessionsService {
  private readonly logger = new Logger(CreateSessionsService.name);
  private concurrency = 1;

  constructor(
    private readonly steamTokensService: SteamTokensService,
    private readonly exportSessionsService: ExportSessionsService,
    private readonly configService: ConfigService,
  ) {}

  public async createAndExportSessions(accounts: Account[]) {
    const success: Account[] = [];
    const fails: Account[] = [];
    let progress = 0;

    const queue = new pQueue({ concurrency: this.concurrency, interval: 10, intervalCap: 1 });

    for (const account of accounts) {
      const task = async () => {
        this.logger.log(`Creating: ${account.username}`);

        try {
          await this.createAndExportSession(account);
          this.logger.log(`Success: ${account.username}`);
          success.push(account);
        } catch (error) {
          this.logger.warn(`Fail: ${account.username}`);
          fails.push(account);
        }

        this.logger.log(`Progress: ${++progress}/${accounts.length}`);
      };

      queue.add(task);
    }

    await queue.onIdle();

    this.logger.log(`Success: ${success.length}`);
    this.logger.log(`Fails: ${fails.length}`);

    if (fails.length > 0) {
      this.logger.warn(`Fails:\n${fails.map((a) => a.username).join('\n')}`);
      await delay(1000);
    }
  }

  public assignSecretsToAccounts(accounts: Account[], secrets: Secrets[]) {
    const secretsMap = new Map<string, Secrets>();
    for (const secret of secrets) {
      secretsMap.set(secret.username, secret);
      // some existing steam-oriented apps are case-insensitive to usernames in secrets
      secretsMap.set(secret.username.toLowerCase(), secret);
    }

    for (const account of accounts) {
      let secret = secretsMap.get(account.username);
      if (!secret) secret = secretsMap.get(account.username.toLowerCase());
      if (!secret) continue;

      account.sharedSecret = secret.sharedSecret;
      account.identitySecret = secret.identitySecret;
    }
  }

  public setConcurrency(concurrency: number) {
    this.concurrency = concurrency;
  }

  private async createAndExportSession(account: Account) {
    try {
      const session = await this.createSession(account);
      await this.exportSession(session);
    } catch (error) {
      throw new Error('Failed to create and export session', { cause: error });
    }
  }

  private async createSession(account: Account) {
    try {
      const queue = new pQueue({ concurrency: 1, interval: 30000, intervalCap: 1 });

      const webRefreshToken = await queue.add(() => this.createRefreshToken(account, 'web'));
      const mobileRefreshToken = await queue.add(() => this.createRefreshToken(account, 'mobile'));
      const desktopRefreshToken = await queue.add(() => this.createRefreshToken(account, 'desktop'));

      const steamId = this.getSteamIdFromRefreshToken(webRefreshToken);

      const schemaVersion = this.configService.getOrThrow<number>('session.schemaVersion');

      const session = new Session({
        webRefreshToken,
        mobileRefreshToken,
        desktopRefreshToken,
        steamId,
        ...account,
        schemaVersion,
      });

      return session;
    } catch (error) {
      throw new Error('Failed to create session', { cause: error });
    }
  }

  private async createRefreshToken(account: Account, platform: 'web' | 'mobile' | 'desktop') {
    try {
      const token = await pRetry(() => this.steamTokensService.createRefreshToken(account, platform), {
        retries: 5,
        minTimeout: 10000,
        maxTimeout: 60000,
      });
      return token;
    } catch (error) {
      throw new Error('Failed to create refresh token', { cause: error });
    }
  }

  private getSteamIdFromRefreshToken(token: string) {
    try {
      const { sub: steamId } = this.steamTokensService.decodeRefreshToken(token);
      if (!steamId) throw new Error('SteamId is missing from refresh token');
      return steamId;
    } catch (error) {
      throw new Error('Failed to get steamId from refresh token', { cause: error });
    }
  }

  private async exportSession(session: Session) {
    try {
      await pRetry(() => this.exportSessionsService.exportSession(session), { retries: 3 });
    } catch (error) {
      this.logger.error(`Failed to export session for ${session.username}`);
      throw new Error('Failed to export session', { cause: error });
    }
  }
}
