-- Add missing columns to investment_interests table
ALTER TABLE investment_interests 
ADD COLUMN IF NOT EXISTS investment_level VARCHAR(100),
ADD COLUMN IF NOT EXISTS message TEXT;

-- Copy data from existing columns if needed
UPDATE investment_interests 
SET investment_level = CASE 
  WHEN interest_level = 'high' THEN 'Executive Producer'
  WHEN interest_level = 'moderate' THEN 'Associate Producer'
  ELSE 'Investor'
END
WHERE investment_level IS NULL;

UPDATE investment_interests
SET message = notes
WHERE message IS NULL AND notes IS NOT NULL;
