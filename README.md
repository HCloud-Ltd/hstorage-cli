# hstorage-cli

A command-line interface for [hStorage](https://hstorage.io) — manage files, folders, teams, and more from your terminal.

## Requirements

- [Bun](https://bun.sh) v1.3+

## Installation

```bash
bun install
```

## Usage

### Development

Run directly with Bun without building:

```bash
bun run dev -- <command> [options]
```

### Build a standalone binary

Compile to a single executable. The output binary (`hstorage`) is git-ignored and should not be committed.

```bash
bun run build
# or manually:
bun build --compile src/index.ts --outfile hstorage
```

Then move it somewhere on your `$PATH`:

```bash
mv hstorage /usr/local/bin/hstorage
```

## Authentication

Before running any command, log in with your hStorage credentials:

```bash
hstorage auth login --email your@email.com --api-key YOUR_API_KEY --secret-key YOUR_SECRET_KEY
```

Credentials are stored at `~/.config/hstorage/credentials.json`.

```bash
hstorage auth status   # check current login status
hstorage auth logout   # clear stored credentials
```

## Commands

### `auth` — Authentication

| Subcommand | Description |
|---|---|
| `login` | Log in to hStorage |
| `logout` | Log out and clear credentials |
| `status` | Show current auth status |

### `file` — File management

| Subcommand | Description |
|---|---|
| `list` | List files |
| `info` | Get file information |
| `upload` | Upload a file to hStorage |
| `download` | Download a file |
| `update` | Update file state |
| `delete` | Delete a file |
| `move` | Move a file to another folder |
| `email` | Send a file via email |

### `folder` — Folder management

| Subcommand | Description |
|---|---|
| `list` | List folders |
| `get` | Get folder by UID |
| `create` | Create a folder |
| `update` | Update a folder |
| `delete` | Delete a folder |

### `folder-share` — Folder sharing

| Subcommand | Description |
|---|---|
| `shares` | List folder shares |
| `share` | Create a folder share |
| `update-share` | Update a folder share |
| `remove-share` | Remove a folder share |
| `shared-folders` | List folders shared with you |

### `team` — Team management

| Subcommand | Description |
|---|---|
| `info` | Show team information |
| `invite` | Invite a team member |
| `remove-member` | Remove a team member |
| `storage` | Show team storage status |
| `update-storage` | Update member storage allocation |

### `subscription` — Subscription management

| Subcommand | Description |
|---|---|
| `cancel` | Cancel your subscription |
| `session` | Create a Stripe checkout session |

### `sftp` — SFTP/WebDAV management

| Subcommand | Description |
|---|---|
| `permission` | Update SFTP/WebDAV permissions |

### `user` — User management

| Subcommand | Description |
|---|---|
| `info` | Show user information |
| `delete` | Delete your account |
| `settings-get` | Get user settings |
| `settings-update` | Update user settings |

## Global Options

These flags work on any command:

| Flag | Description |
|---|---|
| `--format <toon\|json\|yaml\|md\|jsonl>` | Set output format |
| `--help` | Show help for a command |
| `--version` | Show version |
| `--verbose` | Show full output envelope |

## API

This CLI targets the hStorage REST API at `https://api.hstorage.io`. See the [API docs](https://hstorage.io) for full endpoint details.
