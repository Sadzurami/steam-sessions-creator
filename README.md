# Steam Sessions Creator

A simple cli app to create steam sessions.

## What is a steam session?

All you need to know, thats steam session represents all-in-one data for manipulating with steam account.

Typically, steam session contains:

```
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

```
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

```
ssc create -a <username>:<password>
```

Example:

```
ssc create -a username:password
```

---

Create steam session with provided 2 account credentials:

```
ssc create -a <username1>:<password1> <username2>:<password2>
```

Example:

```
ssc create -a username1:password1 username2:password2
```

---

Create steam session with provided account credentials in file:

```
ssc create -a <path/to/accounts/file>
```

Example:

```
ssc create -a ./accounts.txt
```

---

Create steam session with provided account credentials in asf json files:

```
ssc create -a <path/to/asf/json/files>
```

Example:

```
ssc create -a ./asf/*.json
```

---

Create steam session with provided account credentials and proxy:

```
ssc create -a <username>:<password> -p <proxy>
```

Example:

```
ssc create -a username:password -p http://example.com:8080
```

---

Create steam session with provided account credentials and maFile:

```
ssc create -a <username>:<password> -s <path/to/maFile>
```

Example:

```
ssc create -a username:password -s ./username.maFile
```

---

Create steam session with provided account credentials and maFiles glob:

```
ssc create -a <username>:<password> -s <glob/to/maFiles>
```

Example:

```
ssc create -a username:password -s ./maFiles/*.maFile
```

---

Create steam session with provided account credentials asf db files:

```
ssc create -a <username>:<password> -d <path/to/asf/db/files>
```

Example:

```
ssc create -a username:password -d ./asf/*.db
```

---

Create steam session with provided account credentials and output path:

```
ssc create -a <username>:<password> -o <path/to/output>
```

Example:

```
ssc create -a username:password -o ./output
```

---

More info about `Create` command:

```
ssc create --help
```
