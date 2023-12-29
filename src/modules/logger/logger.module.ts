import { LoggerModule as PinoLoggerModule, Params } from 'nestjs-pino';

import { Global, Module } from '@nestjs/common';

import { LoggerService } from './logger.service';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [LoggerService],
      providers: [LoggerService],
      useFactory: async (loggerService: LoggerService) => {
        const logger = loggerService.createLogger();
        return { pinoHttp: { logger } } as unknown as Params;
      },
    }),
  ],
})
export class LoggerModule {}
