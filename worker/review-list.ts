import { getFile, decodeBase64Json } from '../cf/lib/github';
import { verifySessionToken, parseCookie, COOKIE_NAME } from '../cf/lib/session';
import { jsonResponse } from '../cf/lib/response';
import type { Env } from './env';

const PENDING_PATH = 'data-private/pending-review.json';

export async function handleReviewList(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const token = parseCookie(request.headers.get('Cookie'), COOKIE_NAME);
  const session = await verifySessionToken(token, env.ADMIN_SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'unauthorized' }, 401);

  try {
    const file = await getFile({
      owner: env.GITHUB_OWNER,
      repo: env.GITHUB_REPO,
      token: env.GITHUB_PAT,
      path: PENDING_PATH,
    });
    const records = decodeBase64Json<unknown[]>(file.contentBase64);
    return jsonResponse({ records });
  } catch (err) {
    return jsonResponse({ error: 'fetch_failed', message: String(err) }, 502);
  }
}
