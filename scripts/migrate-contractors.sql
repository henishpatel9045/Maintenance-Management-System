-- Additive indexes and constraints for Contractors Module
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS contractors_company_name_trgm_idx ON contractors USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS contractors_trading_name_trgm_idx ON contractors USING gin (trading_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS contractor_contacts_name_trgm_idx ON contractor_contacts USING gin (name gin_trgm_ops);

-- Unique non-null registration number per type among non-archived contractors
CREATE UNIQUE INDEX IF NOT EXISTS contractors_reg_num_type_unique_idx 
ON contractors (registration_number, registration_type) 
WHERE registration_number IS NOT NULL AND archived_at IS NULL;

-- Exactly one primary contact per contractor
CREATE UNIQUE INDEX IF NOT EXISTS contractor_contacts_one_primary_idx 
ON contractor_contacts (contractor_id) 
WHERE is_primary = true;
