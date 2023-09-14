import { Module } from '@nestjs/common';

import { CreateModule } from './create/create.module';
import { RenewModule } from './renew/renew.module';

@Module({
  imports: [CreateModule, RenewModule],
})
export class CommandsModule {}
