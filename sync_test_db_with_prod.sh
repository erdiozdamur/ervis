#!/usr/bin/env bash
set -euo pipefail

# Fully sync TEST schema from PROD schema.
# WARNING: This resets public schema on test database.

required_vars=(PROD_DATABASE_URL TEST_DATABASE_URL CONFIRM_SYNC)
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "❌ Missing required environment variable: $var"
    exit 1
  fi
done

if [[ "${CONFIRM_SYNC}" != "YES" ]]; then
  echo "❌ CONFIRM_SYNC must be YES to proceed."
  echo "   Example: CONFIRM_SYNC=YES ./sync_test_db_with_prod.sh"
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "❌ pg_dump is required but not found in PATH"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql is required but not found in PATH"
  exit 1
fi

echo "🔎 Step 1/4: Checking production/test schema parity before sync"
python check_env_parity.py || true

echo "🧹 Step 2/4: Resetting test public schema"
psql "${TEST_DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
SQL

echo "📦 Step 3/4: Copying production schema into test"
pg_dump "${PROD_DATABASE_URL}" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public | psql "${TEST_DATABASE_URL}" -v ON_ERROR_STOP=1

echo "🔁 Step 4/4: Applying current code metadata (create-if-missing safety)"
APP_ENV=${APP_ENV:-staging} DATABASE_URL="${TEST_DATABASE_URL}" python -c "from api import _init_database; _init_database()"

echo "✅ Sync finished. Running parity check again..."
python check_env_parity.py
