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

    let frameIndex = 0;
    const spinnerFrames = ['-', '\\', '|', '/'];

    const interval = setInterval(() => {
      // use spinner to indicate that app is still running
      const spinner = spinnerFrames[(frameIndex = ++frameIndex % spinnerFrames.length)];

      const resoursesString = `Sessions: ${chalk.cyanBright(payload.sessions)}, Proxies: ${chalk.cyanBright(
        payload.proxies,
      )} ${spinner}`;

      const progressValue = Math.round(((payload.total - payload.left) / payload.total) * 100) || 0;
      const barSize = 30;
      const progressBar = `${'█'.repeat(Math.round((progressValue / 100) * barSize))}`;
      const barEmpty = `${'░'.repeat(barSize - Math.round((progressValue / 100) * barSize))}`;

      const progressString = `${chalk.greenBright(progressBar + barEmpty)} ${chalk.cyanBright(progressValue)} %`;

      const resultsString = `Renewed: ${chalk.cyanBright(payload.renewed)}, Skipped: ${chalk.cyanBright(
        payload.skipped,
      )}, Failed: ${chalk.cyanBright(payload.failed)}, Left: ${chalk.cyanBright(payload.left)}`;

      logUpdate(`${resoursesString}\n\n${progressString}\n\n${resultsString}`);

      if (payload.left === 0) {
        clearInterval(interval);
        this.app.shutdown();
      }
    }, 100);
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
    description: 'Specify file path where proxies are stored.',
    defaultValue: './proxies.txt',
  })
  parseProxiesOption(value: string) {
    value = path.resolve(value);

    if (fs.existsSync(value) && !fs.statSync(value).isFile()) throw new Error(`Proxies option must be a file path`);

    return value;
  }

  @Option({
    flags: '-f, --force',
    description: 'Force renew, even if session is valid and not expired.',
  })
  parseForceOption(value: any) {
    return value;
  }
}
