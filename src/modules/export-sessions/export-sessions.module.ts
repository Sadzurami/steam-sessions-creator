import { Module } from '@nestjs/common';

import { ExportSessionsService } from './export-sessions.service';

@Module({
  providers: [ExportSessionsService],
  exports: [ExportSessionsService],
})
export class ExportSessionsModule {}
