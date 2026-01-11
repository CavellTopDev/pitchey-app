/**
 * Database Schema for Pitch Validation and Scoring System
 * Comprehensive storage for AI-powered pitch analysis
 */

-- Pitch validation scores and analysis results
CREATE TABLE IF NOT EXISTS pitch_validation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Core scoring data
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  validation_version VARCHAR(10) NOT NULL DEFAULT '1.0',
  analysis_depth VARCHAR(20) NOT NULL DEFAULT 'standard', -- basic, standard, comprehensive
  
  -- Category scores (JSON for flexibility)
  story_score JSONB NOT NULL, -- CategoryScore structure
  market_score JSONB NOT NULL,
  finance_score JSONB NOT NULL,
  team_score JSONB NOT NULL,
  production_score JSONB NOT NULL,
  
  -- AI insights and predictions
  ai_insights JSONB, -- AIAnalysisInsights structure
  success_prediction JSONB, -- SuccessPrediction structure
  market_timing JSONB, -- MarketTimingAnalysis structure
  risk_assessment JSONB, -- RiskAssessment structure
  
  -- Metadata
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_sources JSONB, -- Track what data was used for analysis
  processing_time_ms INTEGER, -- Analysis duration
  
  -- Tracking and analytics
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pitch validation recommendations
CREATE TABLE IF NOT EXISTS pitch_validation_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_score_id UUID REFERENCES pitch_validation_scores(id) ON DELETE CASCADE,
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  
  -- Recommendation details
  category VARCHAR(50) NOT NULL, -- story, market, finance, team, production
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Impact and effort assessment
  estimated_impact INTEGER CHECK (estimated_impact >= 0 AND estimated_impact <= 100),
  effort_level VARCHAR(10) CHECK (effort_level IN ('low', 'medium', 'high')),
  estimated_cost INTEGER DEFAULT 0,
  timeline VARCHAR(100),
  
  -- Action items and tracking
  action_items JSONB, -- Array of ActionItem structures
  resources_required JSONB, -- Array of required resources
  
  -- Implementation tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
  implemented_at TIMESTAMPTZ,
  implementation_notes TEXT,
  result_impact INTEGER, -- Actual impact achieved
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comparable projects for benchmarking
CREATE TABLE IF NOT EXISTS pitch_validation_comparables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_score_id UUID REFERENCES pitch_validation_scores(id) ON DELETE CASCADE,
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  
  -- Comparable project details
  project_title VARCHAR(255) NOT NULL,
  project_genre VARCHAR(100) NOT NULL,
  project_year INTEGER NOT NULL,
  project_budget BIGINT NOT NULL,
  project_box_office BIGINT NOT NULL,
  project_roi INTEGER NOT NULL,
  
  -- Similarity analysis
  relevance_score INTEGER NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 100),
  similarities JSONB NOT NULL, -- Array of ProjectSimilarity structures
  
  -- Learning insights
  success_factors JSONB, -- Array of success factors
  lessons_learned JSONB, -- Array of lessons
  
  -- External data sources
  external_id VARCHAR(255), -- IMDb ID, TMDb ID, etc.
  data_source VARCHAR(100), -- Source of the comparable data
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Benchmark data for industry comparisons
CREATE TABLE IF NOT EXISTS pitch_validation_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_score_id UUID REFERENCES pitch_validation_scores(id) ON DELETE CASCADE,
  
  -- Benchmark category and metrics
  category VARCHAR(50) NOT NULL,
  industry_average INTEGER NOT NULL CHECK (industry_average >= 0 AND industry_average <= 100),
  top_quartile INTEGER NOT NULL CHECK (top_quartile >= 0 AND top_quartile <= 100),
  your_score INTEGER NOT NULL CHECK (your_score >= 0 AND your_score <= 100),
  percentile INTEGER NOT NULL CHECK (percentile >= 0 AND percentile <= 100),
  
  -- Comparison context
  comparison_pool VARCHAR(255) NOT NULL,
  sample_size INTEGER,
  data_freshness VARCHAR(100),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Real-time validation feedback
CREATE TABLE IF NOT EXISTS pitch_realtime_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Field being validated
  field_name VARCHAR(100) NOT NULL, -- title, logline, synopsis, etc.
  field_content TEXT NOT NULL,
  
  -- Quick analysis results
  quick_score INTEGER NOT NULL CHECK (quick_score >= 0 AND quick_score <= 100),
  suggestions JSONB, -- Array of suggestions
  warnings JSONB, -- Array of warnings
  
  -- Metadata
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Validation progress tracking
CREATE TABLE IF NOT EXISTS pitch_validation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Progress metrics
  completeness_percentage INTEGER NOT NULL CHECK (completeness_percentage >= 0 AND completeness_percentage <= 100),
  missing_fields JSONB, -- Array of missing field names
  recommended_fields JSONB, -- Array of recommended field names
  
  -- Score evolution
  previous_score INTEGER,
  current_score INTEGER NOT NULL CHECK (current_score >= 0 AND current_score <= 100),
  score_change INTEGER,
  
  -- Milestone tracking
  milestones_achieved JSONB, -- Array of achieved milestones
  next_milestones JSONB, -- Array of upcoming milestones
  
  -- Metadata
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Validation analytics and trends
CREATE TABLE IF NOT EXISTS pitch_validation_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Date-based analytics
  analysis_date DATE NOT NULL,
  
  -- Aggregate metrics
  total_pitches_analyzed INTEGER NOT NULL DEFAULT 0,
  average_overall_score INTEGER CHECK (average_overall_score >= 0 AND average_overall_score <= 100),
  median_overall_score INTEGER CHECK (median_overall_score >= 0 AND median_overall_score <= 100),
  
  -- Category performance
  avg_story_score INTEGER CHECK (avg_story_score >= 0 AND avg_story_score <= 100),
  avg_market_score INTEGER CHECK (avg_market_score >= 0 AND avg_market_score <= 100),
  avg_finance_score INTEGER CHECK (avg_finance_score >= 0 AND avg_finance_score <= 100),
  avg_team_score INTEGER CHECK (avg_team_score >= 0 AND avg_team_score <= 100),
  avg_production_score INTEGER CHECK (avg_production_score >= 0 AND avg_production_score <= 100),
  
  -- Distribution data
  score_distribution JSONB, -- Score ranges and counts
  genre_performance JSONB, -- Performance by genre
  budget_range_performance JSONB, -- Performance by budget ranges
  
  -- Trend data
  recommendations_generated INTEGER NOT NULL DEFAULT 0,
  recommendations_implemented INTEGER NOT NULL DEFAULT 0,
  avg_improvement_after_recommendations INTEGER,
  
  -- Market insights
  trending_genres JSONB, -- Currently trending genres
  common_weaknesses JSONB, -- Most common areas for improvement
  success_patterns JSONB, -- Patterns found in high-scoring pitches
  
  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(analysis_date)
);

-- User validation preferences and settings
CREATE TABLE IF NOT EXISTS user_validation_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Analysis preferences
  default_analysis_depth VARCHAR(20) NOT NULL DEFAULT 'standard',
  auto_analyze_on_save BOOLEAN DEFAULT FALSE,
  include_market_data BOOLEAN DEFAULT TRUE,
  include_comparables BOOLEAN DEFAULT TRUE,
  include_predictions BOOLEAN DEFAULT TRUE,
  
  -- Notification preferences
  notify_on_score_improvement BOOLEAN DEFAULT TRUE,
  notify_on_new_recommendations BOOLEAN DEFAULT TRUE,
  notification_threshold INTEGER DEFAULT 5, -- Minimum score change to notify
  
  -- Dashboard preferences
  preferred_chart_types JSONB, -- User's preferred visualization types
  dashboard_layout JSONB, -- Custom dashboard layout
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Validation workflow and milestones
CREATE TABLE IF NOT EXISTS pitch_validation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Workflow details
  workflow_name VARCHAR(255) NOT NULL,
  current_stage VARCHAR(100) NOT NULL,
  total_stages INTEGER NOT NULL,
  completed_stages INTEGER NOT NULL DEFAULT 0,
  
  -- Stage definitions
  stages JSONB NOT NULL, -- Array of ValidationStep structures
  
  -- Progress tracking
  estimated_completion_date DATE,
  actual_completion_date DATE,
  
  -- Status and notes
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- External data sources and integrations
CREATE TABLE IF NOT EXISTS validation_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source details
  source_name VARCHAR(100) NOT NULL UNIQUE,
  source_type VARCHAR(50) NOT NULL, -- api, database, manual, crawl4ai
  source_url VARCHAR(500),
  
  -- Integration details
  api_endpoint VARCHAR(500),
  authentication_type VARCHAR(50),
  rate_limit_per_hour INTEGER,
  
  -- Data quality and reliability
  reliability_score INTEGER CHECK (reliability_score >= 0 AND reliability_score <= 100),
  data_freshness_hours INTEGER DEFAULT 24,
  last_updated TIMESTAMPTZ,
  
  -- Usage tracking
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  
  -- Configuration
  is_active BOOLEAN DEFAULT TRUE,
  configuration JSONB, -- Source-specific configuration
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Validation score history for tracking improvements
CREATE TABLE IF NOT EXISTS pitch_validation_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  validation_score_id UUID REFERENCES pitch_validation_scores(id) ON DELETE SET NULL,
  
  -- Historical score data
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  category_scores JSONB NOT NULL, -- Snapshot of all category scores
  
  -- Change tracking
  score_change INTEGER, -- Change from previous analysis
  changed_categories JSONB, -- Which categories changed
  improvement_reason VARCHAR(255), -- What caused the improvement
  
  -- Context
  analysis_trigger VARCHAR(100), -- manual, auto, recommendation_implementation
  user_actions JSONB, -- What user actions preceded this analysis
  
  -- Metadata
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for optimal performance

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_pitch_validation_scores_pitch_id ON pitch_validation_scores(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_scores_user_id ON pitch_validation_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_scores_overall_score ON pitch_validation_scores(overall_score);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_scores_analyzed_at ON pitch_validation_scores(analyzed_at);

-- Recommendation indexes
CREATE INDEX IF NOT EXISTS idx_pitch_validation_recommendations_pitch_id ON pitch_validation_recommendations(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_recommendations_category ON pitch_validation_recommendations(category);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_recommendations_priority ON pitch_validation_recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_recommendations_status ON pitch_validation_recommendations(status);

-- Comparable projects indexes
CREATE INDEX IF NOT EXISTS idx_pitch_validation_comparables_pitch_id ON pitch_validation_comparables(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_comparables_genre ON pitch_validation_comparables(project_genre);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_comparables_year ON pitch_validation_comparables(project_year);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_comparables_relevance ON pitch_validation_comparables(relevance_score);

-- Real-time validation indexes
CREATE INDEX IF NOT EXISTS idx_pitch_realtime_validations_pitch_id ON pitch_realtime_validations(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_realtime_validations_field ON pitch_realtime_validations(field_name);
CREATE INDEX IF NOT EXISTS idx_pitch_realtime_validations_validated_at ON pitch_realtime_validations(validated_at);

-- Progress tracking indexes
CREATE INDEX IF NOT EXISTS idx_pitch_validation_progress_pitch_id ON pitch_validation_progress(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_progress_tracked_at ON pitch_validation_progress(tracked_at);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_pitch_validation_analytics_date ON pitch_validation_analytics(analysis_date);

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_pitch_validation_workflows_pitch_id ON pitch_validation_workflows(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_workflows_status ON pitch_validation_workflows(status);

-- Score history indexes
CREATE INDEX IF NOT EXISTS idx_pitch_validation_score_history_pitch_id ON pitch_validation_score_history(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_validation_score_history_recorded_at ON pitch_validation_score_history(recorded_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pitch_scores_pitch_analyzed ON pitch_validation_scores(pitch_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_pitch_priority ON pitch_validation_recommendations(pitch_id, priority, status);
CREATE INDEX IF NOT EXISTS idx_comparables_genre_budget ON pitch_validation_comparables(project_genre, project_budget);

-- JSONB indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_validation_scores_story_gin ON pitch_validation_scores USING GIN (story_score);
CREATE INDEX IF NOT EXISTS idx_validation_scores_market_gin ON pitch_validation_scores USING GIN (market_score);
CREATE INDEX IF NOT EXISTS idx_validation_scores_ai_insights_gin ON pitch_validation_scores USING GIN (ai_insights);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_validation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pitch_validation_scores_timestamp
    BEFORE UPDATE ON pitch_validation_scores
    FOR EACH ROW EXECUTE FUNCTION update_validation_timestamp();

CREATE TRIGGER update_pitch_validation_recommendations_timestamp
    BEFORE UPDATE ON pitch_validation_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_validation_timestamp();

CREATE TRIGGER update_user_validation_preferences_timestamp
    BEFORE UPDATE ON user_validation_preferences
    FOR EACH ROW EXECUTE FUNCTION update_validation_timestamp();

CREATE TRIGGER update_pitch_validation_workflows_timestamp
    BEFORE UPDATE ON pitch_validation_workflows
    FOR EACH ROW EXECUTE FUNCTION update_validation_timestamp();

CREATE TRIGGER update_validation_data_sources_timestamp
    BEFORE UPDATE ON validation_data_sources
    FOR EACH ROW EXECUTE FUNCTION update_validation_timestamp();

-- Create views for common analytical queries

-- View for latest validation scores per pitch
CREATE OR REPLACE VIEW latest_pitch_validation_scores AS
SELECT DISTINCT ON (pitch_id) 
    *
FROM pitch_validation_scores
ORDER BY pitch_id, analyzed_at DESC;

-- View for validation performance summary
CREATE OR REPLACE VIEW validation_performance_summary AS
SELECT 
    pitch_id,
    COUNT(*) as total_analyses,
    MAX(overall_score) as best_score,
    MIN(overall_score) as worst_score,
    AVG(overall_score)::INTEGER as average_score,
    MAX(analyzed_at) as last_analyzed,
    COUNT(DISTINCT CASE WHEN overall_score >= 80 THEN analyzed_at END) as excellent_scores,
    COUNT(DISTINCT CASE WHEN overall_score >= 60 AND overall_score < 80 THEN analyzed_at END) as good_scores,
    COUNT(DISTINCT CASE WHEN overall_score < 60 THEN analyzed_at END) as poor_scores
FROM pitch_validation_scores
GROUP BY pitch_id;

-- View for recommendation implementation tracking
CREATE OR REPLACE VIEW recommendation_implementation_stats AS
SELECT 
    pitch_id,
    category,
    COUNT(*) as total_recommendations,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as implemented_count,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    AVG(estimated_impact)::INTEGER as avg_estimated_impact,
    AVG(CASE WHEN status = 'completed' THEN result_impact END)::INTEGER as avg_actual_impact
FROM pitch_validation_recommendations
GROUP BY pitch_id, category;

-- View for genre performance analytics
CREATE OR REPLACE VIEW genre_validation_performance AS
SELECT 
    p.genre,
    COUNT(*) as total_pitches,
    AVG(pvs.overall_score)::INTEGER as avg_overall_score,
    AVG((pvs.story_score->>'score')::INTEGER)::INTEGER as avg_story_score,
    AVG((pvs.market_score->>'score')::INTEGER)::INTEGER as avg_market_score,
    AVG((pvs.finance_score->>'score')::INTEGER)::INTEGER as avg_finance_score,
    AVG((pvs.team_score->>'score')::INTEGER)::INTEGER as avg_team_score,
    AVG((pvs.production_score->>'score')::INTEGER)::INTEGER as avg_production_score,
    COUNT(CASE WHEN pvs.overall_score >= 80 THEN 1 END) as excellent_count,
    COUNT(CASE WHEN pvs.overall_score >= 60 AND pvs.overall_score < 80 THEN 1 END) as good_count,
    COUNT(CASE WHEN pvs.overall_score < 60 THEN 1 END) as needs_improvement_count
FROM pitches p
JOIN latest_pitch_validation_scores pvs ON p.id = pvs.pitch_id
GROUP BY p.genre;

-- Grant appropriate permissions (adjust based on your user roles)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pitchey_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pitchey_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO pitchey_app;