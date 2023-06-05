import fs from 'fs/promises';
import path from 'path';

import { Injectable } from '@nestjs/common';

import { Session } from '../../interfaces/session.interface';

@Injectable()
export class ExportSessionsService {
  private readonly fileExtension = 'steamsession';
  private outputPath = './output';

  public async setOutputPath(directory: string) {
    if (directory === this.outputPath) return;
    if (!directory || typeof directory !== 'string') throw new Error('Invalid output path');
    if (!path.isAbsolute(directory)) throw new Error('Output path must be absolute');

    try {
      await fs.mkdir(directory, { recursive: true });
    } catch (error) {
      throw new Error('Failed to create output directory', { cause: error });
    }

    this.outputPath = directory;
  }

  public async exportSession(session: Session) {
    const serializedSession = this.serializeSession(session);
    const sessionPath = path.resolve(this.outputPath, `${session.username}.${this.fileExtension}`);

    try {
      await fs.writeFile(sessionPath, serializedSession);
    } catch (error) {
      throw new Error('Failed to write session to file', { cause: error });
    }
  }

  private serializeSession(session: Session) {
    const serializedObject = {
      Username: session.username,
      Password: session.password,
      SteamId: session.steamId,
      RefreshToken: session.refreshToken,
      SharedSecret: session.sharedSecret,
      IdentitySecret: session.identitySecret,
      SchemaVersion: session.schemaVersion,
    };

    const serializedString = JSON.stringify(serializedObject, null, 2);

    return serializedString;
  }
}
