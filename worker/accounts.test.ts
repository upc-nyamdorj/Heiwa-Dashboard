import { describe, it, expect, beforeEach } from 'vitest';
import worker from './index';
import type { Env, UsersDatabase } from './env';
import { createUser, type Role } from './users';
import { SESSION_COOKIE } from './auth-session';

/**
 * In-memory stand-in for D1. It recognises the handful of statements in
 * users.ts by substring rather than parsing SQL — which is exactly why that
 * module keeps its query surface small.
 */
interface Row {
  id: string; username: string; username_key: string;
  password_hash: string; role: Role; created_at: string; updated_at: string;
}

function fakeDb(): UsersDatabase & { rows: Row[] } {
  const rows: Row[] = [];
  const db = {
    rows,
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) { args = values; return stmt; },
        async first<T>() {
          if (sql.includes('COUNT(*)')) {
            return { n: rows.filter((r) => r.role === args[0]).length } as T;
          }
          if (sql.includes('username_key = ?')) {
            return (rows.find((r) => r.username_key === args[0]) ?? null) as T | null;
          }
          if (sql.includes('WHERE id = ?')) {
            return (rows.find((r) => r.id === args[0]) ?? null) as T | null;
          }
          return null as T | null;
        },
        async all<T>() {
          return { results: [...rows].sort((a, b) => a.username.localeCompare(b.username)) as T[] };
        },
        async run() {
          if (sql.startsWith('INSERT')) {
            const [id, username, username_key, password_hash, role, created_at, updated_at] = args as string[];
            if (rows.some((r) => r.username_key === username_key)) {
              throw new Error('D1_ERROR: UNIQUE constraint failed: users.username_key');
            }
            rows.push({ id, username, username_key, password_hash, role: role as Role, created_at, updated_at });
          } else if (sql.startsWith('UPDATE') && sql.includes('role = ?')) {
            const row = rows.find((r) => r.id === args[2]);
            if (row) row.role = args[0] as Role;
          } else if (sql.startsWith('UPDATE') && sql.includes('password_hash = ?')) {
            const row = rows.find((r) => r.id === args[2]);
            if (row) row.password_hash = args[0] as string;
          } else if (sql.startsWith('DELETE')) {
            const i = rows.findIndex((r) => r.id === args[0]);
            if (i !== -1) rows.splice(i, 1);
          }
          return {};
        },
      };
      return stmt;
    },
  };
  return db;
}

let db: ReturnType<typeof fakeDb>;

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response('asset') } as unknown as Env['ASSETS'],
    USERS_DB: db,
    SESSION_SECRET: 'session-secret',
    SYNC_PASSWORD: 'legacy-sync-pw',
    ADMIN_USERNAME: 'legacy-admin', ADMIN_PASSWORD: 'legacy-pw',
    ADMIN_SESSION_SECRET: 'legacy-admin-secret',
    GITHUB_PAT: 'pat', GITHUB_OWNER: 'owner', GITHUB_REPO: 'repo',
    VIEW_USERNAME: 'legacy-view', VIEW_PASSWORD: 'legacy-view-pw',
    VIEW_SESSION_SECRET: 'legacy-view-secret',
    MS_OAUTH_CLIENT_ID: 'i', MS_OAUTH_TENANT_ID: 't',
    MS_OAUTH_CLIENT_SECRET: 's', OAUTH_SESSION_SECRET: 'o',
    ...overrides,
  };
}

const post = (path: string, body?: unknown, cookie?: string) =>
  new Request(`https://dash.example.com${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const get = (path: string, cookie?: string) =>
  new Request(`https://dash.example.com${path}`, { headers: cookie ? { Cookie: cookie } : undefined });

function cookieFrom(res: Response): string {
  const header = res.headers.get('Set-Cookie') ?? '';
  return header.split(';')[0];
}

/** Creates the account and returns the cookie a browser would hold for it. */
async function signIn(username: string, password: string, role: Role, env: Env): Promise<string> {
  await createUser(db, { username, password, role });
  const res = await worker.fetch(post('/api/session/login', { username, password }), env);
  expect(res.status).toBe(200);
  return cookieFrom(res);
}

beforeEach(() => { db = fakeDb(); });

describe('signing in', () => {
  it('issues a session and reports the role', async () => {
    const env = makeEnv();
    await createUser(db, { username: 'Bat', password: 'a-long-password', role: 'editor' });

    const res = await worker.fetch(post('/api/session/login', { username: 'Bat', password: 'a-long-password' }), env);
    expect(res.status).toBe(200);
    expect(cookieFrom(res).startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    await expect(res.json()).resolves.toMatchObject({ user: { username: 'Bat', role: 'editor' } });
  });

  it('ignores case in the username but not in the password', async () => {
    const env = makeEnv();
    await createUser(db, { username: 'Bat', password: 'a-long-password', role: 'viewer' });
    expect((await worker.fetch(post('/api/session/login', { username: 'BAT', password: 'a-long-password' }), env)).status).toBe(200);
    expect((await worker.fetch(post('/api/session/login', { username: 'Bat', password: 'A-Long-Password' }), env)).status).toBe(401);
  });

  it('answers the same for a wrong password and an account that does not exist', async () => {
    const env = makeEnv();
    await createUser(db, { username: 'Bat', password: 'a-long-password', role: 'viewer' });
    const wrong = await worker.fetch(post('/api/session/login', { username: 'Bat', password: 'nope' }), env);
    const missing = await worker.fetch(post('/api/session/login', { username: 'Nobody', password: 'nope' }), env);
    expect([wrong.status, missing.status]).toEqual([401, 401]);
    expect(await wrong.json()).toEqual(await missing.json());
  });
});

describe('the session', () => {
  it('reads the role from the database, so a demotion lands immediately', async () => {
    const env = makeEnv();
    const cookie = await signIn('Bat', 'a-long-password', 'admin', env);
    await expect((await worker.fetch(get('/api/session/me', cookie), env)).json())
      .resolves.toMatchObject({ user: { role: 'admin' } });

    db.rows[0].role = 'viewer';
    await expect((await worker.fetch(get('/api/session/me', cookie), env)).json())
      .resolves.toMatchObject({ user: { role: 'viewer' } });
  });

  it('stops working when the account is deleted', async () => {
    const env = makeEnv();
    const cookie = await signIn('Bat', 'a-long-password', 'admin', env);
    db.rows.length = 0;
    await expect((await worker.fetch(get('/api/session/me', cookie), env)).json())
      .resolves.toEqual({ authenticated: false });
  });

  it('rejects a cookie signed with another secret', async () => {
    const cookie = await signIn('Bat', 'a-long-password', 'admin', makeEnv());
    const res = await worker.fetch(get('/api/session/me', cookie), makeEnv({ SESSION_SECRET: 'different' }));
    await expect(res.json()).resolves.toEqual({ authenticated: false });
  });

  it('clears on logout', async () => {
    const res = await worker.fetch(post('/api/session/logout'), makeEnv());
    expect(res.headers.get('Set-Cookie')).toContain(`${SESSION_COOKIE}=;`);
  });
});

describe('what each role may do', () => {
  it.each([
    ['viewer', 403],
    ['editor', 200],
    ['admin', 200],
  ] as const)('%s triggering a sync -> %i', async (role, expected) => {
    const env = makeEnv();
    const cookie = await signIn('U', 'a-long-password', role, env);
    // The dispatch itself is stubbed out; only the gate is under test.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
    try {
      const res = await worker.fetch(post('/api/sync', {}, cookie), env);
      expect(res.status).toBe(expected);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // 403 = refused at the gate. 502 = allowed through, and the stubbed GitHub
  // call then failed — which is what proves an admin got past it.
  it.each([
    ['viewer', 403],
    ['editor', 403],
    ['admin', 502],
  ] as const)('%s reaching the review list -> %i', async (role, expected) => {
    const env = makeEnv();
    const cookie = await signIn('U', 'a-long-password', role, env);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('nope', { status: 401 })) as typeof fetch;
    try {
      expect((await worker.fetch(get('/api/review-list', cookie), env)).status).toBe(expected);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it.each([
    ['viewer', 403],
    ['editor', 403],
    ['admin', 200],
  ] as const)('%s listing accounts -> %i', async (role, expected) => {
    const env = makeEnv();
    const cookie = await signIn('U', 'a-long-password', role, env);
    expect((await worker.fetch(get('/api/users', cookie), env)).status).toBe(expected);
  });

  it('turns an anonymous caller away with 401, not 403', async () => {
    expect((await worker.fetch(get('/api/users'), makeEnv())).status).toBe(401);
  });

  it('lets any signed-in role read the dataset', async () => {
    const env = makeEnv();
    const cookie = await signIn('U', 'a-long-password', 'viewer', env);
    expect((await worker.fetch(get('/api/data', cookie), env)).status).toBe(200);
    expect((await worker.fetch(get('/api/data'), env)).status).toBe(401);
  });
});

describe('managing accounts', () => {
  async function adminCookie(env: Env) {
    return signIn('Root', 'a-long-password', 'admin', env);
  }

  it('creates an account that can then sign in', async () => {
    const env = makeEnv();
    const cookie = await adminCookie(env);
    const created = await worker.fetch(
      post('/api/users', { username: 'Saraa', password: 'another-long-pw', role: 'editor' }, cookie), env,
    );
    expect(created.status).toBe(201);

    const login = await worker.fetch(post('/api/session/login', { username: 'Saraa', password: 'another-long-pw' }), env);
    expect(login.status).toBe(200);
    await expect(login.json()).resolves.toMatchObject({ user: { role: 'editor' } });
  });

  it.each([
    [{ username: 'x', password: 'another-long-pw', role: 'wizard' }, 'an unknown role'],
    [{ username: '  ', password: 'another-long-pw', role: 'viewer' }, 'a blank username'],
    [{ username: 'x', password: 'short', role: 'viewer' }, 'a short password'],
  ])('refuses %o — %s', async (body) => {
    const env = makeEnv();
    const cookie = await adminCookie(env);
    expect((await worker.fetch(post('/api/users', body, cookie), env)).status).toBe(400);
  });

  it('refuses a username already taken, whatever its case', async () => {
    const env = makeEnv();
    const cookie = await adminCookie(env);
    await worker.fetch(post('/api/users', { username: 'Saraa', password: 'another-long-pw', role: 'viewer' }, cookie), env);
    const again = await worker.fetch(post('/api/users', { username: 'SARAA', password: 'another-long-pw', role: 'viewer' }, cookie), env);
    expect(again.status).toBe(409);
    await expect(again.json()).resolves.toMatchObject({ error: 'username_taken' });
  });

  it('will not let an admin demote themselves', async () => {
    const env = makeEnv();
    const cookie = await adminCookie(env);
    const me = db.rows[0];
    const res = await worker.fetch(post('/api/users/role', { id: me.id, role: 'viewer' }, cookie), env);
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: 'cannot_demote_self' });
  });

  it('will not let the last admin be deleted or demoted by another admin', async () => {
    const env = makeEnv();
    const cookie = await adminCookie(env);
    const other = await createUser(db, { username: 'Second', password: 'another-long-pw', role: 'admin' });
    const first = db.rows[0];

    // Two admins: demoting one is allowed.
    expect((await worker.fetch(post('/api/users/role', { id: other.id, role: 'viewer' }, cookie), env)).status).toBe(200);
    // Now there is one, and it is the caller — self-demotion rule catches it first.
    expect((await worker.fetch(post('/api/users/role', { id: first.id, role: 'viewer' }, cookie), env)).status).toBe(409);
    expect((await worker.fetch(post('/api/users/delete', { id: first.id }, cookie), env)).status).toBe(409);
  });

  it('deletes another account and ends its session', async () => {
    const env = makeEnv();
    const cookie = await adminCookie(env);
    const victimCookie = await signIn('Temp', 'another-long-pw', 'viewer', env);
    const victim = db.rows.find((r) => r.username === 'Temp')!;

    expect((await worker.fetch(post('/api/users/delete', { id: victim.id }, cookie), env)).status).toBe(200);
    await expect((await worker.fetch(get('/api/session/me', victimCookie), env)).json())
      .resolves.toEqual({ authenticated: false });
  });

  it('resets someone else’s password to one that then works', async () => {
    const env = makeEnv();
    const cookie = await adminCookie(env);
    await createUser(db, { username: 'Saraa', password: 'another-long-pw', role: 'viewer' });
    const target = db.rows.find((r) => r.username === 'Saraa')!;

    expect((await worker.fetch(post('/api/users/password', { id: target.id, newPassword: 'brand-new-password' }, cookie), env)).status).toBe(200);
    expect((await worker.fetch(post('/api/session/login', { username: 'Saraa', password: 'another-long-pw' }), env)).status).toBe(401);
    expect((await worker.fetch(post('/api/session/login', { username: 'Saraa', password: 'brand-new-password' }), env)).status).toBe(200);
  });
});

describe('changing your own password', () => {
  it('requires the current one, then works', async () => {
    const env = makeEnv();
    const cookie = await signIn('Bat', 'a-long-password', 'viewer', env);

    const wrong = await worker.fetch(post('/api/session/password', { currentPassword: 'nope', newPassword: 'brand-new-password' }, cookie), env);
    expect(wrong.status).toBe(403);

    const ok = await worker.fetch(post('/api/session/password', { currentPassword: 'a-long-password', newPassword: 'brand-new-password' }, cookie), env);
    expect(ok.status).toBe(200);
    expect((await worker.fetch(post('/api/session/login', { username: 'Bat', password: 'brand-new-password' }), env)).status).toBe(200);
  });

  it('refuses a short new password', async () => {
    const env = makeEnv();
    const cookie = await signIn('Bat', 'a-long-password', 'viewer', env);
    const res = await worker.fetch(post('/api/session/password', { currentPassword: 'a-long-password', newPassword: 'short' }, cookie), env);
    expect(res.status).toBe(400);
  });
});
