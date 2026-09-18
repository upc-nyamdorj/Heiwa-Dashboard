/**
 * Stateless HMAC-signed cookies for the "Sign in with Microsoft" flow.
 *
 * Deliberately separate from cf/lib/session.ts rather than an extension of it:
 * that module's token is `${username}.${exp}.${sig}` recovered with
 * `split('.')`, so any subject containing a dot — which is every UPN-shaped
 * address in this tenant, e.g. nyamdorj.m@upc.mn — would fail to verify. Here
 * the payload is base64url JSON, which survives dots and carries more than a
 * single name. There is no KV binding on this Worker, so both the sign-in
 * transaction and the resulting session live entirely in signed cookies.
 */

import { b64urlEncode, b64urlDecode } from './encoding';
import { nowSeconds, signToken, verifyToken } from './signed-token';

export { nowSeconds, signToken, verifyToken };

/** Session minted after a successful Microsoft sign-in. */
export const MS_SESSION_COOKIE = 'heiwa_ms_session';
/** Short-lived state+PKCE carrier, alive only for the authorize round-trip. */
export const OAUTH_TX_COOKIE = 'heiwa_oauth_tx';

export const MS_SESSION_TTL_SECONDS = 8 * 60 * 60; // one working day
export const OAUTH_TX_TTL_SECONDS = 10 * 60;

/** Cookie path for the transaction cookie — it is never needed outside these routes. */
const TX_COOKIE_PATH = '/api/auth';

export interface MsSession {
  sub: string;
  email: string;
  name: string;
  exp: number;
}

export interface OAuthTx {
  state: string;
  verifier: string;
  next: string;
  exp: number;
}

/**
 * SameSite=Lax, not Strict as the admin cookie uses: both of these cookies have
 * to survive a top-level navigation whose initiator is login.microsoftonline.com
 * (the authorize redirect back into /api/auth/callback). A Strict cookie is not
 * sent on a cross-site-initiated navigation, which would break the flow on every
 * sign-in. Lax is sent on top-level GET navigations, which is exactly this case.
 */
export function msSessionCookie(token: string): string {
  return `${MS_SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MS_SESSION_TTL_SECONDS}`;
}

export function oauthTxCookie(token: string): string {
  return `${OAUTH_TX_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=${TX_COOKIE_PATH}; Max-Age=${OAUTH_TX_TTL_SECONDS}`;
}

/** Path must match the cookie being cleared, or the browser keeps the original. */
export function clearCookie(name: string, path = '/'): string {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Path=${path}; Max-Age=0`;
}

export function clearOauthTxCookie(): string {
  return clearCookie(OAUTH_TX_COOKIE, TX_COOKIE_PATH);
}

export function randomToken(bytes = 32): string {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64urlEncode(new Uint8Array(digest));
}

/**
 * Reads the id_token payload without verifying its signature. Safe here, and
 * the OIDC spec says so explicitly: the token came straight back from the
 * tenant's token endpoint over TLS in response to our own client-authenticated
 * request, not through the browser, so there is no untrusted hop to guard
 * against. (A token arriving via the front channel would need full validation.)
 */
export function decodeIdTokenClaims(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch {
    return null;
  }
}
