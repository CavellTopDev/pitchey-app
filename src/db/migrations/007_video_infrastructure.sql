-- Migration: Video Infrastructure Tables
-- Description: Add video streaming and media management infrastructure
-- Date: December 29, 2024

-- Video Assets Table
CREATE TABLE IF NOT EXISTS video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  type VARCHAR(30) DEFAULT 'pitch' CHECK (type IN ('pitch', 'trailer', 'teaser', 'behind_scenes', 'interview', 'demo')),
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  original_filename VARCHAR(255),
  mime_type VARCHAR(100),
  
  -- Storage locations
  source_url TEXT, -- Original file in R2/S3
  stream_uid VARCHAR(255), -- Cloudflare Stream ID
  playback_url TEXT, -- HLS/DASH streaming URL
  thumbnail_url TEXT,
  poster_url TEXT,
  
  -- Technical metadata
  resolution VARCHAR(20), -- 1920x1080, 3840x2160, etc
  bitrate INTEGER, -- in kbps
  codec VARCHAR(50),
  frame_rate DECIMAL(5,2),
  aspect_ratio VARCHAR(10),
  
  -- Processing status
  status VARCHAR(30) DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'deleted')),
  processing_progress INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Access control
  visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'nda_required', 'investors_only')),
  requires_nda BOOLEAN DEFAULT false,
  
  -- Analytics
  view_count INTEGER DEFAULT 0,
  total_watch_time_seconds BIGINT DEFAULT 0,
  average_watch_percentage DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Video Transcodes Table
CREATE TABLE IF NOT EXISTS video_transcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,
  quality VARCHAR(20) CHECK (quality IN ('240p', '360p', '480p', '720p', '1080p', '1440p', '2160p')),
  bitrate INTEGER,
  file_size_bytes BIGINT,
  url TEXT,
  codec VARCHAR(50),
  container VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video Thumbnails Table
CREATE TABLE IF NOT EXISTS video_thumbnails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,
  timestamp_seconds DECIMAL(10,3),
  url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video Captions Table
CREATE TABLE IF NOT EXISTS video_captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL, -- en, es, fr, etc
  label VARCHAR(100), -- English, Spanish, French, etc
  type VARCHAR(20) DEFAULT 'subtitles' CHECK (type IN ('subtitles', 'captions', 'descriptions')),
  format VARCHAR(20) CHECK (format IN ('vtt', 'srt', 'ttml')),
  url TEXT,
  is_auto_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video Analytics Table
CREATE TABLE IF NOT EXISTS video_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(255),
  
  -- Viewing metrics
  watch_duration_seconds INTEGER,
  completion_percentage DECIMAL(5,2),
  
  -- Engagement metrics
  play_count INTEGER DEFAULT 1,
  pause_count INTEGER DEFAULT 0,
  seek_count INTEGER DEFAULT 0,
  replay_count INTEGER DEFAULT 0,
  
  -- Quality metrics
  average_bitrate INTEGER,
  buffer_events INTEGER DEFAULT 0,
  total_buffer_time_seconds INTEGER DEFAULT 0,
  
  -- User context
  device_type VARCHAR(30),
  browser VARCHAR(50),
  os VARCHAR(50),
  ip_address INET,
  country_code VARCHAR(2),
  region VARCHAR(100),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streaming URLs Table (for signed/temporary URLs)
CREATE TABLE IF NOT EXISTS streaming_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  url TEXT NOT NULL,
  token VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video Playlists Table
CREATE TABLE IF NOT EXISTS video_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playlist Videos Junction Table
CREATE TABLE IF NOT EXISTS playlist_videos (
  playlist_id UUID REFERENCES video_playlists(id) ON DELETE CASCADE,
  video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (playlist_id, video_asset_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_video_assets_pitch ON video_assets(pitch_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_user ON video_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_video_assets_status ON video_assets(status);
CREATE INDEX IF NOT EXISTS idx_video_assets_visibility ON video_assets(visibility);
CREATE INDEX IF NOT EXISTS idx_video_assets_created ON video_assets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_transcodes_asset ON video_transcodes(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_transcodes_quality ON video_transcodes(quality);

CREATE INDEX IF NOT EXISTS idx_video_thumbnails_asset ON video_thumbnails(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_thumbnails_primary ON video_thumbnails(video_asset_id) WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_video_captions_asset ON video_captions(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_captions_language ON video_captions(language);

CREATE INDEX IF NOT EXISTS idx_video_analytics_asset ON video_analytics(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_user ON video_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_video_analytics_created ON video_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_streaming_urls_asset ON streaming_urls(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_streaming_urls_user ON streaming_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_streaming_urls_expires ON streaming_urls(expires_at);

CREATE INDEX IF NOT EXISTS idx_video_playlists_pitch ON video_playlists(pitch_id);
CREATE INDEX IF NOT EXISTS idx_playlist_videos_playlist ON playlist_videos(playlist_id);

-- Add comments
COMMENT ON TABLE video_assets IS 'Video files and streaming assets';
COMMENT ON TABLE video_transcodes IS 'Multiple quality versions of videos';
COMMENT ON TABLE video_thumbnails IS 'Video thumbnail images';
COMMENT ON TABLE video_captions IS 'Subtitles and closed captions';
COMMENT ON TABLE video_analytics IS 'Detailed video viewing analytics';
COMMENT ON TABLE streaming_urls IS 'Temporary signed URLs for video access';
COMMENT ON TABLE video_playlists IS 'Organized collections of videos';