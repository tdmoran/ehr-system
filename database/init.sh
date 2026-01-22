#!/bin/bash
set -e

echo "Running database migrations..."

# Run all migration files in order
for f in /docker-entrypoint-initdb.d/migrations/*.sql; do
  if [ -f "$f" ]; then
    echo "Running migration: $f"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
  fi
done

echo "Running seed data..."

# Run seed files (only in development)
for f in /docker-entrypoint-initdb.d/seeds/*.sql; do
  if [ -f "$f" ]; then
    echo "Running seed: $f"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
  fi
done

echo "Database initialization complete!"
