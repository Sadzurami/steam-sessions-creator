export interface Session {
  username: string;
  password: string;
  steamId: string;
  webRefreshToken: string;
  mobileRefreshToken: string;
  desktopRefreshToken: string;
  sharedSecret: string | null;
  identitySecret: string | null;
  schemaVersion: number;
}
