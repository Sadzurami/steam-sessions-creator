import { Module } from '@nestjs/common';

import { SessionsImportModule } from '../../modules/sessions-import/sessions-import.module';
import { SteamTokensModule } from '../../modules/steam-tokens/steam-tokens.module';
import { ValidateSessionsCommand } from './validate-sessions.command';
import { ValidateSessionsService } from './validate-sessions.service';

@Module({
  imports: [SessionsImportModule, SteamTokensModule],
  providers: [ValidateSessionsCommand, ValidateSessionsService],
})
export class ValidateSessionsModule {}
