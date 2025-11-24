-- Add demo investment data using correct IDs
-- Available pitches: 1, 2, 162, 163
-- Available investors: 2 (investor), 3 (production)

-- Add investment data for testing
INSERT INTO investments (investor_id, pitch_id, amount, status, current_value, notes, created_at, updated_at) VALUES
-- Investor ID 2 (Sarah Investor) investments
(2, 1, 50000, 'active', 55000, 'Strong concept with experienced creator', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
(2, 2, 25000, 'active', 23000, 'Early-stage comedy project', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
(2, 162, 75000, 'completed', 105000, 'Successfully completed sci-fi feature', NOW() - INTERVAL '18 months', NOW() - INTERVAL '6 months'),
(2, 163, 150000, 'active', 180000, 'Drama series performing well', NOW() - INTERVAL '12 months', NOW() - INTERVAL '1 month'),

-- Production company ID 3 investments
(3, 1, 300000, 'active', 350000, 'Lead investor in promising project', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
(3, 2, 120000, 'active', 125000, 'Supporting comedy project', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
(3, 162, 250000, 'completed', 320000, 'Successful sci-fi feature', NOW() - INTERVAL '20 months', NOW() - INTERVAL '4 months')
ON CONFLICT DO NOTHING;