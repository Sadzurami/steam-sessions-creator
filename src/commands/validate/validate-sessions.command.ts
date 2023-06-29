import glob from 'fast-glob';
import { Command, CommandRunner, Help, Option } from 'nest-commander';

import { Logger } from '@nestjs/common';

import { SessionsImportService } from '../../modules/sessions-import/sessions-import.service';
import { ValidateSessionsService } from './validate-sessions.service';

interface ValidateCommandOptions {
  sessions: string | string[];
}

@Command({
  name: 'validate',
  description: 'Validates sessions',
})
export class ValidateSessionsCommand extends CommandRunner {
  private readonly logger = new Logger(ValidateSessionsCommand.name);

  constructor(
    private readonly sessionsImportService: SessionsImportService,
    private readonly validateSessionsService: ValidateSessionsService,
  ) {
    super();
  }

  public async run(args: string[], options: ValidateCommandOptions) {
    try {
      const sessionsOptionInput = await this.normalizeInput(options.sessions);
      const sessions = await this.sessionsImportService.loadSessions(sessionsOptionInput);
      if (sessions.length === 0) throw new Error('No sessions found');
      this.logger.log(`Sessions: ${sessions.length}`);

      await this.validateSessionsService.validateSessions(sessions);
    } catch (error) {
      this.logger.error(error.message);
    }
  }

  private async normalizeInput(input: string | string[]) {
    if (!input) return [];

    if (!Array.isArray(input)) input = [input];

    const filteredInput = input.filter((el) => typeof el === 'string' && el.trim() !== '');
    if (filteredInput.length === 0) return [];

    const nestedData = await Promise.all(
      filteredInput.map(async (el) => {
        el = el.trim();

        // Possible glob pattern
        const files = await glob(el);
        if (files.length > 0) return files;

        // Possible string
        return el.split(/\s+|\r?\n/).map((line) => line.trim());
      }),
    );

    return nestedData.flat();
  }

  @Option({
    flags: '-s, --sessions <sessions...>',
    description: `Specify one or more sessions.
Session can be specified as:
- A file path to load session from.
- A glob pattern to load sessions from multiple files.`,
  })
  private parseSessionsOption(val: string, accumulator: string[] = []) {
    accumulator.push(val);
    return accumulator;
  }

  @Help('afterAll')
  private displayHelp() {
    return `
Examples:
  validate -s example.steamsession
  validate -s sessions/*.steamsession`;
  }
}
