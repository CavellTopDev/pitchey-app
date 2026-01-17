# Pitchey Monitoring Guide

Complete guide for monitoring the Pitchey platform using Cloudflare, Axiom, and Sentry.

## Quick Links

| Service | Dashboard URL |
|---------|--------------|
| Cloudflare Workers | https://dash.cloudflare.com |
| Sentry | https://sentry.io |
| Axiom | https://app.axiom.co |
| Status Page | https://pitchey-api-prod.ndlovucavelle.workers.dev/api/status |

---

## 1. Live Monitoring Endpoints

### Status Dashboard
```bash
# Full system status with all service health checks
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/status
```

Response includes:
- Overall system status (operational/degraded/major_outage)
- Individual service health (Database, Cache, Storage, Auth, WebSocket)
- 24h metrics (requests, errors, response times)
- Active user count

### Health Ping (for uptime monitors)
```bash
# Simple health check for UptimeRobot, Pingdom, etc.
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/ping
```

### Service-Specific Health
```bash
# Check specific service
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/database
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/cache
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/storage
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/auth
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/websocket
```

### Detailed Health (internal)
```bash
# Comprehensive health check with all metrics
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/health
```

### Admin Metrics
```bash
# Error metrics and performance data (requires auth)
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/admin/metrics
```

---

## 2. Cloudflare Workers Analytics

### Real-time Tail Logs
```bash
# Watch live logs
wrangler tail pitchey-api-prod --format=pretty

# Filter by status
wrangler tail pitchey-api-prod --format=pretty --status=error

# Filter by path
wrangler tail pitchey-api-prod --format=pretty --search="/api/auth"

# JSON format for piping
wrangler tail pitchey-api-prod --format=json | jq '.logs'
```

### Cloudflare Dashboard Metrics
1. Go to https://dash.cloudflare.com
2. Select Workers & Pages > pitchey-api-prod
3. View Analytics tab for:
   - Request volume
   - CPU time
   - Error rate
   - Geographic distribution

---

## 3. Axiom Log Queries (APL)

### Setup
Dataset: `pitchey-logs`

### Common Queries

#### All Errors in Last Hour
```apl
['pitchey-logs']
| where _time > ago(1h)
| where level == "error"
| project _time, error.message, request.path, request.method
| sort by _time desc
```

#### 5xx Errors by Endpoint
```apl
['pitchey-logs']
| where _time > ago(24h)
| where type == "request" and response.status >= 500
| summarize count() by request.path
| sort by count_ desc
| take 20
```

#### Slow Requests (>2s)
```apl
['pitchey-logs']
| where _time > ago(1h)
| where type == "request" and response.duration > 2000
| project _time, request.path, response.duration, response.status
| sort by response.duration desc
```

#### Request Volume by Hour
```apl
['pitchey-logs']
| where _time > ago(24h)
| where type == "request"
| summarize requests = count() by bin(_time, 1h)
| sort by _time asc
```

#### Error Rate Over Time
```apl
['pitchey-logs']
| where _time > ago(24h)
| where type == "request"
| summarize
    total = count(),
    errors = countif(response.status >= 500)
    by bin(_time, 1h)
| extend error_rate = (errors * 100.0) / total
| project _time, error_rate, total, errors
```

#### Authentication Failures
```apl
['pitchey-logs']
| where _time > ago(24h)
| where request.path contains "/api/auth"
| where response.status == 401 or response.status == 403
| summarize count() by request.path, request.ip
| sort by count_ desc
```

#### Top Users by Request Count
```apl
['pitchey-logs']
| where _time > ago(24h)
| where type == "request" and isnotnull(userId)
| summarize requests = count() by userId
| sort by requests desc
| take 10
```

#### Geographic Distribution
```apl
['pitchey-logs']
| where _time > ago(24h)
| where type == "request"
| summarize count() by request.country
| sort by count_ desc
```

#### Status Check History
```apl
['pitchey-logs']
| where _time > ago(24h)
| where type == "status_check"
| project _time, overall, services, metrics.errorRate
| sort by _time desc
```

---

## 4. Sentry Error Tracking

### DSN Configuration
```
SENTRY_DSN=https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536
```

### Sentry Dashboard Queries

#### View All Unresolved Issues
1. Go to https://sentry.io
2. Navigate to Issues
3. Filter: `is:unresolved`

#### Find Issues by Error Type
```
error.type:TypeError
error.type:ReferenceError
error.type:NetworkError
```

#### Filter by Endpoint
```
url:*/api/auth/*
url:*/api/pitches/*
```

#### Find Specific User Errors
```
user.email:*@demo.com
```

#### High-Impact Issues (many users affected)
1. Sort by "Users" column
2. Or filter: `users:>10`

#### Recent Regressions
```
is:unresolved firstSeen:-24h
```

### Sentry Alerts (Recommended Setup)

1. **Error Spike Alert**
   - Condition: Error count > 50 in 5 minutes
   - Action: Slack/Email notification

2. **New Issue Alert**
   - Condition: New issue with level=error
   - Action: Slack notification

3. **Critical Error Alert**
   - Condition: Issue tagged `critical`
   - Action: PagerDuty/immediate notification

---

## 5. Setting Up Alerts

### Axiom Alerts

1. Go to Axiom Dashboard > Monitors
2. Create New Monitor:

**Error Rate Alert**
```apl
['pitchey-logs']
| where _time > ago(5m)
| where type == "request"
| summarize
    total = count(),
    errors = countif(response.status >= 500)
| extend error_rate = (errors * 100.0) / total
| where error_rate > 5
```
- Threshold: error_rate > 5%
- Frequency: Every 5 minutes
- Action: Slack webhook

**Database Health Alert**
```apl
['pitchey-logs']
| where _time > ago(5m)
| where type == "status_check"
| where services[0].status == "down"
| count
```
- Threshold: count > 0
- Action: PagerDuty

### Cloudflare Notifications

1. Go to Cloudflare Dashboard > Notifications
2. Create:
   - **Workers Error Rate**: Threshold 5%
   - **Workers CPU Exhaustion**: Any occurrence
   - **R2 Storage**: Approaching limits

### UptimeRobot Setup

1. Create monitor: `https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/ping`
2. Check interval: 1 minute
3. Alert contacts: Email, Slack

---

## 6. Common Debugging Scenarios

### "API is slow"
```bash
# Check recent response times
wrangler tail pitchey-api-prod --format=json | jq 'select(.logs[].message | contains("response_time"))'

# Axiom query for slow endpoints
['pitchey-logs']
| where _time > ago(1h)
| where type == "request"
| summarize avg(response.duration), p95=percentile(response.duration, 95) by request.path
| where p95 > 1000
| sort by p95 desc
```

### "Users can't login"
```bash
# Check auth errors
wrangler tail pitchey-api-prod --search="/api/auth" --status=error

# Axiom query
['pitchey-logs']
| where _time > ago(1h)
| where request.path contains "/api/auth"
| where response.status >= 400
| project _time, request.path, response.status, error.message
```

### "Database connection issues"
```bash
# Health check
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/database

# Axiom query
['pitchey-logs']
| where _time > ago(1h)
| where type == "status_check"
| project _time, services[0].status, services[0].latency, services[0].details
```

### "High error rate"
```bash
# Quick status
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/status | jq '.metrics'

# Axiom breakdown
['pitchey-logs']
| where _time > ago(1h)
| where type == "request" and response.status >= 500
| summarize count() by error.name, error.message
| sort by count_ desc
```

---

## 7. Best Practices

1. **Set up baseline alerts before issues occur**
   - Error rate > 1% = warning
   - Error rate > 5% = critical
   - Response time p95 > 2s = warning

2. **Monitor health endpoints from multiple locations**
   - Use UptimeRobot or Pingdom with geographic distribution

3. **Review Sentry weekly**
   - Archive resolved issues
   - Set up issue ownership for teams

4. **Keep Axiom queries saved**
   - Create a dashboard with key metrics
   - Share with team

5. **Test alerts regularly**
   - Trigger a test error monthly
   - Verify notification channels work

---

## Quick Reference Card

```
# Live logs
wrangler tail pitchey-api-prod --format=pretty

# System status
curl .../api/status | jq

# Health ping
curl .../api/health/ping

# Error metrics
curl .../api/admin/metrics

# Axiom errors last hour
['pitchey-logs'] | where _time > ago(1h) | where level == "error"

# Sentry unresolved
is:unresolved
```
