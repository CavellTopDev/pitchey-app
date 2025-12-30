# Pitchey Platform - Complete Deployment Guide

## 📋 Prerequisites

1. **Cloudflare Account** with Workers and Pages enabled
2. **GitHub Account** for CI/CD
3. **Neon PostgreSQL** database
4. **Upstash Redis** for caching
5. **Node.js 18+** and **Deno** installed locally

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/pitchey.git
cd pitchey

# 2. Install dependencies
npm install
cd frontend && npm install && cd ..

# 3. Set up secrets
npm run secrets:setup

# 4. Deploy to Cloudflare
npm run deploy:production
```

## 🔐 Environment Setup

### 1. Cloudflare Secrets

Run the interactive setup script:
```bash
./scripts/setup-secrets.sh
```

Or manually set each secret:
```bash
# Required secrets
wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN

# Optional but recommended
wrangler secret put SENTRY_DSN
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put SENDGRID_API_KEY
wrangler secret put ADMIN_TOKEN
```

### 2. GitHub Actions Secrets

In your GitHub repository settings, add these secrets:

- `CLOUDFLARE_API_TOKEN` - Get from Cloudflare dashboard
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `PRODUCTION_URL` - https://pitchey-api-prod.ndlovucavelle.workers.dev
- `VITE_API_URL` - Same as PRODUCTION_URL
- `VITE_WS_URL` - wss://pitchey-api-prod.ndlovucavelle.workers.dev
- `VITE_SENTRY_DSN` - Sentry DSN for frontend
- `SLACK_WEBHOOK` - For deployment notifications (optional)
- `DATADOG_API_KEY` - For metrics (optional)
- `SONAR_TOKEN` - For code quality (optional)

## 📦 Deployment Process

### Manual Deployment

```bash
# 1. Build the application
npm run build

# 2. Run tests
npm run test:ci

# 3. Deploy Worker
npm run deploy:production

# 4. Deploy Frontend
cd frontend
npx wrangler pages deploy dist --project-name=pitchey

# 5. Run migrations
npm run db:migrate:prod

# 6. Warm cache
npm run cache:warm

# 7. Verify deployment
npm run health:check
```

### Automated Deployment (GitHub Actions)

Push to main branch triggers automatic deployment:

1. **CI Pipeline** - Runs tests, security scans, and builds
2. **Deploy Worker** - Deploys to Cloudflare Workers
3. **Deploy Pages** - Deploys frontend to Cloudflare Pages
4. **Run Migrations** - Updates database schema
5. **Cache Warming** - Preloads frequently accessed data
6. **Health Check** - Verifies deployment success
7. **Rollback** - Automatic rollback on failure

### Staging Deployment

```bash
# Deploy to staging environment
npm run deploy:staging

# Or trigger via GitHub Actions
# Select 'staging' environment in workflow dispatch
```

## 🏗️ Infrastructure Components

### Cloudflare Workers
- **Main Worker**: `pitchey-production`
- **Entry Point**: `src/worker-integrated.ts`
- **Features**: 40+ API endpoints, authentication, caching

### Cloudflare Pages
- **Project**: `pitchey`
- **Build Output**: `frontend/dist`
- **Custom Domain**: pitchey.com (optional)

### Database (Neon PostgreSQL)
- **Connection Pooling**: Via Hyperdrive
- **Migrations**: Automatic via GitHub Actions
- **Backup**: Daily automated backups

### Caching (Upstash Redis)
- **Multi-layer**: Memory → KV → Redis
- **Cache Warming**: Every 5 minutes
- **TTL Strategy**: Varies by endpoint

### Monitoring
- **Sentry**: Error tracking
- **Analytics Engine**: Metrics collection
- **Health Checks**: Every 10 minutes
- **Prometheus Metrics**: `/metrics` endpoint

## 🔄 Continuous Integration

### Test Suites
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# API tests
npm run test:api

# Load tests
npm run test:load

# End-to-end tests
npm run test:e2e:smoke
```

### Code Quality
```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

### Security Scanning
- Trivy vulnerability scanner
- npm audit
- SonarCloud analysis

## 📊 Monitoring & Maintenance

### Health Monitoring
```bash
# Check health status
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/health

# Detailed health check
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/health?detailed=true

# View metrics
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/metrics
```

### Performance Monitoring
```bash
# Run performance tests
npm run perf:test

# Light load test
npm run perf:test:light

# Heavy load test
npm run perf:test:heavy
```

### Cache Management
```bash
# Warm cache manually
npm run cache:warm

# Clear cache (requires admin token)
curl -X DELETE https://pitchey-api-prod.ndlovucavelle.workers.dev/api/admin/cache \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Database Management
```bash
# Check migration status
npm run db:migrate:status

# Rollback last migration
npm run db:migrate:rollback

# Health check
npm run db:health-check
```

## 🔥 Rollback Procedures

### Automatic Rollback
GitHub Actions automatically rolls back on deployment failure.

### Manual Rollback
```bash
# Rollback Worker
wrangler rollback --env production

# Rollback to specific deployment
wrangler deployments list
wrangler rollback --deployment-id=<ID>

# Rollback database migration
npm run db:migrate:rollback
```

## 📅 Scheduled Tasks

Configured cron jobs (via GitHub Actions):
- **Every 5 minutes**: Cache warming
- **Every 10 minutes**: Health checks
- **Every 30 minutes**: Metrics aggregation
- **Daily at 2 AM UTC**: Database cleanup, backups
- **Weekly**: Performance tests

## 🆘 Troubleshooting

### Common Issues

1. **Deployment fails with "Script too large"**
   - Check bundle size: `npm run build:worker`
   - Remove unused dependencies
   - Use dynamic imports for large modules

2. **Database connection errors**
   - Verify DATABASE_URL secret
   - Check Hyperdrive configuration
   - Ensure IP allowlist in Neon

3. **CORS errors**
   - Update CORS_ORIGINS in wrangler.toml
   - Verify FRONTEND_URL environment variable

4. **Cache not working**
   - Check Redis connection
   - Verify KV namespace bindings
   - Review cache middleware configuration

### Debug Commands
```bash
# View real-time logs
wrangler tail

# Check worker status
wrangler deployments list

# Test specific endpoint
curl -X GET https://pitchey-api-prod.ndlovucavelle.workers.dev/api/test \
  -H "Content-Type: application/json"

# View error details in Sentry
# Go to https://sentry.io/organizations/YOUR_ORG/issues/
```

## 📈 Performance Optimization

### Edge Caching Strategy
- Static assets: 7 days
- API responses: 1-5 minutes
- User-specific: 30-60 seconds
- Real-time data: No caching

### Database Optimization
- Connection pooling via Hyperdrive
- Indexed queries
- Prepared statements
- Read replicas for heavy queries

### Bundle Size Optimization
```bash
# Analyze bundle
npm run build:worker -- --analyze

# Tree shake unused code
npm run build:worker -- --tree-shaking

# Minify output
npm run build:worker -- --minify
```

## 🔗 Useful Links

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Neon Console**: https://console.neon.tech
- **Upstash Console**: https://console.upstash.com
- **Sentry Dashboard**: https://sentry.io
- **GitHub Actions**: https://github.com/your-org/pitchey/actions

## 📝 Deployment Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Security scan clean
- [ ] Database migrations reviewed
- [ ] Secrets configured
- [ ] Monitoring alerts set up
- [ ] Backup verified
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Team notified

## 🎉 Post-Deployment

After successful deployment:

1. **Verify all endpoints**: Run smoke tests
2. **Check metrics**: Monitor for anomalies
3. **Test critical flows**: Login, create pitch, NDA flow
4. **Monitor error rates**: Check Sentry dashboard
5. **Review performance**: Check response times
6. **Update status page**: If applicable
7. **Announce release**: Notify stakeholders

## 💡 Tips

- Use staging environment for testing
- Always backup before major changes
- Monitor metrics after deployment
- Keep dependencies updated
- Document any custom configurations
- Test rollback procedures regularly

## 🤝 Support

For deployment issues:
1. Check logs: `wrangler tail`
2. Review GitHub Actions logs
3. Check Sentry for errors
4. Contact DevOps team
5. Escalate to Cloudflare support if needed

---

Last updated: December 2024
Version: 1.0.0