/**
 * PBKDF2 hashing for the account bootstrap script.
 *
 * A second implementation of what cf/lib/password.ts does, because that module
 * is TypeScript inside the Worker bundle and this runs under plain Node. The
 * two are pinned together by pbkdf2.test.mjs, which hashes here and verifies
 * there — if the format or the parameters drift apart, that test fails.
 */

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashPassword(password, { iterations = ITERATIONS } = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, KEY_BITS,
  );
  return `pbkdf2$sha256$${iterations}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}
