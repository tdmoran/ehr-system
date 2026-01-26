#!/bin/bash

# Sync local Docker database to Neon
# Run this at the end of each session to push your local changes to production

NEON_URL="postgresql://neondb_owner:npg_N8uWQfalCY0o@ep-winter-block-ahidrsiy-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "=== Syncing local database to Neon ==="
echo ""

# Step 1: Dump local Docker database
echo "1. Dumping local Docker database..."
docker exec ehr-postgres pg_dump -U ehr -d ehr --clean --if-exists > /tmp/ehr_dump.sql

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to dump local database"
    exit 1
fi

echo "   Done. Dump size: $(du -h /tmp/ehr_dump.sql | cut -f1)"

# Step 2: Push to Neon (using Docker's psql since local psql may not be installed)
echo ""
echo "2. Pushing to Neon..."
docker exec -i ehr-postgres psql "$NEON_URL" < /tmp/ehr_dump.sql 2>&1 | grep -E "(ERROR|FATAL)" | head -5 || true

echo ""
echo "=== Sync complete! ==="
echo "Your Neon database now matches your local Docker database."

# Cleanup
rm /tmp/ehr_dump.sql
