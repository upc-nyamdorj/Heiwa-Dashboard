import { triggerWorkflowDispatch } from '../../cf/lib/github';
import { timingSafeEqualString } from '../../cf/lib/session';
import { jsonResponse } from '../../cf/lib/response';

interface Env {
  SYNC_PASSWORD: string;
  GITHUB_PAT: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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
};
