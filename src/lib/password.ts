// Password hashing and account input rules. Pure Node, no server-only import, so it can be unit tested.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** `scrypt:<salt hex>:<key hex>` */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, key] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const a = Buffer.from(key, 'hex'), b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A problem with the username, or null when it is fine. */
export function usernameError(u: string): string | null {
  const s = u.trim();
  if (s.length < 3 || s.length > 32) return 'Username must be 3 to 32 characters.';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s)) return 'Username can use letters, digits, dots, dashes and underscores, and must start with a letter or digit.';
  return null;
}

export function passwordError(p: string): string | null {
  if (p.length < 8) return 'Password must be at least 8 characters.';
  if (p.length > 200) return 'Password is too long.';
  return null;
}
