/**
 * Sign in, sign out, and "who am I" for the account system.
 *
 * Replaces three separate gates: the shared view login, the Review tab's admin
 * login, and the password prompt on the Sync button. One session now answers
 * all three questions, and the role on the account decides the rest.
 */

import { jsonResponse } from '../cf/lib/response';
import { clearSessionCookie, createSessionCookie, currentUser } from './auth-session';
import { findByUsername, setPassword, verifyCurrentPassword } from './user-actions';
import type { Env } from './env';

function notConfigured(env: Env): Response | null {
  if (!env.SESSION_SECRET) return jsonResponse({ error: 'auth_not_configured' }, 500);
  return null;
}

/** POST /api/session/login */
export async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  const bad = notConfigured(env);
  if (bad) return bad;

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  if (!body.username || !body.password) return jsonResponse({ error: 'invalid_credentials' }, 401);

  const user = await verifyCurrentPassword(env.USERS_DB, body.username, body.password);
  // One answer for "no such account" and "wrong password", so the response
  // cannot be used to find out who has an account here.
  if (!user) return jsonResponse({ error: 'invalid_credentials' }, 401);

  return new Response(JSON.stringify({ ok: true, user: { username: user.username, role: user.role } }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': await createSessionCookie(user.id, env.SESSION_SECRET),
    },
  });
}

/** POST /api/session/logout */
export function handleLogout(request: Request): Response {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookie() },
  });
}

/** GET /api/session/me — what the client renders its whole shell from. */
export async function handleMe(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const user = await currentUser(request, env);
  if (!user) return jsonResponse({ authenticated: false });
  return jsonResponse({
    authenticated: true,
    user: { id: user.id, username: user.username, role: user.role },
  });
}

/**
 * POST /api/session/password — change your own password.
 *
 * Requires the current one even though the session already proves identity: it
 * stops a walk-up at an unlocked screen from locking the owner out of their
 * own account.
 */
export async function handleChangeOwnPassword(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  const bad = notConfigured(env);
  if (bad) return bad;

  const user = await currentUser(request, env);
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401);

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  if (!body.currentPassword || !body.newPassword) return jsonResponse({ error: 'invalid_body' }, 400);
  if (body.newPassword.length < 10) return jsonResponse({ error: 'password_too_short', minimum: 10 }, 400);

  const confirmed = await verifyCurrentPassword(env.USERS_DB, user.username, body.currentPassword);
  if (!confirmed || confirmed.id !== user.id) return jsonResponse({ error: 'wrong_password' }, 403);

  await setPassword(env.USERS_DB, user.id, body.newPassword);
  return jsonResponse({ ok: true });
}

export { findByUsername };
