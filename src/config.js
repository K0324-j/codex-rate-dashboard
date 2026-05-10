import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalIndex = line.indexOf("=");
    if (equalIndex < 1) continue;

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const envFileValues = parseEnvFile(path.join(projectRoot, ".env"));

export function getConfig(overrides = {}) {
  const env = { ...envFileValues, ...process.env, ...overrides };
  const sessionsDir =
    env.CODEX_SESSIONS_DIR || path.join(os.homedir(), ".codex", "sessions");
  const port = Number(env.PORT || 4177);

  return {
    projectRoot,
    sessionsDir: path.resolve(sessionsDir),
    dataDir: path.join(projectRoot, "data"),
    databasePath: path.join(projectRoot, "data", "rate-limits.sqlite"),
    publicDir: path.join(projectRoot, "public"),
    port: Number.isFinite(port) && port > 0 ? port : 4177,
  };
}
