import 'server-only';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { type JobDoc, type JobSummary, normalizeJobDoc, sampleJob } from './job';

const DB_PATH = process.env.CUTLIST_DB || path.join(process.cwd(), 'data', 'cutlist.db');

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __cutlistDb?: Database.Database };

function db() {
  if (g.__cutlistDb) return g.__cutlistDb;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma('journal_mode = WAL');
  conn.exec(`CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    client TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  const { n } = conn.prepare('SELECT COUNT(*) AS n FROM jobs').get() as { n: number };
  g.__cutlistDb = conn;
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
  return { id: r.id, doc: normalizeJobDoc(JSON.parse(r.data)), updatedAt: r.updated_at };
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
