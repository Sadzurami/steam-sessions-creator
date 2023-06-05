import { Module } from '@nestjs/common';

import { AccountsImportService } from './accounts-import.service';

@Module({
  providers: [AccountsImportService],
  exports: [AccountsImportService],
})
export class AccountsImportModule {}
