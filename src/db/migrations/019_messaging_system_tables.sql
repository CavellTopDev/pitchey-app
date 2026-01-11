-- Phase 2: Messaging System Tables
-- Complete messaging and conversation infrastructure

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    type VARCHAR(50) DEFAULT 'direct', -- 'direct', 'group', 'pitch_discussion'
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_archived BOOLEAN DEFAULT FALSE,
    metadata JSONB
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_read_at TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    notification_enabled BOOLEAN DEFAULT TRUE,
    UNIQUE(conversation_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'file', 'image', 'system'
    attachments JSONB, -- [{url, name, size, type}]
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    metadata JSONB, -- {mentions: [], reactions: {}, etc}
    created_at TIMESTAMP DEFAULT NOW()
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS message_read_receipts (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(50) NOT NULL, -- emoji or reaction type
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id, reaction)
);

-- Unread counts (denormalized for performance)
CREATE TABLE IF NOT EXISTS unread_counts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    unread_count INTEGER DEFAULT 0,
    last_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, conversation_id)
);

-- Create indexes for performance
CREATE INDEX idx_conversations_created_by ON conversations(created_by);
CREATE INDEX idx_conversations_pitch ON conversations(pitch_id) WHERE pitch_id IS NOT NULL;
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_conv ON conversation_participants(conversation_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_message_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX idx_message_read_receipts_user ON message_read_receipts(user_id);
CREATE INDEX idx_unread_counts_user ON unread_counts(user_id, unread_count) WHERE unread_count > 0;

-- Trigger to update conversation updated_at
CREATE TRIGGER update_conversation_updated_at 
    AFTER INSERT ON messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_conversation_timestamp();

-- Function to update conversation timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW() 
    WHERE id = NEW.conversation_id;
    
    -- Also update unread counts for all participants except sender
    UPDATE unread_counts 
    SET unread_count = unread_count + 1,
        last_message_id = NEW.id,
        updated_at = NOW()
    WHERE conversation_id = NEW.conversation_id 
      AND user_id != NEW.sender_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Insert sample conversations for testing
INSERT INTO conversations (title, type, created_by)
VALUES 
    ('Investment Discussion', 'direct', 2), -- sarah.investor
    ('Pitch Feedback', 'direct', 1), -- alex.creator
    ('Production Team', 'group', 3) -- stellar.production
ON CONFLICT DO NOTHING;

-- Add participants to conversations
INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
VALUES 
    (1, 2, true), -- sarah in conversation 1
    (1, 1, false), -- alex in conversation 1
    (2, 1, true), -- alex in conversation 2
    (2, 5, false), -- emily.investor in conversation 2
    (3, 3, true), -- stellar in conversation 3
    (3, 6, false), -- nova.production in conversation 3
    (3, 9, false) -- quantum.production in conversation 3
ON CONFLICT DO NOTHING;

-- Insert sample messages
INSERT INTO messages (conversation_id, sender_id, content, message_type)
VALUES 
    (1, 2, 'I''m interested in your pitch. Can we discuss the budget?', 'text'),
    (1, 1, 'Absolutely! The budget range is flexible based on investor commitment.', 'text'),
    (2, 1, 'Thank you for your feedback on the script revisions.', 'text'),
    (2, 5, 'Happy to help! The new direction really strengthens the narrative.', 'text')
ON CONFLICT DO NOTHING;