-- Migration: Add company_name, phone, and profile_picture to profiles table
-- Date: 2025-12-20
-- Description: Adds company name, phone number, and profile picture fields to user profiles

-- Add new columns (all nullable to support existing data)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS profile_picture text;

-- Add index for company_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_company_name ON profiles(company_name);



















