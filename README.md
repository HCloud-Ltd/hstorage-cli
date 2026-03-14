# hstorage-cli

[HStorage](https://hstorage.io) のコマンドラインインターフェース — ファイル、フォルダ、チームなどをターミナルから管理できます。

[incur](https://github.com/wevm/incur) フレームワークで構築されており、人間にも AI エージェントにも使いやすい CLI です。

## クイックスタート

### 1. インストール

```bash
bun install
```

### 2. ビルド

```bash
bun run build
mv hcli /usr/local/bin/hstorage
```

> 開発中は `bun run dev -- <command>` でビルドせずに実行できます。

### 3. 認証

HStorage の API キーで認証します。API キーは [HStorage ダッシュボード](https://hstorage.io) から取得できます。

```bash
hstorage auth login --email you@example.com --api-key YOUR_API_KEY --secret-key YOUR_SECRET_KEY
```

認証情報は `~/.config/hstorage/credentials.json` に保存されます。

```bash
# 認証状態を確認
hstorage auth status

# ログアウト（認証情報を削除）
hstorage auth logout
```

### 4. 基本操作

```bash
# ファイル一覧を表示
hstorage file list

# ファイルをアップロード
hstorage file upload ./document.pdf

# ファイルをダウンロード
hstorage file download abc123 --output ./downloaded.pdf

# フォルダ一覧を表示
hstorage folder list
```

## 使用例

### ファイル操作

```bash
# ファイル一覧を取得（ページネーション付き）
hstorage file list --limit 50 --offset 0

# ファイルの詳細情報を取得
hstorage file info abc123

# パスワード付きファイルの情報を取得
hstorage file info abc123 --password mypassword

# ファイルをアップロード（オプション付き）
hstorage file upload ./report.pdf \
  --password secretpass \
  --download-limit-count 5 \
  --delete-date 2026-12-31T00:00:00Z \
  --folder-uid folder-uid-here

# ファイルをダウンロード
hstorage file download abc123
hstorage file download abc123 --output ./local-copy.pdf
hstorage file download abc123 --password filepassword

# ファイルを別のフォルダに移動
hstorage file move --external-id abc123 --target-folder-id 42

# ファイルをメールで送信
hstorage file email --external-id abc123 --email recipient@example.com

# ファイルを削除（確認付き）
hstorage file delete abc123 --confirm
```

### フォルダ操作

```bash
# フォルダ一覧を表示
hstorage folder list

# UID でフォルダを取得
hstorage folder get folder-uid-here

# フォルダを作成
hstorage folder create --name "プロジェクト資料"

# 子フォルダを作成
hstorage folder create --name "設計書" --parent-id 1

# 公開フォルダを作成
hstorage folder create --name "公開ファイル" --public-view true --public-upload true

# フォルダ名を変更
hstorage folder update --id 1 --name "新しい名前"

# フォルダを削除
hstorage folder delete --id 1 --confirm
```

### フォルダ共有

```bash
# フォルダの共有一覧を表示
hstorage folder-share shares --folder-uid folder-uid-here

# フォルダを共有（権限: read / edit / admin）
hstorage folder-share share \
  --folder-uid folder-uid-here \
  --email colleague@example.com \
  --permission edit

# 共有権限を変更
hstorage folder-share update-share \
  --folder-uid folder-uid-here \
  --email colleague@example.com \
  --permission read

# 共有を解除
hstorage folder-share remove-share \
  --folder-uid folder-uid-here \
  --email colleague@example.com

# 自分に共有されたフォルダの一覧
hstorage folder-share shared-folders
```

### チーム管理

```bash
# チーム情報を表示
hstorage team info

# メンバーを招待
hstorage team invite --email newmember@example.com

# メンバーを削除
hstorage team remove-member user-id-here

# チームのストレージ状況を確認
hstorage team storage

# メンバーのストレージ割り当てを変更
hstorage team update-storage --user-id user-id-here --storage-limit 10737418240
```

### ユーザー管理

```bash
# ユーザー情報を表示
hstorage user info

# ユーザー設定を取得
hstorage user settings-get

# ユーザー設定を更新
hstorage user settings-update --key value
```

### SFTP/WebDAV

```bash
# SFTP/WebDAV の権限を更新
hstorage sftp permission --insecure true

# デフォルト権限に戻す
hstorage sftp permission --insecure false
```

### サブスクリプション

```bash
# サブスクリプションを解約
hstorage subscription cancel

# Stripe チェックアウトセッションを作成
hstorage subscription session
```

## 出力フォーマット

すべてのコマンドで出力フォーマットを指定できます:

```bash
# デフォルト（TOON 形式 — トークン効率が高く、JSON より約 40% 少ないトークン数）
hstorage file list

# JSON 形式
hstorage file list --format json

# YAML 形式
hstorage file list --format yaml

# Markdown テーブル形式
hstorage file list --format md

# JSONL 形式（行区切り JSON）
hstorage file list --format jsonl
```

### 出力のフィルタリング

`--filter-output` で必要なフィールドだけを取得できます:

```bash
# ファイル名だけ取得
hstorage file list --filter-output uploads.name

# 複数フィールドを指定
hstorage file list --filter-output uploads.name,uploads.size
```

### トークン制御

大きな出力をページネーションで取得する場合:

```bash
# トークン数を確認
hstorage file list --token-count

# 最初の 100 トークンだけ取得
hstorage file list --token-limit 100

# 100 トークン目から次の 100 トークンを取得
hstorage file list --token-offset 100 --token-limit 100
```

### レスポンス全体の表示

```bash
# メタデータ付きの完全なレスポンス
hstorage file list --verbose
```

## AI エージェント連携

この CLI は [incur](https://github.com/wevm/incur) フレームワークで構築されており、AI エージェント（Claude Code、Cursor、Amp など）とネイティブに連携できます。

### MCP サーバーとして登録

CLI を MCP (Model Context Protocol) サーバーとして AI エージェントに登録します。すべてのコマンドが MCP ツールとして公開され、エージェントが直接呼び出せるようになります。

```bash
# グローバルに登録（推奨）
hstorage mcp add

# 特定のエージェントに登録
hstorage mcp add --agent claude-code
hstorage mcp add --agent cursor

# プロジェクト単位で登録
hstorage mcp add --no-global
```

登録後、AI エージェントは「HStorage にファイルをアップロードして」のような自然言語の指示で CLI を呼び出せます。

### スキルファイルの同期

CLI のコマンド定義からスキルファイル（Markdown）を自動生成し、エージェントが CLI の使い方を学習できるようにします。MCP より軽量で、トークン消費を抑えられます。

```bash
# スキルファイルをグローバルにインストール
hstorage skills add

# プロジェクトにインストール
hstorage skills add --no-global

# グルーピングの深さを指定
hstorage skills add --depth 2
```

### `--llms` フラグ

すべてのコマンドの仕様を AI が読みやすい形式で出力します。エージェントがコマンドの引数やオプションを正確に把握できます。

```bash
# コマンド一覧（概要）
hstorage --llms

# 全コマンドの詳細仕様（引数・オプション・型情報）
hstorage --llms-full

# JSON スキーマ形式で出力
hstorage --llms --format json
```

### `--mcp` フラグ

CLI を MCP stdio サーバーとして起動します。エージェントが stdin/stdout 経由でコマンドを呼び出せます。

```bash
hstorage --mcp
```

### `--schema` フラグ

個別コマンドの JSON スキーマを出力します:

```bash
hstorage file upload --schema
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

| サブコマンド | 説明 |
|---|---|
| `login` | HStorage にログイン |
| `logout` | ログアウトして認証情報を削除 |
| `status` | 現在の認証状態を表示 |

### `file` — ファイル管理

| サブコマンド | 説明 |
|---|---|
| `list` | ファイル一覧を表示 |
| `info <externalId>` | ファイル情報を取得 |
| `upload <filePath>` | ファイルを HStorage にアップロード |
| `download <externalId>` | ファイルをダウンロード |
| `update` | ファイルの状態を更新 |
| `delete <externalId>` | ファイルを削除 |
| `move` | ファイルを別のフォルダに移動 |
| `email` | ファイルをメールで送信 |

### `folder` — フォルダ管理

| サブコマンド | 説明 |
|---|---|
| `list` | フォルダ一覧を表示 |
| `get <uid>` | UID でフォルダを取得 |
| `create` | フォルダを作成 |
| `update` | フォルダを更新 |
| `delete` | フォルダを削除 |

### `folder-share` — フォルダ共有

| サブコマンド | 説明 |
|---|---|
| `shares` | フォルダの共有一覧を表示 |
| `share` | フォルダ共有を作成 |
| `update-share` | フォルダ共有を更新 |
| `remove-share` | フォルダ共有を解除 |
| `shared-folders` | 自分に共有されたフォルダの一覧を表示 |

### `team` — チーム管理

| サブコマンド | 説明 |
|---|---|
| `info` | チーム情報を表示 |
| `invite` | チームメンバーを招待 |
| `remove-member <userId>` | チームメンバーを削除 |
| `storage` | チームのストレージ状況を表示 |
| `update-storage` | メンバーのストレージ割り当てを変更 |

### `subscription` — サブスクリプション管理

| サブコマンド | 説明 |
|---|---|
| `cancel` | サブスクリプションを解約 |
| `session` | Stripe チェックアウトセッションを作成 |

### `sftp` — SFTP/WebDAV 管理

| サブコマンド | 説明 |
|---|---|
| `permission` | SFTP/WebDAV の権限を更新 |

### `user` — ユーザー管理

| サブコマンド | 説明 |
|---|---|
| `info` | ユーザー情報を表示 |
| `delete` | アカウントを削除 |
| `settings-get` | ユーザー設定を取得 |
| `settings-update` | ユーザー設定を更新 |

## グローバルオプション

| フラグ | 説明 |
|---|---|
| `--format <toon\|json\|yaml\|md\|jsonl>` | 出力フォーマットを指定 |
| `--filter-output <keys>` | 出力をキーパスでフィルタリング |
| `--verbose` | レスポンス全体を表示 |
| `--help` | コマンドのヘルプを表示 |
| `--version` | バージョンを表示 |
| `--schema` | コマンドの JSON スキーマを表示 |
| `--llms` / `--llms-full` | AI 向けコマンドマニフェストを出力 |
| `--mcp` | MCP stdio サーバーとして起動 |
| `--token-count` | 出力のトークン数を表示 |
| `--token-limit <n>` | 出力を n トークンに制限 |
| `--token-offset <n>` | 出力の先頭 n トークンをスキップ |

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
