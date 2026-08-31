# OneDrive auto-sync — setup & rollout

Everything the OneDrive → `heiwa.json` sync needs is now written (Phases 1-5
of the plan). What's left is entirely manual setup — Cloudflare account
access and secret values that only you can create — plus a careful first
run. This doc is the checklist for both.

## Already done

- Azure AD app registration (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`,
  `AZURE_TENANT_ID` are GitHub Actions secrets already).
- `ONEDRIVE_DRIVE_ID`, `ONEDRIVE_FOLDER_ID` are GitHub Actions **variables**
  already (not secret — they're not credentials, just IDs).

## 1. GitHub Actions — one more secret

Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | An Anthropic API key with billing enabled — this is what pays for extraction |

## 2. A GitHub PAT for the Worker

The two handlers that call GitHub *from outside Actions* (`worker/sync.ts`
to trigger `workflow_dispatch`, `worker/review-action.ts` to commit an
approved record) need their own token — Actions' own `GITHUB_TOKEN` only
works inside an Actions run.

1. GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
2. Resource owner: your account. Repository access: **Only select
   repositories** → `Heiwa-Dashboard`.
3. Permissions: **Contents: Read and write**, **Actions: Read and write**.
   Nothing else.
4. Set an expiration you're comfortable with (fine-grained PATs can't be
   set to never expire from an org — plan to rotate it before it lapses,
   the Sync button and Review tab both stop working silently otherwise).
5. Copy the token now — you'll paste it into Cloudflare in the next step,
   not here.

## 3. The Cloudflare project — Workers, not Pages

This deploys as a **Cloudflare Worker with static assets**, not classic
Pages. (An earlier attempt at a Pages project failed —
`wrangler pages deploy` errored with "The Pages project ... does not
exist" against an account where Cloudflare's dashboard had already created
this as a Workers project when it auto-detected the Next.js repo. Rather
than fight that, the app now targets Workers directly: `wrangler.jsonc`'s
`assets.directory` serves `out/`, and `worker/index.ts` handles the 4
`/api/*` routes — everything else falls through to the static files
automatically, no extra routing config needed.)

1. Connect the GitHub repo to the existing Workers project (or create one
   if it doesn't exist): Cloudflare dashboard → Workers & Pages → your
   project → Settings → Build → connect to Git if not already connected,
   production branch `main`.
2. Build command: `npm run build`. Deploy command: `npx wrangler deploy`
   (**not** `wrangler pages deploy` — this is a Workers project). Wrangler
   reads the output directory and Worker entry point from `wrangler.jsonc`
   itself, not from separate dashboard fields.
3. Deploy once to confirm the connection works — it'll fail until the env
   vars in the next step are set, that's expected.

## 4. Cloudflare Worker environment variables

Settings → Variables and Secrets (set these for the **Production**
environment; add them for Preview too only if you want preview deploys to
hit the same backend — probably not, for the secrets that grant real
access):

| Name | Value | Type |
|---|---|---|
| `SYNC_PASSWORD` | your choice | Secret |
| `ADMIN_USERNAME` | your choice | Secret |
| `ADMIN_PASSWORD` | your choice | Secret |
| `ADMIN_SESSION_SECRET` | random — run `openssl rand -hex 32` locally, paste the output. Not something you need to remember. | Secret |
| `GITHUB_PAT` | the fine-grained PAT from step 2 | Secret |
| `GITHUB_OWNER` | `upc-nyamdorj` | Plain variable (not sensitive) |
| `GITHUB_REPO` | `Heiwa-Dashboard` | Plain variable (not sensitive) |

Trigger a redeploy after saving (Cloudflare doesn't hot-reload env vars into
an already-built deployment).

## 5. First test — dry run, no cost

Before touching anything real: GitHub → Actions → "OneDrive sync" →
Run workflow → check **dry_run**, leave **limit** empty → Run.

This only lists and diffs the SharePoint folder — no download, no Claude
call, no commit. Confirms the Azure auth and Graph listing work before
anything costs money. Check the Action log.

## 6. Second test — small-batch cost calibration

The cost estimate in the Phase 2 PR (~$0.04–$0.25/file, Opus 5 pricing) is
a methodology, not a real number — actual page counts per file aren't known
from outside the folder. Run workflow → **dry_run unchecked**, **limit: 5**
→ Run. Read the Action log's "Token usage" / "Estimated cost this run"
lines — that's real, not estimated. Multiply roughly by (total changed
files ÷ 5) to project the full backfill (currently around 287 files per the
spec) before running it unlimited.

## 7. The backfill

Once the calibration number looks reasonable: Run workflow → leave both
inputs empty (or set a limit you're comfortable with and run it a few times
to work through the backlog gradually — every run is independent and picks
up where the last one's `.sync-state.json` left off).

## 8. Check the Review tab

Open the dashboard → "Баталгаажуулах" tab → log in with `ADMIN_USERNAME`/
`ADMIN_PASSWORD` → confirm the pending records from the backfill show up,
each with a link back to the source file in SharePoint. Try approving one:
edit the JSON to fill in the fields Claude couldn't extract (id/key,
category, system code, ...) using the source file as reference, submit, and
confirm it lands in `src/data/heiwa.json` on `main` and the site redeploys.

## 9. Turn on the daily cron

Nothing to do here — `.github/workflows/onedrive-sync.yml`'s `schedule`
trigger is already active once this PR merges to `main`. It runs once a
day regardless; the manual runs above were just for calibration before
trusting it unattended.
