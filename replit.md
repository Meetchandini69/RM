# Him For You

A premium women-focused discovery platform for finding verified male companions by city, interests, and intent.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/him-for-you/` — responsive React/Vite web app, route shell, discovery UI, profile detail, membership, and onboarding
- `artifacts/api-server/src/routes/discovery.ts` — discovery and engagement API with curated launch data
- `lib/api-spec/openapi.yaml` — source-of-truth API contract for profiles, cities, plans, and engagement
- `artifacts/him-for-you/src/index.css` — shared dark editorial theme and typography tokens

## Architecture decisions

- The public discovery surface is contract-first: generated React Query hooks are the only client data access layer.
- Profile photos are generated local assets served from the web artifact so the launch experience does not depend on third-party image hosts.
- Public engagement actions are intentionally lightweight and API-backed now; authentication, payments, and durable member records are the next production layer.

## Product

- Women can browse curated profiles, filter by city and intent, view detailed profiles, save favourites, and send interest.
- Men have a dedicated join path and membership comparison surface for increasing visibility.
- Public pages include discovery, city listings, profile details, premium plans, and onboarding.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Re-run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- The current Orval/Zod combination accepts numeric OpenAPI fields but emits unsupported `zod.int()` for `integer`; keep generated-compatible numeric fields until the validation dependency is upgraded.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
