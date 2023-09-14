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

    const outputExists = await fs
      .access(path.resolve(options.output))
      .then(() => true)
      .catch(() => false);
    if (!outputExists) await fs.mkdir(path.resolve(options.output), { recursive: true });

    await this.sessions.importAll(path.resolve(options.output));

    const sessions = this.sessions.getAll();
    const accounts = this.accounts
      .getAll()
      .map((account) => ({ ...account, ...(this.secrets.findOne(account.username) || {}) }));

    const payload = {
      accounts: this.accounts.getCount(),
      sessions: this.sessions.getCount(),
      secrets: this.secrets.getCount(),
      proxies: this.proxies.getCount(),

      created: 0,
      failed: 0,

      total: this.accounts.getCount(),
      left: this.accounts.getCount(),
    };

    const queue = new pQueue({ concurrency: this.proxies.getCount() || 1, interval: 10, intervalCap: 1 });

    for (const account of accounts) {
      if (sessions.some((session) => session.Username === account.username)) {
        this.logger.verbose(`Session for ${account.username} already exists`);

        if (!options.force) {
          payload.created++;
          payload.left--;

          this.logger.verbose(`Skipping creating session for ${account.username}`);
          continue;
        }
      }

      queue
        .add(() =>
          this.sessions
            .create(account)
            .then((session) => this.sessions.exportOne(session, path.resolve(options.output))),
        )
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
        })
        .then(() => delay(31 * 1000));
    }

    return payload;
  }
}
