import { NextResponse } from 'next/server';
import { getShopConfig, saveShopConfig } from '@/lib/db';
import { normalizeShopConfig } from '@/lib/shop';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(getShopConfig());
}

/** Body: a full ShopConfig. Replaces the stored settings. */
export async function PUT(req: Request) {
  try {
    const doc = normalizeShopConfig(await req.json());
    return NextResponse.json({ updatedAt: saveShopConfig(doc), doc });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
