import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { canEditJob, jobStatus, setJobStatus } from '@/lib/db';
import type { JobStatus } from '@/lib/job';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Body: `{ status }`. The owner submits a draft to the shop, or withdraws a submitted order back to draft
 * while the shop has not received it. An admin may set any status (receive, complete, reopen).
 */
export async function POST(req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const { id } = await params;
  if (!canEditJob(id, me)) return bad('Job not found', 404);
  const body = await req.json().catch(() => ({}));
  const next = body?.status as JobStatus;
  if (!['draft', 'submitted', 'received', 'completed'].includes(next)) return bad('Status must be draft, submitted, received or completed.');
  const cur = jobStatus(id) ?? 'draft';
  if (me.role !== 'admin') {
    const ok = (cur === 'draft' && next === 'submitted') || (cur === 'submitted' && next === 'draft');
    if (!ok) return bad(cur === 'draft' || cur === 'submitted' ? 'That change is not allowed.' : 'The shop has this order; ask an admin to reopen it.', 409);
  }
  const r = setJobStatus(id, next);
  return r ? NextResponse.json(r) : bad('Job not found', 404);
}
