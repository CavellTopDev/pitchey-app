-- Add related_id and related_type columns to notifications table if they don't exist

-- Check and add related_id column
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS related_id INTEGER;

-- Check and add related_type column  
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS related_type VARCHAR(50);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications' 
AND column_name IN ('related_id', 'related_type')
ORDER BY column_name;