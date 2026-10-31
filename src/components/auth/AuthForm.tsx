'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const label = 'flex flex-col gap-1 text-[11px] font-bold tracking-[0.14em] text-muted uppercase';
const input = 'field px-2.5 py-2 text-[15px] tracking-normal text-ink normal-case';

/** Sign-in and sign-up card. `first` means no account exists yet, so this sign-up creates the admin. */
export function AuthForm({ mode, first = false }: { mode: 'login' | 'signup'; first?: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const signup = mode === 'signup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signup && password !== confirm) { setErr('The passwords do not match.'); return; }
    setBusy(true); setErr('');
    const res = await fetch(`/api/auth/${signup ? 'signup' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error || 'Something went wrong.'); setBusy(false); return; }
    router.push('/');
    router.refresh();
  };

  return (
    <div className="box-border flex min-h-screen flex-col items-center justify-center gap-5 p-5">
      <div className="flex items-center gap-3">
        <img src="/assets/logo-mark.png" alt="" className="h-[34px] w-[34px] object-contain" />
        <div className="text-[22px] font-extrabold tracking-[-0.01em]">Cutlist</div>
      </div>
      <form onSubmit={submit} className="card flex w-full max-w-[380px] flex-col gap-3.5 px-6 py-5">
        <div className="flex flex-col gap-1">
          <div className="eyebrow">{signup ? (first ? 'First account' : 'New account') : 'Welcome back'}</div>
          <div className="text-2xl font-extrabold tracking-[-0.01em]">{signup ? 'Sign up' : 'Sign in'}</div>
          {signup && (
            <div className="text-[13px] text-ink-3">
              {first ? 'No accounts exist yet. This one becomes the shop admin and takes over any jobs already saved.' : 'Your jobs are private to you. The shop admin can see every job.'}
            </div>
          )}
        </div>
        <label className={label}>Username
          <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus className={input} />
        </label>
        <label className={label}>Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} className={input} />
        </label>
        {signup && (
          <label className={label}>Confirm password
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className={input} />
          </label>
        )}
        {err && <div className="rounded-lg bg-err-bg px-3 py-2 text-xs text-err">{err}</div>}
        <button type="submit" disabled={busy || !username || !password} className="rounded-full border-none bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-dk disabled:opacity-60">
          {busy ? 'One moment…' : signup ? (first ? 'Create admin account' : 'Create account') : 'Sign in'}
        </button>
        <div className="text-center text-xs text-muted">
          {signup ? <>Already have an account? <Link href="/login" className="font-bold">Sign in</Link></> : <>New here? <Link href="/signup" className="font-bold">Create an account</Link></>}
        </div>
      </form>
    </div>
  );
}
