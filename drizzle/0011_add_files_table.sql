-- Add files table for storing small files in database (free plan)
CREATE TABLE IF NOT EXISTS files (
  id VARCHAR(32) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('thumbnail', 'document', 'nda', 'attachment')),
  storage_type VARCHAR(20) NOT NULL CHECK (storage_type IN ('database', 'external')),
  data TEXT, -- Base64 encoded file data for small files
  url TEXT, -- External URL if using external storage
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_files_owner_id ON files(owner_id);
CREATE INDEX idx_files_pitch_id ON files(pitch_id);
CREATE INDEX idx_files_type ON files(file_type);
CREATE INDEX idx_files_uploaded_at ON files(uploaded_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_files_updated_at();

-- Add file count limits per user (free plan restrictions)
CREATE OR REPLACE FUNCTION check_file_limits()
RETURNS TRIGGER AS $$
DECLARE
  file_count INTEGER;
  total_size BIGINT;
BEGIN
  -- Count existing files for user
  SELECT COUNT(*), COALESCE(SUM(size), 0)
  INTO file_count, total_size
  FROM files
  WHERE owner_id = NEW.owner_id;
  
  -- Free plan limits
  IF file_count >= 50 THEN
    RAISE EXCEPTION 'File limit exceeded (50 files maximum on free plan)';
  END IF;
  
  IF total_size + NEW.size > 10485760 THEN -- 10MB total
    RAISE EXCEPTION 'Storage limit exceeded (10MB maximum on free plan)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_file_limits
  BEFORE INSERT ON files
  FOR EACH ROW
  EXECUTE FUNCTION check_file_limits();