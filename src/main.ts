import closeWithGrace from 'close-with-grace';
import { program as app } from 'commander';
import setProcessTitle from 'console-title';
import fs from 'fs-extra';
import PQueue from 'p-queue';
import path from 'path';
import readPackageJson from 'read-pkg-up';
import { setTimeout as delay } from 'timers/promises';

import { Logger } from '@sadzurami/logger';

import { Bot } from './bot';
import { decodeRefreshToken } from './helpers';
import { Account } from './interfaces/account.interface';
import { Secret } from './interfaces/secret.interface';
import { Session } from './interfaces/session.interface';

const sessionSchemaVersion = 3;
const sessionExpiryThreshold = 60 * 60 * 24 * 30 * 1000;

const tasksQueue = new PQueue({ concurrency: 1, interval: 1, intervalCap: 1 });

init()
  .then(() => main())
  .then(() => exit())
  .catch((error) => exit(error));

async function init() {
  const logger = new Logger('init');
  const { packageJson } = await readPackageJson({ cwd: __dirname });

  const appName = packageJson.name
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('-');
  const appVersion = packageJson.version;
  const appDescription = packageJson.description;

  await app
    .name(appName)
    .version(appVersion)
    .description(appDescription)
    .option('--sessions <path>', 'path to sessions directory', './sessions')
    .option('--accounts <path>', 'path to accounts file', './accounts.txt')
    .option('--secrets <path>', 'path to secrets directory', './secrets')
    .option('--proxies <path>', 'path to proxies file', './proxies.txt')
    .option('--preserve-proxy', 'save or use existing proxy from session')
    .option('--force-create', 'create session even if it already exists')
    .option('--force-update', 'update session even if not required')
    .option('--skip-create', 'skip sessions creation')
    .option('--skip-update', 'skip sessions update')
    .option('--concurrency <number>', 'concurrency limit for global operations')
    .parseAsync();

  logger.info(`${appName}`);
  logger.info(`Version: ${appVersion}`);

  setProcessTitle(`${appName} v${appVersion}`);
  closeWithGrace({ delay: false, logger: false }, ({ err }) => exit(err));
}

async function main() {
  const logger = new Logger('main');
  logger.info('-');

  const proxies = await readProxies();
  logger.info(`Proxies: ${proxies.length}`);

  const secrets = await readSecrets();
  logger.info(`Secrets: ${secrets.length}`);

  const accounts = await readAccounts();
  logger.info(`Accounts: ${accounts.length}`);

  const sessions = await readSessions();
  logger.info(`Sessions: ${sessions.length}`);

  const concurrency = ~~app.opts().concurrency || proxies.length || 1;
  logger.info(`Concurrency: ${concurrency}`);

  if (app.opts().skipCreate == true) accounts.splice(0, accounts.length);
  if (app.opts().skipUpdate == true) sessions.splice(0, sessions.length);

  if (accounts.length === 0 && sessions.length === 0) return;

  logger.info('-');
  logger.info('Starting tasks');

  tasksQueue.concurrency = concurrency;

  const mappedAccounts = new Map(accounts.map((account) => [account.username.toLowerCase(), account]));
  const mappedSessions = new Map(sessions.map((session) => [session.Username.toLowerCase(), session]));

  let tasksLeft = accounts.length + sessions.length;
  let proxyIndex = 0;

  for (let index = 0; index < secrets.length; index++) {
    const secret = secrets[index];
    const accountName = secret.username.toLowerCase();

    if (mappedAccounts.has(accountName)) {
      const account = mappedAccounts.get(accountName);
      account.sharedSecret ||= secret.sharedSecret || null;
      account.identitySecret ||= secret.identitySecret || null;
    }

    if (mappedSessions.has(accountName)) {
      const session = mappedSessions.get(accountName);
      session.SharedSecret ||= secret.sharedSecret || null;
      session.IdentitySecret ||= secret.identitySecret || null;
    }
  }

  for (let index = 0; index < accounts.length; index++) {
    const account = accounts[index];
    const accountName = account.username.toLowerCase();

    if (mappedSessions.has(accountName) && app.opts().forceCreate !== true) {
      logger.info(`${account.username} | create | skip | left ${--tasksLeft}`);
      continue;
    }

    const session: Partial<Session> = {
      Username: account.username,
      Password: account.password,
      SteamId: undefined,
      SharedSecret: account.sharedSecret,
      IdentitySecret: account.identitySecret,
      WebRefreshToken: undefined,
      MobileRefreshToken: undefined,
      DesktopRefreshToken: undefined,
      Proxy: null,
      SchemaVersion: sessionSchemaVersion,
    };

    tasksQueue.add(async () => {
      try {
        const proxy = proxies[proxyIndex++ % proxies.length];
        const bot = new Bot({ name: account.username, account }, proxy);

        await bot.start({ platform: 'web' }).finally(() => bot.stop());
        session.WebRefreshToken = bot.refreshToken;

        await delay(30 * 1000);
        await bot.start({ platform: 'mobile' }).finally(() => bot.stop());
        session.MobileRefreshToken = bot.refreshToken;

        await delay(30 * 1000);
        await bot.start({ platform: 'desktop' }).finally(() => bot.stop());
        session.DesktopRefreshToken = bot.refreshToken;

        session.Proxy = app.opts().preserveProxy === true ? proxy : null;
        session.SteamId = bot.steamid;

        await saveSession(session as Session);
        logger.info(`${account.username} | create | success | left ${--tasksLeft}`);
      } catch (error) {
        logger.warn(`${account.username} | create | fail: ${error.message} | left ${--tasksLeft}`);
      } finally {
        await delay(30 * 1000);
      }
    });
  }

  for (let index = 0; index < sessions.length; index++) {
    const session = sessions[index] as Partial<Session>;

    const sessionExpiryTime = Math.min(
      session.WebRefreshToken ? decodeRefreshToken(session.WebRefreshToken).exp * 1000 : Date.now(),
      session.MobileRefreshToken ? decodeRefreshToken(session.MobileRefreshToken).exp * 1000 : Date.now(),
      session.DesktopRefreshToken ? decodeRefreshToken(session.DesktopRefreshToken).exp * 1000 : Date.now(),
    );

    if (sessionExpiryTime - Date.now() > sessionExpiryThreshold && app.opts().forceUpdate !== true) {
      logger.info(`${session.Username} | update | skip | left ${--tasksLeft}`);
      continue;
    }

    const account: Account = {
      username: session.Username,
      password: session.Password,
      sharedSecret: session.SharedSecret,
      identitySecret: session.IdentitySecret,
    };

    tasksQueue.add(async () => {
      try {
        const proxy = session.Proxy || proxies[proxyIndex++ % proxies.length];
        const bot = new Bot({ name: account.username, account }, proxy);

        await bot.start({ platform: 'web' }).finally(() => bot.stop());
        session.WebRefreshToken = bot.refreshToken;

        await delay(30 * 1000);
        await bot.start({ platform: 'mobile' }).finally(() => bot.stop());
        session.MobileRefreshToken = bot.refreshToken;

        await delay(30 * 1000);
        await bot.start({ platform: 'desktop' }).finally(() => bot.stop());
        session.DesktopRefreshToken = bot.refreshToken;

        session.Proxy = app.opts().preserveProxy === true ? proxy : null;
        session.SteamId = bot.steamid;
        session.SchemaVersion = sessionSchemaVersion;

        await saveSession(session as Session);
        logger.info(`${account.username} | update | success | left ${--tasksLeft}`);
      } catch (error) {
        logger.warn(`${account.username} | update | fail: ${error.message} | left ${--tasksLeft}`);
      } finally {
        await delay(30 * 1000);
      }
    });
  }

  await tasksQueue.onIdle();
}

async function exit(error?: Error) {
  const logger = new Logger('exit');
  tasksQueue.pause();

  tasksQueue.clear();
  await tasksQueue.onIdle();

  await new Promise((resolve) => process.nextTick(resolve));
  logger.info('-');

  if (error) logger.warn(error.message);
  else logger.info('All tasks completed');

  logger.info('Press any key to exit');
  process.stdin.setRawMode(true).resume();

  await new Promise((resolve) => process.stdin.once('data', resolve));
  process.exit(error ? 1 : 0);
}

async function readSessions(): Promise<Session[]> {
  const directory = path.resolve(app.opts().sessions);
  await fs.ensureDir(directory);

  let paths = await fs.readdir(directory).catch(() => [] as string[]);
  if (paths.length === 0) return [];

  paths = paths.filter((p) => p.endsWith('.steamsession')).map((p) => path.join(directory, p));
  if (paths.length === 0) return [];

  const promises = paths.map((path) => fs.readFile(path, 'utf8').catch(() => ''));
  const sessions = new Map<string, Session>();

  for await (const content of promises) {
    let session: Session;

    try {
      session = JSON.parse(content) as Session;
    } catch (error) {
      continue;
    }

    if (typeof session !== 'object') continue;
    if (typeof session.SchemaVersion !== 'number' || session.SchemaVersion < 2) continue;

    sessions.set(session.Username.toLowerCase(), session);
  }

  return [...sessions.values()];
}

async function readAccounts(): Promise<Account[]> {
  const file = path.resolve(app.opts().accounts);
  await fs.ensureFile(file);

  const content = await fs.readFile(file, 'utf-8').catch(() => '');
  const accounts = new Map<string, Account>();

  for (const line of content.split(/\r?\n/)) {
    const parts = line.split(':');

    if (!parts[0] || !parts[1]) continue;
    const account: Account = { username: parts[0], password: parts[1], sharedSecret: null, identitySecret: null };

    if (parts[2] && Buffer.from(parts[2], 'base64').toString('base64') === parts[2]) account.sharedSecret = parts[2];
    if (parts[3] && Buffer.from(parts[3], 'base64').toString('base64') === parts[3]) account.identitySecret = parts[3];

    accounts.set(account.username.toLowerCase(), account);
  }

  return [...accounts.values()];
}

async function readSecrets(): Promise<Secret[]> {
  const directory = path.resolve(app.opts().secrets);
  await fs.ensureDir(directory);

  let paths = await fs.readdir(directory).catch(() => [] as string[]);
  if (paths.length === 0) return [];

  paths = paths.filter((p) => /\.mafile$/i.test(p)).map((p) => path.join(directory, p));
  if (paths.length === 0) return [];

  const promises = paths.map(async (path) => ({ content: await fs.readFile(path, 'utf8').catch(() => ''), path }));
  const secrets = new Map<string, Secret>();

  for await (const file of promises) {
    if (!file.content) continue;
    file.content = file.content.replace(/},\s*}/g, '}}').replace(/'/g, '"');

    let json: Record<string, any>;
    try {
      json = JSON.parse(file.content);
    } catch (error) {
      continue;
    }

    if (typeof json !== 'object') continue;
    if (!json.shared_secret || !json.identity_secret) continue;

    const secret: Secret = {
      username: json.account_name || path.basename(file.path).replace(/\.mafile$/i, ''),
      sharedSecret: json.shared_secret,
      identitySecret: json.identity_secret,
    };

    secrets.set(secret.username.toLowerCase(), secret);
  }

  return [...secrets.values()];
}

async function readProxies(): Promise<string[]> {
  const file = path.resolve(app.opts().proxies);
  await fs.ensureFile(file);

  const content = await fs.readFile(file, 'utf-8').catch(() => '');
  const proxies = new Set<string>();

  for (const line of content.split(/\r?\n/)) {
    let proxy: string;

    try {
      proxy = new URL(line.trim()).toString().slice(0, -1);
    } catch (error) {
      continue;
    }

    proxies.add(proxy);
  }

  return [...proxies];
}

async function saveSession(session: Session) {
  const directory = path.resolve(app.opts().sessions);
  const file = path.resolve(directory, `${session.Username}.steamsession`);

  const content = JSON.stringify(session, null, 2);
  await fs.writeFile(file, content);
}
