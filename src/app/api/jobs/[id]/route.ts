import { NextResponse } from 'next/server';
import { deleteJob, getJob, updateJob } from '@/lib/db';
import { normalizeJobDoc } from '@/lib/job';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: 'Job not found' }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  const job = getJob((await params).id);
  return job ? NextResponse.json(job) : notFound();
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const doc = normalizeJobDoc(await req.json());
    const updatedAt = updateJob(id, doc);
    return updatedAt ? NextResponse.json({ id, updatedAt }) : notFound();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return deleteJob((await params).id) ? new NextResponse(null, { status: 204 }) : notFound();
}
