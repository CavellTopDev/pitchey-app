-- Legal Document Automation System Schema
-- Phase 2 Week 4 Implementation
-- Enhanced Entertainment Industry Legal Document Templates and Generation

-- Document Templates Table
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL CHECK (category IN (
        'nda', 'investment_agreement', 'term_sheet', 'production_contract',
        'deal_memo', 'rights_agreement', 'licensing_agreement', 'collaboration_agreement',
        'talent_agreement', 'distribution_agreement', 'co_production_agreement'
    )),
    template_content JSONB NOT NULL, -- Stores template with variables and conditional clauses
    variables JSONB NOT NULL, -- Schema for required/optional variables
    conditional_clauses JSONB, -- Rules for including/excluding clauses
    jurisdictions TEXT[] DEFAULT ARRAY[]::TEXT[], -- Supported jurisdictions (US, UK, EU, CA, etc.)
    industry_specific BOOLEAN DEFAULT true,
    version VARCHAR(50) NOT NULL DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    compliance_requirements JSONB, -- Industry and jurisdiction compliance rules
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived_at TIMESTAMP WITH TIME ZONE
);

-- Generated Documents Table
CREATE TABLE IF NOT EXISTS generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE RESTRICT,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft', 'under_review', 'approved', 'executed', 'cancelled', 'expired'
    )),
    
    -- Document Content and Variables
    generated_content JSONB NOT NULL, -- Final document content
    template_variables JSONB NOT NULL, -- Variables used during generation
    conditional_clauses_applied JSONB, -- Which conditional clauses were included
    
    -- Parties and Context
    parties JSONB NOT NULL, -- All parties involved in the document
    related_pitch_id UUID REFERENCES pitches(id) ON DELETE SET NULL,
    related_nda_id UUID REFERENCES ndas(id) ON DELETE SET NULL,
    related_investment_id UUID REFERENCES investments(id) ON DELETE SET NULL,
    
    -- Legal and Compliance
    jurisdiction VARCHAR(10) NOT NULL, -- US, UK, EU, CA, etc.
    governing_law VARCHAR(100),
    compliance_status VARCHAR(50) DEFAULT 'pending' CHECK (compliance_status IN (
        'pending', 'compliant', 'requires_review', 'non_compliant'
    )),
    compliance_notes TEXT,
    
    -- Generation Metadata
    generated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Review and Approval
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Document Files
    pdf_file_path TEXT, -- R2 storage path for PDF
    docx_file_path TEXT, -- R2 storage path for DOCX
    html_preview TEXT, -- HTML preview content
    
    -- Signatures and Execution
    signature_status VARCHAR(50) DEFAULT 'not_required' CHECK (signature_status IN (
        'not_required', 'pending_signatures', 'partially_signed', 'fully_executed'
    )),
    signature_data JSONB, -- Signature tracking and metadata
    executed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document Audit Trail
CREATE TABLE IF NOT EXISTS document_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'created', 'modified', 'reviewed', 'approved', 'signed', etc.
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_type VARCHAR(50) NOT NULL, -- 'creator', 'investor', 'production_company', 'legal_team'
    
    -- Change Details
    changes_made JSONB, -- What was changed
    previous_values JSONB, -- Previous state
    new_values JSONB, -- New state
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Legal Clause Library
CREATE TABLE IF NOT EXISTS legal_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL, -- 'confidentiality', 'termination', 'liability', etc.
    clause_text TEXT NOT NULL,
    variables JSONB, -- Variables this clause uses
    
    -- Applicability Rules
    applicable_jurisdictions TEXT[] DEFAULT ARRAY[]::TEXT[],
    applicable_document_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    industry_specific BOOLEAN DEFAULT true,
    
    -- Legal Metadata
    risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    requires_legal_review BOOLEAN DEFAULT false,
    compliance_notes TEXT,
    
    -- Usage Tracking
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document Signatures Table
CREATE TABLE IF NOT EXISTS document_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
    signer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    signer_name VARCHAR(255) NOT NULL,
    signer_email VARCHAR(255) NOT NULL,
    signer_role VARCHAR(100), -- 'creator', 'investor', 'production_executive', etc.
    
    -- Signature Details
    signature_order INTEGER NOT NULL DEFAULT 1,
    is_required BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'signed', 'declined', 'expired'
    )),
    
    -- Electronic Signature Data
    signature_method VARCHAR(50), -- 'electronic', 'docusign', 'adobe_sign', etc.
    signature_data JSONB, -- Platform-specific signature metadata
    signature_image_path TEXT, -- R2 path to signature image
    
    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    signed_at TIMESTAMP WITH TIME ZONE,
    declined_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Jurisdiction Compliance Rules
CREATE TABLE IF NOT EXISTS jurisdiction_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction VARCHAR(10) NOT NULL, -- US, UK, EU, CA, AU, etc.
    jurisdiction_name VARCHAR(100) NOT NULL,
    
    -- Compliance Requirements
    document_types JSONB NOT NULL, -- Which document types this applies to
    required_clauses JSONB, -- Mandatory clauses for this jurisdiction
    prohibited_clauses JSONB, -- Clauses not allowed in this jurisdiction
    
    -- Legal Requirements
    signature_requirements JSONB, -- Electronic signature rules
    disclosure_requirements JSONB, -- Required disclosures
    cooling_off_periods JSONB, -- Mandatory waiting periods
    
    -- Industry Specific Rules
    entertainment_industry_rules JSONB, -- Film/TV specific requirements
    financial_regulations JSONB, -- Investment/securities rules
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document Templates and Clauses Many-to-Many
CREATE TABLE IF NOT EXISTS template_clauses (
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    clause_id UUID NOT NULL REFERENCES legal_clauses(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT false,
    is_conditional BOOLEAN DEFAULT false,
    conditions JSONB, -- When this clause should be included
    order_index INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (template_id, clause_id)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_document_templates_category ON document_templates(category);
CREATE INDEX IF NOT EXISTS idx_document_templates_jurisdictions ON document_templates USING GIN(jurisdictions);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_generated_documents_template ON generated_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_status ON generated_documents(status);
CREATE INDEX IF NOT EXISTS idx_generated_documents_generated_by ON generated_documents(generated_by);
CREATE INDEX IF NOT EXISTS idx_generated_documents_related_pitch ON generated_documents(related_pitch_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_jurisdiction ON generated_documents(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_generated_documents_created_at ON generated_documents(created_at);

CREATE INDEX IF NOT EXISTS idx_document_audit_log_document ON document_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_log_actor ON document_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_log_created_at ON document_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_legal_clauses_category ON legal_clauses(category);
CREATE INDEX IF NOT EXISTS idx_legal_clauses_jurisdictions ON legal_clauses USING GIN(applicable_jurisdictions);
CREATE INDEX IF NOT EXISTS idx_legal_clauses_active ON legal_clauses(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_document_signatures_document ON document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_signer ON document_signatures(signer_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_status ON document_signatures(status);

CREATE INDEX IF NOT EXISTS idx_jurisdiction_compliance_jurisdiction ON jurisdiction_compliance(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_compliance_active ON jurisdiction_compliance(is_active) WHERE is_active = true;

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_generated_documents_updated_at BEFORE UPDATE ON generated_documents FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_legal_clauses_updated_at BEFORE UPDATE ON legal_clauses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_document_signatures_updated_at BEFORE UPDATE ON document_signatures FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_jurisdiction_compliance_updated_at BEFORE UPDATE ON jurisdiction_compliance FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();