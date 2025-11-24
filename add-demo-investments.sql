-- Add demo investment data for Pitchey entertainment platform
-- This script creates realistic investment scenarios for film/TV projects

-- First ensure we have some pitches marked as seeking investment
UPDATE pitches 
SET seeking_investment = true, 
    estimated_budget = CASE 
      WHEN id % 3 = 0 THEN 500000   -- $500k for smaller projects
      WHEN id % 3 = 1 THEN 2000000  -- $2M for medium projects  
      ELSE 10000000                 -- $10M for bigger projects
    END
WHERE status = 'published' 
  AND visibility = 'public' 
  AND id <= 10;

-- Add realistic investment data
-- Investor ID 2 (Sarah Investor) making various investments
INSERT INTO investments (investor_id, pitch_id, amount, status, current_value, notes, created_at, updated_at) VALUES
-- Recent investments (last 3 months)
(2, 1, 50000, 'active', 55000, 'Strong concept with experienced creator. Expecting good returns in indie thriller space.', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
(2, 2, 25000, 'active', 23000, 'Early-stage comedy project. Taking a calculated risk on emerging talent.', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
(2, 3, 100000, 'pending', 100000, 'Major drama series investment. Currently in pre-production phase.', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),

-- Older investments with performance history
(2, 4, 75000, 'completed', 105000, 'Successfully completed sci-fi feature. Great ROI of 40% over 18 months.', NOW() - INTERVAL '18 months', NOW() - INTERVAL '6 months'),
(2, 5, 150000, 'active', 180000, 'Horror anthology series performing above expectations. Strong streaming numbers.', NOW() - INTERVAL '12 months', NOW() - INTERVAL '1 month'),
(2, 6, 80000, 'active', 70000, 'Documentary struggling with distribution. May need additional marketing investment.', NOW() - INTERVAL '8 months', NOW() - INTERVAL '1 week'),

-- Recent high-value investments
(2, 7, 200000, 'active', 240000, 'Premium drama series with A-list attachment. Strong performance in international markets.', NOW() - INTERVAL '6 months', NOW() - INTERVAL '2 weeks'),
(2, 8, 60000, 'cancelled', 0, 'Animation project cancelled due to production issues. Total loss.', NOW() - INTERVAL '10 months', NOW() - INTERVAL '8 months'),

-- Add investments from other demo investors to create realistic ecosystem
-- Creator ID 1 (Alex Creator) also acting as angel investor sometimes
INSERT INTO investments (investor_id, pitch_id, amount, status, current_value, notes, created_at, updated_at) VALUES
(1, 9, 35000, 'active', 42000, 'Supporting fellow creator in the thriller space. Good early traction.', NOW() - INTERVAL '4 months', NOW() - INTERVAL '1 month'),
(1, 10, 20000, 'active', 18000, 'Small investment in experimental project. High risk, high reward potential.', NOW() - INTERVAL '2 months', NOW() - INTERVAL '2 weeks'),

-- Production company ID 16 making strategic investments
INSERT INTO investments (investor_id, pitch_id, amount, status, current_value, notes, created_at, updated_at) VALUES
(16, 1, 300000, 'active', 350000, 'Lead investor in promising thriller project. First look deal attached.', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
(16, 3, 500000, 'pending', 500000, 'Major series investment. Currently finalizing distribution deals.', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
(16, 7, 750000, 'active', 900000, 'Flagship drama series. Exceptional performance across all metrics.', NOW() - INTERVAL '5 months', NOW() - INTERVAL '1 week'),
(16, 5, 400000, 'active', 480000, 'Horror anthology performing well. Strong fan engagement and critical acclaim.', NOW() - INTERVAL '11 months', NOW() - INTERVAL '2 weeks'),

-- Add more diverse investors for realistic ecosystem
-- Additional investor investments (using existing user IDs or creating mock ones)
INSERT INTO investments (investor_id, pitch_id, amount, status, current_value, notes, created_at, updated_at) VALUES
-- Mock additional investors
(2, 9, 45000, 'active', 52000, 'Diversifying into thriller genre. Good early market response.', NOW() - INTERVAL '3 months', NOW() - INTERVAL '3 weeks'),
(2, 10, 30000, 'active', 25000, 'Experimental project with unique narrative approach. Monitoring closely.', NOW() - INTERVAL '1 month', NOW() - INTERVAL '1 week'),

-- Cross-investments creating realistic network effects
(16, 2, 120000, 'active', 125000, 'Comedy project with strong social media presence. Good engagement metrics.', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
(16, 4, 250000, 'completed', 320000, 'Successful sci-fi feature completion. Strong international sales.', NOW() - INTERVAL '20 months', NOW() - INTERVAL '4 months'),
(16, 6, 180000, 'active', 160000, 'Documentary with important social message. Distribution challenges but critical acclaim.', NOW() - INTERVAL '7 months', NOW() - INTERVAL '2 weeks'),
(16, 8, 100000, 'cancelled', 15000, 'Animation project faced production delays and budget overruns. Partial recovery only.', NOW() - INTERVAL '12 months', NOW() - INTERVAL '9 months');

-- Update pitch investment indicators based on actual investments
UPDATE pitches 
SET seeking_investment = true
WHERE id IN (
  SELECT DISTINCT pitch_id 
  FROM investments 
  WHERE status IN ('active', 'pending')
);

-- Add some funding goals to pitches (for funding progress calculations)
UPDATE pitches 
SET estimated_budget = CASE 
  WHEN id = 1 THEN 750000    -- Thriller with good traction
  WHEN id = 2 THEN 300000    -- Comedy project
  WHEN id = 3 THEN 1500000   -- Major drama series
  WHEN id = 4 THEN 900000    -- Sci-fi feature
  WHEN id = 5 THEN 1200000   -- Horror anthology
  WHEN id = 6 THEN 450000    -- Documentary
  WHEN id = 7 THEN 2500000   -- Premium drama series
  WHEN id = 8 THEN 800000    -- Animation project
  WHEN id = 9 THEN 600000    -- Thriller project
  WHEN id = 10 THEN 250000   -- Experimental project
  ELSE estimated_budget
END
WHERE id <= 10;

-- Create some investment timeline events for the most active investments
INSERT INTO investment_timeline (investment_id, event_type, event_description, event_date, created_at) VALUES
-- Investment ID 1 (50k thriller investment)
(1, 'investment_created', 'Initial investment of $50,000 committed', NOW() - INTERVAL '30 days', NOW()),
(1, 'due_diligence_completed', 'Completed financial and creative due diligence', NOW() - INTERVAL '28 days', NOW()),
(1, 'contracts_signed', 'Investment agreements executed', NOW() - INTERVAL '25 days', NOW()),
(1, 'production_milestone', 'Pre-production phase completed successfully', NOW() - INTERVAL '15 days', NOW()),
(1, 'value_update', 'Portfolio valuation increased to $55,000 based on production progress', NOW() - INTERVAL '5 days', NOW()),

-- Investment ID 3 (100k drama series - pending)
(3, 'investment_created', 'Initial investment of $100,000 committed', NOW() - INTERVAL '15 days', NOW()),
(3, 'due_diligence_started', 'Beginning comprehensive due diligence process', NOW() - INTERVAL '12 days', NOW()),
(3, 'market_research_completed', 'Market analysis shows strong potential for drama series', NOW() - INTERVAL '8 days', NOW()),

-- Investment ID 4 (completed 75k sci-fi with great returns)
(4, 'investment_created', 'Initial investment of $75,000 committed', NOW() - INTERVAL '18 months', NOW()),
(4, 'production_started', 'Principal photography commenced', NOW() - INTERVAL '16 months', NOW()),
(4, 'production_completed', 'Filming wrapped successfully', NOW() - INTERVAL '12 months', NOW()),
(4, 'distribution_deal', 'Secured distribution deal with major streaming platform', NOW() - INTERVAL '8 months', NOW()),
(4, 'investment_completed', 'Investment successfully exited at $105,000 (40% ROI)', NOW() - INTERVAL '6 months', NOW()),

-- Investment ID 7 (200k premium drama)
(7, 'investment_created', 'Initial investment of $200,000 committed', NOW() - INTERVAL '6 months', NOW()),
(7, 'cast_attached', 'A-list talent confirmed for lead roles', NOW() - INTERVAL '5 months', NOW()),
(7, 'production_milestone', 'Completed first season production', NOW() - INTERVAL '3 months', NOW()),
(7, 'market_performance', 'Strong international pre-sales exceed expectations', NOW() - INTERVAL '1 month', NOW()),
(7, 'value_update', 'Portfolio valuation increased to $240,000 based on market performance', NOW() - INTERVAL '2 weeks', NOW());

-- Add some investment documents for realism
INSERT INTO investment_documents (investment_id, document_name, document_url, document_type, uploaded_at) VALUES
(1, 'Investment Agreement - Thriller Project', '/documents/inv_1_agreement.pdf', 'contract', NOW() - INTERVAL '25 days'),
(1, 'Due Diligence Report', '/documents/inv_1_dd_report.pdf', 'due_diligence', NOW() - INTERVAL '28 days'),
(1, 'Production Schedule', '/documents/inv_1_schedule.pdf', 'production', NOW() - INTERVAL '20 days'),

(3, 'Term Sheet - Drama Series', '/documents/inv_3_termsheet.pdf', 'term_sheet', NOW() - INTERVAL '12 days'),
(3, 'Market Research Report', '/documents/inv_3_market_research.pdf', 'research', NOW() - INTERVAL '8 days'),

(7, 'Investment Agreement - Premium Drama', '/documents/inv_7_agreement.pdf', 'contract', NOW() - INTERVAL '6 months'),
(7, 'Cast Attachment Letters', '/documents/inv_7_cast_docs.pdf', 'talent', NOW() - INTERVAL '5 months'),
(7, 'International Sales Report', '/documents/inv_7_sales_report.pdf', 'sales', NOW() - INTERVAL '1 month');

-- Add some realistic notes and comments to investments
UPDATE investments 
SET notes = CASE 
  WHEN id = 1 THEN 'Strong concept with experienced creator. Production on track and under budget. Expecting good returns in indie thriller space. Regular weekly updates from production team.'
  WHEN id = 2 THEN 'Early-stage comedy project. Taking calculated risk on emerging talent. Creator has strong social media following which should help with marketing. Monitoring audience testing results.'
  WHEN id = 3 THEN 'Major drama series investment. Currently in pre-production phase. Strong script and attached talent. Distribution discussions ongoing with multiple platforms.'
  WHEN id = 4 THEN 'Successfully completed sci-fi feature. Exceeded expectations with 40% ROI over 18 months. Strong international sales and streaming performance. Would invest with this team again.'
  WHEN id = 5 THEN 'Horror anthology series performing above expectations. Strong streaming numbers and fan engagement. Each episode stands alone which helps with marketing. Season 2 already greenlit.'
  WHEN id = 6 THEN 'Documentary struggling with distribution but receiving critical acclaim. Important social message. May need additional marketing investment to reach wider audience.'
  WHEN id = 7 THEN 'Premium drama series with A-list attachment. Strong performance in international markets. Critics praising writing and performances. Awards season potential.'
  WHEN id = 8 THEN 'Animation project cancelled due to production issues and budget overruns. Studio partnership fell through. Total loss but important learning experience.'
  ELSE notes
END
WHERE id <= 20;