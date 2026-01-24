-- Migration: Add secretary role and provider_id column
-- Run this on an existing database to add secretary functionality

-- Step 1: Add provider_id column to users table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'provider_id') THEN
        ALTER TABLE users ADD COLUMN provider_id UUID REFERENCES users(id);
        CREATE INDEX idx_users_provider ON users(provider_id) WHERE provider_id IS NOT NULL;
    END IF;
END $$;

-- Step 2: Update the role CHECK constraint to include 'secretary'
-- First, drop the old constraint and add the new one
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('provider', 'nurse', 'admin', 'billing', 'secretary'));

-- Step 3: Insert secretary user (linked to Dr. Moran)
-- Skip if already exists
INSERT INTO users (id, email, password_hash, first_name, last_name, role, provider_id)
SELECT
    'a0000000-0000-0000-0000-000000000004',
    'secretary.moran@example.com',
    '$2b$10$hkCFa4g6UL4PzHft.gVNNesI5KyTV.wWV38AtP9pX6dPC4H24lWzy',
    'Emily',
    'Smith',
    'secretary',
    'a0000000-0000-0000-0000-000000000002'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'secretary.moran@example.com'
);
