/**
 * The account store. Every statement lives here so the SQL surface stays small
 * and the rest of the Worker deals in plain objects.
 */

import { hashPassword } from '../cf/lib/password';
import type { Env, UsersDatabase } from './env';

export const ROLES = ['viewer', 'editor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export interface User {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: Role;
  created_at: string;
}

/** Usernames are compared case-folded; the display form is kept as typed. */
export function usernameKey(username: string): string {
  return username.normalize('NFC').trim().toLowerCase();
}

function toUser(row: UserRow): User {
  return { id: row.id, username: row.username, role: row.role, createdAt: row.created_at };
}

export async function findByUsername(db: UsersDatabase, username: string): Promise<UserRow | null> {
  return db
    .prepare('SELECT id, username, password_hash, role, created_at FROM users WHERE username_key = ?')
    .bind(usernameKey(username))
    .first<UserRow>();
}

export async function findById(db: UsersDatabase, id: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT id, username, password_hash, role, created_at FROM users WHERE id = ?')
    .bind(id)
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export async function listUsers(db: UsersDatabase): Promise<User[]> {
  const { results } = await db
    .prepare('SELECT id, username, password_hash, role, created_at FROM users ORDER BY username COLLATE NOCASE')
    .all<UserRow>();
  return results.map(toUser);
}

export async function countByRole(db: UsersDatabase, role: Role): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM users WHERE role = ?')
    .bind(role)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`Username already in use: ${username}`);
    this.name = 'UsernameTakenError';
  }
}

export async function createUser(
  db: UsersDatabase,
  { username, password, role }: { username: string; password: string; role: Role },
): Promise<User> {
  const now = new Date().toISOString();
  const user: User = { id: crypto.randomUUID(), username: username.trim(), role, createdAt: now };

  try {
    await db
      .prepare(
        'INSERT INTO users (id, username, username_key, password_hash, role, created_at, updated_at)'
        + ' VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(user.id, user.username, usernameKey(username), await hashPassword(password), role, now, now)
      .run();
  } catch (err) {
    // UNIQUE(username_key) — the only constraint this statement can trip.
    if (String(err).includes('UNIQUE')) throw new UsernameTakenError(username);
    throw err;
  }
  return user;
}

export async function setRole(db: UsersDatabase, id: string, role: Role): Promise<void> {
  await db
    .prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
    .bind(role, new Date().toISOString(), id)
    .run();
}

export async function setPassword(db: UsersDatabase, id: string, password: string): Promise<void> {
  await db
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(await hashPassword(password), new Date().toISOString(), id)
    .run();
}

export async function deleteUser(db: UsersDatabase, id: string): Promise<void> {
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
}

export function usersDb(env: Env): UsersDatabase {
  return env.USERS_DB;
}
