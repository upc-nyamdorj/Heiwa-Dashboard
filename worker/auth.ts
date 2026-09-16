/**
 * "Sign in with Microsoft" — OIDC authorization-code flow with PKCE against
 * the tenant-specific Entra ID endpoint.
 *
 * This is a second, separate Azure app registration from the one the OneDrive
 * sync uses: that one is app-only (client_credentials, no user involved, see
 * scripts/lib/graph-client.mjs). This one is delegated — a real person signs
 * in — so it needs a registered redirect URI, which is why the two cannot
 * share a registration.
 *
 * The session it mints is ALSO separate from the admin session in
 * cf/lib/session.ts. Every user in the tenant can complete this flow, while
 * the admin session gates the Review tab's write access to the repo; minting
 * one from the other would hand repo-write to the whole tenant.
 */

import { jsonResponse } from '../cf/lib/response';
import { parseCookie, timingSafeEqualString } from '../cf/lib/session';
import {
  MS_SESSION_COOKIE,
  MS_SESSION_TTL_SECONDS,
  OAUTH_TX_COOKIE,
  OAUTH_TX_TTL_SECONDS,
  clearCookie,
  clearOauthTxCookie,
  decodeIdTokenClaims,
  msSessionCookie,
  nowSeconds,
  oauthTxCookie,
  pkceChallenge,
  randomToken,
  signToken,
  verifyToken,
  type MsSession,
  type OAuthTx,
} from '../cf/lib/oauth-session';
import type { Env } from './env';

/**
 * User.Read is not strictly required — every claim the session stores comes
 * from the id_token — but it is requested so consent is granted once now
 * rather than re-prompted the first time anything calls Graph /me.
 */
const SCOPES = 'openid profile email User.Read';

/**
 * Tenant membership alone is not the bar: the tenant also holds guest accounts
 * and service identities that are not UPC staff. The address has to sit on the
 * corporate domain too.
 */
const ALLOWED_EMAIL_DOMAIN = 'upc.mn';

const REQUIRED_VARS = [
  'MS_OAUTH_CLIENT_ID',
  'MS_OAUTH_TENANT_ID',
  'MS_OAUTH_CLIENT_SECRET',
  'OAUTH_SESSION_SECRET',
] as const;

function missingConfig(env: Env): string[] {
  return REQUIRED_VARS.filter((name) => !env[name]);
}

function authority(env: Env): string {
  // Tenant-specific, not /common: Entra then rejects guests and other tenants
  // for us, before the code ever reaches the callback.
  return `https://login.microsoftonline.com/${env.MS_OAUTH_TENANT_ID}/oauth2/v2.0`;
}

/**
 * Derived from the request rather than configured, so the same code works on
 * workers.dev and on http://localhost:8787 under `wrangler dev`. Both must be
 * registered on the app registration — Entra matches redirect URIs exactly.
 */
function redirectUri(request: Request): string {
  return new URL('/api/auth/callback', request.url).toString();
}

/** Only same-origin relative paths, so ?next= cannot become an open redirect. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function isAllowedEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

function claimString(claims: Record<string, unknown>, key: string): string | null {
  const value = claims[key];
  return typeof value === 'string' && value ? value : null;
}

/**
 * Every callback failure is a redirect to the dashboard with `?error=<code>`,
 * never a JSON body: the caller is a browser mid-navigation, so JSON would
 * strand the user on a blank page. The login screen maps the code to a
 * message (src/components/LoginScreen.tsx).
 *
 * The code is always one of ours. Entra's own error text is dropped rather
 * than forwarded — it echoes request parameters back, and this string lands in
 * the address bar.
 */
function authFailure(code: string): Response {
  const headers = new Headers({
    Location: `/?error=${encodeURIComponent(code)}`,
    'Cache-Control': 'no-store',
  });
  headers.append('Set-Cookie', clearOauthTxCookie());
  return new Response(null, { status: 302, headers });
}

/** GET /api/auth/login — starts the flow. */
export async function handleAuthLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const missing = missingConfig(env);
  if (missing.length) return jsonResponse({ error: 'oauth_not_configured', missing }, 500);

  const state = randomToken();
  const verifier = randomToken(48);
  const next = safeNext(new URL(request.url).searchParams.get('next'));

  const tx = await signToken(
    { state, verifier, next, exp: nowSeconds() + OAUTH_TX_TTL_SECONDS },
    env.OAUTH_SESSION_SECRET,
  );

  const authorize = new URL(`${authority(env)}/authorize`);
  authorize.search = new URLSearchParams({
    client_id: env.MS_OAUTH_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(request),
    response_mode: 'query',
    scope: SCOPES,
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
  }).toString();

  const headers = new Headers({ Location: authorize.toString(), 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', oauthTxCookie(tx));
  return new Response(null, { status: 302, headers });
}

/** GET /api/auth/callback — the redirect URI registered on the app registration. */
export async function handleAuthCallback(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const missing = missingConfig(env);
  if (missing.length) return jsonResponse({ error: 'oauth_not_configured', missing }, 500);

  const params = new URL(request.url).searchParams;

  // Entra reports user-facing failures (consent declined, admin approval
  // required, ...) on the redirect itself, with no code.
  const reportedError = params.get('error');
  if (reportedError) {
    return authFailure(reportedError === 'access_denied' ? 'access_denied' : 'entra_error');
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return authFailure('missing_code_or_state');

  const tx = await verifyToken<OAuthTx>(
    parseCookie(request.headers.get('Cookie'), OAUTH_TX_COOKIE),
    env.OAUTH_SESSION_SECRET,
  );
  if (!tx) return authFailure('expired_or_missing_state');
  if (!timingSafeEqualString(tx.state, state)) return authFailure('state_mismatch');

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(`${authority(env)}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.MS_OAUTH_CLIENT_ID,
        client_secret: env.MS_OAUTH_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(request),
        code_verifier: tx.verifier,
        scope: SCOPES,
      }),
    });
  } catch {
    return authFailure('token_request_failed');
  }

  if (!tokenResponse.ok) return authFailure('token_exchange_failed');

  let idToken: string | undefined;
  try {
    ({ id_token: idToken } = (await tokenResponse.json()) as { id_token?: string });
  } catch {
    return authFailure('token_response_unreadable');
  }
  if (!idToken) return authFailure('no_id_token');

  const claims = decodeIdTokenClaims(idToken);
  const sub = claims && claimString(claims, 'sub');
  if (!claims || !sub) return authFailure('id_token_unreadable');

  // Belt and braces over the tenant-specific authority above.
  const tid = claimString(claims, 'tid');
  if (tid && tid !== env.MS_OAUTH_TENANT_ID) return authFailure('wrong_tenant');

  const email = claimString(claims, 'email') ?? claimString(claims, 'preferred_username') ?? '';
  if (!isAllowedEmail(email)) return authFailure('wrong_domain');
  const name = claimString(claims, 'name') ?? email;

  const session = await signToken(
    { sub, email, name, exp: nowSeconds() + MS_SESSION_TTL_SECONDS },
    env.OAUTH_SESSION_SECRET,
  );

  const headers = new Headers({ Location: tx.next, 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', msSessionCookie(session));
  headers.append('Set-Cookie', clearOauthTxCookie());
  return new Response(null, { status: 302, headers });
}

/** GET /api/auth/me — who, if anyone, the caller is signed in as. */
export async function handleAuthMe(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const session = await readMsSession(request, env);
  if (!session) return jsonResponse({ authenticated: false });
  return jsonResponse({
    authenticated: true,
    user: { sub: session.sub, email: session.email, name: session.name },
  });
}

/** POST /api/auth/logout — clears the local session only (no Entra sign-out). */
export async function handleAuthLogout(request: Request): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', clearCookie(MS_SESSION_COOKIE));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

/** Shared by the handlers above and available to any future gated route. */
export async function readMsSession(request: Request, env: Env): Promise<MsSession | null> {
  if (!env.OAUTH_SESSION_SECRET) return null;
  return verifyToken<MsSession>(
    parseCookie(request.headers.get('Cookie'), MS_SESSION_COOKIE),
    env.OAUTH_SESSION_SECRET,
  );
}
