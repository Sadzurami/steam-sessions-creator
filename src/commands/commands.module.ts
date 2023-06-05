import { Module } from '@nestjs/common';

import { CreateModule } from './create/create-sessions.module';

@Module({
  imports: [CreateModule],
})
export class CommandsModule {}
