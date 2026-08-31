/**
 * Combined binding shape for the Worker. Cloudflare project type is Workers
 * (not classic Pages) — confirmed by `wrangler pages deploy` failing with
 * "The Pages project ... does not exist" against an account where this repo
 * was created as a Workers project. Static assets are served via the
 * `assets` binding (wrangler.jsonc), not Pages Functions' file-based routing.
 */
export interface Env {
  ASSETS: Fetcher;
  SYNC_PASSWORD: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  ADMIN_SESSION_SECRET: string;
  GITHUB_PAT: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
}
