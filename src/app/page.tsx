import { CutlistApp } from '@/components/CutlistApp';
import { createJob, getJob, getShopConfig, listJobs } from '@/lib/db';
import { emptyJob } from '@/lib/job';

export const dynamic = 'force-dynamic';

// Opens ?job=<id>, or the most recently edited job.
export default async function Page({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job: requested } = await searchParams;
  const shop = getShopConfig();
  let jobs = listJobs();
  // Every job was deleted: start a blank one.
  if (!jobs.length) { createJob(emptyJob(shop)); jobs = listJobs(); }
  const initial = (requested && getJob(requested)) || getJob(jobs[0].id)!;
  return <CutlistApp key={initial.id} jobId={initial.id} initialDoc={initial.doc} initialJobs={jobs} shop={shop} />;
}
