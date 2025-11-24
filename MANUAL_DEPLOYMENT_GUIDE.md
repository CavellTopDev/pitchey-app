# Pitchey Manual Deployment Guide

## 🚀 Quick Start (Deploy in 2 Minutes)

### Step 1: Get Your Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Custom token" template with these permissions:
   - Account: Cloudflare Workers Scripts:Edit
   - Zone: Workers Routes:Edit
4. Copy the token

### Step 2: Deploy Using Script

```bash
# Edit the deployment script
nano deploy-cloudflare.sh

# Find this line:
export CLOUDFLARE_API_TOKEN="YOUR_API_TOKEN_HERE"

# Replace with your actual token:
export CLOUDFLARE_API_TOKEN="your-actual-token-here"

# Save and run:
./deploy-cloudflare.sh
```

## 📦 What Gets Deployed

- **Worker File**: `src/worker-service-optimized.ts`
- **Endpoints**: All 50+ API endpoints including:
  - ✅ Fixed SQL queries (NDA & Investment endpoints)
  - ✅ Authentication endpoints
  - ✅ Dashboard endpoints
  - ✅ Analytics endpoints
  - ✅ WebSocket support

## 🔧 Alternative: Direct Wrangler Deployment

If the script doesn't work, use wrangler directly:

```bash
# Set environment variables
export CLOUDFLARE_API_TOKEN="your-token-here"
export CLOUDFLARE_ACCOUNT_ID="e16d3bf549153de23459a6c6a06a431b"

# Deploy
npx wrangler deploy --env production
```

## ✅ Verify Deployment

After deployment, test these endpoints:

```bash
# Health check
curl https://pitchey-optimized.cavelltheleaddev.workers.dev/api/health

# Should return:
# {"status":"ok","environment":"production","timestamp":"..."}
```

## 🔍 View Logs

```bash
# Stream live logs
npx wrangler tail --env production

# Or view in dashboard
# https://dash.cloudflare.com
```

## ⚠️ Important Environment Variables

These are already configured in the script:
- `JWT_SECRET`: Authentication secret
- `DATABASE_URL`: Neon PostgreSQL connection
- `FRONTEND_URL`: https://pitchey.pages.dev
- `CACHE_ENABLED`: true
- `UPSTASH_REDIS_REST_URL`: Redis cache URL
- `UPSTASH_REDIS_REST_TOKEN`: Redis authentication

## 🚫 Disconnect Deno Deploy

To stop Deno Deploy errors:

1. Go to: https://dash.deno.com/projects/pitchey-backend-fresh
2. Click on "Settings"
3. Under "Git Integration", click "Disconnect"
4. Confirm disconnection

## 🆘 Troubleshooting

### Authentication Error
```
Error: Authentication error [code: 10000]
```
**Solution**: Your API token is invalid. Create a new one with correct permissions.

### Worker Not Found
```
Error: Worker not found
```
**Solution**: Check that `wrangler.toml` exists and has correct configuration.

### Database Connection Failed
```
Error: Database connection failed
```
**Solution**: The Neon database URL may have changed. Update in script.

## 📊 Post-Deployment Checklist

- [ ] Health endpoint returns 200 OK
- [ ] Authentication endpoints work
- [ ] Database queries execute (test /api/pitches/browse)
- [ ] Frontend can connect to API
- [ ] WebSocket endpoints respond

## 🎯 Success Metrics

When deployment is successful, you'll see:
```
✅ Deployment successful!
🌐 Worker URL: https://pitchey-optimized.cavelltheleaddev.workers.dev
📊 View in Cloudflare Dashboard: https://dash.cloudflare.com
```

## 📞 Support

If you encounter issues:
1. Check worker logs: `npx wrangler tail`
2. View GitHub issues: https://github.com/CavellTopDev/pitchey-app/issues
3. Check Cloudflare status: https://www.cloudflarestatus.com/