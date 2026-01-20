-- ============================================================================
-- CRITICAL DATABASE CONSTRAINTS FIX
-- Pitchey Platform - Schema Consistency Improvements
-- ============================================================================
-- Purpose: Add NOT NULL constraints and check constraints to prevent orphaned records
-- Priority: CRITICAL - Implement immediately
-- Estimated Impact: 5-10 minutes downtime
-- Rollback: See rollback section at bottom
-- ============================================================================

-- ============================================================================
-- STEP 1: VALIDATION - Check for NULL values before applying constraints
-- ============================================================================

-- Validate no NULL values exist in columns we're making NOT NULL
DO $$
DECLARE
  null_investments_investor INTEGER;
  null_investments_pitch INTEGER;
  null_messages_conversation INTEGER;
  null_ndas_user INTEGER;
  null_pitches_user INTEGER;
BEGIN
  -- Count NULL values in each column
  SELECT COUNT(*) INTO null_investments_investor FROM investments WHERE investor_id IS NULL;
  SELECT COUNT(*) INTO null_investments_pitch FROM investments WHERE pitch_id IS NULL;
  SELECT COUNT(*) INTO null_messages_conversation FROM messages WHERE conversation_id IS NULL;
  SELECT COUNT(*) INTO null_ndas_user FROM ndas WHERE user_id IS NULL;
  SELECT COUNT(*) INTO null_pitches_user FROM pitches WHERE user_id IS NULL;

  -- Report findings
  RAISE NOTICE '=== NULL VALUE VALIDATION REPORT ===';
  RAISE NOTICE 'investments.investor_id NULL values: %', null_investments_investor;
  RAISE NOTICE 'investments.pitch_id NULL values: %', null_investments_pitch;
  RAISE NOTICE 'messages.conversation_id NULL values: %', null_messages_conversation;
  RAISE NOTICE 'ndas.user_id NULL values: %', null_ndas_user;
  RAISE NOTICE 'pitches.user_id NULL values: %', null_pitches_user;
  RAISE NOTICE '====================================';

  -- Abort if any NULL values found
  IF null_investments_investor > 0 OR null_investments_pitch > 0 OR
     null_messages_conversation > 0 OR null_ndas_user > 0 OR
     null_pitches_user > 0 THEN
    RAISE EXCEPTION 'NULL values found! Cannot apply NOT NULL constraints. Clean data first.';
  END IF;

  RAISE NOTICE 'Validation passed - safe to apply constraints';
END $$;

-- ============================================================================
-- STEP 2: CLEAN UP NULL VALUES (if any exist)
-- ============================================================================

-- If validation failed, uncomment and modify these to clean up data:

-- Option 1: Delete orphaned records (recommended for test/dev)
-- DELETE FROM investments WHERE investor_id IS NULL OR pitch_id IS NULL;
-- DELETE FROM messages WHERE conversation_id IS NULL;
-- DELETE FROM ndas WHERE user_id IS NULL;
-- DELETE FROM pitches WHERE user_id IS NULL;

-- Option 2: Assign to a placeholder user (for production if data must be preserved)
-- DO $$
-- DECLARE
--   placeholder_user_id INTEGER;
-- BEGIN
--   -- Get or create a placeholder user
--   INSERT INTO users (email, username, password_hash, user_type)
--   VALUES ('deleted@pitchey.com', 'deleted_user', '', 'viewer')
--   ON CONFLICT (email) DO NOTHING
--   RETURNING id INTO placeholder_user_id;
--
--   IF placeholder_user_id IS NULL THEN
--     SELECT id INTO placeholder_user_id FROM users WHERE email = 'deleted@pitchey.com';
--   END IF;
--
--   -- Assign orphaned records to placeholder
--   UPDATE investments SET investor_id = placeholder_user_id WHERE investor_id IS NULL;
--   UPDATE ndas SET user_id = placeholder_user_id WHERE user_id IS NULL;
--   UPDATE pitches SET user_id = placeholder_user_id WHERE user_id IS NULL;
-- END $$;

-- ============================================================================
-- STEP 3: ADD NOT NULL CONSTRAINTS
-- ============================================================================

BEGIN;

-- Investments table
ALTER TABLE investments ALTER COLUMN investor_id SET NOT NULL;
ALTER TABLE investments ALTER COLUMN pitch_id SET NOT NULL;
COMMENT ON COLUMN investments.investor_id IS 'NOT NULL constraint added 2026-01-20 - prevents orphaned investments';
COMMENT ON COLUMN investments.pitch_id IS 'NOT NULL constraint added 2026-01-20 - prevents orphaned investments';

-- Messages table
-- Note: pitch_id remains nullable as messages may be conversation-only
ALTER TABLE messages ALTER COLUMN conversation_id SET NOT NULL;
COMMENT ON COLUMN messages.conversation_id IS 'NOT NULL constraint added 2026-01-20 - prevents orphaned messages';

-- NDAs table
ALTER TABLE ndas ALTER COLUMN user_id SET NOT NULL;
COMMENT ON COLUMN ndas.user_id IS 'NOT NULL constraint added 2026-01-20 - prevents orphaned NDAs';

-- Pitches table
ALTER TABLE pitches ALTER COLUMN user_id SET NOT NULL;
COMMENT ON COLUMN pitches.user_id IS 'NOT NULL constraint added 2026-01-20 - prevents orphaned pitches';

COMMIT;

-- ============================================================================
-- STEP 4: ADD CHECK CONSTRAINTS
-- ============================================================================

BEGIN;

-- Messages must have either conversation_id OR pitch_id (but conversation_id is now NOT NULL)
-- This is a safety check in case we change conversation_id back to nullable
ALTER TABLE messages ADD CONSTRAINT messages_context_check
  CHECK (conversation_id IS NOT NULL OR pitch_id IS NOT NULL);
COMMENT ON CONSTRAINT messages_context_check ON messages IS 'Ensures messages are linked to a conversation or pitch';

-- Investment amount must be positive
ALTER TABLE investments ADD CONSTRAINT investments_amount_positive
  CHECK (amount > 0);
COMMENT ON CONSTRAINT investments_amount_positive ON investments IS 'Investment amount must be greater than zero';

-- Pitch view count cannot be negative
ALTER TABLE pitches DROP CONSTRAINT IF EXISTS pitches_view_count_positive;
ALTER TABLE pitches ADD CONSTRAINT pitches_view_count_positive
  CHECK (view_count >= 0);

-- Pitch like count cannot be negative
ALTER TABLE pitches DROP CONSTRAINT IF EXISTS pitches_like_count_positive;
ALTER TABLE pitches ADD CONSTRAINT pitches_like_count_positive
  CHECK (like_count >= 0);

-- Pitch NDA count cannot be negative
ALTER TABLE pitches DROP CONSTRAINT IF EXISTS pitches_nda_count_positive;
ALTER TABLE pitches ADD CONSTRAINT pitches_nda_count_positive
  CHECK (nda_count >= 0);

COMMIT;

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================

-- Verify constraints were applied
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('investments', 'messages', 'ndas', 'pitches')
  AND tc.constraint_type IN ('CHECK', 'PRIMARY KEY', 'FOREIGN KEY')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Verify NOT NULL constraints
SELECT
  table_name,
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('investments', 'messages', 'ndas', 'pitches')
  AND column_name IN ('investor_id', 'pitch_id', 'conversation_id', 'user_id')
ORDER BY table_name, column_name;

-- ============================================================================
-- STEP 6: POST-DEPLOYMENT MONITORING
-- ============================================================================

-- Create a function to monitor constraint violations
CREATE OR REPLACE FUNCTION check_constraint_violations()
RETURNS TABLE(
  issue_type TEXT,
  table_name TEXT,
  constraint_name TEXT,
  violation_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  -- This query will fail if constraints are working (which is good!)
  -- Run before applying constraints to find issues
  SELECT
    'NULL investor_id'::TEXT,
    'investments'::TEXT,
    'NOT NULL'::TEXT,
    COUNT(*) as violation_count
  FROM investments
  WHERE investor_id IS NULL

  UNION ALL

  SELECT
    'NULL pitch_id',
    'investments',
    'NOT NULL',
    COUNT(*)
  FROM investments
  WHERE pitch_id IS NULL

  UNION ALL

  SELECT
    'NULL conversation_id',
    'messages',
    'NOT NULL',
    COUNT(*)
  FROM messages
  WHERE conversation_id IS NULL

  UNION ALL

  SELECT
    'NULL user_id',
    'ndas',
    'NOT NULL',
    COUNT(*)
  FROM ndas
  WHERE user_id IS NULL

  UNION ALL

  SELECT
    'NULL user_id',
    'pitches',
    'NOT NULL',
    COUNT(*)
  FROM pitches
  WHERE user_id IS NULL

  UNION ALL

  SELECT
    'Negative amount',
    'investments',
    'CHECK investments_amount_positive',
    COUNT(*)
  FROM investments
  WHERE amount <= 0;
END;
$$ LANGUAGE plpgsql;

-- Run the check (should return all zeros after constraints applied)
SELECT * FROM check_constraint_violations()
WHERE violation_count > 0;

-- ============================================================================
-- ROLLBACK PROCEDURE (if issues arise)
-- ============================================================================

/*
-- Run this only if you need to rollback the changes

BEGIN;

-- Remove check constraints
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_context_check;
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_amount_positive;
ALTER TABLE pitches DROP CONSTRAINT IF EXISTS pitches_view_count_positive;
ALTER TABLE pitches DROP CONSTRAINT IF EXISTS pitches_like_count_positive;
ALTER TABLE pitches DROP CONSTRAINT IF EXISTS pitches_nda_count_positive;

-- Remove NOT NULL constraints
ALTER TABLE investments ALTER COLUMN investor_id DROP NOT NULL;
ALTER TABLE investments ALTER COLUMN pitch_id DROP NOT NULL;
ALTER TABLE messages ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE ndas ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE pitches ALTER COLUMN user_id DROP NOT NULL;

COMMIT;

-- Verify rollback
SELECT
  table_name,
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('investments', 'messages', 'ndas', 'pitches')
  AND column_name IN ('investor_id', 'pitch_id', 'conversation_id', 'user_id')
ORDER BY table_name, column_name;

*/

-- ============================================================================
-- DEPLOYMENT CHECKLIST
-- ============================================================================

/*
PRE-DEPLOYMENT:
☐ Backup database
☐ Test in staging environment
☐ Notify team of maintenance window
☐ Prepare rollback script
☐ Review validation query results

DEPLOYMENT:
☐ Run STEP 1 validation
☐ If validation passes, run STEP 3 (constraints)
☐ Run STEP 4 (check constraints)
☐ Run STEP 5 (verification)
☐ Monitor application logs for errors

POST-DEPLOYMENT:
☐ Run check_constraint_violations() function
☐ Monitor error rates in application
☐ Verify no orphaned records created
☐ Update documentation
☐ Mark deployment as complete

ESTIMATED EXECUTION TIME: 2-5 minutes
ESTIMATED DOWNTIME: 0 minutes (online DDL)
RISK LEVEL: LOW (if validation passes)
*/

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '=== CONSTRAINT FIX SCRIPT COMPLETED ===';
  RAISE NOTICE 'Review verification results above';
  RAISE NOTICE 'Monitor application logs for constraint violations';
  RAISE NOTICE 'Script execution timestamp: %', NOW();
  RAISE NOTICE '========================================';
END $$;
