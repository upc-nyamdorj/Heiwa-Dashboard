import { handleSync } from './sync';
import { handleReviewLogin } from './review-login';
import { handleReviewList } from './review-list';
import { handleReviewAction } from './review-action';
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

    switch (pathname) {
      case '/api/sync':
        return handleSync(request, env);
      case '/api/review-login':
        return handleReviewLogin(request, env);
      case '/api/review-list':
        return handleReviewList(request, env);
      case '/api/review-action':
        return handleReviewAction(request, env);
      default:
        return env.ASSETS.fetch(request);
    }
  },
};
