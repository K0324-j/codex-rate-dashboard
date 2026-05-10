import { getConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { scanSessions } from "./scanner.js";

const config = getConfig();
const db = openDatabase(config);

try {
  const result = await scanSessions(config, db);
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        filesSeen: result.filesSeen,
        linesSeen: result.linesSeen,
        snapshotsSeen: result.snapshotsSeen,
        insertedCount: result.insertedCount,
        skippedCount: result.skippedCount,
        errorCount: result.errorCount,
        message: result.message,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
