import { Subject } from 'rxjs';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private readonly shutdownListener$: Subject<void> = new Subject();

  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {}

  public onModuleInit() {
    this.initialize();
  }

  private initialize() {
    this.catchExceptions();
    this.setProcessTitle(this.configService.getOrThrow('app.title'));
  }

  public shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    this.shutdownListener$.next();
  }

  private setProcessTitle(title: string) {
    if (process.title === title) return;
    if (process.platform === 'win32') process.title = title;
    else process.stdout.write(`\x1b]2;${title}\x1b\x5c`);
  }

  public subscribeToShutdown(shutdownFn: () => void): void {
    this.shutdownListener$.subscribe(() => shutdownFn());
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
