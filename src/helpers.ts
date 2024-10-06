import { createHash } from 'crypto';
import { hostname } from 'os';

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
