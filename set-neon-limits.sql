-- Set Neon autoscaling limits to prevent runaway costs
-- Run this against your Neon database

-- Set maximum compute units to 4 (suitable for 10K-50K users)
ALTER SYSTEM SET neon.max_compute_units = 4;

-- Enable scale-to-zero (auto-suspend after 5 minutes of inactivity)
ALTER SYSTEM SET neon.autoscale_compute = true;
ALTER SYSTEM SET neon.suspend_timeout = 300; -- 5 minutes

-- Set connection limits
ALTER SYSTEM SET max_connections = 1000;

-- Optimize for edge workloads
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET log_statement = 'ddl'; -- Only log schema changes

-- Show current settings
SHOW neon.max_compute_units;
SHOW neon.autoscale_compute;
SHOW neon.suspend_timeout;
SHOW max_connections;