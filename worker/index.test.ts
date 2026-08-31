import { describe, it, expect } from 'vitest';
import worker from './index';
import type { Env } from './env';

function makeEnv(overrides: Partial<Env> = {}): Env {
  const assetsCalls: Request[] = [];
  return {
    ASSETS: {
      fetch: async (req: Request) => {
        assetsCalls.push(req);
        return new Response('asset', { status: 200 });
      },
    } as unknown as Env['ASSETS'],
    SYNC_PASSWORD: 'sync-pw',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'admin-pw',
    ADMIN_SESSION_SECRET: 'session-secret',
    GITHUB_PAT: 'fake-pat',
    GITHUB_OWNER: 'owner',
    GITHUB_REPO: 'repo',
    ...overrides,
  };
}

describe('worker routing', () => {
  it('routes /api/sync to the sync handler (wrong password -> 401, not falling through to assets)', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request('https://example.com/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it('routes /api/review-login to the login handler', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request('https://example.com/api/review-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin-pw' }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('heiwa_admin_session=');
  });

  it('routes /api/review-list to the review-list handler (no cookie -> 401)', async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request('https://example.com/api/review-list'), env);
    expect(res.status).toBe(401);
  });

  it('routes /api/review-action to the review-action handler (no cookie -> 401)', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request('https://example.com/api/review-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: 'x', decision: 'approve' }),
      }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it('falls through to env.ASSETS.fetch for any non-api path', async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request('https://example.com/some/static/page'), env);
    expect(await res.text()).toBe('asset');
  });

  it('falls through to env.ASSETS.fetch for the root path', async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request('https://example.com/'), env);
    expect(await res.text()).toBe('asset');
  });
});
