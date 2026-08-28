/**
 * Stateless HMAC-signed admin session cookie — no session store needed.
 * Token shape: `${username}.${expiryUnixSeconds}.${hexSignature}`.
 */

export const COOKIE_NAME = 'heiwa_admin_session';
const SESSION_TTL_SECONDS = 60 * 60; // 1 hour, per spec — simple, no refresh flow

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare — used for both password checks and signature checks. */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(username: string, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${username}.${exp}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${toHex(sig)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<{ username: string } | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [username, expStr, sigHex] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  const payload = `${username}.${expStr}`;
  const expectedSig = toHex(await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(payload)));
  if (!timingSafeEqualString(expectedSig, sigHex)) return null;
  return { username };
}

export function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

export function sessionCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}
