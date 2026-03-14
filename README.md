# hcli - hstorage-cli

[HStorage](https://hstorage.io) のコマンドラインインターフェース — ファイル、フォルダ、チームなどをターミナルから管理できます。

[incur](https://github.com/wevm/incur) フレームワークで構築されており、人間にも AI エージェントにも使いやすい CLI です。

## 目次

- [クイックスタート](#クイックスタート)
  - [1. インストール](#1-インストール)
  - [2. 認証](#2-認証)
  - [3. 基本操作](#3-基本操作)
- [使用例](#使用例)
  - [ファイル操作](#ファイル操作)
  - [フォルダ操作](#フォルダ操作)
  - [フォルダ共有](#フォルダ共有)
  - [チーム管理](#チーム管理)
  - [ユーザー管理](#ユーザー管理)
  - [SFTP/WebDAV](#sftpwebdav)
  - [サブスクリプション](#サブスクリプション)
- [出力フォーマット](#出力フォーマット)
  - [出力のフィルタリング](#出力のフィルタリング)
  - [トークン制御](#トークン制御)
  - [レスポンス全体の表示](#レスポンス全体の表示)
- [AI エージェント連携](#ai-エージェント連携)
  - [MCP サーバーとして登録](#mcp-サーバーとして登録)
  - [スキルファイルの同期](#スキルファイルの同期)
  - [`--llms` フラグ](#--llms-フラグ)
  - [`--mcp` フラグ](#--mcp-フラグ)
  - [`--schema` フラグ](#--schema-フラグ)
- [シェル補完](#シェル補完)
- [コマンドリファレンス](#コマンドリファレンス)
  - [`auth` — 認証](#auth--認証)
  - [`file` — ファイル管理](#file--ファイル管理)
  - [`folder` — フォルダ管理](#folder--フォルダ管理)
  - [`folder-share` — フォルダ共有](#folder-share--フォルダ共有)
  - [`team` — チーム管理](#team--チーム管理)
  - [`subscription` — サブスクリプション管理](#subscription--サブスクリプション管理)
  - [`sftp` — SFTP/WebDAV 管理](#sftp--sftpwebdav-管理)
  - [`user` — ユーザー管理](#user--ユーザー管理)
- [グローバルオプション](#グローバルオプション)
- [動作要件](#動作要件)
- [開発](#開発)
- [API](#api)

## クイックスタート

### 1. インストール

```bash
curl -fsSL https://raw.githubusercontent.com/HCloud-Ltd/hstorage-cli/main/install.sh | sh
```

<details>
<summary>その他のインストール方法</summary>

#### バージョンを指定

```bash
curl -fsSL https://raw.githubusercontent.com/HCloud-Ltd/hstorage-cli/main/install.sh | HCLI_VERSION=v0.0.3 sh
```

#### インストール先を変更

```bash
curl -fsSL https://raw.githubusercontent.com/HCloud-Ltd/hstorage-cli/main/install.sh | HCLI_INSTALL_DIR=~/.bin sh
```

デフォルトでは `/usr/local/bin` にインストールされます。書き込み権限がない場合は `~/.local/bin` にフォールバックします。

#### ソースからビルド

```bash
bun install
bun run build
mv hcli /usr/local/bin/hcli
```

> 開発中は `bun run dev -- <command>` でビルドせずに実行できます。

</details>

### 2. 認証

HStorage の API キーで認証します。API キーは [HStorage ダッシュボード](https://hstorage.io) から取得できます。

```bash
hcli auth login --email you@example.com --api-key YOUR_API_KEY --secret-key YOUR_SECRET_KEY
```

認証情報は `~/.config/hstorage/credentials.json` に保存されます。

```bash
# 認証状態を確認
hcli auth status

# ログアウト（認証情報を削除）
hcli auth logout
```

### 3. 基本操作

```bash
# ファイル一覧を表示
hcli file list

# ファイルをアップロード
hcli file upload ./document.pdf

# ファイルをダウンロード
hcli file download abc123 --output ./downloaded.pdf

# フォルダ一覧を表示
hcli folder list
```

## 使用例

### ファイル操作

```bash
# ファイル一覧を取得（ページネーション付き）
hcli file list --limit 50 --offset 0

# ファイルの詳細情報を取得
hcli file info abc123

# パスワード付きファイルの情報を取得
hcli file info abc123 --password mypassword

# ファイルをアップロード（オプション付き）
hcli file upload ./report.pdf \
  --password secretpass \
  --download-limit-count 5 \
  --delete-date 2026-12-31T00:00:00Z \
  --folder-uid folder-uid-here

# ファイルをダウンロード
hcli file download abc123
hcli file download abc123 --output ./local-copy.pdf
hcli file download abc123 --password filepassword

# ファイルを別のフォルダに移動
hcli file move --external-id abc123 --target-folder-id 42

# ファイルをメールで送信
hcli file email --external-id abc123 --email recipient@example.com

# ファイルを削除（確認付き）
hcli file delete abc123 --confirm
```

### フォルダ操作

```bash
# フォルダ一覧を表示
hcli folder list

# UID でフォルダを取得
hcli folder get folder-uid-here

# フォルダを作成
hcli folder create --name "プロジェクト資料"

# 子フォルダを作成
hcli folder create --name "設計書" --parent-id 1

# 公開フォルダを作成
hcli folder create --name "公開ファイル" --public-view true --public-upload true

# フォルダ名を変更
hcli folder update --id 1 --name "新しい名前"

# フォルダを削除
hcli folder delete --id 1 --confirm
```

### フォルダ共有

```bash
# フォルダの共有一覧を表示
hcli folder-share shares --folder-uid folder-uid-here

# フォルダを共有（権限: read / edit / admin）
hcli folder-share share \
  --folder-uid folder-uid-here \
  --email colleague@example.com \
  --permission edit

# 共有権限を変更
hcli folder-share update-share \
  --folder-uid folder-uid-here \
  --email colleague@example.com \
  --permission read

# 共有を解除
hcli folder-share remove-share \
  --folder-uid folder-uid-here \
  --email colleague@example.com

# 自分に共有されたフォルダの一覧
hcli folder-share shared-folders
```

### チーム管理

```bash
# チーム情報を表示
hcli team info

# メンバーを招待
hcli team invite --email newmember@example.com

# メンバーを削除
hcli team remove-member user-id-here

# チームのストレージ状況を確認
hcli team storage

# メンバーのストレージ割り当てを変更
hcli team update-storage --user-id user-id-here --storage-limit 10737418240
```

### ユーザー管理

```bash
# ユーザー情報を表示
hcli user info

# ユーザー設定を取得
hcli user settings-get

# ユーザー設定を更新
hcli user settings-update --key value
```

### SFTP/WebDAV

```bash
# SFTP/WebDAV の権限を更新
hcli sftp permission --insecure true

# デフォルト権限に戻す
hcli sftp permission --insecure false
```

### サブスクリプション

```bash
# サブスクリプションを解約
hcli subscription cancel

# Stripe チェックアウトセッションを作成
hcli subscription session
```

## 出力フォーマット

すべてのコマンドで出力フォーマットを指定できます:

```bash
# デフォルト（TOON 形式 — トークン効率が高く、JSON より約 40% 少ないトークン数）
hcli file list

# JSON 形式
hcli file list --format json

# YAML 形式
hcli file list --format yaml

# Markdown テーブル形式
hcli file list --format md

# JSONL 形式（行区切り JSON）
hcli file list --format jsonl
```

### 出力のフィルタリング

`--filter-output` で必要なフィールドだけを取得できます:

```bash
# ファイル名だけ取得
hcli file list --filter-output uploads.name

# 複数フィールドを指定
hcli file list --filter-output uploads.name,uploads.size
```

### トークン制御

大きな出力をページネーションで取得する場合:

```bash
# トークン数を確認
hcli file list --token-count

# 最初の 100 トークンだけ取得
hcli file list --token-limit 100

# 100 トークン目から次の 100 トークンを取得
hcli file list --token-offset 100 --token-limit 100
```

### レスポンス全体の表示

```bash
# メタデータ付きの完全なレスポンス
hcli file list --verbose
```

## AI エージェント連携

この CLI は [incur](https://github.com/wevm/incur) フレームワークで構築されており、AI エージェント（Claude Code、Cursor、Amp など）とネイティブに連携できます。

### MCP サーバーとして登録

CLI を MCP (Model Context Protocol) サーバーとして AI エージェントに登録します。すべてのコマンドが MCP ツールとして公開され、エージェントが直接呼び出せるようになります。

```bash
# グローバルに登録（推奨）
hcli mcp add

# 特定のエージェントに登録
hcli mcp add --agent claude-code
hcli mcp add --agent cursor

# プロジェクト単位で登録
hcli mcp add --no-global
```

登録後、AI エージェントは「HStorage にファイルをアップロードして」のような自然言語の指示で CLI を呼び出せます。

### スキルファイルの同期

CLI のコマンド定義からスキルファイル（Markdown）を自動生成し、エージェントが CLI の使い方を学習できるようにします。MCP より軽量で、トークン消費を抑えられます。

```bash
# スキルファイルをグローバルにインストール
hcli skills add

# プロジェクトにインストール
hcli skills add --no-global

# グルーピングの深さを指定
hcli skills add --depth 2
```

### `--llms` フラグ

すべてのコマンドの仕様を AI が読みやすい形式で出力します。エージェントがコマンドの引数やオプションを正確に把握できます。

```bash
# コマンド一覧（概要）
hcli --llms

# 全コマンドの詳細仕様（引数・オプション・型情報）
hcli --llms-full

# JSON スキーマ形式で出力
hcli --llms --format json
```

### `--mcp` フラグ

CLI を MCP stdio サーバーとして起動します。エージェントが stdin/stdout 経由でコマンドを呼び出せます。

```bash
hcli --mcp
```

### `--schema` フラグ

個別コマンドの JSON スキーマを出力します:

```bash
hcli file upload --schema
```

```yaml
args:
  type: object
  properties:
    filePath:
      type: string
      description: Local file path to upload
  required[1]: filePath
options:
  type: object
  properties:
    downloadLimitCount:
      description: Max download count
      type: number
    password:
      description: Password protection
      type: string
    deleteDate:
      description: Auto-delete date (ISO 8601)
      type: string
    folderUid:
      description: Target folder UID
      type: string
```

## シェル補完

```bash
# Bash
eval "$(hstorage completions bash)"   # ~/.bashrc に追加

# Zsh
eval "$(hstorage completions zsh)"    # ~/.zshrc に追加

# Fish
hstorage completions fish | source    # ~/.config/fish/config.fish に追加

# Nushell
hstorage completions nushell          # config.nu の手順を確認
```

## コマンドリファレンス

### `auth` — 認証

| サブコマンド | 説明                         |
| ------------ | ---------------------------- |
| `login`      | HStorage にログイン          |
| `logout`     | ログアウトして認証情報を削除 |
| `status`     | 現在の認証状態を表示         |

### `file` — ファイル管理

| サブコマンド            | 説明                               |
| ----------------------- | ---------------------------------- |
| `list`                  | ファイル一覧を表示                 |
| `info <externalId>`     | ファイル情報を取得                 |
| `upload <filePath>`     | ファイルを HStorage にアップロード |
| `download <externalId>` | ファイルをダウンロード             |
| `update`                | ファイルの状態を更新               |
| `delete <externalId>`   | ファイルを削除                     |
| `move`                  | ファイルを別のフォルダに移動       |
| `email`                 | ファイルをメールで送信             |

### `folder` — フォルダ管理

| サブコマンド | 説明                 |
| ------------ | -------------------- |
| `list`       | フォルダ一覧を表示   |
| `get <uid>`  | UID でフォルダを取得 |
| `create`     | フォルダを作成       |
| `update`     | フォルダを更新       |
| `delete`     | フォルダを削除       |

### `folder-share` — フォルダ共有

| サブコマンド     | 説明                                 |
| ---------------- | ------------------------------------ |
| `shares`         | フォルダの共有一覧を表示             |
| `share`          | フォルダ共有を作成                   |
| `update-share`   | フォルダ共有を更新                   |
| `remove-share`   | フォルダ共有を解除                   |
| `shared-folders` | 自分に共有されたフォルダの一覧を表示 |

### `team` — チーム管理

| サブコマンド             | 説明                               |
| ------------------------ | ---------------------------------- |
| `info`                   | チーム情報を表示                   |
| `invite`                 | チームメンバーを招待               |
| `remove-member <userId>` | チームメンバーを削除               |
| `storage`                | チームのストレージ状況を表示       |
| `update-storage`         | メンバーのストレージ割り当てを変更 |

### `subscription` — サブスクリプション管理

| サブコマンド | 説明                                  |
| ------------ | ------------------------------------- |
| `cancel`     | サブスクリプションを解約              |
| `session`    | Stripe チェックアウトセッションを作成 |

### `sftp` — SFTP/WebDAV 管理

| サブコマンド | 説明                     |
| ------------ | ------------------------ |
| `permission` | SFTP/WebDAV の権限を更新 |

### `user` — ユーザー管理

| サブコマンド      | 説明               |
| ----------------- | ------------------ |
| `info`            | ユーザー情報を表示 |
| `delete`          | アカウントを削除   |
| `settings-get`    | ユーザー設定を取得 |
| `settings-update` | ユーザー設定を更新 |

## グローバルオプション

| フラグ                                   | 説明                              |
| ---------------------------------------- | --------------------------------- |
| `--format <toon\|json\|yaml\|md\|jsonl>` | 出力フォーマットを指定            |
| `--filter-output <keys>`                 | 出力をキーパスでフィルタリング    |
| `--verbose`                              | レスポンス全体を表示              |
| `--help`                                 | コマンドのヘルプを表示            |
| `--version`                              | バージョンを表示                  |
| `--schema`                               | コマンドの JSON スキーマを表示    |
| `--llms` / `--llms-full`                 | AI 向けコマンドマニフェストを出力 |
| `--mcp`                                  | MCP stdio サーバーとして起動      |
| `--token-count`                          | 出力のトークン数を表示            |
| `--token-limit <n>`                      | 出力を n トークンに制限           |
| `--token-offset <n>`                     | 出力の先頭 n トークンをスキップ   |

## 動作要件

- [Bun](https://bun.sh) v1.3 以上

## 開発

```bash
# 依存関係のインストール
bun install

# 開発モードで実行
bun run dev -- file list

# テスト
bun test

# ビルド
bun run build
```

## API

この CLI は `https://api.hstorage.io` の HStorage REST API を使用しています。エンドポイントの詳細は [API ドキュメント](https://hstorage.io) を参照してください。
