import { Module } from '@nestjs/common';

import { AccountsModule } from '../../modules/accounts/accounts.module';
import { ProxiesModule } from '../../modules/proxies/proxies.module';
import { SecretsModule } from '../../modules/secrets/secrets.module';
import { SessionsModule } from '../../modules/sessions/sessions.module';
import { CreateCommand } from './create.command';
import { CreateService } from './create.service';

@Module({
  imports: [SessionsModule, AccountsModule, SecretsModule, ProxiesModule],
  providers: [CreateService, CreateCommand],
})
export class CreateModule {}
