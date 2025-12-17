# Pitchey Platform - Emergency Rollback Plan
*Fast and safe rollback procedures for production incidents*

## Overview
This document provides step-by-step procedures for quickly rolling back the Pitchey platform in case of deployment issues or production incidents.

## When to Execute Rollback

### Critical Indicators
- [ ] **Service Unavailable**: Worker returning 5xx errors consistently
- [ ] **Database Connection Failures**: Authentication or connection errors
- [ ] **Authentication Breakdown**: Users cannot log in to any portal
- [ ] **Data Corruption Risk**: Incorrect data being returned or stored
- [ ] **Performance Degradation**: Response times > 10 seconds consistently

### Assessment Checklist (30-second decision)
1. **Traffic Impact**: > 10% error rate for > 2 minutes
2. **User Reports**: Multiple user reports of critical functionality failure
3. **Monitoring Alerts**: Critical alerts from multiple systems
4. **Business Impact**: Revenue-affecting features down

## Immediate Response (0-2 minutes)

### Step 1: Incident Declaration
```bash
# Immediately notify team
echo "INCIDENT: Pitchey production deployment issue - executing rollback" | tee -a /tmp/incident.log

# Start incident timer
INCIDENT_START=$(date +%s)
echo "Incident start time: $(date)" >> /tmp/incident.log
```

### Step 2: Traffic Assessment
```bash
# Quick health check
curl -f https://pitchey-production.cavelltheleaddev.workers.dev/api/health || echo "HEALTH CHECK FAILED"

# Test core endpoints (30-second timeout total)
./test-all-endpoints.sh --test-type=health --timeout=5 --verbose
```

## Rollback Procedures

### Option 1: Worker Code Rollback (Fastest - 30 seconds)

#### 1A: Revert to Previous Worker Version
```bash
# Check current deployment
wrangler deployments list --name pitchey-production

# Rollback to previous version (replace DEPLOYMENT_ID with actual ID)
wrangler rollback [DEPLOYMENT_ID] --name pitchey-production

# Immediate verification
sleep 10
curl -f https://pitchey-production.cavelltheleaddev.workers.dev/api/health
```

#### 1B: Deploy Known Good Worker
```bash
# Use backup worker file
cp src/worker-production-db.backup.$(date +%Y%m%d)*.ts src/worker-production-db.ts

# Update wrangler.toml to use backup worker
sed -i 's/worker-production-db-fixed\.ts/worker-production-db.ts/' wrangler.toml

# Fast deployment
wrangler deploy --compatibility-date=2024-11-01

# Immediate verification
sleep 15
./test-all-endpoints.sh --test-type=auth --timeout=10
```

### Option 2: Configuration Rollback (1-2 minutes)

#### 2A: Secret Restoration
```bash
# If database credentials were recently changed
wrangler secret put DATABASE_URL --name pitchey-production
# Enter previous known-good DATABASE_URL when prompted

# If JWT secret was rotated
wrangler secret put JWT_SECRET --name pitchey-production
# Enter previous JWT_SECRET

# Test authentication immediately
./test-all-endpoints.sh --test-type=auth --timeout=5
```

#### 2B: Environment Variable Reset
```bash
# Restore wrangler.toml from backup
cp wrangler.toml.backup.$(ls -t wrangler.toml.backup.* | head -1) wrangler.toml

# Redeploy with previous configuration
wrangler deploy

# Verify functionality
curl -f https://pitchey-production.cavelltheleaddev.workers.dev/api/creator/dashboard
```

### Option 3: Emergency Maintenance Mode (Last Resort)

#### 3A: Deploy Minimal Worker
```bash
# Create emergency maintenance worker
cat > emergency-worker.js << 'EOF'
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({
        status: 'maintenance',
        message: 'Platform temporarily unavailable - maintenance in progress'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Platform temporarily unavailable', { status: 503 });
  }
};
EOF

# Update wrangler.toml to use emergency worker
sed -i 's/main = .*/main = "emergency-worker.js"/' wrangler.toml

# Deploy emergency worker
wrangler deploy --name pitchey-production
```

#### 3B: Activate Maintenance Page
```bash
# Deploy maintenance page to Cloudflare Pages
echo '<!DOCTYPE html><html><head><title>Maintenance</title></head><body><h1>Platform Maintenance</h1><p>We are currently performing maintenance. Please try again in a few minutes.</p></body></html>' > maintenance.html

# This would need to be handled via Cloudflare dashboard or API
# Add redirect rule: pitchey.pages.dev/* -> maintenance.html
```

## Post-Rollback Verification (2-5 minutes)

### Step 1: Core Functionality Test
```bash
# Run comprehensive endpoint tests
./test-all-endpoints.sh --test-type=core --verbose

# Verify dashboard data
curl -H "Authorization: Bearer $DEMO_TOKEN" \
  https://pitchey-production.cavelltheleaddev.workers.dev/api/creator/dashboard

# Test authentication flows
./test-all-endpoints.sh --test-type=auth
```

### Step 2: Database Connectivity
```bash
# Test database queries (if accessible)
# This would require direct database access tools

# Verify through API endpoints
curl -f https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/public
curl -f https://pitchey-production.cavelltheleaddev.workers.dev/api/user/stats
```

### Step 3: Cache and Redis
```bash
# Test Redis connectivity through endpoints that use caching
curl -f https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/browse/enhanced

# Check for cache hit/miss patterns in responses
```

## Incident Resolution (5-30 minutes)

### Step 1: Root Cause Analysis
```bash
# Check wrangler logs for errors
wrangler tail --name pitchey-production --format pretty

# Review recent deployments
wrangler deployments list --name pitchey-production

# Check secret configuration
wrangler secret list --name pitchey-production
```

### Step 2: Fix Validation
```bash
# Test fixes in staging first
wrangler deploy --env staging --name pitchey-staging

# Run full test suite against staging
./test-all-endpoints.sh --environment=staging --test-type=full

# Performance test
./test-all-endpoints.sh --environment=staging --timeout=3
```

### Step 3: Gradual Re-deployment
```bash
# Deploy fix to production
wrangler deploy --name pitchey-production

# Monitor for 5 minutes
for i in {1..10}; do
  echo "Monitoring check $i/10..."
  ./test-all-endpoints.sh --test-type=health
  sleep 30
done
```

## Escalation Procedures

### Level 1: Technical Team (0-5 minutes)
- **Primary**: Lead developer
- **Secondary**: Platform engineer
- **Actions**: Execute rollback, investigate technical issues

### Level 2: Management (5-15 minutes)
- **Primary**: Engineering manager
- **Secondary**: Product manager  
- **Actions**: Business impact assessment, customer communication

### Level 3: Executive (15+ minutes)
- **Primary**: CTO
- **Secondary**: CEO
- **Actions**: External communication, vendor escalation

## Communication Templates

### Internal Alert
```
🚨 PRODUCTION INCIDENT - Pitchey Platform

Status: Rollback in progress
Impact: [USER_IMPACT]
ETA: [ESTIMATED_RESOLUTION]
Lead: [INCIDENT_COMMANDER]

Timeline:
- [TIME]: Issue detected
- [TIME]: Rollback initiated
- [TIME]: Rollback completed
- [TIME]: Verification in progress

Next update: [TIME]
```

### User Communication
```
We are currently experiencing technical difficulties with the Pitchey platform. 
Our team is working to resolve this quickly. 
Estimated resolution: [TIME]
Updates: [STATUS_PAGE_URL]
```

## Post-Incident Checklist

### Immediate (0-1 hour)
- [ ] Confirm all functionality restored
- [ ] Document timeline and actions taken
- [ ] Notify stakeholders of resolution
- [ ] Update monitoring and alerting

### Short-term (1-24 hours)
- [ ] Root cause analysis completed
- [ ] Fix developed and tested
- [ ] Monitoring improvements identified
- [ ] Process improvements documented

### Long-term (1-7 days)
- [ ] Post-mortem meeting scheduled
- [ ] Prevention measures implemented
- [ ] Documentation updated
- [ ] Team training conducted

## Emergency Contacts

### Technical Escalation
```
Primary: [LEAD_DEVELOPER_PHONE]
Secondary: [PLATFORM_ENGINEER_PHONE]
Vendor Support: [CLOUDFLARE_SUPPORT]
Database Support: [NEON_SUPPORT]
```

### Business Escalation
```
Engineering Manager: [MANAGER_PHONE]
Product Manager: [PM_PHONE]
CTO: [CTO_PHONE]
```

## Quick Reference Commands

```bash
# Immediate rollback
wrangler rollback [DEPLOYMENT_ID] --name pitchey-production

# Health check
curl -f https://pitchey-production.cavelltheleaddev.workers.dev/api/health

# Test endpoints
./test-all-endpoints.sh --test-type=core --timeout=5

# View logs
wrangler tail --name pitchey-production

# List deployments
wrangler deployments list --name pitchey-production

# Emergency deploy
wrangler deploy --name pitchey-production --compatibility-date=2024-11-01
```

---

## Recovery Time Objectives (RTO)

| Severity | Target RTO | Acceptable RTO |
|----------|------------|----------------|
| P0 (Service Down) | 2 minutes | 5 minutes |
| P1 (Major Function Down) | 5 minutes | 15 minutes |
| P2 (Performance Issues) | 15 minutes | 30 minutes |
| P3 (Minor Issues) | 1 hour | 4 hours |

## Recovery Point Objectives (RPO)

| Data Type | Target RPO | Acceptable RPO |
|-----------|------------|----------------|
| User Data | 0 minutes | 5 minutes |
| Session Data | 5 minutes | 15 minutes |
| Cache Data | 15 minutes | 1 hour |
| Analytics | 1 hour | 24 hours |

---
*Last updated: December 16, 2024*
*Document version: 1.0*
*Next review: January 16, 2025*