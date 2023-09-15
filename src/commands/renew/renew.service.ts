import fs from 'fs/promises';
import pQueue from 'p-queue';
import path from 'path';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';

import { ProxiesService } from '../../modules/proxies/proxies.service';
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
    const outputExists = await fs
      .access(path.resolve(options.sessions))
      .then(() => true)
      .catch(() => false);
    if (!outputExists) await fs.mkdir(path.resolve(options.sessions), { recursive: true });

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
      interval: 10,
      intervalCap: 1,
    });

    for (const session of sessions) {
      if (this.sessions.validateOne(session)) {
        this.logger.verbose(`Session for ${session.Username} is valid and not expired yet`);

        if (!options.force) {
          payload.skipped++;
          payload.left--;

          this.logger.verbose(`Skipping renewing session for ${session.Username}`);
          continue;
        }
      }

      queue.add(() =>
        this.sessions
          .create(this.sessions.convertToAccount(session))
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
          })
          .then(() => delay(31 * 1000)),
      );
    }

    return payload;
  }
}
