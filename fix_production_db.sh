#!/bin/bash

# Ervis Production Database Fix Script
# Resolves: FATAL: password authentication failed for user "ervis"

echo "🔍 Detecting database container..."
DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)

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
echo "🚀 Updating database password for user 'ervis'..."
DB_PASS="ervis_password"
docker exec -it "$DB_CONTAINER" psql -U ervis -d ervis_core -c "ALTER USER ervis WITH PASSWORD '$DB_PASS';"

if [ $? -eq 0 ]; then
    echo "✨ Password updated successfully!"
else
    echo "⚠️ Failed to update password. If this is the first run, the user 'ervis' might not exist yet."
fi

# 2. Initialize Schema (if not already done by backend)
if [ ! -z "$BACKEND_CONTAINER" ]; then
    echo "🔨 Ensuring database schema is initialized..."
    docker exec -it "$BACKEND_CONTAINER" python -c "from api import _init_database; _init_database()"
fi

# 3. Verification
if [ ! -z "$BACKEND_CONTAINER" ]; then
    echo "🧪 Running verification test in backend..."
    if [ -f "verify_system.py" ]; then
        docker cp verify_system.py "$BACKEND_CONTAINER":/app/verify_system.py
        docker exec -it "$BACKEND_CONTAINER" python /app/verify_system.py
    else
        echo "💡 verify_system.py locally not found. Skipping auto-test."
    fi
fi

echo "✅ Done! Please restart your containers if necessary: docker-compose restart"
