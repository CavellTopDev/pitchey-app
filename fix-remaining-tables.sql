-- Fix production_crew table - remove incorrect 'references' keyword
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
  references_data JSONB,  -- Fixed: renamed from 'references' which is a reserved word
  rating DECIMAL(3, 2),
  completed_projects INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Fix production_interests table - production_companies.id is INTEGER
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

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_production_crew_department ON production_crew(department);

-- Verify all tables were created
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'contracts', 'contract_milestones', 'creator_revenue',
  'production_companies', 'production_projects', 'production_talent',
  'production_crew', 'location_scouts', 'production_budgets',
  'production_schedules'
)
ORDER BY tablename;