import fs from 'fs';
import path from 'path';

export interface Config {
  app: AppConfig;
  sessions: SessionsConfig;
}

export interface AppConfig {
  env: 'development' | 'production';
  cwd: string;
  name: string;
  version: string;
}

export interface SessionsConfig {
  schemaVersion: number;
}

const env = (<any>process).pkg ? 'production' : 'development';
const cwd = env === 'production' ? path.dirname(process.execPath) : process.cwd();

// note: nestjs/config does not support async config sources
export default (): Config => {
  const packageJson = readPackageJson();

  const appConfig: AppConfig = {
    env,
    cwd,
    name: packageJson.name
      .split('-')
      .map((word: string) => word[0].toUpperCase() + word.slice(1))
      .join('-'),
    version: packageJson.version,
  };

  const sessionsConfig: SessionsConfig = {
    schemaVersion: 2,
  };

  return {
    app: appConfig,
    sessions: sessionsConfig,
  };
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
