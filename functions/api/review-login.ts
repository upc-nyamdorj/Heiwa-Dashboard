import { createSessionToken, sessionCookieHeader, timingSafeEqualString } from '../../cf/lib/session';
import { jsonResponse } from '../../cf/lib/response';

interface Env {
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  ADMIN_SESSION_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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
};
