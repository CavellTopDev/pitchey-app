-- Add tables for real-time functionality

-- User presence table for tracking online status
CREATE TABLE IF NOT EXISTS user_presence (
    user_id INTEGER PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on status for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status);
CREATE INDEX IF NOT EXISTS idx_user_presence_updated_at ON user_presence(updated_at);

-- Update the updated_at column automatically
CREATE OR REPLACE FUNCTION update_user_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_presence table
DROP TRIGGER IF EXISTS trigger_update_user_presence_timestamp ON user_presence;
CREATE TRIGGER trigger_update_user_presence_timestamp
    BEFORE UPDATE ON user_presence
    FOR EACH ROW
    EXECUTE FUNCTION update_user_presence_timestamp();

-- Real-time messages table (for caching messages when users are offline)
CREATE TABLE IF NOT EXISTS realtime_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    channel_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    delivered BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for realtime_messages
CREATE INDEX IF NOT EXISTS idx_realtime_messages_user_id ON realtime_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_messages_channel_id ON realtime_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_realtime_messages_created_at ON realtime_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_realtime_messages_expires_at ON realtime_messages(expires_at);
CREATE INDEX IF NOT EXISTS idx_realtime_messages_delivered ON realtime_messages(delivered);

-- User channels table for tracking channel subscriptions
CREATE TABLE IF NOT EXISTS user_channels (
    user_id INTEGER NOT NULL,
    channel_id VARCHAR(100) NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, channel_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for user_channels
CREATE INDEX IF NOT EXISTS idx_user_channels_user_id ON user_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channels_channel_id ON user_channels(channel_id);

-- Add notification preferences if not exists
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS realtime_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT TRUE;

-- Create cleanup job for expired realtime messages (function for manual cleanup)
CREATE OR REPLACE FUNCTION cleanup_expired_realtime_messages()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM realtime_messages 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Comments for documentation
COMMENT ON TABLE user_presence IS 'Tracks real-time presence status of users';
COMMENT ON TABLE realtime_messages IS 'Temporary storage for real-time messages when users are offline';
COMMENT ON TABLE user_channels IS 'Tracks which channels users are subscribed to for real-time updates';
COMMENT ON FUNCTION cleanup_expired_realtime_messages() IS 'Cleanup function for expired real-time messages';