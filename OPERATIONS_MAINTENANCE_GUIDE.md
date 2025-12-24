# 🔧 Pitchey Platform - Operations & Maintenance Guide
**Version**: 1.0.0  
**Date**: December 24, 2024  
**Purpose**: Day-to-day operations, maintenance tasks, and troubleshooting

## 📚 Table of Contents

1. [Daily Operations](#daily-operations)
2. [Monitoring & Alerts](#monitoring--alerts)
3. [Common Issues & Solutions](#common-issues--solutions)
4. [Performance Tuning](#performance-tuning)
5. [Database Maintenance](#database-maintenance)
6. [Security Operations](#security-operations)
7. [Backup & Recovery](#backup--recovery)
8. [Scaling Operations](#scaling-operations)
9. [Update Procedures](#update-procedures)
10. [Emergency Procedures](#emergency-procedures)

---

## 📅 Daily Operations

### Morning Checklist (9 AM)
```bash
#!/bin/bash
# Daily health check routine

echo "🌅 Starting daily health check..."

# 1. Check system health
./health-check.js

# 2. Review overnight metrics
node collect-metrics.js

# 3. Check error logs
wrangler tail --format pretty | grep ERROR | tail -20

# 4. Verify backups
ls -la backups/ | tail -5

# 5. Check disk usage
df -h | grep -E "/$|/data"

echo "✅ Daily check complete"
```

### Monitoring Dashboard
```bash
# Open monitoring dashboard
open monitoring-dashboard.html

# Or start live monitoring
./monitor-continuous.sh
```

### Key Metrics to Track
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Uptime | 99.9% | <99.5% |
| Response Time | <500ms | >1000ms |
| Error Rate | <0.5% | >1% |
| CPU Usage | <70% | >85% |
| Memory Usage | <80% | >90% |
| Database Connections | <80% | >90% |

---

## 📊 Monitoring & Alerts

### Real-Time Monitoring
```bash
# Worker logs (Cloudflare)
wrangler tail --format pretty

# Database queries (slow query log)
DATABASE_URL="..." deno run --allow-all scripts/monitor-db.ts

# Redis cache hit rate
curl -s https://pitchey-production.cavelltheleaddev.workers.dev/api/cache/stats | jq
```

### Setting Up Alerts

#### Cloudflare Alerts
1. Navigate to Cloudflare Dashboard
2. Go to Analytics > Notifications
3. Create alerts for:
   - Worker errors > 100/hour
   - Origin error rate > 1%
   - DDoS attacks detected

#### Custom Alerts Script
```javascript
// alerts/custom-monitor.js
const THRESHOLDS = {
  errorRate: 0.01,      // 1%
  responseTime: 1000,   // 1 second
  availability: 0.995   // 99.5%
};

async function checkMetrics() {
  const metrics = await fetchMetrics();
  
  if (metrics.errorRate > THRESHOLDS.errorRate) {
    await sendAlert('HIGH_ERROR_RATE', metrics);
  }
  
  if (metrics.responseTime > THRESHOLDS.responseTime) {
    await sendAlert('SLOW_RESPONSE', metrics);
  }
  
  if (metrics.availability < THRESHOLDS.availability) {
    await sendAlert('LOW_AVAILABILITY', metrics);
  }
}

// Run every 5 minutes
setInterval(checkMetrics, 5 * 60 * 1000);
```

---

## 🔧 Common Issues & Solutions

### Issue 1: High Response Times
**Symptoms**: API responses >1s, user complaints about slowness

**Diagnosis**:
```bash
# Check worker CPU time
wrangler tail --format pretty | grep "CPU time"

# Check database query performance
DATABASE_URL="..." deno run --allow-all scripts/analyze-slow-queries.ts

# Check cache hit rate
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/cache/stats
```

**Solutions**:
1. Increase cache TTL for static content
2. Optimize database queries (add indexes)
3. Enable Cloudflare Argo for better routing
4. Implement query result caching

### Issue 2: Authentication Failures
**Symptoms**: Users unable to login, session errors

**Diagnosis**:
```bash
# Check JWT secret configuration
wrangler secret list

# Verify Better Auth service
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/session \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check session storage
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/debug
```

**Solutions**:
1. Rotate JWT secret if compromised
2. Clear session cache
3. Verify cookie settings
4. Check CORS configuration

### Issue 3: Database Connection Errors
**Symptoms**: 500 errors, "connection refused", timeout errors

**Diagnosis**:
```bash
# Test direct connection
DATABASE_URL="..." psql -c "SELECT 1"

# Check connection pool
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/db/pool-stats

# Review connection limits
echo "SHOW max_connections;" | DATABASE_URL="..." psql
```

**Solutions**:
1. Restart connection pool
2. Increase max connections
3. Implement connection retry logic
4. Check firewall/security groups

### Issue 4: File Upload Failures
**Symptoms**: Upload errors, timeouts, missing files

**Diagnosis**:
```bash
# Check R2 bucket status
wrangler r2 bucket list

# Verify upload endpoint
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/upload/test

# Check file size limits
curl https://pitchey-production.cavelltheleaddev.workers.dev/api/config | jq .upload
```

**Solutions**:
1. Increase upload timeout
2. Check R2 bucket permissions
3. Implement chunked uploads
4. Add retry mechanism

---

## ⚡ Performance Tuning

### Database Optimization
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_pitches_created_at ON pitches(created_at DESC);
CREATE INDEX CONCURRENTLY idx_pitches_status ON pitches(status) WHERE status = 'published';
CREATE INDEX CONCURRENTLY idx_users_email_lower ON users(LOWER(email));

-- Analyze tables for query planner
ANALYZE pitches;
ANALYZE users;
ANALYZE investments;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Caching Strategy
```javascript
// Cache configuration
const CACHE_CONFIG = {
  // Static content - long TTL
  '/api/config': 3600,           // 1 hour
  '/api/genres': 86400,          // 24 hours
  
  // Dynamic content - short TTL
  '/api/pitches/trending': 300,  // 5 minutes
  '/api/dashboard/*': 60,        // 1 minute
  
  // User-specific - no cache
  '/api/user/*': 0,
  '/api/auth/*': 0
};

// Implement smart invalidation
async function invalidateCache(pattern) {
  const cache = await caches.open('api-cache');
  const keys = await cache.keys();
  
  for (const key of keys) {
    if (key.url.match(pattern)) {
      await cache.delete(key);
    }
  }
}
```

### CDN Optimization
```yaml
# Cloudflare Page Rules
- URL Pattern: pitchey.pages.dev/assets/*
  Cache Level: Cache Everything
  Edge Cache TTL: 1 month
  Browser Cache TTL: 1 year

- URL Pattern: pitchey.pages.dev/api/*
  Cache Level: Bypass
  
- URL Pattern: pitchey.pages.dev/*.js
  Cache Level: Cache Everything
  Edge Cache TTL: 1 week
  Auto Minify: JavaScript
```

---

## 🗄️ Database Maintenance

### Daily Tasks
```bash
#!/bin/bash
# Daily database maintenance

# 1. Vacuum analyze (during low traffic)
DATABASE_URL="..." psql -c "VACUUM ANALYZE;"

# 2. Check table sizes
DATABASE_URL="..." psql -c "
  SELECT schemaname, tablename, 
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
  FROM pg_tables 
  WHERE schemaname = 'public' 
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# 3. Monitor connections
DATABASE_URL="..." psql -c "
  SELECT state, count(*) 
  FROM pg_stat_activity 
  GROUP BY state;"
```

### Weekly Tasks
```bash
# 1. Full backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 2. Reindex tables (during maintenance window)
DATABASE_URL="..." psql -c "REINDEX DATABASE pitchey;"

# 3. Update statistics
DATABASE_URL="..." psql -c "ANALYZE;"

# 4. Check for unused indexes
DATABASE_URL="..." psql -f scripts/unused-indexes.sql
```

### Monthly Tasks
```bash
# 1. Archive old data
DATABASE_URL="..." deno run --allow-all scripts/archive-old-data.ts

# 2. Optimize table storage
DATABASE_URL="..." psql -c "VACUUM FULL;"

# 3. Review and update indexes
DATABASE_URL="..." deno run --allow-all scripts/index-analysis.ts
```

---

## 🔒 Security Operations

### Security Checklist
```bash
#!/bin/bash
# Weekly security audit

echo "🔒 Running security audit..."

# 1. Check for exposed secrets
grep -r "sk_" --include="*.js" --include="*.ts" . 2>/dev/null
grep -r "password" --include="*.js" --include="*.ts" . 2>/dev/null

# 2. Review access logs for anomalies
wrangler tail --format json | jq '.[] | select(.status >= 400)' | tail -100

# 3. Check SSL certificates
curl -I https://pitchey.pages.dev 2>&1 | grep -i "SSL certificate"

# 4. Verify security headers
curl -I https://pitchey-production.cavelltheleaddev.workers.dev | grep -E "X-Frame-Options|X-Content-Type|Strict-Transport"

# 5. Check for dependency vulnerabilities
npm audit
deno lint --rules-tags=recommended

echo "✅ Security audit complete"
```

### Incident Response
```markdown
## Security Incident Playbook

### 1. Detection
- Alert received or anomaly detected
- Document time, nature, and scope

### 2. Containment
- Isolate affected systems
- Preserve evidence
- Block malicious IPs/users

### 3. Eradication
- Remove malicious code
- Patch vulnerabilities
- Reset compromised credentials

### 4. Recovery
- Restore from clean backups
- Monitor for re-infection
- Verify system integrity

### 5. Lessons Learned
- Document incident
- Update security measures
- Train team on prevention
```

---

## 💾 Backup & Recovery

### Backup Strategy
```bash
#!/bin/bash
# Automated backup script

BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# 1. Database backup
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/database.sql.gz

# 2. Code backup
tar -czf $BACKUP_DIR/code.tar.gz . --exclude=node_modules --exclude=.git

# 3. Configuration backup
cp .env.production $BACKUP_DIR/
wrangler secret list > $BACKUP_DIR/secrets.txt

# 4. Upload to cloud storage
aws s3 sync $BACKUP_DIR s3://pitchey-backups/$(date +%Y%m%d)/

# 5. Verify backup
if [ $? -eq 0 ]; then
  echo "✅ Backup successful"
  # Clean old backups (keep 30 days)
  find /backups -type d -mtime +30 -exec rm -rf {} \;
else
  echo "❌ Backup failed"
  # Send alert
fi
```

### Recovery Procedures
```bash
#!/bin/bash
# Disaster recovery script

RESTORE_DATE=$1

if [ -z "$RESTORE_DATE" ]; then
  echo "Usage: ./restore.sh YYYYMMDD"
  exit 1
fi

echo "⚠️  Starting recovery from $RESTORE_DATE"

# 1. Stop services
wrangler dev stop

# 2. Restore database
gunzip < /backups/$RESTORE_DATE/database.sql.gz | psql $DATABASE_URL

# 3. Restore code
tar -xzf /backups/$RESTORE_DATE/code.tar.gz

# 4. Restore configuration
cp /backups/$RESTORE_DATE/.env.production .

# 5. Rebuild and deploy
npm install
npm run build
wrangler deploy

echo "✅ Recovery complete"
```

---

## 📈 Scaling Operations

### Horizontal Scaling
```javascript
// Worker configuration for auto-scaling
export default {
  async fetch(request, env, ctx) {
    // Implement request routing
    const region = request.headers.get('CF-IPCountry');
    const worker = selectWorker(region);
    
    return await worker.fetch(request);
  }
};

function selectWorker(region) {
  const workers = {
    'US': 'pitchey-us.workers.dev',
    'EU': 'pitchey-eu.workers.dev',
    'AS': 'pitchey-asia.workers.dev'
  };
  
  return workers[region] || workers['US'];
}
```

### Database Scaling
```sql
-- Add read replicas
CREATE PUBLICATION pitchey_pub FOR ALL TABLES;

-- On replica
CREATE SUBSCRIPTION pitchey_sub
  CONNECTION 'host=primary dbname=pitchey'
  PUBLICATION pitchey_pub;

-- Route read queries to replicas
-- Configure in connection pool
```

### Cache Scaling
```javascript
// Multi-tier caching
class CacheManager {
  constructor() {
    this.l1Cache = new Map();  // Memory cache
    this.l2Cache = env.KV;     // KV namespace
    this.l3Cache = env.R2;     // R2 bucket
  }
  
  async get(key) {
    // Check L1
    if (this.l1Cache.has(key)) {
      return this.l1Cache.get(key);
    }
    
    // Check L2
    const l2Value = await this.l2Cache.get(key);
    if (l2Value) {
      this.l1Cache.set(key, l2Value);
      return l2Value;
    }
    
    // Check L3
    const l3Value = await this.l3Cache.get(key);
    if (l3Value) {
      await this.l2Cache.put(key, l3Value);
      this.l1Cache.set(key, l3Value);
      return l3Value;
    }
    
    return null;
  }
}
```

---

## 🔄 Update Procedures

### Code Updates
```bash
#!/bin/bash
# Safe deployment procedure

# 1. Create deployment branch
git checkout -b deploy-$(date +%Y%m%d)

# 2. Run tests
npm test
./test-complete-platform.sh

# 3. Build and validate
npm run build
npm run validate

# 4. Deploy to staging
wrangler deploy --env staging

# 5. Test staging
./test-staging.sh

# 6. Deploy to production (with rollback ready)
PREVIOUS_VERSION=$(wrangler deployments list | head -1 | awk '{print $1}')
wrangler deploy --env production

# 7. Verify production
./health-check.js

# 8. If issues, rollback
if [ $? -ne 0 ]; then
  wrangler rollback $PREVIOUS_VERSION
  echo "❌ Deployment failed, rolled back"
else
  echo "✅ Deployment successful"
fi
```

### Database Migrations
```bash
#!/bin/bash
# Safe migration procedure

# 1. Backup current database
pg_dump $DATABASE_URL > pre_migration_backup.sql

# 2. Test migration on copy
createdb pitchey_test
psql pitchey_test < pre_migration_backup.sql
DATABASE_URL="...test..." deno run --allow-all migrate.ts

# 3. If successful, apply to production
if [ $? -eq 0 ]; then
  DATABASE_URL="...prod..." deno run --allow-all migrate.ts
else
  echo "Migration failed in test"
  exit 1
fi

# 4. Verify migration
DATABASE_URL="...prod..." deno run --allow-all verify-migration.ts
```

---

## 🚨 Emergency Procedures

### Service Outage
```bash
#!/bin/bash
# Emergency response script

echo "🚨 EMERGENCY RESPONSE INITIATED"

# 1. Switch to maintenance mode
wrangler deploy --env maintenance

# 2. Diagnose issue
./diagnose-issue.sh

# 3. Quick fixes
case $1 in
  "database")
    # Reset database connections
    wrangler secret put DATABASE_URL --env production
    ;;
  "cache")
    # Clear all caches
    ./purge-all-caches.sh
    ;;
  "worker")
    # Restart workers
    wrangler deploy --env production --force
    ;;
  *)
    echo "Unknown issue type"
    ;;
esac

# 4. Monitor recovery
./monitor-continuous.sh
```

### Data Breach Response
```markdown
## Data Breach Procedure

1. **Immediate Actions** (0-1 hour)
   - Isolate affected systems
   - Reset all credentials
   - Enable additional logging
   - Notify security team

2. **Investigation** (1-4 hours)
   - Identify scope of breach
   - Preserve evidence
   - Document timeline
   - Identify affected users

3. **Containment** (4-24 hours)
   - Patch vulnerabilities
   - Update security rules
   - Force password resets
   - Implement additional monitoring

4. **Notification** (24-72 hours)
   - Notify affected users
   - Report to authorities (if required)
   - Public disclosure (if necessary)
   - Update status page

5. **Recovery** (72+ hours)
   - Restore normal operations
   - Implement lessons learned
   - Update security policies
   - Conduct security audit
```

---

## 📞 Support Contacts

### Technical Escalation
| Level | Contact | Response Time |
|-------|---------|---------------|
| L1 | On-call Engineer | 15 min |
| L2 | Team Lead | 30 min |
| L3 | Platform Architect | 1 hour |
| L4 | External Support | 2 hours |

### Service Providers
| Service | Support | Contact |
|---------|---------|---------|
| Cloudflare | 24/7 | support.cloudflare.com |
| Neon DB | Business Hours | neon.tech/support |
| Upstash | 24/7 | upstash.com/support |

---

## 📊 Reporting

### Weekly Report Template
```markdown
# Weekly Operations Report
**Week of**: [Date]
**Prepared by**: [Name]

## System Health
- Uptime: XX.X%
- Avg Response Time: XXXms
- Error Rate: X.X%
- Total Requests: X.XM

## Incidents
- None / List incidents

## Maintenance Performed
- List tasks

## Upcoming Work
- List planned maintenance

## Metrics Trends
- Include graphs

## Recommendations
- List any recommendations
```

### Monthly Review
1. Analyze performance trends
2. Review security incidents
3. Evaluate capacity needs
4. Update documentation
5. Plan improvements

---

## 🎯 Best Practices

1. **Always backup before changes**
2. **Test in staging first**
3. **Document all incidents**
4. **Keep runbooks updated**
5. **Automate repetitive tasks**
6. **Monitor proactively**
7. **Communicate status changes**
8. **Review logs regularly**
9. **Practice disaster recovery**
10. **Maintain security hygiene**

---

**Document Version**: 1.0.0  
**Last Updated**: December 24, 2024  
**Review Schedule**: Monthly  
**Owner**: Platform Operations Team

This guide should be reviewed and updated regularly based on operational experience and platform changes.