import { EAuthTokenPlatformType, LoginSession } from 'steam-session';
import {
  ConstructorOptions as LoginSessionOptions,
  StartLoginSessionWithCredentialsDetails as LoginSessionCredentials,
} from 'steam-session/dist/interfaces-external';
import SteamTotp from 'steam-totp';

import { Injectable } from '@nestjs/common';

import { Account } from '../accounts/account.interface';
import { ProxiesService } from '../proxies/proxies.service';

@Injectable()
export class SteamService {
  constructor(private readonly proxies: ProxiesService) {}

  public async createRefreshToken(account: Account, platform: 'web' | 'mobile' | 'desktop') {
    let platformType: EAuthTokenPlatformType;
    switch (platform) {
      case 'web':
        platformType = EAuthTokenPlatformType.WebBrowser;
        break;
      case 'mobile':
        platformType = EAuthTokenPlatformType.MobileApp;
        break;
      case 'desktop':
        platformType = EAuthTokenPlatformType.SteamClient;
        break;
    }

    const options: LoginSessionOptions = {};

    const proxy = this.proxies.getOne();
    if (proxy) {
      const proxyType = proxy.startsWith('socks') ? 'socksProxy' : 'httpProxy';
      options[proxyType] = proxy;
    }

    const session = new LoginSession(platformType, options);
    session.on('error', () => {});

    const credentials: LoginSessionCredentials = { accountName: account.username, password: account.password };
    if (account.sharedSecret) credentials.steamGuardCode = SteamTotp.getAuthCode(account.sharedSecret);

    return await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        session.cancelLoginAttempt();

        reject(new Error('Session timed out'));
      }, 35000);

      session.once('authenticated', () => {
        session.cancelLoginAttempt();
        clearTimeout(timeout);

        resolve(session.refreshToken);
      });

      session.once('error', (error) => {
        session.cancelLoginAttempt();
        clearTimeout(timeout);

        reject(new Error('Session error', { cause: error }));
      });

      session.once('timeout', () => {
        session.cancelLoginAttempt();
        clearTimeout(timeout);

        reject(new Error('Session timed out'));
      });

      session.startWithCredentials(credentials).then((result) => {
        if (!result.actionRequired) return;

        session.cancelLoginAttempt();
        clearTimeout(timeout);

        reject(new Error('Session requires guard action'));
      });
    });
  }

  public decodeRefreshToken(token: string): { iss: string; sub: string; aud: string[]; exp: number } {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Token must have 3 parts');

      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadString = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const payloadJson = JSON.parse(payloadString);

      return payloadJson;
    } catch (error) {
      throw new Error('Failed to decode refresh token', { cause: error });
    }
  }
}
