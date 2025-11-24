-- Add simple demo investment data for testing
-- Ensure we have some basic investment data for the demo accounts

-- First ensure we have some pitches marked as seeking investment
UPDATE pitches 
SET seeking_investment = true
WHERE status = 'published' 
  AND visibility = 'public' 
  AND id <= 10;

-- Add basic investment data for testing
-- Investor ID 2 (Sarah Investor) making some investments
INSERT INTO investments (investor_id, pitch_id, amount, status, current_value, notes, created_at, updated_at) VALUES
(2, 1, 50000, 'active', 55000, 'Strong concept with experienced creator', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
(2, 2, 25000, 'active', 23000, 'Early-stage comedy project', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
(2, 3, 100000, 'pending', 100000, 'Major drama series investment', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
(2, 4, 75000, 'completed', 105000, 'Successfully completed sci-fi feature', NOW() - INTERVAL '18 months', NOW() - INTERVAL '6 months'),
(2, 5, 150000, 'active', 180000, 'Horror anthology series performing well', NOW() - INTERVAL '12 months', NOW() - INTERVAL '1 month');

-- Add one investment from production company (ID 16)
INSERT INTO investments (investor_id, pitch_id, amount, status, current_value, notes, created_at, updated_at) VALUES
(16, 1, 300000, 'active', 350000, 'Lead investor in promising project', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days')
ON CONFLICT DO NOTHING;