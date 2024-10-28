# Steam Sessions Creator

Simple app for creating and updating Steam sessions (.steamsession files)

## What is `.steamsession`

> Syntactic sugar over the various files required by [Steam](https://store.steampowered.com), placed in one file.

```json
{
  "Username": "...",
  "Password": "...",

  "SharedSecret": "...",
  "IdentitySecret": "...",

  "SteamId": "...",

  "WebRefreshToken": "...",
  "MobileRefreshToken": "...",
  "DesktopRefreshToken": "...",
  "ExpiryDate": "...",

  "Proxy": "...",

  "SchemaVersion": 4
}
```

- `Username` - steam username
- `Password` - steam password
- `SteamId` - steam account id
- `SharedSecret` - mobile shared secret, or `null` if mobile-guard disabled
- `IdentitySecret` - mobile identity secret, or `null` if mobile-guard disabled
- `WebRefreshToken` - browser refresh token
- `MobileRefreshToken` - mobile app refresh token
- `DesktopRefreshToken` - desktop app refresh token
- `ExpiryDate` - session expiry date
- `Proxy` - assigned proxy or `null`, if `--preserve-proxy` is not used
- `SchemaVersion` - schema version number

## Why

- Shareable persistent authentication between independent apps
- Self-renewal without source data
- Useful data for most apps

## How to start

- Download the latest [release](https://github.com/Sadzurami/steam-sessions-creator/releases#latest)
- Put your steam accounts to `accounts.txt`
- Put your proxies to `proxies.txt` (optional)
- Put your secrets (mafiles) to `secrets` directory
- Start the app

## Usage

```txt
$ steam-sessions-creator --help

  Usage: Steam-Sessions-Creator [options]

  Simple app for creating and updating Steam sessions

  Options:
  -V, --version           output the version number
  --sessions <path>       path to sessions directory (default: "./sessions")
  --accounts <path>       path to accounts file (default: "./accounts.txt")
  --secrets <path>        path to secrets directory (default: "./secrets")
  --proxies <path>        path to proxies file (default: "./proxies.txt")
  --preserve-proxy        save or use existing proxy from session
  --force-create          create session even if it already exists
  --force-update          update session even if not required
  --skip-create           skip sessions creation
  --skip-update           skip sessions update
  --silent-exit           exit process automatically on finish
  --concurrency <number>  concurrency limit for global operations
  -h, --help              display help for command
```

## Supported data formats

Accounts

- `username:password`
- `username:password:shared_secret`
- `username:password:shared_secret:identity_secret`

Proxies

- `http://host:port`
- `http://username:password@host:port`

Secrets

- `mafile`

## FAQ

### After app start and resources loads, nothing happens

Wait a bit. Creation or update any of sessions may take 1.5 minutes.\
Most of this time nothing happens, just waiting for long delays to prevent rate limits.

### How to speed up creation/update

Add more proxies.

### How to use the same proxy for creation and future updates

Use option `--preserve-proxy`.
