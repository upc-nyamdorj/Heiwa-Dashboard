import { triggerWorkflowDispatch } from '../cf/lib/github';
import { timingSafeEqualString } from '../cf/lib/session';
import { jsonResponse } from '../cf/lib/response';
import { atLeast, currentUser } from './auth-session';
import type { Env } from './env';

export async function handleSync(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  // An editor's (or admin's) session is the authorisation now — no second
  // password. SYNC_PASSWORD remains only for callers that predate accounts and
  // goes away with the other shared secrets.
  const user = await currentUser(request, env);
  if (!atLeast(user, 'editor')) {
    let body: { password?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body at all is fine when a session was expected; fall through to 401.
    }
    if (!body.password || !env.SYNC_PASSWORD || !timingSafeEqualString(body.password, env.SYNC_PASSWORD)) {
      return jsonResponse({ error: user ? 'forbidden' : 'unauthorized' }, user ? 403 : 401);
    }
  }

  try {
    await triggerWorkflowDispatch({
      owner: env.GITHUB_OWNER,
      repo: env.GITHUB_REPO,
      token: env.GITHUB_PAT,
      workflowFile: 'onedrive-sync.yml',
    });
  } catch (err) {
    return jsonResponse({ error: 'trigger_failed', message: String(err) }, 502);
  }

  return jsonResponse({ ok: true });
}
