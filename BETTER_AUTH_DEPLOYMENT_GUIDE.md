# Better Auth Deployment Guide for Pitchey Platform

This guide provides step-by-step instructions for deploying Better Auth with Cloudflare Workers within free tier constraints.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Migration](#database-migration)
3. [Environment Setup](#environment-setup)
4. [Worker Deployment](#worker-deployment)
5. [Frontend Migration](#frontend-migration)
6. [Testing and Validation](#testing-and-validation)
7. [Free Tier Optimization](#free-tier-optimization)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- Cloudflare account with Workers enabled (free tier supported)
- Neon PostgreSQL database
- Node.js 18+ and npm
- Wrangler CLI installed (`npm install -g wrangler`)

## Database Migration

### Step 1: Apply Better Auth Schema

Execute the Better Auth schema migration against your Neon database:

```bash
# Connect to your Neon database and run the schema
psql "your-neon-connection-string" -f src/db/better-auth-schema.sql
```

### Step 2: Verify Schema

Check that the Better Auth tables were created:

```sql
-- Check for Better Auth tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sessions', 'accounts', 'verification_tokens');
```

## Environment Setup

### Step 1: Generate Better Auth Secret

Generate a strong secret for Better Auth:

```bash
# Generate a random secret (save this securely)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Set Worker Secrets

Configure secrets for production deployment:

```bash
# Set the Better Auth secret
wrangler secret put BETTER_AUTH_SECRET

# Set your database URL
wrangler secret put DATABASE_URL
```

### Step 3: Create KV Namespace

Create a KV namespace for session storage:

```bash
# Create production KV namespace
wrangler kv:namespace create "SESSIONS_KV"

# Create preview KV namespace
wrangler kv:namespace create "SESSIONS_KV" --preview

# Update wrangler.toml.better-auth with the returned IDs
```

### Step 4: Create R2 Bucket (Optional)

For file uploads within free tier limits:

```bash
# Create R2 bucket for file storage
wrangler r2 bucket create pitchey-production-files
```

## Worker Deployment

### Step 1: Update Wrangler Configuration

Use the provided `wrangler.toml.better-auth` configuration:

```bash
# Copy the Better Auth configuration
cp wrangler.toml.better-auth wrangler.toml

# Update the KV namespace IDs with your actual IDs from Step 3
```

### Step 2: Deploy to Production

Deploy the Better Auth worker:

```bash
# Deploy to production
wrangler deploy --env production

# Verify deployment
curl https://your-worker-url.workers.dev/health
```

### Step 3: Test Authentication Endpoints

Verify the auth endpoints are working:

```bash
# Test health check
curl https://your-worker-url.workers.dev/health

# Test auth endpoints (should return 400 without data, not 404)
curl -X POST https://your-worker-url.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Frontend Migration

### Step 1: Install Better Auth Client

Add Better Auth client to your frontend:

```bash
cd frontend
npm install better-auth
```

### Step 2: Update API Configuration

Update your frontend API configuration:

```typescript
// In frontend/src/config/index.ts
export const config = {
  API_URL: 'https://your-worker-url.workers.dev',
  // Remove JWT-related config
};
```

### Step 3: Replace Auth Store

The updated auth store (`frontend/src/store/authStore.ts`) is already configured to use Better Auth. No additional changes needed.

### Step 4: Update Environment Variables

Update your frontend environment variables:

```bash
# .env.production
VITE_API_URL=https://your-worker-url.workers.dev

# .env.development  
VITE_API_URL=http://localhost:8787
```

### Step 5: Deploy Frontend

Deploy the updated frontend:

```bash
# Build the frontend
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=pitchey
```

## Testing and Validation

### Step 1: Test Portal Authentication

Test each portal login:

```bash
# Test creator login
curl -X POST https://your-worker-url.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# Test investor login
curl -X POST https://your-worker-url.workers.dev/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}'

# Test production login
curl -X POST https://your-worker-url.workers.dev/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}'
```

### Step 2: Verify Session Management

Test session persistence:

```bash
# Login and capture cookies
curl -c cookies.txt -X POST https://your-worker-url.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# Use session to access protected endpoint
curl -b cookies.txt https://your-worker-url.workers.dev/api/users/profile
```

### Step 3: Test Frontend Integration

Open your frontend and verify:

- [ ] All three portal logins work
- [ ] Sessions persist after page refresh
- [ ] Logout clears sessions properly
- [ ] Protected routes redirect properly

## Free Tier Optimization

### Current Resource Usage

Monitor your Cloudflare usage to stay within free tier limits:

```bash
# Check worker analytics
wrangler tail --format pretty

# Monitor KV usage
wrangler kv:key list --namespace-id=your-namespace-id
```

### Optimization Settings

The implementation includes several free tier optimizations:

1. **Rate Limiting**: 100 requests per minute per IP
2. **Session Storage**: Efficient KV usage with TTL
3. **Memory Management**: Connection pooling and cleanup
4. **CPU Optimization**: Under 10ms execution time

### Monitoring Commands

```bash
# Monitor worker performance
wrangler tail --format pretty

# Check worker metrics
curl https://your-worker-url.workers.dev/health

# Validate session cleanup
curl https://your-worker-url.workers.dev/api/auth/session
```

## Troubleshooting

### Common Issues

#### 1. "Database connection failed"
```bash
# Verify database URL secret
wrangler secret list

# Test connection
psql "your-database-url" -c "SELECT 1;"
```

#### 2. "Session not found"
```bash
# Check KV namespace configuration
wrangler kv:namespace list

# Verify cookies are being set
curl -v https://your-worker-url.workers.dev/api/auth/creator/login
```

#### 3. "Rate limit exceeded"
```bash
# Check current rate limiting
# The worker logs will show rate limiting events
wrangler tail
```

#### 4. "CORS errors"
```bash
# Verify TRUSTED_ORIGINS configuration
# Check that your frontend URL is included
```

### Debug Commands

```bash
# Enable debug logging
wrangler tail --format pretty

# Test with curl
curl -v -X POST https://your-worker-url.workers.dev/api/auth/session

# Check worker logs
wrangler tail --format json | jq .
```

### Performance Optimization

If you encounter performance issues:

1. **Reduce Session Storage**: Lower session TTL
2. **Optimize Queries**: Use connection pooling
3. **Cache Headers**: Add appropriate cache headers
4. **Minimize CPU**: Optimize authentication logic

## Migration Checklist

- [ ] Database schema migrated
- [ ] Worker secrets configured
- [ ] KV namespace created
- [ ] R2 bucket created (optional)
- [ ] Worker deployed
- [ ] Frontend updated
- [ ] Frontend deployed
- [ ] All portals tested
- [ ] Session management verified
- [ ] Rate limiting tested
- [ ] Free tier limits monitored

## Production Considerations

### Security

1. **Secrets Rotation**: Regularly rotate BETTER_AUTH_SECRET
2. **CORS Configuration**: Restrict TRUSTED_ORIGINS in production
3. **Session Security**: Monitor session storage usage
4. **Rate Limiting**: Adjust limits based on traffic

### Monitoring

1. **Worker Analytics**: Monitor request patterns
2. **Database Metrics**: Watch connection usage
3. **KV Usage**: Track session storage
4. **Error Rates**: Monitor authentication failures

### Scaling

When you're ready to upgrade from free tier:

1. **Paid Workers**: Remove CPU time limits
2. **KV Plus**: Increased storage and operations
3. **R2 Premium**: Higher storage limits
4. **Hyperdrive**: Database connection pooling

## Support and Maintenance

### Regular Tasks

1. **Session Cleanup**: Monitor KV usage
2. **Security Updates**: Keep Better Auth updated
3. **Performance Review**: Monitor worker metrics
4. **Cost Optimization**: Track Cloudflare usage

### Backup and Recovery

1. **Database Backups**: Regular Neon backups
2. **Configuration Backup**: Store wrangler.toml securely
3. **Secrets Backup**: Document secret management
4. **Recovery Procedures**: Test rollback procedures

For additional support, refer to:
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Neon Database Documentation](https://neon.tech/docs)