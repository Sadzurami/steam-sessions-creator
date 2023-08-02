import { Cache } from 'cache-manager';
import pEvent from 'p-event';
import { EAuthTokenPlatformType, EResult, LoginSession } from 'steam-session';
import SteamTotp from 'steam-totp';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';

import { Account } from '../../interfaces/account.interface';
import { ProxiesService } from '../proxies/proxies.service';

@Injectable()
export class SteamTokensService {
  private readonly connectionThrottlingTimeout = 31 * 1000;

  constructor(
    @Inject(CACHE_MANAGER) private throttledConnections: Cache,
    private readonly proxiesService: ProxiesService,
  ) {}

  public async createRefreshToken(account: Account, platform: 'web' | 'mobile' | 'desktop') {
    const loginSessionPlatform = this.inferLoginSessionPlatform(platform);

    const proxy = await this.proxiesService.getProxy();

    const connectionId = this.inferConnectionId((proxy || '').toString());
    await this.waitConnectionLimitReset(connectionId);
    this.throttleConnection(connectionId, this.connectionThrottlingTimeout);

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
      if (error.eresult === EResult.RateLimitExceeded) this.throttleConnection(connectionId, 31 * 60 * 1000);
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

  public validateRefreshToken(token: string) {
    try {
      const { iss, sub, exp, aud } = this.decodeRefreshToken(token);
      if (!iss || !sub || !exp || !aud) return false;

      if (iss !== 'steam') return false;
      if (exp < Math.floor(Date.now() / 1000)) return false;
      if (!aud.includes('renew')) return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  public getRefreshTokenExpiration(token: string) {
    try {
      const { exp } = this.decodeRefreshToken(token);
      return exp * 1000;
    } catch (error) {
      return 0;
    }
  }

  private inferLoginSessionPlatform(platform: 'web' | 'mobile' | 'desktop'): EAuthTokenPlatformType {
    if (platform === 'web') return EAuthTokenPlatformType.WebBrowser;
    else if (platform === 'mobile') return EAuthTokenPlatformType.MobileApp;
    else if (platform === 'desktop') return EAuthTokenPlatformType.SteamClient;
    else throw new Error('Invalid platform');
  }

  private inferConnectionId(id?: string) {
    return `${SteamTokensService.name}:${id || 'localhost'}`;
  }

  private throttleConnection(connectionId: string, timeoutMs: number) {
    connectionId = this.inferConnectionId(connectionId);

    this.throttledConnections.set(connectionId, true, timeoutMs);
    if (this.inferConnectionId() !== connectionId) this.proxiesService.throttleProxy(connectionId, timeoutMs);
  }

  private async waitConnectionLimitReset(connectionId: string) {
    connectionId = this.inferConnectionId(connectionId);

    const execute = () => {
      if (this.throttledConnections.get(connectionId)) return false;
      this.throttleConnection(connectionId, 1000);
      return true;
    };

    if (execute()) return;

    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!execute()) return;
        clearInterval(interval);
        resolve();
      }, 1000);
    });
  }
}
