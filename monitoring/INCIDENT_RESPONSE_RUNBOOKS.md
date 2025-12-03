# Pitchey Platform Incident Response Runbooks

## Overview

This document provides comprehensive runbooks for responding to incidents detected by the Pitchey monitoring and observability system. Each runbook includes step-by-step procedures, diagnostic commands, and resolution strategies.

## Incident Classification

### Severity Levels

- **P1 - Critical**: Total platform outage, data loss, security breach
- **P2 - High**: Major feature broken, significant performance degradation  
- **P3 - Medium**: Minor feature issues, moderate performance impact
- **P4 - Low**: Cosmetic issues, minimal performance impact

### Response Times

- **P1**: Immediate response (< 15 minutes)
- **P2**: 1 hour response
- **P3**: 4 hours response  
- **P4**: Next business day

## General Incident Response Process

### 1. Initial Response (First 15 minutes)

1. **Acknowledge the Alert**
   ```bash
   # Via Slack
   !ack incident-id "Investigating issue"
   
   # Via API
   curl -X POST https://pitchey-alerts.workers.dev/alerts/acknowledge \
     -H "Content-Type: application/json" \
     -d '{"alertId": "ALERT_ID", "userId": "YOUR_ID"}'
   ```

2. **Assess Severity and Impact**
   - Check monitoring dashboard: https://pitchey-monitoring.pages.dev
   - Review recent deployments and changes
   - Determine user impact and affected services

3. **Establish Communication**
   - Update incident status in Slack #incidents channel
   - Escalate to on-call engineer for P1/P2 incidents
   - Create PagerDuty incident if not auto-created

4. **Begin Investigation**
   - Gather relevant logs and metrics
   - Check system health endpoints
   - Review error tracking in Sentry

### 2. Investigation Process

1. **Health Check All Services**
   ```bash
   # Overall platform health
   curl https://pitchey-monitoring.workers.dev/monitoring/health | jq '.'
   
   # Infrastructure health
   curl https://pitchey-monitoring.workers.dev/infra/health | jq '.'
   
   # Check main API
   curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health | jq '.'
   ```

2. **Review Recent Logs**
   ```bash
   # Get recent error logs
   curl "https://pitchey-logs.workers.dev/logs/query?level=error&limit=50" | jq '.'
   
   # Search for specific patterns
   curl "https://pitchey-logs.workers.dev/logs/search?q=database+timeout" | jq '.'
   ```

3. **Check Performance Metrics**
   ```bash
   # Get performance summary
   curl https://pitchey-apm.workers.dev/apm/summary | jq '.'
   
   # Check response times
   curl "https://pitchey-apm.workers.dev/apm/metrics?name=response_time&start=$(date -d '1 hour ago' +%s)000" | jq '.'
   ```

## Specific Incident Runbooks

## 🚨 Platform Outage (P1)

### Symptoms
- Frontend not loading
- API returning 5xx errors
- Multiple service health checks failing

### Immediate Actions

1. **Check Overall System Status**
   ```bash
   # Check Cloudflare status
   curl https://www.cloudflarestatus.com/api/v2/status.json
   
   # Check main worker
   curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health
   
   # Check database connectivity
   curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health/db
   ```

2. **Review Recent Deployments**
   ```bash
   # Check deployment history
   wrangler deployments list --name pitchey-production
   
   # Check for recent worker updates
   wrangler tail pitchey-production --format pretty | head -100
   ```

3. **Check Error Patterns**
   ```bash
   # Get recent critical errors
   curl "https://pitchey-logs.workers.dev/logs/query?level=error&limit=100" | \
     jq '.logs[] | select(.timestamp > (now - 3600)) | .message' | \
     sort | uniq -c | sort -rn
   ```

### Resolution Steps

1. **If Recent Deployment Caused Issue**
   ```bash
   # Rollback to previous version
   wrangler rollback --name pitchey-production
   
   # Verify rollback
   curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health
   ```

2. **If Database Issues**
   ```bash
   # Check database connection pool
   curl https://pitchey-infra.workers.dev/infra/health | jq '.database'
   
   # Check for long-running queries (if DB access available)
   # This would require direct database access
   ```

3. **If Cloudflare Issues**
   - Check Cloudflare dashboard for service issues
   - Consider enabling "Under Attack Mode" if DDoS detected
   - Review firewall rules for blocking legitimate traffic

### Post-Resolution

1. **Verify Service Restoration**
   ```bash
   # Run comprehensive health check
   ./monitoring/scripts/health-check-all.sh
   
   # Check user-facing endpoints
   curl -I https://pitchey.pages.dev
   curl https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches
   ```

2. **Monitor for 30 minutes**
   - Watch error rates return to normal
   - Monitor response times
   - Check user activity resumption

## ⚡ High Error Rate (P2)

### Symptoms
- Error rate above 5%
- Sentry receiving many error reports
- Users reporting failures

### Investigation Steps

1. **Identify Error Patterns**
   ```bash
   # Get error breakdown
   curl "https://pitchey-logs.workers.dev/logs/stats?timeWindow=3600000" | jq '.errorCount'
   
   # Get top errors
   curl "https://pitchey-logs.workers.dev/logs/query?level=error&limit=50" | \
     jq '.logs[] | .message' | sort | uniq -c | sort -rn | head -10
   ```

2. **Check Specific Services**
   ```bash
   # Check authentication service
   curl "https://pitchey-logs.workers.dev/logs/query?service=auth&level=error&limit=20"
   
   # Check pitch service
   curl "https://pitchey-logs.workers.dev/logs/query?service=pitch&level=error&limit=20"
   ```

3. **Review Performance Impact**
   ```bash
   # Check response times during error period
   curl "https://pitchey-apm.workers.dev/apm/metrics?name=response_time&start=$(date -d '2 hours ago' +%s)000"
   ```

### Resolution Approaches

1. **If Authentication Errors**
   ```bash
   # Check JWT issues
   grep "jwt" recent_errors.log
   
   # Verify auth endpoints
   curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/verify \
     -H "Content-Type: application/json" \
     -d '{"token": "test-token"}'
   ```

2. **If Database Errors**
   ```bash
   # Check database performance
   curl https://pitchey-infra.workers.dev/infra/health | jq '.database'
   
   # Look for timeout patterns
   curl "https://pitchey-logs.workers.dev/logs/search?q=timeout" | \
     jq '.logs[] | select(.timestamp > (now - 3600))'
   ```

3. **If Third-party Service Errors**
   ```bash
   # Check external API errors
   curl "https://pitchey-logs.workers.dev/logs/search?q=external+api+error"
   
   # Review circuit breaker status if implemented
   ```

## 🐌 Performance Degradation (P2/P3)

### Symptoms
- Response times above 2 seconds (P95)
- User complaints about slow loading
- Web Vitals deteriorating

### Investigation Steps

1. **Check Performance Metrics**
   ```bash
   # Get current performance summary
   curl https://pitchey-apm.workers.dev/apm/summary | jq '.responseTime'
   
   # Check Web Vitals trends
   curl "https://pitchey-apm.workers.dev/apm/metrics?name=web.lcp&start=$(date -d '4 hours ago' +%s)000"
   ```

2. **Identify Bottlenecks**
   ```bash
   # Check database query performance
   curl https://pitchey-apm.workers.dev/apm/db-metrics
   
   # Review slowest endpoints
   curl "https://pitchey-logs.workers.dev/logs/query?search=slow" | \
     jq '.logs[] | select(.responseTime > 2000)'
   ```

3. **Check Resource Utilization**
   ```bash
   # Worker memory and CPU usage
   curl https://pitchey-infra.workers.dev/infra/worker | jq '.memoryUtilization'
   
   # KV and R2 performance
   curl https://pitchey-infra.workers.dev/infra/kv
   curl https://pitchey-infra.workers.dev/infra/r2
   ```

### Optimization Steps

1. **Database Optimization**
   ```bash
   # Check for missing indexes (requires DB access)
   # Review slow query logs
   # Consider query optimization
   ```

2. **Cache Optimization**
   ```bash
   # Check cache hit rates
   curl https://pitchey-infra.workers.dev/infra/kv | jq '.cacheHitRate'
   
   # Review cache configuration
   # Consider cache warming strategies
   ```

3. **Frontend Optimization**
   - Review Web Vitals dashboard
   - Check for large resource loads
   - Consider CDN optimization

## 🔒 Security Incident (P1/P2)

### Symptoms
- High number of blocked requests
- Unusual traffic patterns
- Failed authentication attempts spike

### Immediate Response

1. **Assess Threat Level**
   ```bash
   # Check security events
   curl https://pitchey-security.workers.dev/security/metrics | jq '.events'
   
   # Review blocked IPs
   curl "https://pitchey-logs.workers.dev/logs/query?search=blocked&limit=100"
   ```

2. **Review Attack Patterns**
   ```bash
   # Check for brute force attacks
   curl "https://pitchey-security.workers.dev/security/analyze" | \
     jq '.events[] | select(.type == "brute_force_attack")'
   
   # Check for injection attempts
   curl "https://pitchey-security.workers.dev/security/analyze" | \
     jq '.events[] | select(.type == "sql_injection_attempt" or .type == "xss_attempt")'
   ```

3. **Check Rate Limiting**
   ```bash
   # Review rate limit metrics
   curl https://pitchey-infra.workers.dev/infra/rate-limits
   
   # Check for rate limit bypasses
   curl "https://pitchey-logs.workers.dev/logs/search?q=rate_limit_exceeded"
   ```

### Mitigation Steps

1. **Block Malicious IPs**
   ```bash
   # Add IP to blocklist (via Cloudflare dashboard)
   # Or via API if configured
   
   # Enable "Under Attack Mode" if DDoS
   ```

2. **Tighten Security Measures**
   ```bash
   # Temporarily reduce rate limits
   # Enable additional security headers
   # Consider enabling CAPTCHA
   ```

3. **Monitor and Document**
   ```bash
   # Continuous monitoring
   watch -n 30 'curl -s https://pitchey-security.workers.dev/security/metrics | jq ".events"'
   
   # Document attack patterns for future reference
   ```

## 🗄️ Database Issues (P1/P2)

### Symptoms
- Database connection errors
- High query latency
- Transaction timeouts

### Investigation Steps

1. **Check Database Connectivity**
   ```bash
   # Test basic connectivity
   curl https://pitchey-production.cavelltheleaddev.workers.dev/api/health/db
   
   # Check connection pool status
   curl https://pitchey-infra.workers.dev/infra/health | jq '.database'
   ```

2. **Review Database Performance**
   ```bash
   # Get database metrics
   curl https://pitchey-apm.workers.dev/apm/db-metrics
   
   # Check for slow queries
   curl "https://pitchey-logs.workers.dev/logs/search?q=query+timeout"
   ```

3. **Check Database Logs**
   ```bash
   # Review database-related errors
   curl "https://pitchey-logs.workers.dev/logs/query?service=database&level=error"
   ```

### Resolution Approaches

1. **Connection Pool Issues**
   ```bash
   # Restart connection pool (if possible)
   # Increase pool size temporarily
   # Check for connection leaks
   ```

2. **Performance Issues**
   ```bash
   # Identify slow queries
   # Check for missing indexes
   # Consider query optimization
   ```

3. **Capacity Issues**
   ```bash
   # Check database resource usage
   # Consider scaling database
   # Implement read replicas if needed
   ```

## 📱 Frontend Issues (P3)

### Symptoms
- JavaScript errors in browser
- Poor Web Vitals scores
- UI rendering issues

### Investigation Steps

1. **Check Browser Errors**
   ```bash
   # Review frontend error logs
   curl "https://pitchey-logs.workers.dev/logs/query?service=frontend&level=error"
   
   # Check Sentry frontend errors
   ```

2. **Review Web Vitals**
   ```bash
   # Get recent Web Vitals data
   curl "https://pitchey-apm.workers.dev/apm/metrics?name=web.lcp"
   curl "https://pitchey-apm.workers.dev/apm/metrics?name=web.cls"
   curl "https://pitchey-apm.workers.dev/apm/metrics?name=web.fid"
   ```

3. **Check Asset Loading**
   ```bash
   # Review resource timing
   # Check CDN performance
   # Verify asset compression
   ```

### Resolution Steps

1. **Fix JavaScript Errors**
   ```bash
   # Deploy hotfix if critical
   # Implement error boundaries
   # Add better error handling
   ```

2. **Improve Performance**
   ```bash
   # Optimize asset loading
   # Implement code splitting
   # Enable compression
   ```

## 🔧 Monitoring System Issues (P3)

### Symptoms
- Missing monitoring data
- Dashboard not updating
- Alerts not firing

### Self-Healing Steps

1. **Check Monitoring Workers**
   ```bash
   # Check monitoring worker health
   curl https://pitchey-monitoring.workers.dev/monitoring/health
   
   # Check log aggregation
   curl https://pitchey-logs.workers.dev/logs/stats
   
   # Check APM service
   curl https://pitchey-apm.workers.dev/apm/summary
   ```

2. **Verify Data Storage**
   ```bash
   # Check KV storage
   curl https://pitchey-infra.workers.dev/infra/kv
   
   # Verify scheduled tasks
   wrangler tail pitchey-monitoring --format pretty | head -20
   ```

3. **Test Alert Channels**
   ```bash
   # Test Slack integration
   curl -X POST https://pitchey-alerts.workers.dev/alerts/trigger \
     -H "Content-Type: application/json" \
     -d '{
       "type": "info",
       "title": "Test Alert",
       "message": "Testing alert system",
       "source": "monitoring-test"
     }'
   ```

### Recovery Steps

1. **Restart Monitoring Services**
   ```bash
   # Redeploy monitoring workers
   wrangler deploy src/monitoring-worker.ts --name pitchey-monitoring
   
   # Clear problematic cache entries
   # Reset monitoring state if needed
   ```

2. **Verify Data Collection**
   ```bash
   # Check that new data is being collected
   # Verify metrics are updating
   # Test end-to-end data flow
   ```

## 📋 Post-Incident Procedures

### Immediate Post-Resolution (0-2 hours)

1. **Verify Resolution**
   ```bash
   # Run full health check suite
   ./monitoring/scripts/comprehensive-health-check.sh
   
   # Monitor for 30-60 minutes
   # Confirm no recurrence
   ```

2. **Update Status**
   ```bash
   # Mark incident as resolved
   curl -X POST https://pitchey-alerts.workers.dev/alerts/resolve \
     -H "Content-Type: application/json" \
     -d '{
       "alertId": "ALERT_ID",
       "userId": "YOUR_ID",
       "resolution": "Issue resolved by [specific action taken]"
     }'
   ```

3. **Communicate Resolution**
   - Update Slack #incidents channel
   - Notify stakeholders
   - Update status page if applicable

### Short-term Follow-up (2-24 hours)

1. **Data Collection**
   - Gather all relevant logs and metrics
   - Document timeline of events
   - Collect team member perspectives

2. **Initial Analysis**
   - Identify root cause
   - Document immediate fixes applied
   - Note any temporary workarounds

### Long-term Follow-up (1-7 days)

1. **Post-Incident Review**
   - Schedule blameless post-mortem
   - Analyze root cause thoroughly
   - Identify improvement opportunities

2. **Action Items**
   - Create tickets for preventive measures
   - Update monitoring/alerting if needed
   - Improve runbooks based on learnings

## 🛠️ Useful Commands and Scripts

### Quick Health Check
```bash
#!/bin/bash
# quick-health-check.sh

echo "=== Pitchey Platform Health Check ==="

echo "1. Main API Health:"
curl -s https://pitchey-production.cavelltheleaddev.workers.dev/api/health | jq '.'

echo -e "\n2. Monitoring System:"
curl -s https://pitchey-monitoring.workers.dev/monitoring/health | jq '.status'

echo -e "\n3. Infrastructure Health:"
curl -s https://pitchey-infra.workers.dev/infra/health | jq '.worker.status, .kv.status, .r2.status'

echo -e "\n4. Recent Errors (last 10 minutes):"
curl -s "https://pitchey-logs.workers.dev/logs/query?level=error&limit=10" | \
  jq '.logs[] | select(.timestamp > (now - 600)) | .message'

echo -e "\n5. Current Performance:"
curl -s https://pitchey-apm.workers.dev/apm/summary | jq '.responseTime'

echo -e "\n=== Health Check Complete ==="
```

### Error Analysis Script
```bash
#!/bin/bash
# error-analysis.sh

TIME_WINDOW=${1:-3600000}  # Default: 1 hour in milliseconds

echo "=== Error Analysis (Last $(($TIME_WINDOW/60000)) minutes) ==="

echo "1. Error Count by Service:"
curl -s "https://pitchey-logs.workers.dev/logs/stats?timeWindow=$TIME_WINDOW" | \
  jq '.services'

echo -e "\n2. Top Error Messages:"
curl -s "https://pitchey-logs.workers.dev/logs/query?level=error&limit=50" | \
  jq -r '.logs[] | select(.timestamp > (now - ('$TIME_WINDOW'/1000))) | .message' | \
  sort | uniq -c | sort -rn | head -10

echo -e "\n3. Error Rate Trend:"
curl -s https://pitchey-apm.workers.dev/apm/summary | jq '.errorRate'

echo -e "\n=== Analysis Complete ==="
```

### Performance Analysis
```bash
#!/bin/bash
# performance-analysis.sh

echo "=== Performance Analysis ==="

echo "1. Response Time Summary:"
curl -s https://pitchey-apm.workers.dev/apm/summary | jq '.responseTime'

echo -e "\n2. Database Performance:"
curl -s https://pitchey-apm.workers.dev/apm/db-metrics | \
  jq '.avgQueryTime, .p95QueryTime, .errorRate'

echo -e "\n3. Infrastructure Utilization:"
curl -s https://pitchey-infra.workers.dev/infra/worker | \
  jq '.cpuUtilization, .memoryUtilization'

echo -e "\n4. Web Vitals (last hour):"
curl -s "https://pitchey-apm.workers.dev/apm/summary?timeWindow=3600000" | \
  jq '.webVitals'

echo -e "\n=== Performance Analysis Complete ==="
```

## 📞 Escalation Contacts

### Internal Team
- **Platform Engineering**: @platform-team (Slack)
- **DevOps**: @devops-team (Slack)  
- **Security**: @security-team (Slack)

### External Vendors
- **Cloudflare Support**: Enterprise support portal
- **Sentry Support**: support@sentry.io
- **Database Provider**: Support portal/contact

### On-Call Rotation
- **Primary**: Check PagerDuty schedule
- **Secondary**: Check PagerDuty schedule
- **Management Escalation**: Check escalation policy

---

**Remember**: Stay calm, work methodically, and document everything. When in doubt, escalate early rather than spending too much time investigating alone.

**Version**: 1.0.0  
**Last Updated**: December 2, 2025  
**Next Review**: March 2026