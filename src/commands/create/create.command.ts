import chalk from 'chalk';
import fs from 'fs';
import logUpdate from 'log-update';
import { Command, CommandRunner, Option } from 'nest-commander';
import path from 'path';

import { AppService } from '../../app.service';
import { CreateOptions } from './create.options.interface';
import { CreateService } from './create.service';

@Command({
  name: 'create',
  description: 'Create new sessions',
  options: { isDefault: true },
})
export class CreateCommand extends CommandRunner {
  constructor(
    private readonly app: AppService,
    private readonly createService: CreateService,
  ) {
    super();
  }

  async run(args: string[], options: CreateOptions) {
    const payload = await this.createService.run(options);

    let frameIndex = 0;
    const spinnerFrames = ['-', '\\', '|', '/'];

    const interval = setInterval(() => {
      // use spinner to indicate that app is still running
      const spinner = spinnerFrames[(frameIndex = ++frameIndex % spinnerFrames.length)];

      const resoursesString = `Accounts: ${chalk.cyanBright(payload.accounts)}, Secrets: ${chalk.cyanBright(
        payload.secrets,
      )}, Proxies: ${chalk.cyanBright(payload.proxies)} ${spinner}`;

      const progressValue = payload.left > 0 ? Math.floor(((payload.total - payload.left) / payload.total) * 100) : 100;
      const barSize = 30;
      const barFill = `${'█'.repeat(Math.round((progressValue / 100) * barSize))}`;
      const barEmpty = `${'░'.repeat(barSize - Math.round((progressValue / 100) * barSize))}`;
      const progressString = `${chalk.greenBright(barFill + barEmpty)} ${chalk.cyanBright(progressValue)} %`;

      const resultsString = `Created: ${chalk.cyanBright(payload.created)}, Failed: ${chalk.cyanBright(
        payload.failed,
      )}, Left: ${chalk.cyanBright(payload.left)}`;

      logUpdate(`${resoursesString}\n\n${progressString}\n\n${resultsString}`);

      if (payload.left === 0) {
        clearInterval(interval);
        this.app.shutdown();
      }
    }, 100);
  }

  @Option({
    flags: '-a, --accounts <accounts>',
    description: 'specify file path where accounts are stored',
    defaultValue: './accounts.txt',
  })
  parseAccountsOption(value: string) {
    value = path.resolve(value);

    if (fs.existsSync(value) && !fs.statSync(value).isFile()) throw new Error(`Accounts option must be a file path`);

    return value;
  }

  @Option({
    flags: '-s, --secrets <secrets>',
    description: 'specify directory path where secrets are stored',
    defaultValue: './secrets',
  })
  parseSecretsOption(value: string) {
    value = path.resolve(value);

    if (fs.existsSync(value) && !fs.statSync(value).isDirectory()) {
      throw new Error(`Secrets option must be a directory path`);
    }

    return value;
  }

  @Option({
    flags: '-p, --proxies <proxies>',
    description: 'specify file path where proxies are stored',
    defaultValue: './proxies.txt',
  })
  parseProxiesOption(value: string) {
    value = path.resolve(value);

    if (fs.existsSync(value) && !fs.statSync(value).isFile()) throw new Error(`Proxies option must be a file path`);

    return value;
  }

  @Option({
    flags: '-o, --output <output>',
    description: 'specify directory path where sessions will be stored',
    defaultValue: './sessions',
  })
  parseOutputOption(value: string) {
    value = path.resolve(value);

    if (fs.existsSync(value) && !fs.statSync(value).isDirectory()) {
      throw new Error(`Output option must be a directory path`);
    }

    return value;
  }

  @Option({
    flags: '-f, --force',
    description: 'force creation, even if session already exists',
  })
  parseForceOption(value: boolean) {
    return value;
  }
}
