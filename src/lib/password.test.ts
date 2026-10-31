import { describe, expect, it } from 'vitest';
import { hashPassword, passwordError, usernameError, verifyPassword } from './password';

describe('passwords', () => {
  it('hashes with a random salt and verifies', () => {
    const a = hashPassword('correct horse'), b = hashPassword('correct horse');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt:')).toBe(true);
    expect(verifyPassword('correct horse', a)).toBe(true);
    expect(verifyPassword('correct horse', b)).toBe(true);
    expect(verifyPassword('wrong', a)).toBe(false);
    expect(verifyPassword('correct horse', 'plain:nope')).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
  });

  it('checks account inputs', () => {
    expect(usernameError('jo')).toMatch(/3 to 32/);
    expect(usernameError('.jo')).toMatch(/start with/);
    expect(usernameError('shop admin')).toMatch(/letters, digits/);
    expect(usernameError(' hance.hardy-1 ')).toBeNull();
    expect(passwordError('short')).toMatch(/at least 8/);
    expect(passwordError('long enough')).toBeNull();
  });
});
