import { Module } from '@nestjs/common';

import { AccountsService } from './accounts.service';

@Module({
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
