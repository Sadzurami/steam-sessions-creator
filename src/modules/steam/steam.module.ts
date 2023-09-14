import { Module } from '@nestjs/common';

import { ProxiesModule } from '../proxies/proxies.module';
import { SteamService } from './steam.service';

@Module({
  imports: [ProxiesModule],
  providers: [SteamService],
  exports: [SteamService],
})
export class SteamModule {}
