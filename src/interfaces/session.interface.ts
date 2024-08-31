export interface Session {
  Username: string;
  Password: string;
  SteamId: string;
  SharedSecret: string | null;
  IdentitySecret: string | null;
  WebRefreshToken: string;
  MobileRefreshToken: string;
  DesktopRefreshToken: string;
  Proxy?: string | null;
  SchemaVersion: number;
}
