import closeWithGrace from 'close-with-grace';
import { program as app } from 'commander';
import setProcessTitle from 'console-title';
import PQueue from 'p-queue';
import path from 'path';
import readPackageJson from 'read-pkg-up';
import { setTimeout as delay } from 'timers/promises';

import { Logger } from '@sadzurami/logger';

import { Bot } from './bot';
import { SESSION_EXPIRY_THRESHOLD, SESSION_SCHEMA_VERSION } from './constants';
import { getSessionExpiryDate, readAccounts, readProxies, readSecrets, readSessions, saveSession } from './helpers';
import { Account } from './interfaces/account.interface';
import { Session } from './interfaces/session.interface';

const queues: PQueue[] = [];

init()
  .then(() => main())
  .then(() => exit({}, true))
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

  const proxiesFile = path.resolve(app.opts().proxies);
  const proxies = await readProxies(proxiesFile);
  logger.info(`Proxies: ${proxies.length}`);

  const secretsDir = path.resolve(app.opts().secrets);
  const secrets = await readSecrets(secretsDir).then((vv) => new Map(vv.map((v) => [v.username.toLowerCase(), v])));
  logger.info(`Secrets: ${secrets.size}`);

  const accountsFile = path.resolve(app.opts().accounts);
  const accounts = await readAccounts(accountsFile).then((vv) => new Map(vv.map((v) => [v.username.toLowerCase(), v])));
  logger.info(`Accounts: ${accounts.size}`);

  const sessionsDir = path.resolve(app.opts().sessions);
  const sessions = await readSessions(sessionsDir).then((vv) => new Map(vv.map((v) => [v.Username.toLowerCase(), v])));
  logger.info(`Sessions: ${sessions.size}`);

  const concurrency = ~~app.opts().concurrency || proxies.length || 1;
  logger.info(`Concurrency: ${concurrency}`);

  let skippedAccounts: number = 0;
  for (const [hashname] of accounts.entries()) {
    if (app.opts().skipCreate) {
      accounts.delete(hashname);
      skippedAccounts++;
      continue;
    }

    if (sessions.has(hashname) && !app.opts().forceCreate) {
      accounts.delete(hashname);
      skippedAccounts++;
      continue;
    }
  }

  let skippedSessions: number = 0;
  for (const [hashname, session] of sessions.entries()) {
    if (app.opts().skipUpdate) {
      sessions.delete(hashname);
      skippedSessions++;
      continue;
    }

    let expiryDate: Date = new Date();
    try {
      expiryDate = new Date(session.ExpiryDate || getSessionExpiryDate(session));
    } catch (error) {}

    if (expiryDate.getTime() - Date.now() > SESSION_EXPIRY_THRESHOLD && !app.opts().forceUpdate) {
      sessions.delete(hashname);
      skippedSessions++;
      continue;
    }
  }

  logger.info('-'.repeat(40));
  logger.info(`Skip accounts: ${skippedAccounts}`);
  logger.info(`Skip sessions: ${skippedSessions}`);

  if (accounts.size === 0 && sessions.size === 0) return;
  const statistics = { created: 0, updated: 0, errors: 0, left: accounts.size + sessions.size };

  logger.info('-'.repeat(40));
  logger.info('Starting tasks');
  logger.info('-'.repeat(40));

  // prettier-ignore
  const getNextProxy = ((i = 0) => () => proxies[i++ % proxies.length])();

  const queue = new PQueue({ concurrency, interval: 1, intervalCap: 1 });
  queues.push(queue);

  for (const [hashname, account] of accounts.entries()) {
    account.sharedSecret ||= secrets.get(hashname)?.sharedSecret || null;
    account.identitySecret ||= secrets.get(hashname)?.identitySecret || null;

    const session: Partial<Session> = {
      Username: account.username,
      Password: account.password,
      SteamId: undefined,
      SharedSecret: account.sharedSecret,
      IdentitySecret: account.identitySecret,
      WebRefreshToken: undefined,
      MobileRefreshToken: undefined,
      DesktopRefreshToken: undefined,
      ExpiryDate: undefined,
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
        session.ExpiryDate = getSessionExpiryDate(session as Session).toISOString();

        await saveSession(sessionsDir, session as Session);

        statistics.created++;
        logger.info(`${account.username} | created | left ${--statistics.left}`);
      } catch (error) {
        statistics.errors++;
        logger.warn(`${account.username} | ${error.message.toLowerCase()} | left ${--statistics.left}`);
      } finally {
        if (statistics.left > 0 && queue.size > 0) await delay(30 * 1000);
      }
    });
  }

  for (const [hashname, session] of sessions.entries()) {
    session.SharedSecret ||= secrets.get(hashname)?.sharedSecret || null;
    session.IdentitySecret ||= secrets.get(hashname)?.identitySecret || null;

    const account: Account = {
      username: session.Username,
      password: session.Password,
      sharedSecret: session.SharedSecret,
      identitySecret: session.IdentitySecret,
    };

    session.SchemaVersion = SESSION_SCHEMA_VERSION;

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
        session.ExpiryDate = getSessionExpiryDate(session as Session).toISOString();

        await saveSession(sessionsDir, session as Session);

        statistics.updated++;
        logger.info(`${account.username} | updated | left ${--statistics.left}`);
      } catch (error) {
        statistics.errors++;
        logger.warn(`${account.username} | ${error.message.toLowerCase()} | left ${--statistics.left}`);
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
  logger.info(`Errors: ${statistics.errors}`);
}

async function exit(options: { signal?: string; error?: Error } = {}, awaitKeyAction = false) {
  const logger = new Logger('exit');
  const promises: Promise<any>[] = [];

  for (const queue of queues) {
    queue.pause();
    queue.clear();

    promises.push(queue.onIdle());
  }

  await Promise.all(promises).then(() => new Promise((resolve) => process.nextTick(resolve)));
  logger.info('-'.repeat(40));

  if (options.error) logger.warn(`Error: ${options.error.message}`);

  if (options.signal) logger.info(`Shutdown signal: ${options.signal}`);

  if (awaitKeyAction && !app.opts().silentExit) {
    logger.info('Press any key to exit');
    process.stdin.setRawMode(true).resume();

    await new Promise((resolve) => process.stdin.once('data', resolve));
    process.stdin.setRawMode(false).resume();
  }

  process.exit(options.error ? 1 : 0);
}
