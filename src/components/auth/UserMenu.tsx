'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface Me { username: string; role: 'admin' | 'user' }

/** Top-bar account bits: the Admin link for admins, the username, and sign out. */
export function UserMenu({ user, admin = false }: { user: Me; admin?: boolean }) {
  const router = useRouter();
  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };
  return (
    <div className="ml-auto flex items-center gap-3 text-xs">
      {user.role === 'admin' && !admin && <Link href="/admin" className="font-bold">Admin</Link>}
      <span className="text-muted">{user.username}{user.role === 'admin' ? ' · admin' : ''}</span>
      <button onClick={signOut} className="border-none bg-transparent p-0 text-xs font-semibold text-muted hover:text-ink hover:underline">Sign out</button>
    </div>
  );
}
