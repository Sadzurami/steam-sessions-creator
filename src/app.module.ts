import { Global, Module } from '@nestjs/common';

import { AppService } from './app.service';
import { CommandsModule } from './commands/commands.module';
import { ConfigModule } from './config/config.module';
import { LoggerModule } from './modules/logger/logger.module';

@Global()
@Module({
  imports: [ConfigModule, LoggerModule, CommandsModule],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}
