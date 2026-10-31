'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JobSummary } from '@/lib/job';
import { UserMenu, type Me } from './auth/UserMenu';

interface UserRow { id: string; username: string; role: 'admin' | 'user' }
const UNOWNED = '__none__';
const pill = 'rounded-full border px-3 py-1.5 text-[13px] font-bold';
// UTC so the server and the browser render the same text.
const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const when = (iso: string) => day.format(new Date(iso));

/** The job history page. Admins get a per-user breakdown; everyone gets search, open, new and delete. */
export function JobList({ initial, users, me }: { initial: JobSummary[]; users: UserRow[]; me: Me & { id: string } }) {
  const router = useRouter();
  const admin = me.role === 'admin';
  const [jobs, setJobs] = useState(initial);
  const [q, setQ] = useState('');
  const [who, setWho] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) { const k = j.ownerId ?? UNOWNED; m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }, [jobs]);
  const unowned = counts.get(UNOWNED) ?? 0;
  const needle = q.trim().toLowerCase();
  const rows = jobs.filter(j =>
    (who === 'all' || (who === UNOWNED ? !j.ownerId : j.ownerId === who)) &&
    (!needle || [j.name, j.client, j.catalog, j.owner ?? ''].some(s => s.toLowerCase().includes(needle))));

  const create = async (body: object) => {
    setBusy(true); setErr('');
    const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) router.push(`/?job=${data.id}`); else setErr(data.error || 'Could not create the job.');
  };
  const importJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files?.[0];
    e.target.value = '';
    if (!fl) return;
    try { await create({ doc: JSON.parse(await fl.text()) }); }
    catch { setErr(`${fl.name} is not a valid job file.`); }
  };
  const remove = async (j: JobSummary) => {
    if (!window.confirm(`Delete "${j.name || 'Untitled job'}"? This can't be undone.`)) return;
    const res = await fetch(`/api/jobs/${j.id}`, { method: 'DELETE' });
    if (res.ok) setJobs(js => js.filter(x => x.id !== j.id));
  };

  const chip = (key: string, label: string, n: number) => (
    <button key={key} onClick={() => setWho(key)} className={`${pill} ${who === key ? 'border-ink bg-ink text-white' : 'border-rule bg-white text-ink hover:border-ink'}`}>
      {label} <span className={`text-[11px] font-semibold ${who === key ? 'text-white/70' : 'text-muted'}`}>{n}</span>
    </button>
  );

  return (
    <div className="box-border flex min-h-screen flex-col gap-5 p-5">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
        <div className="flex items-center gap-3">
          <img src="/assets/logo-mark.png" alt="" className="h-[34px] w-[34px] object-contain" />
          <div className="text-[22px] font-extrabold tracking-[-0.01em]">Cutlist</div>
          <UserMenu user={me} />
          <Link href="/" className="text-[13px] font-bold">← Current job</Link>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <div className="eyebrow">{admin ? 'All users' : me.username}</div>
            <div className="text-2xl font-extrabold tracking-[-0.01em]">Job history</div>
            <div className="text-sm text-ink-3">{admin ? 'Every job in the shop, by user. Open one to work on it.' : 'Your jobs, newest first. Open one to work on it.'}</div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button onClick={() => create({ sample: true })} disabled={busy} className={`${pill} border-rule bg-white text-ink hover:border-ink disabled:opacity-60`}>New from sample</button>
            <button onClick={() => file.current?.click()} disabled={busy} className={`${pill} border-rule bg-white text-ink hover:border-ink disabled:opacity-60`}>Import .json</button>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={importJson} />
            <button onClick={() => create({})} disabled={busy} className="rounded-full border-none bg-accent px-4 py-[9px] text-sm font-bold text-white hover:bg-accent-dk disabled:opacity-60">New job</button>
          </div>
        </div>
        {err && <div className="rounded-lg bg-err-bg px-3 py-2 text-xs text-err">{err}</div>}

        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={admin ? 'Search job, client, catalog or user…' : 'Search job, client or catalog…'} aria-label="Search jobs"
            className="field min-w-[220px] flex-1 px-3 py-2 text-sm text-ink" />
          {admin && (
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by user">
              {chip('all', 'All', jobs.length)}
              {users.map(u => chip(u.id, u.username, counts.get(u.id) ?? 0))}
              {unowned > 0 && chip(UNOWNED, 'No owner', unowned)}
            </div>
          )}
        </div>

        <div className="card overflow-x-auto px-[18px] py-3">
          <div className="grid items-center gap-x-3 gap-y-0" style={{ gridTemplateColumns: `minmax(180px,2fr) minmax(110px,1fr) 70px ${admin ? 'minmax(100px,1fr) ' : ''}100px 100px 110px` }}>
            {['Job', 'Catalog', 'Cabs', ...(admin ? ['User'] : []), 'Updated', 'Created', ''].map((h, i) => <div key={i} className="th py-2">{h}</div>)}
            {rows.map(j => (
              <div key={j.id} className="contents">
                <Link href={`/?job=${j.id}`} className="td min-w-0 text-ink hover:text-ink">
                  <div className="truncate text-[14px] font-bold">{j.name || 'Untitled job'}</div>
                  {j.client && <div className="truncate text-xs text-muted">{j.client}</div>}
                </Link>
                <div className="td truncate text-[13px] text-ink-3">{j.catalog}</div>
                <div className="td text-[13px] tabular-nums">{j.cabs}</div>
                {admin && <div className="td truncate text-[13px] text-ink-3">{j.owner ?? <span className="text-faint">no owner</span>}</div>}
                <div className="td text-[13px] text-ink-3 tabular-nums">{when(j.updatedAt)}</div>
                <div className="td text-[13px] text-ink-3 tabular-nums">{when(j.createdAt)}</div>
                <div className="td flex items-center justify-end gap-1">
                  <Link href={`/?job=${j.id}`} className="rounded-full border border-rule bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-ink hover:no-underline">Open</Link>
                  <button onClick={() => remove(j)} title="Delete job" className="h-7 w-7 rounded-md border-none bg-transparent text-base text-faint hover:bg-canvas hover:text-danger">×</button>
                </div>
              </div>
            ))}
          </div>
          {rows.length === 0 && (
            <div className="rounded-lg bg-canvas px-4 py-8 text-center text-sm text-muted">
              {jobs.length === 0 ? 'No jobs yet.' : 'No jobs match.'}
            </div>
          )}
        </div>
        <div className="text-xs text-muted">{rows.length} of {jobs.length} job{jobs.length === 1 ? '' : 's'}</div>
      </div>
    </div>
  );
}
