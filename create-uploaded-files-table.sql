-- Create uploaded_files table for document management
CREATE TABLE IF NOT EXISTS uploaded_files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
  file_type VARCHAR(50) NOT NULL DEFAULT 'general',
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  r2_key VARCHAR(500) NOT NULL UNIQUE,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_pitch_id ON uploaded_files(pitch_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_file_type ON uploaded_files(file_type);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_uploaded_at ON uploaded_files(uploaded_at);

-- Add custom_nda_id column to pitches table if it doesn't exist
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS custom_nda_id INTEGER REFERENCES uploaded_files(id);