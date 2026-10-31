import type { Metadata } from 'next';
import { JobList } from '@/components/JobList';
import { requireUser } from '@/lib/auth';
import { listJobs, listUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Jobs · Cabinet Cutlist' };

/** Job history: a user's own jobs; for an admin every job, broken down by user. */
export default async function JobsPage() {
  const me = await requireUser();
  const admin = me.role === 'admin';
  return <JobList initial={listJobs(me)} users={admin ? listUsers().map(u => ({ id: u.id, username: u.username, role: u.role })) : []} me={{ id: me.id, username: me.username, role: me.role }} />;
}
