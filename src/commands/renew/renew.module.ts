import { Module } from '@nestjs/common';

import { ProxiesModule } from '../../modules/proxies/proxies.module';
import { SessionsModule } from '../../modules/sessions/sessions.module';
import { RenewCommand } from './renew.command';
import { RenewService } from './renew.service';

@Module({
  imports: [SessionsModule, ProxiesModule],
  providers: [RenewService, RenewCommand],
})
export class RenewModule {}
