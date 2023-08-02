import pRetry from 'p-retry';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Account } from '../../interfaces/account.interface';
import { Session as ISession } from '../../interfaces/session.interface';
import { SteamTokensService } from '../../modules/steam-tokens/steam-tokens.service';

@Injectable()
export class CreateSessionsService implements OnModuleInit {
  private schemaVersion: number;

  constructor(private readonly steamTokensService: SteamTokensService, private readonly configService: ConfigService) {}

  public onModuleInit() {
    this.schemaVersion = this.configService.getOrThrow<number>('session.schemaVersion');
  }

  public async createSession(account: Account) {
    try {
      // we need to wait at least 30 seconds between each refresh token creation
      // because steam has a limit of logins for one account once per 30 seconds
      // probably it's fair only for accounts with 2FA enabled
      const delayMs = 1000 * 31;

      const desktopRefreshToken = await this.createRefreshToken(account, 'desktop');
      await delay(delayMs);

      const webRefreshToken = await this.createRefreshToken(account, 'web');
      await delay(delayMs);

      const mobileRefreshToken = await this.createRefreshToken(account, 'mobile');
      await delay(delayMs);

      const steamId = this.getSteamIdFromRefreshToken(webRefreshToken);

      const schemaVersion = this.schemaVersion;

      const session: ISession = {
        username: account.username,
        password: account.password,
        sharedSecret: account.sharedSecret || null,
        identitySecret: account.identitySecret || null,
        steamId,
        webRefreshToken,
        mobileRefreshToken,
        desktopRefreshToken,
        schemaVersion,
      };

      return session;
    } catch (error) {
      throw new Error('Failed to create session', { cause: error });
    }
  }

  private async createRefreshToken(account: Account, platform: 'web' | 'mobile' | 'desktop') {
    try {
      return await pRetry(() => this.steamTokensService.createRefreshToken(account, platform), {
        retries: 3,
        minTimeout: 31000,
        maxTimeout: 31000,
      });
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
}
