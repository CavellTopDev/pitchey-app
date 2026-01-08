# Pitchey Deployment Guide

## Architecture Overview

- **Frontend**: `pitchey-5o8-66n.pages.dev` (Cloudflare Pages)
- **Worker API**: `pitchey-api-prod.ndlovucavelle.workers.dev` (Cloudflare Workers)
- **Integration**: Worker is deployed via GitHub Actions CI/CD

## Deployment Methods

### Method 1: Automatic via GitHub (Recommended)

The Worker API is automatically deployed when you push to the `main` branch:

```bash
git add .
git commit -m "feat: your changes"
git push origin main
```

GitHub Actions will:
1. Run tests
2. Build the Worker
3. Deploy to `pitchey-api-prod.ndlovucavelle.workers.dev`

### Method 2: Manual Frontend Deployment

To deploy only the frontend to Pages:

```bash
# Use the deployment script
./deploy-frontend-pages.sh

# Or manually:
cd frontend
VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev \
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev \
npm run build
cd ..
wrangler pages deploy frontend/dist --project-name=pitchey-5o8-66n
```

### Method 3: Manual Worker Deployment (Emergency Only)

If GitHub Actions fails, you can manually deploy the Worker:

```bash
# First, ensure you have the API token
export CLOUDFLARE_API_TOKEN="your-token-here"

# Deploy the Worker
wrangler deploy --env production
```

## Environment Configuration

### Frontend Environment Variables

The frontend needs these variables during build:

```env
VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_APP_URL=https://pitchey-5o8-66n.pages.dev
```

### Worker Configuration

The Worker uses secrets configured in Cloudflare dashboard:
- `DATABASE_URL`: Neon PostgreSQL connection string
- `JWT_SECRET`: Authentication secret
- `UPSTASH_REDIS_REST_URL`: Redis cache URL
- `UPSTASH_REDIS_REST_TOKEN`: Redis auth token

## Verification Steps

After deployment, verify:

1. **Frontend Health**:
   ```bash
   curl -I https://pitchey-5o8-66n.pages.dev
   ```

2. **API Health**:
   ```bash
   curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health
   ```

3. **Frontend-API Connection**:
   - Open https://pitchey-5o8-66n.pages.dev
   - Open browser DevTools Console
   - Should see no CORS errors
   - Should see "API connection successful" messages

4. **Test Authentication**:
   ```bash
   curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/sign-in \
     -H "Content-Type: application/json" \
     -d '{"email":"alex.creator@demo.com","password":"Demo123"}'
   ```

## Troubleshooting

### Frontend not connecting to API

1. Check build-time environment variables:
   ```bash
   grep -r "VITE_API_URL" frontend/dist/
   ```

2. Verify API URL is correct in built files

### CORS Errors

The Worker should have CORS headers configured for:
- Origin: `https://pitchey-5o8-66n.pages.dev`
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Credentials: true (for cookies)

### Deployment Fails

1. Check GitHub Actions logs for Worker deployment
2. Verify Cloudflare API token is valid
3. Ensure project names match in Cloudflare dashboard

## Quick Commands

```bash
# Deploy frontend only
./deploy-frontend-pages.sh

# Check deployment status
wrangler pages deployment list --project-name=pitchey-5o8-66n

# View Worker logs
wrangler tail pitchey-api-prod

# Test API locally with production database
PORT=8001 deno run --allow-all working-server.ts
```

## Important Notes

- Worker is deployed via GitHub Actions (not manual wrangler deploy)
- Frontend must be built with production API URL
- Always test after deployment using demo accounts
- Monitor GitHub Actions for Worker deployment status