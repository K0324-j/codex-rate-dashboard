import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(config) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const db = new DatabaseSync(config.databasePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_timestamp TEXT NOT NULL,
      source_file_hash TEXT NOT NULL,
      source_line INTEGER NOT NULL,
      limit_id TEXT,
      plan_type TEXT,
      primary_used_percent REAL,
      primary_window_minutes INTEGER,
      primary_resets_at INTEGER,
      secondary_used_percent REAL,
      secondary_window_minutes INTEGER,
      secondary_resets_at INTEGER,
      rate_limit_reached_type TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_file_hash, source_line)
    );

    CREATE INDEX IF NOT EXISTS idx_rate_limit_snapshots_event_timestamp
      ON rate_limit_snapshots(event_timestamp);

    CREATE TABLE IF NOT EXISTS scan_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scanned_at TEXT NOT NULL,
      files_seen INTEGER NOT NULL,
      lines_seen INTEGER NOT NULL,
      snapshots_seen INTEGER NOT NULL,
      inserted_count INTEGER NOT NULL,
      skipped_count INTEGER NOT NULL,
      error_count INTEGER NOT NULL
    );
  `);
  return db;
}

export function insertSnapshot(db, snapshot) {
  const statement = db.prepare(`
    INSERT OR IGNORE INTO rate_limit_snapshots (
      event_timestamp,
      source_file_hash,
      source_line,
      limit_id,
      plan_type,
      primary_used_percent,
      primary_window_minutes,
      primary_resets_at,
      secondary_used_percent,
      secondary_window_minutes,
      secondary_resets_at,
      rate_limit_reached_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = statement.run(
    snapshot.eventTimestamp,
    snapshot.sourceFileHash,
    snapshot.sourceLine,
    snapshot.limitId,
    snapshot.planType,
    snapshot.primaryUsedPercent,
    snapshot.primaryWindowMinutes,
    snapshot.primaryResetsAt,
    snapshot.secondaryUsedPercent,
    snapshot.secondaryWindowMinutes,
    snapshot.secondaryResetsAt,
    snapshot.rateLimitReachedType,
  );

  return result.changes === 1;
}

export function insertScanRun(db, stats) {
  db.prepare(`
    INSERT INTO scan_runs (
      scanned_at,
      files_seen,
      lines_seen,
      snapshots_seen,
      inserted_count,
      skipped_count,
      error_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    new Date().toISOString(),
    stats.filesSeen,
    stats.linesSeen,
    stats.snapshotsSeen,
    stats.insertedCount,
    stats.skippedCount,
    stats.errorCount,
  );
}

export function getSummary(db, days = 7) {
  const range = String(days).toLowerCase();
  const isAll = range === "all";
  const windowMs = range === "24h"
    ? 24 * 60 * 60 * 1000
    : Math.min(Math.max(Number(days) || 7, 1), 30) * 24 * 60 * 60 * 1000;
  const since = isAll
    ? null
    : new Date(Date.now() - windowMs).toISOString();

  const latest = db.prepare(`
    SELECT
      event_timestamp AS eventTimestamp,
      limit_id AS limitId,
      plan_type AS planType,
      primary_used_percent AS primaryUsedPercent,
      primary_window_minutes AS primaryWindowMinutes,
      primary_resets_at AS primaryResetsAt,
      secondary_used_percent AS secondaryUsedPercent,
      secondary_window_minutes AS secondaryWindowMinutes,
      secondary_resets_at AS secondaryResetsAt,
      rate_limit_reached_type AS rateLimitReachedType
    FROM rate_limit_snapshots
    ORDER BY event_timestamp DESC, id DESC
    LIMIT 1
  `).get();

  const pointsQuery = since
    ? `
    SELECT
      event_timestamp AS eventTimestamp,
      primary_used_percent AS primaryUsedPercent,
      primary_resets_at AS primaryResetsAt,
      secondary_used_percent AS secondaryUsedPercent,
      secondary_resets_at AS secondaryResetsAt
    FROM rate_limit_snapshots
    WHERE event_timestamp >= ?
    ORDER BY event_timestamp ASC, id ASC
  `
    : `
    SELECT
      event_timestamp AS eventTimestamp,
      primary_used_percent AS primaryUsedPercent,
      primary_resets_at AS primaryResetsAt,
      secondary_used_percent AS secondaryUsedPercent,
      secondary_resets_at AS secondaryResetsAt
    FROM rate_limit_snapshots
    ORDER BY event_timestamp ASC, id ASC
  `;
  const points = since ? db.prepare(pointsQuery).all(since) : db.prepare(pointsQuery).all();

  const dailyQuery = since
    ? `
    SELECT
      substr(event_timestamp, 1, 10) AS day,
      max(primary_used_percent) AS primaryMax,
      max(secondary_used_percent) AS secondaryMax,
      count(*) AS sampleCount
    FROM rate_limit_snapshots
    WHERE event_timestamp >= ?
    GROUP BY substr(event_timestamp, 1, 10)
    ORDER BY day ASC
  `
    : `
    SELECT
      substr(event_timestamp, 1, 10) AS day,
      max(primary_used_percent) AS primaryMax,
      max(secondary_used_percent) AS secondaryMax,
      count(*) AS sampleCount
    FROM rate_limit_snapshots
    GROUP BY substr(event_timestamp, 1, 10)
    ORDER BY day ASC
  `;
  const daily = since ? db.prepare(dailyQuery).all(since) : db.prepare(dailyQuery).all();

  const totals = db.prepare(`
    SELECT count(*) AS snapshotCount FROM rate_limit_snapshots
  `).get();

  const lastScan = db.prepare(`
    SELECT
      scanned_at AS scannedAt,
      files_seen AS filesSeen,
      lines_seen AS linesSeen,
      snapshots_seen AS snapshotsSeen,
      inserted_count AS insertedCount,
      skipped_count AS skippedCount,
      error_count AS errorCount
    FROM scan_runs
    ORDER BY scanned_at DESC, id DESC
    LIMIT 1
  `).get();

  return {
    days: isAll ? "all" : range === "24h" ? "24h" : Math.round(windowMs / 24 / 60 / 60 / 1000),
    generatedAt: new Date().toISOString(),
    latest: latest || null,
    points,
    daily,
    totals,
    lastScan: lastScan || null,
  };
}
