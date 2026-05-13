# Codex Rate Dashboard

[日本語](./document/README_ja.md) | English

A small local web dashboard that extracts only `rate_limits` data from Codex local session logs and lets you check remaining usage trends for the 5-hour and 1-week windows.

## Unofficial Tool

This project is not an official OpenAI tool.

It is a personal helper tool that relies on the current JSONL log format saved locally by Codex. If the log format changes, this tool may no longer be able to extract the data.

## Files Read by This Tool

By default, this tool reads:

- `.codex/sessions/**/*.jsonl` under the current user's home directory
- `**/*.jsonl` under the directory specified by `CODEX_SESSIONS_DIR` in `.env`

The scanner recursively reads only files under the specified sessions directory. It does not follow symbolic links or junctions.

## Files Not Read by This Tool

This tool does not read:

- `.codex/auth.json`
- `.codex/config.toml`
- `.codex/history.jsonl`
- `.codex/log/`
- Files outside the `sessions` directory
- Conversation text or tool outputs inside JSONL files for storage purposes

The database stores only the necessary fields extracted from `rate_limits`, such as usage percentage, window duration, reset time, and plan type.

It does not store entire JSONL lines, conversation text, absolute paths, thread titles, prompts, tool outputs, or `total_token_usage`.

## No External Communication

This app does not communicate with external services.

There is no telemetry, external CDN, external API, or analytics tag. The web server binds only to `127.0.0.1`.

## Installation

```powershell
npm install
```

Create a `.env` file as needed, using `.env.example` as a reference.

```dotenv
CODEX_SESSIONS_DIR=/path/to/.codex/sessions
PORT=4177
```

To test the app using sample data only, you can specify a fully dummy JSONL directory.

```dotenv
CODEX_SESSIONS_DIR=./samples/dummy-sessions
PORT=4177
```

## Usage

```powershell
npm start
```

After starting the app, open the following URL in your browser:

```text
http://127.0.0.1:4177
```

You can switch the display range between `24h`, `7 days`, `14 days`, `30 days`, and `All`.

You can also switch between Japanese and English using the language toggle in the top-right corner. On first launch, the app uses Japanese if your browser language is Japanese; otherwise, it uses English.

To run collection only:

```powershell
npm run collect
```

To run checks:

```powershell
npm run check
```

## Notes

* The database is saved to `data/rate-limits.sqlite`. The `data/` directory is already included in `.gitignore`.
* Duplicate detection is based on `source_file_hash + source_line`.
* `source_file_hash` is a SHA-256 hash of the relative path from the sessions root. Absolute paths are not stored in the database.
* This tool is intended for visualizing local logs. It does not guarantee accurate remaining usage for billing, official rate limits, or terms-of-service-related limits.
* Before publishing this project on GitHub, run `npm run check` and a safety scan.
