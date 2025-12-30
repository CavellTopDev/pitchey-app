# Neon Database Setup Guide for Pitchey Platform

## Current Database Information
- **Host**: `ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech`
- **Database**: `neondb`
- **User**: `neondb_owner`
- **Region**: EU-West-2 (London)
- **Connection Type**: Pooled connection with SSL

## Step 1: Create a Neon Account (If Not Already Done)

1. Go to [Neon Console](https://console.neon.tech)
2. Sign up with GitHub, Google, or email
3. You get a free tier with:
   - 0.5 GB storage
   - 1 compute with autosuspend
   - Unlimited projects

## Step 2: Access Your Existing Database

Since you already have a database at `ep-old-snow-abpr94lc-pooler`, here's how to manage it:

1. **Login to Neon Console**: https://console.neon.tech
2. **Navigate to your project** (should show as the endpoint above)
3. **Go to the Settings tab**

## Step 3: Update Database Password (CRITICAL SECURITY STEP)

Since your credentials were exposed in the repository, you MUST rotate them:

### Option A: Reset Password in Neon Console (Recommended)

1. In Neon Console, go to **Settings** → **Roles**
2. Find the `neondb_owner` role
3. Click the **Reset password** button
4. Copy the new password immediately (it won't be shown again)
5. Update your connection string:
   ```
   postgresql://neondb_owner:NEW_PASSWORD_HERE@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
   ```

### Option B: Create a New Role

1. Go to **Settings** → **Roles**
2. Click **New Role**
3. Name it something like `pitchey_prod`
4. Grant all necessary permissions
5. Use this new role in your connection string

## Step 4: Configure Connection Pooling

For Cloudflare Workers, you need pooled connections:

1. In Neon Console, go to **Settings** → **Connection Details**
2. Enable **Pooled connection** (should already be enabled based on your URL)
3. Connection limits:
   - Free tier: 100 simultaneous connections
   - Pro tier: 200+ connections
4. Your pooler endpoint format:
   ```
   ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech
   ```

## Step 5: Set Up Hyperdrive (Optional but Recommended)

Cloudflare Hyperdrive reduces database latency for edge workers:

### In Cloudflare Dashboard:
1. Go to your Cloudflare account
2. Navigate to **Workers & Pages** → **Hyperdrive**
3. Click **Create configuration**
4. Enter details:
   ```
   Name: pitchey-neon-db
   Connection string: postgresql://neondb_owner:PASSWORD@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech:5432/neondb?sslmode=require
   ```
5. Save and get the Hyperdrive ID

### In wrangler.toml:
```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "your-hyperdrive-id-here"
```

## Step 6: Update Cloudflare Secrets

After changing your database password:

```bash
# Update the DATABASE_URL secret in Cloudflare
echo "postgresql://neondb_owner:NEW_PASSWORD@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" | wrangler secret put DATABASE_URL --name pitchey-production
```

## Step 7: Configure Database Schema

Your database should already have these tables (check in SQL Editor):

```sql
-- Check existing tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- You should see:
-- users, pitches, investments, ndas, messages, notifications, etc.
```

## Step 8: Set Up Monitoring

### In Neon Console:
1. Go to **Monitoring** tab
2. Set up alerts for:
   - High connection count (>80)
   - Storage usage (>400MB for free tier)
   - Compute usage
   - Slow queries

### Useful Monitoring Queries:
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Check database size
SELECT pg_database_size('neondb') / 1024 / 1024 as size_mb;

-- Find slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Step 9: Backup Configuration

### Enable Automatic Backups:
1. In Neon Console → **Settings** → **History**
2. Free tier: 24-hour history
3. Pro tier: 30-day history with point-in-time recovery

### Manual Backup Script:
```bash
#!/bin/bash
# Save as backup-neon.sh

DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"

pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
gzip "$BACKUP_FILE"
echo "Backup saved to ${BACKUP_FILE}.gz"
```

## Step 10: Performance Optimization

### Connection String Parameters:
```
postgresql://user:pass@host/db?sslmode=require&connect_timeout=10&application_name=pitchey
```

### Recommended Indexes (Run in SQL Editor):
```sql
-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pitches_created_at ON pitches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_user_id ON pitches(user_id);
CREATE INDEX IF NOT EXISTS idx_pitches_status ON pitches(status);
CREATE INDEX IF NOT EXISTS idx_investments_pitch_id ON investments(pitch_id);
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- Analyze tables for query planner
ANALYZE;
```

## Connection Strings for Different Environments

### Production (Cloudflare Worker):
```javascript
// With Hyperdrive (recommended)
const db = env.HYPERDRIVE.connect();

// Direct connection (fallback)
const db = neon(env.DATABASE_URL);
```

### Local Development:
```bash
# .env.local
DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
```

### Testing:
```bash
# Test connection
psql "postgresql://neondb_owner:PASSWORD@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" -c "SELECT version();"
```

## Troubleshooting Common Issues

### 1. "Too many connections" Error
- Switch to pooled connection endpoint (with `-pooler` in hostname)
- Reduce connection pool size in your app
- Enable Hyperdrive for connection pooling

### 2. SSL Connection Required
- Always include `?sslmode=require` in connection string
- For local development, you might need to add SSL certificates

### 3. Slow Queries
- Check the Monitoring tab in Neon Console
- Run `EXPLAIN ANALYZE` on slow queries
- Add appropriate indexes

### 4. Database Suspended (Free Tier)
- Database auto-suspends after 5 minutes of inactivity
- First connection after suspend takes 1-2 seconds
- Consider upgrading to Pro for always-on database

## Security Checklist

- [ ] Changed database password after exposure
- [ ] Updated DATABASE_URL secret in Cloudflare
- [ ] Removed hardcoded credentials from all files
- [ ] Enabled SSL requirement (`sslmode=require`)
- [ ] Set up IP allowlisting (Pro feature)
- [ ] Configured role-based access control
- [ ] Enabled query logging for audit trail
- [ ] Set up monitoring alerts

## Next Steps

1. **Immediately**: Change your database password in Neon Console
2. **Update**: Cloudflare Worker secrets with new password
3. **Deploy**: Your worker with `wrangler deploy`
4. **Test**: Connection with the test script above
5. **Monitor**: Check Neon Console monitoring tab regularly

## Support Resources

- **Neon Documentation**: https://neon.tech/docs
- **Neon Discord**: https://discord.gg/92vNTzKDGp
- **Status Page**: https://neonstatus.com
- **Support Email**: support@neon.tech (Pro tier)

## Cost Optimization Tips

### Free Tier Limits:
- 0.5 GB storage
- 1 branch
- 100 compute hours/month
- Auto-suspend after 5 minutes

### When to Upgrade to Pro ($19/month):
- Need >0.5 GB storage
- Want always-on database (no suspend)
- Need branching for dev/staging
- Require longer backup history
- Need IP allowlisting

### Storage Management:
```sql
-- Find large tables
SELECT 
    schemaname || '.' || tablename AS table,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Clean up old data
DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
DELETE FROM sessions WHERE expires_at < NOW();
VACUUM FULL;
```

Remember: Your most urgent task is to **change the database password** since it was exposed in the repository!
