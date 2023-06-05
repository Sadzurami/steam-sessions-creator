import { PinoLogger } from 'nestjs-pino';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class LoggerService implements OnModuleDestroy {
  constructor(private readonly logger: PinoLogger) {}

  public async onModuleDestroy() {
    this.logger.logger.flush();
    await delay(1000);
  }
}
