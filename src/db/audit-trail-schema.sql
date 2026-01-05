-- SEC Compliance Audit Trail Schema
-- Implements immutable audit logging with hash chaining for regulatory compliance

-- Create audit schema
CREATE SCHEMA IF NOT EXISTS audit;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Audit log table with partitioning for performance
CREATE TABLE IF NOT EXISTS audit.logged_actions (
  event_id        BIGSERIAL,
  event_uuid      UUID DEFAULT gen_random_uuid(),
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  
  -- Entity identification
  schema_name     TEXT NOT NULL,
  table_name      TEXT NOT NULL,
  row_id          JSONB, -- Primary key(s) of affected row
  
  -- Action details
  action_type     TEXT NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  
  -- User/Application context
  application_user_id UUID,
  application_user_email TEXT,
  application_user_role TEXT,
  session_id      TEXT,
  client_addr     INET,
  client_port     INTEGER,
  
  -- Request context
  request_id      TEXT,
  request_url     TEXT,
  request_method  TEXT,
  user_agent      TEXT,
  
  -- Data changes
  old_data        JSONB, -- Row data before change
  new_data        JSONB, -- Row data after change
  changed_fields  JSONB, -- List of changed field names
  
  -- Hash chain for immutability
  hash_chain      TEXT,     -- Hash of previous record
  record_hash     TEXT,     -- Hash of this record
  
  -- Compliance metadata
  regulatory_event BOOLEAN DEFAULT FALSE, -- SEC reportable event
  event_category  TEXT, -- 'kyc', 'investment', 'payment', 'document', etc.
  
  PRIMARY KEY (event_id, event_timestamp)
) PARTITION BY RANGE (event_timestamp);

-- Create partitions for the next 2 years (monthly)
DO $$
DECLARE
  start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
  end_date DATE;
  partition_name TEXT;
BEGIN
  FOR i IN 0..23 LOOP
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'logged_actions_' || TO_CHAR(start_date, 'YYYY_MM');
    
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS audit.%I PARTITION OF audit.logged_actions
      FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_date,
      end_date
    );
    
    -- Create indexes on partition
    EXECUTE format('
      CREATE INDEX IF NOT EXISTS idx_%I_timestamp ON audit.%I (event_timestamp);
      CREATE INDEX IF NOT EXISTS idx_%I_user ON audit.%I (application_user_id);
      CREATE INDEX IF NOT EXISTS idx_%I_table ON audit.%I (schema_name, table_name);
      CREATE INDEX IF NOT EXISTS idx_%I_regulatory ON audit.%I (regulatory_event) WHERE regulatory_event = true;',
      partition_name, partition_name,
      partition_name, partition_name,
      partition_name, partition_name,
      partition_name, partition_name
    );
    
    start_date := end_date;
  END LOOP;
END $$;

-- Function to prevent modification of audit records
CREATE OR REPLACE FUNCTION audit.prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit records cannot be modified or deleted for compliance reasons';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent updates/deletes on audit table
DROP TRIGGER IF EXISTS prevent_audit_modification ON audit.logged_actions;
CREATE TRIGGER prevent_audit_modification
  BEFORE UPDATE OR DELETE ON audit.logged_actions
  FOR EACH ROW
  EXECUTE FUNCTION audit.prevent_modification();

-- Function to compute hash chain
CREATE OR REPLACE FUNCTION audit.compute_hash_chain()
RETURNS TRIGGER AS $$
DECLARE
  prev_hash TEXT;
  data_to_hash TEXT;
BEGIN
  -- Get the hash of the previous record
  SELECT record_hash INTO prev_hash
  FROM audit.logged_actions
  ORDER BY event_timestamp DESC, event_id DESC
  LIMIT 1;
  
  -- Set hash chain (previous record's hash or GENESIS for first record)
  NEW.hash_chain := COALESCE(prev_hash, 'GENESIS');
  
  -- Create string to hash (concatenate key fields)
  data_to_hash := CONCAT(
    NEW.event_uuid::TEXT,
    NEW.event_timestamp::TEXT,
    NEW.schema_name,
    NEW.table_name,
    NEW.action_type,
    COALESCE(NEW.row_id::TEXT, ''),
    COALESCE(NEW.old_data::TEXT, ''),
    COALESCE(NEW.new_data::TEXT, ''),
    NEW.hash_chain
  );
  
  -- Compute hash
  NEW.record_hash := encode(
    digest(data_to_hash, 'sha256'),
    'hex'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to compute hash before insert
DROP TRIGGER IF EXISTS compute_hash_before_insert ON audit.logged_actions;
CREATE TRIGGER compute_hash_before_insert
  BEFORE INSERT ON audit.logged_actions
  FOR EACH ROW
  EXECUTE FUNCTION audit.compute_hash_chain();

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit.log_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  audit_row audit.logged_actions;
  changed_fields_list TEXT[];
  old_value JSONB;
  new_value JSONB;
  key TEXT;
BEGIN
  -- Set basic audit fields
  audit_row.event_timestamp = clock_timestamp();
  audit_row.schema_name = TG_TABLE_SCHEMA;
  audit_row.table_name = TG_TABLE_NAME;
  audit_row.action_type = TG_OP;
  
  -- Get application context (set by application)
  audit_row.application_user_id = current_setting('app.current_user_id', true)::UUID;
  audit_row.application_user_email = current_setting('app.current_user_email', true);
  audit_row.application_user_role = current_setting('app.current_user_role', true);
  audit_row.session_id = current_setting('app.session_id', true);
  audit_row.request_id = current_setting('app.request_id', true);
  audit_row.request_url = current_setting('app.request_url', true);
  audit_row.request_method = current_setting('app.request_method', true);
  audit_row.user_agent = current_setting('app.user_agent', true);
  audit_row.client_addr = current_setting('app.client_addr', true)::INET;
  
  -- Determine event category based on table
  audit_row.event_category = CASE
    WHEN TG_TABLE_NAME IN ('users', 'kyc_verifications') THEN 'kyc'
    WHEN TG_TABLE_NAME IN ('investments', 'investment_commitments', 'escrow_accounts') THEN 'investment'
    WHEN TG_TABLE_NAME IN ('payments', 'transactions', 'transfers') THEN 'payment'
    WHEN TG_TABLE_NAME IN ('documents', 'agreements', 'contracts') THEN 'document'
    WHEN TG_TABLE_NAME IN ('pitches', 'pitch_updates') THEN 'content'
    ELSE 'general'
  END;
  
  -- Mark as regulatory event for specific tables/operations
  audit_row.regulatory_event = (
    audit_row.event_category IN ('kyc', 'investment', 'payment') OR
    (TG_TABLE_NAME = 'users' AND TG_OP IN ('INSERT', 'UPDATE')) OR
    (TG_TABLE_NAME = 'ndas' AND TG_OP = 'INSERT')
  );
  
  IF TG_OP = 'DELETE' THEN
    audit_row.row_id = to_jsonb(OLD.id);
    audit_row.old_data = to_jsonb(OLD);
    
  ELSIF TG_OP = 'UPDATE' THEN
    audit_row.row_id = to_jsonb(NEW.id);
    audit_row.old_data = to_jsonb(OLD);
    audit_row.new_data = to_jsonb(NEW);
    
    -- Calculate changed fields
    FOR key IN SELECT jsonb_object_keys(to_jsonb(NEW))
    LOOP
      old_value = to_jsonb(OLD) -> key;
      new_value = to_jsonb(NEW) -> key;
      
      IF old_value IS DISTINCT FROM new_value THEN
        changed_fields_list = array_append(changed_fields_list, key);
      END IF;
    END LOOP;
    
    audit_row.changed_fields = to_jsonb(changed_fields_list);
    
  ELSIF TG_OP = 'INSERT' THEN
    audit_row.row_id = to_jsonb(NEW.id);
    audit_row.new_data = to_jsonb(NEW);
    
  ELSIF TG_OP = 'TRUNCATE' THEN
    -- TRUNCATE doesn't have row data
    audit_row.row_id = NULL;
  END IF;
  
  -- Insert audit record
  INSERT INTO audit.logged_actions VALUES (audit_row.*);
  
  -- Return appropriate value
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to critical tables
-- Users table
DROP TRIGGER IF EXISTS audit_trigger_users ON users;
CREATE TRIGGER audit_trigger_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit.log_trigger_function();

-- Investments table
DROP TRIGGER IF EXISTS audit_trigger_investments ON investments;
CREATE TRIGGER audit_trigger_investments
  AFTER INSERT OR UPDATE OR DELETE ON investments
  FOR EACH ROW
  EXECUTE FUNCTION audit.log_trigger_function();

-- Pitches table
DROP TRIGGER IF EXISTS audit_trigger_pitches ON pitches;
CREATE TRIGGER audit_trigger_pitches
  AFTER INSERT OR UPDATE OR DELETE ON pitches
  FOR EACH ROW
  EXECUTE FUNCTION audit.log_trigger_function();

-- NDAs table
DROP TRIGGER IF EXISTS audit_trigger_ndas ON ndas;
CREATE TRIGGER audit_trigger_ndas
  AFTER INSERT OR UPDATE OR DELETE ON ndas
  FOR EACH ROW
  EXECUTE FUNCTION audit.log_trigger_function();

-- View to verify hash chain integrity
CREATE OR REPLACE VIEW audit.hash_chain_verification AS
WITH chain_check AS (
  SELECT 
    event_id,
    event_timestamp,
    record_hash,
    hash_chain,
    LAG(record_hash) OVER (ORDER BY event_timestamp, event_id) AS previous_hash,
    CASE 
      WHEN hash_chain = 'GENESIS' AND LAG(record_hash) OVER (ORDER BY event_timestamp, event_id) IS NULL THEN TRUE
      WHEN hash_chain = LAG(record_hash) OVER (ORDER BY event_timestamp, event_id) THEN TRUE
      ELSE FALSE
    END AS chain_valid
  FROM audit.logged_actions
)
SELECT 
  event_id,
  event_timestamp,
  record_hash,
  hash_chain,
  previous_hash,
  chain_valid,
  CASE 
    WHEN NOT chain_valid THEN 'CHAIN BROKEN - Potential tampering detected!'
    ELSE 'Chain intact'
  END AS status
FROM chain_check
WHERE NOT chain_valid OR event_id IN (
  SELECT MAX(event_id) FROM audit.logged_actions
);

-- Function to export audit logs for regulatory submission
CREATE OR REPLACE FUNCTION audit.export_for_sec_submission(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  event_categories TEXT[] DEFAULT ARRAY['kyc', 'investment', 'payment']
)
RETURNS TABLE (
  event_id BIGINT,
  event_timestamp TIMESTAMPTZ,
  event_category TEXT,
  action_type TEXT,
  user_email TEXT,
  table_affected TEXT,
  row_identifier JSONB,
  changed_data JSONB,
  record_hash TEXT,
  chain_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH validated_chain AS (
    SELECT 
      la.event_id,
      la.event_timestamp,
      la.event_category,
      la.action_type,
      la.application_user_email,
      CONCAT(la.schema_name, '.', la.table_name) AS table_affected,
      la.row_id,
      CASE 
        WHEN la.action_type = 'INSERT' THEN la.new_data
        WHEN la.action_type = 'UPDATE' THEN jsonb_build_object(
          'old', la.old_data,
          'new', la.new_data,
          'changed', la.changed_fields
        )
        WHEN la.action_type = 'DELETE' THEN la.old_data
      END AS changed_data,
      la.record_hash,
      CASE 
        WHEN la.hash_chain = 'GENESIS' THEN TRUE
        WHEN la.hash_chain = LAG(la.record_hash) OVER (ORDER BY la.event_timestamp, la.event_id) THEN TRUE
        ELSE FALSE
      END AS chain_valid
    FROM audit.logged_actions la
    WHERE la.event_timestamp BETWEEN start_date AND end_date
      AND la.regulatory_event = TRUE
      AND (event_categories IS NULL OR la.event_category = ANY(event_categories))
  )
  SELECT 
    vc.event_id,
    vc.event_timestamp,
    vc.event_category,
    vc.action_type,
    vc.application_user_email AS user_email,
    vc.table_affected,
    vc.row_id AS row_identifier,
    vc.changed_data,
    vc.record_hash,
    vc.chain_valid
  FROM validated_chain vc
  ORDER BY vc.event_timestamp, vc.event_id;
END;
$$ LANGUAGE plpgsql;

-- Maintenance function to create future partitions
CREATE OR REPLACE FUNCTION audit.create_monthly_partition()
RETURNS void AS $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Calculate partition for next month
  partition_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  partition_name := 'logged_actions_' || TO_CHAR(partition_date, 'YYYY_MM');
  start_date := partition_date;
  end_date := partition_date + INTERVAL '1 month';
  
  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'audit' 
    AND tablename = partition_name
  ) THEN
    -- Create partition
    EXECUTE format('
      CREATE TABLE audit.%I PARTITION OF audit.logged_actions
      FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      start_date,
      end_date
    );
    
    -- Create indexes
    EXECUTE format('
      CREATE INDEX idx_%I_timestamp ON audit.%I (event_timestamp);
      CREATE INDEX idx_%I_user ON audit.%I (application_user_id);
      CREATE INDEX idx_%I_table ON audit.%I (schema_name, table_name);
      CREATE INDEX idx_%I_regulatory ON audit.%I (regulatory_event) WHERE regulatory_event = true;',
      partition_name, partition_name,
      partition_name, partition_name,
      partition_name, partition_name,
      partition_name, partition_name
    );
    
    RAISE NOTICE 'Created partition % for period % to %', partition_name, start_date, end_date;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule partition creation (run monthly via pg_cron or external scheduler)
-- SELECT cron.schedule('create-audit-partitions', '0 0 1 * *', 'SELECT audit.create_monthly_partition()');

-- Compliance reporting views
CREATE OR REPLACE VIEW audit.investment_activity_summary AS
SELECT 
  DATE_TRUNC('day', event_timestamp) AS activity_date,
  COUNT(DISTINCT application_user_id) AS unique_users,
  COUNT(*) FILTER (WHERE action_type = 'INSERT') AS new_investments,
  COUNT(*) FILTER (WHERE action_type = 'UPDATE') AS updated_investments,
  COUNT(*) FILTER (WHERE action_type = 'DELETE') AS cancelled_investments,
  COUNT(DISTINCT row_id) AS unique_investments
FROM audit.logged_actions
WHERE schema_name = 'public'
  AND table_name IN ('investments', 'investment_commitments')
  AND event_timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', event_timestamp)
ORDER BY activity_date DESC;

-- KYC compliance view
CREATE OR REPLACE VIEW audit.kyc_compliance_status AS
SELECT 
  DATE_TRUNC('day', event_timestamp) AS verification_date,
  COUNT(*) FILTER (WHERE new_data->>'kyc_status' = 'verified') AS verified_count,
  COUNT(*) FILTER (WHERE new_data->>'kyc_status' = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE new_data->>'kyc_status' = 'failed') AS failed_count,
  COUNT(*) FILTER (WHERE new_data->>'accreditation_status' = 'verified') AS accredited_count
FROM audit.logged_actions
WHERE schema_name = 'public'
  AND table_name = 'users'
  AND action_type IN ('INSERT', 'UPDATE')
  AND event_timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', event_timestamp)
ORDER BY verification_date DESC;