export interface Proxy {
  host: string;
  port: number;
  protocol: string;
  auth?: {
    username: string;
    password: string;
  };
  toString(): string;
}
