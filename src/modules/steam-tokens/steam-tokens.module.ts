import { Module } from '@nestjs/common';

import { ProxiesModule } from '../proxies/proxies.module';
import { SteamTokensService } from './steam-tokens.service';

@Module({
  imports: [ProxiesModule],
  providers: [SteamTokensService],
  exports: [SteamTokensService],
})
export class SteamTokensModule {}
