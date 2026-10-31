import 'server-only';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { type JobDoc, type JobSummary, normalizeJobDoc, sampleJob } from './job';
import { type ShopConfig, defaultShopConfig, normalizeShopConfig } from './shop';

const DB_PATH = process.env.CUTLIST_DB || path.join(process.cwd(), 'data', 'cutlist.db');

// Bump when a table is added so a connection kept alive across dev hot reloads picks it up.
const SCHEMA = 2;
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    client TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`;

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __cutlistDb?: Database.Database; __cutlistSchema?: number };

function db() {
  if (g.__cutlistDb && g.__cutlistSchema === SCHEMA) return g.__cutlistDb;
  let conn = g.__cutlistDb;
  if (!conn) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    conn = new Database(DB_PATH);
    conn.pragma('journal_mode = WAL');
  }
  conn.exec(SCHEMA_SQL);
  g.__cutlistDb = conn;
  g.__cutlistSchema = SCHEMA;
  const { n } = conn.prepare('SELECT COUNT(*) AS n FROM jobs').get() as { n: number };
  if (n === 0) createJob(sampleJob());
  return conn;
}

type Row = { id: string; name: string; client: string; data: string; updated_at: string };

export function listJobs(): JobSummary[] {
  const rows = db().prepare('SELECT id, name, client, updated_at FROM jobs ORDER BY updated_at DESC').all() as Row[];
  return rows.map(r => ({ id: r.id, name: r.name, client: r.client, updatedAt: r.updated_at }));
}

export function getJob(id: string): { id: string; doc: JobDoc; updatedAt: string } | null {
  const r = db().prepare('SELECT id, data, updated_at FROM jobs WHERE id = ?').get(id) as Row | undefined;
  if (!r) return null;
  return { id: r.id, doc: normalizeJobDoc(JSON.parse(r.data), getShopConfig()), updatedAt: r.updated_at };
}

const SHOP_KEY = 'shop';

/** Shop settings from the Admin page; the built-in defaults until they are first saved. */
export function getShopConfig(): ShopConfig {
  const r = db().prepare('SELECT data FROM settings WHERE key = ?').get(SHOP_KEY) as { data: string } | undefined;
  if (!r) return defaultShopConfig();
  try { return normalizeShopConfig(JSON.parse(r.data)); } catch { return defaultShopConfig(); }
}

export function saveShopConfig(doc: ShopConfig): string {
  const now = new Date().toISOString();
  db().prepare(`INSERT INTO settings (key, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
    .run(SHOP_KEY, JSON.stringify(doc), now);
  return now;
}

export function createJob(doc: JobDoc): { id: string; doc: JobDoc; updatedAt: string } {
  const id = randomUUID(), now = new Date().toISOString();
  db().prepare('INSERT INTO jobs (id, name, client, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, doc.job.name, doc.job.client, JSON.stringify(doc), now, now);
  return { id, doc, updatedAt: now };
}

export function updateJob(id: string, doc: JobDoc): string | null {
  const now = new Date().toISOString();
  const res = db().prepare('UPDATE jobs SET name = ?, client = ?, data = ?, updated_at = ? WHERE id = ?')
    .run(doc.job.name, doc.job.client, JSON.stringify(doc), now, id);
  return res.changes ? now : null;
}

export function deleteJob(id: string): boolean {
  return db().prepare('DELETE FROM jobs WHERE id = ?').run(id).changes > 0;
}
