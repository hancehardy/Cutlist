import { Home } from '@/components/Home';
import { requireUser } from '@/lib/auth';
import { countUsers, getShopConfig, listJobs } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Home: a greeting, quick actions, recent jobs, and shop counts for admins. */
export default async function HomePage() {
  const user = await requireUser();
  const jobs = listJobs(user);
  const shop = getShopConfig();
  const admin = user.role === 'admin';
  return (
    <Home
      me={{ id: user.id, username: user.username, role: user.role }}
      recent={jobs.slice(0, 6)}
      totals={{ jobs: jobs.length, users: admin ? countUsers() : 0, materials: shop.materials.length, methods: shop.presets.length, boxes: shop.catalog.types.length }}
    />
  );
}
