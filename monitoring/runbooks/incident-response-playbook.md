# Pitchey Incident Response Playbook

## Quick Reference

**Primary Contact**: DevOps Team (devops@pitchey.app)  
**Escalation**: On-call Engineer (oncall@pitchey.app)  
**Status Page**: https://status.pitchey.app  
**Monitoring Dashboard**: https://monitoring.pitchey.app  

---

## Severity Levels

### P0 - Critical (Immediate Response)
- Service completely down
- Data loss or corruption
- Security breach
- **Response Time**: 15 minutes
- **Resolution Target**: 1 hour

### P1 - High (Urgent Response)
- Significant performance degradation
- Feature completely broken
- High error rates (>10%)
- **Response Time**: 1 hour
- **Resolution Target**: 4 hours

### P2 - Medium (Standard Response)
- Minor performance issues
- Non-critical feature issues
- Cache misses
- **Response Time**: 4 hours
- **Resolution Target**: 24 hours

### P3 - Low (Planned Response)
- Cosmetic issues
- Enhancement requests
- Documentation updates
- **Response Time**: Next business day
- **Resolution Target**: 1 week

---

## Alert Response Matrix

| Alert Type | Severity | First Response | Escalation |
|------------|----------|----------------|------------|
| WorkerDown | P0 | DevOps Engineer | CTO + Engineering Lead |
| FrontendDown | P0 | DevOps Engineer | CTO + Product Lead |
| DatabaseConnectionError | P0 | Backend Engineer | DevOps Lead |
| HighResponseTime | P1 | Performance Team | DevOps Engineer |
| LowCacheHitRate | P2 | DevOps Engineer | Performance Team |
| SSLCertificateExpired | P0 | Security Team | DevOps Lead |
| UnusualTrafficPattern | P2 | Security Team | DevOps Engineer |

---

## Common Incident Scenarios

### 1. Worker Service Down

**Symptoms:**
- API returning 5xx errors
- Monitoring showing WorkerDown alert
- Users unable to access application

**Immediate Actions:**
1. **Check Cloudflare Worker status:**
   ```bash
   # Check worker deployment
   wrangler whoami
   wrangler status
   
   # Check recent deployments
   wrangler deployments list
   ```

2. **Verify service endpoints:**
   ```bash
   # Test main health endpoint
   curl -I https://pitchey-production.cavelltheleaddev.workers.dev/api/health
   
   # Test detailed health
   curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health/detailed
   ```

3. **Check Cloudflare dashboard:**
   - Login to Cloudflare dashboard
   - Check worker analytics for errors
   - Review worker logs and exceptions

**Investigation Steps:**
```bash
# Check recent deployments
wrangler tail --format=pretty

# Review metrics
curl "https://api.cloudflare.com/client/v4/accounts/e16d3bf549153de23459a6c6a06a431b/workers/scripts/pitchey-production/metrics" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# Check database connectivity
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health/db
```

**Resolution:**
1. If deployment issue: rollback to previous version
2. If code issue: hotfix and redeploy
3. If infrastructure: contact Cloudflare support

### 2. Database Connection Issues

**Symptoms:**
- DatabaseConnectionError alert
- API returning database timeout errors
- High response times on data endpoints

**Immediate Actions:**
1. **Check Neon dashboard:**
   - Login to Neon console
   - Check database status and metrics
   - Review connection pool utilization

2. **Test database connectivity:**
   ```bash
   # Test via health endpoint
   curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health/detailed
   
   # Check Hyperdrive status
   # (via Cloudflare dashboard > Hyperdrive)
   ```

**Investigation Steps:**
```bash
# Check connection string and secrets
wrangler secret list

# Test direct database connection (if available)
psql "$DATABASE_URL" -c "SELECT 1;"

# Review worker logs for database errors
wrangler tail --format=pretty | grep -i "database\|neon\|sql"
```

**Resolution:**
1. If Neon outage: wait for service restoration
2. If connection pool: restart Hyperdrive or adjust limits
3. If credentials: rotate database secrets
4. If query performance: identify and optimize slow queries

### 3. High Response Times

**Symptoms:**
- HighResponseTime alert triggered
- Users reporting slow page loads
- Monitoring showing >2s response times

**Immediate Actions:**
1. **Check performance metrics:**
   ```bash
   # Run performance test
   ./monitoring/performance/monitor-live.sh
   
   # Check cache hit rates
   curl -I https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/browse/enhanced
   ```

2. **Identify bottlenecks:**
   - Review worker CPU time in Cloudflare dashboard
   - Check database query performance in Neon
   - Analyze cache hit/miss ratios

**Investigation Steps:**
```bash
# Profile endpoint performance
for i in {1..10}; do
  curl -w "Time: %{time_total}s\n" -o /dev/null -s \
    "https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/browse/enhanced?limit=10"
done

# Check slow queries
# (Review in Neon dashboard Query tab)

# Analyze cache performance
grep "cache" ./monitoring/logs/*.log | tail -20
```

**Resolution:**
1. Database optimization: add indexes, optimize queries
2. Cache optimization: increase TTL, add edge caching
3. Code optimization: reduce computational complexity
4. Resource scaling: upgrade Neon plan if needed

### 4. Frontend Service Down

**Symptoms:**
- FrontendDown alert
- Users unable to access https://pitchey.pages.dev
- 404 or 5xx errors on frontend

**Immediate Actions:**
1. **Check Cloudflare Pages status:**
   ```bash
   # Check deployment status
   npx wrangler pages deployment list --project-name=pitchey
   
   # Check last successful deployment
   npx wrangler pages deployment list --project-name=pitchey --compatibility-date=2024-11-01
   ```

2. **Verify DNS and routing:**
   ```bash
   # Check DNS resolution
   nslookup pitchey.pages.dev
   
   # Test direct page access
   curl -I https://pitchey.pages.dev
   ```

**Resolution:**
1. If deployment failed: redeploy from last known good commit
2. If Pages service issue: check Cloudflare status page
3. If DNS issue: verify domain configuration

### 5. SSL Certificate Issues

**Symptoms:**
- SSLCertificateExpired alert
- Browser showing security warnings
- HTTPS connections failing

**Immediate Actions:**
1. **Check certificate status:**
   ```bash
   # Check certificate expiry
   echo | openssl s_client -servername pitchey.pages.dev -connect pitchey.pages.dev:443 2>/dev/null | openssl x509 -noout -dates
   
   # Check worker certificate
   echo | openssl s_client -servername pitchey-production.cavelltheleaddev.workers.dev -connect pitchey-production.cavelltheleaddev.workers.dev:443 2>/dev/null | openssl x509 -noout -dates
   ```

**Resolution:**
1. Cloudflare manages certificates automatically
2. If custom domain: renew certificate in Cloudflare dashboard
3. If subdomain issue: check DNS and SSL settings

---

## Emergency Contacts

### Internal Team
- **DevOps Lead**: +1-555-0101
- **Backend Lead**: +1-555-0102  
- **Frontend Lead**: +1-555-0103
- **Security Lead**: +1-555-0104
- **CTO**: +1-555-0100

### External Services
- **Cloudflare Support**: Enterprise support portal
- **Neon Support**: support@neon.tech
- **Upstash Support**: support@upstash.com

---

## Post-Incident Activities

### Immediate (Within 2 hours)
1. **Update status page** with resolution
2. **Send customer communication** if user-facing
3. **Document timeline** of incident and resolution
4. **Update monitoring** if gaps were identified

### Short-term (Within 24 hours)
1. **Create incident report** with root cause analysis
2. **Schedule post-mortem meeting** with involved teams
3. **Create follow-up tasks** for prevention
4. **Update runbooks** with new learnings

### Long-term (Within 1 week)
1. **Implement preventive measures** identified in post-mortem
2. **Update monitoring and alerting** to catch similar issues
3. **Conduct team training** on new procedures
4. **Share learnings** with broader engineering team

---

## Useful Commands Reference

```bash
# Quick health check
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health

# Detailed system status
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health/detailed

# Check worker logs
wrangler tail --format=pretty

# Deploy emergency fix
wrangler deploy

# Rollback deployment
wrangler rollback [DEPLOYMENT_ID]

# Check secrets
wrangler secret list

# Update secret
wrangler secret put SECRET_NAME

# Performance monitoring
./monitoring/performance/monitor-live.sh

# View recent alerts
tail -f ./monitoring/logs/alerts.log

# Check monitoring dashboard
open https://monitoring.pitchey.app
```

---

## Communication Templates

### Status Page Update
```
[INCIDENT] Service Disruption - [TIMESTAMP]

We are currently investigating reports of [ISSUE DESCRIPTION]. 
Our team is actively working on a resolution.

Next update: [TIME]
Estimated resolution: [TIME]
```

### Resolution Update
```
[RESOLVED] Service Restored - [TIMESTAMP]

The issue affecting [SERVICE] has been resolved. 
All services are operating normally.

Cause: [BRIEF DESCRIPTION]
Resolution: [ACTION TAKEN]

We apologize for any inconvenience caused.
```

### Internal Escalation
```
Subject: [P0] URGENT: Pitchey Service Down

Incident: [BRIEF DESCRIPTION]
Impact: [USER IMPACT]
Started: [TIMESTAMP]
Owner: [ENGINEER NAME]

Current Status: [STATUS]
Next Steps: [ACTIONS]
ETA: [ESTIMATE]

Join War Room: [LINK]
```
