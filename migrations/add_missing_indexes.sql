-- Migration: Add Missing Indexes for Performance
-- Date: 2025-01-XX
-- Description: Adds critical indexes identified in database analysis

-- ============================================
-- HIGH PRIORITY INDEXES (Add Immediately)
-- ============================================

-- Index for condition_herbs.condition_id
-- Used in: SELECT ... FROM condition_herbs WHERE condition_id = ?
-- Impact: HIGH - This is your most frequent query pattern
CREATE INDEX IF NOT EXISTS idx_condition_herbs_condition_id 
ON condition_herbs(condition_id);

-- Index for conditions.body_system
-- Used in: SELECT DISTINCT body_system FROM conditions
-- Used in: SELECT ... FROM conditions WHERE body_system = ?
-- Impact: HIGH - Used in dropdown population and filtering
CREATE INDEX IF NOT EXISTS idx_conditions_body_system 
ON conditions(body_system);

-- ============================================
-- MEDIUM PRIORITY INDEXES
-- ============================================

-- Composite index for common query pattern
-- Used when filtering conditions by body_system AND is_free
CREATE INDEX IF NOT EXISTS idx_conditions_body_system_is_free 
ON conditions(body_system, is_free);

-- Index for profiles.plan
-- Used in: SELECT plan FROM profiles WHERE id = ?
-- Note: Less critical since you query by PK, but useful if you ever filter by plan
CREATE INDEX IF NOT EXISTS idx_profiles_plan 
ON profiles(plan);

-- ============================================
-- LOW PRIORITY INDEXES (Future-proofing)
-- ============================================

-- Index for patterns.condition_id (foreign key)
-- Currently unused, but should be indexed for future queries
CREATE INDEX IF NOT EXISTS idx_patterns_condition_id 
ON patterns(condition_id);

-- Index for pattern_herbs.pattern_id (foreign key)
-- Currently unused, but should be indexed for future queries
CREATE INDEX IF NOT EXISTS idx_pattern_herbs_pattern_id 
ON pattern_herbs(pattern_id);

-- Index for profiles.email (partial index for non-null emails)
-- Useful if you ever need to look up users by email
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON profiles(email) 
WHERE email IS NOT NULL;

-- ============================================
-- CLEANUP: Remove Duplicate Indexes
-- ============================================

-- Drop duplicate unique indexes on condition_herbs
-- You have 3 identical indexes on (condition_id, herb_id)
-- Keep only one (condition_herbs_unique) and drop the others

DROP INDEX IF EXISTS condition_herbs_condition_herb_key;
DROP INDEX IF EXISTS condition_herbs_condition_id_herb_id_key;

-- Note: condition_herbs_unique will remain as the unique constraint



