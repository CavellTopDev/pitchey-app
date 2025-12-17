# Pitchey Production Deployment Plan
*Zero-downtime deployment strategy for Cloudflare Workers*

## Overview
This deployment plan ensures a safe, zero-downtime deployment of the Pitchey platform with proper testing and rollback capabilities.

## Pre-deployment Checklist

### 1. Environment Verification
- [ ] Verify current worker is responsive: `curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health`
- [ ] Check Cloudflare dashboard access
- [ ] Verify Neon database connectivity
- [ ] Confirm all secrets are properly configured

### 2. Credential Rotation (If Needed)
If database connection issues exist, likely the Neon password has been rotated:

```bash
# Update database credentials
./update-secrets.sh
```

### 3. Code Preparation
- [ ] Ensure `worker-production-db-fixed.ts` is ready for deployment
- [ ] Update wrangler.toml main entry point to use fixed worker
- [ ] Verify all dependencies are up to date

## Deployment Steps

### Phase 1: Pre-deployment Validation

#### 1.1 Test Current System
```bash
# Run comprehensive endpoint tests
./test-all-endpoints.sh --environment=production --pre-check
```

#### 1.2 Backup Current Configuration
```bash
# Backup current wrangler.toml
cp wrangler.toml wrangler.toml.backup.$(date +%Y%m%d_%H%M%S)

# Backup current worker
cp src/worker-production-db.ts src/worker-production-db.backup.$(date +%Y%m%d_%H%M%S).ts
```

### Phase 2: Staging Deployment

#### 2.1 Deploy to Staging Environment
```bash
# Create temporary staging environment
wrangler deploy --env staging --name pitchey-staging
```

#### 2.2 Test Staging Environment
```bash
# Test all endpoints against staging
./test-all-endpoints.sh --environment=staging --full-test
```

### Phase 3: Production Deployment

#### 3.1 Update Configuration
```bash
# Update wrangler.toml to use fixed worker
sed -i 's/worker-production-db\.ts/worker-production-db-fixed.ts/' wrangler.toml
```

#### 3.2 Deploy to Production
```bash
# Deploy with immediate rollback capability
wrangler deploy --compatibility-date=2024-11-01

# Verify deployment
echo "Waiting 30 seconds for deployment to propagate..."
sleep 30
```

#### 3.3 Post-deployment Verification
```bash
# Comprehensive health check
./test-all-endpoints.sh --environment=production --post-deploy

# Monitor for 5 minutes
for i in {1..10}; do
  echo "Health check $i/10..."
  curl -f https://pitchey-production.cavelltheleaddev.workers.dev/api/health || echo "FAILED"
  sleep 30
done
```

### Phase 4: Rollback Plan (If Needed)
If any issues are detected:

```bash
# Execute immediate rollback
./rollback-plan.sh --immediate
```

## Database Credentials Update Process

### Step 1: Generate New Neon Credentials
1. Access [Neon Console](https://console.neon.tech)
2. Navigate to your project
3. Go to Settings > General
4. Reset database password
5. Copy new DATABASE_URL

### Step 2: Update Cloudflare Secrets
```bash
# Update database URL
wrangler secret put DATABASE_URL
# Paste the new Neon DATABASE_URL when prompted

# Verify other secrets are still valid
wrangler secret put JWT_SECRET  # If rotation needed
wrangler secret put UPSTASH_REDIS_REST_URL  # If rotation needed
wrangler secret put UPSTASH_REDIS_REST_TOKEN  # If rotation needed
```

### Step 3: Test Database Connection
```bash
# Test database connectivity
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/health/db \
  -H "Content-Type: application/json"
```

## Key Endpoints for Testing

### Authentication Endpoints
- `POST /api/auth/creator/login`
- `POST /api/auth/investor/login`
- `POST /api/auth/production/login`
- `POST /api/auth/logout`

### Core Platform Endpoints
- `GET /api/pitches/browse/enhanced`
- `GET /api/pitches/public`
- `GET /api/pitches/:id`
- `POST /api/pitches/create`

### Social Features
- `POST /api/follows/follow`
- `POST /api/follows/unfollow`
- `GET /api/follows/stats`

### User Management
- `GET /api/user/profile`
- `GET /api/user/stats`
- `PUT /api/user/profile`

### NDA System
- `POST /api/nda/request`
- `GET /api/nda/signed`
- `PUT /api/nda/approve`

## Success Criteria

### Functional Requirements
- [ ] All authentication flows working
- [ ] Dashboard data loading correctly
- [ ] Pitch creation and browsing functional
- [ ] Follow/unfollow system operational
- [ ] NDA workflow accessible

### Performance Requirements
- [ ] API response times < 500ms (95th percentile)
- [ ] Database connection pool healthy
- [ ] Cache hit rates > 80%
- [ ] Zero 5xx errors

### Security Requirements
- [ ] Authentication tokens working
- [ ] CORS headers properly configured
- [ ] Rate limiting functional
- [ ] Input validation active

## Monitoring and Alerting

### Post-deployment Monitoring (First 24 Hours)
1. **Immediate (0-1 hour)**: Manual verification every 5 minutes
2. **Short-term (1-6 hours)**: Automated health checks every 15 minutes
3. **Medium-term (6-24 hours)**: Standard monitoring every hour

### Key Metrics to Monitor
- Response time percentiles (50th, 95th, 99th)
- Error rates by endpoint
- Database connection success rate
- Cache performance metrics
- User authentication success rate

## Emergency Contacts
- **Primary**: Deploy team lead
- **Secondary**: Database administrator  
- **Escalation**: Platform architect

## Post-deployment Tasks
1. Update deployment documentation
2. Schedule post-mortem review (within 48 hours)
3. Update monitoring dashboards
4. Communicate deployment status to stakeholders

---

## Quick Command Reference

```bash
# Deploy
wrangler deploy

# Check health
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health

# Update secrets
wrangler secret put DATABASE_URL

# Rollback
wrangler rollback --compatibility-date=2024-11-01

# Test endpoints
./test-all-endpoints.sh

# View logs
wrangler tail
```

---
*Last updated: December 16, 2024*
*Deployment target: Cloudflare Workers with Neon PostgreSQL*