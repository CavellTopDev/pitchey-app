-- Migration: Creator and Production Portal Tables
-- Description: Adds comprehensive tables for Creator contracts, Production projects, and engagement tracking
-- Date: 2024-12-27

-- ============================================
-- CREATOR PORTAL TABLES
-- ============================================

-- Contracts table for Creator Portal
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('investment', 'production', 'distribution', 'licensing', 'other')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'negotiation', 'active', 'completed', 'terminated', 'expired')),
  counterparty_name VARCHAR(255) NOT NULL,
  counterparty_type VARCHAR(50) CHECK (counterparty_type IN ('investor', 'production_company', 'distributor', 'platform', 'other')),
  counterparty_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Contract details
  start_date DATE,
  end_date DATE,
  value DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  payment_terms TEXT,
  deliverables JSONB,
  milestones JSONB,
  
  -- Documents
  contract_url TEXT,
  signed_date TIMESTAMP,
  signed_by JSONB, -- Array of signatories
  
  -- Metadata
  notes TEXT,
  tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contract milestones tracking
CREATE TABLE IF NOT EXISTS contract_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed_date DATE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
  payment_amount DECIMAL(12, 2),
  payment_status VARCHAR(50) CHECK (payment_status IN ('pending', 'invoiced', 'paid', 'overdue')),
  deliverables JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Revenue tracking for creators
CREATE TABLE IF NOT EXISTS creator_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('investment', 'contract', 'royalty', 'licensing', 'merchandise', 'crowdfunding', 'other')),
  source_id UUID, -- Reference to contract, investment, etc.
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  received_date DATE NOT NULL,
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  description TEXT,
  tax_withheld DECIMAL(12, 2),
  net_amount DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PRODUCTION PORTAL TABLES
-- ============================================

-- Production companies table
CREATE TABLE IF NOT EXISTS production_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  website VARCHAR(255),
  description TEXT,
  specialties TEXT[],
  founded_year INTEGER,
  company_size VARCHAR(50),
  location VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  social_links JSONB,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Production projects table
CREATE TABLE IF NOT EXISTS production_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES production_companies(id) ON DELETE CASCADE,
  pitch_id UUID REFERENCES pitches(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('feature', 'series', 'documentary', 'short', 'commercial', 'music_video')),
  status VARCHAR(50) NOT NULL DEFAULT 'development' CHECK (status IN ('development', 'pre_production', 'production', 'post_production', 'completed', 'on_hold', 'cancelled')),
  
  -- Timeline
  start_date DATE,
  end_date DATE,
  shooting_start_date DATE,
  shooting_end_date DATE,
  release_date DATE,
  
  -- Budget
  budget DECIMAL(12, 2),
  actual_budget DECIMAL(12, 2),
  budget_currency VARCHAR(3) DEFAULT 'USD',
  
  -- Team
  director VARCHAR(255),
  producer VARCHAR(255),
  cinematographer VARCHAR(255),
  
  -- Details
  synopsis TEXT,
  shooting_locations TEXT[],
  distribution_plan TEXT,
  target_audience TEXT,
  
  -- Metrics
  completion_percentage INTEGER DEFAULT 0,
  quality_score INTEGER,
  on_time BOOLEAN,
  on_budget BOOLEAN,
  
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Production talent pool
CREATE TABLE IF NOT EXISTS production_talent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES production_companies(id) ON DELETE CASCADE,
  
  -- Basic info
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  stage_name VARCHAR(200),
  talent_type VARCHAR(50) NOT NULL CHECK (talent_type IN ('actor', 'director', 'writer', 'producer', 'cinematographer', 'editor', 'composer', 'other')),
  
  -- Professional info
  union_affiliations TEXT[],
  representation VARCHAR(255),
  day_rate DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  availability_status VARCHAR(50) DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'on_project', 'unavailable')),
  
  -- Portfolio
  resume_url TEXT,
  reel_url TEXT,
  portfolio_url TEXT,
  imdb_url TEXT,
  
  -- Skills and attributes
  skills TEXT[],
  languages TEXT[],
  accents TEXT[],
  age_range VARCHAR(20),
  height VARCHAR(20),
  location VARCHAR(255),
  willing_to_travel BOOLEAN DEFAULT TRUE,
  
  -- Ratings and experience
  rating DECIMAL(3, 2),
  years_experience INTEGER,
  credits_count INTEGER,
  awards JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Production crew database
CREATE TABLE IF NOT EXISTS production_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_member_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES production_companies(id) ON DELETE CASCADE,
  
  -- Basic info
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL CHECK (department IN ('camera', 'lighting', 'sound', 'art', 'costume', 'makeup', 'production', 'post_production', 'vfx', 'stunts', 'other')),
  position VARCHAR(200) NOT NULL,
  
  -- Professional info
  union_member BOOLEAN DEFAULT FALSE,
  union_number VARCHAR(100),
  day_rate DECIMAL(10, 2),
  kit_rental_rate DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Availability
  availability_status VARCHAR(50) DEFAULT 'available',
  current_project VARCHAR(255),
  available_from DATE,
  
  -- Experience
  years_experience INTEGER,
  specialties TEXT[],
  equipment_owned TEXT[],
  software_proficiency TEXT[],
  
  -- Contact and location
  email VARCHAR(255),
  phone VARCHAR(50),
  location VARCHAR(255),
  willing_to_travel BOOLEAN DEFAULT TRUE,
  passport_valid BOOLEAN,
  
  -- Portfolio
  resume_url TEXT,
  portfolio_url TEXT,
  references JSONB,
  
  -- Ratings
  rating DECIMAL(3, 2),
  completed_projects INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Location scouts database
CREATE TABLE IF NOT EXISTS location_scouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES production_companies(id) ON DELETE CASCADE,
  scouted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Location details
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL CHECK (type IN ('studio', 'house', 'office', 'warehouse', 'outdoor', 'historical', 'commercial', 'residential', 'industrial', 'natural', 'other')),
  address TEXT NOT NULL,
  city VARCHAR(100),
  state_province VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Availability and pricing
  availability_status VARCHAR(50) DEFAULT 'available',
  daily_rate DECIMAL(10, 2),
  weekly_rate DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  min_rental_days INTEGER DEFAULT 1,
  
  -- Features
  square_footage INTEGER,
  parking_spaces INTEGER,
  power_available BOOLEAN DEFAULT TRUE,
  restrooms INTEGER,
  kitchen_available BOOLEAN,
  green_room BOOLEAN,
  wifi_available BOOLEAN,
  
  -- Restrictions
  noise_restrictions TEXT,
  time_restrictions TEXT,
  permit_required BOOLEAN DEFAULT TRUE,
  insurance_required BOOLEAN DEFAULT TRUE,
  
  -- Media
  photos JSONB, -- Array of photo URLs
  virtual_tour_url TEXT,
  floor_plan_url TEXT,
  
  -- Contact
  owner_name VARCHAR(255),
  owner_phone VARCHAR(50),
  owner_email VARCHAR(255),
  
  -- Metadata
  tags TEXT[],
  notes TEXT,
  rating DECIMAL(3, 2),
  times_booked INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Production budget breakdown
CREATE TABLE IF NOT EXISTS production_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES production_projects(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  description TEXT,
  budgeted_amount DECIMAL(12, 2) NOT NULL,
  actual_amount DECIMAL(12, 2),
  variance DECIMAL(12, 2) GENERATED ALWAYS AS (actual_amount - budgeted_amount) STORED,
  variance_percentage DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE WHEN budgeted_amount > 0 
    THEN ((actual_amount - budgeted_amount) / budgeted_amount * 100)
    ELSE 0 END
  ) STORED,
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Production schedule
CREATE TABLE IF NOT EXISTS production_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES production_projects(id) ON DELETE CASCADE,
  scene_number VARCHAR(20),
  scene_description TEXT,
  location_id UUID REFERENCES location_scouts(id),
  scheduled_date DATE NOT NULL,
  call_time TIME,
  wrap_time TIME,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled')),
  
  -- Cast and crew
  cast_required JSONB, -- Array of talent IDs
  crew_required JSONB, -- Array of crew IDs
  
  -- Equipment
  equipment_needed TEXT[],
  special_requirements TEXT,
  
  -- Weather and conditions
  weather_dependent BOOLEAN DEFAULT FALSE,
  backup_date DATE,
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ENGAGEMENT AND ANALYTICS TABLES
-- ============================================

-- Pitch views tracking
CREATE TABLE IF NOT EXISTS pitch_views (
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT NOW(),
  view_count INTEGER DEFAULT 1,
  watch_duration INTEGER, -- in seconds
  source VARCHAR(50), -- 'browse', 'search', 'direct', 'shared'
  PRIMARY KEY (pitch_id, user_id)
);

-- Pitch likes
CREATE TABLE IF NOT EXISTS pitch_likes (
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (pitch_id, user_id)
);

-- Pitch shares tracking
CREATE TABLE IF NOT EXISTS pitch_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50), -- 'twitter', 'facebook', 'linkedin', 'email', 'copy_link'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Saved pitches (bookmarks)
CREATE TABLE IF NOT EXISTS saved_pitches (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  saved_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (user_id, pitch_id)
);

-- User activity tracking
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  activity_date DATE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, activity_type, activity_date)
);

-- Search logs for analytics
CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  search_query TEXT NOT NULL,
  result_count INTEGER,
  filters JSONB,
  clicked_results JSONB,
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Page views for analytics
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  country VARCHAR(2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reviews and ratings
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  project_id UUID REFERENCES production_projects(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK ((pitch_id IS NOT NULL AND project_id IS NULL) OR (pitch_id IS NULL AND project_id IS NOT NULL))
);

-- Investment interests tracking
CREATE TABLE IF NOT EXISTS investment_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  interest_level VARCHAR(50) CHECK (interest_level IN ('low', 'medium', 'high', 'committed')),
  amount_interested DECIMAL(12, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(investor_id, pitch_id)
);

-- Production interests tracking
CREATE TABLE IF NOT EXISTS production_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES production_companies(id) ON DELETE CASCADE,
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  interest_level VARCHAR(50) CHECK (interest_level IN ('considering', 'evaluating', 'negotiating', 'committed')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, pitch_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Contracts indexes
CREATE INDEX idx_contracts_creator_id ON contracts(creator_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_dates ON contracts(start_date, end_date);
CREATE INDEX idx_contract_milestones_contract ON contract_milestones(contract_id);
CREATE INDEX idx_contract_milestones_status ON contract_milestones(status);
CREATE INDEX idx_creator_revenue_creator ON creator_revenue(creator_id);
CREATE INDEX idx_creator_revenue_date ON creator_revenue(received_date);

-- Production indexes
CREATE INDEX idx_production_projects_company ON production_projects(company_id);
CREATE INDEX idx_production_projects_status ON production_projects(status);
CREATE INDEX idx_production_talent_type ON production_talent(talent_type);
CREATE INDEX idx_production_talent_availability ON production_talent(availability_status);
CREATE INDEX idx_production_crew_department ON production_crew(department);
CREATE INDEX idx_production_crew_availability ON production_crew(availability_status);
CREATE INDEX idx_location_scouts_type ON location_scouts(type);
CREATE INDEX idx_location_scouts_location ON location_scouts(city, state_province);
CREATE INDEX idx_production_budgets_project ON production_budgets(project_id);
CREATE INDEX idx_production_schedules_project ON production_schedules(project_id);
CREATE INDEX idx_production_schedules_date ON production_schedules(scheduled_date);

-- Engagement indexes
CREATE INDEX idx_pitch_views_pitch ON pitch_views(pitch_id);
CREATE INDEX idx_pitch_views_user ON pitch_views(user_id);
CREATE INDEX idx_pitch_views_date ON pitch_views(viewed_at);
CREATE INDEX idx_pitch_likes_pitch ON pitch_likes(pitch_id);
CREATE INDEX idx_pitch_shares_pitch ON pitch_shares(pitch_id);
CREATE INDEX idx_saved_pitches_user ON saved_pitches(user_id);
CREATE INDEX idx_user_activity_user_date ON user_activity(user_id, activity_date);
CREATE INDEX idx_search_logs_user ON search_logs(user_id);
CREATE INDEX idx_search_logs_date ON search_logs(created_at);
CREATE INDEX idx_page_views_session ON page_views(session_id);
CREATE INDEX idx_reviews_pitch ON reviews(pitch_id);
CREATE INDEX idx_reviews_project ON reviews(project_id);

-- Full text search indexes
CREATE INDEX idx_production_talent_search ON production_talent USING gin(to_tsvector('english', 
  COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(stage_name, '')));
CREATE INDEX idx_location_scouts_search ON location_scouts USING gin(to_tsvector('english', 
  COALESCE(name, '') || ' ' || COALESCE(type, '') || ' ' || COALESCE(city, '')));

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contract_milestones_updated_at BEFORE UPDATE ON contract_milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_companies_updated_at BEFORE UPDATE ON production_companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_projects_updated_at BEFORE UPDATE ON production_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_talent_updated_at BEFORE UPDATE ON production_talent
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_crew_updated_at BEFORE UPDATE ON production_crew
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_scouts_updated_at BEFORE UPDATE ON location_scouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_budgets_updated_at BEFORE UPDATE ON production_budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_schedules_updated_at BEFORE UPDATE ON production_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();