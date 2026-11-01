import { NextResponse } from 'next/server';
import { currentUser, forbidden, unauthorized } from '@/lib/auth';
import { listUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await currentUser();
  if (!me) return unauthorized();
  if (me.role !== 'admin') return forbidden();
  return NextResponse.json(listUsers());
}
