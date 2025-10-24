# Pitchey Platform Deployment Guide

## Current Production Status

### Live URLs
- **Frontend**: https://pitchey.netlify.app
- **Backend**: https://pitchey-backend-fresh.deno.dev
- **Database**: Neon PostgreSQL (Managed)
- **Cache**: Upstash Redis (Serverless)

### Version Information
- **Platform Version**: v0.2 Production
- **Last Deployment**: October 2025
- **Node Version**: 20.19.5
- **Deno Version**: 2.0+

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

#### Frontend (Netlify)
```bash
cd frontend
npm install
npm run build

# Option 1: Netlify CLI
netlify deploy --prod --dir=dist

# Option 2: Git integration (automatic)
git push origin main
```

#### Backend (Deno Deploy)
```bash
# Option 1: deployctl CLI
deployctl deploy \
  --project=pitchey-backend \
  --entrypoint=working-server.ts

# Option 2: GitHub integration (automatic)
git push origin main
```

## Service Configuration

### Netlify (Frontend)

#### Build Settings
```toml
[build]
  command = "npm run build"
  publish = "dist"
  
[build.environment]
  NODE_VERSION = "20.19.5"
  VITE_API_URL = "https://pitchey-backend-fresh.deno.dev"
```

#### Environment Variables
Set in Netlify Dashboard:
- `VITE_API_URL`: https://pitchey-backend-fresh.deno.dev
- `VITE_WS_URL`: wss://pitchey-backend-fresh.deno.dev

### Deno Deploy (Backend)

#### Project Configuration
- **Entry Point**: `working-server.ts`
- **Environment Variables** (set in Deno Deploy dashboard):
  ```
  DATABASE_URL=postgresql://...
  JWT_SECRET=...
  UPSTASH_REDIS_REST_URL=...
  UPSTASH_REDIS_REST_TOKEN=...
  FRONTEND_URL=https://pitchey.netlify.app
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
- **Netlify**: Dashboard → Functions → Logs
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
FRONTEND_URL=https://pitchey.netlify.app
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
1. Netlify auto-builds frontend
2. Deno Deploy auto-deploys backend
3. No manual intervention required

### Manual Deployment
```bash
# Frontend
cd frontend && npm run build
netlify deploy --prod --dir=dist

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
- **Netlify**: 100GB bandwidth, 300 build minutes
- **Deno Deploy**: 100,000 requests/day
- **Neon**: 3GB storage, 1 compute hour/day
- **Upstash**: 10,000 commands/day

### Scaling Considerations
- Monitor usage in service dashboards
- Upgrade plans as needed
- Consider CDN for static assets

## Support & Resources

- **Netlify Docs**: https://docs.netlify.com
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