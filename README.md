# Steam Sessions Creator

A simple CLI app for creating and managing steam sessions.

## What is a steam session?

All you need to know, thats steam session represents all-in-one data for manipulating with steam account.

Typically, steam session contains:

```json
{
  "Username": "...",
  "Password": "...",
  "SteamId": "...",
  "WebRefreshToken": "...",
  "MobileRefreshToken": "...",
  "DesktopRefreshToken": "...",
  "SharedSecret": "...",
  "IdentitySecret": "...",
  "SchemaVersion": 2
}
```

- `Username` - steam username
- `Password` - steam password
- `SteamId` - steam id of account
- `WebRefreshToken` - refresh token for login via web
- `MobileRefreshToken` - refresh token for login via mobile app
- `DesktopRefreshToken` - refresh token for login via steam client
- `SharedSecret` - shared secret to generate 2fa codes (or null if 2fa disabled)
- `IdentitySecret` - identity secret to generate 2fa codes (or null if 2fa disabled)
- `SchemaVersion` - schema version of steam session

## Features

- Import accounts from file or [ASF](https://github.com/JustArchiNET/ArchiSteamFarm/)
- Proxies support out of the box (http, https, socks5)
- Steam Guard support from maFiles or [ASF](https://github.com/JustArchiNET/ArchiSteamFarm/)

## Installation

Download latest release from [here](https://github.com/Sadzurami/steam-sessions-creator/releases)

## Commands

### `create`

Allows you to create steam session from scratch.

### Options

> `--accounts` (`-a`) [required]

Specify one or more accounts.
Account can be specified as:

- A simple string.
- A file path to load accounts from (one account per line).
- A glob pattern to load accounts from multiple files.

Supported formats:

- username:password
- username:password:sharedSecret
- username:password:sharedSecret:identitySecret - ASF json

---

> `--secrets` (`-s`)

Specify one or more secrets.

Secret can be specified as:

- A file path to load secrets from file.
- A glob pattern to load secrets from multiple files.

Supported formats:

- maFile
- ASF db

Default: no secrets

---

> `--proxies` (`-p`)

Specify one or more proxies.

Proxy can be specified as:

- A string in the format `<protocol>://<username>:<password>@<host>:<port>`
- A file path to load proxies from a text file.

Supported protocols:

- http
- https

Default: no proxies

---

> `--concurrency` (`-c`)

Specify the number of concurrent runs.

Default: 1, or the number of proxies.

---

> `--output` (`-o`)

Specify the output directory.

Default: `./sessions`

---

> `--help` (`-h`)

Show help message and exit.

# Questions And Suggestions

If you have any suggestions, please contact me via email [mail.to.sadzurami@gmail.com](mailto:mail.to.sadzurami@gmail.com).
