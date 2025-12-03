# Neon PostgreSQL Database Configuration Guide

## Overview
This guide walks you through setting up Neon PostgreSQL as the production database for Pitchey, including Hyperdrive edge connection pooling.

## Prerequisites
- Neon account (https://neon.tech)
- Cloudflare account with Workers access
- Database schema files ready

## Step 1: Create Neon Database

### 1.1 Sign up for Neon
```bash
1. Go to https://neon.tech
2. Sign up with GitHub or email
3. Create a new project named "pitchey-production"
4. Select region closest to your users (e.g., US East)
```

### 1.2 Database Configuration
```sql
-- Project settings
Project Name: pitchey-production
Database Name: pitchey
Region: aws-us-east-2 (or closest to users)
Compute Size: Autoscaling (0.25 - 1 CU)
```

### 1.3 Get Connection String
```bash
# Pooled connection string (for serverless)
postgresql://[user]:[password]@[endpoint].neon.tech/pitchey?sslmode=require

# Direct connection string (for migrations)
postgresql://[user]:[password]@[endpoint].neon.tech/pitchey?sslmode=require
```

## Step 2: Configure Hyperdrive

### 2.1 Create Hyperdrive Configuration
```bash
# Create Hyperdrive for edge connection pooling
wrangler hyperdrive create pitchey-db \
  --connection-string="postgresql://[user]:[password]@[endpoint].neon.tech/pitchey?sslmode=require"

# Output will include Hyperdrive ID
# Example: a1b2c3d4e5f6g7h8i9j0
```

### 2.2 Update Worker Configuration
```toml
# In wrangler-custom-domain.toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "a1b2c3d4e5f6g7h8i9j0"  # Your Hyperdrive ID
```

## Step 3: Database Schema Setup

### 3.1 Run Migrations with Drizzle
```bash
# Set environment variable
export DATABASE_URL="postgresql://[user]:[password]@[endpoint].neon.tech/pitchey?sslmode=require"

# Run migrations
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
deno run --allow-all src/db/migrate.ts

# Or using npm/drizzle-kit
npx drizzle-kit migrate:run
```

### 3.2 Manual Schema Setup (Alternative)
```sql
-- Connect to Neon database
psql "postgresql://[user]:[password]@[endpoint].neon.tech/pitchey?sslmode=require"

-- Create tables
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company_name VARCHAR(200),
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('creator', 'investor', 'production', 'admin')),
  bio TEXT,
  profile_picture VARCHAR(500),
  verified BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  subscription_tier VARCHAR(20) DEFAULT 'basic',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pitches (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  logline TEXT,
  synopsis TEXT,
  genre VARCHAR(50),
  format VARCHAR(50),
  status VARCHAR(20) DEFAULT 'draft',
  visibility VARCHAR(20) DEFAULT 'private',
  poster_url VARCHAR(500),
  video_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_pitches_creator ON pitches(creator_id);
CREATE INDEX idx_pitches_status ON pitches(status);
CREATE INDEX idx_pitches_visibility ON pitches(visibility);

-- Create additional tables as needed
-- See src/db/schema.ts for complete schema
```

## Step 4: Seed Demo Data

### 4.1 Create Demo Users Script
```typescript
// scripts/seed-neon.ts
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function seedDatabase() {
  // Create demo users
  await sql`
    INSERT INTO users (email, password_hash, first_name, last_name, user_type, verified)
    VALUES 
      ('alex.creator@demo.com', '$2a$10$...', 'Alex', 'Creator', 'creator', true),
      ('sarah.investor@demo.com', '$2a$10$...', 'Sarah', 'Investor', 'investor', true),
      ('stellar.production@demo.com', '$2a$10$...', 'Stellar', 'Production', 'production', true)
    ON CONFLICT (email) DO NOTHING
  `;

  // Create demo pitches
  const creator = await sql`
    SELECT id FROM users WHERE email = 'alex.creator@demo.com'
  `;

  if (creator[0]) {
    await sql`
      INSERT INTO pitches (creator_id, title, logline, genre, format, status, visibility)
      VALUES 
        (${creator[0].id}, 'The Last Signal', 'A scientist receives a mysterious signal...', 'Sci-Fi', 'Feature Film', 'published', 'public'),
        (${creator[0].id}, 'Midnight Express', 'A thriller about a stolen train...', 'Thriller', 'Feature Film', 'published', 'public')
    `;
  }

  console.log('Database seeded successfully');
}

seedDatabase();
```

### 4.2 Run Seed Script
```bash
# Run the seed script
deno run --allow-all scripts/seed-neon.ts

# Or verify manually
psql $DATABASE_URL -c "SELECT * FROM users;"
```

## Step 5: Worker Database Integration

### 5.1 Update Worker to Use Hyperdrive
```typescript
// In worker-custom-domain.ts or worker handler
import { connect } from '@planetscale/database';

export interface Env {
  HYPERDRIVE: Hyperdrive;
  // ... other bindings
}

class DatabaseHandler {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async query(sql: string, params?: any[]) {
    // Hyperdrive automatically pools connections
    const conn = this.env.HYPERDRIVE.connectionString;
    
    // Execute query with automatic retries
    const result = await fetch(conn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });

    return result.json();
  }

  async getUser(email: string) {
    const sql = 'SELECT * FROM users WHERE email = $1';
    const result = await this.query(sql, [email]);
    return result.rows[0];
  }

  async getPitches(limit = 10, offset = 0) {
    const sql = `
      SELECT p.*, u.first_name, u.last_name 
      FROM pitches p 
      JOIN users u ON p.creator_id = u.id 
      WHERE p.visibility = 'public' 
      ORDER BY p.created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    const result = await this.query(sql, [limit, offset]);
    return result.rows;
  }
}
```

### 5.2 Connection Pooling Configuration
```javascript
// Hyperdrive configuration benefits
{
  // Automatic connection pooling
  maxConnections: 100,
  minConnections: 2,
  
  // Smart retry logic
  retryAttempts: 3,
  retryDelay: 100,
  
  // Edge caching of prepared statements
  statementCacheTtl: 3600,
  
  // Geographic routing to nearest replica
  readReplicas: true
}
```

## Step 6: Environment Variables

### 6.1 Set Worker Secrets
```bash
# Set database URL as secret
wrangler secret put DATABASE_URL
# Enter: postgresql://[user]:[password]@[endpoint].neon.tech/pitchey?sslmode=require

# Set other required secrets
wrangler secret put JWT_SECRET
# Enter: your-jwt-secret-key
```

### 6.2 Local Development Configuration
```bash
# .env.local
DATABASE_URL=postgresql://[user]:[password]@[endpoint].neon.tech/pitchey?sslmode=require
JWT_SECRET=your-jwt-secret-key
```

## Step 7: Database Monitoring

### 7.1 Neon Dashboard Metrics
Monitor in Neon dashboard:
- Active connections
- Query performance
- Storage usage
- Compute usage
- Slow queries

### 7.2 Create Monitoring Queries
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Find slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Database size
SELECT pg_database_size('pitchey');

-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Step 8: Backup Strategy

### 8.1 Neon Automatic Backups
Neon provides:
- Point-in-time recovery (7 days free tier, 30 days pro)
- Automatic daily backups
- Branch creation from any point in time

### 8.2 Manual Backup Script
```bash
#!/bin/bash
# backup-neon.sh

DATE=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="postgresql://[user]:[password]@[endpoint].neon.tech/pitchey?sslmode=require"

# Create backup
pg_dump "$DATABASE_URL" > backups/pitchey_$DATE.sql

# Compress backup
gzip backups/pitchey_$DATE.sql

# Upload to R2 (optional)
wrangler r2 object put pitchey-backups/pitchey_$DATE.sql.gz \
  --file=backups/pitchey_$DATE.sql.gz

# Keep only last 30 days of local backups
find backups -name "*.sql.gz" -mtime +30 -delete
```

### 8.3 Schedule Backups
```bash
# Add to crontab
0 2 * * * /path/to/backup-neon.sh  # Daily at 2 AM
```

## Step 9: Performance Optimization

### 9.1 Query Optimization
```sql
-- Add missing indexes based on query patterns
CREATE INDEX CONCURRENTLY idx_pitches_created_at ON pitches(created_at DESC);
CREATE INDEX CONCURRENTLY idx_users_company ON users(company_name) WHERE company_name IS NOT NULL;

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY idx_active_pitches 
ON pitches(created_at DESC) 
WHERE status = 'published' AND visibility = 'public';

-- Analyze tables for query planner
ANALYZE users;
ANALYZE pitches;
```

### 9.2 Connection Pool Tuning
```javascript
// Hyperdrive tuning for Neon
{
  // Neon-specific settings
  connectionString: process.env.DATABASE_URL,
  
  // Pool settings
  max: 25,  // Neon free tier allows 100 connections
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  
  // Statement caching
  statementTimeout: 30000,
  query_timeout: 10000,
  
  // Retry configuration
  retries: 3,
  retryDelayMs: 100
}
```

## Step 10: Testing & Validation

### 10.1 Test Database Connection
```bash
# Test from Worker
curl https://api.pitchey.com/api/health

# Response should include database status
{
  "success": true,
  "database": "connected",
  "version": "PostgreSQL 15.x"
}
```

### 10.2 Load Testing
```bash
# Test database under load
k6 run scripts/database-load-test.js

# Monitor in Neon dashboard during test
# Watch for connection spikes, slow queries
```

## Migration Checklist

- [ ] Neon account created
- [ ] Database provisioned in correct region
- [ ] Connection string obtained
- [ ] Hyperdrive configured with connection string
- [ ] Worker configuration updated with Hyperdrive binding
- [ ] Database schema migrated
- [ ] Demo data seeded
- [ ] Worker secrets configured
- [ ] Database queries tested
- [ ] Monitoring set up
- [ ] Backup strategy implemented
- [ ] Performance indexes created
- [ ] Load testing completed
- [ ] Production deployment verified

## Troubleshooting

### Connection Issues
```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT 1"

# Check SSL requirement
# Neon requires SSL, ensure sslmode=require
```

### Slow Queries
```sql
-- Enable query logging
ALTER DATABASE pitchey SET log_statement = 'all';
ALTER DATABASE pitchey SET log_duration = on;

-- Find slow queries
SELECT * FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC;
```

### Connection Pool Exhaustion
```javascript
// Monitor pool usage
const poolStats = await hyperdrive.getStats();
console.log('Active connections:', poolStats.activeConnections);
console.log('Idle connections:', poolStats.idleConnections);
```

## Support Resources

- Neon Docs: https://neon.tech/docs
- Hyperdrive Docs: https://developers.cloudflare.com/hyperdrive/
- Drizzle Docs: https://orm.drizzle.team/
- PostgreSQL Docs: https://www.postgresql.org/docs/

## Next Steps

After database is configured:
1. Run production tests with real queries
2. Set up monitoring dashboards
3. Configure alerting for database issues
4. Document query patterns for optimization
5. Implement read replicas if needed