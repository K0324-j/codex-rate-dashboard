import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { insertScanRun, insertSnapshot } from "./db.js";

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function listJsonlFiles(rootRealPath) {
  const files = [];

  async function walk(directory) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;

      const fileRealPath = await fs.promises.realpath(fullPath);
      if (isInside(rootRealPath, fileRealPath)) {
        files.push(fileRealPath);
      }
    }
  }

  await walk(rootRealPath);
  files.sort();
  return files;
}

function hashRelativePath(rootRealPath, fileRealPath) {
  const relativePath = path.relative(rootRealPath, fileRealPath).split(path.sep).join("/");
  return crypto.createHash("sha256").update(relativePath).digest("hex");
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractSnapshot(parsed, sourceFileHash, sourceLine) {
  const rateLimits = parsed?.payload?.rate_limits;
  if (!rateLimits || typeof rateLimits !== "object") return null;

  return {
    eventTimestamp: stringOrNull(parsed.timestamp) || new Date().toISOString(),
    sourceFileHash,
    sourceLine,
    limitId: stringOrNull(rateLimits.limit_id),
    planType: stringOrNull(rateLimits.plan_type),
    primaryUsedPercent: numberOrNull(rateLimits.primary?.used_percent),
    primaryWindowMinutes: numberOrNull(rateLimits.primary?.window_minutes),
    primaryResetsAt: numberOrNull(rateLimits.primary?.resets_at),
    secondaryUsedPercent: numberOrNull(rateLimits.secondary?.used_percent),
    secondaryWindowMinutes: numberOrNull(rateLimits.secondary?.window_minutes),
    secondaryResetsAt: numberOrNull(rateLimits.secondary?.resets_at),
    rateLimitReachedType: stringOrNull(rateLimits.rate_limit_reached_type),
  };
}

export async function scanSessions(config, db) {
  const stats = {
    filesSeen: 0,
    linesSeen: 0,
    snapshotsSeen: 0,
    insertedCount: 0,
    skippedCount: 0,
    errorCount: 0,
  };

  let rootRealPath;
  try {
    rootRealPath = await fs.promises.realpath(config.sessionsDir);
  } catch {
    insertScanRun(db, stats);
    return { ...stats, ok: false, message: "sessions directory was not found" };
  }

  const files = await listJsonlFiles(rootRealPath);
  stats.filesSeen = files.length;

  db.exec("BEGIN");
  try {
    for (const filePath of files) {
      const sourceFileHash = hashRelativePath(rootRealPath, filePath);
      const stream = fs.createReadStream(filePath, { encoding: "utf8" });
      const lines = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      let sourceLine = 0;
      for await (const line of lines) {
        sourceLine += 1;
        stats.linesSeen += 1;

        if (!line.includes('"rate_limits"')) continue;

        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          stats.errorCount += 1;
          continue;
        }

        const snapshot = extractSnapshot(parsed, sourceFileHash, sourceLine);
        if (!snapshot) continue;

        stats.snapshotsSeen += 1;
        if (insertSnapshot(db, snapshot)) {
          stats.insertedCount += 1;
        } else {
          stats.skippedCount += 1;
        }
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  insertScanRun(db, stats);
  return { ...stats, ok: true };
}
