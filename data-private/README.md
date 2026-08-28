# data-private/

`pending-review.json` holds AI-extracted records that haven't been approved
by a human yet — unverified financial figures from newly-synced documents.

**Never import anything from this directory in `src/`.** Unlike
`src/data/heiwa.json`, this directory is deliberately outside the Next.js
static export — anything imported into a component ships in the public JS
bundle regardless of any login screen in front of it. The only intended
reader is the Cloudflare Pages Function at `functions/api/review-list.ts`,
which fetches this file server-side via the GitHub Contents API after
verifying an admin session cookie.

`scripts/sync-onedrive.mjs` is the only writer today. Once the review UI
(Phase 4) exists, `functions/api/review-action.ts` also writes here when an
admin approves or rejects a record.
