import { Home } from '@/components/Home';
import { requireUser } from '@/lib/auth';
import { countUsers, getShopConfig, listJobs } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Home: for a user, their orders and where each one stands; for an admin, the shop's order queue and counts. */
export default async function HomePage() {
  const user = await requireUser();
  const shop = getShopConfig();
  const admin = user.role === 'admin';
  return (
    <Home
      me={{ id: user.id, username: user.username, role: user.role }}
      jobs={listJobs(user)}
      shop={{ users: admin ? countUsers() : 0, materials: shop.materials.length, methods: shop.presets.length, boxes: shop.catalog.types.length }}
    />
  );
}
