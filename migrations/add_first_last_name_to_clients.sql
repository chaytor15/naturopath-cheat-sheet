-- Migration: Add first_name and last_name columns to clients table
-- Date: 2025-12-20
-- Description: Adds first_name and last_name columns to support splitting full_name

-- Add first_name and last_name columns (nullable to support existing data)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text;

-- Migrate existing full_name data to first_name
-- This will set first_name to full_name for existing records
UPDATE clients 
SET first_name = full_name 
WHERE first_name IS NULL AND full_name IS NOT NULL;

-- Make full_name nullable since we're migrating away from it
ALTER TABLE clients 
ALTER COLUMN full_name DROP NOT NULL;

-- Add index for first_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_first_name ON clients(first_name);



















