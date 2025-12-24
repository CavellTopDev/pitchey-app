# 🚀 Pitchey Platform - Quick Reference Card
**For Platform Operators & Support Team**

## 🔑 Essential Commands

### Health Checks
```bash
# Quick health check
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health

# Full system check
./health-check.js

# Continuous monitoring
./monitor-continuous.sh
```

### Logs & Debugging
```bash
# Worker logs (live)
wrangler tail --format pretty

# Error logs only
wrangler tail --format pretty | grep ERROR

# Database logs
DATABASE_URL="..." psql -c "SELECT * FROM logs ORDER BY created_at DESC LIMIT 20;"
```

### Deployment
```bash
# Deploy everything
./deploy-production.sh all

# Deploy frontend only
wrangler pages deploy frontend/dist --project-name=pitchey

# Deploy worker only
wrangler deploy

# Rollback
wrangler rollback [deployment-id]
```

---

## 🌐 Important URLs

### Production
- **Frontend**: https://pitchey.pages.dev
- **API**: https://pitchey-production.cavelltheleaddev.workers.dev
- **Health**: https://pitchey-production.cavelltheleaddev.workers.dev/api/health
- **Metrics**: https://pitchey-production.cavelltheleaddev.workers.dev/api/metrics

### Dashboards
- **Cloudflare**: https://dash.cloudflare.com
- **Neon DB**: https://console.neon.tech
- **Monitoring**: file:///path/to/monitoring-dashboard.html

---

## 🔐 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Creator | alex.creator@demo.com | Demo123 |
| Investor | sarah.investor@demo.com | Demo123 |
| Production | stellar.production@demo.com | Demo123 |

---

## 🛠️ Common Fixes

### High Response Time
```bash
# Clear cache
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/cache/clear

# Check database
DATABASE_URL="..." psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';"
```

### Authentication Issues
```bash
# Reset JWT secret
wrangler secret put JWT_SECRET

# Clear sessions
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/clear-sessions
```

### Database Connection Errors
```bash
# Reset pool
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/db/reset-pool

# Check connections
DATABASE_URL="..." psql -c "SELECT count(*) FROM pg_stat_activity;"
```

### Upload Failures
```bash
# Check R2 bucket
wrangler r2 bucket list

# Test upload endpoint
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/upload/test
```

---

## 📊 Key Metrics

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Response Time | <500ms | 500-1000ms | >1000ms |
| Error Rate | <0.5% | 0.5-1% | >1% |
| CPU Usage | <70% | 70-85% | >85% |
| Memory | <80% | 80-90% | >90% |
| DB Connections | <80% | 80-90% | >90% |

---

## 🚨 Emergency Procedures

### 1. Service Down
```bash
# Quick restart
wrangler deploy --force

# Switch to maintenance mode
wrangler deploy --env maintenance
```

### 2. Database Issues
```bash
# Kill all connections
DATABASE_URL="..." psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid();"

# Restart connection pool
wrangler secret put DATABASE_URL --force
```

### 3. Security Incident
```bash
# Rotate all secrets
wrangler secret put JWT_SECRET
wrangler secret put DATABASE_URL
wrangler secret put API_KEY

# Block suspicious IPs
wrangler deploy --env security-lockdown
```

---

## 📱 On-Call Procedures

### Alert Response
1. **Acknowledge** within 15 minutes
2. **Assess** severity and impact
3. **Communicate** status to team
4. **Resolve** or escalate
5. **Document** in incident log

### Escalation Path
1. L1: On-call Engineer (15 min)
2. L2: Team Lead (30 min)
3. L3: Platform Architect (1 hour)
4. L4: External Support (2 hours)

---

## 📝 Useful SQL Queries

```sql
-- Active users in last hour
SELECT COUNT(DISTINCT user_id) FROM sessions 
WHERE last_activity > NOW() - INTERVAL '1 hour';

-- Top errors today
SELECT error_message, COUNT(*) as count 
FROM error_logs 
WHERE created_at > CURRENT_DATE 
GROUP BY error_message 
ORDER BY count DESC LIMIT 10;

-- Slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC LIMIT 10;

-- Database size
SELECT pg_database_size('pitchey') / 1024 / 1024 as size_mb;

-- Table sizes
SELECT tablename, 
       pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(tablename::regclass) DESC;
```

---

## 🔄 Daily Checklist

- [ ] Check health endpoint
- [ ] Review error logs
- [ ] Check response times
- [ ] Verify backups
- [ ] Monitor disk space
- [ ] Check security alerts
- [ ] Review metrics dashboard
- [ ] Test critical user flows

---

## 📞 Support Contacts

| Service | Contact | Hours |
|---------|---------|-------|
| Cloudflare | support.cloudflare.com | 24/7 |
| Neon DB | neon.tech/support | Business |
| Upstash | upstash.com/support | 24/7 |
| Internal | #platform-ops | 24/7 |

---

## 🎯 Remember

1. **Stay calm** during incidents
2. **Communicate** status updates
3. **Document** everything
4. **Test** before deploying
5. **Monitor** after changes
6. **Escalate** when needed

---

**Keep this card handy during on-call shifts!**

Last Updated: December 24, 2024  
Version: 1.0.0