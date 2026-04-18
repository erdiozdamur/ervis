# Ervis

Production-minded, mobile-first calorie tracking app built with Next.js, TypeScript, Prisma, PostgreSQL, and a draft-first AI meal workflow.

## Local development

The safest local path is to run the app from `frontend/` and use the local PostgreSQL service defined in `frontend/docker-compose.yml`.
That local compose stack is named `ervis-local`, so it stays clearly separate from the root deployment-oriented `ervis` stack.

Recommended local rule:

- Use `frontend/.env` as the source of truth for local app/database settings.
- Use `frontend/docker-compose.yml` for the local Postgres service.
- Run the backend locally from the repo root with `./scripts/run-local-backend.sh` when you need backend endpoints.
- Treat the root `docker-compose.yml` and root `.env` as deployment-oriented, not as the recommended local app workflow.

### 1. Prepare env

```bash
cd frontend
cp .env.example .env
```

Notes:

- `DATABASE_URL` in `.env.example` already points to the local Postgres container on `localhost:5432`.
- `APP_TIME_ZONE` and `TZ` default to `Europe/Istanbul`.
- `OPENAI_API_KEY` is optional for basic local UI testing, but needed for live transcription / provider-backed AI calls.

### 2. Start the local database

```bash
cd frontend
npm run db:start
```

If you already have an old local database volume from a previous iteration and migrations complain about a legacy schema, reset only the local frontend stacks (`ervis-local` and the older `frontend` local stack) with:

```bash
cd frontend
npm run db:reset:local
```

Then start Postgres again and re-run migrations.

### 3. Apply Prisma migrations

```bash
cd frontend
npm run db:migrate:deploy
```

### 4. Start the app

```bash
cd frontend
npm run dev
```

The app will run at:

- `http://localhost:3000`
- health check: `http://localhost:3000/healthz`

### One-command local start

```bash
cd frontend
npm run dev:local
```

This starts Postgres, applies migrations, and launches Next.js dev mode.

### Start the backend locally

When you want the Python backend available during local development:

```bash
cd /Users/erdi/Documents/repository/ervis
./scripts/run-local-backend.sh
```

Backend endpoints:

- `http://127.0.0.1:8000/healthz`
- `http://127.0.0.1:8000/readyz`

Important:

- The current frontend signup/login flow uses local Next.js auth routes and does not depend on the Python backend.
- The backend still points to the same local Postgres target as the frontend local workflow by preferring `frontend/.env` when run locally.
- If port `8000` is already occupied by the old Docker backend, stop it first with `docker stop ervis-backend-1`.

## Useful local commands

```bash
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

```bash
cd frontend
npm run db:logs
npm run db:down
npm run db:stop
```

## Docker and deployment readiness

The deployment-safe path is:

- build the frontend image from `frontend/Dockerfile`
- provide runtime env vars from the platform
- let startup checks fail fast when required production env is missing
- keep migrations explicit with `APPLY_MIGRATIONS_ON_STARTUP`
- use `/healthz` for container liveness

### Required production env

- `DATABASE_URL`
- `AUTH_SECRET`

`NEXTAUTH_URL` or `NEXT_PUBLIC_APP_URL` is strongly recommended.
If you intentionally rely on forwarded host headers with `AUTH_TRUST_HOST=true`, startup now allows that path and logs a warning instead of failing.

### Recommended production env

- `APP_TIME_ZONE=Europe/Istanbul`
- `TZ=Europe/Istanbul`
- `APPLY_MIGRATIONS_ON_STARTUP=true`
- `WAIT_FOR_DATABASE_ON_STARTUP=true`

### Startup behavior

`npm run start:prod` now does the following in order:

1. Loads env in a predictable layered order for the current `NODE_ENV`
2. Normalizes auth/app URL aliases
3. Validates required production env vars
4. Waits for database connectivity when enabled
5. Runs `prisma migrate deploy` when `APPLY_MIGRATIONS_ON_STARTUP=true`
6. Starts Next.js on `0.0.0.0:$PORT`

### Healthcheck strategy

- `GET /healthz` and `GET /api/health` both return a lightweight JSON payload
- Dockerfile includes a container-level healthcheck against `/healthz`
- `frontend/docker-compose.yml` uses the same route for service health
- health payload exposes environment plus whether DB/auth env is configured, without forcing a DB query on every probe

### Dokploy-style deployment notes

- Prefer setting env vars in Dokploy instead of baking any `.env.production` file into the image
- Keep `AUTH_SECRET` platform-managed and non-placeholder
- If the database is managed separately, point `DATABASE_URL` directly at that service
- If migrations should run during release startup, keep `APPLY_MIGRATIONS_ON_STARTUP=true`
- If migrations are handled by a separate release job, set `APPLY_MIGRATIONS_ON_STARTUP=false`

### Root compose deployment notes

The root [docker-compose.yml](/Users/erdi/Documents/repository/ervis/docker-compose.yml) is the Dokploy-oriented stack:

- `migrator` runs `npm run db:migrate:deploy` explicitly before frontend starts
- frontend startup keeps `APPLY_MIGRATIONS_ON_STARTUP=false` so migrations are not run twice
- frontend healthcheck uses `/healthz`
- both `migrator` and frontend use the same `DATABASE_URL` shape, including `?schema=public`

If a throwaway deployment environment already contains an old incompatible schema and you intentionally want to wipe it, set:

```bash
ALLOW_DESTRUCTIVE_BASELINE_RESET=true
```

Important:

- only use that on disposable environments
- keep it `false` for real production databases unless you explicitly want a destructive rebuild

## Recommended local startup sequence

```bash
cd /Users/erdi/Documents/repository/ervis/frontend
npm run db:start
npm run db:migrate:deploy
npm run dev
```

In a second terminal:

```bash
cd /Users/erdi/Documents/repository/ervis
./scripts/run-local-backend.sh
```

## Local reset sequence

```bash
cd /Users/erdi/Documents/repository/ervis/frontend
npm run db:reset:local
npm run db:start
npm run db:migrate:deploy
```

## Local verification checklist

1. `http://localhost:3000/healthz` returns `200`.
2. `http://127.0.0.1:8000/healthz` returns `200` if the backend is running.
3. `http://127.0.0.1:8000/readyz` returns `200` if the backend can reach the local auth tables.
4. Opening `http://localhost:3000/` sends signed-out users to sign-in and signed-in users to `/app`.
5. Signing up through the frontend creates a row in the local `users` table on the `ervis-local` Postgres container.
