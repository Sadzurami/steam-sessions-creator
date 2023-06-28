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
  private readonly throttledConnections = new Cache<string, boolean>({ ttl: 35 * 1000 });

  private tokensPlatform: EAuthTokenPlatformType = EAuthTokenPlatformType.SteamClient;

  constructor(private readonly proxiesService: ProxiesService) {}

  public async createRefreshToken(account: Account) {
    const proxy = await this.proxiesService.getProxy();

    const connectionId = this.inferConnectionId((proxy || '').toString());
    await this.waitConnectionLimitReset(connectionId).then(() => this.throttleConnection(connectionId));

    let loginSession: LoginSession;

    try {
      const loginSessionOptions = {};
      if (proxy) loginSessionOptions[proxy.protocol.includes('socks') ? 'socksProxy' : 'httpProxy'] = proxy.toString();

      loginSession = new LoginSession(this.tokensPlatform, loginSessionOptions);

      const credentials = { accountName: account.username, password: account.password } as any;
      if (account.sharedSecret) credentials.steamGuardCode = SteamTotp.getAuthCode(account.sharedSecret);

      // fallback errors handling
      loginSession.on('error', () => {});
      loginSession.on('timeout', () => {});

      loginSession
        .startWithCredentials(credentials)
        .then((result) => result.actionRequired && loginSession.emit('error', new Error('Guard action required')))
        .catch((error) => loginSession.emit('error', error));

      await pEvent(loginSession, 'authenticated', { rejectionEvents: ['error', 'timeout'], timeout: 35000 });

      const refreshToken = loginSession.refreshToken;
      if (!refreshToken) throw new Error('Refresh token is empty');

      return refreshToken;
    } catch (error) {
      if (error.eresult === EResult.RateLimitExceeded) this.throttleConnection(connectionId, 35 * 60 * 1000);
      throw new Error('Failed to create refresh token', { cause: error });
    } finally {
      if (loginSession) loginSession.cancelLoginAttempt();
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

  public setPlatform(platform: string) {
    if (!platform) return;
    if (platform === 'web') this.tokensPlatform = EAuthTokenPlatformType.WebBrowser;
    else if (platform === 'mobile') this.tokensPlatform = EAuthTokenPlatformType.MobileApp;
    else if (platform === 'desktop') this.tokensPlatform = EAuthTokenPlatformType.SteamClient;
    else throw new Error('Invalid platform');

    this.logger.log(`Platform set: ${platform}`);
  }

  private inferConnectionId(id?: string) {
    return id || 'localhost';
  }

  private throttleConnection(connectionId: string, timeoutMs?: number) {
    connectionId = this.inferConnectionId(connectionId);

    const options: CacheSetOptions = {};
    if (timeoutMs) options.ttl = timeoutMs;

    this.throttledConnections.set(connectionId, true, options);
    if (this.inferConnectionId() !== connectionId) this.proxiesService.throttleProxy(connectionId, timeoutMs);
  }

  private async waitConnectionLimitReset(connectionId: string) {
    connectionId = this.inferConnectionId(connectionId);

    if (!this.throttledConnections.has(connectionId)) return;

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (this.throttledConnections.has(connectionId)) return;
        clearInterval(interval);
        resolve();
      }, 1000);
    });
  }
}
