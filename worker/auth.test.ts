import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from './index';
import type { Env } from './env';
import { MS_SESSION_COOKIE, OAUTH_TX_COOKIE } from '../cf/lib/oauth-session';

const TENANT = 'tenant-abc';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response('asset', { status: 200 }) } as unknown as Env['ASSETS'],
    USERS_DB: {
      prepare: () => { throw new Error('USERS_DB not stubbed in this test'); },
    } as unknown as Env['USERS_DB'],
    SESSION_SECRET: 'session-secret',
    SYNC_PASSWORD: 'sync-pw',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'admin-pw',
    ADMIN_SESSION_SECRET: 'session-secret',
    GITHUB_PAT: 'fake-pat',
    GITHUB_OWNER: 'owner',
    GITHUB_REPO: 'repo',
    VIEW_USERNAME: 'viewer',
    VIEW_PASSWORD: 'view-pw',
    VIEW_SESSION_SECRET: 'view-secret',
    MS_OAUTH_CLIENT_ID: 'client-id',
    MS_OAUTH_TENANT_ID: TENANT,
    MS_OAUTH_CLIENT_SECRET: 'client-secret',
    OAUTH_SESSION_SECRET: 'oauth-secret',
    ...overrides,
  };
}

function b64url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fakeIdToken(claims: Record<string, unknown>): string {
  return `${b64url(JSON.stringify({ alg: 'RS256' }))}.${b64url(JSON.stringify(claims))}.sig`;
}

/** Pulls one cookie's value out of the Set-Cookie headers on a response. */
function cookieValue(res: Response, name: string): string | undefined {
  const header = res.headers.getSetCookie?.().find((c) => c.startsWith(`${name}=`))
    ?? res.headers.get('Set-Cookie') ?? undefined;
  if (!header || !header.startsWith(`${name}=`)) return undefined;
  return header.slice(name.length + 1).split(';')[0];
}

/** Runs /api/auth/login and returns the state + the tx cookie the browser would keep. */
async function startLogin(env: Env, next?: string) {
  const url = new URL('https://dash.example.com/api/auth/login');
  if (next) url.searchParams.set('next', next);
  const res = await worker.fetch(new Request(url), env);
  const location = new URL(res.headers.get('Location') as string);
  return {
    res,
    location,
    state: location.searchParams.get('state') as string,
    txCookie: cookieValue(res, OAUTH_TX_COOKIE) as string,
  };
}

/** Every callback failure is a 302 back to the dashboard carrying an error code. */
function expectAuthFailure(res: Response, code: string) {
  expect(res.status).toBe(302);
  expect(res.headers.get('Location')).toBe(`/?error=${code}`);
}

afterEach(() => vi.unstubAllGlobals());

describe('/api/auth/login', () => {
  it('redirects to the tenant authorize endpoint with PKCE and a tx cookie', async () => {
    const { res, location, txCookie } = await startLogin(makeEnv());

    expect(res.status).toBe(302);
    expect(location.origin + location.pathname)
      .toBe(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`);
    expect(location.searchParams.get('client_id')).toBe('client-id');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('redirect_uri'))
      .toBe('https://dash.example.com/api/auth/callback');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('code_challenge')).toBeTruthy();
    expect(location.searchParams.get('scope')).toContain('openid');
    expect(txCookie).toBeTruthy();
  });

  it('reports which variables are missing instead of redirecting to a broken authorize URL', async () => {
    const env = makeEnv({ MS_OAUTH_CLIENT_ID: '', OAUTH_SESSION_SECRET: '' });
    const res = await worker.fetch(new Request('https://dash.example.com/api/auth/login'), env);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'oauth_not_configured',
      missing: ['MS_OAUTH_CLIENT_ID', 'OAUTH_SESSION_SECRET'],
    });
  });
});

describe('/api/auth/callback', () => {
  function stubTokenEndpoint(claims: Record<string, unknown>, init: { ok?: boolean } = {}) {
    const calls: Array<{ url: string; body: URLSearchParams }> = [];
    vi.stubGlobal('fetch', async (url: string, opts: RequestInit) => {
      calls.push({ url: String(url), body: new URLSearchParams(opts.body as string) });
      if (init.ok === false) return new Response('nope', { status: 400 });
      return new Response(JSON.stringify({ id_token: fakeIdToken(claims) }), { status: 200 });
    });
    return calls;
  }

  it('exchanges the code and sets a session cookie, then redirects to next', async () => {
    const env = makeEnv();
    const { state, txCookie } = await startLogin(env, '/review');
    const calls = stubTokenEndpoint({
      sub: 'user-oid-1',
      tid: TENANT,
      // A dot-bearing UPN — the reason this flow cannot reuse cf/lib/session.ts.
      preferred_username: 'nyamdorj.m@upc.mn',
      name: 'Nyamdorj M',
    });

    const res = await worker.fetch(
      new Request(`https://dash.example.com/api/auth/callback?code=the-code&state=${state}`, {
        headers: { Cookie: `${OAUTH_TX_COOKIE}=${txCookie}` },
      }),
      env,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/review');
    expect(calls[0].url).toBe(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`);
    expect(calls[0].body.get('grant_type')).toBe('authorization_code');
    expect(calls[0].body.get('code')).toBe('the-code');
    expect(calls[0].body.get('code_verifier')).toBeTruthy();
    expect(calls[0].body.get('client_secret')).toBe('client-secret');
    expect(cookieValue(res, MS_SESSION_COOKIE)).toBeTruthy();
  });

  it('makes the new session readable by /api/auth/me, dots in the address and all', async () => {
    const env = makeEnv();
    const { state, txCookie } = await startLogin(env);
    stubTokenEndpoint({
      sub: 'user-oid-1',
      tid: TENANT,
      email: 'nyamdorj.m@upc.mn',
      name: 'Nyamdorj M',
    });
    const callback = await worker.fetch(
      new Request(`https://dash.example.com/api/auth/callback?code=c&state=${state}`, {
        headers: { Cookie: `${OAUTH_TX_COOKIE}=${txCookie}` },
      }),
      env,
    );
    const session = cookieValue(callback, MS_SESSION_COOKIE) as string;

    const me = await worker.fetch(
      new Request('https://dash.example.com/api/auth/me', {
        headers: { Cookie: `${MS_SESSION_COOKIE}=${session}` },
      }),
      env,
    );
    await expect(me.json()).resolves.toEqual({
      authenticated: true,
      user: { sub: 'user-oid-1', email: 'nyamdorj.m@upc.mn', name: 'Nyamdorj M' },
    });
  });

  it('refuses a state that does not match the tx cookie', async () => {
    const env = makeEnv();
    const { txCookie } = await startLogin(env);
    const res = await worker.fetch(
      new Request('https://dash.example.com/api/auth/callback?code=c&state=forged', {
        headers: { Cookie: `${OAUTH_TX_COOKIE}=${txCookie}` },
      }),
      env,
    );
    expectAuthFailure(res, 'state_mismatch');
  });

  it('refuses a callback with no tx cookie at all', async () => {
    const res = await worker.fetch(
      new Request('https://dash.example.com/api/auth/callback?code=c&state=s'),
      makeEnv(),
    );
    expectAuthFailure(res, 'expired_or_missing_state');
  });

  it('surfaces an error Entra reported on the redirect itself', async () => {
    const res = await worker.fetch(
      new Request('https://dash.example.com/api/auth/callback?error=access_denied&error_description=nope'),
      makeEnv(),
    );
    expectAuthFailure(res, 'access_denied');
  });

  it('does not leak the Entra error body when the token exchange fails', async () => {
    const env = makeEnv();
    const { state, txCookie } = await startLogin(env);
    stubTokenEndpoint({}, { ok: false });
    const res = await worker.fetch(
      new Request(`https://dash.example.com/api/auth/callback?code=c&state=${state}`, {
        headers: { Cookie: `${OAUTH_TX_COOKIE}=${txCookie}` },
      }),
      env,
    );
    expectAuthFailure(res, 'token_exchange_failed');
    // Entra's own error text never reaches the address bar.
    expect(res.headers.get('Location')).not.toContain('nope');
  });

  it('rejects an id_token minted by another tenant', async () => {
    const env = makeEnv();
    const { state, txCookie } = await startLogin(env);
    stubTokenEndpoint({ sub: 'x', tid: 'some-other-tenant', email: 'someone@upc.mn' });
    const res = await worker.fetch(
      new Request(`https://dash.example.com/api/auth/callback?code=c&state=${state}`, {
        headers: { Cookie: `${OAUTH_TX_COOKIE}=${txCookie}` },
      }),
      env,
    );
    expectAuthFailure(res, 'wrong_tenant');
  });

  it.each([
    ['guest@outlook.com', 'a personal account'],
    ['partner@notupc.mn', 'a lookalike domain'],
    ['', 'an id_token carrying no address at all'],
  ])('turns away %s (%s)', async (email) => {
    const env = makeEnv();
    const { state, txCookie } = await startLogin(env);
    stubTokenEndpoint(email ? { sub: 'x', tid: TENANT, email } : { sub: 'x', tid: TENANT });
    const res = await worker.fetch(
      new Request(`https://dash.example.com/api/auth/callback?code=c&state=${state}`, {
        headers: { Cookie: `${OAUTH_TX_COOKIE}=${txCookie}` },
      }),
      env,
    );
    expectAuthFailure(res, 'wrong_domain');
    expect(cookieValue(res, MS_SESSION_COOKIE)).toBeUndefined();
  });

  it('accepts the corporate domain whatever case it arrives in', async () => {
    const env = makeEnv();
    const { state, txCookie } = await startLogin(env);
    stubTokenEndpoint({ sub: 'x', tid: TENANT, email: 'Nyamdorj.M@UPC.MN', name: 'N M' });
    const res = await worker.fetch(
      new Request(`https://dash.example.com/api/auth/callback?code=c&state=${state}`, {
        headers: { Cookie: `${OAUTH_TX_COOKIE}=${txCookie}` },
      }),
      env,
    );
    expect(res.headers.get('Location')).toBe('/');
    expect(cookieValue(res, MS_SESSION_COOKIE)).toBeTruthy();
  });

  it('ignores an off-site next, so ?next= cannot become an open redirect', async () => {
    const env = makeEnv();
    const { state, txCookie } = await startLogin(env, '//evil.example.com/steal');
    stubTokenEndpoint({ sub: 'x', tid: TENANT, email: 'someone@upc.mn' });
    const res = await worker.fetch(
      new Request(`https://dash.example.com/api/auth/callback?code=c&state=${state}`, {
        headers: { Cookie: `${OAUTH_TX_COOKIE}=${txCookie}` },
      }),
      env,
    );
    expect(res.headers.get('Location')).toBe('/');
  });
});

describe('/api/auth/me and /api/auth/logout', () => {
  it('reports an anonymous caller', async () => {
    const res = await worker.fetch(new Request('https://dash.example.com/api/auth/me'), makeEnv());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ authenticated: false });
  });

  it('rejects a session cookie signed with a different secret', async () => {
    const env = makeEnv();
    const { state, txCookie } = await startLogin(env);
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({ id_token: fakeIdToken({ sub: 'x', tid: TENANT, email: 'someone@upc.mn' }) }),
      { status: 200 },
    ));
    const callback = await worker.fetch(
      new Request(`https://dash.example.com/api/auth/callback?code=c&state=${state}`, {
        headers: { Cookie: `${OAUTH_TX_COOKIE}=${txCookie}` },
      }),
      env,
    );
    const session = cookieValue(callback, MS_SESSION_COOKIE) as string;

    const res = await worker.fetch(
      new Request('https://dash.example.com/api/auth/me', {
        headers: { Cookie: `${MS_SESSION_COOKIE}=${session}` },
      }),
      makeEnv({ OAUTH_SESSION_SECRET: 'a-different-secret' }),
    );
    await expect(res.json()).resolves.toEqual({ authenticated: false });
  });

  it('clears the session cookie on logout and refuses GET', async () => {
    const env = makeEnv();
    const post = await worker.fetch(
      new Request('https://dash.example.com/api/auth/logout', { method: 'POST' }), env,
    );
    expect(post.status).toBe(200);
    expect(post.headers.get('Set-Cookie')).toContain(`${MS_SESSION_COOKIE}=;`);

    const get = await worker.fetch(new Request('https://dash.example.com/api/auth/logout'), env);
    expect(get.status).toBe(405);
  });
});

describe('route matching', () => {
  it.each([
    '/api/auth/me/',
    '/api/auth/me//',
  ])('still reaches the handler when the path arrives as %s', async (path) => {
    const res = await worker.fetch(new Request(`https://dash.example.com${path}`), makeEnv());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ authenticated: false });
  });

  it('leaves the root path alone', async () => {
    const env = makeEnv();
    const res = await worker.fetch(new Request('https://dash.example.com/'), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('asset');
  });

  it('still falls through to assets for a genuinely unknown path', async () => {
    const res = await worker.fetch(new Request('https://dash.example.com/api/auth/nope'), makeEnv());
    expect(await res.text()).toBe('asset');
  });
});

describe('asset misses', () => {
  /** ASSETS stand-in that answers like the real 404 page, caching header and all. */
  function notFoundAssets(): Env['ASSETS'] {
    return {
      fetch: async () =>
        new Response('<html>not found</html>', {
          status: 404,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=0, must-revalidate',
          },
        }),
    } as unknown as Env['ASSETS'];
  }

  it('never lets a 404 be stored, so a route shipped later is not shadowed by it', async () => {
    const res = await worker.fetch(
      new Request('https://dash.example.com/api/auth/not-a-route-yet'),
      makeEnv({ ASSETS: notFoundAssets() }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Content-Type')).toBe('text/html');
  });

  it('leaves a successfully served asset untouched', async () => {
    const assets = {
      fetch: async () =>
        new Response('body', { status: 200, headers: { 'Cache-Control': 'public, max-age=31536000' } }),
    } as unknown as Env['ASSETS'];
    const res = await worker.fetch(new Request('https://dash.example.com/logo.svg'), makeEnv({ ASSETS: assets }));
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000');
  });
});

describe('no /api response is storable', () => {
  /**
   * The gap this guards: handlers that answer through jsonResponse set no
   * Cache-Control at all, so Cloudflare applied its own default and the
   * response became cacheable. This account has no zone, so a bad entry
   * cannot be purged — the header is the only control there is.
   */
  it.each([
    ['/api/auth/me', 'GET', 200],
    ['/api/auth/login', 'GET', 302],
    ['/api/auth/logout', 'POST', 200],
    ['/api/auth/logout', 'GET', 405],
    ['/api/sync', 'GET', 405],
    ['/api/review-list', 'GET', 401],
    ['/api/auth/callback', 'GET', 302],
    ['/api/auth/unknown-route', 'GET', 404],
    ['/api/auth/me/', 'GET', 200],
  ])('%s (%s) answers %i with no-store', async (path, method, status) => {
    const env = makeEnv({
      ASSETS: {
        fetch: async () => new Response('404 page', {
          status: 404,
          headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' },
        }),
      } as unknown as Env['ASSETS'],
    });
    const res = await worker.fetch(new Request(`https://dash.example.com${path}`, { method }), env);
    expect(res.status).toBe(status);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('leaves a non-api asset response caching exactly as it was', async () => {
    const env = makeEnv({
      ASSETS: {
        fetch: async () => new Response('js', {
          status: 200,
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
        }),
      } as unknown as Env['ASSETS'],
    });
    const res = await worker.fetch(new Request('https://dash.example.com/_next/static/chunks/a.js'), env);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });
});
