import { Module } from '@nestjs/common';

import { ProxiesModule } from '../../modules/proxies/proxies.module';
import { ReportsModule } from '../../modules/reports/reports.module';
import { SessionsModule } from '../../modules/sessions/sessions.module';
import { RenewCommand } from './renew.command';
import { RenewService } from './renew.service';
import { RenewUi } from './renew.ui';

@Module({
  imports: [SessionsModule, ProxiesModule, ReportsModule],
  providers: [RenewCommand, RenewService, RenewUi],
})
export class RenewModule {}
