# Codex Rate Dashboard

日本語 | [English](../README.md)

Codex のローカルセッションログに含まれる `rate_limits` だけを抽出し、5時間枠と1週間枠の残量推移をローカルWeb画面で確認する小さなダッシュボードです。

## 非公式ツールであること

このプロジェクトは OpenAI 公式ツールではありません。Codex がローカルに保存している JSONL ログの現在の形式を利用する個人向け補助ツールです。ログ形式が変わった場合、抽出できなくなる可能性があります。

## 読み取るファイル

- 既定では、現在のユーザーのホームディレクトリ配下にある `.codex/sessions/**/*.jsonl`
- `.env` の `CODEX_SESSIONS_DIR` に指定したディレクトリ配下の `**/*.jsonl`

スキャナは指定された sessions ディレクトリ配下だけを再帰的に読みます。シンボリックリンクやジャンクションは追跡しません。

## 読み取らないファイル

- `.codex/auth.json`
- `.codex/config.toml`
- `.codex/history.jsonl`
- `.codex/log/`
- `sessions` ディレクトリ外のファイル
- JSONL 内の会話本文やツール出力を保存目的で扱うこと

DBに保存するのは、`rate_limits` から取り出した使用率、ウィンドウ時間、リセット時刻、プラン種別などの必要項目だけです。JSONLの行全体、会話本文、絶対パス、thread title、prompt、tool output、`total_token_usage` は保存しません。

## 外部通信しないこと

このアプリは外部通信をしません。テレメトリ、外部CDN、外部API、解析タグはありません。Webサーバーは `127.0.0.1` にだけバインドします。

再スキャン用APIは、サーバー起動ごとに生成するランダムトークンを `/api/config` からローカル画面へ渡して確認します。これはローカル用途の簡易CSRF対策であり、本格的な認証ではありません。

## インストール方法

```powershell
npm install
```

必要に応じて `.env.example` を参考に `.env` を作成します。

```dotenv
CODEX_SESSIONS_DIR=/path/to/.codex/sessions
PORT=4177
```

サンプルデータだけで確認する場合は、完全なダミーJSONLを指定できます。

```dotenv
CODEX_SESSIONS_DIR=./samples/dummy-sessions
PORT=4177
```

## 起動方法

```powershell
npm start
```

起動後、ブラウザで以下を開きます。

```text
http://127.0.0.1:4177
```

表示期間は `24h`、`7日`、`14日`、`30日`、`全期間` から切り替えできます。
画面右上の言語切替で日本語/英語を切り替えできます。初回表示はブラウザの言語設定が日本語なら日本語、それ以外なら英語になります。

収集だけ実行する場合:

```powershell
npm run collect
```

構文チェック:

```powershell
npm run check
```

## 注意事項

- 保存先DBは `data/rate-limits.sqlite` です。`data/` は `.gitignore` 済みです。
- 重複判定は `source_file_hash + source_line` で行います。
- `source_file_hash` は sessions root からの相対パスを SHA-256 化した値です。絶対パスはDBへ保存しません。
- このツールはローカルログの可視化用です。課金、公式レート制限、利用規約上の正確な残量を保証するものではありません。
- GitHubで公開する前に、`npm run check` と安全スキャンを実行してください。
