-- Migration: Create investor portal tables
-- Created: 2024-12-21

-- 1. Budget Allocations Table
CREATE TABLE IF NOT EXISTS budget_allocations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  allocated_amount DECIMAL(15, 2) NOT NULL,
  spent_amount DECIMAL(15, 2) DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, category, period_start)
);

-- 2. Investment Deals Table
CREATE TABLE IF NOT EXISTS investment_deals (
  id SERIAL PRIMARY KEY,
  investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'negotiating',
  proposed_amount DECIMAL(15, 2) NOT NULL,
  final_amount DECIMAL(15, 2),
  terms TEXT,
  notes TEXT,
  negotiation_started_at TIMESTAMP DEFAULT NOW(),
  deal_closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (status IN ('negotiating', 'pending', 'due_diligence', 'approved', 'rejected', 'completed'))
);

-- 3. Completed Projects Table
CREATE TABLE IF NOT EXISTS completed_projects (
  id SERIAL PRIMARY KEY,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL,
  final_return DECIMAL(15, 2) NOT NULL,
  revenue_breakdown JSONB,
  distribution_status VARCHAR(50) DEFAULT 'pending-release',
  awards TEXT[],
  rating DECIMAL(3, 2),
  synopsis TEXT,
  market_performance VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (distribution_status IN ('released', 'in-distribution', 'pending-release')),
  CHECK (market_performance IN ('exceeded', 'met', 'below', 'pending'))
);

-- 4. Investment Performance Table
CREATE TABLE IF NOT EXISTS investment_performance (
  id SERIAL PRIMARY KEY,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  initial_investment DECIMAL(15, 2) NOT NULL,
  current_value DECIMAL(15, 2) NOT NULL,
  roi DECIMAL(10, 2),
  category VARCHAR(100),
  risk_level VARCHAR(20),
  performance_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (risk_level IN ('low', 'medium', 'high', 'very-high'))
);

-- 5. Tax Documents Table
CREATE TABLE IF NOT EXISTS tax_documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  tax_year INTEGER NOT NULL,
  file_url TEXT,
  file_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'processing',
  generated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (status IN ('available', 'processing', 'archived'))
);

-- 6. Market Data Table
CREATE TABLE IF NOT EXISTS market_data (
  id SERIAL PRIMARY KEY,
  genre VARCHAR(100) NOT NULL,
  avg_roi DECIMAL(10, 2),
  total_projects INTEGER,
  avg_budget DECIMAL(15, 2),
  success_rate DECIMAL(5, 2),
  trend VARCHAR(20),
  data_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (trend IN ('up', 'down', 'stable'))
);

-- 7. Investment Risk Analysis Table
CREATE TABLE IF NOT EXISTS investment_risk_analysis (
  id SERIAL PRIMARY KEY,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  risk_score DECIMAL(5, 2) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  risk_factors JSONB,
  mitigation_notes TEXT,
  amount_at_risk DECIMAL(15, 2),
  analysis_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (risk_level IN ('low', 'medium', 'high', 'very-high'))
);

-- 8. Financial Transactions (extend existing or create new)
CREATE TABLE IF NOT EXISTS financial_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  amount DECIMAL(15, 2) NOT NULL,
  balance_after DECIMAL(15, 2),
  description TEXT,
  reference_type VARCHAR(50),
  reference_id INTEGER,
  status VARCHAR(50) DEFAULT 'completed',
  tax_year INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (type IN ('deposit', 'withdrawal', 'investment', 'return', 'fee', 'refund')),
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed'))
);

-- Indexes for performance
CREATE INDEX idx_budget_allocations_user_period ON budget_allocations(user_id, period_start);
CREATE INDEX idx_investment_deals_investor ON investment_deals(investor_id);
CREATE INDEX idx_investment_deals_status ON investment_deals(status);
CREATE INDEX idx_completed_projects_investment ON completed_projects(investment_id);
CREATE INDEX idx_investment_performance_user ON investment_performance(user_id);
CREATE INDEX idx_investment_performance_date ON investment_performance(user_id, performance_date);
CREATE INDEX idx_tax_documents_user_year ON tax_documents(user_id, tax_year);
CREATE INDEX idx_market_data_genre_date ON market_data(genre, data_date);
CREATE INDEX idx_risk_analysis_user ON investment_risk_analysis(user_id);
CREATE INDEX idx_financial_transactions_user ON financial_transactions(user_id, created_at DESC);
CREATE INDEX idx_financial_transactions_type ON financial_transactions(type, status);

-- Add missing columns to existing tables
ALTER TABLE investments ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE investments ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS investor_profile JSONB DEFAULT '{}';

-- Create views for common queries
CREATE OR REPLACE VIEW investor_portfolio_summary AS
SELECT 
  u.id as user_id,
  COUNT(DISTINCT i.id) as total_investments,
  SUM(i.amount) as total_invested,
  AVG(ip.roi) as average_roi,
  COUNT(DISTINCT CASE WHEN ip.roi > 0 THEN i.id END) as profitable_investments,
  COUNT(DISTINCT id.id) as pending_deals
FROM users u
LEFT JOIN investments i ON u.id = i.user_id
LEFT JOIN investment_performance ip ON i.id = ip.investment_id
LEFT JOIN investment_deals id ON u.id = id.investor_id AND id.status IN ('negotiating', 'pending', 'due_diligence')
GROUP BY u.id;

CREATE OR REPLACE VIEW financial_summary AS
SELECT 
  user_id,
  SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as total_deposits,
  SUM(CASE WHEN type = 'investment' THEN amount ELSE 0 END) as total_investments,
  SUM(CASE WHEN type = 'return' THEN amount ELSE 0 END) as total_returns,
  SUM(CASE WHEN type IN ('deposit', 'return', 'refund') THEN amount 
           WHEN type IN ('investment', 'withdrawal', 'fee') THEN -amount 
           ELSE 0 END) as current_balance
FROM financial_transactions
WHERE status = 'completed'
GROUP BY user_id;