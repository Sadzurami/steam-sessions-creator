import { Module } from '@nestjs/common';

import { AccountsImportModule } from '../../modules/accounts-import/accounts-import.module';
import { ExportSessionsModule } from '../../modules/export-sessions/export-sessions.module';
import { ProxiesImportModule } from '../../modules/proxies-import/proxies-import.module';
import { ProxiesModule } from '../../modules/proxies/proxies.module';
import { SecretsImportModule } from '../../modules/secrets-import/secrets-import.module';
import { SteamTokensModule } from '../../modules/steam-tokens/steam-tokens.module';
import { CreateSessionsCommand } from './create-sessions.command';
import { CreateSessionsService } from './create-sessions.service';

@Module({
  imports: [
    AccountsImportModule,
    SecretsImportModule,
    ProxiesImportModule,
    ExportSessionsModule,
    ProxiesModule,
    SteamTokensModule,
  ],
  providers: [CreateSessionsCommand, CreateSessionsService],
})
export class CreateModule {}
