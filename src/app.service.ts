import { Subject } from 'rxjs';

import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig, Config } from './config/config.source';

@Injectable()
export class AppService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AppService.name);
  private readonly shutdownListener$: Subject<void> = new Subject();

  private isShuttingDown = false;

  constructor(private readonly config: ConfigService<Config>) {}

  public onModuleInit() {
    this.catchExceptions();
    this.setProcessTitle();
  }

  public onApplicationShutdown() {
    process.exit(0);
  }

  public shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.shutdownListener$.next();
  }

  public onShutdown(listener: () => any) {
    this.shutdownListener$.subscribe(listener);
  }

  private setProcessTitle() {
    const { name, version, env } = this.config.getOrThrow<AppConfig>('app');

    const title = `${name} v${version} (${env})`;
    if (process.title === title) return;

    if (process.platform === 'win32') process.title = title;
    else process.stdout.write(`\x1b]2;${title}\x1b\x5c`);
  }

  private catchExceptions() {
    process.on('uncaughtException', (error) => {
      this.logger.error(new Error('Uncaught exception', { cause: error }));
      this.shutdown();
    });
    process.on('unhandledRejection', (reason) => {
      this.logger.error(new Error('Unhandled rejection', { cause: reason }));
      this.shutdown();
    });
  }
}
