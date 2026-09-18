import { describe, it, expect } from 'vitest';
import worker from './index';
import type { Env } from './env';
import { COOKIE_NAME, VIEW_COOKIE_NAME, createSessionToken } from '../cf/lib/session';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response('asset', { status: 200 }) } as unknown as Env['ASSETS'],
    SYNC_PASSWORD: 'sync-pw',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'admin-pw',
    ADMIN_SESSION_SECRET: 'admin-secret',
    GITHUB_PAT: 'pat',
    GITHUB_OWNER: 'owner',
    GITHUB_REPO: 'repo',
    VIEW_USERNAME: 'viewer',
    VIEW_PASSWORD: 'view-pw',
    VIEW_SESSION_SECRET: 'view-secret',
    MS_OAUTH_CLIENT_ID: 'id',
    MS_OAUTH_TENANT_ID: 'tenant',
    MS_OAUTH_CLIENT_SECRET: 'secret',
    OAUTH_SESSION_SECRET: 'oauth-secret',
    ...overrides,
  };
}

function cookieValue(res: Response, name: string): string | undefined {
  const header = res.headers.get('Set-Cookie');
  if (!header || !header.startsWith(`${name}=`)) return undefined;
  return header.slice(name.length + 1).split(';')[0];
}

function login(body: unknown): Request {
  return new Request('https://dash.example.com/api/view-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const me = (cookie?: string) =>
  new Request('https://dash.example.com/api/view-auth/me', {
    headers: cookie ? { Cookie: cookie } : undefined,
  });

describe('/api/view-auth/login', () => {
  it('issues a view session for the right credentials', async () => {
    const res = await worker.fetch(login({ username: 'viewer', password: 'view-pw' }), makeEnv());
    expect(res.status).toBe(200);
    expect(cookieValue(res, VIEW_COOKIE_NAME)).toBeTruthy();
    expect(res.headers.get('Set-Cookie')).toContain('HttpOnly');
    expect(res.headers.get('Set-Cookie')).toContain('SameSite=Strict');
  });

  it.each([
    [{ username: 'viewer', password: 'wrong' }, 'wrong password'],
    [{ username: 'nobody', password: 'view-pw' }, 'wrong username'],
    [{}, 'nothing at all'],
  ])('refuses %o (%s)', async (body) => {
    const res = await worker.fetch(login(body), makeEnv());
    expect(res.status).toBe(401);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  it('does not accept the admin credentials — the two accounts are separate', async () => {
    const res = await worker.fetch(login({ username: 'admin', password: 'admin-pw' }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('says so when the secrets are not set, rather than failing as a bad password', async () => {
    const res = await worker.fetch(
      login({ username: 'viewer', password: 'view-pw' }),
      makeEnv({ VIEW_USERNAME: '', VIEW_PASSWORD: '' }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: 'view_auth_not_configured',
      missing: ['VIEW_USERNAME', 'VIEW_PASSWORD'],
    });
  });

  it('rejects a GET', async () => {
    const res = await worker.fetch(new Request('https://dash.example.com/api/view-auth/login'), makeEnv());
    expect(res.status).toBe(405);
  });
});

describe('/api/view-auth/me', () => {
  it('is false with no cookie', async () => {
    const res = await worker.fetch(me(), makeEnv());
    await expect(res.json()).resolves.toEqual({ authenticated: false });
  });

  it('is true after logging in', async () => {
    const env = makeEnv();
    const issued = await worker.fetch(login({ username: 'viewer', password: 'view-pw' }), env);
    const token = cookieValue(issued, VIEW_COOKIE_NAME) as string;
    const res = await worker.fetch(me(`${VIEW_COOKIE_NAME}=${token}`), env);
    await expect(res.json()).resolves.toEqual({ authenticated: true });
  });

  it('accepts an admin session too, so an admin is not locked out of the dashboard', async () => {
    const env = makeEnv();
    const token = await createSessionToken('admin', env.ADMIN_SESSION_SECRET);
    const res = await worker.fetch(me(`${COOKIE_NAME}=${token}`), env);
    await expect(res.json()).resolves.toEqual({ authenticated: true });
  });

  it('rejects a view cookie signed with another secret', async () => {
    const token = await createSessionToken('view', 'some-other-secret');
    const res = await worker.fetch(me(`${VIEW_COOKIE_NAME}=${token}`), makeEnv());
    await expect(res.json()).resolves.toEqual({ authenticated: false });
  });

  it('rejects a view cookie that is really an admin token, and vice versa', async () => {
    const env = makeEnv();
    const adminToken = await createSessionToken('admin', env.ADMIN_SESSION_SECRET);
    const viewToken = await createSessionToken('view', env.VIEW_SESSION_SECRET);
    // An admin token presented in the view cookie is verified with the view
    // secret, so it fails — the separation holds in both directions.
    await expect(
      (await worker.fetch(me(`${VIEW_COOKIE_NAME}=${adminToken}`), env)).json(),
    ).resolves.toEqual({ authenticated: false });
    await expect(
      (await worker.fetch(me(`${COOKIE_NAME}=${viewToken}`), env)).json(),
    ).resolves.toEqual({ authenticated: false });
  });
});

describe('/api/view-auth/logout', () => {
  it('clears the view cookie and leaves the admin one alone', async () => {
    const res = await worker.fetch(
      new Request('https://dash.example.com/api/view-auth/logout', { method: 'POST' }),
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain(`${VIEW_COOKIE_NAME}=;`);
    expect(res.headers.get('Set-Cookie')).not.toContain(COOKIE_NAME);
  });
});
