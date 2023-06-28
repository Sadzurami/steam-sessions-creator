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

### Commands

### `Create`

Allows you to create steam session from scratch.

### CLI Arguments

### `--accounts` (`-a`)

**Required**

Specify one or more accounts.
Account can be specified as:

- A simple string.
- A file path to load accounts from (one account per line).
- A glob pattern to load accounts from multiple files.

Supported formats:

- username:password
- username:password:sharedSecret
- username:password:sharedSecret:identitySecret - ASF json

### `--secrets` (`-s`)

**Default: no secrets**

Specify one or more secrets.

Secret can be specified as:

- A file path to load secrets from file.
- A glob pattern to load secrets from multiple files.

Supported formats:

- maFile
- ASF db

### `--proxies` (`-p`)

**Default: no proxies**

Specify one or more proxies.

Proxy can be specified as:

- A string in the format `<protocol>://<username>:<password>@<host>:<port>`
- A file path to load proxies from a text file.

Supported protocols:

- http
- https

### `--concurrency` (`-c`)

**Default: 1, or the number of proxies.**

Specify the number of concurrent runs.

### `--output` (`-o`)

**Default: `./output`**

Specify the output directory.

### `--help` (`-h`)

Show help message and exit.
