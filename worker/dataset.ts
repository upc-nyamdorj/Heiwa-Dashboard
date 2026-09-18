/**
 * GET /api/data — the dataset, for signed-in callers only.
 *
 * The file is imported here, inside the Worker bundle, and no longer from
 * src/. That placement is the whole point: under `output: 'export'` anything
 * src/ imports is compiled into a public JS chunk, so the login screen was
 * only ever a screen — the figures behind it could be read straight out of
 * out/_next/static/chunks/ without signing in. Worker source is executed on
 * Cloudflare and never served to the browser, so here the gate is real.
 *
 * Keep it out of src/ when editing: one `import` from a component undoes this.
 */

import dataset from './data/heiwa.json';
import { jsonResponse } from '../cf/lib/response';
import { canViewDashboard } from './auth-session';
import type { Env } from './env';

export async function handleData(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!(await canViewDashboard(request, env))) return jsonResponse({ error: 'unauthorized' }, 401);

  // Serialised once per request rather than cached: the routing boundary marks
  // every /api response no-store, and a stale copy of the dataset in an edge
  // cache is exactly the shape of bug this route exists to avoid.
  return jsonResponse(dataset);
}
