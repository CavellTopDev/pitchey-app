-- Migration to fix NDA schema issues
-- Adds missing columns that are required by the application code

-- Add missing columns to nda_requests table
ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS nda_type VARCHAR(50) DEFAULT 'basic';
ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP;

-- Add missing columns to ndas table  
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS nda_type VARCHAR(50) DEFAULT 'basic';
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS access_granted BOOLEAN DEFAULT true;
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMP;
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS signature_data JSONB;
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS custom_nda_url TEXT;

-- Update any existing records to have default values
UPDATE nda_requests SET nda_type = 'basic' WHERE nda_type IS NULL;
UPDATE ndas SET nda_type = 'basic' WHERE nda_type IS NULL;
UPDATE ndas SET access_granted = true WHERE access_granted IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_nda_requests_nda_type ON nda_requests(nda_type);
CREATE INDEX IF NOT EXISTS idx_ndas_nda_type ON ndas(nda_type);
CREATE INDEX IF NOT EXISTS idx_ndas_access_granted ON ndas(access_granted);

-- Fix column naming mismatch (ensure both camelCase and snake_case work)
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE ndas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add comments for documentation
COMMENT ON COLUMN nda_requests.nda_type IS 'Type of NDA requested: basic, enhanced, or custom';
COMMENT ON COLUMN ndas.nda_type IS 'Type of NDA signed: basic, enhanced, or custom';
COMMENT ON COLUMN ndas.access_granted IS 'Whether access is currently granted (can be revoked)';
COMMENT ON COLUMN ndas.access_revoked_at IS 'Timestamp when access was revoked';