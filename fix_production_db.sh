#!/bin/bash

# Ervis Production Database Fix Script
# Resolves: FATAL: password authentication failed for user "ervis"

echo "🔍 Detecting database container..."
DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)

# Required environment variables
required_vars=(
    POSTGRES_USER
    POSTGRES_PASSWORD
    POSTGRES_DB
    ERVIS_SEED_USERNAME
    ERVIS_SEED_EMAIL
    ERVIS_SEED_PASSWORD
    ERVIS_TEST_USER
    ERVIS_TEST_EMAIL
    ERVIS_TEST_PASS
)
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing required environment variable: $var"
        exit 1
    fi
done

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ Error: Could not find a container with 'db' in its name."
    echo "Current running containers:"
    docker ps --format "{{.Names}}"
    exit 1
fi

echo "✅ Found database container: $DB_CONTAINER"

echo "🔍 Detecting backend container..."
BACKEND_CONTAINER=$(docker ps --filter "name=backend" --format "{{.Names}}" | head -n 1)

if [ -z "$BACKEND_CONTAINER" ]; then
    echo "⚠️ Warning: Could not find backend container. Will skip verification."
fi

# 1. Update Database Password
echo "🚀 Updating database password for user '$POSTGRES_USER'..."
docker exec -i "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';"

if [ $? -eq 0 ]; then
    echo "✨ Password updated successfully!"
else
    echo "⚠️ Failed to update password. If this is the first run, the user '$POSTGRES_USER' might not exist yet."
fi

# 2. Initialize Schema (if not already done by backend)
if [ ! -z "$BACKEND_CONTAINER" ]; then
    echo "🔨 Ensuring database schema is initialized..."
    docker exec -it "$BACKEND_CONTAINER" python -c "from api import _init_database; _init_database()"
fi

# 3. Create/Reset Primary User (from environment)
if [ ! -z "$BACKEND_CONTAINER" ]; then
    echo "👤 Creating/Resetting user from environment..."
    if [ -f "reset_db_and_add_user.py" ]; then
        docker cp reset_db_and_add_user.py "$BACKEND_CONTAINER":/app/reset_db_and_add_user.py
        docker cp models.py "$BACKEND_CONTAINER":/app/models.py
        docker cp services/auth_service.py "$BACKEND_CONTAINER":/app/services/auth_service.py
        docker exec -it \
          -e ERVIS_SEED_USERNAME="$ERVIS_SEED_USERNAME" \
          -e ERVIS_SEED_EMAIL="$ERVIS_SEED_EMAIL" \
          -e ERVIS_SEED_PASSWORD="$ERVIS_SEED_PASSWORD" \
          "$BACKEND_CONTAINER" python /app/reset_db_and_add_user.py
    else
        echo "⚠️ reset_db_and_add_user.py not found locally. Skipping user creation."
    fi
fi

# 4. Verification
if [ ! -z "$BACKEND_CONTAINER" ]; then
    echo "🧪 Running verification test in backend..."
    if [ -f "verify_system.py" ]; then
        docker cp verify_system.py "$BACKEND_CONTAINER":/app/verify_system.py
        docker exec -it \
          -e ERVIS_TEST_EMAIL="$ERVIS_TEST_EMAIL" \
          -e ERVIS_TEST_USER="$ERVIS_TEST_USER" \
          -e ERVIS_TEST_PASS="$ERVIS_TEST_PASS" \
          "$BACKEND_CONTAINER" python /app/verify_system.py
    else
        echo "💡 verify_system.py locally not found. Skipping auto-test."
    fi
fi

echo "✅ Done! Please restart your containers if necessary: docker-compose restart"
