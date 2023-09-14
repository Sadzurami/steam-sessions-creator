import chalk from 'chalk';
import fs from 'fs';
import logUpdate from 'log-update';
import { Command, CommandRunner, Option } from 'nest-commander';
import path from 'path';

import { AppService } from '../../app.service';
import { RenewOptions } from './renew.options.interface';
import { RenewService } from './renew.service';

@Command({
  name: 'renew',
  description: 'Renew sessions.',
  options: {},
})
export class RenewCommand extends CommandRunner {
  constructor(
    private readonly app: AppService,
    private readonly renewService: RenewService,
  ) {
    super();
  }

  async run(args: string[], options: RenewOptions) {
    const payload = await this.renewService.run(options);

    const createUi = () => {
      const header = `Sessions: ${chalk.cyanBright(payload.sessions)}, Proxies: ${chalk.cyanBright(payload.proxies)}`;

      const progress = Math.round(((payload.total - payload.left) / payload.total) * 100) || 0;

      const progressBarSize = Math.floor(header.length / 2);
      const progressBar = `${'█'.repeat(Math.round((progress / 100) * progressBarSize))}`;
      const progressBarEmpty = `${'░'.repeat(progressBarSize - Math.round((progress / 100) * progressBarSize))}`;

      const body = `${chalk.green(progressBar + progressBarEmpty)} ${chalk.cyanBright(progress)}%`;

      const footer = `Renewed: ${chalk.cyanBright(payload.renewed)}, Skipped: ${chalk.cyanBright(
        payload.skipped,
      )}, Failed: ${chalk.cyanBright(payload.failed)}, Left: ${chalk.cyanBright(payload.left)}`;

      return `${header}\n\n${body}\n\n${footer}`;
    };

    setInterval(() => {
      logUpdate(createUi());
      if (payload.left === 0) this.app.shutdown();
    }, 1000);
  }

  @Option({
    flags: '-s, --sessions <sessions>',
    description: 'Specify directory path where sessions are stored.',
    defaultValue: './sessions',
  })
  parseSessionsOption(value: string) {
    value = path.resolve(value);

    if (fs.existsSync(value) && !fs.statSync(value).isDirectory()) {
      throw new Error('Sessions option must be a directory path');
    }

    return value;
  }

  @Option({
    flags: '-p, --proxies <proxies>',
    description: `Specify file path where proxies are stored.
Supported formats: proto://user:pass@host:port`,
    defaultValue: './proxies.txt',
  })
  parseProxiesOption(value: string) {
    value = path.resolve(value);

    if (fs.existsSync(value) && !fs.statSync(value).isFile()) throw new Error(`Proxies option must be a file path`);

    return value;
  }

  @Option({
    flags: '-f, --force',
    description: 'Force renew, even if session is valid and not expired yet.',
  })
  parseForceOption(value: any) {
    return value;
  }
}
