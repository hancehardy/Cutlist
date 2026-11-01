'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { JobStatus } from '@/lib/job';

export interface OrderState { status: JobStatus; submittedAt: string | null; receivedAt: string | null; completedAt: string | null }
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const pill = 'rounded-full border border-rule bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-50';

/** Change an order's status through the API; resolves to the new state or an error message. */
export async function changeStatus(jobId: string, status: JobStatus): Promise<OrderState | string> {
  const res = await fetch(`/api/jobs/${jobId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  const data = await res.json().catch(() => ({}));
  return res.ok ? (data as OrderState) : (data.error as string) || 'Could not change the order.';
}

/**
 * The order bar on a job. Owners submit a finished order to the shop and can withdraw it until the shop
 * receives it; admins mark orders received, then completed, or reopen them. Anything past draft is read-only for its owner.
 */
export function OrderBar({ jobId, state, admin, onChange }: { jobId: string; state: OrderState; admin: boolean; onChange: (s: OrderState) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async (status: JobStatus, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setErr('');
    const r = await changeStatus(jobId, status);
    setBusy(false);
    if (typeof r === 'string') setErr(r); else onChange(r);
  };
  const tone = state.status === 'draft' ? 'border-line bg-white' : state.status === 'submitted' ? 'border-accent bg-sel' : state.status === 'completed' ? 'border-line bg-line-2' : 'border-line bg-canvas';
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-[18px] py-3 ${tone}`}>
      <div className="min-w-0 flex-1 text-[13px]">
        {state.status === 'draft' && <><span className="font-bold">Draft.</span> <span className="text-ink-3">When the order is complete, submit it to the shop.</span></>}
        {state.status === 'submitted' && <><span className="font-bold text-link">Submitted {when(state.submittedAt)}.</span> <span className="text-ink-3">{admin ? 'New order waiting to be received.' : 'Waiting for the shop. The order is read-only until you withdraw it.'}</span></>}
        {state.status === 'received' && <><span className="font-bold">Received by the shop {when(state.receivedAt)}.</span> <span className="text-ink-3">{admin ? 'Mark it completed once it is processed, or reopen it to let the owner edit again.' : 'In the shop. Ask an admin if something needs to change.'}</span></>}
        {state.status === 'completed' && <><span className="font-bold">Completed {when(state.completedAt)}.</span> <span className="text-ink-3">{admin ? 'Done. Reopen it if it must be revised.' : 'The shop has finished this order.'}</span></>}
        {err && <div className="mt-1 text-xs text-danger">{err}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {state.status === 'draft' && (
          <button onClick={() => go('submitted', 'Submit this order to the shop? You will not be able to edit it unless you withdraw it.')} disabled={busy}
            className="rounded-full border-none bg-accent px-4 py-[7px] text-[13px] font-bold text-white hover:bg-accent-dk disabled:opacity-60">Submit job</button>
        )}
        {state.status === 'submitted' && !admin && <button onClick={() => go('draft', 'Withdraw this order from the shop and go back to editing?')} disabled={busy} className={pill}>Withdraw</button>}
        {state.status === 'submitted' && admin && <button onClick={() => go('received')} disabled={busy} className="rounded-full border-none bg-accent px-4 py-[7px] text-[13px] font-bold text-white hover:bg-accent-dk disabled:opacity-60">Mark received</button>}
        {state.status === 'received' && admin && <button onClick={() => go('completed')} disabled={busy} className="rounded-full border-none bg-accent px-4 py-[7px] text-[13px] font-bold text-white hover:bg-accent-dk disabled:opacity-60">Mark completed</button>}
        {(state.status === 'received' || state.status === 'completed') && admin && <button onClick={() => go('draft', 'Reopen this order so its owner can edit it again?')} disabled={busy} className={pill}>Reopen</button>}
      </div>
    </div>
  );
}

/** Admin top-bar notice: how many submitted orders are waiting. Refreshes every minute. */
export function OrdersBadge() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => fetch('/api/orders').then(r => (r.ok ? r.json() : null)).then(d => { if (live && d) setCount(d.count); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { live = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  if (!count) return null;
  return (
    <Link href="/jobs?status=submitted" className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-extrabold text-white hover:bg-accent-dk hover:no-underline" title="Submitted orders waiting to be received">
      {count} new order{count === 1 ? '' : 's'}
    </Link>
  );
}
