/**
 * Combined binding shape for the Worker. Cloudflare project type is Workers
 * (not classic Pages) — confirmed by `wrangler pages deploy` failing with
 * "The Pages project ... does not exist" against an account where this repo
 * was created as a Workers project. Static assets are served via the
 * `assets` binding (wrangler.jsonc), not Pages Functions' file-based routing.
 */
/**
 * Deliberately not the ambient `Fetcher` type (from
 * worker-configuration.d.ts / @cloudflare/workers-types) — Next.js's
 * build-time type-checker has type-checked this file under the root
 * tsconfig (DOM lib, no Workers ambient types) despite worker/ being in
 * its "exclude" list, in an environment this repo's own local testing
 * couldn't reproduce even with a from-scratch `npm ci`. Request/Response
 * are standard web types present under any tsconfig, so this shape
 * resolves correctly no matter which config ends up checking it.
 */
interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: AssetsBinding;
  SYNC_PASSWORD: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  ADMIN_SESSION_SECRET: string;
  GITHUB_PAT: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
}
