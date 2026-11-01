import { NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/auth';
import { claimOrphanJobs, countUsers, createSession, createUser, findUserWithPassword } from '@/lib/db';
import { hashPassword, passwordError, usernameError } from '@/lib/password';

export const dynamic = 'force-dynamic';

/** Body: `{ username, password }`. Anyone can sign up; the first account becomes the admin and takes over jobs saved before accounts existed. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? ''), password = String(body?.password ?? '');
  const err = usernameError(username) ?? passwordError(password);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  if (findUserWithPassword(username)) return NextResponse.json({ error: 'That username is taken.' }, { status: 409 });
  const first = countUsers() === 0;
  const user = createUser(username, hashPassword(password), first ? 'admin' : 'user');
  if (first) claimOrphanJobs(user.id);
  await setSessionCookie(createSession(user.id));
  return NextResponse.json({ user }, { status: 201 });
}
