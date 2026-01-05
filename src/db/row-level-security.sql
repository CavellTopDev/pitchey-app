-- Row-Level Security (RLS) for Portal Isolation
-- Implements database-enforced access control across creator, investor, and production portals

-- Enable RLS on all tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ndas ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_interests ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (prevents bypassing)
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE pitches FORCE ROW LEVEL SECURITY;
ALTER TABLE investments FORCE ROW LEVEL SECURITY;
ALTER TABLE ndas FORCE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
ALTER TABLE deals FORCE ROW LEVEL SECURITY;
ALTER TABLE production_interests FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- USER POLICIES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY users_self_read ON users
  FOR SELECT
  USING (id = current_setting('app.current_user_id')::UUID);

-- Users can update their own profile
CREATE POLICY users_self_update ON users
  FOR UPDATE
  USING (id = current_setting('app.current_user_id')::UUID)
  WITH CHECK (id = current_setting('app.current_user_id')::UUID);

-- Users can view public profiles based on visibility settings
CREATE POLICY users_public_profiles ON users
  FOR SELECT
  USING (
    profile_visibility = 'public' OR
    (profile_visibility = 'connections' AND EXISTS (
      SELECT 1 FROM connections 
      WHERE (user_id = users.id AND connected_user_id = current_setting('app.current_user_id')::UUID)
         OR (connected_user_id = users.id AND user_id = current_setting('app.current_user_id')::UUID)
    ))
  );

-- ============================================================================
-- PITCH POLICIES
-- ============================================================================

-- Creators can manage their own pitches
CREATE POLICY pitches_creator_all ON pitches
  FOR ALL
  USING (creator_id = current_setting('app.current_user_id')::UUID)
  WITH CHECK (creator_id = current_setting('app.current_user_id')::UUID);

-- Published pitches are readable by all authenticated users
CREATE POLICY pitches_published_read ON pitches
  FOR SELECT
  USING (
    status = 'published' AND
    current_setting('app.current_user_id', true) IS NOT NULL
  );

-- Pitches with signed NDAs are readable
CREATE POLICY pitches_nda_access ON pitches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ndas
      WHERE ndas.pitch_id = pitches.id
        AND ndas.user_id = current_setting('app.current_user_id')::UUID
        AND ndas.status = 'active'
        AND (ndas.expires_at IS NULL OR ndas.expires_at > CURRENT_TIMESTAMP)
    )
  );

-- Portal-specific pitch visibility
CREATE POLICY pitches_portal_visibility ON pitches
  FOR SELECT
  USING (
    CASE current_setting('app.current_portal')
      WHEN 'investor' THEN 
        visibility_settings->>'investor_visible' = 'true'
      WHEN 'production' THEN 
        visibility_settings->>'production_visible' = 'true'
      WHEN 'creator' THEN 
        TRUE -- Creators can see all published pitches
      ELSE FALSE
    END
  );

-- ============================================================================
-- INVESTMENT POLICIES
-- ============================================================================

-- Investors can view their own investments
CREATE POLICY investments_investor_own ON investments
  FOR ALL
  USING (investor_id = current_setting('app.current_user_id')::UUID)
  WITH CHECK (investor_id = current_setting('app.current_user_id')::UUID);

-- Creators can view investments in their pitches
CREATE POLICY investments_creator_view ON investments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pitches
      WHERE pitches.id = investments.pitch_id
        AND pitches.creator_id = current_setting('app.current_user_id')::UUID
    )
  );

-- Production companies cannot see investment details (portal isolation)
CREATE POLICY investments_production_deny ON investments
  FOR ALL
  USING (
    current_setting('app.current_portal') != 'production'
  )
  WITH CHECK (
    current_setting('app.current_portal') != 'production'
  );

-- ============================================================================
-- NDA POLICIES
-- ============================================================================

-- Users can manage their own NDAs
CREATE POLICY ndas_user_own ON ndas
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::UUID)
  WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- Creators can view NDAs for their pitches
CREATE POLICY ndas_creator_view ON ndas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pitches
      WHERE pitches.id = ndas.pitch_id
        AND pitches.creator_id = current_setting('app.current_user_id')::UUID
    )
  );

-- Creators can approve/reject NDAs for their pitches
CREATE POLICY ndas_creator_manage ON ndas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pitches
      WHERE pitches.id = ndas.pitch_id
        AND pitches.creator_id = current_setting('app.current_user_id')::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pitches
      WHERE pitches.id = ndas.pitch_id
        AND pitches.creator_id = current_setting('app.current_user_id')::UUID
    )
  );

-- ============================================================================
-- MESSAGE POLICIES
-- ============================================================================

-- Users can read messages where they are sender or recipient
CREATE POLICY messages_participant ON messages
  FOR SELECT
  USING (
    sender_id = current_setting('app.current_user_id')::UUID OR
    recipient_id = current_setting('app.current_user_id')::UUID OR
    (thread_participants @> ARRAY[current_setting('app.current_user_id')::UUID])
  );

-- Users can send messages
CREATE POLICY messages_send ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = current_setting('app.current_user_id')::UUID
  );

-- Portal-specific message restrictions
CREATE POLICY messages_portal_restrictions ON messages
  FOR ALL
  USING (
    -- Investors and production companies cannot message each other directly
    NOT (
      current_setting('app.current_portal') = 'investor' AND
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = messages.recipient_id
          AND users.user_type = 'production'
      )
    ) AND
    NOT (
      current_setting('app.current_portal') = 'production' AND
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = messages.recipient_id
          AND users.user_type = 'investor'
      )
    )
  )
  WITH CHECK (
    -- Same restriction for inserts
    NOT (
      current_setting('app.current_portal') = 'investor' AND
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = messages.recipient_id
          AND users.user_type = 'production'
      )
    ) AND
    NOT (
      current_setting('app.current_portal') = 'production' AND
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = messages.recipient_id
          AND users.user_type = 'investor'
      )
    )
  );

-- ============================================================================
-- NOTIFICATION POLICIES
-- ============================================================================

-- Users can only see their own notifications
CREATE POLICY notifications_user_own ON notifications
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::UUID)
  WITH CHECK (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================================
-- DOCUMENT POLICIES
-- ============================================================================

-- Document access based on ownership or explicit permissions
CREATE POLICY documents_access ON documents
  FOR SELECT
  USING (
    -- Owner access
    uploaded_by = current_setting('app.current_user_id')::UUID OR
    -- Shared with user
    shared_with @> ARRAY[current_setting('app.current_user_id')::UUID] OR
    -- Related to user's pitch
    (document_type = 'pitch_document' AND EXISTS (
      SELECT 1 FROM pitches
      WHERE pitches.id = documents.entity_id::UUID
        AND (
          pitches.creator_id = current_setting('app.current_user_id')::UUID OR
          (pitches.status = 'published' AND EXISTS (
            SELECT 1 FROM ndas
            WHERE ndas.pitch_id = pitches.id
              AND ndas.user_id = current_setting('app.current_user_id')::UUID
              AND ndas.status = 'active'
          ))
        )
    )) OR
    -- Related to user's investment
    (document_type = 'investment_document' AND EXISTS (
      SELECT 1 FROM investments
      WHERE investments.id = documents.entity_id::UUID
        AND (
          investments.investor_id = current_setting('app.current_user_id')::UUID OR
          EXISTS (
            SELECT 1 FROM pitches
            WHERE pitches.id = investments.pitch_id
              AND pitches.creator_id = current_setting('app.current_user_id')::UUID
          )
        )
    ))
  );

-- ============================================================================
-- DEAL POLICIES (Investment Deals)
-- ============================================================================

-- Deal visibility based on participation
CREATE POLICY deals_participant ON deals
  FOR SELECT
  USING (
    -- Investor in the deal
    investor_id = current_setting('app.current_user_id')::UUID OR
    -- Creator of the pitch
    EXISTS (
      SELECT 1 FROM pitches
      WHERE pitches.id = deals.pitch_id
        AND pitches.creator_id = current_setting('app.current_user_id')::UUID
    ) OR
    -- Listed as participant
    participants @> ARRAY[current_setting('app.current_user_id')::UUID]
  );

-- Portal-specific deal management
CREATE POLICY deals_portal_management ON deals
  FOR UPDATE
  USING (
    CASE current_setting('app.current_portal')
      WHEN 'investor' THEN
        investor_id = current_setting('app.current_user_id')::UUID
      WHEN 'creator' THEN
        EXISTS (
          SELECT 1 FROM pitches
          WHERE pitches.id = deals.pitch_id
            AND pitches.creator_id = current_setting('app.current_user_id')::UUID
        )
      ELSE FALSE
    END
  )
  WITH CHECK (
    CASE current_setting('app.current_portal')
      WHEN 'investor' THEN
        investor_id = current_setting('app.current_user_id')::UUID
      WHEN 'creator' THEN
        EXISTS (
          SELECT 1 FROM pitches
          WHERE pitches.id = deals.pitch_id
            AND pitches.creator_id = current_setting('app.current_user_id')::UUID
        )
      ELSE FALSE
    END
  );

-- ============================================================================
-- PRODUCTION INTEREST POLICIES
-- ============================================================================

-- Production companies can manage their own interests
CREATE POLICY production_interests_company ON production_interests
  FOR ALL
  USING (
    company_id = current_setting('app.current_user_id')::UUID AND
    current_setting('app.current_portal') = 'production'
  )
  WITH CHECK (
    company_id = current_setting('app.current_user_id')::UUID AND
    current_setting('app.current_portal') = 'production'
  );

-- Creators can view interests in their pitches
CREATE POLICY production_interests_creator_view ON production_interests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pitches
      WHERE pitches.id = production_interests.pitch_id
        AND pitches.creator_id = current_setting('app.current_user_id')::UUID
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Function to set session context from application
CREATE OR REPLACE FUNCTION set_app_context(
  p_user_id UUID,
  p_user_email TEXT,
  p_user_role TEXT,
  p_portal TEXT,
  p_session_id TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', p_user_id::TEXT, true);
  PERFORM set_config('app.current_user_email', p_user_email, true);
  PERFORM set_config('app.current_user_role', p_user_role, true);
  PERFORM set_config('app.current_portal', p_portal, true);
  
  IF p_session_id IS NOT NULL THEN
    PERFORM set_config('app.session_id', p_session_id, true);
  END IF;
  
  IF p_request_id IS NOT NULL THEN
    PERFORM set_config('app.request_id', p_request_id, true);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get current user context
CREATE OR REPLACE FUNCTION get_app_context()
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  portal TEXT,
  session_id TEXT,
  request_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    current_setting('app.current_user_id', true)::UUID,
    current_setting('app.current_user_email', true),
    current_setting('app.current_user_role', true),
    current_setting('app.current_portal', true),
    current_setting('app.session_id', true),
    current_setting('app.request_id', true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECURITY DEFINER FUNCTIONS FOR SPECIFIC OPERATIONS
-- ============================================================================

-- Function to check if user has access to pitch (bypasses RLS for check)
CREATE OR REPLACE FUNCTION check_pitch_access(
  p_user_id UUID,
  p_pitch_id UUID
) RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  has_access BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pitches
    WHERE id = p_pitch_id
      AND (
        -- Creator access
        creator_id = p_user_id OR
        -- Published pitch
        status = 'published' OR
        -- Has active NDA
        EXISTS (
          SELECT 1 FROM ndas
          WHERE pitch_id = p_pitch_id
            AND user_id = p_user_id
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        )
      )
  ) INTO has_access;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions to application role
GRANT EXECUTE ON FUNCTION set_app_context TO application_role;
GRANT EXECUTE ON FUNCTION get_app_context TO application_role;
GRANT EXECUTE ON FUNCTION check_pitch_access TO application_role;

-- ============================================================================
-- TESTING AND VALIDATION
-- ============================================================================

-- Test function to validate RLS policies
CREATE OR REPLACE FUNCTION test_rls_policies(
  p_test_user_id UUID,
  p_test_portal TEXT
) RETURNS TABLE (
  test_name TEXT,
  result BOOLEAN,
  details TEXT
) AS $$
BEGIN
  -- Set test context
  PERFORM set_app_context(p_test_user_id, 'test@example.com', 'test', p_test_portal);
  
  -- Test 1: User can read own profile
  RETURN QUERY
  SELECT 
    'User self-read'::TEXT,
    EXISTS(SELECT 1 FROM users WHERE id = p_test_user_id),
    'User should be able to read own profile'::TEXT;
  
  -- Test 2: Portal isolation for investments
  IF p_test_portal = 'production' THEN
    RETURN QUERY
    SELECT 
      'Production portal investment isolation'::TEXT,
      NOT EXISTS(SELECT 1 FROM investments LIMIT 1),
      'Production portal should not see investments'::TEXT;
  END IF;
  
  -- Add more tests as needed...
  
  -- Reset context
  RESET app.current_user_id;
  RESET app.current_user_email;
  RESET app.current_user_role;
  RESET app.current_portal;
END;
$$ LANGUAGE plpgsql;