import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import ConfigSource from './config.source';

@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true, cache: true, load: [ConfigSource] })],
})
export class ConfigModule {}
