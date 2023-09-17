import pQueue from 'p-queue';
import path from 'path';

import { Injectable, Logger } from '@nestjs/common';

import { Account } from '../../modules/accounts/account.interface';
import { ProxiesService } from '../../modules/proxies/proxies.service';
import { Session } from '../../modules/sessions/session.interface';
import { SessionsService } from '../../modules/sessions/sessions.service';
import { RenewOptions } from './renew.options.interface';

@Injectable()
export class RenewService {
  private readonly logger = new Logger(RenewService.name);

  constructor(
    private readonly sessions: SessionsService,
    private readonly proxies: ProxiesService,
  ) {}

  public async run(options: RenewOptions) {
    if (options.sessions) await this.sessions.importAll(path.resolve(options.sessions));
    if (options.proxies) await this.proxies.importAll(path.resolve(options.proxies));

    const sessions = this.sessions.getAll();

    const payload = {
      sessions: this.sessions.getCount(),
      proxies: this.proxies.getCount(),

      renewed: 0,
      skipped: 0,
      failed: 0,

      total: this.sessions.getCount(),
      left: this.sessions.getCount(),
    };

    const queue = new pQueue({
      concurrency: this.proxies.getCount() || 1,
      interval: 30 * 1000,
      intervalCap: this.proxies.getCount() || 1,
    });

    for (const session of sessions) {
      const sessionValid = this.sessions.validateOne(session);

      if (sessionValid && !options.force) {
        payload.skipped++;
        payload.left--;

        this.logger.verbose(`Skipping renew session for ${session.Username}`);
        continue;
      }

      const account = this.convertSessionToAccount(session);

      queue.add(() =>
        this.sessions
          .create(account)
          .then((session) => this.sessions.exportOne(session, path.resolve(options.sessions)))
          .then(() => {
            payload.renewed++;
            this.logger.verbose(`Session for ${session.Username} successfully renewed`);
          })
          .catch(() => {
            payload.failed++;
            this.logger.verbose(`Failed to renew session for ${session.Username}`);
          })
          .finally(() => {
            payload.left--;
          }),
      );
    }

    return payload;
  }

  private convertSessionToAccount(session: Session): Account {
    return {
      username: session.Username,
      password: session.Password,
      sharedSecret: session.SharedSecret,
      identitySecret: session.IdentitySecret,
    };
  }
}
