import fs from 'fs/promises';
import pQueue from 'p-queue';
import path from 'path';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';

import { AccountsService } from '../../modules/accounts/accounts.service';
import { ProxiesService } from '../../modules/proxies/proxies.service';
import { SecretsService } from '../../modules/secrets/secrets.service';
import { SessionsService } from '../../modules/sessions/sessions.service';
import { CreateOptions } from './create.options.interface';

@Injectable()
export class CreateService {
  private readonly logger = new Logger(CreateService.name);

  constructor(
    private readonly sessions: SessionsService,
    private readonly accounts: AccountsService,
    private readonly secrets: SecretsService,
    private readonly proxies: ProxiesService,
  ) {}

  public async run(options: CreateOptions) {
    if (options.accounts) await this.accounts.importAll(path.resolve(options.accounts));
    if (options.secrets) await this.secrets.importAll(path.resolve(options.secrets));
    if (options.proxies) await this.proxies.importAll(path.resolve(options.proxies));

    try {
      await fs.access(path.resolve(options.output));
    } catch (error) {
      await fs.mkdir(path.resolve(options.output), { recursive: true });
    }

    await this.sessions.importAll(path.resolve(options.output));

    const sessions = this.sessions.getAll();

    const accounts = this.accounts.getAll().map((account) => ({
      ...account,
      ...(this.secrets.findOne(account.username) || {}),
    }));

    const payload = {
      accounts: this.accounts.getCount(),
      sessions: this.sessions.getCount(),
      secrets: this.secrets.getCount(),
      proxies: this.proxies.getCount(),

      skipped: 0,
      created: 0,
      failed: 0,

      total: this.accounts.getCount(),
      left: this.accounts.getCount(),
    };

    // intervals for smooth progress and non blocking event loop
    const queue = new pQueue({ concurrency: this.proxies.getCount() || 1, interval: 1, intervalCap: 1 });

    for (const account of accounts) {
      queue.add(async () => {
        const alreadyCreated = sessions.some((session) => session.Username === account.username);

        if (alreadyCreated && !options.force) {
          payload.skipped++;
          payload.left--;

          this.logger.verbose(`Skipping create session for ${account.username}`);
          return;
        }

        await this.sessions
          .create(account)
          .then((session) => this.sessions.exportOne(session, path.resolve(options.output)))
          .then(() => {
            payload.created++;
            this.logger.verbose(`Session for ${account.username} successfully created`);
          })
          .catch(() => {
            payload.failed++;
            this.logger.verbose(`Failed to create session for ${account.username}`);
          })
          .finally(() => {
            payload.left--;
          });

        await delay(30 * 1000); // prevent rate limit
      });
    }

    return payload;
  }
}
