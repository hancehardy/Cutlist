'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JobSummary } from '@/lib/job';
import { UserMenu, type Me } from './auth/UserMenu';

interface Totals { jobs: number; users: number; materials: number; methods: number; boxes: number; newOrders: number }
const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const tile = 'card flex flex-col gap-1 px-5 py-4 text-left text-ink hover:border-ink hover:no-underline';

/** The signed-in landing page. */
export function Home({ me, recent, totals }: { me: Me & { id: string }; recent: JobSummary[]; totals: Totals }) {
  const router = useRouter();
  const admin = me.role === 'admin';
  const [busy, setBusy] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const last = recent[0];

  const newJob = async () => {
    setBusy(true);
    const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) router.push(`/job/${data.id}`);
  };

  return (
    <div className="box-border flex min-h-screen flex-col gap-5 p-5">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
        <div className="flex items-center gap-3">
          <img src="/assets/logo-mark.png" alt="" className="h-[34px] w-[34px] object-contain" />
          <div className="text-[22px] font-extrabold tracking-[-0.01em]">Cutlist</div>
          <UserMenu user={me} home />
        </div>

        <div className="flex flex-col gap-1">
          <div className="eyebrow">{admin ? 'Shop admin' : 'Welcome'}</div>
          <div className="text-2xl font-extrabold tracking-[-0.01em]">{greeting}, {me.username}</div>
          <div className="text-sm text-ink-3">
            {last ? <>Your last job was <Link href={`/job/${last.id}`} className="font-bold">{last.name || 'Untitled job'}</Link>, updated {day.format(new Date(last.updatedAt))}.</> : 'Start your first job below.'}
          </div>
        </div>

        {admin && totals.newOrders > 0 && (
          <Link href="/jobs?status=submitted" className="flex items-center gap-3 rounded-xl border-2 border-accent bg-sel px-[18px] py-3 text-ink hover:no-underline">
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-extrabold text-white">{totals.newOrders}</span>
            <span className="text-[14px] font-bold">new order{totals.newOrders === 1 ? '' : 's'} submitted and waiting to be received</span>
            <span className="ml-auto text-[13px] font-bold text-link">Open →</span>
          </Link>
        )}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
          <button onClick={newJob} disabled={busy} className={`${tile} border-2 border-accent bg-sel disabled:opacity-60`}>
            <div className="text-base font-extrabold">New job</div>
            <div className="text-[13px] text-ink-3">Set up a job and start entering cabinets.</div>
          </button>
          {last && (
            <Link href={`/job/${last.id}`} className={tile}>
              <div className="text-base font-extrabold">Continue {last.name || 'Untitled job'}</div>
              <div className="text-[13px] text-ink-3">{last.cabs} line{last.cabs === 1 ? '' : 's'}{last.client ? ` · ${last.client}` : ''}</div>
            </Link>
          )}
          <Link href="/jobs" className={tile}>
            <div className="text-base font-extrabold">Job history</div>
            <div className="text-[13px] text-ink-3">{admin ? `${totals.jobs} job${totals.jobs === 1 ? '' : 's'} across the shop, by user.` : `${totals.jobs} job${totals.jobs === 1 ? '' : 's'}, searchable.`}</div>
          </Link>
          {admin && (
            <Link href="/admin" className={tile}>
              <div className="text-base font-extrabold">Admin</div>
              <div className="text-[13px] text-ink-3">{totals.materials} materials · {totals.methods} method{totals.methods === 1 ? '' : 's'} · {totals.boxes} boxes · {totals.users} user{totals.users === 1 ? '' : 's'}</div>
            </Link>
          )}
        </div>

        <div className="card flex flex-col gap-2 px-[18px] py-4">
          <div className="flex items-baseline gap-2.5">
            <div className="text-base font-bold">Recent jobs</div>
            <Link href="/jobs" className="ml-auto text-[13px] font-bold">All jobs →</Link>
          </div>
          {recent.length === 0 && <div className="rounded-lg bg-canvas px-4 py-6 text-center text-sm text-muted">No jobs yet.</div>}
          <div className="grid items-center gap-x-3" style={{ gridTemplateColumns: `minmax(180px,2fr) minmax(100px,1fr) ${admin ? 'minmax(100px,1fr) ' : ''}70px 90px` }}>
            {recent.map(j => (
              <div key={j.id} className="contents">
                <Link href={`/job/${j.id}`} className="td min-w-0 text-ink hover:text-ink">
                  <div className="truncate text-[14px] font-bold">{j.name || 'Untitled job'}</div>
                  {j.client && <div className="truncate text-xs text-muted">{j.client}</div>}
                </Link>
                <div className="td truncate text-[13px] text-ink-3">{j.catalog}</div>
                {admin && <div className="td truncate text-[13px] text-ink-3">{j.owner ?? <span className="text-faint">no owner</span>}</div>}
                <div className="td text-[13px] text-ink-3 tabular-nums">{j.cabs} line{j.cabs === 1 ? '' : 's'}</div>
                <div className="td text-right text-[13px] text-ink-3 tabular-nums">{day.format(new Date(j.updatedAt))}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
