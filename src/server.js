import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { getConfig } from "./config.js";
import { getSummary, openDatabase } from "./db.js";
import { scanSessions } from "./scanner.js";

const config = getConfig();
const db = openDatabase(config);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function sendNotFound(response) {
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(config.publicDir, safePath));

  const relativePath = path.relative(config.publicDir, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    sendNotFound(response);
    return;
  }

  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      sendNotFound(response);
      return;
    }
    response.writeHead(200, {
      "content-type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(buffer);
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/summary") {
    sendJson(response, 200, getSummary(db, url.searchParams.get("days")));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/scan") {
    try {
      const result = await scanSessions(config, db);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message });
    }
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    serveStatic(request, response);
    return;
  }

  response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
  response.end("Method not allowed");
}

await scanSessions(config, db);

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(response, 500, { ok: false, message: error.message });
  });
});

server.listen(config.port, "127.0.0.1", () => {
  console.log(`Codex Rate Dashboard: http://127.0.0.1:${config.port}`);
});

process.on("SIGINT", () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
