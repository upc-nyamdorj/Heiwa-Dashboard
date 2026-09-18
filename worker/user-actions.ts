/** Account operations that combine a lookup with a password check. */

import { verifyPassword } from '../cf/lib/password';
import { findByUsername, type User } from './users';
import type { UsersDatabase } from './env';

export { setPassword, setRole, deleteUser, createUser, listUsers, countByRole, findByUsername } from './users';

/**
 * The account, if that password belongs to it. Runs the hash comparison even
 * when there is no such user so a missing account and a wrong password take
 * roughly the same time to answer.
 */
export async function verifyCurrentPassword(
  db: UsersDatabase,
  username: string,
  password: string,
): Promise<User | null> {
  const row = await findByUsername(db, username);
  const stored = row?.password_hash ?? 'pbkdf2$sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const ok = await verifyPassword(password, stored);
  if (!row || !ok) return null;
  return { id: row.id, username: row.username, role: row.role, createdAt: row.created_at };
}
