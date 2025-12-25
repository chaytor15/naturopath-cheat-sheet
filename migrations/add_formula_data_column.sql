-- Migration: Add formula_data column to formulas table
-- Date: 2025-01-XX
-- Description: Adds a jsonb column to store full tonic/formula data

-- Add formula_data column to formulas table
ALTER TABLE formulas
ADD COLUMN IF NOT EXISTS formula_data jsonb;

-- Add comment to document the column
COMMENT ON COLUMN formulas.formula_data IS 'Stores complete tonic/formula data including herbs, dosages, client info, etc.';








