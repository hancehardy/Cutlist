import { CutlistApp } from '@/components/CutlistApp';
import { requireUser } from '@/lib/auth';
import { createJob, getJob, getShopConfig, listJobs } from '@/lib/db';
import { emptyJob } from '@/lib/job';

export const dynamic = 'force-dynamic';

// Opens ?job=<id>, or the most recently edited job the signed-in user may see.
export default async function Page({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const user = await requireUser();
  const { job: requested } = await searchParams;
  const shop = getShopConfig();
  let jobs = listJobs(user);
  // No jobs yet (or every job was deleted): start a blank one for this user.
  if (!jobs.length) { createJob(emptyJob(shop), user.id); jobs = listJobs(user); }
  const initial = (requested && getJob(requested, user)) || getJob(jobs[0].id, user)!;
  return <CutlistApp key={initial.id} jobId={initial.id} initialDoc={initial.doc} initialShop={shop} user={{ username: user.username, role: user.role }} />;
}
