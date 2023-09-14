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
  description: 'Create new sessions.',
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

    const createUi = () => {
      const header = `Accounts: ${chalk.cyanBright(payload.accounts)}, Secrets: ${chalk.cyanBright(
        payload.secrets,
      )}, Proxies: ${chalk.cyanBright(payload.proxies)}`;

      const progress = Math.round(((payload.total - payload.left) / payload.total) * 100) || 0;

      const progressBarSize = 30;
      const progressBar = `${'█'.repeat(Math.round((progress / 100) * progressBarSize))}`;
      const progressBarEmpty = `${'░'.repeat(progressBarSize - Math.round((progress / 100) * progressBarSize))}`;

      const body = `${chalk.greenBright(progressBar + progressBarEmpty)} ${chalk.cyanBright(progress)} %`;

      const footer = `Created: ${chalk.cyanBright(payload.created)}, Failed: ${chalk.cyanBright(
        payload.failed,
      )}, Left: ${chalk.cyanBright(payload.left)}`;

      return `${header}\n\n${body}\n\n${footer}`;
    };

    setInterval(() => {
      logUpdate(createUi());
      if (payload.left === 0) this.app.shutdown();
    }, 1000);
  }

  @Option({
    flags: '-a, --accounts <accounts>',
    description: `Specify file path where accounts are stored.
Supported formats:
- username:password
- username:password:sharedSecret`,
    defaultValue: './accounts.txt',
  })
  parseAccountsOption(value: string) {
    value = path.resolve(value);

    if (fs.existsSync(value) && !fs.statSync(value).isFile()) throw new Error(`Accounts option must be a file path`);

    return value;
  }

  @Option({
    flags: '-s, --secrets <secrets>',
    description: `Specify file path where secrets are stored.
Supported formats:
- maFile`,
    defaultValue: './secrets',
  })
  parseSecretsOption(value: string) {
    value = path.resolve(value);

    if (fs.existsSync(value) && !fs.statSync(value).isFile()) throw new Error(`Secrets option must be a file path`);

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
    flags: '-o, --output <output>',
    description: 'Specify directory path where sessions will be stored.',
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
    description: 'Force creation even if session already exists in output directory.',
  })
  parseForceOption(value: boolean) {
    return value;
  }
}
