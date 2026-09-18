import { describe, it, expect } from 'vitest';
import { hashPassword } from './pbkdf2.mjs';
import { verifyPassword } from '../../cf/lib/password.ts';

/**
 * The bootstrap script hashes in Node and the Worker verifies in workerd. If
 * those two ever disagree, the first admin cannot log in and the only symptom
 * is a wrong password — so pin them to each other here.
 */
describe('the bootstrap hash and the Worker verifier agree', () => {
  it('accepts a hash the script produced', async () => {
    const stored = await hashPassword('a-long-enough-password');
    await expect(verifyPassword('a-long-enough-password', stored)).resolves.toBe(true);
    await expect(verifyPassword('a-long-enough-passwore', stored)).resolves.toBe(false);
  });

  it('agrees on non-ASCII too', async () => {
    const stored = await hashPassword('нууцҮгМонгол');
    await expect(verifyPassword('нууцҮгМонгол', stored)).resolves.toBe(true);
  });

  it('writes the format the verifier parses', async () => {
    const [scheme, digest, iterations, salt, hash] = (await hashPassword('pw')).split('$');
    expect([scheme, digest]).toEqual(['pbkdf2', 'sha256']);
    expect(Number(iterations)).toBe(100_000);
    expect(salt.length).toBeGreaterThan(20);
    expect(hash.length).toBeGreaterThan(40);
  });
});
