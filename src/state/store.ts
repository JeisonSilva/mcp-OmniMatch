/**
 * ContextStore — the single source of truth for mcp-OmniMatch.
 *
 * Persists all extracted schemas in a local SQLite database so state survives
 * server restarts. The database file path is resolved from the environment
 * variable OMNIMATCH_DB_PATH, defaulting to <project-root>/data/omnimatch.db.
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Shared domain types ────────────────────────────────────────────────────

export interface FrontendField {
  name: string;
  type: string;
  action?: string;
}

export interface BackendRoute {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  request?: Record<string, string>;
  response?: Record<string, string>;
  statusCodes?: number[];
}

export interface FrontendSchema {
  screen_name: string;
  fields: FrontendField[];
}

export interface BackendSchema {
  controller: string;
  endpoints: BackendRoute[];
}

export interface FullContext {
  frontend_map: Record<string, FrontendSchema>;
  backend_map: Record<string, BackendSchema>;
}

// ── Database setup ─────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");

const dbPath = process.env.OMNIMATCH_DB_PATH
  ? resolve(process.env.OMNIMATCH_DB_PATH)
  : resolve(PROJECT_ROOT, "data", "omnimatch.db");

const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

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

// ── Prepared statements ────────────────────────────────────────────────────

const stmts = {
  upsertFrontend: db.prepare<{ screen_id: string; fields: string }>(`
    INSERT INTO frontend_schemas (screen_id, fields, updated_at)
    VALUES (@screen_id, @fields, datetime('now'))
    ON CONFLICT(screen_id) DO UPDATE SET
      fields     = excluded.fields,
      updated_at = excluded.updated_at
  `),

  upsertBackend: db.prepare<{ controller_id: string; routes: string }>(`
    INSERT INTO backend_schemas (controller_id, routes, updated_at)
    VALUES (@controller_id, @routes, datetime('now'))
    ON CONFLICT(controller_id) DO UPDATE SET
      routes     = excluded.routes,
      updated_at = excluded.updated_at
  `),

  allFrontend: db.prepare<[], { screen_id: string; fields: string }>(
    `SELECT screen_id, fields FROM frontend_schemas`
  ),

  allBackend: db.prepare<[], { controller_id: string; routes: string }>(
    `SELECT controller_id, routes FROM backend_schemas`
  ),

  clearFrontend: db.prepare(`DELETE FROM frontend_schemas`),
  clearBackend: db.prepare(`DELETE FROM backend_schemas`),
};

// ── Public API ─────────────────────────────────────────────────────────────

export function upsertFrontend(screenId: string, elements: FrontendField[]): void {
  stmts.upsertFrontend.run({ screen_id: screenId, fields: JSON.stringify(elements) });
}

export function upsertBackend(controllerId: string, routes: BackendRoute[]): void {
  stmts.upsertBackend.run({ controller_id: controllerId, routes: JSON.stringify(routes) });
}

export function getFullContext(): FullContext {
  const frontend_map: FullContext["frontend_map"] = Object.fromEntries(
    stmts.allFrontend.all().map((row) => [
      row.screen_id,
      { screen_name: row.screen_id, fields: JSON.parse(row.fields) as FrontendField[] },
    ])
  );

  const backend_map: FullContext["backend_map"] = Object.fromEntries(
    stmts.allBackend.all().map((row) => [
      row.controller_id,
      { controller: row.controller_id, endpoints: JSON.parse(row.routes) as BackendRoute[] },
    ])
  );

  return { frontend_map, backend_map };
}

export function clearContext(): void {
  const clear = db.transaction(() => {
    stmts.clearFrontend.run();
    stmts.clearBackend.run();
  });
  clear();
}
