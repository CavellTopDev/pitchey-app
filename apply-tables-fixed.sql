-- Fixed migration for Neon database with integer IDs
-- Creates essential tables for Creator and Production portals

-- Contracts table for Creator Portal
CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('investment', 'production', 'distribution', 'licensing', 'other')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'negotiation', 'active', 'completed', 'terminated', 'expired')),
  counterparty_name VARCHAR(255) NOT NULL,
  counterparty_type VARCHAR(50) CHECK (counterparty_type IN ('investor', 'production_company', 'distributor', 'platform', 'other')),
  counterparty_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  value DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  payment_terms TEXT,
  deliverables JSONB,
  milestones JSONB,
  contract_url TEXT,
  signed_date TIMESTAMP,
  signed_by JSONB,
  notes TEXT,
  tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contract milestones
CREATE TABLE IF NOT EXISTS contract_milestones (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  payment_amount DECIMAL(12, 2),
  payment_status VARCHAR(50),
  deliverables JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Revenue tracking
CREATE TABLE IF NOT EXISTS creator_revenue (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_id INTEGER,
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

-- Production companies
CREATE TABLE IF NOT EXISTS production_companies (
  id SERIAL PRIMARY KEY,
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

-- Production projects
CREATE TABLE IF NOT EXISTS production_projects (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES production_companies(id) ON DELETE CASCADE,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'development',
  start_date DATE,
  end_date DATE,
  shooting_start_date DATE,
  shooting_end_date DATE,
  release_date DATE,
  budget DECIMAL(12, 2),
  actual_budget DECIMAL(12, 2),
  budget_currency VARCHAR(3) DEFAULT 'USD',
  director VARCHAR(255),
  producer VARCHAR(255),
  cinematographer VARCHAR(255),
  synopsis TEXT,
  shooting_locations TEXT[],
  distribution_plan TEXT,
  target_audience TEXT,
  completion_percentage INTEGER DEFAULT 0,
  quality_score INTEGER,
  on_time BOOLEAN,
  on_budget BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Production talent
CREATE TABLE IF NOT EXISTS production_talent (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES production_companies(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  stage_name VARCHAR(200),
  talent_type VARCHAR(50) NOT NULL,
  union_affiliations TEXT[],
  representation VARCHAR(255),
  day_rate DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  availability_status VARCHAR(50) DEFAULT 'available',
  resume_url TEXT,
  reel_url TEXT,
  portfolio_url TEXT,
  imdb_url TEXT,
  skills TEXT[],
  languages TEXT[],
  accents TEXT[],
  age_range VARCHAR(20),
  height VARCHAR(20),
  location VARCHAR(255),
  willing_to_travel BOOLEAN DEFAULT TRUE,
  rating DECIMAL(3, 2),
  years_experience INTEGER,
  credits_count INTEGER,
  awards JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Production crew
CREATE TABLE IF NOT EXISTS production_crew (
  id SERIAL PRIMARY KEY,
  crew_member_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES production_companies(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  position VARCHAR(200) NOT NULL,
  union_member BOOLEAN DEFAULT FALSE,
  union_number VARCHAR(100),
  day_rate DECIMAL(10, 2),
  kit_rental_rate DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  availability_status VARCHAR(50) DEFAULT 'available',
  current_project VARCHAR(255),
  available_from DATE,
  years_experience INTEGER,
  specialties TEXT[],
  equipment_owned TEXT[],
  software_proficiency TEXT[],
  email VARCHAR(255),
  phone VARCHAR(50),
  location VARCHAR(255),
  willing_to_travel BOOLEAN DEFAULT TRUE,
  passport_valid BOOLEAN,
  resume_url TEXT,
  portfolio_url TEXT,
  references JSONB,
  rating DECIMAL(3, 2),
  completed_projects INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Location scouts
CREATE TABLE IF NOT EXISTS location_scouts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES production_companies(id) ON DELETE CASCADE,
  scouted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state_province VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  availability_status VARCHAR(50) DEFAULT 'available',
  daily_rate DECIMAL(10, 2),
  weekly_rate DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  min_rental_days INTEGER DEFAULT 1,
  square_footage INTEGER,
  parking_spaces INTEGER,
  power_available BOOLEAN DEFAULT TRUE,
  restrooms INTEGER,
  kitchen_available BOOLEAN,
  green_room BOOLEAN,
  wifi_available BOOLEAN,
  noise_restrictions TEXT,
  time_restrictions TEXT,
  permit_required BOOLEAN DEFAULT TRUE,
  insurance_required BOOLEAN DEFAULT TRUE,
  photos JSONB,
  virtual_tour_url TEXT,
  floor_plan_url TEXT,
  owner_name VARCHAR(255),
  owner_phone VARCHAR(50),
  owner_email VARCHAR(255),
  tags TEXT[],
  notes TEXT,
  rating DECIMAL(3, 2),
  times_booked INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Production budgets
CREATE TABLE IF NOT EXISTS production_budgets (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES production_projects(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  description TEXT,
  budgeted_amount DECIMAL(12, 2) NOT NULL,
  actual_amount DECIMAL(12, 2),
  notes TEXT,
  approved_by INTEGER REFERENCES users(id),
  approved_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Production schedules
CREATE TABLE IF NOT EXISTS production_schedules (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES production_projects(id) ON DELETE CASCADE,
  scene_number VARCHAR(20),
  scene_description TEXT,
  location_id INTEGER REFERENCES location_scouts(id),
  scheduled_date DATE NOT NULL,
  call_time TIME,
  wrap_time TIME,
  status VARCHAR(50) DEFAULT 'scheduled',
  cast_required JSONB,
  crew_required JSONB,
  equipment_needed TEXT[],
  special_requirements TEXT,
  weather_dependent BOOLEAN DEFAULT FALSE,
  backup_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Engagement tracking tables
CREATE TABLE IF NOT EXISTS pitch_views (
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT NOW(),
  view_count INTEGER DEFAULT 1,
  watch_duration INTEGER,
  source VARCHAR(50),
  PRIMARY KEY (pitch_id, user_id)
);

CREATE TABLE IF NOT EXISTS pitch_likes (
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (pitch_id, user_id)
);

CREATE TABLE IF NOT EXISTS pitch_shares (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_pitches (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  saved_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (user_id, pitch_id)
);

CREATE TABLE IF NOT EXISTS user_activity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  activity_date DATE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, activity_type, activity_date)
);

CREATE TABLE IF NOT EXISTS search_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  search_query TEXT NOT NULL,
  result_count INTEGER,
  filters JSONB,
  clicked_results JSONB,
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS page_views (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  country VARCHAR(2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES production_projects(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK ((pitch_id IS NOT NULL AND project_id IS NULL) OR (pitch_id IS NULL AND project_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS investment_interests (
  id SERIAL PRIMARY KEY,
  investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  interest_level VARCHAR(50),
  amount_interested DECIMAL(12, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(investor_id, pitch_id)
);

CREATE TABLE IF NOT EXISTS production_interests (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES production_companies(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  interest_level VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, pitch_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contracts_creator_id ON contracts(creator_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_production_projects_company ON production_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_production_talent_type ON production_talent(talent_type);
CREATE INDEX IF NOT EXISTS idx_production_crew_department ON production_crew(department);
CREATE INDEX IF NOT EXISTS idx_location_scouts_type ON location_scouts(type);
CREATE INDEX IF NOT EXISTS idx_pitch_views_pitch ON pitch_views(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_likes_pitch ON pitch_likes(pitch_id);
CREATE INDEX IF NOT EXISTS idx_saved_pitches_user ON saved_pitches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_date ON user_activity(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_search_logs_user ON search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_pitch ON reviews(pitch_id);