import { NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/auth';
import { createSession, findUserWithPassword } from '@/lib/db';
import { verifyPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';

/** Body: `{ username, password }`. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const found = findUserWithPassword(String(body?.username ?? ''));
  if (!found || !verifyPassword(String(body?.password ?? ''), found.password)) {
    return NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 });
  }
  const { password: _pw, ...user } = found;
  void _pw;
  await setSessionCookie(createSession(user.id));
  return NextResponse.json({ user });
}
