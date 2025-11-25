# Environment Variables Setup Guide

## ⚠️ Critical Issues Identified

### 1. **GitHub Actions Failure**
- **Issue**: All GitHub Actions are failing with "The job was not started because your account is locked due to a billing issue"
- **Solution**: Resolve GitHub billing/payment issue to re-enable Actions

### 2. **Missing Environment Variables**
- **NEON_DATABASE_URL**: Referenced in code but not configured in wrangler.toml
- **Cloudflare Secrets**: No secrets are currently set (wrangler secret list returns empty)

### 3. **Frontend API URL Mismatch**
- Frontend `.env.example` points to old Deno Deploy URL
- Should point to Cloudflare Workers URL

## Required Environment Variables

### 🔴 CRITICAL - Must Be Set for Production

#### **Cloudflare Workers (Backend)**

```bash
# Database Connection (REQUIRED)
NEON_DATABASE_URL="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"

# Authentication (REQUIRED)
JWT_SECRET="vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"

# Frontend URL (REQUIRED)
FRONTEND_URL="https://pitchey.pages.dev"
```

#### **Frontend (.env.production)**

```bash
# API Configuration (REQUIRED)
VITE_API_URL="https://pitchey-optimized.cavelltheleaddev.workers.dev"
VITE_WS_URL="wss://pitchey-optimized.cavelltheleaddev.workers.dev"
```

### 🟡 IMPORTANT - Enhanced Functionality

#### **Monitoring & Analytics**

```bash
# Sentry Error Tracking
SENTRY_DSN="https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536"
SENTRY_ENVIRONMENT="production"
SENTRY_RELEASE="production-v1.0"

# Frontend Sentry
VITE_SENTRY_DSN="https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536"
```

#### **Caching & Performance**

```bash
# Upstash Redis (for caching)
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
CACHE_ENABLED="true"
```

#### **Payment Processing**

```bash
# Stripe (if payments are enabled)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

#### **Email Services**

```bash
# SendGrid or similar
SENDGRID_API_KEY="SG...."
EMAIL_FROM="noreply@pitchey.com"
EMAIL_PROVIDER="sendgrid"
```

### 🟢 OPTIONAL - Additional Features

```bash
# Feature Flags
VITE_ENABLE_ANALYTICS="true"
VITE_NODE_ENV="production"
VITE_APP_VERSION="1.0.0"
VITE_DISABLE_WEBSOCKET="false"

# Storage Configuration
STORAGE_PROVIDER="r2"  # or "local" for development
USE_LOCAL_FALLBACK="false"

# Development/Debugging
DEBUG_MODE="false"
LOG_LEVEL="info"
```

## Setup Instructions

### 1. **Set Cloudflare Worker Secrets**

```bash
# Set each secret individually
wrangler secret put NEON_DATABASE_URL
# Enter: postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require

wrangler secret put JWT_SECRET
# Enter: vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz

wrangler secret put STRIPE_SECRET_KEY
# Enter your Stripe secret key

wrangler secret put SENDGRID_API_KEY
# Enter your SendGrid API key

wrangler secret put UPSTASH_REDIS_REST_URL
# Enter your Upstash Redis URL

wrangler secret put UPSTASH_REDIS_REST_TOKEN
# Enter your Upstash Redis token
```

### 2. **Update Frontend Environment**

Create `/frontend/.env.production`:

```bash
# Production API endpoints
VITE_API_URL=https://pitchey-optimized.cavelltheleaddev.workers.dev
VITE_WS_URL=wss://pitchey-optimized.cavelltheleaddev.workers.dev

# Sentry (optional but recommended)
VITE_SENTRY_DSN=https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536

# Features
VITE_ENABLE_ANALYTICS=true
VITE_NODE_ENV=production
```

### 3. **Fix wrangler.toml**

Update `/pitchey_v0.2/wrangler.toml`:

```toml
# Add to [vars] section
[vars]
FRONTEND_URL = "https://pitchey.pages.dev"
SENTRY_ENVIRONMENT = "production"

# Remove hardcoded JWT_SECRET from vars (use secrets instead)
# Remove NEON_DATABASE_URL references (use secrets)
```

### 4. **GitHub Secrets Setup**

Add these secrets in GitHub repository settings:

```bash
# Go to: Settings > Secrets and variables > Actions

CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
NEON_DATABASE_URL=postgresql://...
JWT_SECRET=vYGh89KjLmNpQrStUwXyZ...
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG....
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
SENTRY_DSN=https://...
```

## Code Fixes Required

### 1. **Fix NEON_DATABASE_URL References**

In `src/worker-service-optimized.ts`, replace:
```typescript
const sql = neon(env.NEON_DATABASE_URL!);
```

With:
```typescript
const connectionString = env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
const sql = neon(connectionString);
```

### 2. **Update Frontend Build Script**

```json
// package.json
{
  "scripts": {
    "build:prod": "VITE_API_URL=https://pitchey-optimized.cavelltheleaddev.workers.dev npm run build"
  }
}
```

## Verification Checklist

- [ ] Resolve GitHub billing issue
- [ ] Set all Cloudflare Worker secrets
- [ ] Update frontend .env.production
- [ ] Fix NEON_DATABASE_URL references in code
- [ ] Test authentication flow
- [ ] Verify database connection
- [ ] Check Sentry error reporting
- [ ] Test WebSocket connections
- [ ] Verify file uploads to R2
- [ ] Check Redis caching (if enabled)

## Testing Commands

```bash
# Test database connection
curl https://pitchey-optimized.cavelltheleaddev.workers.dev/api/health/db

# Test authentication
curl -X POST https://pitchey-optimized.cavelltheleaddev.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# List current secrets
wrangler secret list

# Deploy with environment check
wrangler deploy --dry-run
```

## Common Issues & Solutions

### Issue: "NEON_DATABASE_URL is not defined"
**Solution**: Set as Cloudflare secret or update code to use fallback

### Issue: "Invalid JWT_SECRET"
**Solution**: Ensure JWT_SECRET is set as a secret, not in vars

### Issue: "CORS errors on frontend"
**Solution**: Verify FRONTEND_URL matches actual deployment URL

### Issue: "WebSocket connection failed"
**Solution**: Check WEBSOCKET_ROOM Durable Object is properly configured

### Issue: "File upload fails"
**Solution**: Verify R2_BUCKET binding is correctly configured

## Priority Order

1. **IMMEDIATE**: Set NEON_DATABASE_URL as secret
2. **IMMEDIATE**: Fix frontend API URLs
3. **HIGH**: Set JWT_SECRET as secret (security)
4. **HIGH**: Configure Sentry for error tracking
5. **MEDIUM**: Setup Redis caching
6. **LOW**: Configure email service
7. **LOW**: Setup payment processing

## Security Notes

⚠️ **NEVER commit these values to Git:**
- Database URLs with passwords
- JWT secrets
- API keys
- Payment processor keys

✅ **Use Cloudflare Secrets for:**
- All sensitive configuration
- Production credentials
- API keys

✅ **Use wrangler.toml vars for:**
- Public URLs
- Feature flags
- Non-sensitive configuration