import { pino } from 'pino';

import { BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LoggerConfig } from '../../config/interfaces/logger.config.interface';

@Injectable()
export class LoggerService implements BeforeApplicationShutdown {
  private destination: ReturnType<typeof pino.destination>;

  constructor(private readonly config: ConfigService) {}

  public beforeApplicationShutdown() {
    this.destination.flushSync();
  }

  public createLogger() {
    const { filePath } = this.config.getOrThrow<LoggerConfig>('logger');

    const destination = pino.destination({ dest: filePath, mkdir: true, sync: true });
    this.destination = destination;

    return pino({ level: 'trace', base: null }, destination);
  }
}
