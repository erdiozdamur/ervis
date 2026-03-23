#!/bin/bash

echo "🕵️ Starting Production DB Debugger..."

# Detect Containers
DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)
BACKEND_CONTAINER=$(docker ps --filter "name=backend" --format "{{.Names}}" | head -n 1)

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ Error: Could not find database container."
    docker ps
    exit 1
fi

echo "✅ DB Container: $DB_CONTAINER"
echo "✅ Backend Container: $BACKEND_CONTAINER"

# Check Environment in Backend
if [ ! -z "$BACKEND_CONTAINER" ]; then
    echo "📋 1. Checking DATABASE_URL in backend..."
    docker exec "$BACKEND_CONTAINER" env | grep DATABASE_URL
fi

# Try to Reset Password via Superuser (postgres or ervis)
echo "🔑 2. Attempting to reset 'ervis' password via multiple superusers..."

# Strategy A: Try as 'postgres' superuser
echo "   - Trying via 'postgres' user..."
docker exec -it "$DB_CONTAINER" psql -U postgres -d postgres -c "ALTER USER ervis WITH PASSWORD 'ervis_password';" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "   ✅ Password reset successful via 'postgres' user."
else
    # Strategy B: Try as 'ervis' superuser (if it was the initial user)
    echo "   - Trying via 'ervis' user..."
    # We use a trick: bypass password if we are inside the container and use 'peer' or 'md5' isn't forced for localhost exec
    docker exec -it "$DB_CONTAINER" psql -U ervis -d ervis_core -c "ALTER USER ervis WITH PASSWORD 'ervis_password';" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Password reset successful via 'ervis' user."
    else
        echo "   ❌ Failed to reset password automatically."
        echo "   Manual check: docker exec -it $DB_CONTAINER psql -U <any_user> -d <any_db>"
    fi
fi

# Check if tables exist
echo "📊 3. Checking if 'users' table exists..."
docker exec -it "$DB_CONTAINER" psql -U ervis -d ervis_core -c "\dt" | grep users

echo "🏁 Debugging complete. Please restart the backend and check logs."
