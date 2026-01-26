#!/bin/bash

# Start of Session Script
# Starts database and dev servers

cd "/Users/tommoran/Dropbox/Mac (2)/Desktop/NotWork/EHRTest"

echo "========================================="
echo "      STARTING EHR DEV ENVIRONMENT      "
echo "========================================="
echo ""

# Step 1: Start Docker database
echo "1. Starting database..."
docker-compose up -d postgres
sleep 3

# Check if healthy
if docker ps | grep -q "ehr-postgres"; then
    echo "   Database running!"
else
    echo "   ERROR: Database failed to start"
    exit 1
fi

echo ""

# Step 2: Start API server
echo "2. Starting API server..."
npm run dev:api &
sleep 3
echo "   API running on http://localhost:3000"

echo ""

# Step 3: Start Web server
echo "3. Starting Web server..."
npm run dev:web &
sleep 3
echo "   Web running on http://localhost:5173"

echo ""
echo "========================================="
echo "           READY TO GO!                 "
echo "========================================="
echo ""
echo "Open http://localhost:5173 in your browser"
echo ""
echo "Logins:"
echo "  - doc@t.co / 123 (provider)"
echo "  - sec@t.co / 123 (secretary)"
echo ""
