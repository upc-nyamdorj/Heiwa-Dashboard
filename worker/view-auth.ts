/**
 * The gate on the dashboard itself: one shared viewer account, checked against
 * secrets and answered with the same stateless HMAC cookie the Review tab's
 * admin login uses (cf/lib/session.ts).
 *
 * Separate from the admin session on purpose, and separate at every layer —
 * its own secret, its own cookie name. Holding a view session proves only that
 * someone knew the viewing password; the Review tab still demands the admin
 * credentials on top, because that session can write to the repo.
 *
 * The Microsoft sign-in in worker/auth.ts is parked, not deleted: its routes
 * still answer, but nothing gates on the session it mints.
 */

import {
  COOKIE_NAME,
  VIEW_COOKIE_NAME,
  clearSessionCookieHeader,
  createSessionToken,
  parseCookie,
  sessionCookieHeader,
  timingSafeEqualString,
  verifySessionToken,
} from '../cf/lib/session';
import { jsonResponse } from '../cf/lib/response';
import type { Env } from './env';

/**
 * The token's subject is fixed rather than the submitted username. There is
 * only one viewer account, so the name carries no information — and the token
 * format splits on '.', which a name containing one would break.
 */
const VIEW_SUBJECT = 'view';

function missingConfig(env: Env): string[] {
  return (['VIEW_USERNAME', 'VIEW_PASSWORD', 'VIEW_SESSION_SECRET'] as const).filter((n) => !env[n]);
}

/** POST /api/view-auth/login */
export async function handleViewLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const missing = missingConfig(env);
  if (missing.length) return jsonResponse({ error: 'view_auth_not_configured', missing }, 500);

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const validUsername = !!body.username && timingSafeEqualString(body.username, env.VIEW_USERNAME);
  const validPassword = !!body.password && timingSafeEqualString(body.password, env.VIEW_PASSWORD);
  if (!validUsername || !validPassword) return jsonResponse({ error: 'invalid_credentials' }, 401);

  const token = await createSessionToken(VIEW_SUBJECT, env.VIEW_SESSION_SECRET);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(token, VIEW_COOKIE_NAME),
    },
  });
}

/** POST /api/view-auth/logout */
export function handleViewLogout(request: Request): Response {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookieHeader(VIEW_COOKIE_NAME),
    },
  });
}

/** GET /api/view-auth/me — what the client checks before rendering anything. */
export async function handleViewMe(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);
  return jsonResponse({ authenticated: await hasViewAccess(request, env) });
}

/**
 * True for a valid view session, and also for a valid admin one: an admin
 * arriving with only the Review credentials should not be told the dashboard
 * is off limits.
 */
export async function hasViewAccess(request: Request, env: Env): Promise<boolean> {
  const cookies = request.headers.get('Cookie');

  if (env.VIEW_SESSION_SECRET) {
    const view = await verifySessionToken(parseCookie(cookies, VIEW_COOKIE_NAME), env.VIEW_SESSION_SECRET);
    if (view) return true;
  }
  if (env.ADMIN_SESSION_SECRET) {
    const admin = await verifySessionToken(parseCookie(cookies, COOKIE_NAME), env.ADMIN_SESSION_SECRET);
    if (admin) return true;
  }
  return false;
}
