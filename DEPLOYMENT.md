# Pitchey Deployment Guide

## Overview
This application uses a modern JAMstack architecture:
- **Frontend**: React/Vite app deployed on Netlify
- **Backend**: Deno server deployed on Deno Deploy
- **Database**: PostgreSQL hosted on Neon

## Production URLs (LIVE as of 2025-10-05)
- Frontend: https://pitchey.netlify.app
- Backend: https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev
- Database: Neon PostgreSQL (cloud-hosted)
- Health Check: https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev/api/health

## Local Development Configuration

**IMPORTANT: Local backend always runs on port 8001**

### Quick Start
```bash
# Backend (always use port 8001)
PORT=8001 deno run --allow-all working-server.ts

# Frontend (in separate terminal)
cd frontend && npm run dev
```

### Using Scripts
```bash
# Start all services with Docker
./start-local.sh

# Start development environment
./start-dev.sh

# Using deno tasks
deno task dev    # Starts backend on port 8001
```

### Port Configuration
- **Backend**: http://localhost:8001 (API and WebSocket)
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Database**: localhost:5432 (PostgreSQL via Docker)

**Frontend .env must always have:**
```
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```

## Deployment Methods

### 1. Automatic Deployment (GitHub Actions)
Pushes to the `main` branch trigger automatic deployment via GitHub Actions.

**Required GitHub Secrets:**
- `DENO_DEPLOY_TOKEN`: Your Deno Deploy access token

**Workflow:** `.github/workflows/deploy.yml`

### 2. Manual Backend Deployment (Deno Deploy) - CURRENTLY ACTIVE

#### Prerequisites:
1. Remove/rename `.env.example` temporarily (prevents validation errors)
2. Ensure `.env.deploy` has all required variables (even if empty)

#### Using deployctl directly (TESTED & WORKING):
```bash
# Temporarily move .env.example
mv .env.example .env.example.backup

# Deploy with token (use your token from GitHub secrets or Deno Deploy dashboard)
DENO_DEPLOY_TOKEN=$YOUR_DENO_DEPLOY_TOKEN deployctl deploy \
  --project="pitchey-backend-fresh" \
  --entrypoint="working-server.ts" \
  --env-file=".env.deploy"

# Restore .env.example
mv .env.example.backup .env.example
```

#### Current Deployment (2025-10-05):
- URL: https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev
- Version: 3.3-neon-fixed
- Status: ✅ HEALTHY

### 3. Manual Frontend Deployment (Netlify)

```bash
cd frontend
npm run build
netlify deploy --prod
```

## Environment Variables

### Backend (Deno Deploy)
Set these in the Deno Deploy dashboard:
- `DATABASE_URL`: PostgreSQL connection string from Neon
- `JWT_SECRET`: Secret key for JWT authentication
- `FRONTEND_URL`: https://pitchey.netlify.app (for CORS)

### Frontend (Netlify)
Set in `frontend/.env.production` or Netlify dashboard:
- `VITE_API_URL`: https://pitchey-backend-fresh.deno.dev

### Local Development
Create `.env` file:
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/pitchey
JWT_SECRET=test-secret-key-for-development
PORT=8001
```

## Deployment Checklist

### Before Deploying:
- [ ] Run tests locally: `deno task test`
- [ ] Check frontend build: `npm run build`
- [ ] Verify environment variables are set
- [ ] Ensure database migrations are up to date

### After Deploying:
- [ ] Test health endpoint: `curl https://pitchey-backend-fresh.deno.dev/api/health`
- [ ] Verify frontend loads: https://pitchey.netlify.app
- [ ] Test demo login functionality
- [ ] Check CORS is working properly

## Troubleshooting

### GitHub Actions Failing
1. Check if `DENO_DEPLOY_TOKEN` is set in repository secrets
2. Verify the token hasn't expired
3. Check Deno Deploy project name matches workflow

### CORS Issues
1. Ensure `FRONTEND_URL` is set correctly in Deno Deploy
2. Check that backend URL in frontend matches deployment

### Database Connection Issues
1. Verify `DATABASE_URL` includes `?sslmode=require` for Neon
2. Check Neon dashboard for connection limits
3. Ensure IP allowlist (if configured) includes Deno Deploy

## Demo Accounts
For testing after deployment (password: Demo123):
- Creator: alex.creator@demo.com
- Investor: sarah.investor@demo.com
- Production: stellar.production@demo.com

## Monitoring
- Deno Deploy Dashboard: https://dash.deno.com/projects/pitchey-backend-fresh
- Netlify Dashboard: https://app.netlify.com
- Neon Dashboard: https://console.neon.tech

## Support
- GitHub Issues: https://github.com/CavellTopDev/pitchey-app/issues
- Deno Deploy Docs: https://deno.com/deploy/docs
- Netlify Docs: https://docs.netlify.com