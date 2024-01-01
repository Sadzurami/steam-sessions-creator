import pQueue from 'p-queue';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { Account } from '../../modules/accounts/account.interface';
import { ProxiesService } from '../../modules/proxies/proxies.service';
import { Session } from '../../modules/sessions/session.interface';
import { SessionsService } from '../../modules/sessions/sessions.service';

@Injectable()
export class RenewService implements OnModuleDestroy {
  public readonly stats: Record<string, string[]> = { success: [], fail: [], skip: [] };
  public forceRenewing = false;

  private readonly logger = new Logger(RenewService.name);
  private queue: pQueue;

  constructor(
    private readonly sessions: SessionsService,
    private readonly proxies: ProxiesService,
  ) {}

  public get progress() {
    const { success, fail, skip } = this.stats;
    const total = this.sessions.getCount();

    return total > 0 ? Math.floor(((success.length + fail.length + skip.length) / total) * 100) : 100;
  }

  public async onModuleDestroy() {
    this.stop();
  }

  public async start() {
    const sessions = this.sessions.getAll();
    if (!sessions.length) return;

    const queue = new pQueue({ concurrency: this.proxies.getCount() || 1, interval: 1, intervalCap: 1 });
    for (const session of sessions) {
      queue.add(() => this.runTask(session)).then((result) => this.stats[result].push(session.Username));
    }

    this.queue = queue;
    await queue.onIdle();
  }

  public stop() {
    if (!this.queue) return;

    this.queue.pause();
    this.queue.clear();
  }

  private async runTask(session: Session): Promise<'success' | 'fail' | 'skip'> {
    if (this.sessions.validateOne(session) && !this.forceRenewing) {
      this.logger.verbose(`Session for ${session.Username} not required to renew, skipping`);

      return 'skip';
    }

    try {
      const account: Account = {
        username: session.Username,
        password: session.Password,
        sharedSecret: session.SharedSecret,
        identitySecret: session.IdentitySecret,
      };

      const renewedSession = await this.sessions.create(account);
      await this.sessions.exportOne(renewedSession);

      this.logger.verbose(`Session for ${session.Username} successfully renewed`);

      return 'success';
    } catch (error) {
      this.logger.warn(`Failed to renew session for ${session.Username}: ${error.message}`);

      return 'fail';
    } finally {
      await delay(30 * 1000); // prevent rate-limit
    }
  }
}
