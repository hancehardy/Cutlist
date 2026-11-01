import { NextResponse } from 'next/server';
import { currentUser, forbidden, unauthorized } from '@/lib/auth';
import { countNewOrders, listJobs } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Admin only: orders submitted and not yet received. */
export async function GET() {
  const me = await currentUser();
  if (!me) return unauthorized();
  if (me.role !== 'admin') return forbidden();
  return NextResponse.json({ count: countNewOrders(), jobs: listJobs(me).filter(j => j.status === 'submitted') });
}
