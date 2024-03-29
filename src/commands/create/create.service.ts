import pQueue from 'p-queue';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { Account } from '../../modules/accounts/account.interface';
import { AccountsService } from '../../modules/accounts/accounts.service';
import { ProxiesService } from '../../modules/proxies/proxies.service';
import { SessionsService } from '../../modules/sessions/sessions.service';

@Injectable()
export class CreateService implements OnModuleDestroy {
  public readonly stats: Record<string, string[]> = { success: [], fail: [], skip: [] };
  public forceCreation = false;

  private readonly logger = new Logger(CreateService.name);
  private queue: pQueue;

  constructor(
    private readonly sessions: SessionsService,
    private readonly accounts: AccountsService,
    private readonly proxies: ProxiesService,
  ) {}

  public get progress() {
    const { success, fail, skip } = this.stats;
    const total = this.accounts.getCount();

    return total > 0 ? Math.floor(((success.length + fail.length + skip.length) / total) * 100) : 100;
  }

  public async onModuleDestroy() {
    this.stop();
  }

  public async start() {
    const accounts = this.accounts.getAll();
    if (!accounts.length) return;

    const queue = new pQueue({ concurrency: this.proxies.getCount() || 1, interval: 1, intervalCap: 1 });
    for (const account of accounts) {
      queue.add(() => this.runTask(account)).then((result) => this.stats[result].push(account.username));
    }

    this.queue = queue;
    await queue.onIdle();
  }

  public stop() {
    if (!this.queue) return;

    this.queue.pause();
    this.queue.clear();
  }

  private async runTask(account: Account): Promise<'success' | 'fail' | 'skip'> {
    if (this.sessions.getOne(account.username) !== null && !this.forceCreation) {
      this.logger.verbose(`Session for ${account.username} already created, skipping`);

      return 'skip';
    }

    try {
      const session = await this.sessions.create(account);
      await this.sessions.exportOne(session);

      this.logger.verbose(`Session for ${account.username} successfully created`);

      return 'success';
    } catch (error) {
      this.logger.warn(`Failed to create session for ${account.username}: ${error.message}`);

      return 'fail';
    } finally {
      await delay(30 * 1000); // prevent rate-limit
    }
  }
}
