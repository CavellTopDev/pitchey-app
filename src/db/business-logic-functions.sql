-- ================================================================================
-- PITCHEY BUSINESS LOGIC FUNCTIONS AND TRIGGERS
-- Complete workflow automation and business rule enforcement
-- ================================================================================

-- ================================================================================
-- ENUMS AND TYPES FOR BUSINESS LOGIC
-- ================================================================================

-- Investment deal states
DO $$ BEGIN
 CREATE TYPE "investment_deal_state" AS ENUM(
   'inquiry', 'nda_required', 'nda_signed', 'due_diligence', 
   'negotiation', 'term_sheet', 'legal_review', 'funding', 'completed', 'cancelled'
 );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- NDA states
DO $$ BEGIN
 CREATE TYPE "nda_state" AS ENUM(
   'pending', 'signed', 'approved', 'rejected', 'expired', 'revoked'
 );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Production deal types
DO $$ BEGIN
 CREATE TYPE "production_deal_type" AS ENUM(
   'option', 'acquisition', 'licensing', 'development', 'production'
 );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Deal priority levels
DO $$ BEGIN
 CREATE TYPE "deal_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Notification types
DO $$ BEGIN
 CREATE TYPE "notification_type" AS ENUM(
   'investment_inquiry', 'nda_request', 'nda_signed', 'deal_update', 
   'funding_received', 'production_offer', 'message_received', 'system_alert'
 );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ================================================================================
-- INVESTMENT DEAL WORKFLOW TABLES
-- ================================================================================

-- Investment deals table
CREATE TABLE IF NOT EXISTS "investment_deals" (
  "id" serial PRIMARY KEY,
  "pitch_id" integer NOT NULL REFERENCES "pitches"("id") ON DELETE CASCADE,
  "investor_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "creator_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "deal_state" investment_deal_state DEFAULT 'inquiry' NOT NULL,
  "deal_type" varchar(50) DEFAULT 'equity' NOT NULL,
  "investment_amount" numeric(12, 2),
  "equity_percentage" numeric(5, 2),
  "valuation" numeric(15, 2),
  "minimum_funding" numeric(12, 2),
  "funding_deadline" timestamp,
  "terms" jsonb,
  "due_diligence_items" jsonb,
  "legal_documents" jsonb,
  "milestone_conditions" jsonb,
  "priority" deal_priority DEFAULT 'medium',
  "notes" text,
  "metadata" jsonb,
  "state_changed_at" timestamp DEFAULT now(),
  "state_changed_by" integer REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "unique_active_deal_per_pitch_investor" 
    UNIQUE("pitch_id", "investor_id") DEFERRABLE INITIALLY DEFERRED
);

-- Investment deal state history
CREATE TABLE IF NOT EXISTS "investment_deal_history" (
  "id" serial PRIMARY KEY,
  "deal_id" integer NOT NULL REFERENCES "investment_deals"("id") ON DELETE CASCADE,
  "from_state" investment_deal_state,
  "to_state" investment_deal_state NOT NULL,
  "changed_by" integer NOT NULL REFERENCES "users"("id"),
  "reason" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ================================================================================
-- PRODUCTION DEAL WORKFLOW TABLES  
-- ================================================================================

-- Production deals table
CREATE TABLE IF NOT EXISTS "production_deals" (
  "id" serial PRIMARY KEY,
  "pitch_id" integer NOT NULL REFERENCES "pitches"("id") ON DELETE CASCADE,
  "production_company_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "creator_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "deal_type" production_deal_type NOT NULL,
  "deal_state" investment_deal_state DEFAULT 'inquiry' NOT NULL, -- Reusing states
  "option_amount" numeric(12, 2),
  "purchase_price" numeric(12, 2),
  "backend_percentage" numeric(5, 2),
  "development_fee" numeric(10, 2),
  "option_period" interval,
  "extension_periods" integer DEFAULT 0,
  "rights_territory" varchar(100) DEFAULT 'worldwide',
  "rights_duration" interval DEFAULT '10 years',
  "production_budget_min" numeric(12, 2),
  "production_budget_max" numeric(12, 2),
  "delivery_requirements" jsonb,
  "approval_rights" jsonb,
  "credit_requirements" jsonb,
  "priority" deal_priority DEFAULT 'medium',
  "notes" text,
  "metadata" jsonb,
  "state_changed_at" timestamp DEFAULT now(),
  "state_changed_by" integer REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "unique_active_production_deal" 
    UNIQUE("pitch_id", "production_company_id") DEFERRABLE INITIALLY DEFERRED
);

-- ================================================================================
-- ENHANCED NDA WORKFLOW TABLES
-- ================================================================================

-- Enhanced NDAs with state machine
CREATE TABLE IF NOT EXISTS "enhanced_ndas" (
  "id" serial PRIMARY KEY,
  "pitch_id" integer NOT NULL REFERENCES "pitches"("id") ON DELETE CASCADE,
  "requester_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "creator_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "deal_id" integer REFERENCES "investment_deals"("id") ON DELETE SET NULL,
  "production_deal_id" integer REFERENCES "production_deals"("id") ON DELETE SET NULL,
  "nda_state" nda_state DEFAULT 'pending' NOT NULL,
  "nda_type" nda_type DEFAULT 'basic' NOT NULL,
  "custom_terms" jsonb,
  "access_level" varchar(20) DEFAULT 'basic',
  "access_expiry" timestamp,
  "automatic_approval" boolean DEFAULT false,
  "approval_conditions" jsonb,
  "signed_document_url" text,
  "signature_metadata" jsonb,
  "access_log" jsonb,
  "state_changed_at" timestamp DEFAULT now(),
  "state_changed_by" integer REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "unique_active_nda" 
    UNIQUE("pitch_id", "requester_id") DEFERRABLE INITIALLY DEFERRED
);

-- ================================================================================
-- NOTIFICATION AND WORKFLOW TABLES
-- ================================================================================

-- Enhanced notifications with workflow integration
CREATE TABLE IF NOT EXISTS "workflow_notifications" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "notification_type" notification_type NOT NULL,
  "title" varchar(200) NOT NULL,
  "message" text NOT NULL,
  "action_url" text,
  "action_label" varchar(100),
  "priority" deal_priority DEFAULT 'medium',
  "related_deal_id" integer REFERENCES "investment_deals"("id") ON DELETE SET NULL,
  "related_production_deal_id" integer REFERENCES "production_deals"("id") ON DELETE SET NULL,
  "related_nda_id" integer REFERENCES "enhanced_ndas"("id") ON DELETE SET NULL,
  "related_pitch_id" integer REFERENCES "pitches"("id") ON DELETE SET NULL,
  "metadata" jsonb,
  "read_at" timestamp,
  "acted_upon_at" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ================================================================================
-- BUSINESS LOGIC FUNCTIONS
-- ================================================================================

-- Function: Create investment deal inquiry
CREATE OR REPLACE FUNCTION create_investment_inquiry(
  p_pitch_id integer,
  p_investor_id integer,
  p_investment_amount numeric,
  p_terms jsonb DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deal_id integer;
  v_creator_id integer;
  v_requires_nda boolean;
BEGIN
  -- Get creator and check if NDA is required
  SELECT user_id INTO v_creator_id FROM pitches WHERE id = p_pitch_id;
  
  -- Check if pitch requires NDA
  SELECT COALESCE(
    (visibility_settings->>'requiresNDA')::boolean, 
    false
  ) INTO v_requires_nda 
  FROM pitches WHERE id = p_pitch_id;
  
  -- Create investment deal
  INSERT INTO investment_deals (
    pitch_id, investor_id, creator_id, deal_state, 
    investment_amount, terms
  ) VALUES (
    p_pitch_id, p_investor_id, v_creator_id,
    CASE WHEN v_requires_nda THEN 'nda_required'::investment_deal_state 
         ELSE 'inquiry'::investment_deal_state END,
    p_investment_amount, p_terms
  ) RETURNING id INTO v_deal_id;
  
  -- Create notification for creator
  INSERT INTO workflow_notifications (
    user_id, notification_type, title, message, 
    related_deal_id, related_pitch_id, action_url, action_label
  ) VALUES (
    v_creator_id, 'investment_inquiry', 
    'New Investment Inquiry',
    'An investor is interested in your pitch',
    v_deal_id, p_pitch_id,
    '/creator/deals/' || v_deal_id,
    'Review Inquiry'
  );
  
  RETURN v_deal_id;
END;
$$;

-- Function: Advance investment deal state
CREATE OR REPLACE FUNCTION advance_deal_state(
  p_deal_id integer,
  p_user_id integer,
  p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_state investment_deal_state;
  v_next_state investment_deal_state;
  v_creator_id integer;
  v_investor_id integer;
  v_pitch_id integer;
BEGIN
  -- Get current state and deal info
  SELECT deal_state, creator_id, investor_id, pitch_id
  INTO v_current_state, v_creator_id, v_investor_id, v_pitch_id
  FROM investment_deals WHERE id = p_deal_id;
  
  -- Determine next state
  v_next_state := CASE v_current_state
    WHEN 'inquiry' THEN 'due_diligence'::investment_deal_state
    WHEN 'nda_required' THEN 'nda_signed'::investment_deal_state
    WHEN 'nda_signed' THEN 'due_diligence'::investment_deal_state
    WHEN 'due_diligence' THEN 'negotiation'::investment_deal_state
    WHEN 'negotiation' THEN 'term_sheet'::investment_deal_state
    WHEN 'term_sheet' THEN 'legal_review'::investment_deal_state
    WHEN 'legal_review' THEN 'funding'::investment_deal_state
    WHEN 'funding' THEN 'completed'::investment_deal_state
    ELSE v_current_state -- No advancement possible
  END;
  
  -- Only advance if state actually changes
  IF v_next_state != v_current_state THEN
    -- Update deal state
    UPDATE investment_deals 
    SET deal_state = v_next_state,
        state_changed_at = now(),
        state_changed_by = p_user_id,
        updated_at = now()
    WHERE id = p_deal_id;
    
    -- Record state change
    INSERT INTO investment_deal_history (
      deal_id, from_state, to_state, changed_by, reason
    ) VALUES (
      p_deal_id, v_current_state, v_next_state, p_user_id, p_reason
    );
    
    -- Create notifications based on new state
    PERFORM create_deal_state_notifications(p_deal_id, v_next_state, p_user_id);
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Function: Create NDA request with automatic approval logic
CREATE OR REPLACE FUNCTION create_nda_request(
  p_pitch_id integer,
  p_requester_id integer,
  p_nda_type nda_type DEFAULT 'basic',
  p_access_level varchar DEFAULT 'basic'
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_nda_id integer;
  v_creator_id integer;
  v_auto_approve boolean;
  v_initial_state nda_state;
BEGIN
  -- Get creator and auto-approval setting
  SELECT p.user_id, 
         COALESCE((u.profile_settings->>'autoApproveNDAs')::boolean, false)
  INTO v_creator_id, v_auto_approve
  FROM pitches p
  JOIN users u ON p.user_id = u.id
  WHERE p.id = p_pitch_id;
  
  -- Determine initial state
  v_initial_state := CASE 
    WHEN v_auto_approve THEN 'approved'::nda_state
    ELSE 'pending'::nda_state
  END;
  
  -- Create NDA record
  INSERT INTO enhanced_ndas (
    pitch_id, requester_id, creator_id, nda_state, 
    nda_type, access_level, automatic_approval
  ) VALUES (
    p_pitch_id, p_requester_id, v_creator_id, v_initial_state,
    p_nda_type, p_access_level, v_auto_approve
  ) RETURNING id INTO v_nda_id;
  
  -- Create appropriate notification
  IF v_auto_approve THEN
    INSERT INTO workflow_notifications (
      user_id, notification_type, title, message, 
      related_nda_id, related_pitch_id, action_url
    ) VALUES (
      p_requester_id, 'nda_signed', 
      'NDA Automatically Approved',
      'Your NDA request has been automatically approved',
      v_nda_id, p_pitch_id, '/investor/ndas/' || v_nda_id
    );
  ELSE
    INSERT INTO workflow_notifications (
      user_id, notification_type, title, message, 
      related_nda_id, related_pitch_id, action_url, action_label
    ) VALUES (
      v_creator_id, 'nda_request', 
      'New NDA Request',
      'An investor has requested to sign your NDA',
      v_nda_id, p_pitch_id, '/creator/ndas/' || v_nda_id, 'Review NDA'
    );
  END IF;
  
  RETURN v_nda_id;
END;
$$;

-- Function: Process NDA approval and grant access
CREATE OR REPLACE FUNCTION process_nda_approval(
  p_nda_id integer,
  p_approver_id integer,
  p_approved boolean,
  p_notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_requester_id integer;
  v_pitch_id integer;
  v_new_state nda_state;
BEGIN
  -- Get NDA details
  SELECT requester_id, pitch_id 
  INTO v_requester_id, v_pitch_id
  FROM enhanced_ndas WHERE id = p_nda_id;
  
  v_new_state := CASE WHEN p_approved THEN 'approved'::nda_state 
                      ELSE 'rejected'::nda_state END;
  
  -- Update NDA state
  UPDATE enhanced_ndas
  SET nda_state = v_new_state,
      state_changed_at = now(),
      state_changed_by = p_approver_id,
      updated_at = now()
  WHERE id = p_nda_id;
  
  -- Grant or deny access
  IF p_approved THEN
    -- Grant access in pitch_access table
    INSERT INTO pitch_access (
      pitch_id, user_id, access_level, granted_by, granted_at, expires_at
    ) VALUES (
      v_pitch_id, v_requester_id, 'nda_signed', 
      p_approver_id, now(), now() + interval '1 year'
    ) ON CONFLICT (pitch_id, user_id) DO UPDATE
    SET access_level = 'nda_signed',
        granted_at = now(),
        expires_at = now() + interval '1 year';
    
    -- Update any related investment deals
    UPDATE investment_deals 
    SET deal_state = 'nda_signed'::investment_deal_state,
        state_changed_at = now(),
        state_changed_by = p_approver_id
    WHERE pitch_id = v_pitch_id 
    AND investor_id = v_requester_id 
    AND deal_state = 'nda_required'::investment_deal_state;
  END IF;
  
  -- Create notification
  INSERT INTO workflow_notifications (
    user_id, notification_type, title, message, 
    related_nda_id, related_pitch_id
  ) VALUES (
    v_requester_id, 
    CASE WHEN p_approved THEN 'nda_signed'::notification_type 
         ELSE 'system_alert'::notification_type END,
    CASE WHEN p_approved THEN 'NDA Approved' ELSE 'NDA Rejected' END,
    CASE WHEN p_approved THEN 'Your NDA request has been approved'
         ELSE 'Your NDA request was not approved' END,
    p_nda_id, v_pitch_id
  );
  
  RETURN true;
END;
$$;

-- Function: Create deal state notifications
CREATE OR REPLACE FUNCTION create_deal_state_notifications(
  p_deal_id integer,
  p_new_state investment_deal_state,
  p_user_id integer
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_creator_id integer;
  v_investor_id integer;
  v_pitch_id integer;
  v_notification_title varchar(200);
  v_notification_message text;
  v_action_url text;
BEGIN
  -- Get deal info
  SELECT creator_id, investor_id, pitch_id
  INTO v_creator_id, v_investor_id, v_pitch_id
  FROM investment_deals WHERE id = p_deal_id;
  
  -- Determine notification content
  CASE p_new_state
    WHEN 'due_diligence' THEN
      v_notification_title := 'Due Diligence Phase Started';
      v_notification_message := 'The investment deal has moved to due diligence review';
      v_action_url := '/deals/' || p_deal_id || '/due-diligence';
    WHEN 'negotiation' THEN
      v_notification_title := 'Negotiation Phase Started';
      v_notification_message := 'The deal is ready for terms negotiation';
      v_action_url := '/deals/' || p_deal_id || '/negotiate';
    WHEN 'term_sheet' THEN
      v_notification_title := 'Term Sheet Ready';
      v_notification_message := 'A term sheet has been prepared for review';
      v_action_url := '/deals/' || p_deal_id || '/term-sheet';
    WHEN 'legal_review' THEN
      v_notification_title := 'Legal Review Started';
      v_notification_message := 'The deal is under legal review';
      v_action_url := '/deals/' || p_deal_id || '/legal';
    WHEN 'funding' THEN
      v_notification_title := 'Funding In Progress';
      v_notification_message := 'Investment funding has been initiated';
      v_action_url := '/deals/' || p_deal_id || '/funding';
    WHEN 'completed' THEN
      v_notification_title := 'Deal Completed';
      v_notification_message := 'Investment deal has been successfully completed';
      v_action_url := '/deals/' || p_deal_id || '/summary';
    ELSE
      RETURN; -- No notification needed
  END CASE;
  
  -- Create notifications for both parties
  INSERT INTO workflow_notifications (
    user_id, notification_type, title, message, 
    related_deal_id, related_pitch_id, action_url
  ) VALUES 
    (v_creator_id, 'deal_update', v_notification_title, v_notification_message, 
     p_deal_id, v_pitch_id, v_action_url),
    (v_investor_id, 'deal_update', v_notification_title, v_notification_message,
     p_deal_id, v_pitch_id, v_action_url);
END;
$$;

-- ================================================================================
-- AUTOMATED TRIGGERS
-- ================================================================================

-- Trigger: Auto-update deal timestamps
CREATE OR REPLACE FUNCTION update_deal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER investment_deals_update_trigger
  BEFORE UPDATE ON investment_deals
  FOR EACH ROW EXECUTE FUNCTION update_deal_timestamp();

CREATE OR REPLACE TRIGGER production_deals_update_trigger
  BEFORE UPDATE ON production_deals  
  FOR EACH ROW EXECUTE FUNCTION update_deal_timestamp();

CREATE OR REPLACE TRIGGER enhanced_ndas_update_trigger
  BEFORE UPDATE ON enhanced_ndas
  FOR EACH ROW EXECUTE FUNCTION update_deal_timestamp();

-- Trigger: Automatic deal state progression based on conditions
CREATE OR REPLACE FUNCTION check_deal_auto_progression()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-progress from nda_required to nda_signed when NDA is approved
  IF NEW.deal_state = 'nda_required' THEN
    IF EXISTS (
      SELECT 1 FROM enhanced_ndas 
      WHERE pitch_id = NEW.pitch_id 
      AND requester_id = NEW.investor_id 
      AND nda_state = 'approved'
    ) THEN
      NEW.deal_state := 'nda_signed'::investment_deal_state;
      NEW.state_changed_at := now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER investment_deal_auto_progress_trigger
  BEFORE UPDATE ON investment_deals
  FOR EACH ROW EXECUTE FUNCTION check_deal_auto_progression();

-- Trigger: Notification cleanup (delete old notifications)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete notifications older than 6 months
  DELETE FROM workflow_notifications 
  WHERE created_at < now() - interval '6 months'
  AND read_at IS NOT NULL;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER notification_cleanup_trigger
  AFTER INSERT ON workflow_notifications
  FOR EACH STATEMENT EXECUTE FUNCTION cleanup_old_notifications();

-- ================================================================================
-- BUSINESS RULE VALIDATION FUNCTIONS
-- ================================================================================

-- Function: Validate investment deal business rules
CREATE OR REPLACE FUNCTION validate_investment_deal(
  p_deal_id integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_deal record;
  v_violations jsonb := '[]'::jsonb;
  v_creator_verification boolean;
  v_investor_verification boolean;
BEGIN
  -- Get deal details with related data
  SELECT d.*, p.title, p.estimated_budget,
         c.company_verified as creator_verified, c.subscription_tier as creator_tier,
         i.company_verified as investor_verified, i.subscription_tier as investor_tier
  INTO v_deal
  FROM investment_deals d
  JOIN pitches p ON d.pitch_id = p.id
  JOIN users c ON d.creator_id = c.id
  JOIN users i ON d.investor_id = i.id
  WHERE d.id = p_deal_id;
  
  -- Rule 1: Investment amount validation
  IF v_deal.investment_amount IS NOT NULL THEN
    IF v_deal.investment_amount < 1000 THEN
      v_violations := v_violations || jsonb_build_object(
        'rule', 'minimum_investment',
        'message', 'Investment amount must be at least €1,000',
        'severity', 'error'
      );
    END IF;
    
    IF v_deal.investment_amount > COALESCE(v_deal.estimated_budget * 2, 10000000) THEN
      v_violations := v_violations || jsonb_build_object(
        'rule', 'maximum_investment',
        'message', 'Investment amount exceeds reasonable project budget',
        'severity', 'warning'
      );
    END IF;
  END IF;
  
  -- Rule 2: Verification requirements for large deals
  IF v_deal.investment_amount > 100000 THEN
    IF NOT v_deal.creator_verified THEN
      v_violations := v_violations || jsonb_build_object(
        'rule', 'creator_verification',
        'message', 'Creator verification required for deals over €100,000',
        'severity', 'error'
      );
    END IF;
    
    IF NOT v_deal.investor_verified THEN
      v_violations := v_violations || jsonb_build_object(
        'rule', 'investor_verification', 
        'message', 'Investor verification required for deals over €100,000',
        'severity', 'error'
      );
    END IF;
  END IF;
  
  -- Rule 3: Subscription tier restrictions
  IF v_deal.creator_tier = 'free' AND v_deal.deal_state IN ('term_sheet', 'legal_review', 'funding') THEN
    v_violations := v_violations || jsonb_build_object(
      'rule', 'subscription_tier',
      'message', 'Paid subscription required for advanced deal stages',
      'severity', 'error'
    );
  END IF;
  
  -- Rule 4: Equity percentage validation
  IF v_deal.equity_percentage IS NOT NULL THEN
    IF v_deal.equity_percentage < 0.1 OR v_deal.equity_percentage > 100 THEN
      v_violations := v_violations || jsonb_build_object(
        'rule', 'equity_range',
        'message', 'Equity percentage must be between 0.1% and 100%',
        'severity', 'error'
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'valid', jsonb_array_length(v_violations) = 0,
    'violations', v_violations,
    'checked_at', now()
  );
END;
$$;

-- Function: Check user portal access permissions
CREATE OR REPLACE FUNCTION check_user_portal_access(
  p_user_id integer,
  p_portal varchar,
  p_resource_id integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_user record;
  v_access_result jsonb;
  v_has_access boolean := false;
  v_restrictions text[] := ARRAY[]::text[];
BEGIN
  -- Get user details
  SELECT user_type, subscription_tier, email_verified, company_verified,
         created_at, last_login_at
  INTO v_user
  FROM users WHERE id = p_user_id;
  
  IF v_user IS NULL THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'reason', 'User not found'
    );
  END IF;
  
  -- Portal-specific access rules
  CASE p_portal
    WHEN 'creator' THEN
      v_has_access := v_user.user_type = 'creator';
      IF NOT v_has_access THEN
        v_restrictions := array_append(v_restrictions, 'Must be a creator');
      END IF;
      
    WHEN 'investor' THEN
      v_has_access := v_user.user_type = 'investor' AND v_user.email_verified;
      IF v_user.user_type != 'investor' THEN
        v_restrictions := array_append(v_restrictions, 'Must be an investor');
      END IF;
      IF NOT v_user.email_verified THEN
        v_restrictions := array_append(v_restrictions, 'Email verification required');
      END IF;
      
    WHEN 'production' THEN
      v_has_access := v_user.user_type = 'production' AND v_user.company_verified;
      IF v_user.user_type != 'production' THEN
        v_restrictions := array_append(v_restrictions, 'Must be a production company');
      END IF;
      IF NOT v_user.company_verified THEN
        v_restrictions := array_append(v_restrictions, 'Company verification required');
      END IF;
  END CASE;
  
  -- Check subscription requirements for premium features
  IF p_resource_id IS NOT NULL AND v_user.subscription_tier = 'free' THEN
    v_restrictions := array_append(v_restrictions, 'Premium features require paid subscription');
  END IF;
  
  RETURN jsonb_build_object(
    'has_access', v_has_access,
    'user_type', v_user.user_type,
    'restrictions', v_restrictions,
    'subscription_tier', v_user.subscription_tier,
    'verified', CASE 
      WHEN p_portal = 'production' THEN v_user.company_verified
      ELSE v_user.email_verified
    END
  );
END;
$$;

-- ================================================================================
-- UTILITY FUNCTIONS
-- ================================================================================

-- Function: Get user deal summary
CREATE OR REPLACE FUNCTION get_user_deal_summary(
  p_user_id integer,
  p_user_type varchar DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_summary jsonb;
  v_investment_deals jsonb;
  v_production_deals jsonb;
  v_ndas jsonb;
BEGIN
  -- Get investment deals summary
  SELECT jsonb_build_object(
    'total_deals', COUNT(*),
    'active_deals', COUNT(*) FILTER (WHERE deal_state NOT IN ('completed', 'cancelled')),
    'total_amount', COALESCE(SUM(investment_amount), 0),
    'by_state', jsonb_object_agg(deal_state, count)
  ) INTO v_investment_deals
  FROM (
    SELECT deal_state, COUNT(*) as count, investment_amount
    FROM investment_deals 
    WHERE (creator_id = p_user_id OR investor_id = p_user_id)
    GROUP BY deal_state, investment_amount
  ) deals;
  
  -- Get production deals summary
  SELECT jsonb_build_object(
    'total_deals', COUNT(*),
    'active_deals', COUNT(*) FILTER (WHERE deal_state NOT IN ('completed', 'cancelled')),
    'total_option_amount', COALESCE(SUM(option_amount), 0),
    'by_type', jsonb_object_agg(deal_type, count)
  ) INTO v_production_deals
  FROM (
    SELECT deal_type, deal_state, COUNT(*) as count, option_amount
    FROM production_deals 
    WHERE (creator_id = p_user_id OR production_company_id = p_user_id)
    GROUP BY deal_type, deal_state, option_amount
  ) deals;
  
  -- Get NDAs summary  
  SELECT jsonb_build_object(
    'total_ndas', COUNT(*),
    'signed_ndas', COUNT(*) FILTER (WHERE nda_state = 'approved'),
    'pending_ndas', COUNT(*) FILTER (WHERE nda_state = 'pending'),
    'by_state', jsonb_object_agg(nda_state, count)
  ) INTO v_ndas
  FROM (
    SELECT nda_state, COUNT(*) as count
    FROM enhanced_ndas 
    WHERE (creator_id = p_user_id OR requester_id = p_user_id)
    GROUP BY nda_state
  ) ndas;
  
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'investment_deals', COALESCE(v_investment_deals, '{}'::jsonb),
    'production_deals', COALESCE(v_production_deals, '{}'::jsonb),
    'ndas', COALESCE(v_ndas, '{}'::jsonb),
    'generated_at', now()
  );
END;
$$;

-- ================================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================================

-- Investment deals indexes
CREATE INDEX IF NOT EXISTS idx_investment_deals_pitch_investor 
  ON investment_deals(pitch_id, investor_id);
CREATE INDEX IF NOT EXISTS idx_investment_deals_state 
  ON investment_deals(deal_state) WHERE deal_state NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_investment_deals_creator 
  ON investment_deals(creator_id, deal_state);
CREATE INDEX IF NOT EXISTS idx_investment_deals_priority 
  ON investment_deals(priority, created_at);

-- Production deals indexes  
CREATE INDEX IF NOT EXISTS idx_production_deals_pitch_company 
  ON production_deals(pitch_id, production_company_id);
CREATE INDEX IF NOT EXISTS idx_production_deals_creator 
  ON production_deals(creator_id, deal_state);
CREATE INDEX IF NOT EXISTS idx_production_deals_type 
  ON production_deals(deal_type, deal_state);

-- Enhanced NDAs indexes
CREATE INDEX IF NOT EXISTS idx_enhanced_ndas_pitch_requester 
  ON enhanced_ndas(pitch_id, requester_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_ndas_state 
  ON enhanced_ndas(nda_state) WHERE nda_state IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS idx_enhanced_ndas_creator 
  ON enhanced_ndas(creator_id, nda_state);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON workflow_notifications(user_id, created_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type_priority 
  ON workflow_notifications(notification_type, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_cleanup 
  ON workflow_notifications(created_at, read_at);

-- Create pitch access control table
CREATE TABLE IF NOT EXISTS "pitch_access" (
  "id" serial PRIMARY KEY,
  "pitch_id" integer NOT NULL REFERENCES "pitches"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "access_level" varchar(20) DEFAULT 'basic' NOT NULL,
  "granted_by" integer REFERENCES "users"("id"),
  "granted_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp,
  "revoked_at" timestamp,
  "metadata" jsonb,
  CONSTRAINT "unique_pitch_user_access" UNIQUE("pitch_id", "user_id")
);

CREATE INDEX IF NOT EXISTS idx_pitch_access_user ON pitch_access(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_pitch_access_pitch ON pitch_access(pitch_id, access_level);