import { Module } from '@nestjs/common';

import { SteamModule } from '../steam/steam.module';
import { SessionsService } from './sessions.service';

@Module({
  imports: [SteamModule],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
