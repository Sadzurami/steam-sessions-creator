export interface Session {
  Username: string;
  Password: string;
  SteamId: string;
  SharedSecret: string | null;
  IdentitySecret: string | null;
  WebRefreshToken: string;
  MobileRefreshToken: string;
  DesktopRefreshToken: string;
  SchemaVersion: number;
  Proxy?: string | null;
}
