export interface Account {
  username: string;
  password: string;
  sharedSecret: string | null;
  identitySecret: string | null;
}
