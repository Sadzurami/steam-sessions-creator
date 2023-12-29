import fs from 'fs';
import { Command, CommandRunner, Option } from 'nest-commander';
import path from 'path';

import { AppService } from '../../app.service';
import { AccountsService } from '../../modules/accounts/accounts.service';
import { ProxiesService } from '../../modules/proxies/proxies.service';
import { ReportsService } from '../../modules/reports/reports.service';
import { SecretsService } from '../../modules/secrets/secrets.service';
import { SessionsService } from '../../modules/sessions/sessions.service';
import { CreateCommandOptions } from './create.command.options.interface';
import { CreateService } from './create.service';
import { CreateUi } from './create.ui';

@Command({
  name: 'create',
  description: 'Create new sessions',
  options: { isDefault: true },
})
export class CreateCommand extends CommandRunner {
  constructor(
    private readonly sessions: SessionsService,
    private readonly accounts: AccountsService,
    private readonly secrets: SecretsService,
    private readonly proxies: ProxiesService,
    private readonly reports: ReportsService,
    private readonly create: CreateService,
    private readonly ui: CreateUi,
    private readonly app: AppService,
  ) {
    super();
  }

  async run(args: string[], options: CreateCommandOptions) {
    this.ui.start();

    this.sessions.importDirectoryPath = this.sessions.exportDirectoryPath = path.resolve(options.output);
    await this.sessions.import();

    this.accounts.importFilePath = path.resolve(options.accounts);
    await this.accounts.import();

    this.secrets.importDirectoryPath = path.resolve(options.secrets);
    await this.secrets.import();

    this.proxies.importFilePath = path.resolve(options.proxies);
    await this.proxies.import();

    this.create.forceCreation = options.force;
    await this.create.run();
    await this.reports.export(this.create.stats);

    this.ui.stop();
    this.app.close();
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
