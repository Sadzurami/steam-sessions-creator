import { Module } from '@nestjs/common';

import { ProxiesImportService } from './proxies-import.service';

@Module({
  providers: [ProxiesImportService],
  exports: [ProxiesImportService],
})
export class ProxiesImportModule {}
