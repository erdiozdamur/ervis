#!/bin/bash

# Ervis Unified Setup & Reset Script
# Handles: DB Auth Fix, Schema Init, Data Reset, and User Creation

echo "🚀 Starting Full System Setup..."

# Detect Containers
DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -n 1)
BACKEND_CONTAINER=$(docker ps --filter "name=backend" --format "{{.Names}}" | head -n 1)

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ DB Container not found."
    exit 1
fi

# 1. Fix DB Password (in case of volume mismatch)
echo "🔑 1. Fixing Database Password..."
docker exec -it "$DB_CONTAINER" psql -U ervis -d ervis_core -c "ALTER USER ervis WITH PASSWORD 'ervis_password';" || echo "⚠️ Warning during password update (safe for first run)."

# 2. Reset Data and Create User
echo "🧹 2. Resetting data and creating user: Erdi Özdamur..."
if [ ! -z "$BACKEND_CONTAINER" ]; then
    # Copy scripts to container
    docker cp reset_db_and_add_user.py "$BACKEND_CONTAINER":/app/reset_db_and_add_user.py
    docker cp models.py "$BACKEND_CONTAINER":/app/models.py
    docker cp services/auth_service.py "$BACKEND_CONTAINER":/app/services/auth_service.py
    
    # Run reset script
    docker exec -it "$BACKEND_CONTAINER" python reset_db_and_add_user.py
else
    echo "❌ Backend container not found. Cannot run reset script."
    exit 1
fi

# 3. Final Verification
echo "🧪 3. Running final verification..."
if [ -f "verify_system.py" ]; then
    # Update verify_system.py locally if needed, but we'll assume it's updated or passed
    docker cp verify_system.py "$BACKEND_CONTAINER":/app/verify_system.py
    # Change TEST_EMAIL and TEST_PASS in verification to match the requested user
    docker exec -it "$BACKEND_CONTAINER" python -c "
import verify_system
verify_system.TEST_EMAIL = 'e.ozdamur@gmail.com'
verify_system.TEST_USER = 'Erdi Özdamur'
verify_system.TEST_PASS = 'Erdi1903'
verify_system.verify_all()
"
fi

echo "✨ All environments updated! Please restart: docker-compose restart"
