#!/bin/bash

# Start of Session Script
# Starts database and dev servers

cd "/Users/tommoran/Dropbox/Mac (2)/Desktop/NotWork/EHRTest"

echo "========================================="
echo "      STARTING EHR DEV ENVIRONMENT      "
echo "========================================="
echo ""

# Step 1: Start Docker database
echo "1. Checking database..."
if docker ps | grep -q "ehr-postgres"; then
    echo "   Database already running!"
else
    echo "   Starting database..."
    docker-compose up -d postgres
    sleep 3
    if docker ps | grep -q "ehr-postgres"; then
        echo "   Database started!"
    else
        echo "   ERROR: Database failed to start"
        exit 1
    fi
fi

echo ""

# Step 2: Start API server
echo "2. Checking API server..."
if lsof -i :3000 | grep -q LISTEN; then
    echo "   API already running on http://localhost:3000"
else
    echo "   Starting API server..."
    npm run dev:api &
    sleep 3
    echo "   API running on http://localhost:3000"
fi

echo ""

# Step 3: Start Web server
echo "3. Checking Web server..."
if lsof -i :5173 2>/dev/null | grep -q LISTEN; then
    echo "   Web already running on http://localhost:5173"
elif lsof -i :5174 2>/dev/null | grep -q LISTEN; then
    echo "   Web already running on http://localhost:5174"
elif lsof -i :5175 2>/dev/null | grep -q LISTEN; then
    echo "   Web already running on http://localhost:5175"
else
    echo "   Starting Web server..."
    npm run dev:web &
    sleep 3
    echo "   Web starting on http://localhost:5173"
fi

echo ""
echo "========================================="
echo "           READY TO GO!                 "
echo "========================================="
echo ""
echo "Open http://localhost:5173 in your browser"
echo "(or 5174/5175 if port was busy)"
echo ""
echo "Logins:"
echo "  - doc@t.co / 123 (provider)"
echo "  - sec@t.co / 123 (secretary)"
echo ""
