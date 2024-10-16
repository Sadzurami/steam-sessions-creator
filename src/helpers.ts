import { createHash } from 'crypto';
import fs from 'fs-extra';
import { hostname } from 'os';
import PQueue from 'p-queue';
import path from 'path';

import { Account } from './interfaces/account.interface';
import { Secret } from './interfaces/secret.interface';
import { Session } from './interfaces/session.interface';

export async function readSessions(directory: string): Promise<Session[]> {
  await fs.ensureDir(directory);
  let paths = await fs.readdir(directory).catch(() => [] as string[]);

  paths = paths.filter((file) => file.endsWith('.steamsession')).map((file) => path.join(directory, file));
  if (paths.length === 0) return [];

  const sessions: Map<string, Session> = new Map();

  const queue = new PQueue({ concurrency: 512 });
  await queue.addAll(
    paths.map((file) => async () => {
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
    }),
  );

  return [...sessions.values()];
}

export async function readAccounts(file: string): Promise<Account[]> {
  await fs.ensureFile(file);
  const content = await fs.readFile(file, 'utf-8').catch(() => '');

  if (content.length === 0) return [];
  const accounts: Map<string, Account> = new Map();

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

export async function readSecrets(directory: string): Promise<Secret[]> {
  await fs.ensureDir(directory);
  let paths = await fs.readdir(directory).catch(() => [] as string[]);

  paths = paths.filter((file) => file.toLowerCase().endsWith('.mafile')).map((file) => path.join(directory, file));
  if (paths.length === 0) return [];

  const secrets: Map<string, Secret> = new Map();

  const queue = new PQueue({ concurrency: 512 });
  await queue.addAll(
    paths.map((file) => async () => {
      let mafile: Record<string, any>;

      try {
        let content = await fs.readFile(file, 'utf8').catch(() => '');
        content = content.replace(/},\s*}/g, '}}').replace(/'/g, '"');

        mafile = JSON.parse(content) as Record<string, any>;
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
    }),
  );

  return [...secrets.values()];
}

export async function readProxies(file: string): Promise<string[]> {
  await fs.ensureFile(file);
  const content = await fs.readFile(file, 'utf-8').catch(() => '');

  if (content.length === 0) return [];
  const proxies: Set<string> = new Set();

  for (const line of content.split(/\r?\n/)) {
    let proxy: string;

    try {
      proxy = new URL(line.trim()).toString().slice(0, -1);
    } catch (error) {
      continue;
    }

    proxies.add(proxy);
  }

  return [...proxies.values()];
}

export async function saveSession(directory: string, session: Session) {
  const file = path.resolve(directory, `${session.Username}.steamsession`);
  await fs.writeFile(file, JSON.stringify(session, null, 2));
}

export function decodeRefreshToken(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Token must have 3 parts');

    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadString = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    const payloadJson = JSON.parse(payloadString);

    return payloadJson as { iss: string; sub: string; aud: string[]; exp: number };
  } catch (error) {
    throw new Error('Failed to decode refresh token', { cause: error });
  }
}

// https://github.com/DoctorMcKay/node-steam-session/issues/44
// https://github.com/DoctorMcKay/node-steam-session/pull/45
export function createMachineName(accountName: string) {
  const hash = createHash('sha1');
  hash.update(accountName || hostname());

  const sha1 = hash.digest();
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  let output = 'DESKTOP-';
  for (let i = 0; i < 7; i++) output += CHARS[sha1[i] % CHARS.length];

  return output;
}
