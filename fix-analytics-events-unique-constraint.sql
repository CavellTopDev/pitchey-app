-- Fix analytics_events.event_id unique constraint issue
-- This fixes the foreign key constraint error in 0002_calm_dragon_lord.sql

-- Add unique constraint to analytics_events.event_id to support foreign key references
ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_event_id_unique UNIQUE(event_id);

-- Alternatively, if you want event_id to be the primary key instead:
-- ALTER TABLE analytics_events DROP CONSTRAINT analytics_events_pkey;
-- ALTER TABLE analytics_events ADD PRIMARY KEY(event_id);
-- ALTER TABLE analytics_events ALTER COLUMN id DROP NOT NULL;