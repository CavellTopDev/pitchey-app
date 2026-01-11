-- A/B Testing System Database Schema
-- This migration creates all necessary tables for a comprehensive A/B testing framework

-- Experiments table - stores experiment configurations
CREATE TABLE IF NOT EXISTS experiments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  hypothesis TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, active, paused, completed, archived
  primary_metric VARCHAR(100) NOT NULL,
  secondary_metrics TEXT[], -- JSON array of secondary metrics
  traffic_allocation DECIMAL(3,2) NOT NULL DEFAULT 1.0 CHECK (traffic_allocation >= 0 AND traffic_allocation <= 1),
  targeting_rules JSONB DEFAULT '{}',
  user_segments TEXT[] DEFAULT '{}',
  minimum_sample_size INTEGER NOT NULL DEFAULT 100,
  statistical_power DECIMAL(3,2) NOT NULL DEFAULT 0.8,
  significance_level DECIMAL(3,2) NOT NULL DEFAULT 0.05,
  auto_winner_detection BOOLEAN DEFAULT false,
  winner_variant_id VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  pause_reason TEXT,
  completion_reason TEXT,
  
  CONSTRAINT fk_experiments_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Experiment variants table - stores different variations for experiments
CREATE TABLE IF NOT EXISTS experiment_variants (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL,
  variant_id VARCHAR(100) NOT NULL, -- user-defined variant identifier
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}', -- variant configuration (colors, copy, features, etc.)
  traffic_allocation DECIMAL(3,2) NOT NULL CHECK (traffic_allocation >= 0 AND traffic_allocation <= 1),
  is_control BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_experiment_variants_experiment FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
  CONSTRAINT unique_variant_per_experiment UNIQUE (experiment_id, variant_id)
);

-- User experiment assignments - tracks which users are assigned to which variants
CREATE TABLE IF NOT EXISTS user_experiment_assignments (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL,
  variant_id VARCHAR(100) NOT NULL,
  user_id INTEGER,
  session_id VARCHAR(255),
  user_type VARCHAR(50),
  user_agent TEXT,
  ip_address INET,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_exposure_at TIMESTAMP WITH TIME ZONE,
  custom_properties JSONB DEFAULT '{}',
  
  CONSTRAINT fk_user_assignments_experiment FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
  CONSTRAINT user_assignment_identifier CHECK (user_id IS NOT NULL OR session_id IS NOT NULL),
  CONSTRAINT unique_user_experiment UNIQUE (experiment_id, COALESCE(user_id::text, session_id))
);

-- Experiment events - tracks all user interactions and conversions
CREATE TABLE IF NOT EXISTS experiment_events (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL,
  variant_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- page_view, click, conversion, custom
  event_name VARCHAR(255),
  event_value DECIMAL(10,2), -- for revenue or numerical conversions
  user_id INTEGER,
  session_id VARCHAR(255),
  user_type VARCHAR(50),
  user_agent TEXT,
  ip_address INET,
  url TEXT,
  referrer TEXT,
  element_id VARCHAR(255), -- for click tracking
  element_text TEXT, -- for click tracking
  properties JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_experiment_events_experiment FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
);

-- Experiment results cache - stores pre-calculated statistical results
CREATE TABLE IF NOT EXISTS experiment_results_cache (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL,
  variant_id VARCHAR(100) NOT NULL,
  metric VARCHAR(100) NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  conversion_rate DECIMAL(6,4),
  confidence_interval_lower DECIMAL(6,4),
  confidence_interval_upper DECIMAL(6,4),
  p_value DECIMAL(10,8),
  statistical_significance BOOLEAN DEFAULT false,
  improvement_over_control DECIMAL(6,4),
  total_conversions INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_experiment_results_experiment FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
  CONSTRAINT unique_variant_metric UNIQUE (experiment_id, variant_id, metric)
);

-- Feature flags table - for simple boolean feature toggles
CREATE TABLE IF NOT EXISTS feature_flags (
  id SERIAL PRIMARY KEY,
  flag_key VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_value JSONB NOT NULL,
  targeting_rules JSONB DEFAULT '{}',
  user_segments TEXT[] DEFAULT '{}',
  enabled BOOLEAN DEFAULT false,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_feature_flags_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

-- User feature flag overrides - for manual user-specific feature flag values
CREATE TABLE IF NOT EXISTS user_feature_flag_overrides (
  id SERIAL PRIMARY KEY,
  flag_key VARCHAR(255) NOT NULL,
  user_id INTEGER,
  session_id VARCHAR(255),
  override_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT fk_flag_overrides_flag FOREIGN KEY (flag_key) REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
  CONSTRAINT user_override_identifier CHECK (user_id IS NOT NULL OR session_id IS NOT NULL),
  CONSTRAINT unique_user_flag_override UNIQUE (flag_key, COALESCE(user_id::text, session_id))
);

-- Experiment snapshots - for historical data preservation
CREATE TABLE IF NOT EXISTS experiment_snapshots (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL,
  snapshot_type VARCHAR(50) NOT NULL, -- daily, weekly, final
  snapshot_date DATE NOT NULL,
  data JSONB NOT NULL, -- complete experiment state and results
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_experiment_snapshots_experiment FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
  CONSTRAINT unique_experiment_snapshot UNIQUE (experiment_id, snapshot_type, snapshot_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_created_by ON experiments(created_by);
CREATE INDEX IF NOT EXISTS idx_experiments_tags ON experiments USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_experiments_started_at ON experiments(started_at);

CREATE INDEX IF NOT EXISTS idx_experiment_variants_experiment_id ON experiment_variants(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_variants_variant_id ON experiment_variants(variant_id);

CREATE INDEX IF NOT EXISTS idx_user_assignments_experiment_id ON user_experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_user_id ON user_experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_session_id ON user_experiment_assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_user_assignments_assigned_at ON user_experiment_assignments(assigned_at);

CREATE INDEX IF NOT EXISTS idx_experiment_events_experiment_id ON experiment_events(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_events_user_id ON experiment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_experiment_events_session_id ON experiment_events(session_id);
CREATE INDEX IF NOT EXISTS idx_experiment_events_timestamp ON experiment_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_experiment_events_event_type ON experiment_events(event_type);

CREATE INDEX IF NOT EXISTS idx_experiment_results_experiment_id ON experiment_results_cache(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_results_calculated_at ON experiment_results_cache(calculated_at);

CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_flag_key ON feature_flags(flag_key);

CREATE INDEX IF NOT EXISTS idx_user_flag_overrides_flag_key ON user_feature_flag_overrides(flag_key);
CREATE INDEX IF NOT EXISTS idx_user_flag_overrides_user_id ON user_feature_flag_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_flag_overrides_expires_at ON user_feature_flag_overrides(expires_at);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_experiments_updated_at BEFORE UPDATE ON experiments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experiment_variants_updated_at BEFORE UPDATE ON experiment_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user if not exists for initial feature flag setup
INSERT INTO feature_flags (flag_key, name, description, default_value, enabled, created_by)
SELECT 
    'ab_testing_enabled',
    'A/B Testing System',
    'Master switch for the A/B testing system',
    'true'::jsonb,
    true,
    1
WHERE NOT EXISTS (SELECT 1 FROM feature_flags WHERE flag_key = 'ab_testing_enabled');

INSERT INTO feature_flags (flag_key, name, description, default_value, enabled, created_by)
SELECT 
    'visual_experiment_editor',
    'Visual Experiment Editor',
    'Enable visual drag-and-drop experiment editor',
    'true'::jsonb,
    false,
    1
WHERE NOT EXISTS (SELECT 1 FROM feature_flags WHERE flag_key = 'visual_experiment_editor');

INSERT INTO feature_flags (flag_key, name, description, default_value, enabled, created_by)
SELECT 
    'auto_winner_detection',
    'Automatic Winner Detection',
    'Automatically detect and promote winning variants',
    'false'::jsonb,
    false,
    1
WHERE NOT EXISTS (SELECT 1 FROM feature_flags WHERE flag_key = 'auto_winner_detection');