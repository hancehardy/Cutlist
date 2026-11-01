import 'server-only';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { type JobDoc, type JobStatus, type JobSummary, normalizeJobDoc, sampleJob } from './job';
import { type ShopConfig, defaultShopConfig, normalizeShopConfig } from './shop';

const DB_PATH = process.env.CUTLIST_DB || path.join(process.cwd(), 'data', 'cutlist.db');

// Bump when a table is added so a connection kept alive across dev hot reloads picks it up.
const SCHEMA = 5;
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
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
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
  // Jobs gained an owner when accounts arrived; jobs from before have none until the first admin claims them.
  const cols = (conn.prepare('PRAGMA table_info(jobs)').all() as { name: string }[]).map(c => c.name);
  if (!cols.includes('owner_id')) conn.exec('ALTER TABLE jobs ADD COLUMN owner_id TEXT');
  // Order flow: draft while being entered, submitted to the shop, received by the shop.
  if (!cols.includes('status')) conn.exec("ALTER TABLE jobs ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'");
  if (!cols.includes('submitted_at')) conn.exec('ALTER TABLE jobs ADD COLUMN submitted_at TEXT');
  if (!cols.includes('received_at')) conn.exec('ALTER TABLE jobs ADD COLUMN received_at TEXT');
  if (!cols.includes('completed_at')) conn.exec('ALTER TABLE jobs ADD COLUMN completed_at TEXT');
  conn.exec('CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(owner_id)');
  conn.exec('CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status)');
  g.__cutlistDb = conn;
  g.__cutlistSchema = SCHEMA;
  const { n } = conn.prepare('SELECT COUNT(*) AS n FROM jobs').get() as { n: number };
  if (n === 0) createJob(sampleJob());
  return conn;
}

type Row = { id: string; name: string; client: string; data: string; updated_at: string; owner_id: string | null; status: JobStatus; submitted_at: string | null; received_at: string | null; completed_at: string | null };

// ---- Accounts and sessions

export type Role = 'admin' | 'user';
export interface User { id: string; username: string; role: Role; createdAt: string }
/** Who is asking: users see their own jobs, admins see every job. */
export type Viewer = Pick<User, 'id' | 'role'>;
type UserRow = { id: string; username: string; role: Role; created_at: string; password?: string };
const toUser = (r: UserRow): User => ({ id: r.id, username: r.username, role: r.role, createdAt: r.created_at });

export function countUsers(): number {
  return (db().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
}
export function listUsers(): User[] {
  return (db().prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at').all() as UserRow[]).map(toUser);
}
export function getUser(id: string): User | null {
  const r = db().prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return r ? toUser(r) : null;
}
/** The user and their password hash, for login. Usernames match case-insensitively. */
export function findUserWithPassword(username: string): (User & { password: string }) | null {
  const r = db().prepare('SELECT id, username, role, created_at, password FROM users WHERE username = ?').get(username.trim()) as UserRow | undefined;
  return r ? { ...toUser(r), password: r.password! } : null;
}
export function createUser(username: string, passwordHash: string, role: Role): User {
  const id = randomUUID(), now = new Date().toISOString();
  db().prepare('INSERT INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)').run(id, username.trim(), passwordHash, role, now);
  return { id, username: username.trim(), role, createdAt: now };
}
export function setUserRole(id: string, role: Role): boolean {
  return db().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id).changes > 0;
}
export function setUserPassword(id: string, passwordHash: string): boolean {
  return db().prepare('UPDATE users SET password = ? WHERE id = ?').run(passwordHash, id).changes > 0;
}
/** Delete a user, handing their jobs to `reassignTo` and ending their sessions. */
export function deleteUser(id: string, reassignTo: string): boolean {
  const conn = db();
  const run = conn.transaction(() => {
    conn.prepare('UPDATE jobs SET owner_id = ? WHERE owner_id = ?').run(reassignTo, id);
    conn.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    return conn.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
  });
  return run();
}
/** Jobs saved before accounts existed belong to the first admin. */
export function claimOrphanJobs(ownerId: string): number {
  return db().prepare('UPDATE jobs SET owner_id = ? WHERE owner_id IS NULL').run(ownerId).changes;
}

const SESSION_DAYS = 30;
export function createSession(userId: string): string {
  const token = randomUUID() + randomUUID().replace(/-/g, ''), now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  db().prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(token, userId, now.toISOString(), expires.toISOString());
  return token;
}
export function sessionUser(token: string): User | null {
  const r = db().prepare(`SELECT u.id, u.username, u.role, u.created_at, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`)
    .get(token) as (UserRow & { expires_at: string }) | undefined;
  if (!r) return null;
  if (r.expires_at < new Date().toISOString()) { deleteSession(token); return null; }
  return toUser(r);
}
export function deleteSession(token: string): void {
  db().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ---- Jobs

const ownerClause = (v?: Viewer | null) => (v && v.role !== 'admin' ? { sql: ' WHERE owner_id = ?', args: [v.id] } : { sql: '', args: [] as string[] });

export function listJobs(viewer?: Viewer | null): JobSummary[] {
  const c = ownerClause(viewer).sql.replace(' WHERE owner_id', ' WHERE j.owner_id');
  const rows = db().prepare(`
    SELECT j.id, j.name, j.client, j.created_at, j.updated_at, j.owner_id, j.status, j.submitted_at, j.received_at, j.completed_at, u.username AS owner,
      COALESCE(json_extract(j.data, '$.job.catalog'), '') AS catalog, COALESCE(json_array_length(j.data, '$.cabs'), 0) AS cabs
    FROM jobs j LEFT JOIN users u ON u.id = j.owner_id${c} ORDER BY j.updated_at DESC`).all(...ownerClause(viewer).args) as (Row & { created_at: string; owner: string | null; catalog: string; cabs: number })[];
  return rows.map(r => ({
    id: r.id, name: r.name, client: r.client, catalog: String(r.catalog ?? ''), cabs: Number(r.cabs) || 0,
    ownerId: r.owner_id, owner: r.owner, createdAt: r.created_at, updatedAt: r.updated_at,
    status: r.status ?? 'draft', submittedAt: r.submitted_at ?? null, receivedAt: r.received_at ?? null, completedAt: r.completed_at ?? null,
  }));
}

export function jobOwner(id: string): string | null | undefined {
  const r = db().prepare('SELECT owner_id FROM jobs WHERE id = ?').get(id) as { owner_id: string | null } | undefined;
  return r ? r.owner_id : undefined;
}

export interface JobRecord { id: string; doc: JobDoc; updatedAt: string; ownerId: string | null; status: JobStatus; submittedAt: string | null; receivedAt: string | null; completedAt: string | null }

/** A job, or null when it does not exist or the viewer may not see it. */
export function getJob(id: string, viewer?: Viewer | null): JobRecord | null {
  const r = db().prepare('SELECT id, data, updated_at, owner_id, status, submitted_at, received_at, completed_at FROM jobs WHERE id = ?').get(id) as Row | undefined;
  if (!r) return null;
  if (viewer && viewer.role !== 'admin' && r.owner_id !== viewer.id) return null;
  return {
    id: r.id, doc: normalizeJobDoc(JSON.parse(r.data), getShopConfig()), updatedAt: r.updated_at, ownerId: r.owner_id,
    status: r.status ?? 'draft', submittedAt: r.submitted_at ?? null, receivedAt: r.received_at ?? null, completedAt: r.completed_at ?? null,
  };
}

export function jobStatus(id: string): JobStatus | undefined {
  const r = db().prepare('SELECT status FROM jobs WHERE id = ?').get(id) as { status: JobStatus } | undefined;
  return r?.status ?? undefined;
}

export interface OrderStamp { status: JobStatus; submittedAt: string | null; receivedAt: string | null; completedAt: string | null }

/** Move an order along. Each step stamps its time; going back to draft clears every stamp. */
export function setJobStatus(id: string, status: JobStatus): OrderStamp | null {
  const now = new Date().toISOString();
  const conn = db();
  const res = status === 'draft'
    ? conn.prepare("UPDATE jobs SET status = 'draft', submitted_at = NULL, received_at = NULL, completed_at = NULL WHERE id = ?").run(id)
    : status === 'submitted'
      ? conn.prepare("UPDATE jobs SET status = 'submitted', submitted_at = ?, received_at = NULL, completed_at = NULL WHERE id = ?").run(now, id)
      : status === 'received'
        ? conn.prepare("UPDATE jobs SET status = 'received', submitted_at = COALESCE(submitted_at, ?), received_at = ?, completed_at = NULL WHERE id = ?").run(now, now, id)
        : conn.prepare("UPDATE jobs SET status = 'completed', submitted_at = COALESCE(submitted_at, ?), received_at = COALESCE(received_at, ?), completed_at = ? WHERE id = ?").run(now, now, now, id);
  if (!res.changes) return null;
  const r = conn.prepare('SELECT status, submitted_at, received_at, completed_at FROM jobs WHERE id = ?').get(id) as Pick<Row, 'status' | 'submitted_at' | 'received_at' | 'completed_at'>;
  return { status: r.status, submittedAt: r.submitted_at, receivedAt: r.received_at, completedAt: r.completed_at };
}

/** Orders submitted and not yet received: what the shop still has to pick up. */
export function countNewOrders(): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM jobs WHERE status = 'submitted'").get() as { n: number }).n;
}

/** True when the viewer may edit or delete the job (owner, or an admin). */
export function canEditJob(id: string, viewer: Viewer): boolean {
  const owner = jobOwner(id);
  return owner !== undefined && (viewer.role === 'admin' || owner === viewer.id);
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

export function createJob(doc: JobDoc, ownerId: string | null = null): { id: string; doc: JobDoc; updatedAt: string } {
  const id = randomUUID(), now = new Date().toISOString();
  db().prepare('INSERT INTO jobs (id, name, client, data, created_at, updated_at, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, doc.job.name, doc.job.client, JSON.stringify(doc), now, now, ownerId);
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
