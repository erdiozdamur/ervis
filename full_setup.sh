#!/bin/bash

# Ervis Unified Setup & Reset Script
# Handles: DB Auth Fix, Schema Init, Data Reset, and User Creation

echo "🚀 Starting Full System Setup..."

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

# Detect Containers
DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)
BACKEND_CONTAINER=$(docker ps --filter "name=backend" --format "{{.Names}}" | head -n 1)

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ DB Container not found."
    exit 1
fi

# 1. Fix DB Password (in case of volume mismatch)
echo "🔑 1. Fixing Database Password..."
docker exec -i "$DB_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';" || echo "⚠️ Warning during password update (safe for first run)."

# 2. Reset Data and Create User
echo "🧹 2. Resetting data and creating user from environment..."
if [ ! -z "$BACKEND_CONTAINER" ]; then
    # Copy scripts to container
    docker cp reset_db_and_add_user.py "$BACKEND_CONTAINER":/app/reset_db_and_add_user.py
    docker cp models.py "$BACKEND_CONTAINER":/app/models.py
    docker cp services/auth_service.py "$BACKEND_CONTAINER":/app/services/auth_service.py
    
    # Run reset script
    docker exec -it \
      -e ERVIS_SEED_USERNAME="$ERVIS_SEED_USERNAME" \
      -e ERVIS_SEED_EMAIL="$ERVIS_SEED_EMAIL" \
      -e ERVIS_SEED_PASSWORD="$ERVIS_SEED_PASSWORD" \
      "$BACKEND_CONTAINER" python reset_db_and_add_user.py
else
    echo "❌ Backend container not found. Cannot run reset script."
    exit 1
fi

# 3. Final Verification
echo "🧪 3. Running final verification..."
if [ -f "verify_system.py" ]; then
    # Update verify_system.py locally if needed, but we'll assume it's updated or passed
    docker cp verify_system.py "$BACKEND_CONTAINER":/app/verify_system.py
    docker exec -it \
      -e ERVIS_TEST_EMAIL="$ERVIS_TEST_EMAIL" \
      -e ERVIS_TEST_USER="$ERVIS_TEST_USER" \
      -e ERVIS_TEST_PASS="$ERVIS_TEST_PASS" \
      "$BACKEND_CONTAINER" python verify_system.py
fi

echo "✨ All environments updated! Please restart: docker-compose restart"
