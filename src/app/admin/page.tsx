import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { AdminApp } from '@/components/admin/AdminApp';
import { getShopConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin · Cabinet Cutlist' };

/** Picker images a box can use, from public/assets/sku. */
function skuImages(): string[] {
  try {
    return fs.readdirSync(path.join(process.cwd(), 'public', 'assets', 'sku')).filter(f => /\.(png|svg|jpe?g|webp)$/i.test(f)).sort().map(f => `/assets/sku/${f}`);
  } catch { return []; }
}

export default function AdminPage() {
  return <AdminApp initial={getShopConfig()} skuImages={skuImages()} />;
}
