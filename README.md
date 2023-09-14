# Steam Sessions Creator

A simple CLI app for creating and managing steam sessions.

## What is a steam session?

All you need to know, thats steam session represents all-in-one data for manipulating with steam account.

Typically, steam session contains:

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

  "SchemaVersion": 2
}
```

- `Username` - steam username
- `Password` - steam password
- `SteamId` - steam id of account
- `SharedSecret` - shared secret to generate 2fa codes (or null if 2fa disabled)
- `IdentitySecret` - identity secret to generate 2fa codes (or null if 2fa disabled)
- `WebRefreshToken` - refresh token for login via web
- `MobileRefreshToken` - refresh token for login via mobile app
- `DesktopRefreshToken` - refresh token for login via steam client
- `SchemaVersion` - schema version of steam session

## Installation

Download latest release from [here](https://github.com/Sadzurami/steam-sessions-creator/releases)

## Commands

### `create` (default)

Create new sessions.

Flags:

> -a --accounts

Specify file path where accounts are stored.
Supported formats:

- username:password
- username:password:sharedSecret

Default: `./accounts.txt`

> -s, --secrets

Specify file path where secrets are stored.
Supported formats:

- maFile

Default: `./secrets`

> -p, --proxies

Specify file path where proxies are stored.
Supported formats: proto://user:pass@host:port

Default: `./proxies.txt`

> -o, --output

Specify directory path where sessions will be stored.

Default: `./sessions`

> -f, --force

Force creation even if session already exists in output directory.

> --help (-h)

Show help message.

### `renew`

Renew sessions.

Flags:

> -s, --sessions

Specify directory path where sessions are stored.

Default: `./sessions`

> -p, --proxies

Specify file path where proxies are stored.
Supported formats: proto://user:pass@host:port

Default: `./proxies.txt`

> -f, --force

Force renew, even if session is valid and not expired yet.

## Questions And Suggestions

If you have any suggestions, please contact me via email [mail.to.sadzurami@gmail.com](mailto:mail.to.sadzurami@gmail.com).
