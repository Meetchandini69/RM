# Cloudflare Pages + Railway + Neon

This repository is prepared for:

```text
Browser → Cloudflare Pages (React + /api proxy) → Railway (Express API) → Neon (Postgres)
```

All registration data, uploaded photos, approvals, settings and login sessions are stored in Postgres. Railway does not need a persistent disk. The existing demo discovery profiles remain bundled with the API.

## 1. Create the Neon database

1. Create a Neon project and database.
2. Open **Connect**, enable connection pooling, and copy the generated PostgreSQL connection string with SSL enabled.
3. Use it as `DATABASE_URL` on Railway. Never put this value in Cloudflare frontend variables or any `VITE_*` variable.

The API creates its tables safely on startup. Existing data is preserved. You do not need to run `drizzle-kit push` to deploy.

To preserve registrations from the old local SQLite version, follow the import section below before accepting new registrations.

## 2. Deploy the API to Railway

Connect this GitHub repository to a new Railway service. Keep the service root at the **repository root**, not `artifacts/api-server`, because it uses shared workspace packages.

The root `Dockerfile` configures the build and start command. In Railway service settings, set **Healthcheck Path** to `/api/healthz`, **Healthcheck Timeout** to `120`, **Restart Policy** to On Failure, and **Replicas** to `1`. Do not add a separate build/start override or a volume. Railway supplies `PORT`; do not hardcode a local port.

Add these Railway variables:
 
If deployment says **The executable `pnpm` could not be found**, the build has succeeded but Railway is overriding the Docker startup command. Open **Settings → Deploy → Custom Start Command** and clear the override to use the Dockerfile default. Alternatively, set it explicitly to `node --enable-source-maps dist/index.mjs`. Save/apply the setting and redeploy. The runtime image contains Node and the compiled API; pnpm is only installed in the build stage.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string, including SSL parameters |
| `API_PROXY_SECRET` | A random secret at least 32 characters long; use the same value on Pages |
| `REGISTRATION_ADMIN_PASSWORD` | Your private admin password |
| `TELEGRAM_BOT_TOKEN` | Your existing Telegram bot token |
| `TELEGRAM_CHAT_ID` | Your receiving admin Telegram chat ID |

`NODE_ENV=production` is already set in the Dockerfile. Pricing and policy links can be edited after admin login.

Generate a suitable proxy secret locally with:

```cmd
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Deploy the Railway service, then enable its public domain under **Networking**. Copy the resulting HTTPS origin, for example `https://your-api.up.railway.app`.

Visit `https://your-api.up.railway.app/api/healthz`; it should return `{"status":"ok"}`. Other direct Railway API URLs intentionally require the proxy secret and should be accessed through Pages.

## 3. Deploy the frontend to Cloudflare Pages

Use **Pages → Connect to Git**, select this repository and your production branch. Commit and push the deployment files and lockfile before deploying. Use Git integration or Wrangler, not dashboard drag-and-drop: this app includes a Pages Function.

| Build setting | Value |
| --- | --- |
| Framework preset | None |
| Root directory | Repository root (leave blank) |
| Build command | `pnpm run build:pages` |
| Build output directory | `artifacts/him-for-you/dist/public` |
| `NODE_VERSION` | `24` |
| `PNPM_VERSION` | `12.3.4` |

Add these **Production** Pages environment variables/secrets:

| Variable | Value |
| --- | --- |
| `API_ORIGIN` | Railway HTTPS origin, without `/api` or other path |
| `API_PROXY_SECRET` | Exactly the same secret as Railway; mark it secret |

Redeploy after setting the variables so the Function receives them. `PORT` and `BASE_PATH` are not required for the frontend build; the Vite config has local defaults.

The root `functions/api/[[path]].js` forwards `/api/*` to Railway, including cookies and image uploads. It keeps logins on the Pages origin, so no third-party-cookie settings or frontend API URL changes are needed. `_routes.json` runs Functions for pages and API requests while excluding static assets. The root middleware injects saved SEO metadata into HTML, and serves root sitemaps and verification files through the API. Cloudflare's SPA fallback still supplies the React shell.

Leave Preview API variables unset, or use a separate Railway service and Neon test branch. Connecting preview builds to the production API lets those builds modify production data.

## 4. Check the deployed flow

1. Open `https://YOUR-PROJECT.pages.dev/api/healthz`.
2. Register at `/join`; confirm the new account cannot log in before approval.
3. Sign in at `/admin` with `REGISTRATION_ADMIN_PASSWORD`.
4. Approve the registration and confirm the notification reaches the admin Telegram chat.
5. Log in at `/dashboard`, complete every profile step, and verify the public profile appears.
6. Refresh `/dashboard` and a profile URL to verify SPA routing and login persistence.

Replace the demo policy links and prices in admin before launch. Paid-plan selection does not collect payment or activate premium benefits.

## Optional: import existing SQLite registrations

Stop the old local API first so no new registrations arrive during import. Keep the SQLite file as a backup. Put the **destination Neon** `DATABASE_URL` in `artifacts/api-server/.env` locally, then run this from the repository root in CMD or Git Bash:

```cmd
pnpm --filter @workspace/db run migrate:sqlite "V:\Branding\Seo\Websites\Github\RM\artifacts\api-server\data\registrations.sqlite"
```

Adjust the path if your previous `REGISTRATION_DATA_DIR` was elsewhere. This reads SQLite without changing it. It imports photos, salted password hashes, registration IDs, public numeric IDs and saved settings in one transaction. Existing destination registration IDs and settings are not overwritten. Conflicting email, mobile or public IDs roll back the import; do not import unrelated databases into a populated destination.

Sessions are not imported. Members and admins sign in again. Unapproved legacy records still require approval. The import is repeatable for the same source; previously imported IDs are skipped.

## Local development after migration

The API loads the repository root `.env`, then `artifacts/api-server/.env` for overrides. Keep `DATABASE_URL` in either file, pointing to a Neon development branch or local PostgreSQL database. If copying `artifacts/api-server/.env.example` to `artifacts/api-server/.env`, remove its placeholder `DATABASE_URL` when using the root setting. Leave `API_PROXY_SECRET` blank for local-only development.

API terminal:

```cmd
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

Frontend terminal:

```cmd
pnpm --filter @workspace/him-for-you run dev
```

Open http://localhost:5000. If testing a protected API locally, put `API_PROXY_SECRET` and `API_TARGET` in `artifacts/him-for-you/.env`; these are server-side Vite proxy settings, not browser variables.

## Troubleshooting

- **Pages says API connection is not configured:** set Production `API_ORIGIN` and `API_PROXY_SECRET`, then redeploy.
- **API returns “Access this API through the website”:** compare the two proxy-secret values and use the Pages URL.
- **Railway healthcheck fails:** check the database connection, permissions and TLS settings. The API waits for its schema and a database connection before accepting traffic.
- **Cloudflare frozen-lockfile error:** commit and push `pnpm-lock.yaml`, `pnpm-workspace.yaml` and package changes together. Do not disable frozen installs to mask a stale lockfile.
- **Approval succeeds but Telegram fails:** check the bot token, receiving chat ID and bot access, then use Retry Telegram in admin.

Provider references: [Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/), [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Railway healthchecks](https://docs.railway.com/deployments/healthchecks), [Neon connections](https://neon.com/docs/connect/connect-from-any-app).


## Browsing access approval

- `/unlock`: basic browsing registration (name, Telegram username or WhatsApp number, looking for, age, location and password).
- `/login`: approved browsers sign in with their contact and password; `/dashboard` remains the separate men's profile management login.
- `/admin/registration`: the Registrations tab includes Browsing access requests with approve/reject controls. Rejection revokes existing browsing sessions.
- Restart the API after updating: startup creates `viewers` and `viewer_sessions` automatically in the existing PostgreSQL database.
- New browsing requests notify the existing `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` admin chat. The queue shows delivery status; failed Telegram delivery does not discard the registration. Approval is checked at login and on every interest request.
- Profile blur is a visual UI restriction on the existing public photo assets, not private media storage. Direct static asset URLs remain public.
- Verification: `node scripts/test-viewer-access.mjs` exercises the access lifecycle with mocked database and Telegram; it does not send real messages.


## Account panels, profile review and boosts

- Women land on `/account` after login. `/account/profile` shows their details; `/account/interests` retains every new interest and message, including requests whose Telegram notification failed. Earlier Telegram-only introductions cannot be reconstructed automatically.
- The signed-in header shows the account name with Profile, Dashboard, Interests and Logout links. Men also have an Upgrade / Boost link. Mobile navigation includes the same account menu.
- Men use `/dashboard`, `/my-profile`, `/complete-profile`, `/member-interests` and `/boost-profile`.
- Initial registration approval enables login. Saving profile details changes the status to `Profile pending`, removes public visibility and requests a second admin review. Members retain login while pending or `Profile rejected`, and can edit/resubmit. Admin approval publishes complete profiles in Browse and the homepage card grid. Guests continue to see blurred cards.
- Boost requests use the admin-configured quarterly/yearly prices. Admin must confirm payment separately before activation. Activation lasts 3 months / 1 year, adds premium status and prioritizes featured placement; expiry removes that benefit automatically. A boost does not override profile approval. No automatic payment collection is added.
- Restart the API to create `member_interests` and `profile_boosts` and their indexes. New tables preserve existing registrations.
- `node scripts/test-account-panels.mjs` runs integration checks using the configured PostgreSQL connection, an isolated schema in a transaction, and mocked Telegram. The transaction is rolled back, leaving no test records or schema. Covers profile resubmission/review, login while pending, interest history/isolation, notification failure, boost approval/expiry and logout.

Current plans: Free INR 0, Quarterly INR 499 (3 months), Yearly INR 999 (1 year). Admin settings control both paid prices. Startup migrates the previous pricing settings once; historical activated boosts retain their existing expiry.

Admin ? Search options controls the ordered Location and I?m looking for lists on homepage and Browse Men. Enter one option per line and save. Settings persist in `discovery_settings`; existing profile values are retained. Search options refresh within 30 seconds on open public pages and on returning to the tab.


## SEO administration and webmaster verification

1. Open **Admin ? SEO & Sitemaps**. Save your canonical public website origin, e.g. `https://yourdomain.com`.
2. Search the page list and edit the meta title, description and canonical URL. Leave canonical blank to derive it from the website origin. Static pages, configured cities and currently published profiles are listed automatically. Private/admin pages are always noindex and excluded from sitemaps.
3. Upload the original Google Search Console HTML file, `BingSiteAuth.xml`, or Yandex verification HTML file (up to 32 KB). Its contents are saved in PostgreSQL and served at `https://yourdomain.com/<original-filename>` without a login. Verification files are served with a restrictive CSP. Open the file link and then complete verification with the provider.
4. Use **Generate / view sitemap.xml** or **Generate / view sitemap.html**. These are generated on request, so metadata edits, city updates and profile publication changes are reflected automatically. Submit `https://yourdomain.com/sitemap.xml` to Search Console. `/robots.txt` contains the absolute sitemap URL.

The API startup creates `seo_settings`, `seo_pages` and `seo_verification_files`. Deploy/restart the API and deploy the Cloudflare Pages frontend plus root `functions/` directory. Keep the existing Pages `API_ORIGIN` and `API_PROXY_SECRET`. The new `_middleware.js` serves initial HTML with title, description, canonical, Open Graph, Twitter metadata and robots; client navigation updates them too. No static root canonical is placed in `index.html` because Vite can treat it as an asset during builds. Assets remain excluded from Function execution. Pages HTML is not cached so saved metadata is current. Unknown routes return 404/noindex on Pages. If metadata is unavailable, Pages keeps serving the application with temporary noindex fallback metadata and an X-SEO-Status: fallback header. SEO failures do not block the website or admin login. Sitemap and verification-file failures still return 503 rather than application HTML.

Local `pnpm ... run dev` supports the same sitemap/file URLs and injects metadata using Vite's HTML transform. `vite preview` is a static preview; production behavior comes from Pages Functions. The website origin must be set before sitemap generation; without it the sitemap endpoint returns a clear 503 setup message. Canonical URLs pointing to a different path/domain and noindex pages are excluded from the generated sitemaps. Historical/deactivated profile metadata is retained in storage but not listed publicly.


## Required membership plans and registration notifications

Men must select Half-yearly (6 months, INR 499) or Annual (12 months, INR 999) when registering or updating their profile. Free is not selectable and is rejected by the submission API; legacy records remain readable. Startup renames the configured quarterly option to halfyearly while preserving admin-set prices. Existing boost expirations are unchanged; new halfyearly activations last 6 months.

Every new men's registration now sends its name, contact, age, location, selected plan and price to the configured admin Telegram chat. A failed notification leaves the registration saved and records Failed status. Admin can retry the registration notification without approving it. Deploy the updated API to Railway as well as the frontend to Pages; verify TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Railway's service variables if delivery still fails.


## Basic account registration and paid profile completion

The current flow supersedes the earlier paid-at-registration flow. `/join` collects basic details and consent only, saves an account pending review, notifies admin Telegram, and immediately shows thanks. Initial admin approval enables login. Unpaid members see the locked completion preview and Quarterly/Annual offers with a softly blurred illustrative photo marquee (reduced-motion support included).

Set the receiving username under **Admin ? Payments ? Pay Now Telegram account**. Pay Now immediately opens that Telegram account in a new tab and records a pending request in admin. Under **Payments**, confirm payment and activate the request to unlock profile completion. Merely clicking Pay Now never grants access. The profile-edit API requires an active paid membership, and completed profiles still require a separate publication review. Active membership is also required for public profile discovery/photos. Existing memberships keep their expiry; new Quarterly activations last three months and Annual activations last one year. Admin-set prices are preserved when renaming Half-yearly to Quarterly.

Deploy both Railway and Pages. API startup creates `membership_payment_settings`. Live Telegram delivery is not exercised by automated tests; integration tests mock Telegram and roll back test data.
