-- Enhanced NDA Workflow Database Schema
-- This migration adds comprehensive NDA management tables with audit trail and access control

-- Add missing columns to nda_requests table if they don't exist
ALTER TABLE nda_requests 
ADD COLUMN IF NOT EXISTS requester_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS nda_type VARCHAR(50) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS requested_access VARCHAR(50) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS access_level VARCHAR(50),
ADD COLUMN IF NOT EXISTS request_message TEXT,
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS custom_terms TEXT,
ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS download_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing columns for compatibility
UPDATE nda_requests SET requester_id = investor_id WHERE requester_id IS NULL AND investor_id IS NOT NULL;

-- Add missing columns to ndas table if they don't exist
ALTER TABLE ndas 
ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS watermark_config JSONB,
ADD COLUMN IF NOT EXISTS download_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS signature_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS signer_ip VARCHAR(45),
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS revoked_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS revocation_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);

-- Create pitch_access table for fine-grained access control
CREATE TABLE IF NOT EXISTS pitch_access (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  access_level VARCHAR(50) NOT NULL DEFAULT 'basic',
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_via VARCHAR(50) DEFAULT 'nda', -- 'nda', 'direct', 'subscription', etc.
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, pitch_id)
);

-- Create NDA audit log table for comprehensive tracking
CREATE TABLE IF NOT EXISTS nda_audit_log (
  id SERIAL PRIMARY KEY,
  nda_id INTEGER REFERENCES ndas(id),
  nda_request_id INTEGER REFERENCES nda_requests(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create NDA templates table for custom NDA documents
CREATE TABLE IF NOT EXISTS nda_templates (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'standard',
  content TEXT NOT NULL,
  variables JSONB, -- Template variables like {company_name}, {project_title}, etc.
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create NDA documents table for generated/signed NDAs
CREATE TABLE IF NOT EXISTS nda_documents (
  id SERIAL PRIMARY KEY,
  nda_id INTEGER NOT NULL REFERENCES ndas(id),
  template_id INTEGER REFERENCES nda_templates(id),
  document_url TEXT,
  document_hash VARCHAR(64),
  watermarked_url TEXT,
  watermark_data JSONB,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  signed_document_url TEXT,
  signed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nda_requests_requester ON nda_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_nda_requests_owner ON nda_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_nda_requests_pitch ON nda_requests(pitch_id);
CREATE INDEX IF NOT EXISTS idx_nda_requests_status ON nda_requests(status);
CREATE INDEX IF NOT EXISTS idx_nda_requests_created ON nda_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ndas_signer ON ndas(signer_id);
CREATE INDEX IF NOT EXISTS idx_ndas_pitch ON ndas(pitch_id);
CREATE INDEX IF NOT EXISTS idx_ndas_status ON ndas(status);
CREATE INDEX IF NOT EXISTS idx_ndas_expires ON ndas(expires_at);
CREATE INDEX IF NOT EXISTS idx_ndas_access_granted ON ndas(access_granted);

CREATE INDEX IF NOT EXISTS idx_pitch_access_user ON pitch_access(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_access_pitch ON pitch_access(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_access_expires ON pitch_access(expires_at);

CREATE INDEX IF NOT EXISTS idx_nda_audit_nda ON nda_audit_log(nda_id);
CREATE INDEX IF NOT EXISTS idx_nda_audit_request ON nda_audit_log(nda_request_id);
CREATE INDEX IF NOT EXISTS idx_nda_audit_user ON nda_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_nda_audit_action ON nda_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_nda_audit_created ON nda_audit_log(created_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_nda_requests_updated_at ON nda_requests;
CREATE TRIGGER update_nda_requests_updated_at BEFORE UPDATE ON nda_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ndas_updated_at ON ndas;
CREATE TRIGGER update_ndas_updated_at BEFORE UPDATE ON ndas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pitch_access_updated_at ON pitch_access;
CREATE TRIGGER update_pitch_access_updated_at BEFORE UPDATE ON pitch_access
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nda_templates_updated_at ON nda_templates;
CREATE TRIGGER update_nda_templates_updated_at BEFORE UPDATE ON nda_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nda_documents_updated_at ON nda_documents;
CREATE TRIGGER update_nda_documents_updated_at BEFORE UPDATE ON nda_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default NDA template
INSERT INTO nda_templates (creator_id, name, type, content, is_default)
VALUES (
  1, -- System user
  'Standard NDA',
  'standard',
  E'NON-DISCLOSURE AGREEMENT\n\nThis Non-Disclosure Agreement ("Agreement") is entered into as of {date} between {creator_name} ("Discloser") and {investor_name} ("Recipient").\n\n1. CONFIDENTIAL INFORMATION\nThe Discloser agrees to disclose, and the Recipient agrees to receive, certain Confidential Information relating to the pitch titled "{pitch_title}".\n\n2. PURPOSE\nThe Recipient shall use the Confidential Information solely for the purpose of evaluating a potential business relationship or investment opportunity.\n\n3. NON-DISCLOSURE\nThe Recipient agrees to:\n- Hold the Confidential Information in strict confidence\n- Not disclose the Confidential Information to any third parties\n- Use the same degree of care to protect the Confidential Information as it uses for its own confidential information\n\n4. TERM\nThis Agreement shall remain in effect for {expiration_days} days from the date of execution unless otherwise terminated.\n\n5. RETURN OF INFORMATION\nUpon request or termination of this Agreement, the Recipient shall promptly return or destroy all Confidential Information.\n\n6. NO LICENSE\nNothing in this Agreement grants any rights to the Recipient in the Confidential Information except as expressly set forth herein.\n\n7. GOVERNING LAW\nThis Agreement shall be governed by the laws of {jurisdiction}.\n\nBy signing below, the parties acknowledge and agree to the terms of this Agreement.\n\n_____________________\n{creator_name}\nDiscloser\nDate: {creator_sign_date}\n\n_____________________\n{investor_name}\nRecipient\nDate: {investor_sign_date}',
  true
) ON CONFLICT DO NOTHING;