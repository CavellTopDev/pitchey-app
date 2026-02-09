> **Note**: This document predates the migration from Deno Deploy to Cloudflare Workers (completed Dec 2024). Deno Deploy references are historical.

# Pitchey Production Deployment Guide

## Overview
Your Pitchey platform uses a **dual-platform deployment strategy** with automated CI/CD via GitHub Actions:

- **Frontend**: Deployed to **cloudflare-pages** (React/Vite SPA)
- **Backend**: Deployed to **Deno Deploy** (Deno/TypeScript API)

## Architecture

```
┌─────────────────┐    API Calls     ┌──────────────────────┐
│   cloudflare-pages       │ ──────────────► │   Deno Deploy        │
│                 │                 │                      │
│ Frontend (SPA)  │                 │ Backend API          │
│ pitchey.cloudflare-pages │                 │ pitchey-backend-     │
│ .app            │                 │ fresh.deno.dev       │
└─────────────────┘                 └──────────────────────┘
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │   Neon Database      │
                                    │   (PostgreSQL)       │
                                    └──────────────────────┘
```

## Production URLs

- **Frontend**: https://pitchey-5o8.pages.dev
- **Backend API**: https://pitchey-backend-fresh.deno.dev
- **Database**: Neon PostgreSQL (managed)

## Deployment Process

### 1. Automated Deployment (Recommended)

**Trigger**: Push to `main` branch automatically deploys both frontend and backend.

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

**What happens:**
1. GitHub Actions workflow triggers (`.github/workflows/deploy.yml`)
2. Runs tests on backend with PostgreSQL/Redis
3. Deploys backend to Deno Deploy
4. cloudflare-pages auto-deploys frontend on detecting changes

### 2. Manual Backend Deployment

```bash
# Install deployctl if not installed
npm install -g deployctl

# Deploy backend manually
DENO_DEPLOY_TOKEN="your_token" deployctl deploy \
  --project="pitchey-backend-fresh" \
  --entrypoint="working-server.ts" \
  --env-file=".env.deploy"
```

### 3. Manual Frontend Deployment

```bash
# Build frontend
cd frontend
npm run build

# Deploy to cloudflare-pages (automatic via git or manual drag-drop)
# Or use cloudflare-pages CLI:
cloudflare-pages deploy --prod --dir=dist
```

## Environment Configuration

### Frontend Environment Variables (cloudflare-pages)

**File**: `frontend/cloudflare-pages.toml`
```toml
[build.environment]
  VITE_API_URL = "https://pitchey-backend-fresh.deno.dev"
  VITE_SENTRY_DSN = "https://1fdc8fab855b4b6b2f44f15034bdbb30@..."
  VITE_SENTRY_ENVIRONMENT = "production"
```

**File**: `frontend/.env.production`
```bash
VITE_API_URL=https://pitchey-backend-fresh.deno.dev
VITE_WS_URL=wss://pitchey-backend-fresh.deno.dev
VITE_NODE_ENV=production
```

### Backend Environment Variables (Deno Deploy)

**Required GitHub Secrets:**
- `DENO_DEPLOY_TOKEN`: Your Deno Deploy API token
- `DATABASE_URL`: Neon PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `UPSTASH_REDIS_REST_URL`: Redis REST URL (optional)
- `UPSTASH_REDIS_REST_TOKEN`: Redis REST token (optional)

**Deployed with:**
```bash
DATABASE_URL=${{ secrets.DATABASE_URL }}
JWT_SECRET=${{ secrets.JWT_SECRET }}
FRONTEND_URL=https://pitchey-5o8.pages.dev
CACHE_ENABLED=true
PORT=8000
NODE_ENV=production
DENO_ENV=production
```

## cloudflare-pages Configuration

### Build Settings
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Node Version**: 18

### Redirects & Proxying
```toml
# API proxy to backend
[[redirects]]
  from = "/api/*"
  to = "https://pitchey-backend-fresh.deno.dev/api/:splat"
  status = 200
  force = true

# SPA fallback
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Security Headers
- CSP configured for Stripe, Sentry
- XSS protection enabled
- Frame options set to DENY

## Deno Deploy Configuration

### Project Settings
- **Project Name**: `pitchey-backend-fresh`
- **Entry Point**: `working-server.ts`
- **Automatic Deployments**: Enabled via GitHub

### Features Used
- Environment variables
- Custom domains
- WebSocket support
- Static file serving

## Database

### Neon PostgreSQL
- **Provider**: Neon (managed PostgreSQL)
- **Connection**: Via `DATABASE_URL` environment variable
- **Schema**: Managed via Drizzle ORM
- **Migrations**: Applied manually via Neon console

## Monitoring & Observability

### Error Tracking
- **Sentry**: Configured for both frontend and backend
- **Frontend DSN**: Public-safe DSN in environment
- **Backend**: Console logging (Sentry temporarily disabled)

### Performance
- **cloudflare-pages**: Built-in analytics and performance metrics
- **Deno Deploy**: Built-in logs and metrics dashboard

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Frontend | http://localhost:5173 | https://pitchey-5o8.pages.dev |
| Backend | http://localhost:8001 | https://pitchey-backend-fresh.deno.dev |
| Database | Local PostgreSQL | Neon PostgreSQL |
| WebSocket | ws://localhost:8001 | wss://pitchey-backend-fresh.deno.dev |
| Environment | .env files | GitHub Secrets + cloudflare-pages vars |

## Deployment Checklist

### Before Deployment
- [ ] All tests passing locally
- [ ] Environment variables updated
- [ ] Database migrations applied (if any)
- [ ] Frontend builds without errors
- [ ] Backend starts without errors

### After Deployment
- [ ] Frontend loads at https://pitchey-5o8.pages.dev
- [ ] API endpoints responding (check /api/health)
- [ ] WebSocket connections working
- [ ] Database connections successful
- [ ] Authentication flows working

## Troubleshooting

### Common Issues

1. **API calls failing from frontend**
   - Check CORS settings in backend
   - Verify VITE_API_URL in cloudflare-pages environment

2. **WebSocket connection failures**
   - Ensure WSS protocol for production
   - Check Deno Deploy WebSocket support

3. **Database connection errors**
   - Verify DATABASE_URL format
   - Check Neon database status

4. **Build failures**
   - Check Node version compatibility
   - Verify all dependencies installed

### Debug Commands
```bash
# Test API endpoint
curl https://pitchey-backend-fresh.deno.dev/api/health

# Check frontend build
cd frontend && npm run build

# Test WebSocket connection
wscat -c wss://pitchey-backend-fresh.deno.dev/ws
```

## Security Considerations

- All secrets stored in GitHub Secrets
- CSP headers configured
- JWT tokens for authentication
- HTTPS enforced everywhere
- Database connections encrypted

## Cost Optimization

- **cloudflare-pages**: Free tier for frontend hosting
- **Deno Deploy**: Pay-per-request serverless
- **Neon**: Managed PostgreSQL with free tier
- **Upstash Redis**: Optional caching layer

---

**Last Updated**: October 2025
**Maintained By**: Development Team