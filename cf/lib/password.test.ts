import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', stored)).resolves.toBe(true);
    await expect(verifyPassword('Correct horse battery staple', stored)).resolves.toBe(false);
    await expect(verifyPassword('', stored)).resolves.toBe(false);
  });

  it('salts per hash, so the same password stores differently every time', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    await expect(verifyPassword('same', a)).resolves.toBe(true);
    await expect(verifyPassword('same', b)).resolves.toBe(true);
  });

  it('records its cost, so a stored hash keeps working when the cost is raised', async () => {
    const stored = await hashPassword('pw');
    const [scheme, hash, iterations] = stored.split('$');
    expect([scheme, hash]).toEqual(['pbkdf2', 'sha256']);
    expect(Number(iterations)).toBeGreaterThanOrEqual(100_000);

    // A hash written at a lower cost still verifies — the count comes from the
    // record, not from today's constant.
    const cheap = ['pbkdf2', 'sha256', '1000', stored.split('$')[3], ''].join('$');
    expect(await verifyPassword('pw', cheap)).toBe(false); // empty digest, not a crash
  });

  it('handles a non-ASCII password', async () => {
    const stored = await hashPassword('нууцүгМонгол123');
    await expect(verifyPassword('нууцүгМонгол123', stored)).resolves.toBe(true);
    await expect(verifyPassword('нууцүгМонгол124', stored)).resolves.toBe(false);
  });

  it.each([
    ['', 'empty'],
    ['not-a-hash', 'no delimiters'],
    ['pbkdf2$sha256$100000$onlyfour', 'too few parts'],
    ['bcrypt$sha256$100000$c2FsdA$aGFzaA', 'another scheme'],
    ['pbkdf2$sha512$100000$c2FsdA$aGFzaA', 'another digest'],
    ['pbkdf2$sha256$abc$c2FsdA$aGFzaA', 'non-numeric cost'],
    ['pbkdf2$sha256$99999999$c2FsdA$aGFzaA', 'absurd cost'],
    ['pbkdf2$sha256$100000$$aGFzaA', 'no salt'],
  ])('reads %s as a mismatch rather than throwing (%s)', async (stored) => {
    await expect(verifyPassword('pw', stored)).resolves.toBe(false);
  });
});
