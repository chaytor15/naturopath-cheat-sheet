-- =============================================================================
-- Onboarding + practice address (run once on your Supabase Postgres database)
--
-- Option A — from your machine (needs .env.local with DATABASE_URL or
--   SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL):
--   npm run db:migrate:onboarding
--
-- Option B — Supabase Dashboard → SQL Editor → New query → paste this file → Run
-- =============================================================================

-- Onboarding completion flag on profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Set when user finishes first-time setup; null means redirect to /onboarding.';

-- Existing rows: treat as already onboarded (only brand-new signups stay null until /onboarding).
UPDATE profiles
SET onboarding_completed_at = now()
WHERE onboarding_completed_at IS NULL;

-- Practice address on clinic_settings (booking / public-facing clinic)
ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS practice_street text,
ADD COLUMN IF NOT EXISTS practice_city text,
ADD COLUMN IF NOT EXISTS practice_region text,
ADD COLUMN IF NOT EXISTS practice_postcode text,
ADD COLUMN IF NOT EXISTS practice_country text;
