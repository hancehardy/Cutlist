'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JobStatus, JobSummary } from '@/lib/job';
import { UserMenu, type Me } from './auth/UserMenu';
import { changeStatus } from './OrderStatus';

interface ShopCounts { users: number; materials: number; methods: number; boxes: number }
const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
const when = (iso: string | null) => (iso ? day.format(new Date(iso)) : '');
const tile = 'card flex flex-col gap-1.5 px-5 py-4 text-left text-ink hover:border-ink hover:no-underline';
const pill = 'rounded-full border border-rule bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-ink hover:no-underline';
const accentPill = 'rounded-full border-none bg-accent px-2.5 py-1 text-xs font-bold text-white hover:bg-accent-dk disabled:opacity-60';

const Icon = ({ d, round = false }: { d: string; round?: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] flex-none text-link" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {round && <circle cx="12" cy="12" r="3" />}<path d={d} />
  </svg>
);
const ICON = {
  plus: 'M12 5v14M5 12h14', play: 'M6 4l14 8-14 8z', list: 'M4 6h16M4 12h16M4 18h10', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', check: 'M20 6L9 17l-5-5',
  gear: 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};

/** A base cabinet elevation beside a cut sheet plan and a door list, drawn in the app's own style. */
function HeroArt() {
  return (
    <svg viewBox="0 0 360 230" className="block h-auto w-full" role="img" aria-label="A base cabinet elevation beside a cut sheet plan and a door list">
      <defs><pattern id="home-offcut" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 L6 0" stroke="var(--color-rule)" strokeWidth=".6" /></pattern></defs>
      <g transform="translate(14 14)">
        <rect width="150" height="165" fill="var(--color-canvas)" stroke="var(--color-ink)" strokeWidth="1.6" />
        <rect y="165" width="150" height="22" fill="var(--color-line)" stroke="var(--color-ink)" strokeWidth="1" />
        <rect x="5" y="5" width="140" height="30" fill="var(--color-drawer)" stroke="var(--color-ink)" strokeWidth="1" />
        <line x1="60" y1="20" x2="90" y2="20" stroke="var(--color-ink)" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="5" y="39" width="68" height="121" fill="#fff" stroke="var(--color-ink)" strokeWidth="1" />
        <rect x="77" y="39" width="68" height="121" fill="#fff" stroke="var(--color-ink)" strokeWidth="1" />
        <polyline points="73,39 5,99 73,160" fill="none" stroke="var(--color-faint)" strokeWidth=".8" strokeDasharray="4 3" />
        <polyline points="77,39 145,99 77,160" fill="none" stroke="var(--color-faint)" strokeWidth=".8" strokeDasharray="4 3" />
        <line x1="66" y1="46" x2="66" y2="66" stroke="var(--color-ink)" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="84" y1="46" x2="84" y2="66" stroke="var(--color-ink)" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="8" y1="100" x2="142" y2="100" stroke="var(--color-muted)" strokeWidth=".8" strokeDasharray="4 3" />
        <line x1="160" y1="0" x2="160" y2="165" stroke="var(--color-muted)" strokeWidth=".7" /><text x="166" y="86" fontSize="9" fontWeight="700" fill="var(--color-ink-3)">34½&quot;</text>
        <line x1="0" y1="200" x2="150" y2="200" stroke="var(--color-muted)" strokeWidth=".7" /><text x="75" y="212" fontSize="9" fontWeight="700" fill="var(--color-ink)" textAnchor="middle">30&quot;</text>
      </g>
      <g transform="translate(210 30)">
        <rect width="136" height="68" fill="#fff" stroke="var(--color-ink)" strokeWidth="1.2" />
        <rect x="4" y="4" width="54" height="26" fill="var(--color-drawer)" stroke="var(--color-link)" strokeWidth=".9" />
        <rect x="60" y="4" width="54" height="26" fill="var(--color-drawer)" stroke="var(--color-link)" strokeWidth=".9" />
        <rect x="4" y="33" width="80" height="14" fill="var(--color-sel)" stroke="var(--color-link)" strokeWidth=".9" />
        <rect x="86" y="33" width="28" height="14" fill="var(--color-sel)" stroke="var(--color-link)" strokeWidth=".9" />
        <rect x="4" y="50" width="110" height="12" fill="var(--color-sel)" stroke="var(--color-link)" strokeWidth=".9" />
        <rect x="116" y="4" width="16" height="58" fill="url(#home-offcut)" />
        <text y="84" fontSize="9" fontWeight="700" fill="var(--color-ink-3)">Sheet 1 of 3 · 49 x 97 · yield 78%</text>
      </g>
      <g transform="translate(210 128)" fontSize="9" fill="var(--color-ink-3)">
        <rect width="136" height="78" rx="6" fill="#fff" stroke="var(--color-line)" />
        <text x="10" y="16" fontWeight="800" fill="var(--color-ink)">Door List</text>
        <text x="10" y="32">4 × 14 7/8 x 29 13/16 · DR</text>
        <text x="10" y="46">2 × 14 7/8 x 11 11/16 · DF</text>
        <text x="10" y="60">1 × 14 7/8 x 6 3/16 · DF</text>
        <text x="10" y="72" fill="var(--color-muted)">slab, cut in shop · grain vertical</text>
      </g>
    </svg>
  );
}

function Stat({ n, label, tone = '' }: { n: number; label: string; tone?: string }) {
  return (
    <div className="border-r border-line-2 py-3 pr-6 last:border-none">
      <div className={`text-[26px] font-extrabold tracking-[-0.01em] ${tone}`}>{n}</div>
      <div className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">{label}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="card flex gap-3 px-[18px] py-4">
      <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-ink text-[13px] font-extrabold text-white">{n}</div>
      <div><div className="text-[14px] font-extrabold">{title}</div><div className="mt-0.5 text-[13px] leading-[1.45] text-ink-3">{children}</div></div>
    </div>
  );
}

/** The signed-in landing page. Users see their orders and where each stands; admins see the shop's queue. */
export function Home({ me, jobs: initial, shop }: { me: Me & { id: string }; jobs: JobSummary[]; shop: ShopCounts }) {
  const router = useRouter();
  const admin = me.role === 'admin';
  const [jobs, setJobs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const by = (s: JobStatus) => jobs.filter(j => j.status === s);
  const drafts = by('draft'), submitted = by('submitted'), received = by('received'), completed = by('completed');
  const last = drafts[0] ?? jobs[0];

  const newJob = async () => {
    setBusy(true);
    const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) router.push(`/job/${data.id}`);
  };
  const advance = async (j: JobSummary, status: JobStatus) => {
    const r = await changeStatus(j.id, status);
    if (typeof r !== 'string') setJobs(js => js.map(x => (x.id === j.id ? { ...x, ...r } : x)));
  };

  const orderRow = (j: JobSummary, right: React.ReactNode) => (
    <div key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-2 py-2 last:border-none">
      <Link href={`/job/${j.id}`} className="min-w-0 flex-1 text-ink hover:text-ink">
        <div className="truncate text-[14px] font-bold">{j.name || 'Untitled job'}</div>
        <div className="truncate text-xs text-muted">{[j.client, admin ? j.owner : null, `${j.cabs} line${j.cabs === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</div>
      </Link>
      {right}
    </div>
  );

  return (
    <div className="box-border flex min-h-screen flex-col gap-5 p-5">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
        <div className="flex items-center gap-3">
          <img src="/assets/logo-mark.png" alt="" className="h-[34px] w-[34px] object-contain" />
          <div className="text-[22px] font-extrabold tracking-[-0.01em]">Cutlist</div>
          <UserMenu user={me} home />
        </div>

        {/* Hero */}
        <section className="grid items-center gap-7 overflow-hidden rounded-2xl border border-line bg-[linear-gradient(135deg,#ffffff_0%,#EEF8FF_100%)] px-7 py-6" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
          <div>
            <div className="eyebrow">{admin ? 'Cabinet Cutlist · shop packets' : 'Cabinet Cutlist · order entry'}</div>
            <h1 className="mt-1.5 mb-2 text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em]">
              {admin ? 'From order to shop packet, in one pass.' : 'Enter the cabinets. Send the order. Track it here.'}
            </h1>
            <p className="m-0 max-w-[46ch] text-[15px] leading-[1.5] text-ink-3">
              {admin
                ? 'Orders come in from your users; the shop rules turn them into panel cut lists with grain and banding, door and drawer lists, assembly sheets, panel saw plans and sheet totals, ready to print.'
                : 'Pick the boxes, type the sizes and tune the faces. When the order is complete, submit it to the shop and follow it from received to completed. Your cabinet, door and drawer lists print any time.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button onClick={newJob} disabled={busy} className="rounded-full border-none bg-accent px-[18px] py-2.5 text-sm font-bold text-white hover:bg-accent-dk disabled:opacity-60">New job</button>
              {last && <Link href={`/job/${last.id}`} className="rounded-full border border-rule bg-white px-[18px] py-2.5 text-sm font-bold text-ink hover:border-ink hover:no-underline">Continue {last.name || 'Untitled job'}</Link>}
            </div>
          </div>
          <HeroArt />
        </section>

        <div className="eyebrow">{greeting}, {me.username}</div>

        {/* Admin: the queue */}
        {admin && submitted.length > 0 && (
          <div className="rounded-xl border-2 border-accent bg-sel px-[18px] py-3">
            <div className="flex items-baseline gap-2.5">
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-extrabold text-white">{submitted.length}</span>
              <div className="text-[15px] font-extrabold">new order{submitted.length === 1 ? '' : 's'} waiting to be received</div>
              <Link href="/jobs?status=submitted" className="ml-auto text-[13px] font-bold">All submitted →</Link>
            </div>
            <div className="mt-1">
              {submitted.slice(0, 5).map(j => orderRow(j, <>
                <span className="text-xs text-muted">submitted {when(j.submittedAt)}</span>
                <button onClick={() => advance(j, 'received')} className={accentPill}>Receive</button>
              </>))}
            </div>
          </div>
        )}

        {/* Action tiles */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
          <button onClick={newJob} disabled={busy} className={`${tile} border-2 border-accent bg-sel disabled:opacity-60`}>
            <div className="flex items-center gap-2 text-base font-extrabold"><Icon d={ICON.plus} />New job</div>
            <div className="text-[13px] text-ink-3">Set up a job and start entering cabinets.</div>
          </button>
          {last && (
            <Link href={`/job/${last.id}`} className={tile}>
              <div className="flex items-center gap-2 text-base font-extrabold"><Icon d={ICON.play} />Continue {last.name || 'Untitled job'}</div>
              <div className="text-[13px] text-ink-3">{last.status === 'draft' ? 'Still a draft' : last.status} · {last.cabs} line{last.cabs === 1 ? '' : 's'} · updated {when(last.updatedAt)}</div>
            </Link>
          )}
          <Link href="/jobs" className={tile}>
            <div className="flex items-center gap-2 text-base font-extrabold"><Icon d={ICON.list} />Job history</div>
            <div className="text-[13px] text-ink-3">{admin ? `${jobs.length} job${jobs.length === 1 ? '' : 's'} across the shop, by user and status.` : `${jobs.length} job${jobs.length === 1 ? '' : 's'}, searchable, with status.`}</div>
          </Link>
          {admin && (
            <Link href="/admin" className={tile}>
              <div className="flex items-center gap-2 text-base font-extrabold"><Icon d={ICON.gear} round />Admin</div>
              <div className="text-[13px] text-ink-3">{shop.materials} materials · {shop.methods} method{shop.methods === 1 ? '' : 's'} · {shop.boxes} boxes · {shop.users} user{shop.users === 1 ? '' : 's'}</div>
            </Link>
          )}
        </div>

        {/* Status strip */}
        <div className="card flex flex-wrap gap-x-6 px-[18px] py-1">
          <Stat n={drafts.length} label={admin ? 'Drafts' : 'Drafts to finish'} />
          <Stat n={submitted.length} label={admin ? 'New orders' : 'Submitted'} tone={submitted.length ? 'text-link' : ''} />
          <Stat n={received.length} label="In the shop" />
          <Stat n={completed.length} label="Completed" />
          {admin && <Stat n={jobs.length} label="All jobs" />}
        </div>

        {/* Orders by stage */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
          {!admin && (
            <div className="card flex flex-col px-[18px] py-3.5">
              <div className="flex items-baseline gap-2"><Icon d={ICON.send} /><div className="text-base font-bold">Drafts to finish and submit</div></div>
              {drafts.length === 0 && <div className="mt-2 rounded-lg bg-canvas px-4 py-5 text-center text-sm text-muted">Nothing waiting on you.</div>}
              {drafts.slice(0, 6).map(j => orderRow(j, <Link href={`/job/${j.id}`} className={pill}>Open</Link>))}
            </div>
          )}
          <div className="card flex flex-col px-[18px] py-3.5">
            <div className="flex items-baseline gap-2"><Icon d={ICON.check} /><div className="text-base font-bold">{admin ? 'In the shop' : 'Submitted and in the shop'}</div></div>
            {[...(admin ? [] : submitted), ...received].length === 0 && <div className="mt-2 rounded-lg bg-canvas px-4 py-5 text-center text-sm text-muted">{admin ? 'No received orders being built.' : 'No orders with the shop right now.'}</div>}
            {!admin && submitted.slice(0, 6).map(j => orderRow(j, <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-white">Submitted {when(j.submittedAt)}</span>))}
            {received.slice(0, 6).map(j => orderRow(j, <>
              <span className="text-xs text-muted">received {when(j.receivedAt)}</span>
              {admin && <button onClick={() => advance(j, 'completed')} className={pill}>Complete</button>}
            </>))}
          </div>
          <div className="card flex flex-col px-[18px] py-3.5">
            <div className="flex items-baseline gap-2"><div className="text-base font-bold">Completed</div><Link href="/jobs?status=completed" className="ml-auto text-[13px] font-bold">All →</Link></div>
            {completed.length === 0 && <div className="mt-2 rounded-lg bg-canvas px-4 py-5 text-center text-sm text-muted">Nothing completed yet.</div>}
            {completed.slice(0, 6).map(j => orderRow(j, <span className="text-xs text-muted">✓ {when(j.completedAt)}</span>))}
          </div>
        </div>

        {/* How it works */}
        <div>
          <div className="eyebrow mb-2">How it works</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {admin ? (
              <>
                <Step n={1} title="Set the shop up">Materials, construction methods, front styles, hardware and the cabinet boxes live under Admin. Users pick from them on every job.</Step>
                <Step n={2} title="Orders come in">Users enter cabinets and accessories and press Submit. New orders show here and in the top bar until you receive them.</Step>
                <Step n={3} title="Build and complete">Print the cut list, door and drawer lists, assembly sheets, saw plans and sheet totals, then mark the order completed.</Step>
              </>
            ) : (
              <>
                <Step n={1} title="Set up the job">Choose the construction method, the materials, the door and drawer front styles and the hardware. Shop defaults are already filled in.</Step>
                <Step n={2} title="Enter the cabinets">One line per cabinet or accessory: pick a box, type the size, tune faces, shelves and roll-outs. Duplicate a row for repeats.</Step>
                <Step n={3} title="Submit to the shop">Press Submit job when the order is complete. It locks while the shop has it; withdraw it to change anything before it is received.</Step>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pb-5 text-xs text-muted">
          <span>Built for frameless, full-overlay construction.</span>
          {admin ? <span>Shop rules, materials and boxes live in Admin.</span> : <span>Your cabinet, door and drawer lists print any time from the job.</span>}
          <span>Reports print one per page.</span>
        </div>
      </div>
    </div>
  );
}
