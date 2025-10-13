-- Fix WebSocket enum validation error by adding missing event types
-- This addresses PostgresError: invalid input value for enum event_type

-- Add missing WebSocket event types to the event_type enum
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'websocket_connected';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'websocket_message';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'websocket_disconnected';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'websocket_message_processed';

-- Verify the updated enum values
\dT+ event_type;

-- Test that we can now insert WebSocket events
INSERT INTO analytics_events (event_type, category, session_id, event_data)
VALUES 
    ('websocket_connected', 'websocket', 'test-session', '{"test": true}'),
    ('websocket_message', 'websocket', 'test-session', '{"test": true}'),
    ('websocket_disconnected', 'websocket', 'test-session', '{"test": true}'),
    ('websocket_message_processed', 'websocket', 'test-session', '{"test": true}')
ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM analytics_events WHERE session_id = 'test-session' AND event_data::jsonb @> '{"test": true}';

-- Show final enum values
SELECT unnest(enum_range(NULL::event_type)) AS event_type_values;