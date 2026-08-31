# Deploying to Railway

This repo is a pnpm workspace with two deployable apps — `apps/api` (Fastify) and `apps/web`
(Vite/React SPA) — plus shared, non-deployed workspace packages (`packages/contract`,
`packages/db`). Deploy them as **two separate Railway services** from the same GitHub repo.

Both apps' production build paths have already been verified end-to-end (built, started, and
smoke-tested with real HTTP requests) — see "Known constraints" below for the two fixes that
made that true and what to watch for on Railway specifically.

## Prerequisites

- **Node 22 on both services.** The repo pins this via `engines.node` in the root
  `package.json` and a `.nvmrc`, which Railway's Nixpacks builder should pick up
  automatically — but verify it, or set it explicitly as an env var on each service:
  `NIXPACKS_NODE_VERSION=22`. `jsdom` (used for the "add article by URL" feature's Readability
  extraction) hard-requires Node ≥22 — its own `package.json` declares
  `"engines": {"node": "^22.22.2 || ^24.15.0 || >=26.0.0"}` — and will crash at server startup
  on Node 20 with `TypeError: webidl.util.markAsUncloneable is not a function` (reproduced and
  confirmed fixed locally by running the built bundle under Node 20.20.2 vs 22.22.2). This also
  clears the `@supabase/supabase-js` Node-20-deprecation warning as a side effect.
- A Supabase project already provisioned (this app uses Supabase for Postgres + Auth; Railway
  hosts the app code, not the database). You'll need, from the Supabase dashboard:
  - Project URL
  - Anon/publishable key
  - Service role/secret key
  - A Postgres connection string (use the **connection pooler** string, not the direct
    `db.<ref>.supabase.co` one — that host is IPv6-only and many sandboxed/CI environments
    can't reach it)
- A Railway project connected to this GitHub repo.

## Overview

Both services should be created with **Root Directory = `/`** (the repo root) — not
`apps/api` or `apps/web` — so `pnpm install` sees the whole workspace. Each service's build
and start commands use `pnpm --filter <app>` to scope to just that app.

There's one manual, one-time step outside either service's own startup: running the SQL
migrations against Supabase (see below).

## Service: `api`

- **Root Directory**: `/`
- **Build Command**:
  ```
  pnpm install --frozen-lockfile && pnpm --filter api build
  ```
- **Start Command**:
  ```
  pnpm --filter api start
  ```

### Environment variables

| Variable | Required? | Notes |
|---|---|---|
| `SUPABASE_URL` | Required | Project URL from Supabase |
| `SUPABASE_ANON_KEY` | Required | Anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Service role/secret key |
| `CORS_ORIGIN` | Required | Set to the **web** service's exact public URL — scheme + host only, no trailing slash (e.g. `https://your-app.example.com`, not `.../`). Defaults to `http://localhost:5173`, wrong for a deployed frontend. **Only takes effect if `NODE_ENV=production` (see below) — otherwise it's silently ignored.** |
| `NODE_ENV` | **Required** | Set to `production`. `app.ts`'s CORS setup branches on this: unless it's exactly `"production"`, the server uses a localhost-only regex for allowed origins and ignores `CORS_ORIGIN` entirely, regardless of what it's set to. Also controls log verbosity (`info` in dev, `warn` in prod) — if Railway's logs look chatty, this is unset. |
| `PORT` | **Don't set** | Railway injects this automatically; the server already reads `process.env.PORT` and binds `0.0.0.0`. |
| `RSS_FETCH_TIMEOUT_MS` | Optional | Default `10000` |
| `RSS_FETCH_CONCURRENCY` | Optional | Default `3` |
| `REFRESH_INTERVAL_MS` | Optional | Default `3600000` (1 hour) — how often the background feed-refresh scheduler runs |
| `EMBEDDING_MODEL` | Optional | Default `Xenova/bge-small-en-v1.5` |

## Service: `web`

- **Root Directory**: `/`
- **Build Command**:
  ```
  pnpm install --frozen-lockfile && pnpm --filter web build
  ```
- **Start Command**:
  ```
  pnpm --filter web start
  ```
  (Runs `serve -s dist -l $PORT` — the `-s` flag enables SPA fallback, needed because the app
  uses client-side routes like `/reset-password` that must resolve to `index.html` on a
  direct load/refresh.)

### Environment variables

| Variable | Required? | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Required | Same Supabase project URL as the api service |
| `VITE_SUPABASE_ANON_KEY` | Required | Same anon key as the api service |
| `VITE_API_URL` | Required | The **api** service's public Railway URL |

**Important**: `VITE_*` variables are baked into the JS bundle at *build* time, not read at
runtime. Changing one in Railway's dashboard requires a rebuild (redeploy), not just a
restart, to take effect.

## Running the database migration

`DATABASE_URL` is **not** one of the api service's runtime environment variables above — it's
only needed to run the migration script once, from a shell with network access to Supabase's
pooler:

```
DATABASE_URL="<supabase pooler connection string>" pnpm --filter api migrate
```

This applies everything in `packages/db/migrations/` in order (currently `0001_init.sql`,
`0002_reader_state.sql`, `0003_ml_classification.sql`, `0004_open_ended_tags.sql`), tracked in
a `schema_migrations` table — safe to re-run, it only applies what's missing.

Run this either:
- from your own machine (or CI) with `DATABASE_URL` set locally, before the first deploy, or
- via Railway's CLI (`railway run`) or the api service's shell, with `DATABASE_URL` added as a
  one-off/temporary variable on that service.

## Deploy order

1. Run the migration (above) — the api service will error on startup-adjacent requests if the
   schema isn't there yet.
2. Deploy `api`.
3. Deploy `web` (needs `VITE_API_URL` pointing at api's now-known Railway URL — you'll likely
   need to deploy api first just to get its assigned URL, then set that as web's env var
   before web's own build).

## Post-deploy smoke test

- `GET https://<api-url>/api/articles` with no auth header → expect **401**, not a connection
  error or 500. This confirms the server booted, the embedding model warmed, and routing
  works.
- Load `https://<web-url>/` → confirm the login page renders and login succeeds.
- Add or refresh a feed from the UI → confirms the api service can actually reach Supabase
  with the configured keys.

## Known constraints (carried over from local verification)

- **Production build fix**: `apps/api` builds via `tsup` (`apps/api/tsup.config.ts`), not
  plain `tsc`. The workspace packages `@rss-agg/contract` and `@rss-agg/db` ship raw
  TypeScript with no `dist/` of their own — a plain `tsc` build produces a `dist/main.js`
  that still imports their unbuildable `.ts` source, which `node` can't execute. `tsup`
  force-bundles just those two packages in; everything else in `node_modules` (including
  `onnxruntime-node`, which has native bindings) stays external. This was reproduced and
  fixed in this session — don't revert `apps/api`'s build script back to `tsc`.
- **`onnxruntime-node`**: pinned to `1.23.0` via a root `pnpm.overrides` (originally for an
  Intel Mac dev environment) — confirmed this version bundles Linux x64 prebuilt binaries
  directly in the package, so it works on Railway's containers without changes.
- **Embedding model download**: the server downloads `Xenova/bge-small-en-v1.5` at startup
  and warms it before `app.listen` (so the first real request isn't slow, but server startup
  itself takes longer). Railway's default filesystem doesn't persist across deploys, so this
  download happens fresh on every deploy, not just the first one — expect every deploy's boot
  time to include it, not just a one-time cold start.
- **Static frontend serving**: `apps/web` uses the `serve` package for production
  (`vite preview` is documented as a preview-only tool, not meant for production traffic).
