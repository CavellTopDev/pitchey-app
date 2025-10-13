-- Fix investments table to allow cascade deletion of pitches
-- This migration updates the foreign key constraint on the investments table

-- First, check current constraint
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'investments'
  AND kcu.column_name = 'pitch_id';

-- Drop the existing foreign key constraint
ALTER TABLE investments 
DROP CONSTRAINT IF EXISTS investments_pitch_id_fkey;

-- Add the new foreign key constraint with CASCADE delete
ALTER TABLE investments 
ADD CONSTRAINT investments_pitch_id_fkey 
FOREIGN KEY (pitch_id) 
REFERENCES pitches(id) 
ON DELETE CASCADE;

-- Verify the change
SELECT 
    'investments table foreign key updated to CASCADE delete' AS status,
    COUNT(*) as investments_count
FROM investments;