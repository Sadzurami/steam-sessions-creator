import chalk from 'chalk';
import cliui from 'cliui';
import logUpdate from 'log-update';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../../config/interfaces/app.config.interface';
import { Config } from '../../config/interfaces/config.interface';
import { ProxiesService } from '../../modules/proxies/proxies.service';
import { SessionsService } from '../../modules/sessions/sessions.service';
import { RenewService } from './renew.service';

@Injectable()
export class RenewUi {
  private readonly width = process.stdout.columns;

  private frameIndex = 0;

  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly sessions: SessionsService,
    private readonly proxies: ProxiesService,
    private readonly config: ConfigService<Config>,
    private readonly renew: RenewService,
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
    this.frameIndex++;
    if (this.frameIndex >= 1000) this.frameIndex = 0;

    const delimiter = '\n' + chalk.bold('-'.repeat(this.width)) + '\n';
    const ui = [this.createHeaderUi(), this.createResourcesUi(), this.createStatisticsUi()].join(delimiter);

    logUpdate(ui);
  }

  private createHeaderUi() {
    const ui = cliui({ width: this.width });

    const { name: appName, version: appVersion } = this.config.get<AppConfig>('app');

    ui.div({ text: `${chalk.bold(appName)} ${appVersion}`, padding: [2, 0, 2, 2] });
    ui.div({
      text: `renewing sessions ${this.renew.progress === 100 ? '- completed' : '.'.repeat(this.frameIndex % 4)}`,
      width: 30,
      padding: [0, 0, 1, 2],
    });

    return ui.toString();
  }

  private createResourcesUi() {
    const ui = cliui({ width: this.width });

    ui.div({ text: chalk.bold('Resources'), padding: [2, 0, 2, 2] });
    ui.div(
      { text: `sessions: ${chalk.cyanBright(this.sessions.getCount())}`, width: 30, padding: [0, 0, 1, 2] },
      { text: `proxies: ${chalk.cyanBright(this.proxies.getCount())}`, width: 30, padding: [0, 0, 1, 2] },
    );

    return ui.toString();
  }

  private createStatisticsUi() {
    const ui = cliui({ width: this.width });
    const { success, fail, skip } = this.renew.stats;

    ui.div({ text: chalk.bold('Statistics'), padding: [2, 0, 2, 2] });
    ui.div(
      { text: `success: ${chalk.cyanBright(success.length)}`, width: 30, padding: [0, 0, 1, 2] },
      { text: `fail: ${chalk.cyanBright(fail.length)}`, width: 30, padding: [0, 0, 1, 2] },
      { text: `skip: ${chalk.cyanBright(skip.length)}`, width: 30, padding: [0, 0, 1, 2] },
    );

    return ui.toString();
  }
}
