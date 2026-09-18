/**
 * Stateless signed tokens: a base64url JSON payload with an HMAC over it.
 *
 * Deliberately not the `${username}.${exp}.${sig}` shape in session.ts, which
 * recovers its fields with split('.') and so cannot carry a payload — or a
 * username — containing a dot. Everything that needs more than a name uses
 * this: the Microsoft sign-in transaction, and the account session cookie.
 */

import { hmacKey, toHex, timingSafeEqualString } from './session';
import { b64urlEncode, b64urlDecode } from './encoding';

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** `${base64urlJsonPayload}.${hexSignature}` */
export async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  return `${body}.${sig}`;
}

/** Verifies the signature before parsing, so malformed JSON never reaches JSON.parse unsigned. */
export async function verifyToken<T extends { exp: number }>(
  token: string | undefined,
  secret: string,
): Promise<T | null> {
  if (!token) return null;
  const separator = token.indexOf('.');
  if (separator < 1) return null;
  const body = token.slice(0, separator);
  const sig = token.slice(separator + 1);
  if (sig.includes('.')) return null;

  const key = await hmacKey(secret);
  const expected = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  if (!timingSafeEqualString(expected, sig)) return null;

  let parsed: T;
  try {
    parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < nowSeconds()) return null;
  return parsed;
}
