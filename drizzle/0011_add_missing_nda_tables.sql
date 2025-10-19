-- Migration to add missing NDA and info request tables
-- This fixes critical database schema issues blocking NDA workflow functionality

-- Add world_description column to pitches table
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS world_description TEXT;

-- Create info_requests table for post-NDA communication
CREATE TABLE IF NOT EXISTS info_requests (
    id SERIAL PRIMARY KEY,
    nda_id INTEGER NOT NULL REFERENCES ndas(id) ON DELETE CASCADE,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'pending',
    response TEXT,
    response_at TIMESTAMP,
    requested_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create info_request_attachments table for file attachments
CREATE TABLE IF NOT EXISTS info_request_attachments (
    id SERIAL PRIMARY KEY,
    info_request_id INTEGER NOT NULL REFERENCES info_requests(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_info_requests_nda_id ON info_requests(nda_id);
CREATE INDEX IF NOT EXISTS idx_info_requests_pitch_id ON info_requests(pitch_id);
CREATE INDEX IF NOT EXISTS idx_info_requests_requester_id ON info_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_info_requests_owner_id ON info_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_info_requests_status ON info_requests(status);
CREATE INDEX IF NOT EXISTS idx_info_request_attachments_request_id ON info_request_attachments(info_request_id);

-- Add comments for documentation
COMMENT ON TABLE info_requests IS 'Information requests made after NDA signing for additional pitch details';
COMMENT ON TABLE info_request_attachments IS 'File attachments for information requests';
COMMENT ON COLUMN pitches.world_description IS 'Detailed description of the world/setting for the pitch';