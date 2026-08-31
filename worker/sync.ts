import { triggerWorkflowDispatch } from '../cf/lib/github';
import { timingSafeEqualString } from '../cf/lib/session';
import { jsonResponse } from '../cf/lib/response';
import type { Env } from './env';

export async function handleSync(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  if (!body.password || !timingSafeEqualString(body.password, env.SYNC_PASSWORD)) {
    return jsonResponse({ error: 'invalid_password' }, 401);
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
