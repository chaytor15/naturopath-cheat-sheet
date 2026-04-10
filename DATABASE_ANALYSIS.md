# Database Schema Analysis

## Database Tables Overview

### 1. **profiles** (6 rows)
**Purpose:** User profile information linked to Supabase Auth
- `id` (uuid, PK) → References `auth.users.id`
- `full_name` (text, nullable)
- `email` (text, nullable)
- `plan` (plan_type enum: 'free', 'lifetime', 'paid', default: 'free')
- `stripe_customer_id` (text, nullable)
- `trial_ends_at` (timestamptz, nullable)
- `role` (text, default: 'user')
- `created_at`, `updated_at`, `plan_updated_at` (timestamptz)

**RLS:** ✅ Enabled

### 2. **conditions** (46 rows)
**Purpose:** Health conditions/concerns organized by body system
- `id` (uuid, PK)
- `slug` (text, unique)
- `name` (text)
- `description` (text, nullable)
- `body_system` (text, nullable) - e.g., "Digestive", "Respiratory"
- `life_stage` (text, nullable)
- `tags` (text[], nullable)
- `is_free` (boolean, default: false) - determines if free users can access
- `created_at` (timestamptz)

**RLS:** ✅ Enabled

### 3. **herbs** (172 rows)
**Purpose:** Master herb catalog with properties
- `id` (uuid, PK)
- `herb_name` (text, unique)
- `latin_name` (text, nullable, unique)
- `actions` (text, nullable)
- `energetic_properties` (text, nullable)
- `safety_precautions` (text, nullable)
- `created_at` (timestamptz)

**RLS:** ❌ Disabled (public read access)

### 4. **condition_herbs** (462 rows)
**Purpose:** Junction table linking conditions to herbs with condition-specific dosage info
- `id` (uuid, PK)
- `condition_id` (uuid, FK → conditions.id, CASCADE delete)
- `herb_id` (uuid, FK → herbs.id, CASCADE delete)
- `indications` (text, nullable) - condition-specific indications
- `ratio` (text, nullable)
- `dose_min_ml` (numeric, nullable) - therapeutic range for 100mL bottle
- `dose_max_ml` (numeric, nullable)
- `dose_unit` (text, nullable)
- `therapeutic_dosage` (text, nullable)
- `notes` (text, nullable)

**RLS:** ✅ Enabled
**Unique Constraint:** ✅ (condition_id, herb_id) - prevents duplicate herb-condition pairs

### 5. **patterns** (0 rows)
**Purpose:** Patterns within conditions (currently unused)
- `id` (uuid, PK)
- `condition_id` (uuid, FK → conditions.id, CASCADE delete)
- `slug` (text)
- `name` (text)
- `description` (text, nullable)
- `key_symptoms` (text, nullable)
- `severity` (text, nullable)
- `is_free` (boolean, default: false)
- `created_at` (timestamptz)

**RLS:** ✅ Enabled
**Unique Constraint:** ✅ (condition_id, slug)

### 6. **pattern_herbs** (0 rows)
**Purpose:** Junction table linking patterns to herbs (currently unused)
- `id` (uuid, PK)
- `pattern_id` (uuid, FK → patterns.id, CASCADE delete)
- `herb_id` (uuid, FK → herbs.id, CASCADE delete)
- `dose_min`, `dose_max` (numeric, nullable)
- `dose_unit`, `form`, `frequency`, `role`, `notes` (text, nullable)

**RLS:** ✅ Enabled
**Unique Constraint:** ✅ (pattern_id, herb_id)

### 7. **staging_condition_herbs_new** (467 rows)
**Purpose:** Staging table for data imports (not used in application code)
- `id` (bigint, PK, auto-increment)
- Various columns for staging data

**RLS:** ❌ Disabled

---

## Relationship Diagram

```
auth.users (Supabase Auth)
    ↓ (1:1)
profiles
    ├─ id (FK to auth.users.id)

conditions
    ├─ id (PK)
    ↓ (1:many, CASCADE)
condition_herbs
    ├─ condition_id (FK → conditions.id)
    ├─ herb_id (FK → herbs.id)
    ↓ (many:1)
herbs
    ├─ id (PK)

conditions
    ↓ (1:many, CASCADE)
patterns
    ├─ condition_id (FK → conditions.id)
    ↓ (1:many, CASCADE)
pattern_herbs
    ├─ pattern_id (FK → patterns.id)
    ├─ herb_id (FK → herbs.id)
```

---

## Foreign Key Analysis

### ✅ Existing Foreign Keys (All Present)

1. **profiles.id → auth.users.id**
   - Constraint: `profiles_id_fkey`
   - Delete Rule: Not specified (inherits from auth.users)
   - ✅ **Correct**

2. **condition_herbs.condition_id → conditions.id**
   - Constraint: `condition_herbs_condition_id_fkey`
   - Delete Rule: CASCADE
   - ✅ **Correct** - Deleting a condition removes its herb associations

3. **condition_herbs.herb_id → herbs.id**
   - Constraint: `condition_herbs_herb_id_fkey`
   - Delete Rule: CASCADE
   - ⚠️ **Warning:** CASCADE delete on herbs might be too aggressive. If an herb is used in multiple conditions, deleting it removes all associations. Consider SET NULL or RESTRICT if herbs should be preserved.

4. **patterns.condition_id → conditions.id**
   - Constraint: `patterns_condition_id_fkey`
   - Delete Rule: CASCADE
   - ✅ **Correct**

5. **pattern_herbs.pattern_id → patterns.id**
   - Constraint: `pattern_herbs_pattern_id_fkey`
   - Delete Rule: CASCADE
   - ✅ **Correct**

6. **pattern_herbs.herb_id → herbs.id**
   - Constraint: `pattern_herbs_herb_id_fkey`
   - Delete Rule: CASCADE
   - ⚠️ **Same warning as #3**

### ❌ Missing Foreign Keys

**None identified** - All relationships are properly constrained.

---

## Index Analysis

### ✅ Existing Indexes

1. **Primary Keys** (all tables have PK indexes)
   - All tables have unique indexes on `id`

2. **Unique Constraints**
   - `conditions.slug` - ✅ Indexed
   - `herbs.herb_name` - ✅ Indexed
   - `herbs.latin_name` - ✅ Indexed (nullable, but unique when present)
   - `condition_herbs(condition_id, herb_id)` - ✅ Indexed (3 duplicate indexes - see issues below)
   - `patterns(condition_id, slug)` - ✅ Indexed
   - `pattern_herbs(pattern_id, herb_id)` - ✅ Indexed

### ❌ Missing Indexes (Performance Issues)

Based on your code queries, these indexes are **critical** for performance:

1. **condition_herbs.condition_id** ❌ **MISSING**
   - **Impact:** HIGH - Your app queries `condition_herbs` filtered by `condition_id` frequently
   - **Query:** `SELECT ... FROM condition_herbs WHERE condition_id = ?`
   - **Recommendation:** Add index immediately

2. **conditions.body_system** ❌ **MISSING**
   - **Impact:** HIGH - Used in `SELECT DISTINCT body_system FROM conditions`
   - **Query:** `SELECT ... FROM conditions WHERE body_system = ?`
   - **Recommendation:** Add index

3. **conditions.is_free** ❌ **MISSING**
   - **Impact:** MEDIUM - Used for filtering free vs paid content
   - **Query:** Used in WHERE clauses for plan-based filtering
   - **Recommendation:** Consider composite index with `body_system` if often queried together

4. **patterns.condition_id** ❌ **MISSING**
   - **Impact:** LOW (table is empty, but should be indexed for future use)
   - **Reason:** Foreign key columns should typically be indexed
   - **Recommendation:** Add index for future-proofing

5. **pattern_herbs.pattern_id** ❌ **MISSING**
   - **Impact:** LOW (table is empty)
   - **Reason:** Foreign key columns should typically be indexed
   - **Recommendation:** Add index for future-proofing

6. **profiles.plan** ❌ **MISSING**
   - **Impact:** MEDIUM - Queried in multiple places
   - **Query:** `SELECT plan FROM profiles WHERE id = ?`
   - **Note:** Since you're querying by `id` (PK), this might not be critical, but if you ever filter by plan, add it.

7. **profiles.email** ❌ **MISSING**
   - **Impact:** LOW - Not currently used in WHERE clauses, but could be useful for lookups
   - **Recommendation:** Add if you plan to query by email

### ⚠️ Issues Found

1. **Duplicate Unique Indexes on condition_herbs**
   - You have 3 identical unique indexes on `(condition_id, herb_id)`:
     - `condition_herbs_condition_herb_key`
     - `condition_herbs_condition_id_herb_id_key`
     - `condition_herbs_unique`
   - **Recommendation:** Drop 2 of them to reduce index maintenance overhead

---

## Recommended Indexes to Add

```sql
-- HIGH PRIORITY - Add immediately
CREATE INDEX idx_condition_herbs_condition_id ON condition_herbs(condition_id);
CREATE INDEX idx_conditions_body_system ON conditions(body_system);

-- MEDIUM PRIORITY - Add soon
CREATE INDEX idx_conditions_body_system_is_free ON conditions(body_system, is_free);
CREATE INDEX idx_profiles_plan ON profiles(plan);

-- LOW PRIORITY - For future use
CREATE INDEX idx_patterns_condition_id ON patterns(condition_id);
CREATE INDEX idx_pattern_herbs_pattern_id ON pattern_herbs(pattern_id);
CREATE INDEX idx_profiles_email ON profiles(email) WHERE email IS NOT NULL;

-- Cleanup duplicate indexes
DROP INDEX IF EXISTS condition_herbs_condition_herb_key;
DROP INDEX IF EXISTS condition_herbs_condition_id_herb_id_key;
-- Keep: condition_herbs_unique (or rename to standard name)
```

---

## Summary

### ✅ Strengths
- All foreign key relationships are properly defined
- CASCADE deletes are appropriate for most relationships
- Primary keys and unique constraints are indexed
- RLS is enabled on user-facing tables

### ⚠️ Critical Issues
1. **Missing index on `condition_herbs.condition_id`** - This will cause slow queries as data grows
2. **Missing index on `conditions.body_system`** - Used in frequent queries
3. **Duplicate indexes** - Wasting storage and maintenance overhead

### 📊 Performance Impact
- Current query performance: Likely acceptable with 46 conditions and 462 condition_herbs rows
- Future performance: Will degrade significantly without indexes as data grows
- Recommendation: Add the HIGH PRIORITY indexes before scaling












