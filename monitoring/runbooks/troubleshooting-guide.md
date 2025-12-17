# Pitchey Troubleshooting Guide

## Performance Issues

### Slow API Response Times

**Symptoms:**
- Response times > 2 seconds
- Timeouts on requests
- Users reporting slow loading

**Diagnosis:**
```bash
# Test endpoint performance
curl -w "Response Time: %{time_total}s\nStatus: %{http_code}\n" \
  "https://pitchey-production.cavelltheleaddev.workers.dev/api/health/detailed"

# Check worker metrics
wrangler tail --format=pretty | grep -i "slow\|timeout\|error"

# Test database connectivity
curl "https://pitchey-production.cavelltheleaddev.workers.dev/api/health/db"
```

**Common Causes & Solutions:**

1. **Database Query Performance**
   ```bash
   # Check slow queries in Neon dashboard
   # Look for queries taking > 1000ms
   
   # Test specific endpoints that hit database heavily
   curl -w "Time: %{time_total}s\n" \
     "https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/browse/enhanced?limit=50"
   
   # Solution: Add database indexes
   # Review NEON_DATABASE_SETUP_GUIDE.md for optimization
   ```

2. **Hyperdrive Connection Pool Exhaustion**
   ```bash
   # Check connection pool usage in Cloudflare dashboard
   # Look for "Connection pool full" errors in worker logs
   
   # Temporary fix: Restart Hyperdrive (via CF dashboard)
   # Permanent fix: Optimize database queries to use fewer connections
   ```

3. **Memory Pressure in Worker**
   ```bash
   # Check memory usage in Cloudflare dashboard
   # Look for memory limit exceeded errors
   
   # Solution: Optimize data structures and reduce memory allocations
   ```

### Cache Performance Issues

**Symptoms:**
- Low cache hit rates (< 70%)
- Cache-Status: MISS on cacheable endpoints
- Repeated database queries for same data

**Diagnosis:**
```bash
# Check cache headers
curl -I "https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/browse/enhanced"

# Look for:
# Cache-Control: max-age=300
# X-Cache-Status: HIT/MISS
# CF-Cache-Status: HIT/MISS

# Test cache behavior
for i in {1..5}; do
  echo "Request $i:"
  curl -I "https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/browse/enhanced" | grep -i cache
  sleep 2
done
```

**Common Issues:**

1. **Cache TTL Too Short**
   - Check `Cache-Control` headers
   - Increase TTL for static/semi-static content
   - Review caching strategy in worker code

2. **Query Parameters Breaking Cache**
   ```bash
   # Different query params create different cache keys
   # Ensure consistent parameter ordering
   # Consider normalizing query parameters
   ```

3. **Headers Preventing Cache**
   ```bash
   # Check for cache-busting headers:
   # Authorization headers
   # Vary headers
   # Cache-Control: no-cache
   ```

---

## Database Connection Issues

### Connection Timeouts

**Symptoms:**
- "Connection timeout" errors
- Database queries hanging
- Health check failing

**Diagnosis:**
```bash
# Test database connectivity
curl "https://pitchey-production.cavelltheleaddev.workers.dev/api/health/detailed"

# Check Hyperdrive status in Cloudflare dashboard
# Review connection pool metrics

# Test direct database connection (if possible)
psql "$DATABASE_URL" -c "SELECT 1;"
```

**Resolution Steps:**

1. **Check Neon Database Status**
   - Login to Neon console
   - Check database compute status
   - Verify no ongoing maintenance

2. **Hyperdrive Configuration Issues**
   ```bash
   # Verify Hyperdrive binding in wrangler.toml
   grep -A 5 "hyperdrive" wrangler.toml
   
   # Check if Hyperdrive ID is correct
   # Compare with Cloudflare dashboard
   ```

3. **Network Connectivity**
   ```bash
   # Test from different locations
   curl --connect-timeout 10 "https://pitchey-production.cavelltheleaddev.workers.dev/api/health/db"
   ```

### Slow Database Queries

**Symptoms:**
- Specific endpoints slow (> 5 seconds)
- Database CPU high in Neon dashboard
- Query timeout errors

**Diagnosis:**
```bash
# Identify slow endpoints
curl -w "Time: %{time_total}s\n" \
  "https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/browse/enhanced?limit=100"

# Check Neon query performance dashboard
# Look for queries with high execution time
```

**Solutions:**

1. **Add Database Indexes**
   ```sql
   -- Common indexes for Pitchey
   CREATE INDEX CONCURRENTLY idx_pitches_created_at ON pitches(created_at);
   CREATE INDEX CONCURRENTLY idx_pitches_status ON pitches(status);
   CREATE INDEX CONCURRENTLY idx_pitches_user_id ON pitches(user_id);
   ```

2. **Optimize Queries**
   - Use LIMIT and OFFSET for pagination
   - Avoid SELECT * queries
   - Use appropriate JOIN strategies

3. **Connection Pooling**
   ```javascript
   // Review connection management in worker
   // Ensure proper connection reuse
   // Avoid creating too many connections
   ```

---

## Frontend Issues

### Page Load Failures

**Symptoms:**
- White screen on https://pitchey.pages.dev
- JavaScript errors in browser console
- 404 errors on assets

**Diagnosis:**
```bash
# Check page deployment status
npx wrangler pages deployment list --project-name=pitchey

# Test page loading
curl -I https://pitchey.pages.dev

# Check for JavaScript errors in browser developer tools
```

**Common Issues:**

1. **Deployment Failed**
   ```bash
   # Check latest deployment
   npx wrangler pages deployment list --project-name=pitchey
   
   # Redeploy if needed
   npm run build
   npx wrangler pages deploy frontend/dist --project-name=pitchey
   ```

2. **Asset Loading Issues**
   ```bash
   # Check asset URLs in browser network tab
   # Verify Vite build configuration
   # Check base URL in vite.config.ts
   ```

3. **Environment Variable Issues**
   ```bash
   # Verify frontend environment variables
   # Check .env.production file
   # Ensure VITE_API_URL is correct
   ```

### API Connection Issues

**Symptoms:**
- "Network Error" in browser
- API requests failing
- Authentication not working

**Diagnosis:**
```bash
# Test API from browser developer tools
# Check CORS headers
curl -I -H "Origin: https://pitchey.pages.dev" \
  "https://pitchey-production.cavelltheleaddev.workers.dev/api/health"

# Look for CORS headers:
# Access-Control-Allow-Origin: https://pitchey.pages.dev
```

**Solutions:**

1. **CORS Configuration**
   ```javascript
   // Verify CORS setup in worker
   // Check FRONTEND_URL environment variable
   // Ensure proper headers are set
   ```

2. **API Endpoint Issues**
   ```bash
   # Test API endpoints directly
   curl "https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/check"
   ```

---

## Security Issues

### SSL Certificate Problems

**Symptoms:**
- Browser security warnings
- Certificate expired errors
- Mixed content warnings

**Diagnosis:**
```bash
# Check certificate status
echo | openssl s_client -servername pitchey.pages.dev -connect pitchey.pages.dev:443 2>/dev/null | openssl x509 -noout -dates

# Check worker certificate
echo | openssl s_client -servername pitchey-production.cavelltheleaddev.workers.dev -connect pitchey-production.cavelltheleaddev.workers.dev:443 2>/dev/null | openssl x509 -noout -dates
```

**Solutions:**
- Cloudflare automatically manages certificates
- Check SSL/TLS settings in Cloudflare dashboard
- Ensure "Always Use HTTPS" is enabled

### Authentication Issues

**Symptoms:**
- Login failures
- JWT token errors
- Session timeouts

**Diagnosis:**
```bash
# Test login endpoint
curl -X POST "https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Check JWT secret configuration
wrangler secret list | grep JWT
```

**Common Issues:**

1. **JWT Secret Missing**
   ```bash
   wrangler secret put JWT_SECRET
   # Enter a secure random string
   ```

2. **Token Expiry**
   ```javascript
   // Check token expiry time in worker code
   // Adjust expiry time if too short
   ```

---

## Monitoring & Observability

### Missing Metrics

**Symptoms:**
- Gaps in monitoring dashboards
- Missing alert data
- No recent metrics

**Diagnosis:**
```bash
# Check monitoring services
docker-compose -f monitoring/production-monitoring-stack.yml ps

# Test Prometheus metrics
curl http://localhost:9090/metrics

# Check Grafana dashboards
open http://localhost:3000
```

**Solutions:**

1. **Restart Monitoring Stack**
   ```bash
   cd monitoring
   docker-compose -f production-monitoring-stack.yml down
   docker-compose -f production-monitoring-stack.yml up -d
   ```

2. **Check Configuration**
   ```bash
   # Verify Prometheus config
   docker-compose -f production-monitoring-stack.yml exec prometheus promtool check config /etc/prometheus/prometheus.yml
   
   # Check AlertManager config
   docker-compose -f production-monitoring-stack.yml exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml
   ```

### Alert Fatigue

**Symptoms:**
- Too many false positive alerts
- Important alerts being ignored
- Alert storms

**Solutions:**

1. **Tune Alert Thresholds**
   ```yaml
   # Adjust thresholds in prometheus/rules/pitchey-alerts.yml
   # Increase duration before alert fires
   # Add more specific conditions
   ```

2. **Add Alert Inhibition**
   ```yaml
   # Use inhibit_rules in alertmanager.yml
   # Suppress downstream alerts when upstream fails
   ```

---

## Emergency Recovery Procedures

### Complete Service Outage

**Steps:**

1. **Immediate Assessment (0-5 minutes)**
   ```bash
   # Check all services quickly
   ./monitoring/emergency-health-check.sh
   
   # Update status page
   echo "Service disruption detected. Investigating..." > status.txt
   ```

2. **Identify Root Cause (5-15 minutes)**
   ```bash
   # Check recent deployments
   wrangler deployments list
   
   # Review error logs
   wrangler tail --format=pretty | head -50
   
   # Check external services
   curl https://status.cloudflare.com/
   curl https://status.neon.tech/
   ```

3. **Apply Quick Fix (15-30 minutes)**
   ```bash
   # If recent deployment issue: rollback
   wrangler rollback [PREVIOUS_DEPLOYMENT_ID]
   
   # If database issue: check connection
   # If cache issue: clear cache
   ```

### Data Recovery

**If Database Issues:**

1. **Check Backup Status**
   ```bash
   # Verify Neon automatic backups
   # Check backup retention policy
   # Identify latest good backup
   ```

2. **Point-in-Time Recovery (if needed)**
   ```bash
   # Use Neon console to restore to specific time
   # Create new branch from backup
   # Update connection string temporarily
   ```

---

## Contact Information

### Internal Escalation
- **L1 Support**: DevOps Team
- **L2 Support**: Senior Engineers  
- **L3 Support**: Engineering Management
- **Emergency**: CTO

### External Support
- **Cloudflare**: Enterprise support portal
- **Neon**: support@neon.tech (Enterprise SLA)
- **Upstash**: support@upstash.com

---

## Additional Resources

- [Incident Response Playbook](./incident-response-playbook.md)
- [Monitoring Setup Guide](../COMPREHENSIVE_MONITORING_SETUP.md)
- [Performance Optimization](../PERFORMANCE_OPTIMIZATION_STRATEGIES.md)
- [Database Setup Guide](../../NEON_DATABASE_SETUP_GUIDE.md)
- [Deployment Guide](../../CLOUDFLARE_DEPLOYMENT_GUIDE.md)
