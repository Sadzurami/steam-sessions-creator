import chalk from 'chalk';
import cliui from 'cliui';
import logUpdate from 'log-update';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../../config/interfaces/app.config.interface';
import { Config } from '../../config/interfaces/config.interface';
import { AccountsService } from '../../modules/accounts/accounts.service';
import { ProxiesService } from '../../modules/proxies/proxies.service';
import { SecretsService } from '../../modules/secrets/secrets.service';
import { CreateService } from './create.service';

@Injectable()
export class CreateUi {
  private readonly width = process.stdout.columns;

  private frameIndex = 0;

  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly accounts: AccountsService,
    private readonly proxies: ProxiesService,
    private readonly secrets: SecretsService,
    private readonly config: ConfigService<Config>,
    private readonly create: CreateService,
  ) {}

  public start() {
    if (this.interval) return;
    this.interval = setInterval(() => this.showUi(), 1000);
  }

  public stop() {
    this.showUi(); // show final ui

    clearInterval(this.interval);
    this.interval = null;
  }

  private showUi() {
    if (this.frameIndex >= 1000) this.frameIndex = 0;
    this.frameIndex++;

    const delimiter = '\n' + chalk.bold('-'.repeat(this.width)) + '\n';
    const ui = [this.createHeaderUi(), this.createResourcesUi(), this.createStatisticsUi()].join(delimiter);

    logUpdate(ui);
  }

  private createHeaderUi() {
    const ui = cliui({ width: this.width });

    const { name: appName, version: appVersion } = this.config.get<AppConfig>('app');

    ui.div({ text: `${chalk.bold(appName)} ${appVersion}`, padding: [2, 0, 2, 2] });
    ui.div({
      text: `creating sessions ${this.create.progress === 100 ? '- completed' : '.'.repeat(this.frameIndex % 4)}`,
      width: 30,
      padding: [0, 0, 1, 2],
    });

    return ui.toString();
  }

  private createResourcesUi() {
    const ui = cliui({ width: this.width });

    ui.div({ text: chalk.bold('Resources'), padding: [2, 0, 2, 2] });
    ui.div(
      { text: `accounts: ${chalk.cyanBright(this.accounts.getCount())}`, width: 30, padding: [0, 0, 1, 2] },
      { text: `secrets: ${chalk.cyanBright(this.secrets.getCount())}`, width: 30, padding: [0, 0, 1, 2] },
      { text: `proxies: ${chalk.cyanBright(this.proxies.getCount())}`, width: 30, padding: [0, 0, 1, 2] },
    );

    return ui.toString();
  }

  private createStatisticsUi() {
    const ui = cliui({ width: this.width });
    const { success, fail, skip } = this.create.stats;

    ui.div({ text: chalk.bold('Statistics'), padding: [2, 0, 2, 2] });
    ui.div(
      { text: `success: ${chalk.cyanBright(success.length)}`, width: 30, padding: [0, 0, 1, 2] },
      { text: `fail: ${chalk.cyanBright(fail.length)}`, width: 30, padding: [0, 0, 1, 2] },
      { text: `skip: ${chalk.cyanBright(skip.length)}`, width: 30, padding: [0, 0, 1, 2] },
    );

    return ui.toString();
  }
}
