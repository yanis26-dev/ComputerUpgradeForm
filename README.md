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
2. Go to your Pages project → **Settings** → **Functions** →
   **KV namespace bindings** → **Add binding**.
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
   **Zero Trust dashboard** → **Settings** → **Authentication** →
   **Login methods** → **Add** → **Azure AD**. You'll register an app in
   Entra (you already have admin rights there) and paste in the
   client ID/secret and tenant ID that Cloudflare asks for.
2. **Zero Trust** → **Access** → **Applications** → **Add an application**
   → **Self-hosted**.
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

## Editing later

Edit any file in the repo (locally + `git push`, or directly in GitHub's
web UI) and Cloudflare Pages redeploys automatically, usually within
30–60 seconds. Editing the form's wording or eligibility rules only
touches `index.html` — you won't need to touch the Functions or KV setup
again unless you're changing what data gets stored.

## Notes

- KV `list()` returns up to 1000 keys per call, far more than you'll need
  for an internal request form. If this ever needs to scale to
  thousands of responses, worth moving to D1 (Cloudflare's SQL database)
  instead — happy to help with that migration if it comes up.
- The eligibility rules live entirely in `index.html`'s JavaScript
  (`updateDeviceEligibility`). If the rules change, that's the only file
  to touch.
