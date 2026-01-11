-- Migration: Crawl4AI Intelligence Layer
-- Description: Database schema for intelligent data enrichment, market analysis, and competitive intelligence
-- Date: 2025-01-10

-- ============================================
-- PITCH ENRICHMENT TABLES
-- ============================================

-- Store enriched industry data for pitches
CREATE TABLE IF NOT EXISTS pitch_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  enrichment_type VARCHAR(50) NOT NULL CHECK (enrichment_type IN ('industry_data', 'market_analysis', 'competitive_analysis')),
  
  -- Enrichment data
  comparable_movies JSONB, -- Array of comparable movies with performance data
  market_analysis JSONB,   -- Genre trends, seasonal analysis, audience demographics
  success_prediction JSONB, -- AI-powered success prediction with confidence scores
  competitive_landscape JSONB, -- Similar projects in development/production
  
  -- Metadata
  data_source VARCHAR(100), -- 'imdb', 'boxofficemojo', 'variety', etc.
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  last_updated TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  -- Cache control
  cache_key VARCHAR(255) UNIQUE,
  cache_ttl INTEGER DEFAULT 3600, -- TTL in seconds
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(pitch_id, enrichment_type)
);

-- Store crawled industry intelligence data
CREATE TABLE IF NOT EXISTS market_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intelligence_type VARCHAR(50) NOT NULL CHECK (intelligence_type IN ('news', 'box_office', 'trends', 'opportunities', 'alerts')),
  
  -- Content data
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  source_url TEXT,
  source_name VARCHAR(100),
  
  -- Categorization
  category VARCHAR(50), -- 'investment', 'production', 'distribution', 'technology', etc.
  tags TEXT[],
  genre_relevance TEXT[], -- Which genres this intelligence relates to
  
  -- Scoring and ranking
  relevance_score DECIMAL(3,2) CHECK (relevance_score >= 0 AND relevance_score <= 1),
  impact_score INTEGER CHECK (impact_score >= 1 AND impact_score <= 10),
  urgency_level VARCHAR(20) CHECK (urgency_level IN ('low', 'medium', 'high', 'critical')),
  
  -- Temporal data
  published_date TIMESTAMP,
  extracted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Store similar project analysis results
CREATE TABLE IF NOT EXISTS similar_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  
  -- Similar project data
  similar_title VARCHAR(500) NOT NULL,
  similar_year INTEGER,
  similar_genre VARCHAR(100),
  similarity_score DECIMAL(3,2) CHECK (similarity_score >= 0 AND similarity_score <= 1),
  
  -- Performance data
  budget BIGINT,
  domestic_gross BIGINT,
  international_gross BIGINT,
  total_gross BIGINT,
  profit_margin DECIMAL(5,2),
  
  -- Additional metrics
  rating DECIMAL(3,1),
  vote_count INTEGER,
  runtime_minutes INTEGER,
  
  -- Comparison points
  shared_themes TEXT[],
  shared_genres TEXT[],
  comparison_notes TEXT,
  
  -- Source tracking
  data_source VARCHAR(100),
  source_url TEXT,
  imdb_id VARCHAR(20),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Store talent verification results
CREATE TABLE IF NOT EXISTS talent_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_name VARCHAR(255) NOT NULL,
  talent_role VARCHAR(50) NOT NULL CHECK (talent_role IN ('actor', 'director', 'writer', 'producer', 'cinematographer', 'composer', 'other')),
  
  -- Verification status
  verified BOOLEAN DEFAULT FALSE,
  verification_confidence DECIMAL(3,2) CHECK (verification_confidence >= 0 AND verification_confidence <= 1),
  verification_source VARCHAR(100),
  
  -- Professional data
  imdb_id VARCHAR(20),
  imdb_url TEXT,
  filmography JSONB, -- Array of film credits
  awards JSONB,      -- Array of awards and nominations
  
  -- Representation
  agency VARCHAR(255),
  agent VARCHAR(255),
  manager VARCHAR(255),
  
  -- Market value estimation
  estimated_quote_min DECIMAL(12,2),
  estimated_quote_max DECIMAL(12,2),
  market_tier VARCHAR(20) CHECK (market_tier IN ('A-list', 'B-list', 'emerging', 'unknown')),
  recent_activity_score INTEGER,
  
  -- Metadata
  last_verified TIMESTAMP DEFAULT NOW(),
  verification_expires TIMESTAMP,
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(talent_name, talent_role)
);

-- Store production company verification
CREATE TABLE IF NOT EXISTS company_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  
  -- Verification status
  exists BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  verification_confidence DECIMAL(3,2),
  
  -- Company data
  founded_year INTEGER,
  headquarters VARCHAR(255),
  website VARCHAR(500),
  company_size VARCHAR(50),
  
  -- Track record
  total_productions INTEGER DEFAULT 0,
  successful_productions INTEGER DEFAULT 0,
  average_budget DECIMAL(15,2),
  total_gross DECIMAL(15,2),
  success_rate DECIMAL(3,2),
  
  -- Recent projects
  recent_projects JSONB,
  key_personnel JSONB,
  
  -- Industry standing
  guild_member BOOLEAN DEFAULT FALSE,
  guild_affiliations TEXT[],
  industry_reputation_score INTEGER CHECK (industry_reputation_score >= 1 AND industry_reputation_score <= 10),
  
  -- Financial indicators
  financial_stability VARCHAR(20) CHECK (financial_stability IN ('excellent', 'good', 'fair', 'poor', 'unknown')),
  credit_rating VARCHAR(10),
  
  -- Verification metadata
  verification_sources TEXT[],
  last_verified TIMESTAMP DEFAULT NOW(),
  verification_expires TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_name)
);

-- Store competitive analysis data
CREATE TABLE IF NOT EXISTS competitive_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('feature_comparison', 'pricing_analysis', 'market_positioning', 'swot_analysis')),
  
  -- Competitor data
  competitor_name VARCHAR(255) NOT NULL,
  competitor_url VARCHAR(500),
  competitor_focus TEXT,
  
  -- Analysis results
  features JSONB,           -- Array of features offered
  pricing_model JSONB,      -- Pricing structure and plans
  market_position JSONB,    -- Market ranking and metrics
  swot_analysis JSONB,      -- Strengths, weaknesses, opportunities, threats
  
  -- Scoring
  feature_coverage_score INTEGER CHECK (feature_coverage_score >= 0 AND feature_coverage_score <= 100),
  pricing_competitiveness INTEGER CHECK (pricing_competitiveness >= 0 AND pricing_competitiveness <= 100),
  market_strength INTEGER CHECK (market_strength >= 0 AND market_strength <= 100),
  
  -- Recommendations
  recommendations TEXT[],
  opportunities TEXT[],
  threats TEXT[],
  
  -- Analysis metadata
  analysis_date DATE DEFAULT CURRENT_DATE,
  next_analysis_date DATE,
  analysis_version INTEGER DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(competitor_name, analysis_type, analysis_date)
);

-- Store trend analysis results
CREATE TABLE IF NOT EXISTS trend_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_type VARCHAR(50) NOT NULL CHECK (trend_type IN ('genre', 'format', 'budget_range', 'platform', 'audience', 'technology')),
  trend_name VARCHAR(255) NOT NULL,
  
  -- Trend metrics
  trend_direction VARCHAR(20) CHECK (trend_direction IN ('rising', 'stable', 'falling', 'volatile')),
  trend_strength INTEGER CHECK (trend_strength >= 0 AND trend_strength <= 100),
  momentum_score INTEGER CHECK (momentum_score >= 0 AND momentum_score <= 100),
  
  -- Supporting data
  recent_successes INTEGER DEFAULT 0,
  recent_failures INTEGER DEFAULT 0,
  average_performance DECIMAL(15,2),
  market_share DECIMAL(5,2),
  
  -- Forecasting
  projected_direction VARCHAR(20),
  confidence_interval DECIMAL(5,2),
  factors_driving_trend TEXT[],
  
  -- Time series data
  historical_data JSONB, -- Monthly/quarterly performance data
  analysis_period_start DATE,
  analysis_period_end DATE,
  
  -- Metadata
  data_sources TEXT[],
  methodology TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(trend_type, trend_name, analysis_period_end)
);

-- Store investment opportunity alerts
CREATE TABLE IF NOT EXISTS investment_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_type VARCHAR(50) NOT NULL CHECK (opportunity_type IN ('new_production', 'genre_opportunity', 'talent_availability', 'market_gap', 'acquisition_target')),
  
  -- Opportunity details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  opportunity_source VARCHAR(100), -- News article, analysis, etc.
  source_url TEXT,
  
  -- Scoring
  opportunity_score INTEGER CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
  time_sensitivity VARCHAR(20) CHECK (time_sensitivity IN ('immediate', 'short_term', 'medium_term', 'long_term')),
  
  -- Investment details
  estimated_investment_min DECIMAL(15,2),
  estimated_investment_max DECIMAL(15,2),
  estimated_roi_min DECIMAL(5,2),
  estimated_roi_max DECIMAL(5,2),
  payback_period_months INTEGER,
  
  -- Action items
  recommended_action TEXT,
  next_steps TEXT[],
  key_contacts JSONB,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'evaluating', 'pursuing', 'passed', 'completed')),
  assigned_to UUID REFERENCES users(id),
  
  -- Metadata
  alert_level VARCHAR(20) CHECK (alert_level IN ('info', 'low', 'medium', 'high', 'urgent')),
  expires_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Store crawling job status and monitoring
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('industry_enrichment', 'market_intelligence', 'competitive_analysis', 'content_discovery', 'trend_analysis')),
  job_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (job_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  
  -- Job parameters
  target_url TEXT,
  job_parameters JSONB,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  
  -- Execution tracking
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Results
  results_count INTEGER,
  success_rate DECIMAL(5,2),
  error_message TEXT,
  output_data JSONB,
  
  -- Resource usage
  memory_used_mb INTEGER,
  cpu_time_ms INTEGER,
  network_requests INTEGER,
  cache_hits INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Store cache performance metrics
CREATE TABLE IF NOT EXISTS cache_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_type VARCHAR(50) NOT NULL CHECK (cache_type IN ('redis', 'kv_storage', 'browser_cache', 'database_query')),
  cache_key VARCHAR(255) NOT NULL,
  
  -- Performance metrics
  hit_count INTEGER DEFAULT 0,
  miss_count INTEGER DEFAULT 0,
  hit_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN (hit_count + miss_count) > 0 
    THEN (hit_count::DECIMAL / (hit_count + miss_count) * 100)
    ELSE 0 END
  ) STORED,
  
  -- Size and timing
  avg_size_bytes INTEGER,
  avg_retrieval_time_ms INTEGER,
  total_data_transferred_mb DECIMAL(10,2),
  
  -- Lifecycle
  first_access TIMESTAMP,
  last_access TIMESTAMP DEFAULT NOW(),
  expiry_time TIMESTAMP,
  
  -- Metadata
  associated_pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(cache_type, cache_key)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Pitch enrichment indexes
CREATE INDEX idx_pitch_enrichments_pitch_id ON pitch_enrichments(pitch_id);
CREATE INDEX idx_pitch_enrichments_type ON pitch_enrichments(enrichment_type);
CREATE INDEX idx_pitch_enrichments_updated ON pitch_enrichments(last_updated);
CREATE INDEX idx_pitch_enrichments_cache_key ON pitch_enrichments(cache_key);

-- Market intelligence indexes
CREATE INDEX idx_market_intelligence_type ON market_intelligence(intelligence_type);
CREATE INDEX idx_market_intelligence_category ON market_intelligence(category);
CREATE INDEX idx_market_intelligence_relevance ON market_intelligence(relevance_score DESC);
CREATE INDEX idx_market_intelligence_published ON market_intelligence(published_date DESC);
CREATE INDEX idx_market_intelligence_urgency ON market_intelligence(urgency_level);

-- Similar projects indexes
CREATE INDEX idx_similar_projects_pitch_id ON similar_projects(pitch_id);
CREATE INDEX idx_similar_projects_similarity ON similar_projects(similarity_score DESC);
CREATE INDEX idx_similar_projects_genre ON similar_projects(similar_genre);
CREATE INDEX idx_similar_projects_gross ON similar_projects(total_gross DESC);

-- Talent verification indexes
CREATE INDEX idx_talent_verification_name ON talent_verification(talent_name);
CREATE INDEX idx_talent_verification_role ON talent_verification(talent_role);
CREATE INDEX idx_talent_verification_verified ON talent_verification(verified);
CREATE INDEX idx_talent_verification_tier ON talent_verification(market_tier);

-- Company verification indexes
CREATE INDEX idx_company_verification_name ON company_verification(company_name);
CREATE INDEX idx_company_verification_verified ON company_verification(verified);
CREATE INDEX idx_company_verification_reputation ON company_verification(industry_reputation_score DESC);

-- Competitive analysis indexes
CREATE INDEX idx_competitive_analysis_competitor ON competitive_analysis(competitor_name);
CREATE INDEX idx_competitive_analysis_type ON competitive_analysis(analysis_type);
CREATE INDEX idx_competitive_analysis_date ON competitive_analysis(analysis_date DESC);

-- Trend analysis indexes
CREATE INDEX idx_trend_analysis_type ON trend_analysis(trend_type);
CREATE INDEX idx_trend_analysis_direction ON trend_analysis(trend_direction);
CREATE INDEX idx_trend_analysis_strength ON trend_analysis(trend_strength DESC);
CREATE INDEX idx_trend_analysis_period ON trend_analysis(analysis_period_end DESC);

-- Investment opportunities indexes
CREATE INDEX idx_investment_opportunities_type ON investment_opportunities(opportunity_type);
CREATE INDEX idx_investment_opportunities_score ON investment_opportunities(opportunity_score DESC);
CREATE INDEX idx_investment_opportunities_status ON investment_opportunities(status);
CREATE INDEX idx_investment_opportunities_risk ON investment_opportunities(risk_level);
CREATE INDEX idx_investment_opportunities_alert ON investment_opportunities(alert_level);

-- Crawl jobs indexes
CREATE INDEX idx_crawl_jobs_type ON crawl_jobs(job_type);
CREATE INDEX idx_crawl_jobs_status ON crawl_jobs(job_status);
CREATE INDEX idx_crawl_jobs_created ON crawl_jobs(created_at DESC);
CREATE INDEX idx_crawl_jobs_priority ON crawl_jobs(priority DESC);

-- Cache metrics indexes
CREATE INDEX idx_cache_metrics_type_key ON cache_metrics(cache_type, cache_key);
CREATE INDEX idx_cache_metrics_hit_rate ON cache_metrics(hit_rate DESC);
CREATE INDEX idx_cache_metrics_pitch ON cache_metrics(associated_pitch_id);

-- Full-text search indexes
CREATE INDEX idx_market_intelligence_content_search ON market_intelligence USING gin(to_tsvector('english', 
  COALESCE(title, '') || ' ' || COALESCE(summary, '') || ' ' || COALESCE(content, '')));
CREATE INDEX idx_investment_opportunities_search ON investment_opportunities USING gin(to_tsvector('english', 
  COALESCE(title, '') || ' ' || COALESCE(description, '')));

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_pitch_enrichments_updated_at BEFORE UPDATE ON pitch_enrichments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_talent_verification_updated_at BEFORE UPDATE ON talent_verification
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_verification_updated_at BEFORE UPDATE ON company_verification
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitive_analysis_updated_at BEFORE UPDATE ON competitive_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trend_analysis_updated_at BEFORE UPDATE ON trend_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investment_opportunities_updated_at BEFORE UPDATE ON investment_opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crawl_jobs_updated_at BEFORE UPDATE ON crawl_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cache_metrics_updated_at BEFORE UPDATE ON cache_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS FOR BUSINESS LOGIC
-- ============================================

-- Function to calculate enrichment freshness
CREATE OR REPLACE FUNCTION is_enrichment_fresh(enrichment_id UUID, max_age_hours INTEGER DEFAULT 24)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM pitch_enrichments 
        WHERE id = enrichment_id 
        AND last_updated > NOW() - INTERVAL '1 hour' * max_age_hours
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get trending opportunities
CREATE OR REPLACE FUNCTION get_trending_opportunities(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    opportunity_score INTEGER,
    risk_level VARCHAR(20),
    created_hours_ago INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        io.id,
        io.title,
        io.opportunity_score,
        io.risk_level,
        EXTRACT(EPOCH FROM (NOW() - io.created_at))::INTEGER / 3600
    FROM investment_opportunities io
    WHERE io.status IN ('new', 'investigating')
    AND io.expires_at > NOW()
    ORDER BY io.opportunity_score DESC, io.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate competitive positioning score
CREATE OR REPLACE FUNCTION calculate_competitive_score(pitch_genre VARCHAR, pitch_budget DECIMAL)
RETURNS INTEGER AS $$
DECLARE
    avg_feature_coverage INTEGER;
    pricing_advantage INTEGER;
    market_gap_score INTEGER;
    total_score INTEGER;
BEGIN
    -- Calculate average feature coverage in genre
    SELECT COALESCE(AVG(feature_coverage_score), 50) INTO avg_feature_coverage
    FROM competitive_analysis ca
    WHERE ca.analysis_date >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Calculate pricing advantage (simplified logic)
    pricing_advantage := CASE 
        WHEN pitch_budget < 1000000 THEN 80  -- Low budget advantage
        WHEN pitch_budget < 10000000 THEN 60 -- Medium budget
        WHEN pitch_budget < 50000000 THEN 40 -- High budget
        ELSE 20 -- Very high budget
    END;
    
    -- Calculate market gap (simplified)
    market_gap_score := CASE
        WHEN pitch_genre IN ('horror', 'thriller') THEN 75 -- Underserved genres
        WHEN pitch_genre IN ('action', 'comedy') THEN 45   -- Saturated genres
        ELSE 60 -- Balanced genres
    END;
    
    total_score := (avg_feature_coverage + pricing_advantage + market_gap_score) / 3;
    
    RETURN GREATEST(0, LEAST(100, total_score));
END;
$$ LANGUAGE plpgsql;

-- View for enriched pitch data
CREATE OR REPLACE VIEW enriched_pitches AS
SELECT 
    p.*,
    pe.comparable_movies,
    pe.market_analysis,
    pe.success_prediction,
    pe.confidence_score as enrichment_confidence,
    pe.last_updated as enrichment_updated,
    is_enrichment_fresh(pe.id, 24) as is_fresh,
    calculate_competitive_score(p.genre, CAST(COALESCE(p.budget_range, '0') AS DECIMAL)) as competitive_score
FROM pitches p
LEFT JOIN pitch_enrichments pe ON p.id = pe.pitch_id AND pe.enrichment_type = 'industry_data'
WHERE p.status = 'published';

-- View for intelligence dashboard
CREATE OR REPLACE VIEW intelligence_dashboard AS
SELECT 
    'market_news' as widget_type,
    COUNT(*) as count,
    AVG(relevance_score) as avg_relevance,
    MAX(published_date) as latest_update
FROM market_intelligence 
WHERE intelligence_type = 'news' 
AND published_date >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT 
    'opportunities' as widget_type,
    COUNT(*) as count,
    AVG(opportunity_score) as avg_relevance,
    MAX(created_at) as latest_update
FROM investment_opportunities 
WHERE status IN ('new', 'investigating')
AND expires_at > NOW()

UNION ALL

SELECT 
    'trends' as widget_type,
    COUNT(*) as count,
    AVG(trend_strength) as avg_relevance,
    MAX(updated_at) as latest_update
FROM trend_analysis 
WHERE analysis_period_end >= CURRENT_DATE - INTERVAL '30 days';

-- Create notification triggers for high-value opportunities
CREATE OR REPLACE FUNCTION notify_high_value_opportunity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.opportunity_score >= 80 AND NEW.risk_level IN ('low', 'medium') THEN
        PERFORM pg_notify('high_value_opportunity', 
            json_build_object(
                'id', NEW.id,
                'title', NEW.title,
                'score', NEW.opportunity_score,
                'risk_level', NEW.risk_level,
                'type', NEW.opportunity_type
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_on_opportunity_insert
    AFTER INSERT ON investment_opportunities
    FOR EACH ROW EXECUTE FUNCTION notify_high_value_opportunity();

-- ============================================
-- SEED DATA FOR TESTING
-- ============================================

-- Insert sample competitive analysis data
INSERT INTO competitive_analysis (analysis_type, competitor_name, competitor_url, competitor_focus, features, pricing_model, market_position, swot_analysis, feature_coverage_score, pricing_competitiveness, market_strength, recommendations) VALUES
('feature_comparison', 'Slated', 'https://www.slated.com', 'Film finance marketplace', 
 '["Film financing", "Project tracking", "Investor network", "Analytics", "Distribution support"]'::jsonb,
 '{"plans": [{"name": "Basic", "price": 0}, {"name": "Pro", "price": 99}], "model": "freemium"}'::jsonb,
 '{"alexa_rank": 15000, "market_share": 12, "user_base": "10000+"}'::jsonb,
 '{"strengths": ["Established network", "Strong analytics"], "weaknesses": ["Limited features", "High pricing"], "opportunities": ["AI integration", "Blockchain"], "threats": ["New entrants"]}'::jsonb,
 75, 60, 70, '["Consider AI-powered matching", "Implement competitive pricing", "Expand feature set"]'),
('feature_comparison', 'Stage32', 'https://www.stage32.com', 'Entertainment networking', 
 '["Social networking", "Job board", "Education", "Pitch sessions", "Industry events"]'::jsonb,
 '{"plans": [{"name": "Free", "price": 0}, {"name": "Premium", "price": 19.95}], "model": "freemium"}'::jsonb,
 '{"alexa_rank": 8000, "market_share": 25, "user_base": "50000+"}'::jsonb,
 '{"strengths": ["Large user base", "Educational content"], "weaknesses": ["Poor UX", "Limited financing tools"], "opportunities": ["Better matching", "AI recommendations"], "threats": ["Platform competition"]}'::jsonb,
 60, 80, 85, '["Focus on financing over networking", "Improve user experience", "Add AI features"]');

-- Insert sample trend data
INSERT INTO trend_analysis (trend_type, trend_name, trend_direction, trend_strength, momentum_score, recent_successes, recent_failures, average_performance, market_share, factors_driving_trend, analysis_period_start, analysis_period_end) VALUES
('genre', 'Horror', 'rising', 85, 78, 12, 3, 45000000, 8.5, '["Low production costs", "High ROI", "Streaming demand", "International markets"]', '2024-01-01', '2024-12-31'),
('genre', 'Comedy', 'stable', 65, 55, 8, 6, 38000000, 12.3, '["Established audience", "Streaming platforms", "International appeal"]', '2024-01-01', '2024-12-31'),
('format', 'Limited Series', 'rising', 92, 88, 18, 2, 85000000, 15.7, '["Streaming wars", "Creator flexibility", "Audience appetite", "International co-productions"]', '2024-01-01', '2024-12-31'),
('budget_range', 'Micro Budget (<$1M)', 'rising', 75, 82, 25, 8, 2500000, 5.2, '["Digital distribution", "Social media marketing", "Remote production", "Streaming platforms"]', '2024-01-01', '2024-12-31');

-- Insert sample investment opportunities
INSERT INTO investment_opportunities (opportunity_type, title, description, opportunity_source, opportunity_score, risk_level, time_sensitivity, estimated_investment_min, estimated_investment_max, estimated_roi_min, estimated_roi_max, recommended_action, status, alert_level) VALUES
('genre_opportunity', 'Horror Genre Surge Continues', 'Horror films showing 85% trend strength with low production costs and high ROI potential. Market gap exists for elevated horror concepts.', 'Trend Analysis', 88, 'medium', 'short_term', 500000, 5000000, 150, 400, 'Prioritize horror project acquisitions in Q1 2025', 'new', 'high'),
('new_production', 'Elevated Thriller from Award-Winning Director', 'Established director seeking $8M for psychological thriller with A-list actor attached. Pre-sales indicate strong international interest.', 'Industry Contact', 82, 'low', 'immediate', 8000000, 12000000, 120, 250, 'Schedule meeting with production team', 'investigating', 'medium'),
('market_gap', 'Streaming Platform Original Content Gap', 'Major streaming platform actively seeking diverse content for 2025 slate. Specific interest in sci-fi and international stories.', 'Market Intelligence', 75, 'medium', 'medium_term', 2000000, 15000000, 100, 180, 'Develop pitch package for streaming originals', 'new', 'medium'),
('talent_availability', 'Emmy-Winning Showrunner Available', 'High-profile showrunner completed current series, seeking new project. Strong track record in limited series format.', 'Industry News', 90, 'low', 'immediate', 10000000, 25000000, 140, 300, 'Immediate outreach for project collaboration', 'new', 'urgent');

COMMENT ON TABLE pitch_enrichments IS 'Stores AI-enriched data for pitches including comparables, market analysis, and success predictions';
COMMENT ON TABLE market_intelligence IS 'Real-time market intelligence gathered from industry sources';
COMMENT ON TABLE similar_projects IS 'Analysis of projects similar to submitted pitches';
COMMENT ON TABLE talent_verification IS 'Verification and analysis of attached talent credentials';
COMMENT ON TABLE company_verification IS 'Verification of production companies and their track records';
COMMENT ON TABLE competitive_analysis IS 'Analysis of competitive platforms and market positioning';
COMMENT ON TABLE trend_analysis IS 'Analysis of industry trends across genres, formats, and budgets';
COMMENT ON TABLE investment_opportunities IS 'Identified investment opportunities and market alerts';
COMMENT ON TABLE crawl_jobs IS 'Monitoring and status tracking for data crawling jobs';
COMMENT ON TABLE cache_metrics IS 'Performance metrics for caching systems';