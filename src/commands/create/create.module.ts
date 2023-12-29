import { Module } from '@nestjs/common';

import { AccountsModule } from '../../modules/accounts/accounts.module';
import { ProxiesModule } from '../../modules/proxies/proxies.module';
import { ReportsModule } from '../../modules/reports/reports.module';
import { SecretsModule } from '../../modules/secrets/secrets.module';
import { SessionsModule } from '../../modules/sessions/sessions.module';
import { CreateCommand } from './create.command';
import { CreateService } from './create.service';
import { CreateUi } from './create.ui';

@Module({
  imports: [SessionsModule, AccountsModule, SecretsModule, ProxiesModule, ReportsModule],
  providers: [CreateCommand, CreateService, CreateUi],
})
export class CreateModule {}
