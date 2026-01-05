# Pitchey Production Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to production incidents in the Pitchey platform. Follow these procedures to quickly identify, mitigate, and resolve issues while maintaining system stability and data integrity.

## Incident Severity Levels

### SEV 1 - Critical (P0)
- **Response Time**: Immediate (< 5 minutes)
- **Resolution Time**: 1 hour
- **Examples**: Complete service outage, data loss, security breach
- **Escalation**: Page on-call engineer immediately

### SEV 2 - High (P1)
- **Response Time**: 15 minutes
- **Resolution Time**: 4 hours
- **Examples**: Major feature unavailable, significant performance degradation
- **Escalation**: Notify team via Slack

### SEV 3 - Medium (P2)
- **Response Time**: 1 hour
- **Resolution Time**: 24 hours
- **Examples**: Minor feature issues, non-critical performance problems
- **Escalation**: Create ticket for next business day

### SEV 4 - Low (P3)
- **Response Time**: Next business day
- **Resolution Time**: 72 hours
- **Examples**: Cosmetic issues, documentation updates
- **Escalation**: Standard ticket queue

## Initial Response Checklist

### Immediate Actions (First 5 Minutes)

1. **Acknowledge the Incident**
   ```bash
   # Update incident status
   echo "$(date): Incident acknowledged by $(whoami)" >> incident_log.txt
   ```

2. **Assess Severity**
   - Determine incident severity level
   - Check impact scope (users affected, features impacted)
   - Document initial findings

3. **Form Response Team**
   - Primary Engineer (incident commander)
   - Secondary Engineer (technical support)
   - Engineering Manager (escalation point)

4. **Start Communication**
   - Update status page if applicable
   - Notify stakeholders via appropriate channels
   - Start incident war room if SEV 1 or 2

### Investigation Phase

#### System Health Check
```bash
# Quick health assessment
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2

# Check API health
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | jq '.'

# Check frontend availability
curl -s -o /dev/null -w "%{http_code}" https://pitchey-5o8-66n.pages.dev

# Check database connectivity
psql "$DATABASE_URL" -c "SELECT 1;" 2>/dev/null && echo "DB OK" || echo "DB FAILED"

# Check Redis connectivity
redis-cli -u "$REDIS_URL" ping 2>/dev/null && echo "Redis OK" || echo "Redis FAILED"
```

#### Log Analysis
```bash
# Check recent error logs
journalctl --since "1 hour ago" --grep ERROR

# Check application logs (if using centralized logging)
# tail -f /var/log/pitchey/application.log | grep ERROR

# Check Cloudflare Workers logs
wrangler tail --format pretty

# Check Sentry for error reports
open "https://sentry.io/organizations/your-org/issues/"
```

#### Performance Monitoring
```bash
# Check system resources
top -n 1 | head -20
df -h
free -m

# Check network connectivity
ping -c 3 8.8.8.8

# Check DNS resolution
nslookup pitchey-api-prod.ndlovucavelle.workers.dev
```

## Common Incident Scenarios

### Scenario 1: Complete Service Outage

**Symptoms**: 5xx errors across all endpoints, health checks failing

**Investigation Steps**:
1. Check Cloudflare status dashboard
2. Verify Worker deployment status
3. Check database connectivity
4. Review recent deployments

**Resolution Procedure**:
```bash
# 1. Check recent deployments
git log --oneline -10

# 2. Check Worker status
wrangler status

# 3. Quick rollback if recent deployment
./scripts/rollback-deployment.sh

# 4. If database issue, check connection pooling
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity;"

# 5. Emergency worker restart (if needed)
wrangler deploy --compatibility-date $(date -d '1 day ago' +%Y-%m-%d)
```

### Scenario 2: Database Connection Issues

**Symptoms**: Database timeout errors, connection pool exhaustion

**Investigation Steps**:
1. Check database server status
2. Monitor connection pool metrics
3. Review slow query logs
4. Check for blocking transactions

**Resolution Procedure**:
```bash
# 1. Check active connections
psql "$DATABASE_URL" -c "
SELECT count(*), state 
FROM pg_stat_activity 
WHERE datname = 'neondb' 
GROUP BY state;"

# 2. Identify blocking queries
psql "$DATABASE_URL" -c "
SELECT pid, query, state, query_start 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start;"

# 3. Kill long-running queries (if safe)
# psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(PID);"

# 4. Restart connection pooler if needed
# (This depends on your specific setup)
```

### Scenario 3: High Error Rate

**Symptoms**: Increased 4xx/5xx responses, user reports of errors

**Investigation Steps**:
1. Check error rate trends
2. Identify affected endpoints
3. Review recent code changes
4. Check external service dependencies

**Resolution Procedure**:
```bash
# 1. Check specific error endpoints
curl -v https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/session

# 2. Review recent deployments
git log --since="2 hours ago" --oneline

# 3. Check external service status
# - Database provider status
# - Redis provider status  
# - Cloudflare status

# 4. Enable debug logging temporarily
# (Modify Worker environment variables if needed)
```

### Scenario 4: Performance Degradation

**Symptoms**: Slow response times, timeout errors

**Investigation Steps**:
1. Check response time metrics
2. Identify performance bottlenecks
3. Review database query performance
4. Check cache hit rates

**Resolution Procedure**:
```bash
# 1. Run performance test
./scripts/performance-testing-suite.sh load --duration=60 --users=10

# 2. Check database performance
psql "$DATABASE_URL" -c "
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE mean_time > 1000 
ORDER BY mean_time DESC 
LIMIT 10;"

# 3. Check cache performance
redis-cli -u "$REDIS_URL" info stats

# 4. Scale resources if needed (depends on infrastructure)
```

### Scenario 5: Authentication Issues

**Symptoms**: Users unable to log in, session errors

**Investigation Steps**:
1. Test authentication endpoints
2. Check JWT secret validity
3. Verify session storage
4. Review Better Auth configuration

**Resolution Procedure**:
```bash
# 1. Test authentication flow
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# 2. Check session storage
redis-cli -u "$REDIS_URL" keys "session:*" | wc -l

# 3. Verify JWT configuration
# (Check environment variables and secrets)

# 4. Test with demo accounts
./scripts/test-demo-auth.sh
```

## Escalation Procedures

### Level 1: Team Lead
- **Trigger**: Incident not resolved within initial timeline
- **Contact**: Slack @team-lead or phone
- **Responsibilities**: Technical oversight, resource allocation

### Level 2: Engineering Manager
- **Trigger**: SEV 1/2 incidents or Level 1 escalation
- **Contact**: Phone call + Slack
- **Responsibilities**: Stakeholder communication, external coordination

### Level 3: Executive Team
- **Trigger**: Extended outages, security breaches, data loss
- **Contact**: Phone call
- **Responsibilities**: Business decision making, customer communication

## Communication Templates

### Initial Incident Notification
```
🚨 INCIDENT ALERT - SEV [X]

Title: [Brief description]
Status: Investigating
Impact: [User impact description]
Started: [Timestamp]
ETA: Under investigation

Updates will follow every 15 minutes for SEV 1, 30 minutes for SEV 2.
```

### Status Update
```
📋 INCIDENT UPDATE - SEV [X]

Title: [Brief description]  
Status: [Investigating/Identified/Monitoring/Resolved]
Impact: [Current impact]
Progress: [What has been done]
Next Steps: [What is being done next]
ETA: [Updated timeline]

Next update: [Timestamp]
```

### Resolution Notification
```
✅ INCIDENT RESOLVED - SEV [X]

Title: [Brief description]
Duration: [Total incident time]
Root Cause: [Brief root cause]
Resolution: [How it was fixed]
Prevention: [Steps to prevent recurrence]

Post-mortem will be scheduled within 24 hours.
```

## Recovery Procedures

### Post-Incident Checklist

1. **System Verification**
   ```bash
   # Run comprehensive health checks
   ./scripts/production-health-check.sh
   
   # Verify all systems operational
   ./scripts/verify-production.sh
   
   # Check data integrity
   ./scripts/verify-data-integrity.sh
   ```

2. **Monitoring Setup**
   ```bash
   # Enable enhanced monitoring
   ./scripts/enable-enhanced-monitoring.sh
   
   # Set up incident-specific alerts
   ./scripts/setup-incident-alerts.sh
   ```

3. **Stakeholder Communication**
   - Send resolution notification
   - Update status page
   - Plan customer communication if needed

4. **Documentation**
   - Complete incident report
   - Update runbook if needed
   - Schedule post-mortem

### Data Recovery Procedures

#### Database Recovery
```bash
# 1. Check for recent backups
ls -la ${PROJECT_ROOT}/.backups/

# 2. If point-in-time recovery needed
./scripts/database-recovery.sh --timestamp "2024-01-01 12:00:00"

# 3. Verify data integrity after recovery
./scripts/verify-database-integrity.sh
```

#### File Recovery
```bash
# 1. Check R2 bucket versioning
aws s3api list-object-versions --bucket pitchey-documents-production

# 2. Restore from backup if needed
aws s3 cp s3://pitchey-backups/documents/ s3://pitchey-documents-production/ --recursive
```

## Prevention and Monitoring

### Proactive Monitoring Setup
```bash
# Set up automated health checks
./scripts/setup-health-monitoring.sh

# Configure alerting thresholds
./scripts/configure-alert-thresholds.sh

# Enable performance monitoring
./scripts/enable-performance-monitoring.sh
```

### Regular Health Checks
```bash
# Daily system check
0 9 * * * /path/to/pitchey/scripts/daily-health-check.sh

# Weekly performance baseline
0 6 * * 1 /path/to/pitchey/scripts/performance-baseline.sh

# Monthly disaster recovery test
0 8 1 * * /path/to/pitchey/scripts/dr-test.sh
```

## Tools and Resources

### Monitoring Dashboards
- **Application Health**: https://grafana.example.com/d/app-health
- **Infrastructure Metrics**: https://grafana.example.com/d/infrastructure
- **Error Tracking**: https://sentry.io/organizations/pitchey/

### Documentation Links
- **Architecture Diagram**: ./docs/ARCHITECTURE.md
- **API Documentation**: ./docs/API_DOCUMENTATION.md
- **Deployment Guide**: ./docs/DEPLOYMENT_GUIDE.md
- **Database Schema**: ./docs/database-schema.md

### Emergency Contacts
- **On-Call Engineer**: [Phone/Slack]
- **Database Admin**: [Phone/Slack]
- **Security Team**: [Phone/Slack]
- **Legal/Compliance**: [Phone/Email]

### Useful Commands
```bash
# Quick system status
./scripts/quick-status.sh

# Emergency rollback
./scripts/emergency-rollback.sh

# Enable maintenance mode
./scripts/enable-maintenance-mode.sh

# Check deployment history
./scripts/deployment-history.sh
```

## Post-Mortem Process

### Timeline
- **Schedule**: Within 24 hours of resolution
- **Attendees**: Response team + stakeholders
- **Duration**: 1 hour maximum

### Agenda Template
1. **Incident Summary** (5 minutes)
2. **Timeline Review** (15 minutes)
3. **Root Cause Analysis** (20 minutes)
4. **Action Items** (15 minutes)
5. **Process Improvements** (5 minutes)

### Action Item Categories
- **Immediate**: Must be completed within 24 hours
- **Short-term**: Must be completed within 1 week
- **Long-term**: Must be completed within 1 month
- **Process**: Improvements to procedures and documentation

### Follow-up
- Action item tracking in project management system
- Runbook updates based on lessons learned
- Training updates for team members

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Owner**: Platform Engineering Team  
**Review Schedule**: Quarterly