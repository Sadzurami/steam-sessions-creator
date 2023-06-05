import { Module } from '@nestjs/common';

import { ProxiesService } from './proxies.service';

@Module({
  providers: [ProxiesService],
  exports: [ProxiesService],
})
export class ProxiesModule {}
