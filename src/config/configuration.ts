import fs from 'fs';
import path from 'path';

export interface Config {
  app: {
    name: string;
    version: string;
    title: string;
    directory: string;
    environment: 'development' | 'production';
  };
}

const getPackageJson = (): any => {
  try {
    let filePath = path.resolve(__dirname, '../package.json');
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));

    filePath = path.resolve(__dirname, '../../package.json');
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error('Failed to read package.json');
  }
};

export default (): Config => {
  const packageJson = getPackageJson();

  const appName = packageJson.name;
  const appVersion = packageJson.version;

  const env = process.env.NODE_ENV || (<any>process).pkg ? 'production' : 'development';
  const appDirectory = env === 'production' && (<any>process).pkg ? path.dirname(process.execPath) : process.cwd();

  return {
    app: {
      name: appName,
      title: appName,
      version: appVersion,
      directory: appDirectory,
      environment: env,
    },
  };
};
