-- Migration: Investment Tracking Tables
-- Description: Add complete investment and financial tracking infrastructure
-- Date: December 29, 2024

-- Investments Table (Enhanced)
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES users(id) NOT NULL,
  pitch_id UUID REFERENCES pitches(id) NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) DEFAULT 'USD',
  investment_type VARCHAR(30) DEFAULT 'equity' CHECK (investment_type IN ('equity', 'debt', 'convertible_note', 'revenue_share', 'grant')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'committed', 'funded', 'active', 'exited', 'cancelled', 'defaulted')),
  contract_id UUID REFERENCES contracts(id),
  payment_transaction_id UUID REFERENCES payment_transactions(id),
  terms JSONB, -- {equity_percentage, valuation, interest_rate, maturity_date, etc}
  milestones JSONB, -- [{title, date, amount, status}]
  notes TEXT,
  due_diligence_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  committed_at TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  exit_date TIMESTAMPTZ,
  exit_value_cents INTEGER
);

-- Investment Portfolio Table
CREATE TABLE IF NOT EXISTS investment_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES users(id) NOT NULL,
  name VARCHAR(255) DEFAULT 'Main Portfolio',
  description TEXT,
  total_invested_cents INTEGER DEFAULT 0,
  current_value_cents INTEGER DEFAULT 0,
  realized_gains_cents INTEGER DEFAULT 0,
  unrealized_gains_cents INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio Investments Junction Table
CREATE TABLE IF NOT EXISTS portfolio_investments (
  portfolio_id UUID REFERENCES investment_portfolios(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES investments(id) ON DELETE CASCADE,
  allocation_percentage DECIMAL(5,2),
  notes TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (portfolio_id, investment_id)
);

-- Investment Returns Table
CREATE TABLE IF NOT EXISTS investment_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID REFERENCES investments(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  return_type VARCHAR(30) CHECK (return_type IN ('dividend', 'interest', 'capital_gain', 'revenue_share')),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  tax_withheld_cents INTEGER DEFAULT 0,
  payment_transaction_id UUID REFERENCES payment_transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue Shares Table
CREATE TABLE IF NOT EXISTS revenue_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES investments(id),
  recipient_id UUID REFERENCES users(id) NOT NULL,
  share_percentage DECIMAL(5,2) NOT NULL CHECK (share_percentage > 0 AND share_percentage <= 100),
  share_type VARCHAR(30) DEFAULT 'net_revenue' CHECK (share_type IN ('gross_revenue', 'net_revenue', 'profit', 'box_office')),
  start_date DATE,
  end_date DATE,
  total_paid_cents INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Royalty Splits Table
CREATE TABLE IF NOT EXISTS royalty_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) NOT NULL,
  role VARCHAR(50), -- writer, director, producer, actor, etc
  royalty_percentage DECIMAL(5,2) NOT NULL,
  minimum_guarantee_cents INTEGER,
  advance_paid_cents INTEGER DEFAULT 0,
  total_earned_cents INTEGER DEFAULT 0,
  recoupable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Distribution Deals Table
CREATE TABLE IF NOT EXISTS distribution_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  distributor_id UUID REFERENCES users(id),
  distributor_name VARCHAR(255),
  territory VARCHAR(100), -- worldwide, north_america, europe, etc
  rights_type VARCHAR(50), -- theatrical, streaming, tv, all
  deal_type VARCHAR(30) CHECK (deal_type IN ('exclusive', 'non_exclusive', 'first_look')),
  revenue_split DECIMAL(5,2),
  minimum_guarantee_cents INTEGER,
  advance_cents INTEGER,
  term_months INTEGER,
  start_date DATE,
  end_date DATE,
  contract_id UUID REFERENCES contracts(id),
  status VARCHAR(20) DEFAULT 'negotiating',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_investments_investor ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investments_pitch ON investments(pitch_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_created ON investments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investments_funded ON investments(funded_at DESC) WHERE funded_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_investment_portfolios_investor ON investment_portfolios(investor_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_investments_portfolio ON portfolio_investments(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_investments_investment ON portfolio_investments(investment_id);

CREATE INDEX IF NOT EXISTS idx_investment_returns_investment ON investment_returns(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_returns_period ON investment_returns(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_revenue_shares_pitch ON revenue_shares(pitch_id);
CREATE INDEX IF NOT EXISTS idx_revenue_shares_recipient ON revenue_shares(recipient_id);
CREATE INDEX IF NOT EXISTS idx_revenue_shares_status ON revenue_shares(status);

CREATE INDEX IF NOT EXISTS idx_royalty_splits_pitch ON royalty_splits(pitch_id);
CREATE INDEX IF NOT EXISTS idx_royalty_splits_recipient ON royalty_splits(recipient_id);

CREATE INDEX IF NOT EXISTS idx_distribution_deals_pitch ON distribution_deals(pitch_id);
CREATE INDEX IF NOT EXISTS idx_distribution_deals_status ON distribution_deals(status);

-- Add comments
COMMENT ON TABLE investments IS 'Investment records with terms and tracking';
COMMENT ON TABLE investment_portfolios IS 'Investor portfolio management';
COMMENT ON TABLE portfolio_investments IS 'Link investments to portfolios';
COMMENT ON TABLE investment_returns IS 'Track returns on investments';
COMMENT ON TABLE revenue_shares IS 'Revenue sharing agreements';
COMMENT ON TABLE royalty_splits IS 'Royalty distribution for creative participants';
COMMENT ON TABLE distribution_deals IS 'Distribution agreements for content';