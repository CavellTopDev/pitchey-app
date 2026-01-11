-- Phase 2: Creator Analytics Tables
-- Comprehensive analytics and performance tracking for creators

-- Creator analytics summary
CREATE TABLE IF NOT EXISTS creator_analytics (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_pitches INTEGER DEFAULT 0,
    published_pitches INTEGER DEFAULT 0,
    draft_pitches INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_saves INTEGER DEFAULT 0,
    nda_requests INTEGER DEFAULT 0,
    nda_signed INTEGER DEFAULT 0,
    investment_inquiries INTEGER DEFAULT 0,
    total_invested DECIMAL(15, 2) DEFAULT 0,
    avg_view_duration INTEGER, -- in seconds
    engagement_rate DECIMAL(5, 2), -- percentage
    conversion_rate DECIMAL(5, 2), -- views to NDAs
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(creator_id, period_start, period_end)
);

-- Pitch-level analytics
CREATE TABLE IF NOT EXISTS pitch_analytics (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    unique_views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    nda_requests INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    avg_view_duration INTEGER, -- in seconds
    bounce_rate DECIMAL(5, 2), -- percentage
    completion_rate DECIMAL(5, 2), -- percentage who viewed full pitch
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pitch_id, date)
);

-- Viewer engagement tracking
CREATE TABLE IF NOT EXISTS pitch_engagement (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    viewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    view_duration INTEGER, -- in seconds
    sections_viewed JSONB, -- {"synopsis": true, "budget": true, etc}
    engagement_score DECIMAL(5, 2), -- 0-100
    actions_taken JSONB, -- {"liked": true, "saved": false, "nda_requested": true}
    viewer_type VARCHAR(50), -- 'investor', 'production', 'creator', 'anonymous'
    referrer VARCHAR(255),
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
    viewed_at TIMESTAMP DEFAULT NOW()
);

-- Revenue tracking for creators
CREATE TABLE IF NOT EXISTS creator_revenue (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE CASCADE,
    revenue_type VARCHAR(50) NOT NULL, -- 'investment', 'option', 'sale', 'licensing'
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    investor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    transaction_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'received'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Comparative analytics
CREATE TABLE IF NOT EXISTS pitch_comparisons (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    comparison_date DATE NOT NULL,
    genre_rank INTEGER, -- rank within genre
    overall_rank INTEGER, -- overall platform rank
    genre_avg_views INTEGER,
    genre_avg_engagement DECIMAL(5, 2),
    platform_avg_views INTEGER,
    platform_avg_engagement DECIMAL(5, 2),
    performance_percentile INTEGER, -- 0-100
    trending_score DECIMAL(5, 2), -- 0-100
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pitch_id, comparison_date)
);

-- Investor interest tracking
CREATE TABLE IF NOT EXISTS investor_interest (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    investor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_level VARCHAR(50), -- 'low', 'medium', 'high', 'very_high'
    last_viewed TIMESTAMP,
    total_views INTEGER DEFAULT 1,
    time_spent INTEGER DEFAULT 0, -- total seconds
    actions JSONB, -- detailed action history
    notes TEXT,
    potential_investment DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pitch_id, investor_id)
);

-- Feedback and ratings
CREATE TABLE IF NOT EXISTS pitch_feedback (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_type VARCHAR(50), -- 'investor', 'production', 'peer'
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    strengths TEXT[],
    weaknesses TEXT[],
    suggestions TEXT[],
    overall_feedback TEXT,
    is_interested BOOLEAN DEFAULT FALSE,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pitch_id, reviewer_id)
);

-- Create indexes for performance
CREATE INDEX idx_creator_analytics_creator ON creator_analytics(creator_id, period_start DESC);
CREATE INDEX idx_pitch_analytics_pitch_date ON pitch_analytics(pitch_id, date DESC);
CREATE INDEX idx_pitch_engagement_pitch ON pitch_engagement(pitch_id, viewed_at DESC);
CREATE INDEX idx_pitch_engagement_viewer ON pitch_engagement(viewer_id, viewed_at DESC);
CREATE INDEX idx_creator_revenue_creator ON creator_revenue(creator_id, transaction_date DESC);
CREATE INDEX idx_pitch_comparisons_pitch ON pitch_comparisons(pitch_id, comparison_date DESC);
CREATE INDEX idx_investor_interest_pitch ON investor_interest(pitch_id, interest_level);
CREATE INDEX idx_investor_interest_investor ON investor_interest(investor_id, interest_level);
CREATE INDEX idx_pitch_feedback_pitch ON pitch_feedback(pitch_id, created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_investor_interest_updated_at 
    BEFORE UPDATE ON investor_interest 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample analytics data for testing
INSERT INTO creator_analytics 
    (creator_id, period_start, period_end, total_pitches, published_pitches, total_views, unique_viewers, total_likes, nda_requests, engagement_rate)
VALUES 
    (1, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, 5, 4, 1250, 890, 145, 23, 45.5), -- alex.creator
    (4, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, 3, 3, 890, 650, 98, 15, 38.2), -- david.creator
    (7, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, 8, 6, 2340, 1560, 289, 45, 52.3) -- rachel.creator
ON CONFLICT DO NOTHING;

-- Insert sample pitch analytics
INSERT INTO pitch_analytics 
    (pitch_id, date, views, unique_views, likes, saves, nda_requests)
SELECT 
    p.id,
    CURRENT_DATE,
    FLOOR(RANDOM() * 100 + 50),
    FLOOR(RANDOM() * 80 + 30),
    FLOOR(RANDOM() * 20 + 5),
    FLOOR(RANDOM() * 15 + 3),
    FLOOR(RANDOM() * 5 + 1)
FROM pitches p
WHERE p.status = 'published'
LIMIT 10
ON CONFLICT DO NOTHING;