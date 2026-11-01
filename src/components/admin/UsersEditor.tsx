'use client';
import { useState } from 'react';
import type { Role, User } from '@/lib/db';

const pill = 'rounded-full border border-rule bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-rule';

/** The Users tab: every account, its role, a password reset and delete. Changes go straight to /api/users. */
export function UsersEditor({ initial, me }: { initial: User[]; me: { id: string } }) {
  const [users, setUsers] = useState(initial);
  const [pw, setPw] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ id: string; text: string; bad?: boolean } | null>(null);
  const admins = users.filter(u => u.role === 'admin').length;

  const patch = async (id: string, body: object, ok: string) => {
    const res = await fetch(`/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ id, text: data.error || 'Could not save.', bad: true }); return; }
    setUsers(us => us.map(u => (u.id === id ? data.user : u)));
    setMsg({ id, text: ok });
  };
  const remove = async (u: User) => {
    if (!window.confirm(`Delete ${u.username}? Their jobs move to you.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (!res.ok) { const data = await res.json().catch(() => ({})); setMsg({ id: u.id, text: data.error || 'Could not delete.', bad: true }); return; }
    setUsers(us => us.filter(x => x.id !== u.id));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] text-muted">
        Anyone can create an account from the sign-in page; users see only their own jobs, admins see every job and this page. The shop keeps at least one admin.
      </div>
      <div className="card flex flex-col gap-2 px-[18px] py-4">
        <div className="grid items-center gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: 'minmax(140px,1.4fr) 110px minmax(180px,1.6fr) 90px' }}>
          {['User', 'Role', 'New password', ''].map((h, i) => <div key={i} className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">{h}</div>)}
          {users.map(u => (
            <div key={u.id} className="contents">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{u.username}{u.id === me.id ? <span className="ml-1.5 text-[11px] font-normal text-muted">(you)</span> : null}</div>
                <div className="text-[11px] text-muted">since {new Date(u.createdAt).toLocaleDateString()}</div>
              </div>
              <select value={u.role} onChange={e => patch(u.id, { role: e.target.value as Role }, 'Role saved')} disabled={u.role === 'admin' && admins < 2}
                title={u.role === 'admin' && admins < 2 ? 'The shop needs at least one admin' : ''} className="field px-1.5 py-1.5 text-[13px] text-ink" aria-label={`${u.username} role`}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <form className="flex items-center gap-1.5" onSubmit={e => { e.preventDefault(); const v = pw[u.id] ?? ''; patch(u.id, { password: v }, 'Password changed').then(() => setPw(p => ({ ...p, [u.id]: '' }))); }}>
                <input type="password" value={pw[u.id] ?? ''} onChange={e => setPw(p => ({ ...p, [u.id]: e.target.value }))} placeholder="At least 8 characters" autoComplete="new-password"
                  className="field min-w-0 flex-1 px-2 py-1.5 text-[13px] text-ink" aria-label={`New password for ${u.username}`} />
                <button type="submit" disabled={(pw[u.id] ?? '').length < 8} className={pill}>Set</button>
              </form>
              <button onClick={() => remove(u)} disabled={u.id === me.id} className={`${pill} hover:text-danger`}>Delete</button>
              {msg?.id === u.id && <div className={`col-span-full -mt-1 text-xs ${msg.bad ? 'text-danger' : 'text-muted'}`}>{msg.text}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
