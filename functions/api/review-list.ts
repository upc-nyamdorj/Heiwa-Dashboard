import { getFile, decodeBase64Json } from '../../cf/lib/github';
import { verifySessionToken, parseCookie, COOKIE_NAME } from '../../cf/lib/session';
import { jsonResponse } from '../../cf/lib/response';

interface Env {
  ADMIN_SESSION_SECRET: string;
  GITHUB_PAT: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
}

const PENDING_PATH = 'data-private/pending-review.json';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
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
};
