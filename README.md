# Steam Sessions Creator

A simple cli app to create steam sessions.

## What is a steam session?

All you need to know, thats steam session represents all-in-one data for manipulating with steam account.

Typically, steam session contains:

```json
{
  "Username": "...", // steam username
  "Password": "...", // steam password
  "SteamId": "...", // steam id of account
  "RefreshToken": "...", // refresh token for steam login
  "SharedSecret": "...", // shared secret to generate 2fa codes
  "IdentitySecret": "...", // identity secret to generate 2fa codes
  "SchemaVersion": 1 // schema version of steam session
}
```

## Features

- Import accounts from file or [ASF](https://github.com/JustArchiNET/ArchiSteamFarm/)
- Proxies support out of the box (http, https, socks5)
- Steam Guard support from maFiles or [ASF](https://github.com/JustArchiNET/ArchiSteamFarm/)

## Installation

### From source

```bash
git clone
cd steam-sessions-creator
npm install (or yarn install)
npm run build (or yarn run build)
npx ssc --help (or yarn ssc --help)
```

### From prebuilt binaries

Download latest release from [here](https://github.com/Sadzurami/steam-sessions-creator/releases)

## Commands

### `Create`

Allows you to create steam session from scratch.

Create steam session with provided account credentials:

```bash
ssc create -a <username>:<password>
```

Example:

```bash
ssc create -a username:password
```

---

Create steam session with provided 2 account credentials:

```bash
ssc create -a <username1>:<password1> <username2>:<password2>
```

Example:

```bash
ssc create -a username1:password1 username2:password2
```

---

Create steam session with provided account credentials in file:

```bash
ssc create -a <path/to/accounts/file>
```

Example:

```bash
ssc create -a ./accounts.txt
```

---

Create steam session with provided account credentials in asf json files:

```bash
ssc create -a <path/to/asf/json/files>
```

Example:

```bash
ssc create -a ./asf/*.json
```

---

Create steam session with provided account credentials and proxy:

```bash
ssc create -a <username>:<password> -p <proxy>
```

Example:

```bash
ssc create -a username:password -p http://example.com:8080
```

---

Create steam session with provided account credentials and maFile:

```bash
ssc create -a <username>:<password> -s <path/to/maFile>
```

Example:

```bash
ssc create -a username:password -s ./username.maFile
```

---

Create steam session with provided account credentials and maFiles glob:

```bash
ssc create -a <username>:<password> -s <glob/to/maFiles>
```

Example:

```bash
ssc create -a username:password -s ./maFiles/*.maFile
```

---

Create steam session with provided account credentials asf db files:

```bash
ssc create -a <username>:<password> -d <path/to/asf/db/files>
```

Example:

```bash
ssc create -a username:password -d ./asf/*.db
```

---

Create steam session with provided account credentials and output path:

```bash
ssc create -a <username>:<password> -o <path/to/output>
```

Example:

```bash
ssc create -a username:password -o ./output
```

---

More info about `Create` command:

```bash
ssc create --help
```
