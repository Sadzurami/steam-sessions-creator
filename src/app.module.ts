import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppService } from './app.service';
import { CommandsModule } from './commands/commands.module';
import configuration from './config/configuration';
import { LoggerModule } from './modules/logger/logger.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    LoggerModule,
    CacheModule.register(),
    CommandsModule,
  ],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}
