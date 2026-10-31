import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { createJob, getShopConfig, listJobs } from '@/lib/db';
import { emptyJob, normalizeJobDoc, sampleJob } from '@/lib/job';

export const dynamic = 'force-dynamic';

/** The signed-in user's jobs; every job for an admin. */
export async function GET() {
  const me = await currentUser();
  if (!me) return unauthorized();
  return NextResponse.json(listJobs(me));
}

/** Body: `{ doc }` to create from an imported file, `{ sample: true }` for the 3DB15 sample, or nothing for a blank job. The new job belongs to the signed-in user. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const body = await req.json().catch(() => ({}));
  try {
    const shop = getShopConfig();
    const doc = body?.doc ? normalizeJobDoc(body.doc, shop) : body?.sample ? sampleJob() : emptyJob(shop);
    return NextResponse.json(createJob(doc, me.id), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
