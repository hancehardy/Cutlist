import { NextResponse } from 'next/server';
import { getShopConfig, saveShopConfig } from '@/lib/db';
import { normType } from '@/lib/shop';

export const dynamic = 'force-dynamic';

/** Body: a box type (see `CabType`). Adds it to the shop's catalog; the code must be new. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const cfg = getShopConfig();
  const type = normType(body, cfg.catalog.categories);
  if (!type) return NextResponse.json({ error: 'A box needs a code.' }, { status: 400 });
  if (cfg.catalog.types.some(t => t.code === type.code)) return NextResponse.json({ error: `Box code ${type.code} is already in the catalog.` }, { status: 409 });
  saveShopConfig({ ...cfg, catalog: { ...cfg.catalog, types: [...cfg.catalog.types, type] } });
  return NextResponse.json({ type }, { status: 201 });
}
