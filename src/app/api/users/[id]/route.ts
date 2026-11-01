import { NextResponse } from 'next/server';
import { currentUser, forbidden, unauthorized } from '@/lib/auth';
import { deleteUser, getUser, listUsers, setUserPassword, setUserRole, type Role } from '@/lib/db';
import { hashPassword, passwordError } from '@/lib/password';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Admin only. Body: `{ role?: 'admin' | 'user', password?: string }`. The last admin cannot be demoted. */
export async function PATCH(req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return unauthorized();
  if (me.role !== 'admin') return forbidden();
  const { id } = await params;
  const target = getUser(id);
  if (!target) return bad('User not found.', 404);
  const body = await req.json().catch(() => ({}));
  if (body?.role !== undefined) {
    const role = body.role as Role;
    if (role !== 'admin' && role !== 'user') return bad('Role must be admin or user.');
    if (role === 'user' && target.role === 'admin' && listUsers().filter(u => u.role === 'admin').length < 2) return bad('The shop needs at least one admin.');
    setUserRole(id, role);
  }
  if (body?.password !== undefined) {
    const err = passwordError(String(body.password));
    if (err) return bad(err);
    setUserPassword(id, hashPassword(String(body.password)));
  }
  return NextResponse.json({ user: getUser(id) });
}

/** Admin only. Deletes the user; their jobs pass to the admin doing the deleting. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await currentUser();
  if (!me) return unauthorized();
  if (me.role !== 'admin') return forbidden();
  const { id } = await params;
  if (id === me.id) return bad('You cannot delete your own account.');
  return deleteUser(id, me.id) ? new NextResponse(null, { status: 204 }) : bad('User not found.', 404);
}
