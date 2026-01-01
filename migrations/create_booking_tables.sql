-- Migration: Create Booking System Tables
-- Date: 2025-01-XX
-- Description: Creates tables for bookings, consult types, clinic settings, and calendar integration

-- ============================================
-- CONSULT_TYPE_PRICING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS consult_type_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consult_type text NOT NULL,
  name text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  price decimal(10, 2) NOT NULL CHECK (price >= 0),
  is_custom boolean DEFAULT false,
  display_order integer DEFAULT 0,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(practitioner_id, consult_type)
);

CREATE INDEX IF NOT EXISTS idx_consult_type_pricing_practitioner ON consult_type_pricing(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_consult_type_pricing_enabled ON consult_type_pricing(practitioner_id, enabled) WHERE enabled = true;

ALTER TABLE consult_type_pricing ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist, then create them
DROP POLICY IF EXISTS "Users can view their own consult types" ON consult_type_pricing;
CREATE POLICY "Users can view their own consult types"
ON consult_type_pricing FOR SELECT
TO authenticated
USING (auth.uid() = practitioner_id);

DROP POLICY IF EXISTS "Users can insert their own consult types" ON consult_type_pricing;
CREATE POLICY "Users can insert their own consult types"
ON consult_type_pricing FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = practitioner_id);

DROP POLICY IF EXISTS "Users can update their own consult types" ON consult_type_pricing;
CREATE POLICY "Users can update their own consult types"
ON consult_type_pricing FOR UPDATE
TO authenticated
USING (auth.uid() = practitioner_id)
WITH CHECK (auth.uid() = practitioner_id);

DROP POLICY IF EXISTS "Users can delete their own consult types" ON consult_type_pricing;
CREATE POLICY "Users can delete their own consult types"
ON consult_type_pricing FOR DELETE
TO authenticated
USING (auth.uid() = practitioner_id);

-- ============================================
-- CLINIC_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clinic_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Australia/Sydney',
  business_hours jsonb DEFAULT '{
    "monday": {"start": "09:00", "end": "17:00", "enabled": true},
    "tuesday": {"start": "09:00", "end": "17:00", "enabled": true},
    "wednesday": {"start": "09:00", "end": "17:00", "enabled": true},
    "thursday": {"start": "09:00", "end": "17:00", "enabled": true},
    "friday": {"start": "09:00", "end": "17:00", "enabled": true},
    "saturday": {"start": "09:00", "end": "13:00", "enabled": false},
    "sunday": {"start": "09:00", "end": "13:00", "enabled": false}
  }'::jsonb,
  advance_booking_days integer DEFAULT 30 CHECK (advance_booking_days > 0),
  email_templates jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_settings_user_id ON clinic_settings(user_id);

ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist, then create them
DROP POLICY IF EXISTS "Users can view their own clinic settings" ON clinic_settings;
CREATE POLICY "Users can view their own clinic settings"
ON clinic_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own clinic settings" ON clinic_settings;
CREATE POLICY "Users can insert their own clinic settings"
ON clinic_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own clinic settings" ON clinic_settings;
CREATE POLICY "Users can update their own clinic settings"
ON clinic_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- CALENDAR_CONNECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_id text,
  calendar_email text,
  connected_at timestamptz DEFAULT now(),
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id ON calendar_connections(user_id);

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist, then create them
DROP POLICY IF EXISTS "Users can view their own calendar connections" ON calendar_connections;
CREATE POLICY "Users can view their own calendar connections"
ON calendar_connections FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own calendar connections" ON calendar_connections;
CREATE POLICY "Users can insert their own calendar connections"
ON calendar_connections FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own calendar connections" ON calendar_connections;
CREATE POLICY "Users can update their own calendar connections"
ON calendar_connections FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own calendar connections" ON calendar_connections;
CREATE POLICY "Users can delete their own calendar connections"
ON calendar_connections FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  consult_type text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes text,
  calendar_event_id text,
  google_meet_link text,
  client_name text,
  client_email text,
  client_phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_bookings_practitioner_id ON bookings(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_practitioner_start ON bookings(practitioner_id, start_time);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist, then create them
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
CREATE POLICY "Users can view their own bookings"
ON bookings FOR SELECT
TO authenticated
USING (auth.uid() = practitioner_id);

DROP POLICY IF EXISTS "Users can insert their own bookings" ON bookings;
CREATE POLICY "Users can insert their own bookings"
ON bookings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = practitioner_id);

DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;
CREATE POLICY "Users can update their own bookings"
ON bookings FOR UPDATE
TO authenticated
USING (auth.uid() = practitioner_id)
WITH CHECK (auth.uid() = practitioner_id);

DROP POLICY IF EXISTS "Users can delete their own bookings" ON bookings;
CREATE POLICY "Users can delete their own bookings"
ON bookings FOR DELETE
TO authenticated
USING (auth.uid() = practitioner_id);


