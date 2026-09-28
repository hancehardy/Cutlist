import { NextResponse } from 'next/server';
import { createJob, listJobs } from '@/lib/db';
import { emptyJob, normalizeJobDoc, sampleJob } from '@/lib/job';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(listJobs());
}

/** Body: `{ doc }` to create from an imported file, `{ sample: true }` for the 3DB15 sample, or nothing for a blank job. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    const doc = body?.doc ? normalizeJobDoc(body.doc) : body?.sample ? sampleJob() : emptyJob();
    return NextResponse.json(createJob(doc), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
