-- Phase 2: Investor Portfolio Tables
-- Creates comprehensive investment tracking infrastructure

-- Investment records
CREATE TABLE IF NOT EXISTS investments (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    investment_type VARCHAR(50) NOT NULL, -- 'equity', 'debt', 'revenue_share', 'convertible_note'
    equity_percentage DECIMAL(5, 2),
    terms JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
    invested_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    notes TEXT,
    roi DECIMAL(10, 2), -- Return on investment percentage
    UNIQUE(investor_id, pitch_id, status)
);

-- Investment portfolio summary
CREATE TABLE IF NOT EXISTS portfolio_summaries (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    total_invested DECIMAL(15, 2) DEFAULT 0,
    total_returns DECIMAL(15, 2) DEFAULT 0,
    active_investments INTEGER DEFAULT 0,
    completed_investments INTEGER DEFAULT 0,
    average_roi DECIMAL(10, 2) DEFAULT 0,
    best_performing_pitch_id INTEGER REFERENCES pitches(id),
    worst_performing_pitch_id INTEGER REFERENCES pitches(id),
    last_investment_date TIMESTAMP,
    portfolio_value DECIMAL(15, 2) DEFAULT 0,
    risk_score VARCHAR(20), -- 'low', 'medium', 'high', 'very_high'
    diversification_score INTEGER, -- 1-100
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Investment watchlist
CREATE TABLE IF NOT EXISTS investor_watchlist (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
    notes TEXT,
    notification_enabled BOOLEAN DEFAULT TRUE,
    target_amount DECIMAL(15, 2),
    UNIQUE(investor_id, pitch_id)
);

-- Investment transactions
CREATE TABLE IF NOT EXISTS investment_transactions (
    id SERIAL PRIMARY KEY,
    investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'investment', 'dividend', 'exit', 'refund'
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    transaction_date TIMESTAMP DEFAULT NOW(),
    reference_number VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'completed', -- 'pending', 'processing', 'completed', 'failed'
    payment_method VARCHAR(50), -- 'bank_transfer', 'wire', 'ach', 'credit_card'
    fees DECIMAL(10, 2) DEFAULT 0,
    net_amount DECIMAL(15, 2)
);

-- Investment analytics
CREATE TABLE IF NOT EXISTS investment_analytics (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_invested DECIMAL(15, 2),
    total_returns DECIMAL(15, 2),
    roi_percentage DECIMAL(10, 2),
    new_investments INTEGER,
    exited_investments INTEGER,
    average_investment_size DECIMAL(15, 2),
    best_roi DECIMAL(10, 2),
    worst_roi DECIMAL(10, 2),
    genre_distribution JSONB, -- {"action": 45, "drama": 30, "comedy": 25}
    risk_distribution JSONB, -- {"low": 20, "medium": 50, "high": 30}
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(investor_id, period_start, period_end)
);

-- Investment recommendations
CREATE TABLE IF NOT EXISTS investment_recommendations (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    recommendation_score DECIMAL(5, 2), -- 0-100
    recommendation_type VARCHAR(50), -- 'genre_match', 'roi_potential', 'trending', 'similar_investors'
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    clicked BOOLEAN DEFAULT FALSE,
    invested BOOLEAN DEFAULT FALSE
);

-- Risk assessments
CREATE TABLE IF NOT EXISTS risk_assessments (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    assessment_date TIMESTAMP DEFAULT NOW(),
    risk_score INTEGER, -- 1-100 (1 = lowest risk)
    risk_factors JSONB, -- {"market_risk": 30, "execution_risk": 25, "financial_risk": 20}
    risk_level VARCHAR(20), -- 'low', 'medium', 'high', 'very_high'
    recommendations TEXT[],
    mitigations TEXT[],
    confidence_level DECIMAL(5, 2), -- 0-100
    analyst_notes TEXT
);

-- Create indexes for performance
CREATE INDEX idx_investments_investor ON investments(investor_id, status);
CREATE INDEX idx_investments_pitch ON investments(pitch_id, status);
CREATE INDEX idx_portfolio_summaries_investor ON portfolio_summaries(investor_id);
CREATE INDEX idx_watchlist_investor ON investor_watchlist(investor_id, priority);
CREATE INDEX idx_transactions_investor ON investment_transactions(investor_id, transaction_date DESC);
CREATE INDEX idx_analytics_investor_period ON investment_analytics(investor_id, period_start, period_end);
CREATE INDEX idx_recommendations_investor ON investment_recommendations(investor_id, recommendation_score DESC);
CREATE INDEX idx_risk_assessments_investor ON risk_assessments(investor_id, assessment_date DESC);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to update portfolio_summaries.updated_at
CREATE TRIGGER update_portfolio_summaries_updated_at 
    BEFORE UPDATE ON portfolio_summaries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO portfolio_summaries (investor_id, total_invested, total_returns, active_investments, portfolio_value)
VALUES 
    (2, 250000, 50000, 5, 300000), -- sarah.investor@demo.com
    (5, 500000, 150000, 8, 650000), -- emily.investor@demo.com
    (8, 1000000, 300000, 12, 1300000) -- michael.investor@demo.com
ON CONFLICT (investor_id) DO NOTHING;