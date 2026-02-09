# 🚨 Emergency Response Playbook

**Platform**: Pitchey Movie Pitch Platform  
**Account**: ndlovucavelle@gmail.com  
**Infrastructure**: Cloudflare Workers + Pages + Neon PostgreSQL

---

## 📞 Emergency Contact Information

### 🔥 Critical Services
- **Cloudflare Status**: https://www.cloudflarestatus.com
- **Cloudflare Support**: https://support.cloudflare.com
- **Neon Support**: https://neon.tech/docs/introduction/support
- **GitHub Status**: https://www.githubstatus.com

### 🎯 Quick Access URLs
- **Production Frontend**: https://pitchey-5o8.pages.dev
- **Production API**: https://pitchey-optimized.ndlovucavelle.workers.dev
- **Health Check**: https://pitchey-optimized.ndlovucavelle.workers.dev/api/health
- **Cloudflare Dashboard**: https://dash.cloudflare.com

---

## 🚨 Incident Classification

### 🔴 P0 - Critical (System Down)
**Symptoms**: Site completely inaccessible, 5xx errors, authentication totally broken
**Response Time**: Immediate (0-15 minutes)
**Escalation**: Full rollback, emergency procedures

### 🟡 P1 - High (Major Feature Broken)
**Symptoms**: Key features not working, significant user impact
**Response Time**: 30 minutes
**Escalation**: Targeted rollback, hotfix deployment

### 🟢 P2 - Medium (Minor Issues)
**Symptoms**: Some features degraded, performance issues
**Response Time**: 2 hours
**Escalation**: Standard debugging, scheduled fix

---

## 🛠️ Emergency Response Procedures

### Step 1: Immediate Assessment (2 minutes)

```bash
# Quick health check
curl -f https://pitchey-optimized.ndlovucavelle.workers.dev/api/health

# Check Cloudflare status
curl -f https://pitchey-5o8.pages.dev

# Monitor worker logs in real-time
wrangler tail
```

**Decision Matrix**:
- ✅ Both respond normally → Monitor and investigate
- ❌ Worker down, Frontend up → Worker issue (proceed to Step 2A)
- ✅ Worker up, Frontend down → Frontend issue (proceed to Step 2B)
- ❌ Both down → Full system issue (proceed to Step 2C)

### Step 2A: Worker Emergency Response

```bash
# Check recent deployments
wrangler deployments list

# View worker analytics
echo "Check Cloudflare Dashboard → Workers → Analytics"

# Emergency worker rollback
./scripts/rollback-deployment.sh --worker --force

# If rollback fails, deploy maintenance mode
./scripts/rollback-deployment.sh --worker --secrets --force
```

### Step 2B: Frontend Emergency Response

```bash
# Check Pages deployment status
wrangler pages deployment list --project-name=pitchey

# Emergency frontend rollback
./scripts/rollback-deployment.sh --frontend --force

# Monitor deployment
echo "Check Cloudflare Dashboard → Pages → Deployments"
```

### Step 2C: Full System Emergency Response

```bash
# Nuclear option - full rollback
./scripts/rollback-deployment.sh --all --force

# Verify maintenance mode is working
curl https://pitchey-optimized.ndlovucavelle.workers.dev/api/health
curl https://pitchey-5o8.pages.dev
```

---

## 🔍 Diagnostic Commands

### System Health Checks
```bash
# Comprehensive validation
./scripts/validate-production.sh

# Monitor real-time logs
wrangler tail --format=pretty

# Check worker resource usage
wrangler metrics

# Database connectivity test
curl -X POST https://pitchey-optimized.ndlovucavelle.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

### Performance Diagnostics
```bash
# API response time test
time curl -s https://pitchey-optimized.ndlovucavelle.workers.dev/api/health

# Frontend load test
time curl -s https://pitchey-5o8.pages.dev > /dev/null

# Worker CPU/Memory check (in dashboard)
echo "Cloudflare Dashboard → Workers → Analytics → Performance"
```

### Security Incident Checks
```bash
# Check for suspicious activity in logs
wrangler tail --grep="error\|fail\|attack\|suspicious"

# Validate JWT configuration
curl -X POST https://pitchey-optimized.ndlovucavelle.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' | jq '.data.token'

# Check CORS configuration
curl -H "Origin: https://malicious.com" \
  -I https://pitchey-optimized.ndlovucavelle.workers.dev/api/health
```

---

## 🛡️ Common Emergency Scenarios

### Scenario 1: "Site is Down" 🔥

**Symptoms**: Users report site completely inaccessible
**Quick Response**:
```bash
# Check basic connectivity
curl -I https://pitchey-5o8.pages.dev
curl -I https://pitchey-optimized.ndlovucavelle.workers.dev

# If both fail, check Cloudflare status
curl -s https://www.cloudflarestatus.com/api/v2/status.json

# Emergency rollback
./scripts/rollback-deployment.sh --all --force
```

### Scenario 2: "Authentication is Broken" 🔐

**Symptoms**: Users cannot log in, JWT errors
**Quick Response**:
```bash
# Test demo login
curl -X POST https://pitchey-optimized.ndlovucavelle.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# Reset JWT secrets if compromised
./scripts/rollback-deployment.sh --secrets --force

# Check worker logs for auth errors
wrangler tail --grep="auth\|jwt\|login"
```

### Scenario 3: "Database Connection Failed" 💾

**Symptoms**: Data not loading, database errors in logs
**Quick Response**:
```bash
# Check Neon database status
curl -s https://neon.tech/api/v2/projects

# Test database connectivity through API
curl https://pitchey-optimized.ndlovucavelle.workers.dev/api/search/pitches

# Disable database temporarily
echo "false" | wrangler secret put USE_DATABASE

# Check logs for database errors
wrangler tail --grep="database\|postgres\|neon"
```

### Scenario 4: "Worker Resource Limits Exceeded" ⚠️

**Symptoms**: 1102 errors, performance degradation
**Quick Response**:
```bash
# Check current worker metrics
wrangler metrics

# Deploy lightweight emergency worker
./scripts/rollback-deployment.sh --worker --force

# Monitor resource usage
echo "Check Dashboard → Workers → Analytics → Resource Usage"
```

### Scenario 5: "Frontend Build Broken" 🎨

**Symptoms**: Frontend not loading, build errors
**Quick Response**:
```bash
# Check latest Pages deployment
wrangler pages deployment list --project-name=pitchey

# Deploy emergency maintenance page
./scripts/rollback-deployment.sh --frontend --force

# Check build logs in GitHub Actions
gh run list --limit 5
gh run view --log
```

---

## 🔄 Recovery Procedures

### After Emergency Rollback

1. **Stabilize**: Ensure maintenance mode is working
   ```bash
   curl https://pitchey-optimized.ndlovucavelle.workers.dev/api/health
   curl https://pitchey-5o8.pages.dev
   ```

2. **Investigate**: Find the root cause
   ```bash
   # Check recent changes
   git log --oneline -10
   
   # Review deployment logs
   wrangler tail --since=1h
   
   # Check GitHub Actions
   gh run list --limit 10
   ```

3. **Fix**: Address the root cause
   - Fix code issues in development
   - Test thoroughly locally
   - Validate with staging if available

4. **Redeploy**: Restore normal service
   ```bash
   # Test deployment script
   ./deploy-production-orchestrated.sh
   
   # Validate restoration
   ./scripts/validate-production.sh
   ```

5. **Monitor**: Watch for recurring issues
   ```bash
   # Real-time monitoring
   wrangler tail
   
   # Performance monitoring
   watch -n 30 'curl -s https://pitchey-optimized.ndlovucavelle.workers.dev/api/health'
   ```

---

## 📋 Post-Incident Checklist

### Immediate (Within 1 hour)
- [ ] System restored to normal operation
- [ ] Health checks all passing
- [ ] User access verified with demo accounts
- [ ] Performance metrics back to normal
- [ ] No error spikes in logs

### Short Term (Within 24 hours)
- [ ] Incident post-mortem completed
- [ ] Root cause documented
- [ ] Fix verified and tested
- [ ] Monitoring enhanced if needed
- [ ] Team notified of resolution

### Long Term (Within 1 week)
- [ ] Process improvements identified
- [ ] Documentation updated
- [ ] Prevention measures implemented
- [ ] Team training if required
- [ ] Infrastructure hardening if needed

---

## 📊 Monitoring and Alerting

### Key Metrics to Monitor
- **Uptime**: Both frontend and API response codes
- **Response Time**: API < 1000ms, Frontend < 2000ms
- **Error Rate**: < 1% for API calls
- **Worker CPU**: < 80% average
- **Database Connections**: Stable connection pool

### Alert Thresholds
- **Critical**: Uptime < 95% over 5 minutes
- **Warning**: Response time > 2000ms average over 5 minutes
- **Error**: Error rate > 5% over 10 minutes
- **Resource**: Worker CPU > 90% for 5 minutes

### Manual Monitoring Commands
```bash
# Continuous health monitoring
while true; do
  echo "$(date): $(curl -s -o /dev/null -w "%{http_code} %{time_total}" https://pitchey-optimized.ndlovucavelle.workers.dev/api/health)"
  sleep 30
done

# Error rate monitoring
wrangler tail --format=json | jq 'select(.outcome == "exception")'

# Performance monitoring
time curl -s https://pitchey-optimized.ndlovucavelle.workers.dev/api/health >/dev/null
```

---

## 🎯 Emergency Contacts & Resources

### Documentation
- **Production Secrets**: `PRODUCTION_SECRETS_CONFIGURATION.md`
- **Go-Live Checklist**: `GO_LIVE_CHECKLIST.md`
- **Deployment Guide**: `CLOUDFLARE_DEPLOYMENT_GUIDE.md`
- **Architecture Overview**: `DEPLOYMENT_ARCHITECTURE.md`

### Tools & Scripts
- **Emergency Rollback**: `./scripts/rollback-deployment.sh`
- **Production Validation**: `./scripts/validate-production.sh`
- **Full Deployment**: `./deploy-production-orchestrated.sh`
- **Health Monitoring**: `curl` commands above

### External Resources
- **Cloudflare Status**: https://www.cloudflarestatus.com
- **GitHub Status**: https://www.githubstatus.com
- **Neon Status**: Check their official channels
- **Community Support**: Cloudflare Developer Discord

---

**🎯 Remember**: When in doubt, rollback first, investigate second. User experience is paramount.**

**📞 For additional support, consult Cloudflare documentation and community resources.**