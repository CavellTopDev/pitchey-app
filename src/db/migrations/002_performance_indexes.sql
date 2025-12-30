-- Migration: Performance Indexes
-- Description: Add critical indexes for database performance at scale
-- Date: December 29, 2024

-- Pitches table indexes
CREATE INDEX IF NOT EXISTS idx_pitches_creator ON pitches(creator_id);
CREATE INDEX IF NOT EXISTS idx_pitches_status ON pitches(status);
CREATE INDEX IF NOT EXISTS idx_pitches_created ON pitches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_genre ON pitches(genre);
CREATE INDEX IF NOT EXISTS idx_pitches_visibility ON pitches(visibility);
CREATE INDEX IF NOT EXISTS idx_pitches_featured ON pitches(is_featured) WHERE is_featured = true;

-- NDAs table indexes
CREATE INDEX IF NOT EXISTS idx_ndas_status ON ndas(status);
CREATE INDEX IF NOT EXISTS idx_ndas_requester ON ndas(requester_id);
CREATE INDEX IF NOT EXISTS idx_ndas_pitch ON ndas(pitch_id);
CREATE INDEX IF NOT EXISTS idx_ndas_creator ON ndas(creator_id);
CREATE INDEX IF NOT EXISTS idx_ndas_created ON ndas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ndas_pending ON ndas(status, created_at DESC) WHERE status = 'pending';

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE read = false;

-- Views table indexes
CREATE INDEX IF NOT EXISTS idx_views_pitch ON views(pitch_id);
CREATE INDEX IF NOT EXISTS idx_views_user ON views(user_id);
CREATE INDEX IF NOT EXISTS idx_views_created ON views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_views_unique ON views(pitch_id, user_id);

-- Follows table indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created ON follows(created_at DESC);

-- Saved pitches table indexes
CREATE INDEX IF NOT EXISTS idx_saved_pitches_user ON saved_pitches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_pitch ON saved_pitches(pitch_id);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_created ON saved_pitches(created_at DESC);

-- Better Auth session indexes (if not already present)
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expiresAt);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- Characters table indexes (for pitch creation)
CREATE INDEX IF NOT EXISTS idx_characters_pitch ON characters(pitch_id);
CREATE INDEX IF NOT EXISTS idx_characters_order ON characters(pitch_id, display_order);

-- Add comments
COMMENT ON INDEX idx_pitches_featured IS 'Optimized index for featured pitches queries';
COMMENT ON INDEX idx_ndas_pending IS 'Partial index for pending NDA requests';
COMMENT ON INDEX idx_notifications_unread IS 'Partial index for unread notifications';