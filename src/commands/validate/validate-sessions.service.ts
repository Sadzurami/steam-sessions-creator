import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Session } from '../../interfaces/session.interface';
import { SteamTokensService } from '../../modules/steam-tokens/steam-tokens.service';

@Injectable()
export class ValidateSessionsService {
  private readonly logger = new Logger(ValidateSessionsService.name);

  constructor(private readonly steamTokensService: SteamTokensService, private readonly configService: ConfigService) {}

  public async validateSessions(sessions: Session[]) {
    const valid: Session[] = [];
    const invalid: Session[] = [];

    for (const session of sessions) {
      const { valid: isValid, errors, expires } = await this.validateSession(session);
      if (isValid) {
        valid.push(session);
        this.logger.log(
          `Valid: ${session.username}, days: ${Math.floor((expires - Date.now()) / (24 * 60 * 60 * 1000))}`,
        );
      } else {
        invalid.push(session);
        this.logger.warn(`Invalid: ${session.username}, errors: ${errors.join(', ')}`);
      }
    }

    if (invalid.length > 0) {
      this.logger.warn(`Invalid sessions:\n${invalid.map((session) => session.username).join('\n')}`);
    }

    await delay(1000);
  }

  private async validateSession(session: Session) {
    const errors: string[] = [];
    let expires = Date.now();

    if (!session) errors.push('Invalid session');

    if (session.schemaVersion !== this.configService.getOrThrow<number>('session.schemaVersion')) {
      errors.push('Outdated schema version');
    }

    if (!session.username) errors.push('Invalid username');
    if (!session.password) errors.push('Invalid password');
    if (!session.steamId) errors.push('Invalid steamId');

    if (!session.hasOwnProperty('sharedSecret')) errors.push('Invalid shared Secret');
    if (!session.hasOwnProperty('identitySecret')) errors.push('Invalid identity Secret');

    if (session.desktopRefreshToken) {
      if (!this.steamTokensService.validateRefreshToken(session.desktopRefreshToken)) {
        errors.push('Invalid desktop refresh token');
      }
      const tokenExpiration = this.steamTokensService.getRefreshTokenExpiration(session.desktopRefreshToken);
      if (tokenExpiration > expires) expires = tokenExpiration;
    }

    if (session.mobileRefreshToken) {
      if (!this.steamTokensService.validateRefreshToken(session.mobileRefreshToken)) {
        errors.push('Invalid mobile refresh token');
      }
      const tokenExpiration = this.steamTokensService.getRefreshTokenExpiration(session.mobileRefreshToken);
      if (tokenExpiration > expires) expires = tokenExpiration;
    }

    if (session.webRefreshToken) {
      if (!this.steamTokensService.validateRefreshToken(session.webRefreshToken)) {
        errors.push('Invalid web refresh token');
      }
      const tokenExpiration = this.steamTokensService.getRefreshTokenExpiration(session.webRefreshToken);
      if (tokenExpiration > expires) expires = tokenExpiration;
    }

    if (expires < Date.now()) errors.push('Expired session');

    return { valid: errors.length === 0, errors, expires };
  }
}
