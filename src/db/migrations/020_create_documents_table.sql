-- Migration: Create documents table
-- This table stores all uploaded documents associated with pitches

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL,
    uploaded_by_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    mime_type VARCHAR(100),
    document_type VARCHAR(50) DEFAULT 'other',
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    requires_nda BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    checksum VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_documents_pitch FOREIGN KEY (pitch_id)
        REFERENCES pitches(id) ON DELETE CASCADE,
    CONSTRAINT fk_documents_uploader FOREIGN KEY (uploaded_by_id)
        REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_pitch_id ON documents(pitch_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_is_public ON documents(is_public);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Add document types enum comment
COMMENT ON COLUMN documents.document_type IS 'Types: pitch_deck, script, budget, schedule, nda, contract, other';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_documents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_documents_timestamp();
