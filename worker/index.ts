import { handleSync } from './sync';
import { handleReviewLogin } from './review-login';
import { handleReviewList } from './review-list';
import { handleReviewAction } from './review-action';
import { handleAuthLogin, handleAuthCallback, handleAuthMe, handleAuthLogout } from './auth';
import { handleViewLogin, handleViewLogout, handleViewMe } from './view-auth';
import { handleData } from './dataset';
import type { Env } from './env';

/**
 * Cloudflare project type here is Workers, not classic Pages — routes are
 * dispatched manually instead of via Pages Functions' file-based routing.
 * Static assets (the `out/` export) are intercepted and served by the
 * platform BEFORE this fetch handler runs for any URL that matches a real
 * file, per the `assets` binding in wrangler.jsonc — this handler only ever
 * sees /api/* requests and genuinely unmatched paths.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Match on the path without a trailing slash. Hand-typed URLs and some
    // redirectors add one, and an exact-match switch would drop those into the
    // static 404 page instead of the handler. Assets still see the original
    // request, so their own resolution is unchanged.
    const route = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

    const response = await dispatch(route, request, env);

    // Nothing under /api/ is storable — not a success, not a 401, not a 404.
    // Setting it per handler leaves gaps (jsonResponse sent no cache header at
    // all, so /api/auth/me and the review routes went out cacheable), and a
    // gap here is expensive: workers.dev is not a zone, so this account has no
    // purge to undo a bad cache entry with. One rule at the boundary instead.
    return isApiRoute(route) ? neverStore(response) : response;
  },
};

function isApiRoute(route: string): boolean {
  return route === '/api' || route.startsWith('/api/');
}

function dispatch(route: string, request: Request, env: Env): Promise<Response> | Response {
  switch (route) {
    case '/api/sync':
      return handleSync(request, env);
    case '/api/review-login':
      return handleReviewLogin(request, env);
    case '/api/review-list':
      return handleReviewList(request, env);
    case '/api/review-action':
      return handleReviewAction(request, env);
    case '/api/data':
      return handleData(request, env);
    case '/api/view-auth/login':
      return handleViewLogin(request, env);
    case '/api/view-auth/logout':
      return handleViewLogout(request);
    case '/api/view-auth/me':
      return handleViewMe(request, env);
    case '/api/auth/login':
      return handleAuthLogin(request, env);
    case '/api/auth/callback':
      return handleAuthCallback(request, env);
    case '/api/auth/me':
      return handleAuthMe(request, env);
    case '/api/auth/logout':
      return handleAuthLogout(request);
    default:
      return serveAsset(request, env);
  }
}

/** Rewrites Cache-Control on a copy; the original Response may already be sent. */
function neverStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * The assets layer answers a miss with the 404 page under
 * `public, max-age=0, must-revalidate`, which lets edges and browsers hold a
 * copy. That is the wrong lifetime for "this path is not a route yet": the
 * moment a route ships, every held copy is a lie, and workers.dev is not a
 * zone so there is no purge button to reach for. Routes are cheap to re-ask
 * for, so misses are marked never-store. Real assets keep their own caching.
 */
async function serveAsset(request: Request, env: Env): Promise<Response> {
  const res = await env.ASSETS.fetch(request);
  if (res.status !== 404) return res;

  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
