import { Module } from '@nestjs/common';

import { CreateModule } from './create/create-sessions.module';
import { ValidateSessionsModule } from './validate/validate-sessions.module';

@Module({
  imports: [CreateModule, ValidateSessionsModule],
})
export class CommandsModule {}
