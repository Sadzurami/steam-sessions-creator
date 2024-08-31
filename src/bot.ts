import { HttpsProxyAgent } from 'hpagent';
import { Agent } from 'https';
import { EAuthTokenPlatformType, LoginSession } from 'steam-session';
import {
  ConstructorOptions as LoginSessionOptions,
  StartLoginSessionWithCredentialsDetails as Credentials,
} from 'steam-session/dist/interfaces-external';
import SteamTotp from 'steam-totp';

import { Account } from './interfaces/account.interface';

export class Bot {
  public readonly name: string;
  public readonly proxy: string | null;
  public readonly account: Account;

  public steamid: string | null = null;
  public refreshToken: string | null = null;

  private readonly httpAgent: Agent | HttpsProxyAgent;

  constructor(options: { name: string; account: Account }, proxy?: string) {
    this.name = options.name;
    this.proxy = proxy || null;
    this.account = options.account;

    this.httpAgent = this.createHttpAgent();
  }

  public async start(options: { platform: 'web' | 'desktop' | 'mobile' }) {
    const sessionOptions: LoginSessionOptions = { agent: this.httpAgent };

    let sessionPlatform: EAuthTokenPlatformType;
    switch (options.platform) {
      case 'web':
        sessionPlatform = EAuthTokenPlatformType.WebBrowser;
        break;
      case 'mobile':
        sessionPlatform = EAuthTokenPlatformType.MobileApp;
        break;
      case 'desktop':
        sessionPlatform = EAuthTokenPlatformType.SteamClient;
        sessionOptions.machineId = true;
        break;
    }

    const session = new LoginSession(sessionPlatform, sessionOptions);
    session.on('error', () => {});

    const credentials: Credentials = { accountName: this.account.username, password: this.account.password };
    if (this.account.sharedSecret) credentials.steamGuardCode = SteamTotp.getAuthCode(this.account.sharedSecret);

    const promise = new Promise<void>((resolve, reject) => {
      session.once('authenticated', resolve);

      session
        .startWithCredentials(credentials)
        .then((result) => {
          if (!result.actionRequired) return;
          throw new Error('Steam guard action required');
        })
        .catch(reject);

      session.once('error', reject);
      session.once('timeout', () => reject(new Error('Login attempt timed out')));
    });

    promise.finally(() => session.cancelLoginAttempt());
    await promise;

    this.steamid = session.steamID.toString();
    this.refreshToken = session.refreshToken;
  }

  public stop() {
    this.httpAgent.destroy();
  }

  private createHttpAgent() {
    const agent = this.proxy
      ? new HttpsProxyAgent({ proxy: this.proxy, keepAlive: true })
      : new Agent({ keepAlive: true });

    return agent;
  }
}
