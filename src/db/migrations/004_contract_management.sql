-- Migration: Contract Management Tables
-- Description: Add legal document and contract management infrastructure
-- Date: December 29, 2024

-- Contracts Table
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('nda', 'investment', 'production', 'talent', 'distribution', 'licensing')),
  template_id UUID,
  pitch_id UUID REFERENCES pitches(id),
  parties JSONB NOT NULL, -- [{user_id, role, signed_at, ip_address}]
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'executed', 'cancelled', 'expired')),
  content TEXT,
  provider VARCHAR(20) CHECK (provider IN ('docusign', 'hellosign', 'adobe_sign', 'internal')),
  provider_envelope_id VARCHAR(255),
  version INTEGER DEFAULT 1,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Contract Signatures Table
CREATE TABLE IF NOT EXISTS contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined')),
  signature_type VARCHAR(20) DEFAULT 'electronic' CHECK (signature_type IN ('electronic', 'drawn', 'typed')),
  ip_address INET,
  user_agent TEXT,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  provider_signature_id VARCHAR(255),
  certificate_url TEXT
);

-- Contract Versions Table (for tracking changes)
CREATE TABLE IF NOT EXISTS contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legal Templates Table
CREATE TABLE IF NOT EXISTS legal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  category VARCHAR(50),
  content TEXT NOT NULL,
  variables JSONB, -- [{name, type, required, default_value}]
  provider_template_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  jurisdiction VARCHAR(100),
  language VARCHAR(10) DEFAULT 'en',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dispute Resolutions Table
CREATE TABLE IF NOT EXISTS dispute_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id),
  filed_by UUID REFERENCES users(id) NOT NULL,
  dispute_type VARCHAR(50),
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'mediation', 'resolved', 'escalated')),
  resolution TEXT,
  arbitrator_id UUID,
  evidence JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Compliance Documents Table
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('kyc', 'aml', 'accreditation', 'id_verification', 'address_proof')),
  document_url TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'expired')),
  verification_provider VARCHAR(50),
  verification_id VARCHAR(255),
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(type);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_pitch ON contracts(pitch_id);
CREATE INDEX IF NOT EXISTS idx_contracts_created ON contracts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_expires ON contracts(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_user ON contract_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_status ON contract_signatures(status);

CREATE INDEX IF NOT EXISTS idx_contract_versions_contract ON contract_versions(contract_id, version);

CREATE INDEX IF NOT EXISTS idx_legal_templates_type ON legal_templates(type);
CREATE INDEX IF NOT EXISTS idx_legal_templates_active ON legal_templates(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_dispute_resolutions_contract ON dispute_resolutions(contract_id);
CREATE INDEX IF NOT EXISTS idx_dispute_resolutions_status ON dispute_resolutions(status);

CREATE INDEX IF NOT EXISTS idx_compliance_documents_user ON compliance_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_type ON compliance_documents(type);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_status ON compliance_documents(status);

-- Add comments
COMMENT ON TABLE contracts IS 'Legal contracts and agreements';
COMMENT ON TABLE contract_signatures IS 'Digital signatures for contracts';
COMMENT ON TABLE contract_versions IS 'Version history for contract modifications';
COMMENT ON TABLE legal_templates IS 'Reusable legal document templates';
COMMENT ON TABLE dispute_resolutions IS 'Contract dispute and resolution tracking';
COMMENT ON TABLE compliance_documents IS 'KYC/AML and compliance documentation';