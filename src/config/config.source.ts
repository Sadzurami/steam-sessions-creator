import fs from 'fs';
import path from 'path';

import { AppConfig } from './interfaces/app.config.interface';
import { Config } from './interfaces/config.interface';
import { LoggerConfig } from './interfaces/logger.config.interface';

const env = (<any>process).pkg ? 'production' : 'development';
const cwd = env === 'production' ? path.dirname(process.execPath) : process.cwd();

// note: nestjs/config does not support async config sources
export default (): Config => {
  const packageJson = readPackageJson();

  const app: AppConfig = {
    env,
    cwd,
    name: packageJson.name
      .split('-')
      .map((word: string) => word[0].toUpperCase() + word.slice(1))
      .join('-'),
    version: packageJson.version,
  };

  const logger: LoggerConfig = {
    filePath: path.join(cwd, 'logs', `${new Date().toJSON().replace(/[^\d]/g, '.').slice(0, -1)}.log`),
  };

  const reports = {
    filePath: path.join(cwd, 'reports', `${new Date().toJSON().replace(/[^\d]/g, '.').slice(0, -1)}.txt`),
  };

  return { app, logger, reports };
};

function readPackageJson() {
  const filePath =
    env === 'production' ? path.join(__dirname, '..', '..', 'package.json') : path.join(cwd, 'package.json');

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error('Error reading package.json');
  }
}
