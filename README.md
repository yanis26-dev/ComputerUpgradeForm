# Cardo Systems — Computer Upgrade Request Form

Static form + Cloudflare Pages Functions + KV storage. No Worker deploy
needed separately — Pages builds and deploys the `functions/` folder
alongside the static files automatically on every git push.

## Structure

```
index.html                        Employee-facing form
admin/index.html                  Admin view (table, CSV export, delete)
functions/api/submit.js           POST handler — saves a response to KV
functions/api/admin/responses.js  GET (list) / DELETE (remove one) — admin API
```

## 1. Push to GitHub

Create a new repo (private is fine) and push this folder as-is. You can
also just create the repo on github.com and upload these files through the
web UI if you don't want to use git locally yet.

## 2. Connect Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Select the repo.
3. Framework preset: choose **None**. This auto-fills the build command
   as empty and the output directory as `/` (root) — there's no build
   step here, it's static HTML + Functions as-is.
4. Deploy. You'll get a working `*.pages.dev` URL immediately — you can
   use this to test everything before adding a custom domain in step 4
   below.

## 3. Create the KV namespace

1. **Workers & Pages** → **KV** → **Create namespace** (e.g.
   `cardo_upgrade_responses`).
2. Go to your Pages project → **Settings** → **Bindings** → **Add** →
   **KV namespace**.
   - Variable name: `RESPONSES` (must match exactly — the code reads
     `env.RESPONSES`)
   - KV namespace: the one you just created
3. Do this for **both** the Production and Preview environments.
4. Redeploy (Pages → your project → Deployments → retry latest, or just
   push a small commit) so the binding takes effect.

## 4. Custom domain (optional but recommended)

Pages project → **Custom domains** → **Add a custom domain**, e.g.
`upgrade.cardosystems.com`. Since the zone is already on Cloudflare, this
is just adding a CNAME — the dashboard does it for you.

## 5. Protect the admin view with Cloudflare Access

This is the important step — without it, `/admin/` and `/api/admin/*` are
publicly reachable to anyone with the URL.

1. If you haven't already, add Azure AD / Entra as an identity provider:
   **Zero Trust dashboard** → **Integrations** → **Identity providers** →
   **Add** → **Azure AD**. You'll register an app in Entra (you already
   have admin rights there) and paste in the client ID/secret and tenant
   ID that Cloudflare asks for.
2. **Zero Trust** → **Access controls** → **Applications** →
   **Add an application** → **Self-hosted**.
   (Cloudflare has reshuffled this nav a few times — if "Access controls"
   doesn't show "Applications," look for an "Access" or "Applications"
   entry elsewhere in the sidebar; the underlying feature is the same.)
3. Application domain: `upgrade.cardosystems.com` (or your `*.pages.dev`
   domain), path: `/admin*`.
4. Add a second application the same way for path `/api/admin*`.
5. Policy: **Include** → **Emails ending in** → `@cardosystems.com`
   (or restrict further to a specific Entra group if you want it limited
   to IT).
6. Save. Visiting `/admin/` now requires an Entra login before the page
   (or the API) responds at all — no passcode in the code needed.

## 6. Test it

1. Open the root URL — either your `*.pages.dev` URL or the custom domain
   once step 4 is done — and submit a test response.
2. Open `/admin/` on that same domain — you should hit the Entra login
   (once step 5 is done), then see the table with your test response,
   and be able to export CSV or delete it.
3. If you test on `*.pages.dev` before setting up Access, remember that
   URL is unprotected until Access is configured for it too — Access
   applications are per-domain, so you'd need one for `*.pages.dev` and
   one for your custom domain if you use both.

## Eligibility rules

These live in `updateDeviceEligibility()` in `index.html` — not in the
`DEPARTMENTS` object — so renaming any of the teams named below needs an
edit there too, not just in `DEPARTMENTS`.

1. **Priority ERP as main tool** → not eligible for any MacBook (Pro,
   Air, or Neo).
2. **R&D → Software** + connects USB devices daily → not eligible for
   any MacBook.
3. **R&D → Hardware** + uses SolidWorks → not eligible for any MacBook.
4. **R&D → Mechanical Engineering** → restricted to the Lenovo ThinkPad
   P16 only, regardless of any other answer. This one is exclusive
   (every other device is disabled) rather than just blocking Mac.

## Editing later

Edit any file in the repo (locally + `git push`, or directly in GitHub's
web UI) and Cloudflare Pages redeploys automatically, usually within
30–60 seconds. Editing the form's wording or eligibility rules only
touches `index.html` — you won't need to touch the Functions or KV setup
again unless you're changing what data gets stored.

### Pushing an update from your computer

If you (or Claude) edited files locally, from inside the project folder:

```bash
git add .
git commit -m "describe what changed"
git push
```

That's it — no need to repeat any of the GitHub token/login setup from
the first push, since your credentials are already saved. Cloudflare
picks up the new commit automatically and redeploys within about a
minute. You can watch it happen under your Pages project →
**Deployments**.

If you'd rather skip the terminal, editing files directly on github.com
(open the file → pencil/edit icon → commit) triggers the same automatic
redeploy.

### Editing the department/team list

`index.html` has a `DEPARTMENTS` object near the top of the `<script>`
block:

```js
const DEPARTMENTS = {
  'Cardo Ride': [],
  'Crew': [],
  'Finance-IT-Legal': ['F&A', 'Finance', 'IT', 'Legal'],
  ...
};
```

- The key is the department name (shown in the first dropdown).
- The array is that department's teams (shown in a second dropdown that
  only appears if the array isn't empty). Leave it as `[]` for
  departments that don't need a second question.
- To add a team to a department that doesn't have any sub-teams filled
  in yet (e.g. Crew, HR & Admin, Outdoor, Product Management), just fill
  in the array — no other code changes needed.
- The Mac eligibility rules only key off `R&D` → `Software` and `R&D` →
  `Hardware` specifically (see `updateDeviceEligibility` further down in
  the same script). Renaming those two team names would require updating
  that function too — ask Claude if you want that changed.

## Notes

- KV `list()` returns up to 1000 keys per call, far more than you'll need
  for an internal request form. If this ever needs to scale to
  thousands of responses, worth moving to D1 (Cloudflare's SQL database)
  instead — happy to help with that migration if it comes up.
- The eligibility rules live entirely in `index.html`'s JavaScript
  (`updateDeviceEligibility`). If the rules change, that's the only file
  to touch.
