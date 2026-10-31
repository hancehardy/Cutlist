import type { Metadata } from 'next';
import { AdminApp } from '@/components/admin/AdminApp';
import { getShopConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Cabinet Cutlist' };

export default function AdminPage() {
  return <AdminApp initial={getShopConfig()} />;
}
