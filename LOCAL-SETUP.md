# Local registration and Telegram setup

For hosting, follow [Cloudflare Pages + Railway + Neon](DEPLOYMENT.md).

The frontend runs at http://localhost:5000. The API runs at port 5001.
Use Node 22.16+ or Node 24 and pnpm. Run commands from the repository root.

## Server settings

Copy `artifacts/api-server/.env.example` to `artifacts/api-server/.env`.
The API start command loads the root `.env` first, then `artifacts/api-server/.env` for overrides; `.env` files are ignored by Git. You can keep your Neon `DATABASE_URL` in the root `.env` (omit it from the API file in that case).

- `REGISTRATION_ADMIN_PASSWORD`: choose a strong private password for the admin screen.
- `TELEGRAM_BOT_TOKEN`: your bot token from Telegram's @BotFather.
- `TELEGRAM_CHAT_ID`: the receiving chat ID. Start the bot in Telegram first (or add it to the receiving group). A personal username alone is not a bot destination chat ID.
- `DATABASE_URL`: Neon development-branch or local PostgreSQL connection string. Required for API startup.
- `API_PROXY_SECRET`: shared Railway/Pages secret for production; leave blank for local-only development.

Telegram introductions include the selected profile, message and the visitor's Telegram username or WhatsApp number. Success is shown only after Telegram acknowledges delivery. Without credentials, introductions return a delivery error rather than a false success.

Approving a registration sends a "Profile approved" notification to the configured admin Telegram chat (not the member). The notification contains the member name, registration ID, selected plan, and completion status, never a password. Approval remains saved if Telegram fails; the queue shows Failed and offers Retry Telegram. Repeating an already successfully notified approval does not send another notification.

Telegram API reference: https://core.telegram.org/bots/api#sendmessage

## Start from Windows CMD

API terminal:

```cmd
cd /d "V:\Branding\Seo\Websites\Github\RM"
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

Frontend terminal:

```cmd
cd /d "V:\Branding\Seo\Websites\Github\RM"
set "PORT=5000"
set "BASE_PATH=/"
pnpm --filter @workspace/him-for-you run dev
```

Git Bash frontend equivalent: `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/him-for-you run dev`.
The API build/start commands are the same in Git Bash. Restart the API after rebuilding changes.

## Pages

- `/join`: seven-step registration, with Free Registration selected by default.
- `/my-profile`: authenticated private preview of the submitted profile.
- `/dashboard`: registration status and selected listing option; also supports member login.
- `/complete-profile`: authenticated completion/editing of a previously submitted profile, available from the dashboard.
- `/admin`: admin registration queue with approve/reject, notification retry, and Pricing & Policies tabs.

Initial demo prices are ₹499 weekly, ₹1,499 monthly and ₹3,999 quarterly. Admin changes persist in Postgres and are used by the wizard and server validation. Free Registration remains available. Prices are INR. Premium selection records a request; there is no payment collection or automatic premium activation.

`/terms` and `/privacy` are explicitly labeled demo placeholders. Replace their links in admin with your real published policies before using real registrations.

Registrations and compressed photos persist in Postgres across API restarts. Passwords are salted and hashed, and private profile access uses an HTTP-only session cookie. New registrations enter Pending approval and cannot log in until an admin approves them. Approval enables password login. Only approved profiles with all required profile details appear in the public discovery list; personal contact details and date of birth are not exposed publicly. Revoking approval removes public access and revokes member sessions. Existing records previously marked Submitted are treated as Pending approval. Neon owns persistence; Railway does not need a persistent disk. Existing SQLite data can be imported using the command in DEPLOYMENT.md. Production sessions require HTTPS.

Wizard state is preserved while navigating between steps; reloading the page resets an unsubmitted draft. Passwords and draft photos are not saved in browser storage.

During initial signup, only Basic Details and final consent are mandatory; the other steps can be skipped, with Free Registration as the default. After approval and login, the completion wizard requires About You, Location, Photos, Preferences, Listing Plan and Review. The dashboard lists missing steps and compares Free vs Premium benefits using current admin prices. All required steps must be complete before publication. Choosing Premium alone never activates paid benefits or collects payment.

## Verification

```cmd
pnpm run typecheck
pnpm --filter @workspace/api-server run build
set "TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres"
node --test scripts/registration-smoke.test.mjs scripts/pages-proxy.test.mjs scripts/sqlite-import.test.mjs
```

Database tests require a local PostgreSQL server and permission to create/drop temporary test databases. They create and remove only their own randomly named databases and mock Telegram; no real messages are sent. Adjust TEST_DATABASE_URL for your local test server.
