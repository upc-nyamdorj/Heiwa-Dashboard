/**
 * Account administration. Every route here is admin-only.
 *
 * Paths are action-shaped (/api/users/role) rather than REST-shaped
 * (PATCH /api/users/:id) because the Worker routes on an exact pathname — see
 * the switch in index.ts — and /api/review-action already reads that way.
 */

import { jsonResponse } from '../cf/lib/response';
import { atLeast, currentUser } from './auth-session';
import {
  UsernameTakenError, countByRole, createUser, deleteUser, isRole, listUsers, setPassword, setRole,
} from './users';
import { findById } from './users';
import type { Env } from './env';

const MIN_PASSWORD = 10;

async function requireAdmin(request: Request, env: Env) {
  if (!env.SESSION_SECRET) return { error: jsonResponse({ error: 'auth_not_configured' }, 500) };
  const user = await currentUser(request, env);
  if (!user) return { error: jsonResponse({ error: 'unauthorized' }, 401) };
  if (!atLeast(user, 'admin')) return { error: jsonResponse({ error: 'forbidden' }, 403) };
  return { user };
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** GET /api/users, POST /api/users */
export async function handleUsers(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  if (request.method === 'GET') {
    return jsonResponse({ users: await listUsers(env.USERS_DB) });
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const body = await readJson<{ username?: string; password?: string; role?: string }>(request);
  if (!body?.username?.trim() || !body.password || !isRole(body.role)) {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }
  if (body.password.length < MIN_PASSWORD) {
    return jsonResponse({ error: 'password_too_short', minimum: MIN_PASSWORD }, 400);
  }

  try {
    const user = await createUser(env.USERS_DB, {
      username: body.username, password: body.password, role: body.role,
    });
    return jsonResponse({ user }, 201);
  } catch (err) {
    if (err instanceof UsernameTakenError) return jsonResponse({ error: 'username_taken' }, 409);
    throw err;
  }
}

/** POST /api/users/role */
export async function handleSetRole(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  const body = await readJson<{ id?: string; role?: string }>(request);
  if (!body?.id || !isRole(body.role)) return jsonResponse({ error: 'invalid_body' }, 400);

  const target = await findById(env.USERS_DB, body.id);
  if (!target) return jsonResponse({ error: 'not_found' }, 404);

  // Demoting yourself would take the Users tab away mid-edit, and demoting the
  // only admin would leave nobody who can hand the role back.
  if (target.id === auth.user.id && body.role !== 'admin') {
    return jsonResponse({ error: 'cannot_demote_self' }, 409);
  }
  if (target.role === 'admin' && body.role !== 'admin' && (await countByRole(env.USERS_DB, 'admin')) <= 1) {
    return jsonResponse({ error: 'last_admin' }, 409);
  }

  await setRole(env.USERS_DB, target.id, body.role);
  return jsonResponse({ ok: true });
}

/** POST /api/users/password — an admin resetting someone else's. */
export async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  const body = await readJson<{ id?: string; newPassword?: string }>(request);
  if (!body?.id || !body.newPassword) return jsonResponse({ error: 'invalid_body' }, 400);
  if (body.newPassword.length < MIN_PASSWORD) {
    return jsonResponse({ error: 'password_too_short', minimum: MIN_PASSWORD }, 400);
  }

  if (!(await findById(env.USERS_DB, body.id))) return jsonResponse({ error: 'not_found' }, 404);
  await setPassword(env.USERS_DB, body.id, body.newPassword);
  return jsonResponse({ ok: true });
}

/** POST /api/users/delete */
export async function handleDeleteUser(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;

  const body = await readJson<{ id?: string }>(request);
  if (!body?.id) return jsonResponse({ error: 'invalid_body' }, 400);

  const target = await findById(env.USERS_DB, body.id);
  if (!target) return jsonResponse({ error: 'not_found' }, 404);
  if (target.id === auth.user.id) return jsonResponse({ error: 'cannot_delete_self' }, 409);
  if (target.role === 'admin' && (await countByRole(env.USERS_DB, 'admin')) <= 1) {
    return jsonResponse({ error: 'last_admin' }, 409);
  }

  await deleteUser(env.USERS_DB, target.id);
  return jsonResponse({ ok: true });
}
