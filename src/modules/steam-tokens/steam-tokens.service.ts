import pEvent from 'p-event';
import { EAuthTokenPlatformType, EResult, LoginSession } from 'steam-session';
import SteamTotp from 'steam-totp';

import Cache, { SetOptions as CacheSetOptions } from '@isaacs/ttlcache';
import { Injectable, Logger } from '@nestjs/common';

import { Account } from '../../interfaces/account.interface';
import { ProxiesService } from '../proxies/proxies.service';

@Injectable()
export class SteamTokensService {
  private readonly logger = new Logger(SteamTokensService.name);
  private readonly throttledConnections = new Cache<string, boolean>({ ttl: 35 * 1000 + 1000 });

  private refreshTokensPlatform: EAuthTokenPlatformType = EAuthTokenPlatformType.SteamClient;

  constructor(private readonly proxiesService: ProxiesService) {}

  public async createRefreshToken(account: Account, useProxy = false) {
    const proxy = useProxy ? await this.proxiesService.getProxy() : null;

    const connectionId = this.inferConnectionId(proxy?.toString());
    await this.waitConnectionLimitReset(connectionId);
    this.throttleConnection(connectionId);
    if (proxy) this.proxiesService.throttleProxy(proxy);

    const sessionOptions = {};

    if (proxy) {
      const proxyType = proxy.protocol.includes('socks') ? 'socksProxy' : 'httpProxy';
      sessionOptions[proxyType] = proxy.toString();
    }

    const session = new LoginSession(this.refreshTokensPlatform, sessionOptions);
    session.loginTimeout = 35000;

    try {
      const credentials = { accountName: account.username, password: account.password } as any;
      if (account.sharedSecret) credentials.steamGuardCode = SteamTotp.getAuthCode(account.sharedSecret);

      const { actionRequired } = await session.startWithCredentials(credentials);
      if (actionRequired) throw new Error('Guard action required');

      await pEvent(session, 'authenticated', { rejectionEvents: ['error', 'timeout'] });
      const refreshToken = session.refreshToken;

      return refreshToken;
    } catch (error) {
      if (error.eresult === EResult.RateLimitExceeded) {
        const throttleMinutes = 35;

        this.throttleConnection(connectionId, throttleMinutes * 60 * 1000);
        if (proxy) this.proxiesService.throttleProxy(proxy, throttleMinutes * 60 * 1000);

        this.logger.warn(
          `${
            useProxy ? 'Proxy' : 'Direct'
          } connection throttled for ${throttleMinutes} minutes due to rate limit exceeded`,
        );
      }

      throw new Error('Failed to create refresh token', { cause: error });
    } finally {
      session.cancelLoginAttempt();
    }
  }

  public decodeRefreshToken(token: string) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token');

      const headerBase64Url = parts[1];
      const headerBase64 = headerBase64Url.replace(/-/g, '+').replace(/_/g, '/');
      const headerJson = Buffer.from(headerBase64, 'base64').toString('utf-8');
      return JSON.parse(headerJson);
    } catch (error) {
      throw new Error('An error occurred while decoding refresh token', { cause: error });
    }
  }

  public setRefreshTokensPlatform(platform: string) {
    if (!platform) return;
    if (platform === 'web') this.refreshTokensPlatform = EAuthTokenPlatformType.WebBrowser;
    else if (platform === 'mobile') this.refreshTokensPlatform = EAuthTokenPlatformType.MobileApp;
    else if (platform === 'desktop') this.refreshTokensPlatform = EAuthTokenPlatformType.SteamClient;
    else throw new Error('Invalid platform');

    this.logger.log(`Refresh tokens platform set to: ${platform}`);
  }

  private inferConnectionId(id?: string) {
    return id || 'localhost';
  }

  private throttleConnection(id: string, timeoutMs?: number) {
    const options: CacheSetOptions = {};
    if (timeoutMs) options.ttl = timeoutMs;
    this.throttledConnections.set(id, true, options);
  }

  private async waitConnectionLimitReset(id: string) {
    if (!this.throttledConnections.has(id)) return;

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (this.throttledConnections.has(id)) return;
        clearInterval(interval);
        resolve();
      }, 1000);
    });
  }
}
