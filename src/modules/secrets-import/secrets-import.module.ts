import { Module } from '@nestjs/common';

import { SecretsImportService } from './secrets-import.service';

@Module({
  providers: [SecretsImportService],
  exports: [SecretsImportService],
})
export class SecretsImportModule {}
