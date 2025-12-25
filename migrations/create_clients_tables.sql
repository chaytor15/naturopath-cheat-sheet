-- Migration: Create Clients, Client Notes, and Formulas Tables
-- Date: 2025-01-XX
-- Description: Creates tables for client management, notes, and formula tracking

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  dob date,
  tags text[],
  flags jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON clients(full_name);

-- RLS Policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own clients
CREATE POLICY "Users can view their own clients"
ON clients FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own clients
CREATE POLICY "Users can insert their own clients"
ON clients FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own clients
CREATE POLICY "Users can update their own clients"
ON clients FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own clients
CREATE POLICY "Users can delete their own clients"
ON clients FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- CLIENT NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_user_id ON client_notes(user_id);

-- RLS Policies
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view notes for their own clients
CREATE POLICY "Users can view notes for their own clients"
ON client_notes FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = client_notes.client_id
    AND clients.user_id = auth.uid()
  )
);

-- Policy: Users can insert notes for their own clients
CREATE POLICY "Users can insert notes for their own clients"
ON client_notes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = client_notes.client_id
    AND clients.user_id = auth.uid()
  )
);

-- Policy: Users can update their own notes
CREATE POLICY "Users can update their own notes"
ON client_notes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
ON client_notes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- FORMULAS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  status text NOT NULL CHECK (status IN ('draft', 'final')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_formulas_client_id ON formulas(client_id);
CREATE INDEX IF NOT EXISTS idx_formulas_user_id ON formulas(user_id);
CREATE INDEX IF NOT EXISTS idx_formulas_status ON formulas(status);

-- RLS Policies
ALTER TABLE formulas ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own formulas
CREATE POLICY "Users can view their own formulas"
ON formulas FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own formulas
CREATE POLICY "Users can insert their own formulas"
ON formulas FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own formulas
CREATE POLICY "Users can update their own formulas"
ON formulas FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own formulas
CREATE POLICY "Users can delete their own formulas"
ON formulas FOR DELETE
TO authenticated
USING (auth.uid() = user_id);








