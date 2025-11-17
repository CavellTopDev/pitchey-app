-- Create missing tables needed for Phase 2 endpoints

-- Investment interests table (for tracking interest without actual investment)
CREATE TABLE IF NOT EXISTS investment_interests (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    amount DECIMAL(10,2), -- Potential investment amount
    interest_level TEXT DEFAULT 'moderate' CHECK (interest_level IN ('low', 'moderate', 'high')),
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'converted', 'withdrawn')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(investor_id, pitch_id)
);

-- Creator earnings table (track earnings from investments and interests)
CREATE TABLE IF NOT EXISTS creator_earnings (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    earnings_type TEXT CHECK (earnings_type IN ('investment', 'interest', 'royalty')),
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    transaction_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Creator activities/feed table
CREATE TABLE IF NOT EXISTS creator_activities (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('pitch_created', 'investment_received', 'message_received', 'view_milestone', 'interest_received')),
    title TEXT NOT NULL,
    description TEXT,
    related_pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
    related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    read_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics events table (for tracking user actions)
CREATE TABLE IF NOT EXISTS user_analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    properties JSONB DEFAULT '{}',
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Production projects table
CREATE TABLE IF NOT EXISTS production_projects (
    id SERIAL PRIMARY KEY,
    production_company_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'development' CHECK (status IN ('development', 'pre_production', 'production', 'post_production', 'completed', 'cancelled')),
    budget DECIMAL(15,2),
    start_date DATE,
    end_date DATE,
    genre TEXT,
    format TEXT,
    related_pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Follow suggestions table (for caching follow recommendations)
CREATE TABLE IF NOT EXISTS follow_suggestions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    suggested_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    suggestion_reason TEXT,
    score DECIMAL(5,2) DEFAULT 0,
    dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, suggested_user_id)
);

-- User preferences table (for storing user settings)
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    weekly_digest BOOLEAN DEFAULT TRUE,
    investment_alerts BOOLEAN DEFAULT TRUE,
    privacy_level TEXT DEFAULT 'public' CHECK (privacy_level IN ('public', 'private', 'friends')),
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trending content cache table
CREATE TABLE IF NOT EXISTS trending_cache (
    id SERIAL PRIMARY KEY,
    content_type TEXT NOT NULL CHECK (content_type IN ('pitch', 'user', 'topic')),
    content_id INTEGER NOT NULL,
    trend_score DECIMAL(10,2) NOT NULL DEFAULT 0,
    time_period TEXT NOT NULL CHECK (time_period IN ('hour', 'day', 'week', 'month')),
    category TEXT,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(content_type, content_id, time_period)
);

-- Investment opportunities view table (for caching investment opportunities)
CREATE TABLE IF NOT EXISTS investment_opportunities (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    funding_goal DECIMAL(15,2),
    current_funding DECIMAL(15,2) DEFAULT 0,
    funding_deadline DATE,
    min_investment DECIMAL(10,2),
    max_investment DECIMAL(10,2),
    investor_count INTEGER DEFAULT 0,
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
    expected_roi DECIMAL(5,2),
    funding_type TEXT CHECK (funding_type IN ('equity', 'revenue_share', 'loan', 'grant')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'funded', 'closed', 'cancelled')),
    featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pitch_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_investment_interests_investor ON investment_interests(investor_id);
CREATE INDEX IF NOT EXISTS idx_investment_interests_pitch ON investment_interests(pitch_id);
CREATE INDEX IF NOT EXISTS idx_investment_interests_status ON investment_interests(status);

CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator ON creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_pitch ON creator_earnings(pitch_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_type ON creator_earnings(earnings_type);

CREATE INDEX IF NOT EXISTS idx_creator_activities_creator ON creator_activities(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_activities_type ON creator_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_creator_activities_created ON creator_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_analytics_events_user ON user_analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_events_type ON user_analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_analytics_events_created ON user_analytics_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_projects_company ON production_projects(production_company_id);
CREATE INDEX IF NOT EXISTS idx_production_projects_status ON production_projects(status);

CREATE INDEX IF NOT EXISTS idx_follow_suggestions_user ON follow_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_suggestions_suggested ON follow_suggestions(suggested_user_id);

CREATE INDEX IF NOT EXISTS idx_trending_cache_type_period ON trending_cache(content_type, time_period);
CREATE INDEX IF NOT EXISTS idx_trending_cache_score ON trending_cache(trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_cache_expires ON trending_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_investment_opportunities_status ON investment_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_investment_opportunities_featured ON investment_opportunities(featured);
CREATE INDEX IF NOT EXISTS idx_investment_opportunities_deadline ON investment_opportunities(funding_deadline);

-- Add some sample data to test the endpoints

-- Sample investment interests
INSERT INTO investment_interests (investor_id, pitch_id, amount, interest_level, notes)
VALUES 
    (2, 1, 25000.00, 'high', 'Very interested in this thriller concept'),
    (2, 2, 50000.00, 'moderate', 'Good sci-fi potential'),
    (2, 3, 15000.00, 'high', 'Excellent documentary idea')
ON CONFLICT (investor_id, pitch_id) DO NOTHING;

-- Sample creator activities
INSERT INTO creator_activities (creator_id, activity_type, title, description, related_pitch_id)
VALUES 
    (1, 'investment_received', 'New Investment', 'Received $50,000 investment in "The Last Sunset"', 1),
    (1, 'interest_received', 'New Interest', 'An investor showed interest in your project', 2),
    (1, 'view_milestone', 'View Milestone', 'Your pitch reached 1,000 views!', 1)
ON CONFLICT DO NOTHING;

-- Sample investment opportunities
INSERT INTO investment_opportunities (pitch_id, funding_goal, current_funding, funding_deadline, min_investment, max_investment, risk_level, expected_roi, funding_type)
VALUES 
    (1, 2000000.00, 125000.00, '2025-12-31', 5000.00, 100000.00, 'medium', 15.5, 'equity'),
    (2, 5000000.00, 75000.00, '2025-11-30', 10000.00, 200000.00, 'high', 25.0, 'revenue_share'),
    (3, 500000.00, 0.00, '2026-01-15', 1000.00, 50000.00, 'low', 8.5, 'equity')
ON CONFLICT (pitch_id) DO NOTHING;

-- Sample user preferences
INSERT INTO user_preferences (user_id, email_notifications, investment_alerts, privacy_level)
VALUES 
    (1, true, true, 'public'),
    (2, true, true, 'public'),
    (3, false, true, 'private')
ON CONFLICT (user_id) DO NOTHING;

-- Sample follow suggestions
INSERT INTO follow_suggestions (user_id, suggested_user_id, suggestion_reason, score)
VALUES 
    (1, 2, 'Similar interests in thriller genre', 85.5),
    (2, 1, 'Active creator with successful projects', 92.0),
    (1, 3, 'Production company in your area', 78.2)
ON CONFLICT (user_id, suggested_user_id) DO NOTHING;