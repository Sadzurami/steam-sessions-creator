import { Module } from '@nestjs/common';

import { SecretsModule } from '../secrets/secrets.module';
import { AccountsService } from './accounts.service';

@Module({
  imports: [SecretsModule],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
