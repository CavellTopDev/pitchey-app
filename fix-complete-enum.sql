-- Complete fix for PostgreSQL enum validation error
-- Add all missing event types used throughout the application

-- Authentication and Security events
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'registration_attempt';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'registration';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'login_failed';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'login';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'suspicious_token_use';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'fingerprint_mismatch';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'password_reset_request';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'password_reset_rate_limit';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'password_reset_attempt';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'password_reset';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'email_verified';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'logout';

-- Analytics and User Activity events
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'view';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'like';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'unlike';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'rate_limit_exceeded';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'user_presence_changed';

-- WebSocket Analytics events (using ws_ prefix to match WSAnalyticsEventType enum)
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_connection_established';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_connection_lost';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_connection_failed';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_reconnection_attempt';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_message_sent';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_message_received';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_message_failed';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_message_queued';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_message_delivered';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_presence_changed';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_user_activity';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_typing_indicator';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_draft_sync';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_notification_read';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_upload_progress';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_pitch_view';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_latency_measured';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_rate_limit_hit';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_error_occurred';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_server_broadcast';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ws_maintenance_mode';

-- Verify the updated enum values
SELECT unnest(enum_range(NULL::event_type)) AS event_type_values ORDER BY event_type_values;

-- Test inserting events with all event types to ensure they work
DO $$
DECLARE
    test_session_id TEXT := 'test-validation-' || extract(epoch from now());
BEGIN
    -- Test basic WebSocket events
    INSERT INTO analytics_events (event_type, category, session_id, event_data)
    VALUES 
        ('websocket_connected', 'websocket', test_session_id, '{"test": "validation"}'),
        ('websocket_message', 'websocket', test_session_id, '{"test": "validation"}'),
        ('websocket_disconnected', 'websocket', test_session_id, '{"test": "validation"}'),
        ('ws_connection_established', 'websocket', test_session_id, '{"test": "validation"}'),
        ('ws_message_sent', 'websocket', test_session_id, '{"test": "validation"}'),
        ('login', 'authentication', test_session_id, '{"test": "validation"}'),
        ('view', 'engagement', test_session_id, '{"test": "validation"}'),
        ('like', 'engagement', test_session_id, '{"test": "validation"}');
    
    RAISE NOTICE 'Successfully inserted test events with session ID: %', test_session_id;
    
    -- Clean up test data
    DELETE FROM analytics_events WHERE session_id = test_session_id;
    RAISE NOTICE 'Cleaned up test events';
END $$;