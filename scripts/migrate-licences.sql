-- Migration script for Module: licences
-- Run on PostgreSQL database

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Trigram index on LicenceType name
CREATE INDEX IF NOT EXISTS licence_types_name_trgm_idx ON licence_types USING gin (name gin_trgm_ops);

-- 2. Partial unique index: at most one non-archived, non-superseded record per (user_id, licence_type_id, class)
CREATE UNIQUE INDEX IF NOT EXISTS user_licences_unique_active_idx 
ON user_licences (user_id, licence_type_id, COALESCE(class, '')) 
WHERE archived_at IS NULL AND superseded_by_id IS NULL;

-- 3. Composite indexes for high-performance directory filtering & expiry status refresh
CREATE INDEX IF NOT EXISTS user_licences_user_status_idx ON user_licences (user_id, status);
CREATE INDEX IF NOT EXISTS user_licences_type_status_expiry_idx ON user_licences (licence_type_id, status, expires_at);
CREATE INDEX IF NOT EXISTS seva_required_licences_seva_idx ON seva_required_licences (seva_id);
