import pQueue from 'p-queue';
import pRetry from 'p-retry';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';

import { Account } from '../../interfaces/account.interface';
import { Secrets } from '../../interfaces/secrets.interface';
import { Session as ISession } from '../../interfaces/session.interface';
import { ExportSessionsService } from '../../modules/export-sessions/export-sessions.service';
import { ProxiesService } from '../../modules/proxies/proxies.service';
import { SteamTokensService } from '../../modules/steam-tokens/steam-tokens.service';

class Session implements ISession {
  public readonly username: string;
  public readonly password: string;
  public readonly steamId: string;
  public readonly refreshToken: string;
  public readonly sharedSecret: string | null = null;
  public readonly identitySecret: string | null = null;
  public readonly schemaVersion: number = 1;

  constructor(data: Omit<ISession, 'schemaVersion'>) {
    if (!data.username) throw new Error('Invalid username');
    this.username = data.username;

    if (!data.password) throw new Error('Invalid password');
    this.password = data.password;

    if (!data.steamId) throw new Error('Invalid steamId');
    this.steamId = data.steamId;

    if (!data.refreshToken) throw new Error('Invalid refreshToken');
    this.refreshToken = data.refreshToken;

    if (data.sharedSecret) this.sharedSecret = data.sharedSecret;
    if (data.identitySecret) this.identitySecret = data.identitySecret;
  }
}

@Injectable()
export class CreateSessionsService {
  private readonly logger = new Logger(CreateSessionsService.name);

  constructor(
    private readonly proxiesService: ProxiesService,
    private readonly steamTokensService: SteamTokensService,
    private readonly exportSessionsService: ExportSessionsService,
  ) {}

  public async createAndExportSessions(accounts: Account[]) {
    this.logger.log(`Creating sessions for ${accounts.length} accounts`);

    const proxiesCount = this.proxiesService.getProxiesCount();
    const concurrency = Math.min(Math.max(proxiesCount, 1), 100);
    this.logger.log(`Concurrency limit: ${concurrency}`);

    const queue = new pQueue({ concurrency });

    const erroredAccounts: Account[] = [];

    let progressNow = 0;
    queue.on('next', () => this.logger.log(`Progress: ${++progressNow}/${accounts.length}`));

    queue.addAll(accounts.map((a) => () => this.createAndExportSession(a).catch(() => erroredAccounts.push(a))));
    await queue.onIdle();

    if (erroredAccounts.length > 0) {
      this.logger.warn(
        `Failed to create sessions for the following accounts:\n${erroredAccounts.map((a) => a.username).join('\n')}`,
      );
    }

    await delay(1000);
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
      const refreshToken = await this.createRefreshToken(account);

      const steamId = this.getSteamIdFromRefreshToken(refreshToken);

      const session = new Session({
        steamId,
        refreshToken,
        username: account.username,
        password: account.password,
        sharedSecret: account.sharedSecret,
        identitySecret: account.identitySecret,
      });

      this.logger.log(`Session for ${account.username} successfully created`);

      return session;
    } catch (error) {
      this.logger.error(`Failed to create session for ${account.username}`);
      throw new Error('Failed to create session', { cause: error });
    }
  }

  private async createRefreshToken(account: Account) {
    const useProxy = this.proxiesService.getProxiesCount() > 0;
    try {
      const token = await pRetry(() => this.steamTokensService.createRefreshToken(account, useProxy), { retries: 5 });
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
