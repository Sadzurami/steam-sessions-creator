import fs from 'fs';
import { Command, CommandRunner, Option } from 'nest-commander';
import path from 'path';

import { AppService } from '../../app.service';
import { ProxiesService } from '../../modules/proxies/proxies.service';
import { ReportsService } from '../../modules/reports/reports.service';
import { SessionsService } from '../../modules/sessions/sessions.service';
import { RenewCommandOptions } from './renew.command.options.interface';
import { RenewService } from './renew.service';
import { RenewUi } from './renew.ui';

@Command({
  name: 'renew',
  description: 'Renew sessions',
  options: {},
})
export class RenewCommand extends CommandRunner {
  constructor(
    private readonly sessions: SessionsService,
    private readonly proxies: ProxiesService,
    private readonly renew: RenewService,
    private readonly reports: ReportsService,
    private readonly ui: RenewUi,
    private readonly app: AppService,
  ) {
    super();
  }

  async run(args: string[], options: RenewCommandOptions) {
    this.ui.start();

    this.sessions.importDirectoryPath = path.resolve(options.sessions);
    await this.sessions.import();

    this.proxies.importFilePath = path.resolve(options.proxies);
    await this.proxies.import();

    this.renew.forceRenewing = options.force;
    await this.renew.run();
    await this.reports.export(this.renew.stats);

    this.ui.stop();
    this.app.close();
  }

  @Option({
    flags: '-s, --sessions <sessions>',
    description: 'specify directory path where sessions are stored',
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
    description: 'specify file path where proxies are stored',
    defaultValue: './proxies.txt',
  })
  parseProxiesOption(value: string) {
    value = path.resolve(value);

    if (fs.existsSync(value) && !fs.statSync(value).isFile()) throw new Error(`Proxies option must be a file path`);

    return value;
  }

  @Option({
    flags: '-f, --force',
    description: 'force renew, even if session is valid and not expired',
  })
  parseForceOption(value: any) {
    return value;
  }
}
