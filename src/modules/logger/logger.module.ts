import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { LoggerService } from './logger.service';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService) => ({
        pinoHttp: {
          level: configService.getOrThrow('app.environment') === 'production' ? 'info' : 'trace',
          base: null,
          transport: {
            targets: [{ target: 'pino-pretty', level: 'trace', options: {} }],
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [LoggerService],
})
export class LoggerModule {}
