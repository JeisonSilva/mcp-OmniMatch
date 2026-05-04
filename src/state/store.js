/**
 * ContextStore — the single source of truth for mcp-OmniMatch.
 *
 * Persists all extracted schemas in a local SQLite database so state survives
 * server restarts. The database file path is resolved from the environment
 * variable OMNIMATCH_DB_PATH, defaulting to <project-root>/data/omnimatch.db.
 *
 * Public API is intentionally synchronous (better-sqlite3 is sync) so callers
 * do not need to await anything.
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");

const dbPath = process.env.OMNIMATCH_DB_PATH
  ? resolve(process.env.OMNIMATCH_DB_PATH)
  : resolve(PROJECT_ROOT, "data", "omnimatch.db");

// Ensure the data directory exists before opening the database.
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance.
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS frontend_schemas (
    screen_id  TEXT PRIMARY KEY,
    fields     TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS backend_schemas (
    controller_id TEXT PRIMARY KEY,
    routes        TEXT NOT NULL,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const stmts = {
  upsertFrontend: db.prepare(`
    INSERT INTO frontend_schemas (screen_id, fields, updated_at)
    VALUES (@screen_id, @fields, datetime('now'))
    ON CONFLICT(screen_id) DO UPDATE SET
      fields     = excluded.fields,
      updated_at = excluded.updated_at
  `),

  upsertBackend: db.prepare(`
    INSERT INTO backend_schemas (controller_id, routes, updated_at)
    VALUES (@controller_id, @routes, datetime('now'))
    ON CONFLICT(controller_id) DO UPDATE SET
      routes     = excluded.routes,
      updated_at = excluded.updated_at
  `),

  allFrontend: db.prepare(`SELECT screen_id, fields FROM frontend_schemas`),
  allBackend:  db.prepare(`SELECT controller_id, routes FROM backend_schemas`),

  clearFrontend: db.prepare(`DELETE FROM frontend_schemas`),
  clearBackend:  db.prepare(`DELETE FROM backend_schemas`),
};

export function upsertFrontend(screenId, elements) {
  stmts.upsertFrontend.run({
    screen_id: screenId,
    fields: JSON.stringify(elements),
  });
}

export function upsertBackend(controllerId, routes) {
  stmts.upsertBackend.run({
    controller_id: controllerId,
    routes: JSON.stringify(routes),
  });
}

export function getFullContext() {
  const frontend_map = Object.fromEntries(
    stmts.allFrontend.all().map((row) => [
      row.screen_id,
      { screen_name: row.screen_id, fields: JSON.parse(row.fields) },
    ])
  );

  const backend_map = Object.fromEntries(
    stmts.allBackend.all().map((row) => [
      row.controller_id,
      { controller: row.controller_id, endpoints: JSON.parse(row.routes) },
    ])
  );

  return { frontend_map, backend_map };
}

export function clearContext() {
  const clear = db.transaction(() => {
    stmts.clearFrontend.run();
    stmts.clearBackend.run();
  });
  clear();
}
