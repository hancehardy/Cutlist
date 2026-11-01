import { NextResponse } from 'next/server';
import { currentUser, forbidden, unauthorized } from '@/lib/auth';
import { getShopConfig, saveShopConfig } from '@/lib/db';
import { normalizeShopConfig } from '@/lib/shop';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await currentUser())) return unauthorized();
  return NextResponse.json(getShopConfig());
}

/** Admin only. Body: a full ShopConfig. Replaces the stored settings. */
export async function PUT(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  if (me.role !== 'admin') return forbidden();
  try {
    const doc = normalizeShopConfig(await req.json());
    return NextResponse.json({ updatedAt: saveShopConfig(doc), doc });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
