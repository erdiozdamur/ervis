# Environment Setup

Ervis now requires strict environment configuration.

## 1) Choose environment

Set `APP_ENV` to one of:
- `development`
- `staging`
- `production`

Backend loads `.env.<APP_ENV>` when that file exists.

## 2) Required variables

These are mandatory for backend runtime:
- `APP_ENV`
- `DATABASE_URL`
- `JWT_SECRET_KEY`

These are required by Docker compose:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `OPENAI_API_KEY`
- `JWT_SECRET_KEY`
- `APP_ENV`

## 3) Script-only variables

The following are required by setup/verification scripts:
- `ERVIS_SEED_USERNAME`
- `ERVIS_SEED_EMAIL`
- `ERVIS_SEED_PASSWORD`
- `ERVIS_TEST_USER`
- `ERVIS_TEST_EMAIL`
- `ERVIS_TEST_PASS`

Optional:
- `ERVIS_BASE_URL` (default: `http://localhost:8000`)

## 4) Example templates

Use one of:
- `.env.development.example`
- `.env.staging.example`
- `.env.production.example`

Copy the template to your real env file and replace placeholder secrets.

## 5) Test-Prod parity workflow

When test database is behind production schema:

1. Set these variables:
   - `PROD_DATABASE_URL`
   - `TEST_DATABASE_URL`
2. Run table-level parity report:
   - `python check_env_parity.py`
3. If test is missing tables and you want a full mirror of production schema on test, run:
   - `CONFIRM_SYNC=YES ./sync_test_db_with_prod.sh`

> `sync_test_db_with_prod.sh` drops and recreates the `public` schema on **test** database before importing production schema.

## 6) Frontend proxy upstream (important)

`/api` requests from the frontend are proxied by Nginx to `API_UPSTREAM`.

- In `docker-compose`, default is `backend:8000` (service DNS name).
- In standalone frontend container deployments, set `API_UPSTREAM` explicitly (for example `127.0.0.1:8000` for sidecar/same-pod backend, or `api.example.com:443` behind TLS-terminating proxy).

If `API_UPSTREAM` cannot be resolved by the container runtime DNS, Nginx returns `502` with errors such as `backend could not be resolved`.
