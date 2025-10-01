# 🚀 Production Deployment Checklist

## Pre-Deployment (Local)

### Code Preparation
- [ ] All tests passing
- [ ] No console.log() statements in production code
- [ ] Environment variables documented
- [ ] Sensitive data removed from codebase
- [ ] Dependencies up to date
- [ ] Build successful locally

### Security Review
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled
- [ ] SQL injection protection verified
- [ ] XSS protection headers set
- [ ] File upload restrictions in place

### Database Setup
- [ ] Neon account created
- [ ] Database provisioned
- [ ] Connection string obtained
- [ ] Demo data seeded
- [ ] Backup strategy planned

## Deployment Steps

### 1. Backend (Deno Deploy)
- [ ] Create Deno Deploy project
- [ ] Set environment variables:
  - [ ] DATABASE_URL
  - [ ] JWT_SECRET
  - [ ] FRONTEND_URL
  - [ ] UPSTASH_REDIS_REST_URL (optional)
  - [ ] UPSTASH_REDIS_REST_TOKEN (optional)
- [ ] Deploy with deployctl
- [ ] Verify health endpoint
- [ ] Test authentication endpoints

### 2. Frontend (Vercel)
- [ ] Build production bundle
- [ ] Set VITE_API_URL to backend URL
- [ ] Deploy with Vercel CLI
- [ ] Configure custom domain (optional)
- [ ] Test all pages load

### 3. Cache Setup (Optional)
- [ ] Create Upstash account
- [ ] Create Redis database
- [ ] Copy REST credentials
- [ ] Add to Deno Deploy env vars
- [ ] Verify cache status in health check

## Post-Deployment Verification

### Functionality Tests
- [ ] Homepage loads
- [ ] User registration works
- [ ] User login works (all 3 portals)
- [ ] Create pitch works
- [ ] View pitch works
- [ ] Search works
- [ ] Messages work
- [ ] NDA flow works

### Performance Checks
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] Cache hit rate > 50%
- [ ] No memory leaks
- [ ] No error logs

### Monitoring Setup
- [ ] Deno Deploy metrics enabled
- [ ] Vercel analytics enabled
- [ ] Uptime monitoring configured
- [ ] Error alerts set up
- [ ] Daily backup verified

## Production URLs

Record your production URLs here:

```yaml
Backend API: https://pitchey-backend.deno.dev
Frontend: https://your-app.vercel.app
Database: neon.tech/console
Cache Monitor: console.upstash.com
```

## Daily Monitoring

### Check These Metrics Daily (First Week)
- [ ] Request count vs free tier limit
- [ ] Database storage used
- [ ] Cache hit/miss ratio
- [ ] Error rate
- [ ] User signups
- [ ] Active users

### Weekly Tasks
- [ ] Review error logs
- [ ] Check database performance
- [ ] Review cache effectiveness
- [ ] Update dependencies
- [ ] Backup database

## Scaling Triggers

Consider upgrading when you hit:

### Deno Deploy
- 80,000+ requests/day → Upgrade to Pro ($20/month)
- Response time > 1 second → Add caching

### Database (Neon)
- 400MB storage used → Upgrade to Pro ($19/month)
- 2.5GB compute used → Optimize queries

### Cache (Upstash)
- 8,000+ commands/day → Pay-as-you-go (~$0.20/100k)
- Cache misses > 50% → Review cache strategy

### Frontend (Vercel)
- 80GB bandwidth used → Upgrade to Pro ($20/month)
- Build time > 10 minutes → Optimize build

## Rollback Plan

If something goes wrong:

1. **Backend Rollback**
   ```bash
   deployctl deploy --project=pitchey-backend --production=false working-server.backup.ts
   ```

2. **Frontend Rollback**
   ```bash
   vercel rollback
   ```

3. **Database Rollback**
   - Use Neon's point-in-time recovery
   - Restore from daily backup

## Support Contacts

- **Deno Deploy**: https://discord.gg/deno
- **Vercel**: support@vercel.com
- **Neon**: https://neon.tech/support
- **Upstash**: https://upstash.com/support

## Cost Tracking

| Service | Free Tier | Current Usage | Cost |
|---------|-----------|---------------|------|
| Deno Deploy | 100k req/day | 0 | $0 |
| Vercel | 100GB/month | 0 | $0 |
| Neon | 0.5GB storage | 0 | $0 |
| Upstash | 10k cmd/day | 0 | $0 |
| **TOTAL** | | | **$0** |

---

✅ **Ready to deploy?** Run `./deploy-mvp-free.sh`