# Pitchey Platform Troubleshooting Guide

## Overview

This comprehensive troubleshooting guide provides solutions for common issues in the Pitchey platform. Use this guide to diagnose and resolve problems quickly while maintaining system stability.

## Quick Diagnosis Commands

### System Health Overview
```bash
#!/bin/bash
# Quick health check script

echo "=== Pitchey Platform Health Check ==="
echo "Timestamp: $(date)"
echo ""

# API Health
echo "🔍 API Health:"
api_status=$(curl -s -o /dev/null -w "%{http_code}" https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health)
if [ "$api_status" = "200" ]; then
    echo "✅ API: Healthy ($api_status)"
else
    echo "❌ API: Unhealthy ($api_status)"
fi

# Frontend Health
echo "🌐 Frontend Health:"
frontend_status=$(curl -s -o /dev/null -w "%{http_code}" https://pitchey-5o8-66n.pages.dev)
if [ "$frontend_status" = "200" ]; then
    echo "✅ Frontend: Healthy ($frontend_status)"
else
    echo "❌ Frontend: Unhealthy ($frontend_status)"
fi

# Database Health
echo "💾 Database Health:"
if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ Database: Connected"
else
    echo "❌ Database: Connection failed"
fi

# Redis Health
echo "🔄 Cache Health:"
if redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
    echo "✅ Redis: Connected"
else
    echo "❌ Redis: Connection failed"
fi

echo ""
echo "=== End Health Check ==="
```

### Performance Metrics
```bash
# Quick performance check
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health \
  -w "Response Time: %{time_total}s\nHTTP Code: %{http_code}\n" \
  -o /dev/null
```

## Authentication Issues

### Problem: Users Cannot Log In

**Symptoms:**
- Login attempts return 401/403 errors
- "Invalid credentials" messages
- Session timeouts

**Diagnosis:**
```bash
# Test authentication endpoint
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' \
  -v

# Check demo account status
./scripts/check-demo-users.sh

# Verify JWT configuration
echo "Checking JWT configuration..."
# (Check environment variables)

# Test session endpoint
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/session \
  -H "Cookie: session=your-session-cookie"
```

**Solutions:**

1. **Reset Demo Passwords**
   ```bash
   ./scripts/reset-demo-passwords.sh
   ```

2. **Clear Session Storage**
   ```bash
   # Clear Redis sessions
   redis-cli -u "$REDIS_URL" del "session:*"
   ```

3. **Verify Better Auth Configuration**
   ```bash
   # Check Better Auth tables
   psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%auth%';"
   ```

### Problem: Session Expires Too Quickly

**Solutions:**
```bash
# Check session timeout configuration
grep -r "SESSION_TIMEOUT" ./deployment-config/

# Update session timeout (if needed)
./scripts/secrets-config-manager.sh store production session_timeout "14400"
```

## Database Issues

### Problem: Connection Pool Exhaustion

**Symptoms:**
- "Too many connections" errors
- Slow database queries
- Connection timeout errors

**Diagnosis:**
```bash
# Check active connections
psql "$DATABASE_URL" -c "
SELECT count(*), state 
FROM pg_stat_activity 
WHERE datname = 'neondb' 
GROUP BY state;"

# Check connection pool configuration
psql "$DATABASE_URL" -c "SHOW max_connections;"

# Identify long-running queries
psql "$DATABASE_URL" -c "
SELECT pid, query, state, now() - query_start as duration
FROM pg_stat_activity 
WHERE state != 'idle' 
AND now() - query_start > interval '5 minutes'
ORDER BY duration DESC;"
```

**Solutions:**

1. **Kill Long-Running Queries**
   ```bash
   # Identify the problematic query PID from above
   psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(12345);"
   ```

2. **Optimize Connection Pool Settings**
   ```bash
   # Update database pool size
   ./scripts/secrets-config-manager.sh store production database_pool_size "25"
   ```

3. **Check for Deadlocks**
   ```bash
   psql "$DATABASE_URL" -c "
   SELECT blocked_locks.pid AS blocked_pid,
          blocked_activity.usename AS blocked_user,
          blocking_locks.pid AS blocking_pid,
          blocking_activity.usename AS blocking_user,
          blocked_activity.query AS blocked_statement,
          blocking_activity.query AS current_statement_in_blocking_process
   FROM pg_catalog.pg_locks blocked_locks
   JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
   JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
   JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
   WHERE NOT blocked_locks.granted;"
   ```

### Problem: Slow Database Performance

**Diagnosis:**
```bash
# Check slow queries
psql "$DATABASE_URL" -c "
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements 
WHERE mean_time > 1000 
ORDER BY mean_time DESC 
LIMIT 10;"

# Check missing indexes
psql "$DATABASE_URL" -c "
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename IN ('pitches', 'users', 'investments')
ORDER BY n_distinct DESC;"

# Check table sizes
psql "$DATABASE_URL" -c "
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

**Solutions:**

1. **Add Missing Indexes**
   ```bash
   # Run database optimization script
   ./scripts/optimize-database.sh
   ```

2. **Update Table Statistics**
   ```bash
   psql "$DATABASE_URL" -c "ANALYZE;"
   ```

3. **Check for Bloated Tables**
   ```bash
   psql "$DATABASE_URL" -c "VACUUM ANALYZE;"
   ```

## API Performance Issues

### Problem: High Response Times

**Diagnosis:**
```bash
# Test response times for key endpoints
endpoints=(
    "/api/health"
    "/api/pitches"
    "/api/auth/session"
    "/api/dashboard/creator"
)

for endpoint in "${endpoints[@]}"; do
    echo "Testing $endpoint:"
    curl -s "https://pitchey-api-prod.ndlovucavelle.workers.dev$endpoint" \
      -w "  Response Time: %{time_total}s\n" \
      -o /dev/null
done

# Check for rate limiting
curl -s -I https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | grep -i "rate\|limit"
```

**Solutions:**

1. **Enable Caching**
   ```bash
   # Check cache hit rates
   redis-cli -u "$REDIS_URL" info stats | grep "keyspace_hits\|keyspace_misses"
   
   # Warm up cache
   ./scripts/warm-cache.sh
   ```

2. **Optimize Database Queries**
   ```bash
   # Run query optimization
   ./scripts/optimize-queries.sh
   ```

3. **Scale Resources**
   ```bash
   # Check current resource usage
   ./scripts/check-resource-usage.sh
   ```

### Problem: High Error Rates

**Diagnosis:**
```bash
# Check recent errors in Sentry
echo "Check Sentry dashboard: https://sentry.io"

# Test API endpoints
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches \
  -H "Accept: application/json" | jq '.'

# Check Cloudflare Worker logs
wrangler tail --format pretty
```

**Solutions:**

1. **Check Recent Deployments**
   ```bash
   git log --oneline -10
   
   # Rollback if needed
   ./scripts/rollback-deployment.sh
   ```

2. **Verify External Dependencies**
   ```bash
   # Check database connectivity
   ./scripts/test-database-connection.sh
   
   # Check Redis connectivity
   ./scripts/test-redis-connection.sh
   ```

## Frontend Issues

### Problem: Frontend Not Loading

**Symptoms:**
- Blank page or loading spinner
- JavaScript errors in console
- Build/deployment issues

**Diagnosis:**
```bash
# Check frontend deployment status
curl -s -I https://pitchey-5o8-66n.pages.dev

# Check for JavaScript errors (use browser developer tools)
# Check network requests in browser

# Verify build status
cd frontend && npm run build
```

**Solutions:**

1. **Redeploy Frontend**
   ```bash
   cd frontend
   npm run build
   wrangler pages deploy dist --project-name=pitchey
   ```

2. **Check Environment Variables**
   ```bash
   # Verify frontend environment configuration
   cat frontend/.env.production
   ```

3. **Clear CDN Cache**
   ```bash
   # Purge Cloudflare cache
   ./scripts/purge-cloudflare-cache.sh
   ```

### Problem: API Connection Issues from Frontend

**Diagnosis:**
```bash
# Test API connectivity from frontend perspective
curl -s https://pitchey-5o8-66n.pages.dev/_next/static/chunks/pages/_app.js | grep -i "api"

# Check CORS configuration
curl -s -H "Origin: https://pitchey-5o8-66n.pages.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/sign-in \
  -I
```

**Solutions:**

1. **Fix CORS Configuration**
   ```bash
   # Update Worker CORS settings
   ./scripts/update-cors-config.sh
   ```

2. **Verify API URLs**
   ```bash
   # Check frontend configuration
   grep -r "pitchey-api" frontend/src/
   ```

## WebSocket Issues

### Problem: Real-time Features Not Working

**Symptoms:**
- Notifications not appearing
- Live updates not working
- WebSocket connection failures

**Diagnosis:**
```bash
# Test WebSocket connection
./scripts/test-websocket-connection.sh

# Check WebSocket endpoint
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/ws \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -I
```

**Solutions:**

1. **Restart WebSocket Service**
   ```bash
   # Redeploy worker to restart WebSocket handling
   wrangler deploy
   ```

2. **Check WebSocket Configuration**
   ```bash
   # Verify WebSocket endpoints in code
   grep -r "websocket\|ws://" frontend/src/
   ```

## File Upload Issues

### Problem: Document/Media Upload Failures

**Symptoms:**
- Upload timeouts
- File size errors
- R2 storage errors

**Diagnosis:**
```bash
# Test file upload endpoint
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/upload/test \
  -F "file=@test-file.pdf" \
  -H "Authorization: Bearer your-token"

# Check R2 bucket status
aws s3 ls s3://pitchey-documents-production/ || \
  wrangler r2 object list pitchey-documents-production

# Check file size limits
grep -r "MAX_FILE_SIZE" ./deployment-config/
```

**Solutions:**

1. **Check R2 Configuration**
   ```bash
   # Verify R2 bucket permissions
   wrangler r2 bucket list
   
   # Test R2 connectivity
   ./scripts/test-r2-connection.sh
   ```

2. **Adjust File Size Limits**
   ```bash
   # Update file size limits
   ./scripts/secrets-config-manager.sh store production max_file_size "104857600"
   ```

## Performance Monitoring

### CPU and Memory Issues

**Diagnosis:**
```bash
# Check system resources (if applicable)
top -n 1 | head -20
free -h
df -h

# Check Worker analytics in Cloudflare dashboard
echo "Check Cloudflare Workers analytics dashboard"

# Run performance test
./scripts/performance-testing-suite.sh load --duration=60
```

**Solutions:**

1. **Scale Resources**
   ```bash
   # Check current limits
   wrangler dev --inspect
   
   # Optimize resource usage
   ./scripts/optimize-performance.sh
   ```

2. **Enable Monitoring**
   ```bash
   # Set up enhanced monitoring
   ./scripts/setup-monitoring.sh
   ```

## Network and Connectivity

### Problem: DNS Resolution Issues

**Diagnosis:**
```bash
# Test DNS resolution
nslookup pitchey-api-prod.ndlovucavelle.workers.dev
dig pitchey-api-prod.ndlovucavelle.workers.dev

# Check Cloudflare DNS settings
echo "Check Cloudflare DNS dashboard"
```

**Solutions:**

1. **Clear DNS Cache**
   ```bash
   sudo systemctl flush-dns
   # or
   sudo dscacheutil -flushcache
   ```

2. **Check DNS Configuration**
   ```bash
   # Verify DNS records
   dig +trace pitchey-api-prod.ndlovucavelle.workers.dev
   ```

### Problem: SSL/TLS Certificate Issues

**Diagnosis:**
```bash
# Check SSL certificate
openssl s_client -connect pitchey-api-prod.ndlovucavelle.workers.dev:443 -servername pitchey-api-prod.ndlovucavelle.workers.dev < /dev/null

# Check certificate expiration
curl -vI https://pitchey-api-prod.ndlovucavelle.workers.dev 2>&1 | grep -E "expire|subject"
```

**Solutions:**

1. **Renew Certificates**
   ```bash
   # Cloudflare handles automatic renewal
   echo "Check Cloudflare SSL/TLS dashboard for certificate status"
   ```

## Emergency Procedures

### Complete System Recovery

```bash
#!/bin/bash
# Emergency recovery script

echo "🚨 EMERGENCY RECOVERY PROCEDURE"
echo "================================"

# 1. Check system status
echo "1. Checking system status..."
./scripts/quick-health-check.sh

# 2. Rollback to last known good state
echo "2. Rolling back to stable version..."
./scripts/emergency-rollback.sh

# 3. Restart critical services
echo "3. Restarting services..."
wrangler deploy

# 4. Verify recovery
echo "4. Verifying recovery..."
sleep 30
./scripts/verify-production.sh

echo "✅ Emergency recovery procedure completed"
```

### Data Recovery

```bash
#!/bin/bash
# Data recovery script

echo "💾 DATA RECOVERY PROCEDURE"
echo "=========================="

# 1. Check recent backups
echo "1. Checking available backups..."
ls -la .backups/

# 2. Restore from backup if needed
echo "2. Select backup to restore:"
read -p "Enter backup filename: " backup_file

if [[ -f ".backups/$backup_file" ]]; then
    ./scripts/restore-from-backup.sh "$backup_file"
else
    echo "❌ Backup file not found"
    exit 1
fi

# 3. Verify data integrity
echo "3. Verifying data integrity..."
./scripts/verify-data-integrity.sh

echo "✅ Data recovery procedure completed"
```

## Preventive Maintenance

### Daily Checks
```bash
#!/bin/bash
# Daily maintenance script

# Health check
./scripts/daily-health-check.sh

# Performance baseline
./scripts/performance-baseline.sh

# Log rotation
./scripts/rotate-logs.sh

# Backup verification
./scripts/verify-backups.sh
```

### Weekly Maintenance
```bash
#!/bin/bash
# Weekly maintenance script

# Database maintenance
psql "$DATABASE_URL" -c "VACUUM ANALYZE;"

# Cache cleanup
redis-cli -u "$REDIS_URL" FLUSHDB

# Security scan
./scripts/security-scan.sh

# Performance optimization
./scripts/optimize-performance.sh
```

## Useful Commands Reference

### Quick Status Commands
```bash
# System overview
./scripts/system-status.sh

# API status
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | jq '.'

# Database status
psql "$DATABASE_URL" -c "SELECT version();"

# Redis status
redis-cli -u "$REDIS_URL" info server

# Recent deployments
git log --oneline -5

# Error logs (last hour)
journalctl --since "1 hour ago" --grep ERROR
```

### Diagnostic Commands
```bash
# Network diagnostics
ping -c 3 pitchey-api-prod.ndlovucavelle.workers.dev
traceroute pitchey-api-prod.ndlovucavavelle.workers.dev

# Performance testing
./scripts/performance-testing-suite.sh quick

# Resource usage
./scripts/check-resource-usage.sh

# Security check
./scripts/security-health-check.sh
```

## Getting Help

### Internal Resources
- **Technical Documentation**: ./docs/
- **Architecture Guide**: ./docs/ARCHITECTURE.md
- **API Reference**: ./docs/API_DOCUMENTATION.md
- **Deployment Guide**: ./docs/DEPLOYMENT_GUIDE.md

### External Resources
- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Neon Database Docs**: https://neon.tech/docs
- **Redis Documentation**: https://redis.io/documentation

### Escalation Contacts
- **On-Call Engineer**: [Contact Info]
- **Team Lead**: [Contact Info]
- **Database Administrator**: [Contact Info]
- **Security Team**: [Contact Info]

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Owner**: Platform Engineering Team  
**Review Schedule**: Monthly