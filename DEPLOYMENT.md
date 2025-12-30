# Pitchey Production Deployment Guide

## Overview

This guide covers the complete production deployment process for the Pitchey platform, which uses a modern serverless architecture with Cloudflare infrastructure and Deno Deploy as backup.

## Architecture

### Production Infrastructure

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Cloudflare    │    │   Cloudflare     │    │   Deno Deploy   │
│     Pages       │◄───┤     Workers      │◄───┤   (Backup)      │
│   (Frontend)    │    │   (API Layer)    │    │   (Full API)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────┐
                    │                     │
            ┌───────▼────────┐   ┌────────▼────────┐
            │ Neon PostgreSQL │   │ Upstash Redis   │
            │   (Database)    │   │    (Cache)      │
            └─────────────────┘   └─────────────────┘
```

### Production URLs
- **Frontend**: https://pitchey-5o8.pages.dev
- **API Worker**: https://pitchey-api-prod.ndlovucavelle.workers.dev
- **Backup API**: https://pitchey-backend-fresh.deno.dev
- **Database**: Neon PostgreSQL (Managed)
- **Cache**: Upstash Redis (Serverless)

### Components

1. **Frontend**: React app deployed to Cloudflare Pages
2. **API Layer**: Cloudflare Workers with progressive enhancement
3. **Backup API**: Full Deno Deploy application
4. **Database**: Neon PostgreSQL with Hyperdrive acceleration
5. **Cache**: Upstash Redis for performance optimization
6. **Storage**: Cloudflare R2 for file uploads
7. **Monitoring**: Built-in observability and alerting

## Quick Start Deployment

### 1. Clone and Setup
```bash
git clone [repository-url]
cd pitchey_v0.2
cp .env.example .env
```

### 2. Configure Environment
Edit `.env` with your credentials:
```bash
# Required
DATABASE_URL=your_neon_postgresql_url
JWT_SECRET=your_secure_32_char_secret

# Upstash Redis (Recommended)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

### 3. Deploy to Production

#### Frontend (Cloudflare Pages)
```bash
cd frontend
npm install
npm run build

# Option 1: Wrangler CLI
wrangler pages deploy dist \
  --project-name=pitchey \
  --branch=main

# Option 2: Git integration (automatic)
# Connect repository in Cloudflare Pages dashboard
git push origin main
```

#### API Worker (Cloudflare Workers)
```bash
# Set secrets
wrangler secret put JWT_SECRET

# Deploy Worker
wrangler deploy --env production
```

#### Backend (Deno Deploy)
```bash
# Option 1: deployctl CLI
deployctl deploy \
  --project=pitchey-backend-fresh \
  --entrypoint=working-server.ts

# Option 2: GitHub integration (automatic)
git push origin main
```

## Service Configuration

### Cloudflare Pages (Frontend)

#### Build Configuration
```yaml
Framework preset: React
Build command: npm run build
Build output directory: dist
Root directory: frontend
Node version: 20.19.5
```

#### Environment Variables
Set in Cloudflare Pages Dashboard:
- `VITE_API_URL`: https://pitchey-api-prod.ndlovucavelle.workers.dev
- `VITE_WS_URL`: wss://pitchey-backend-fresh.deno.dev
- `VITE_ENV`: production

### Cloudflare Workers (API Gateway)

#### Configuration (wrangler.toml)
```toml
name = "pitchey-api"
main = "src/worker-simple.ts"
compatibility_date = "2024-11-01"

[[kv_namespaces]]
binding = "CACHE"
id = "98c88a185eb448e4868fcc87e458b3ac"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "pitchey-uploads"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "983d4a1818264b5dbdca26bacf167dee"
```

### Deno Deploy (Backend)

#### Project Configuration
- **Entry Point**: `working-server.ts`
- **Environment Variables** (set in Deno Deploy dashboard):
  ```
  DATABASE_URL=postgresql://...
  JWT_SECRET=...
  UPSTASH_REDIS_REST_URL=...
  UPSTASH_REDIS_REST_TOKEN=...
  FRONTEND_URL=https://pitchey-5o8.pages.dev
  ```

### Upstash Redis Setup

1. Create account at [upstash.com](https://upstash.com)
2. Create new Redis database
3. Copy REST URL and token
4. Add to environment variables:
   ```bash
   UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   CACHE_ENABLED=true
   ```

### Neon PostgreSQL Setup

1. Create account at [neon.tech](https://neon.tech)
2. Create new project
3. Copy connection string
4. Run migrations:
   ```bash
   DATABASE_URL=your_neon_url deno run --allow-all run-migrations.ts
   ```

## Local Development

### Backend Server
```bash
# Always use port 8001
PORT=8001 deno run --allow-all working-server.ts
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### Environment Configuration
Frontend `.env`:
```bash
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```

## Monitoring & Maintenance

### Health Checks
```bash
# API Health
curl https://pitchey-backend-fresh.deno.dev/api/health

# Cache Status
curl https://pitchey-backend-fresh.deno.dev/api/cache/status
```

### Logs
- **Cloudflare Pages**: Dashboard → Deployment Logs
- **Deno Deploy**: Dashboard → Logs
- **Upstash**: Console → Metrics

### Performance Optimization

#### Caching Strategy
- Dashboard metrics: 5-minute TTL
- Public pitches: 5-minute TTL
- User sessions: 24-hour TTL
- Search results: 10-minute TTL

#### Database Optimization
- Connection pooling via Neon
- Indexed queries for common operations
- Batch operations where possible

## Troubleshooting

### Common Issues

#### Frontend Not Connecting to Backend
```bash
# Check CORS configuration
# Ensure FRONTEND_URL is set in backend env
FRONTEND_URL=https://pitchey-5o8.pages.dev
```

#### WebSocket Connection Failed
```bash
# Verify WSS protocol in production
VITE_WS_URL=wss://pitchey-backend-fresh.deno.dev
```

#### Cache Not Working
```bash
# Check Upstash credentials
# Platform auto-falls back to memory cache
CACHE_ENABLED=true
```

#### Database Connection Issues
```bash
# Verify connection string format
# Must include ?sslmode=require for Neon
DATABASE_URL=postgresql://...?sslmode=require
```

## Security Checklist

- [x] JWT secrets are 32+ characters
- [x] Database uses SSL connections
- [x] HTTPS enforced on all endpoints
- [x] Environment variables secured
- [x] CORS properly configured
- [x] Rate limiting enabled
- [x] Input validation on all endpoints

## Demo Accounts

Test the platform with these accounts:
```
Password for all: Demo123

Creator: alex.creator@demo.com
Investor: sarah.investor@demo.com
Production: stellar.production@demo.com
```

## CI/CD Pipeline

### Automated Deployment
Push to `main` branch triggers:
1. Cloudflare Pages auto-builds frontend
2. Deno Deploy auto-deploys backend
3. No manual intervention required

### Manual Deployment
```bash
# Frontend
cd frontend && npm run build
npx wrangler pages deploy dist --project-name=pitchey

# Backend
deployctl deploy --project=pitchey-backend
```

## Backup & Recovery

### Database Backup
```bash
# Export from Neon
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Redis Backup
- Upstash provides automatic backups
- Access via Upstash console

## Cost Management

### Free Tier Limits
- **Cloudflare Pages**: Unlimited bandwidth, unlimited builds
- **Deno Deploy**: 100,000 requests/day
- **Neon**: 3GB storage, 1 compute hour/day
- **Upstash**: 10,000 commands/day

### Scaling Considerations
- Monitor usage in service dashboards
- Upgrade plans as needed
- Consider CDN for static assets

## Support & Resources

- **Cloudflare Pages Docs**: https://developers.cloudflare.com/pages/
- **Deno Deploy Docs**: https://deno.com/deploy/docs
- **Neon Docs**: https://neon.tech/docs
- **Upstash Docs**: https://docs.upstash.com

## Next Steps

1. **Immediate Testing**
   - Test all login flows
   - Verify WebSocket connections
   - Check caching performance

2. **Performance Monitoring**
   - Set up alerts for errors
   - Monitor response times
   - Track cache hit rates

3. **User Feedback**
   - Collect performance metrics
   - Gather feature requests
   - Address reported issues

---

**Last Updated**: October 2025
**Platform Status**: Live Production