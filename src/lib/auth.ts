import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { sessionUser, type User } from './db';

export const SESSION_COOKIE = 'cutlist_session';

/** The signed-in user for this request, or null. */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sessionUser(token) : null;
}

/** For pages: send visitors to the login page. */
export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/login');
  return u;
}

/** For admin pages: regular users go back to their jobs. */
export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== 'admin') redirect('/');
  return u;
}

export const unauthorized = () => NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
export const forbidden = () => NextResponse.json({ error: 'Only an admin can do that.' }, { status: 403 });

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === 'production' });
}

export async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
