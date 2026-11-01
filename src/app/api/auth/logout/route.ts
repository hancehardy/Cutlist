import { NextResponse } from 'next/server';
import { clearSessionCookie, sessionToken } from '@/lib/auth';
import { deleteSession } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  const token = await sessionToken();
  if (token) deleteSession(token);
  await clearSessionCookie();
  return new NextResponse(null, { status: 204 });
}
