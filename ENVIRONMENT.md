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
