# Environment Variables & Secrets Reference

## Complete Configuration Guide for Pitchey Platform

This document provides a comprehensive reference for all environment variables and secrets required for the Pitchey platform deployment.

---

## 🔐 Required Secrets for Production

### 1. **Cloudflare Configuration** (REQUIRED)
```bash
# Get from: https://dash.cloudflare.com/profile/api-tokens
CLOUDFLARE_API_TOKEN=      # API token with Workers & Pages permissions
CLOUDFLARE_ACCOUNT_ID=e16d3bf549153de23459a6c6a06a431b  # Your account ID
```

### 2. **Database Configuration** (REQUIRED)
```bash
# Neon PostgreSQL: https://console.neon.tech/
STAGING_DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/pitchey?sslmode=require
PRODUCTION_DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/pitchey?sslmode=require

# Or use Hyperdrive for connection pooling
HYPERDRIVE_CONNECTION_ID=    # From wrangler hyperdrive create
```

### 3. **Authentication Secrets** (REQUIRED)
```bash
# JWT Secrets (generate with: openssl rand -base64 32)
STAGING_JWT_SECRET=         # 32+ character random string
PRODUCTION_JWT_SECRET=      # Different from staging!
MFA_SECRET=                 # For 2FA/MFA authentication
ENCRYPTION_KEY=             # For data encryption at rest
```

### 4. **Application URLs** (REQUIRED)
```bash
# API Endpoints
STAGING_API_URL=https://pitchey-staging.ndlovucavelle.workers.dev
PRODUCTION_API_URL=https://pitchey-optimized.ndlovucavelle.workers.dev

# Frontend URLs
STAGING_FRONTEND_URL=https://staging.pitchey-5o8.pages.dev
PRODUCTION_FRONTEND_URL=https://pitchey-5o8.pages.dev

# WebSocket URLs
STAGING_WS_URL=wss://pitchey-staging.ndlovucavelle.workers.dev
PRODUCTION_WS_URL=wss://pitchey-optimized.ndlovucavelle.workers.dev
```

---

## 📊 Monitoring & Observability (RECOMMENDED)

### 5. **Sentry Error Tracking**
```bash
# Get from: https://sentry.io/
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=          # For source maps upload
SENTRY_ORG=                 # Organization slug
SENTRY_PROJECT=             # Project slug
SENTRY_ENVIRONMENT=production
```

### 6. **Slack Notifications**
```bash
# Get from: https://api.slack.com/apps
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/XXX/XXX
SLACK_CHANNEL=#deployments  # Target channel
```

### 7. **Monitoring Services**
```bash
# UptimeRobot: https://uptimerobot.com/
UPTIME_ROBOT_API_KEY=       # For uptime monitoring

# PagerDuty: https://www.pagerduty.com/
PAGERDUTY_INTEGRATION_KEY=  # For incident management
```

---

## 📧 Communication Services (RECOMMENDED)

### 8. **Email Service (Choose One)**

#### Option A: SendGrid
```bash
# Get from: https://app.sendgrid.com/settings/api_keys
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
EMAIL_PROVIDER=sendgrid
```

#### Option B: Resend
```bash
# Get from: https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_PROVIDER=resend
```

#### Option C: Mailgun
```bash
# Get from: https://app.mailgun.com/
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.pitchey.com
EMAIL_PROVIDER=mailgun
```

#### Common Email Settings
```bash
FROM_EMAIL=noreply@pitchey.com
FROM_NAME=Pitchey Platform
SUPPORT_EMAIL=support@pitchey.com
```

---

## 🗄️ Storage & Caching (OPTIONAL)

### 9. **Redis/Upstash Cache**
```bash
# Get from: https://console.upstash.com/
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXXXXxxxxxxxxxxxxx
CACHE_ENABLED=true
CACHE_TTL=3600              # Default TTL in seconds
```

### 10. **R2 Storage**
```bash
# Configured in wrangler.toml - no secrets needed
# Bindings are automatic:
# R2_BUCKET=pitchey-uploads
# R2_BACKUP_BUCKET=pitchey-backups
```

---

## 🔑 OAuth Providers (OPTIONAL)

### 11. **Google OAuth**
```bash
# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://pitchey.com/auth/google/callback
```

### 12. **GitHub OAuth**
```bash
# Get from: https://github.com/settings/developers
GITHUB_CLIENT_ID=xxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxx
GITHUB_REDIRECT_URI=https://pitchey.com/auth/github/callback
```

### 13. **LinkedIn OAuth**
```bash
# Get from: https://www.linkedin.com/developers/
LINKEDIN_CLIENT_ID=xxxxxxxxxxxx
LINKEDIN_CLIENT_SECRET=xxxxxxxxxxxx
LINKEDIN_REDIRECT_URI=https://pitchey.com/auth/linkedin/callback
```

---

## 💳 Payment Processing (OPTIONAL)

### 14. **Stripe**
```bash
# Get from: https://dashboard.stripe.com/apikeys
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
STRIPE_PRICE_ID_BASIC=price_xxxxxxxxxxxx
STRIPE_PRICE_ID_PRO=price_xxxxxxxxxxxx
```

---

## 📈 Analytics (OPTIONAL)

### 15. **Google Analytics**
```bash
GA_MEASUREMENT_ID=G-XXXXXXXXXX
GA_API_SECRET=xxxxxxxxxxxx    # For server-side tracking
```

### 16. **Mixpanel**
```bash
MIXPANEL_TOKEN=xxxxxxxxxxxx
MIXPANEL_API_SECRET=xxxxxxxxxxxx
```

### 17. **Amplitude**
```bash
AMPLITUDE_API_KEY=xxxxxxxxxxxx
```

---

## 🛡️ Security & Compliance

### 18. **Security Headers**
```bash
CSP_REPORT_URI=https://xxx.report-uri.com/r/d/csp/enforce
HSTS_MAX_AGE=31536000
```

### 19. **Rate Limiting**
```bash
RATE_LIMIT_AUTH=5           # Requests per minute for auth
RATE_LIMIT_API=60           # Requests per minute for API
RATE_LIMIT_UPLOAD=10        # Uploads per minute
```

### 20. **GDPR/Privacy**
```bash
PRIVACY_OFFICER_EMAIL=privacy@pitchey.com
DATA_RETENTION_DAYS=365
COOKIE_DOMAIN=.pitchey.com
```

---

## 🚀 Deployment Configuration

### 21. **Environment Settings**
```bash
NODE_ENV=production
DENO_ENV=production
ENVIRONMENT=production      # or staging, development
DEBUG=false
LOG_LEVEL=info              # debug, info, warn, error
```

### 22. **Feature Flags**
```bash
FEATURE_MFA=true
FEATURE_OAUTH=true
FEATURE_WEBHOOKS=true
FEATURE_ANALYTICS=true
FEATURE_AB_TESTING=true
```

### 23. **Admin Configuration**
```bash
ADMIN_EMAIL=admin@pitchey.com
ADMIN_PASSWORD=             # Generated on first deploy
ADMIN_WEBHOOK_SECRET=       # For admin API endpoints
```

---

## 📝 Local Development (.env.local)

```bash
# Minimal configuration for local development
PORT=8001
DATABASE_URL=postgresql://postgres:password@localhost:5432/pitchey
JWT_SECRET=local-development-secret-change-in-production
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:8001
CACHE_ENABLED=false
LOG_LEVEL=debug
```

---

## 🔧 Quick Setup Commands

### Set all required secrets at once:
```bash
# Run the automated setup script
./setup-github-secrets.sh

# Or manually set individual secrets
gh secret set CLOUDFLARE_API_TOKEN
gh secret set PRODUCTION_DATABASE_URL
gh secret set PRODUCTION_JWT_SECRET
# ... etc
```

### Verify secrets are configured:
```bash
# List all configured secrets
gh secret list

# Check specific environment
gh secret list --env production
```

### Test configuration:
```bash
# Validate environment variables
./scripts/validate-environment.sh

# Test deployment
git push origin main
```

---

## 📊 Environment Variables by Service

### Worker Environment (wrangler.toml)
- Bindings: KV, R2, Durable Objects
- Secrets: Via GitHub Secrets or wrangler secret
- Variables: In [vars] section

### Frontend Environment (.env.production)
- VITE_* prefixed variables only
- Build-time variables
- Public variables only (no secrets!)

### Database Migrations
- DATABASE_URL required
- Run via GitHub Actions or locally

---

## ⚠️ Security Best Practices

1. **Never commit secrets to git**
2. **Use different secrets for each environment**
3. **Rotate secrets regularly (every 90 days)**
4. **Use strong, randomly generated secrets**
5. **Limit secret access to necessary services**
6. **Monitor secret usage and access logs**
7. **Use secret scanning in CI/CD**

---

## 🆘 Troubleshooting

### Secret not working?
1. Check secret name matches exactly (case-sensitive)
2. Verify no trailing spaces or newlines
3. Ensure secret is set for correct environment
4. Check GitHub Actions logs for errors

### Common Issues:
- **401 Unauthorized**: Check JWT_SECRET and token generation
- **Database connection failed**: Verify DATABASE_URL format
- **API calls failing**: Check CORS and API URLs
- **Email not sending**: Verify email service credentials

---

## 📚 Additional Resources

- [Cloudflare API Tokens](https://developers.cloudflare.com/api/tokens/)
- [Neon Database Docs](https://neon.tech/docs)
- [GitHub Secrets Docs](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Sentry Setup](https://docs.sentry.io/platforms/javascript/)
- [SendGrid API](https://docs.sendgrid.com/)

---

**Last Updated**: December 2024
**Platform Version**: 1.0.0
**Account**: ndlovucavelle@gmail.com