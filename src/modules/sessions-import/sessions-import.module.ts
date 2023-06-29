import { Module } from '@nestjs/common';

import { SessionsImportService } from './sessions-import.service';

@Module({
  providers: [SessionsImportService],
  exports: [SessionsImportService],
})
export class SessionsImportModule {}
