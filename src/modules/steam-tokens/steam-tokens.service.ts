import pEvent from 'p-event';
import { EAuthTokenPlatformType, EResult, LoginSession } from 'steam-session';
import SteamTotp from 'steam-totp';

import Cache, { SetOptions as CacheSetOptions } from '@isaacs/ttlcache';
import { Injectable } from '@nestjs/common';

import { Account } from '../../interfaces/account.interface';
import { ProxiesService } from '../proxies/proxies.service';

@Injectable()
export class SteamTokensService {
  private readonly throttledConnections = new Cache<string, boolean>({ ttl: 35 * 1000 });

  constructor(private readonly proxiesService: ProxiesService) {}

  public async createRefreshToken(account: Account, platform: 'web' | 'mobile' | 'desktop') {
    const loginSessionPlatform = this.inferLoginSessionPlatform(platform);

    const proxy = await this.proxiesService.getProxy();

    const connectionId = this.inferConnectionId((proxy || '').toString());
    await this.waitConnectionLimitReset(connectionId).then(() => this.throttleConnection(connectionId));

    const loginSessionOptions = {};
    if (proxy) loginSessionOptions[proxy.protocol.includes('socks') ? 'socksProxy' : 'httpProxy'] = proxy.toString();

    const loginSession = new LoginSession(loginSessionPlatform, loginSessionOptions);
    loginSession.on('error', () => {}); // fallback errors handling

    try {
      const credentials = { accountName: account.username, password: account.password } as any;
      if (account.sharedSecret) credentials.steamGuardCode = SteamTotp.getAuthCode(account.sharedSecret);

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

  private inferLoginSessionPlatform(platform: 'web' | 'mobile' | 'desktop'): EAuthTokenPlatformType {
    if (platform === 'web') return EAuthTokenPlatformType.WebBrowser;
    else if (platform === 'mobile') return EAuthTokenPlatformType.MobileApp;
    else if (platform === 'desktop') return EAuthTokenPlatformType.SteamClient;
    else throw new Error('Invalid platform');
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
