-- Create watchlist table for investors to track interesting pitches
CREATE TABLE IF NOT EXISTS watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    notes TEXT,
    priority TEXT DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, pitch_id)
);

-- Create indexes for watchlist
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_pitch_id ON watchlist(pitch_id);

-- Create portfolio table for tracking investor's investments
CREATE TABLE IF NOT EXISTS portfolio (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE RESTRICT,
    amount_invested DECIMAL(15, 2),
    ownership_percentage DECIMAL(5, 2),
    status TEXT DEFAULT 'active',
    invested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    exited_at TIMESTAMPTZ,
    returns DECIMAL(15, 2),
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for portfolio
CREATE INDEX IF NOT EXISTS idx_portfolio_investor_id ON portfolio(investor_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_pitch_id ON portfolio(pitch_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_status ON portfolio(status);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_watchlist_updated_at BEFORE UPDATE ON watchlist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_updated_at BEFORE UPDATE ON portfolio
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();