/**
 * The one session the dashboard has, replacing heiwa_view_session and
 * heiwa_admin_session.
 *
 * The cookie carries only the user id. Role is read from the database on every
 * request, so demoting or deleting someone takes effect on their next click
 * rather than whenever their cookie happens to expire — a signed role would
 * stay valid for the rest of its hour.
 */

import { parseCookie } from '../cf/lib/session';
import { nowSeconds, signToken, verifyToken } from '../cf/lib/signed-token';
import { findById, type Role, type User } from './users';
import type { Env } from './env';

export const SESSION_COOKIE = 'heiwa_session';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

interface SessionPayload {
  sub: string;
  exp: number;
}

export async function createSessionCookie(userId: string, secret: string): Promise<string> {
  const token = await signToken({ sub: userId, exp: nowSeconds() + SESSION_TTL_SECONDS }, secret);
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/** The signed-in user, or null. Returns null for a deleted account too. */
export async function currentUser(request: Request, env: Env): Promise<User | null> {
  if (!env.SESSION_SECRET) return null;
  const payload = await verifyToken<SessionPayload>(
    parseCookie(request.headers.get('Cookie'), SESSION_COOKIE),
    env.SESSION_SECRET,
  );
  if (!payload?.sub) return null;
  return findById(env.USERS_DB, payload.sub);
}

/**
 * Roles are cumulative: an admin can do anything an editor can, an editor
 * anything a viewer can. Expressed as a rank so a check reads as a minimum
 * rather than a list of roles to keep in sync at every call site.
 */
const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };

export function atLeast(user: User | null, role: Role): user is User {
  return !!user && RANK[user.role] >= RANK[role];
}

/**
 * Bridges the two systems while accounts are being rolled out: an account
 * session first, then the shared VIEW_/ADMIN_ cookies. The fallback goes away
 * with those secrets once everyone has an account — until then removing it
 * would lock out everyone who has not been given one yet.
 */
export async function canViewDashboard(request: Request, env: Env): Promise<boolean> {
  if (await currentUser(request, env)) return true;
  const { hasViewAccess } = await import('./view-auth');
  return hasViewAccess(request, env);
}
