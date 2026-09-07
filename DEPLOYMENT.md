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

The root `functions/api/[[path]].js` forwards `/api/*` to Railway, including cookies and image uploads. It keeps logins on the Pages origin, so no third-party-cookie settings or frontend API URL changes are needed. `_routes.json` limits Function execution to API requests; Cloudflare's normal SPA fallback serves routes such as `/join` and `/dashboard`.

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
