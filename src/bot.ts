import { HttpsProxyAgent } from 'hpagent';
import { Agent } from 'https';
import { EAuthTokenPlatformType, LoginSession } from 'steam-session';
import {
  ConstructorOptions as LoginSessionOptions,
  StartLoginSessionWithCredentialsDetails as Credentials,
} from 'steam-session/dist/interfaces-external';
import SteamTotp from 'steam-totp';

import { createMachineName } from './helpers';
import { Account } from './interfaces/account.interface';

export class Bot {
  public readonly name: string;
  public readonly proxy: string | null;
  public readonly account: Account;
  public steamid: string | null = null;

  private readonly httpAgent: Agent | HttpsProxyAgent;

  constructor(options: { name: string; account: Account }, proxy?: string) {
    this.name = options.name;
    this.proxy = proxy || null;
    this.account = options.account;

    this.httpAgent = this.createHttpAgent();
  }

  public async createRefreshToken(details: { platform: 'web' | 'desktop' | 'mobile' }) {
    const credentials: Credentials = { accountName: this.account.username, password: this.account.password };
    if (this.account.sharedSecret) credentials.steamGuardCode = SteamTotp.getAuthCode(this.account.sharedSecret);

    let platform: EAuthTokenPlatformType;
    const options: LoginSessionOptions = { agent: this.httpAgent };

    switch (details.platform) {
      case 'web':
        platform = EAuthTokenPlatformType.WebBrowser;
        break;
      case 'mobile':
        platform = EAuthTokenPlatformType.MobileApp;
        break;
      case 'desktop':
        platform = EAuthTokenPlatformType.SteamClient;
        options.machineId = true;
        options.machineFriendlyName = createMachineName(credentials.accountName);
        break;
    }

    const session = new LoginSession(platform, options);
    session.on('error', () => {});

    try {
      await new Promise<void>((resolve, reject) => {
        session.once('authenticated', resolve);

        session
          .startWithCredentials(credentials)
          .then((result) => {
            if (!result.actionRequired) return;
            reject(new Error('Steam guard action required'));
          })
          .catch(reject);

        session.once('error', reject);
        session.once('timeout', () => reject(new Error('Login attempt timed out')));
      });
    } catch (error) {
      throw error;
    } finally {
      session.cancelLoginAttempt();
    }

    this.steamid = session.steamID.toString();
    return session.refreshToken;
  }

  private createHttpAgent() {
    const agent = this.proxy
      ? new HttpsProxyAgent({ proxy: this.proxy, keepAlive: true })
      : new Agent({ keepAlive: true });

    return agent;
  }
}
