import { redirect } from 'next/navigation';
import { CutlistApp } from '@/components/CutlistApp';
import { requireUser } from '@/lib/auth';
import { getJob, getShopConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** The job editor: items, configurator and reports for one job the signed-in user may see. */
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const job = getJob(id, user);
  if (!job) redirect('/jobs');
  return <CutlistApp key={job.id} jobId={job.id} initialDoc={job.doc} initialShop={getShopConfig()} user={{ username: user.username, role: user.role }} />;
}
