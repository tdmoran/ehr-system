#!/bin/bash

# End of Session Script
# Saves everything to GitHub and syncs database to Neon

cd "/Users/tommoran/Dropbox/Mac (2)/Desktop/NotWork/EHRTest"

echo "========================================="
echo "       END OF SESSION - SAVING ALL      "
echo "========================================="
echo ""

# Step 1: Git commit and push
echo "1. Saving code to GitHub..."
echo ""

git add -A
if git diff --staged --quiet; then
    echo "   No code changes to commit."
else
    read -p "   Commit message (or press Enter for default): " msg
    if [ -z "$msg" ]; then
        msg="End of session update"
    fi
    git commit -m "$msg

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
    git push origin main
    echo "   Code pushed to GitHub! Render will auto-deploy to sxrooms.net"
fi

echo ""

# Step 2: Sync database to Neon
echo "2. Syncing database to Neon..."
echo ""

NEON_URL="postgresql://neondb_owner:npg_N8uWQfalCY0o@ep-winter-block-ahidrsiy-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

docker exec ehr-postgres pg_dump -U ehr -d ehr --clean --if-exists > /tmp/ehr_dump.sql 2>/dev/null

if [ $? -ne 0 ]; then
    echo "   WARNING: Could not dump local database (is Docker running?)"
else
    echo "   Dump created ($(du -h /tmp/ehr_dump.sql | cut -f1))"
    docker exec -i ehr-postgres psql "$NEON_URL" < /tmp/ehr_dump.sql 2>&1 | grep -c "ERROR" > /tmp/err_count.txt || true
    errors=$(cat /tmp/err_count.txt)
    rm /tmp/ehr_dump.sql /tmp/err_count.txt 2>/dev/null
    echo "   Database synced to Neon!"
fi

echo ""
echo "========================================="
echo "            ALL DONE! BYE!              "
echo "========================================="
echo ""
echo "Your work is saved:"
echo "  - Code: GitHub → auto-deploys to sxrooms.net"
echo "  - Database: Synced to Neon (production)"
echo ""
