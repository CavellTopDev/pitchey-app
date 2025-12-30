# 🔐 Database Connection Setup: GitHub → Cloudflare → Neon

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [GitHub Secrets Setup](#github-secrets-setup)
3. [Neon Database Configuration](#neon-database-configuration)
4. [Cloudflare Hyperdrive Setup](#cloudflare-hyperdrive-setup)
5. [Logging & Monitoring](#logging--monitoring)
6. [Troubleshooting](#troubleshooting)
7. [Security Best Practices](#security-best-practices)

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────┐
│   GitHub    │────▶│  GitHub      │────▶│ Cloudflare │────▶│   Neon   │
│   Secrets   │     │  Actions     │     │  Workers   │     │    DB    │
└─────────────┘     └──────────────┘     └────────────┘     └──────────┘
       │                    │                    │                 │
       │                    │                    │                 │
    Encrypted          CI/CD Pipeline      Edge Function     PostgreSQL
    Storage            Deployment          with Pooling      Serverless
```

### Connection Flow:
1. **GitHub Secrets** store encrypted database credentials
2. **GitHub Actions** retrieves secrets during deployment
3. **Wrangler CLI** deploys Worker with injected secrets
4. **Cloudflare Worker** connects to database using credentials
5. **Hyperdrive** provides connection pooling at the edge
6. **Neon PostgreSQL** handles queries with auto-scaling

---

## GitHub Secrets Setup

### Step 1: Navigate to Repository Settings
```bash
https://github.com/[your-username]/[your-repo]/settings/secrets/actions
```

### Step 2: Add Required Secrets

Click "New repository secret" for each:

#### 🔑 **NEON_DATABASE_URL**
```
postgresql://neondb_owner:[password]@[host]/neondb?sslmode=require
```
- Get from Neon Dashboard → Connection Details
- Use "Pooled connection" string for serverless
- Include `?sslmode=require` for security

#### 🔑 **JWT_SECRET**
```bash
# Generate a secure secret:
openssl rand -base64 32
```
Example: `vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz`

#### 🔑 **CLOUDFLARE_API_TOKEN**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create token with permissions:
   - Account: Cloudflare Workers Scripts:Edit
   - Account: Account Settings:Read
   - Zone: Zone:Read

#### 🔑 **CLOUDFLARE_ACCOUNT_ID**
- Find in Cloudflare Dashboard → Right sidebar
- Format: `e16d3bf549153de23459a6c6a06a431b`

#### 🔑 **SENTRY_DSN** (Optional)
```
https://[public_key]@[organization].ingest.sentry.io/[project_id]
```

#### 🔑 **UPSTASH_REDIS_REST_URL** & **UPSTASH_REDIS_REST_TOKEN**
- Get from Upstash Console → REST API section

---

## Neon Database Configuration

### Step 1: Create Database
```sql
-- Run in Neon SQL Editor
CREATE DATABASE pitchey;

-- Create user with limited permissions
CREATE USER pitchey_worker WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE pitchey TO pitchey_worker;
GRANT USAGE ON SCHEMA public TO pitchey_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pitchey_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pitchey_worker;
```

### Step 2: Enable Connection Pooling
1. Go to Neon Dashboard → Settings → Connection Pooling
2. Enable "Connection pooling"
3. Set pool size: 20 connections
4. Use "Transaction" mode for serverless

### Step 3: Get Connection Strings

#### Direct Connection (for migrations):
```
postgresql://neondb_owner:[password]@ep-[name].neon.tech/neondb?sslmode=require
```

#### Pooled Connection (for Workers):
```
postgresql://neondb_owner:[password]@ep-[name]-pooler.neon.tech/neondb?sslmode=require
```

---

## Cloudflare Hyperdrive Setup

### Step 1: Create Hyperdrive Configuration
```bash
npx wrangler hyperdrive create pitchey-db \
  --connection-string "postgresql://..." \
  --max-idle-connections 10 \
  --max-connections 25
```

### Step 2: Get Configuration ID
```bash
npx wrangler hyperdrive list
# Copy the ID for pitchey-db
```

### Step 3: Update Worker Configuration
```toml
# wrangler.toml
[[hyperdrive]]
binding = "DB"
id = "your-hyperdrive-config-id"
```

### Step 4: Use in Worker Code
```typescript
export interface Env {
  DB: Hyperdrive;
  // ... other bindings
}

// In your fetch handler:
const client = new Client(env.DB.connectionString);
await client.connect();
```

---

## Logging & Monitoring

### 1. GitHub Actions Logs
```yaml
- name: Enable debug logging
  run: |
    echo "::debug::Database URL length: ${#DATABASE_URL}"
    echo "::notice::Deployment starting..."
```

### 2. Wrangler Real-time Logs
```bash
# Stream logs in real-time
wrangler tail pitchey-production --format pretty

# Get last 100 logs
wrangler tail pitchey-production --once --limit 100

# Filter by status code
wrangler tail pitchey-production --status 500
```

### 3. Worker Logging Code
```typescript
// Add structured logging
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'Database query executed',
  query_time: performance.now() - startTime,
  user_id: userId,
  endpoint: url.pathname
}));
```

### 4. Analytics Engine Setup
```toml
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "worker_metrics"
```

```typescript
// Track metrics
env.ANALYTICS.writeDataPoint({
  indexes: ['endpoint', 'status'],
  doubles: ['response_time', 'query_count'],
  blobs: ['user_agent']
}, {
  indexes: [url.pathname, response.status],
  doubles: [responseTime, 1],
  blobs: [request.headers.get('User-Agent')]
});
```

### 5. Sentry Error Tracking
```typescript
import * as Sentry from '@sentry/cloudflare';

export default {
  async fetch(request, env, ctx) {
    return Sentry.withSentry(env, ctx, async () => {
      try {
        // Your code
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            endpoint: url.pathname,
            environment: 'production'
          },
          extra: {
            database_connected: !!sql,
            user_id: userId
          }
        });
        throw error;
      }
    });
  }
};
```

---

## Troubleshooting

### Issue: "password authentication failed"

**Solution 1:** Check connection string format
```bash
# Correct format:
postgresql://username:password@host/database?sslmode=require

# Common mistakes:
# - Special characters in password not URL-encoded
# - Missing ?sslmode=require
# - Using direct URL instead of pooled URL
```

**Solution 2:** Verify secrets in GitHub
```bash
# Test locally with the same connection string
DATABASE_URL="your-connection-string" \
  psql "$DATABASE_URL" -c "SELECT 1;"
```

### Issue: "too many connections"

**Solution:** Enable connection pooling
1. Use Neon's pooled connection URL (ends with -pooler)
2. Configure Hyperdrive for edge pooling
3. Set appropriate pool limits

### Issue: "Worker deployment fails"

**Check:**
1. GitHub secrets are set correctly
2. Cloudflare API token has correct permissions
3. wrangler.toml syntax is valid
4. Worker code compiles without errors

### Debug Commands:
```bash
# Test GitHub secret visibility
echo "Length: ${#DATABASE_URL}"

# Test Cloudflare authentication
wrangler whoami

# Validate wrangler.toml
wrangler publish --dry-run

# Check Worker logs
wrangler tail --format json --once
```

---

## Security Best Practices

### 1. Secret Rotation
```yaml
# .github/workflows/rotate-secrets.yml
name: Rotate Database Password
on:
  schedule:
    - cron: '0 0 1 */3 *'  # Every 3 months
```

### 2. Least Privilege Database User
```sql
-- Create restricted user for Worker
CREATE USER worker_user WITH PASSWORD 'xxx';
GRANT SELECT, INSERT, UPDATE ON pitches TO worker_user;
GRANT SELECT ON users TO worker_user;
-- No DELETE, no DDL permissions
```

### 3. Environment Isolation
```toml
# Separate credentials per environment
[env.development]
vars = { DATABASE_URL = "dev_connection_string" }

[env.staging]
vars = { DATABASE_URL = "staging_connection_string" }

[env.production]
# Use secrets for production
```

### 4. Audit Logging
```typescript
// Log all database mutations
if (request.method !== 'GET') {
  await logDatabaseAccess({
    user_id: userId,
    action: request.method,
    endpoint: url.pathname,
    timestamp: Date.now(),
    ip: request.headers.get('CF-Connecting-IP')
  });
}
```

### 5. Connection String Validation
```typescript
// Validate connection string format
function validateDatabaseUrl(url: string): boolean {
  const pattern = /^postgresql:\/\/[^:]+:[^@]+@[^/]+\/[^?]+\?sslmode=require$/;
  return pattern.test(url);
}

if (!validateDatabaseUrl(env.DATABASE_URL)) {
  throw new Error('Invalid database connection string format');
}
```

---

## Testing the Complete Pipeline

### 1. Manual Trigger
```bash
# Trigger workflow manually
gh workflow run deploy-worker.yml \
  -f environment=production \
  -f debug_enabled=true
```

### 2. Verify Deployment
```bash
# Check deployment status
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/test

# Test database connection
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/test-db
```

### 3. Monitor Logs
```bash
# Watch real-time logs
wrangler tail pitchey-production --format pretty
```

### 4. Performance Testing
```bash
# Load test with Apache Bench
ab -n 1000 -c 10 https://pitchey-api-prod.ndlovucavelle.workers.dev/api/test
```

---

## Quick Setup Checklist

- [ ] Create Neon database and get connection URL
- [ ] Add all required GitHub secrets
- [ ] Configure Cloudflare API token
- [ ] Set up Hyperdrive (optional but recommended)
- [ ] Deploy using GitHub Actions
- [ ] Verify database connection
- [ ] Set up monitoring (Sentry, Analytics)
- [ ] Test complete pipeline
- [ ] Document any custom configurations
- [ ] Set up secret rotation schedule

---

## Support & Resources

- **Neon Docs**: https://neon.tech/docs
- **Cloudflare Workers**: https://developers.cloudflare.com/workers
- **GitHub Actions**: https://docs.github.com/en/actions
- **Wrangler CLI**: https://developers.cloudflare.com/workers/cli-wrangler

---

*Last Updated: December 2024*