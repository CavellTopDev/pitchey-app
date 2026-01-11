-- Migration: Add protected fields for NDA-gated content
-- Date: 2026-01-11
-- Purpose: Add missing protected fields to pitches table for NDA access control

-- Add protected content fields
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS budget_breakdown JSONB,
ADD COLUMN IF NOT EXISTS attached_talent JSONB,
ADD COLUMN IF NOT EXISTS financial_projections JSONB,
ADD COLUMN IF NOT EXISTS distribution_plan TEXT,
ADD COLUMN IF NOT EXISTS marketing_strategy TEXT,
ADD COLUMN IF NOT EXISTS private_attachments JSONB,
ADD COLUMN IF NOT EXISTS contact_details JSONB,
ADD COLUMN IF NOT EXISTS revenue_model TEXT;

-- Add indexes for NDA lookups
CREATE INDEX IF NOT EXISTS idx_ndas_user_pitch ON ndas(signer_id, pitch_id, status);
CREATE INDEX IF NOT EXISTS idx_ndas_signed ON ndas(signed_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_pitch_access_lookup ON pitch_access(user_id, pitch_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_pitch_access_expires ON pitch_access(expires_at) WHERE expires_at IS NOT NULL;

-- Seed test data for pitch ID 226 (The Memory Thief)
UPDATE pitches 
SET 
    budget_breakdown = '{
        "production": 2000000,
        "marketing": 500000,
        "distribution": 300000,
        "contingency": 200000,
        "total": 3000000,
        "breakdown": {
            "above_the_line": 600000,
            "below_the_line": 1400000,
            "post_production": 400000,
            "vfx": 300000,
            "music": 100000
        }
    }'::jsonb,
    attached_talent = '[
        {"role": "Director", "name": "Maya Patel", "imdb": "nm1234567", "notable_works": ["Quantum Dreams", "Silent Echo"]},
        {"role": "Lead Actor", "name": "John Martinez", "imdb": "nm2345678", "notable_works": ["The Last Stand", "City Lights"]},
        {"role": "Producer", "name": "Sarah Chen", "imdb": "nm3456789", "notable_works": ["Moonrise", "Digital Hearts"]}
    ]'::jsonb,
    financial_projections = '{
        "roi": 180,
        "break_even_months": 6,
        "revenue_projections": {
            "domestic_box_office": 5000000,
            "international_box_office": 3000000,
            "streaming": 2000000,
            "vod": 500000,
            "merchandising": 300000
        },
        "profit_share": {
            "investors": 50,
            "producers": 20,
            "talent": 15,
            "distribution": 15
        }
    }'::jsonb,
    distribution_plan = 'Theatrical release in 500+ screens domestically, followed by streaming on Netflix/Amazon Prime after 45-day window. International distribution through Studio Canal for European markets. Festival strategy targeting Sundance, TIFF, and Cannes for initial buzz.',
    marketing_strategy = 'Digital-first campaign targeting sci-fi/thriller audiences aged 18-35. Influencer partnerships with film critics and genre enthusiasts. ARG (Alternate Reality Game) tie-in for viral marketing. Traditional PR campaign with focus on director Maya Patel''s unique vision. Estimated reach: 50M impressions.',
    private_attachments = '[
        {"name": "script_final.pdf", "url": "r2://pitches/226/script_final.pdf", "size": 245000, "uploaded": "2024-01-15"},
        {"name": "storyboard.pdf", "url": "r2://pitches/226/storyboard.pdf", "size": 8900000, "uploaded": "2024-01-20"},
        {"name": "budget_detailed.xlsx", "url": "r2://pitches/226/budget_detailed.xlsx", "size": 125000, "uploaded": "2024-01-18"},
        {"name": "pitch_deck.pdf", "url": "r2://pitches/226/pitch_deck.pdf", "size": 4500000, "uploaded": "2024-01-10"}
    ]'::jsonb,
    contact_details = '{
        "producer": {
            "name": "Sarah Chen",
            "email": "producer@memorythief.com",
            "phone": "+1-555-0123",
            "company": "Quantum Pictures LLC"
        },
        "agent": {
            "name": "Michael Roberts",
            "email": "mroberts@caa.com",
            "phone": "+1-555-0456",
            "agency": "CAA"
        },
        "legal": {
            "name": "Davis & Associates",
            "email": "legal@davislaw.com",
            "phone": "+1-555-0789"
        }
    }'::jsonb,
    revenue_model = 'Traditional studio model with 50/50 profit split after recoupment. Investors recoup 120% before profit sharing begins. Streaming rights negotiated separately with minimum guarantees. Merchandising rights retained by production company with 15% to investors.'
WHERE id = 226;

-- Add sample protected data to a few more pitches for testing
UPDATE pitches
SET 
    budget_breakdown = '{"total": 1500000, "production": 1000000, "marketing": 300000, "distribution": 200000}'::jsonb,
    attached_talent = '[{"role": "Director", "name": "Alex Thompson"}, {"role": "Lead", "name": "Emma Stone"}]'::jsonb,
    financial_projections = '{"roi": 150, "break_even_months": 8}'::jsonb
WHERE id IN (227, 228, 229)
AND budget_breakdown IS NULL;

-- Add comment to table for documentation
COMMENT ON COLUMN pitches.budget_breakdown IS 'NDA-protected: Detailed budget breakdown (JSON)';
COMMENT ON COLUMN pitches.attached_talent IS 'NDA-protected: Attached talent and crew (JSON array)';
COMMENT ON COLUMN pitches.financial_projections IS 'NDA-protected: Financial projections and ROI (JSON)';
COMMENT ON COLUMN pitches.distribution_plan IS 'NDA-protected: Distribution strategy';
COMMENT ON COLUMN pitches.marketing_strategy IS 'NDA-protected: Marketing and PR strategy';
COMMENT ON COLUMN pitches.private_attachments IS 'NDA-protected: Private documents and files (JSON array)';
COMMENT ON COLUMN pitches.contact_details IS 'NDA-protected: Contact information (JSON)';
COMMENT ON COLUMN pitches.revenue_model IS 'NDA-protected: Revenue and profit sharing model';