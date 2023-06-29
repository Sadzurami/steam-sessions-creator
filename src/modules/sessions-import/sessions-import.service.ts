import fs from 'fs/promises';
import inquirer from 'inquirer';
import pQueue from 'p-queue';
import { setTimeout as delay } from 'timers/promises';

import { Injectable, Logger } from '@nestjs/common';

import { Session } from '../../interfaces/session.interface';

@Injectable()
export class SessionsImportService {
  private readonly logger = new Logger(SessionsImportService.name);
  private readonly readFilesQueue = new pQueue({ concurrency: 100 });

  public async loadSessions(input: string[] | string) {
    if (!input) return [];
    if (!Array.isArray(input)) input = [input];
    if (input.length === 0) return [];

    let sessions: Session[] = [];
    const errors: string[] = [];

    const readResults = await Promise.all(input.map((input) => this.readSessionsFromInput(input)));
    for (const result of readResults) {
      sessions.push(...result.values);
      errors.push(...result.errors);
    }

    sessions = this.removeDuplicates(sessions);

    if (errors.length > 0 && sessions.length > 0) {
      this.logger.warn(`The following session sources are invalid:\n${errors.join('\n')}`);
      await delay(1000);

      const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'Continue with the valid sessions?',
        default: false,
      });

      if (!confirm) throw new Error('Aborted by user');
    }

    return sessions;
  }

  private removeDuplicates(sessions: Session[]) {
    const map = new Map<string, Session>();
    for (const session of sessions) map.set(session.username, session);
    return [...map.values()];
  }

  private async readSessionsFromInput(input: string) {
    const inputType = await this.inferInputType(input);
    if (inputType === 'file') return this.readSessionFromFile(input);
    if (inputType === 'string') return { values: [], errors: [input] };
    if (inputType === 'directory') return { values: [], errors: [input] };
  }

  private async readSessionFromFile(filePath: string) {
    const result: { values: Session[]; errors: string[] } = { values: [], errors: [] };

    try {
      let content = await this.readFilesQueue.add(() => fs.readFile(filePath, 'utf-8'));

      content = JSON.parse(content);
      if (content == null || typeof content !== 'object' || Array.isArray(content)) {
        throw new Error('Invalid session file');
      }

      const session = Object.fromEntries(
        Object.entries(content).map(([key, value]) => [key[0].toLowerCase() + key.slice(1), value]),
      ) as unknown as Session;

      result.values.push(session);
    } catch (error) {
      result.errors.push(filePath);
    }

    return result;
  }

  private async inferInputType(input: string) {
    if (typeof input !== 'string') throw new Error(`Invalid input type: '${typeof input}'`);

    try {
      const stats = await fs.stat(input);
      if (stats.isFile()) return 'file';
      if (stats.isDirectory()) return 'directory';
    } catch (error) {
      return 'string';
    }
  }
}
