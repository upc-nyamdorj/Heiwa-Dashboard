import { createSessionToken, sessionCookieHeader, timingSafeEqualString } from '../cf/lib/session';
import { jsonResponse } from '../cf/lib/response';
import type { Env } from './env';

export async function handleReviewLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const validUsername = !!body.username && timingSafeEqualString(body.username, env.ADMIN_USERNAME);
  const validPassword = !!body.password && timingSafeEqualString(body.password, env.ADMIN_PASSWORD);
  if (!validUsername || !validPassword) {
    return jsonResponse({ error: 'invalid_credentials' }, 401);
  }

  const token = await createSessionToken(body.username as string, env.ADMIN_SESSION_SECRET);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(token),
    },
  });
}
