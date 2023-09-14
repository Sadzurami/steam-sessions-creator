import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { Global, Module } from '@nestjs/common';

import { LoggerService } from './logger.service';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [LoggerService],
      providers: [LoggerService],
      useFactory: async (loggerService: LoggerService) => {
        loggerService.createLogger();
        return { pinoHttp: { logger: loggerService.getLogger() } };
      },
    }),
  ],
})
export class LoggerModule {}
