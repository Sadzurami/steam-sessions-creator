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
import { SESSION_EXPIRY_THRESHOLD, SESSION_SCHEMA_VERSION } from './constants';
import { decodeRefreshToken } from './helpers';
import { Account } from './interfaces/account.interface';
import { Secret } from './interfaces/secret.interface';
import { Session } from './interfaces/session.interface';

const queues: PQueue[] = [];

init()
  .then(() => main())
  .then(() => exit({}, app.opts().silentExit !== true))
  .catch((error) => exit({ error }, true));

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
    .option('--silent-exit', 'exit process automatically on finish')
    .option('--concurrency <number>', 'concurrency limit for global operations')
    .parseAsync();

  logger.info(`${appName}`);
  logger.info(`Version: ${appVersion}`);

  setProcessTitle(`${appName} v${appVersion}`);
  closeWithGrace({ delay: false, logger: false }, ({ signal, err: error }) => exit({ signal, error }, !signal));
}

async function main() {
  const logger = new Logger('main');
  logger.info('-'.repeat(40));

  const proxies = await readProxies();
  logger.info(`Proxies: ${proxies.length}`);

  const secrets = await readSecrets().then((values) => new Map(values.map((v) => [v.username.toLowerCase(), v])));
  logger.info(`Secrets: ${secrets.size}`);

  const accounts = await readAccounts().then((values) => new Map(values.map((v) => [v.username.toLowerCase(), v])));
  logger.info(`Accounts: ${accounts.size}`);

  const sessions = await readSessions().then((values) => new Map(values.map((v) => [v.Username.toLowerCase(), v])));
  logger.info(`Sessions: ${sessions.size}`);

  const concurrency = ~~app.opts().concurrency || proxies.length || 1;
  logger.info(`Concurrency: ${concurrency}`);

  let skippedAccounts: number = 0;
  for (const [hashname] of accounts.entries()) {
    if (app.opts().skipCreate === true) {
      accounts.delete(hashname);
      skippedAccounts++;
      continue;
    }

    if (sessions.has(hashname) && app.opts().forceCreate !== true) {
      accounts.delete(hashname);
      skippedAccounts++;
      continue;
    }
  }

  let skippedSessions: number = 0;
  for (const [hashname, session] of sessions.entries()) {
    if (app.opts().skipUpdate === true) {
      sessions.delete(hashname);
      skippedSessions++;
      continue;
    }

    const sessionExpiryTime = Math.min(
      session.WebRefreshToken ? decodeRefreshToken(session.WebRefreshToken).exp * 1000 : Date.now(),
      session.MobileRefreshToken ? decodeRefreshToken(session.MobileRefreshToken).exp * 1000 : Date.now(),
      session.DesktopRefreshToken ? decodeRefreshToken(session.DesktopRefreshToken).exp * 1000 : Date.now(),
    );

    const sessionExpired = sessionExpiryTime - Date.now() < SESSION_EXPIRY_THRESHOLD;

    if (!sessionExpired && app.opts().forceUpdate !== true) {
      sessions.delete(hashname);
      skippedSessions++;
      continue;
    }
  }

  logger.info('-'.repeat(40));
  logger.info(`Skip accounts: ${skippedAccounts}`);
  logger.info(`Skip sessions: ${skippedSessions}`);

  const statistics = { created: 0, updated: 0, errored: 0, left: accounts.size + sessions.size };
  if (statistics.left === 0) return;

  logger.info('-'.repeat(40));
  logger.info('Starting tasks');
  logger.info('-'.repeat(40));

  // prettier-ignore
  const getNextProxy = ((i = 0) => () => proxies[i++ % proxies.length])();

  const queue = new PQueue({ concurrency, interval: 1, intervalCap: 1 });
  queues.push(queue);

  for (const [hashname, account] of accounts.entries()) {
    const session: Partial<Session> = {
      Username: account.username,
      Password: account.password,
      SteamId: undefined,
      SharedSecret: account.sharedSecret || secrets.get(hashname)?.sharedSecret || null,
      IdentitySecret: account.identitySecret || secrets.get(hashname)?.identitySecret || null,
      WebRefreshToken: undefined,
      MobileRefreshToken: undefined,
      DesktopRefreshToken: undefined,
      Proxy: null,
      SchemaVersion: SESSION_SCHEMA_VERSION,
    };

    queue.add(async () => {
      try {
        const proxy = getNextProxy();
        const bot = new Bot({ name: account.username, account }, proxy);

        session.WebRefreshToken = await bot.createRefreshToken({ platform: 'web' });

        await delay(30 * 1000);
        session.MobileRefreshToken = await bot.createRefreshToken({ platform: 'mobile' });

        await delay(30 * 1000);
        session.DesktopRefreshToken = await bot.createRefreshToken({ platform: 'desktop' });

        session.Proxy = proxy && app.opts().preserveProxy === true ? proxy : null;
        session.SteamId = bot.steamid;

        await saveSession(session as Session);

        logger.info(`${account.username} | created | left ${--statistics.left}`);
        statistics.created++;
      } catch (error) {
        logger.warn(`${account.username} | ${error.message.toLowerCase()} | left ${--statistics.left}`);
        statistics.errored++;
      } finally {
        if (statistics.left > 0 && queue.size > 0) await delay(30 * 1000);
      }
    });
  }

  for (const [hashname, session] of sessions.entries()) {
    session.SharedSecret = session.SharedSecret || secrets.get(hashname)?.sharedSecret || null;
    session.IdentitySecret = session.IdentitySecret || secrets.get(hashname)?.identitySecret || null;

    const account: Account = {
      username: session.Username,
      password: session.Password,
      sharedSecret: session.SharedSecret,
      identitySecret: session.IdentitySecret,
    };

    queue.add(async () => {
      try {
        const proxy = session.Proxy || getNextProxy();
        const bot = new Bot({ name: account.username, account }, proxy);

        session.WebRefreshToken = await bot.createRefreshToken({ platform: 'web' });

        await delay(30 * 1000);
        session.MobileRefreshToken = await bot.createRefreshToken({ platform: 'mobile' });

        await delay(30 * 1000);
        session.DesktopRefreshToken = await bot.createRefreshToken({ platform: 'desktop' });

        session.Proxy = proxy && app.opts().preserveProxy === true ? proxy : null;
        session.SteamId = bot.steamid;
        session.SchemaVersion = SESSION_SCHEMA_VERSION;

        await saveSession(session as Session);

        logger.info(`${account.username} | updated | left ${--statistics.left}`);
        statistics.updated++;
      } catch (error) {
        logger.warn(`${account.username} | ${error.message.toLowerCase()} | left ${--statistics.left}`);
        statistics.errored++;
      } finally {
        if (statistics.left > 0 && queue.size > 0) await delay(30 * 1000);
      }
    });
  }

  await queue.onIdle();

  logger.info('-'.repeat(40));
  logger.info('All tasks completed');
  logger.info('-'.repeat(40));

  logger.info(`Sessions created: ${statistics.created}`);
  logger.info(`Sessions updated: ${statistics.updated}`);
  logger.info(`Errors: ${statistics.errored}`);
}

async function exit(options: { signal?: string; error?: Error } = {}, awaitKeyAction = false) {
  const logger = new Logger('exit');

  queues.forEach((queue) => queue.pause());
  queues.forEach((queue) => queue.clear());
  await Promise.all(queues.map((queue) => queue.onIdle()));

  await new Promise((resolve) => process.nextTick(resolve));
  logger.info('-'.repeat(40));

  if (options.error) logger.warn(`Error: ${options.error.message}`);

  if (options.signal) logger.info(`Shutdown signal: ${options.signal}`);

  if (awaitKeyAction) {
    logger.info('Press any key to exit');
    process.stdin.setRawMode(true).resume();

    await new Promise((resolve) => process.stdin.once('data', resolve));
    process.stdin.setRawMode(false).resume();
  }

  process.exit(options.error ? 1 : 0);
}

async function readSessions(): Promise<Session[]> {
  const directory = path.resolve(app.opts().sessions);
  await fs.ensureDir(directory);

  let paths = await fs.readdir(directory).catch(() => [] as string[]);
  if (paths.length === 0) return [];

  paths = paths.filter((file) => file.endsWith('.steamsession')).map((file) => path.join(directory, file));
  if (paths.length === 0) return [];

  const sessions = new Map<string, Session>();
  const queue = new PQueue({ concurrency: 512 });

  paths.forEach((file) => {
    queue.add(async () => {
      let session: Session;

      try {
        const content = await fs.readFile(file, 'utf8').catch(() => '');
        session = JSON.parse(content) as Session;
      } catch (error) {
        return;
      }

      if (typeof session !== 'object') return;
      if (typeof session.SchemaVersion !== 'number' || session.SchemaVersion < 2) return;

      sessions.set(session.Username.toLowerCase(), session);
    });
  });

  await queue.onIdle();
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

  paths = paths.filter((file) => file.toLowerCase().endsWith('.mafile')).map((file) => path.join(directory, file));
  if (paths.length === 0) return [];

  const secrets = new Map<string, Secret>();
  const queue = new PQueue({ concurrency: 512 });

  paths.forEach((file) => {
    queue.add(async () => {
      let mafile: Record<string, any>;

      try {
        let content = await fs.readFile(file, 'utf8').catch(() => '');
        content = content.replace(/},\s*}/g, '}}').replace(/'/g, '"');

        mafile = JSON.parse(content);
      } catch (error) {
        return;
      }

      if (typeof mafile !== 'object') return;
      if (!mafile.shared_secret || !mafile.identity_secret) return;

      const secret: Secret = {
        username: mafile.account_name || path.basename(file).replace(/\.mafile$/i, ''),
        sharedSecret: mafile.shared_secret,
        identitySecret: mafile.identity_secret,
      };

      secrets.set(secret.username.toLowerCase(), secret);
    });
  });

  await queue.onIdle();
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
