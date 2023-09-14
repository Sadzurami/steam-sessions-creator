import path from 'path';
import { Logger, pino } from 'pino';

import { BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../../config/config.source';

@Injectable()
export class LoggerService implements BeforeApplicationShutdown {
  private logger: Logger;
  private destination: ReturnType<typeof pino.destination>;

  constructor(private readonly config: ConfigService) {}

  public beforeApplicationShutdown() {
    this.destination.flushSync();
  }

  public createLogger() {
    const { cwd } = this.config.getOrThrow<AppConfig>('app');

    const logName = `${new Date().toJSON().replace(/[^\d]/g, '.').slice(0, -1)}.log`;
    const logPath = path.join(cwd, 'logs', logName);

    const destination = pino.destination({ dest: logPath, mkdir: true, sync: true });
    this.destination = destination;

    const logger = pino({ level: 'trace', base: null }, destination);
    this.logger = logger;
  }

  public getLogger() {
    return this.logger;
  }
}
