# GitHub Secrets Setup for Worker Deployment

## Required Secrets for Authentication Fix Deployment

To deploy the Worker with authentication fixes via GitHub Actions, you need to set up the following secrets in your GitHub repository:

## 1. Cloudflare Secrets

### CLOUDFLARE_API_TOKEN
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Set permissions:
   - Account: Cloudflare Workers Scripts:Edit
   - Zone: Worker Routes:Edit
5. Copy the token and save it as `CLOUDFLARE_API_TOKEN`

### CLOUDFLARE_ACCOUNT_ID
1. Go to https://dash.cloudflare.com/
2. Select your account
3. Copy the Account ID from the right sidebar
4. Save it as `CLOUDFLARE_ACCOUNT_ID`

## 2. Application Secrets

### JWT_SECRET
```
vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz
```

### DATABASE_URL (Neon PostgreSQL)
```
postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
```

### FRONTEND_URL
```
https://pitchey.pages.dev
```

## 3. Monitoring Secrets

### SENTRY_DSN
```
https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536
```

### SENTRY_AUTH_TOKEN
Get from Sentry: Settings → Developer Settings → Auth Tokens

## 4. Redis Cache Secrets (Upstash)

### UPSTASH_REDIS_REST_URL
```
https://chief-anteater-20186.upstash.io
```

### UPSTASH_REDIS_REST_TOKEN
```
AU7aAAIncDI3ZGVjNWMxZGUyOWQ0ZmYyYjI4NzdkYjM4OGMxZTE3NnAyMjAxODY
```

## How to Add Secrets to GitHub

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with the exact name and value listed above

## Using GitHub CLI (Faster Method)

```bash
# Set all secrets at once using GitHub CLI
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set JWT_SECRET --body "vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"
gh secret set DATABASE_URL --body "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
gh secret set FRONTEND_URL --body "https://pitchey.pages.dev"
gh secret set SENTRY_DSN --body "https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536"
gh secret set UPSTASH_REDIS_REST_URL --body "https://chief-anteater-20186.upstash.io"
gh secret set UPSTASH_REDIS_REST_TOKEN --body "AU7aAAIncDI3ZGVjNWMxZGUyOWQ0ZmYyYjI4NzdkYjM4OGMxZTE3NnAyMjAxODY"
```

## Verify Secrets

```bash
# List all secrets (shows names only, not values)
gh secret list
```

## Trigger Deployment

After setting up secrets, trigger the deployment:

```bash
# Manually trigger the workflow
gh workflow run deploy-worker.yml

# Or push changes to trigger automatic deployment
git add .
git commit -m "fix: Authentication portal user type validation"
git push origin main
```

## Expected Results After Deployment

✅ Each portal returns the correct user type:
- Creator portal → returns creator users
- Investor portal → returns investor users  
- Production portal → returns production users

✅ No more 500 errors on:
- /api/analytics/dashboard
- /api/nda/requests

✅ Proper database integration instead of hardcoded demo accounts