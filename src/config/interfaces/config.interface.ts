import { AppConfig } from './app.config.interface';
import { LoggerConfig } from './logger.config.interface';
import { ReportsConfig } from './reports.config.interface';

export interface Config {
  app: AppConfig;
  logger: LoggerConfig;
  reports: ReportsConfig;
}
