export interface Session {
  username: string;
  password: string;
  steamId: string;
  refreshToken: string;
  sharedSecret: string | null;
  identitySecret: string | null;
  schemaVersion: number;
}
