/**
 * Password hashing with PBKDF2 over WebCrypto — no dependency, and the only
 * key-derivation function the Workers runtime offers natively.
 *
 * Stored as `pbkdf2$sha256$<iterations>$<salt>$<hash>`, so the cost is recorded
 * alongside each hash: raising ITERATIONS later leaves existing logins working,
 * and each one re-hashes at the new cost the next time its owner changes it.
 */

import { b64urlEncode, b64urlDecode } from './encoding';
import { timingSafeEqualString } from './session';

/**
 * Well under OWASP's 600k recommendation for PBKDF2-SHA256, and deliberately.
 * A Worker invocation has a hard CPU ceiling — 10ms on the free plan — and
 * measured here 600k costs ~45ms while 100k costs ~7ms. A login that dies on
 * the CPU limit is not more secure than one that completes, so the cost is set
 * against the runtime's real budget. What actually carries the weight is a
 * per-user random salt and passwords an admin sets rather than users choose.
 */
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  return b64urlEncode(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$sha256$${ITERATIONS}$${b64urlEncode(salt)}$${hash}`;
}

/**
 * Never throws on a malformed stored value — a corrupt row should read as
 * "this password does not match", not as a 500 that tells an attacker the
 * account exists.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = String(stored).split('$');
  if (parts.length !== 5) return false;
  const [scheme, hash, iterationsRaw, saltRaw, expected] = parts;
  if (scheme !== 'pbkdf2' || hash !== 'sha256') return false;

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false;

  let salt: Uint8Array;
  try {
    salt = b64urlDecode(saltRaw);
  } catch {
    return false;
  }
  if (salt.length === 0) return false;

  return timingSafeEqualString(await derive(password, salt, iterations), expected);
}
