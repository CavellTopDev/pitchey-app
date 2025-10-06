# Sentry Alerts Configuration Guide

## Quick Setup (5 minutes)

### 1. Access Sentry Dashboard
- Go to https://pitchey.sentry.io
- Navigate to **Alerts** → **Create Alert**

### 2. Critical Alerts to Configure

## Alert 1: High Error Rate
```yaml
Name: High Error Rate - Critical
When: An event occurs
Filter:
  - Environment: production
  - Level: error
Conditions:
  - The issue is seen more than 10 times in 5 minutes
Actions:
  - Send email to team
  - Send to Slack/Discord (if configured)
Team: #everyone
```

## Alert 2: New Error Type
```yaml
Name: New Error Detected
When: A new issue is created
Filter:
  - Environment: production
  - Exclude: test errors
Actions:
  - Send email notification
  - Create ticket (optional)
Priority: High
```

## Alert 3: Performance Degradation
```yaml
Name: Slow API Response
Alert Type: Metric Alert
Dataset: Transactions
Query: p95(transaction.duration)
Conditions:
  - Critical: > 3000ms for 5 minutes
  - Warning: > 1500ms for 10 minutes
Actions:
  - Send notification
  - Page on-call (if critical)
```

## Alert 4: Crash Rate
```yaml
Name: Application Crash Rate
Alert Type: Crash Rate Alert
Conditions:
  - Critical: Session crash rate > 1%
  - Warning: Session crash rate > 0.5%
Time Window: 10 minutes
Actions:
  - Immediate notification
  - SMS alert (critical only)
```

## Alert 5: Failed Transactions
```yaml
Name: Payment Transaction Failures
When: An event occurs
Filter:
  - Transaction: /api/stripe/*
  - Status: failure
Conditions:
  - More than 3 failures in 10 minutes
Actions:
  - Email finance team
  - Create high priority ticket
```

## Alert 6: Security Events
```yaml
Name: Suspicious Activity Detected
When: An event occurs  
Filter:
  - Tags: security:high
  - Level: warning OR error
Conditions:
  - Any occurrence
Actions:
  - Immediate email
  - SMS to security team
  - Log to audit trail
```

## Alert 7: Database Connection Issues
```yaml
Name: Database Connection Failures
When: An event occurs
Filter:
  - Error message contains: "connection" OR "database" OR "postgres"
Conditions:
  - More than 5 in 2 minutes
Actions:
  - Page database team
  - Check backup systems
```

## Alert 8: Memory/Resource Issues
```yaml
Name: High Memory Usage
Alert Type: Metric Alert
Query: 
  - avg(measurements.memory_used)
Conditions:
  - Critical: > 90% for 5 minutes
  - Warning: > 75% for 10 minutes
Actions:
  - Scale up instances
  - Alert DevOps team
```

## Slack Integration Setup

### 1. Install Sentry Slack App
```bash
1. Go to Settings → Integrations → Slack
2. Click "Add Workspace"
3. Authorize Sentry
4. Select channel for alerts
```

### 2. Configure Alert Channel
```yaml
Alert Rules:
  - Critical: #alerts-critical
  - Warning: #alerts-warning
  - Info: #alerts-info
Format: Detailed with stack trace
```

## Discord Integration Setup

### 1. Create Discord Webhook
```bash
# In Discord:
Server Settings → Integrations → Webhooks → New Webhook
Name: Sentry Alerts
Channel: #sentry-alerts
Copy Webhook URL
```

### 2. Add to Sentry
```bash
Settings → Integrations → Discord
Add Webhook URL
Test integration
```

## Email Digest Settings

### Configure Smart Notifications
```yaml
Daily Digest:
  - Time: 9:00 AM
  - Include: All warnings and errors
  - Group by: Issue type
  
Weekly Report:
  - Day: Monday
  - Include: Performance metrics
  - Trends: Show week-over-week
```

## Alert Routing Rules

### By Severity
```yaml
Critical (P0):
  - Immediate: Email + SMS + Slack
  - Escalation: 5 minutes
  - On-call: Required

High (P1):
  - Immediate: Email + Slack
  - Escalation: 15 minutes
  - Review: Within 1 hour

Medium (P2):
  - Notification: Email digest
  - Review: Within 24 hours

Low (P3):
  - Notification: Weekly digest
  - Review: Sprint planning
```

### By Component
```yaml
Payment System:
  - Team: Finance + Engineering
  - Channel: #payments-alerts
  - Escalation: Immediate

Authentication:
  - Team: Security
  - Channel: #security-alerts
  - Audit: Required

Frontend:
  - Team: Frontend
  - Channel: #frontend-alerts
  - Priority: Based on users affected
```

## Custom Alert Conditions

### Business Metrics
```python
# Revenue Impact Alert
if (
  event.tags.transaction_type == "payment" and
  event.level == "error" and
  event.tags.amount > 1000
):
  alert.priority = "critical"
  alert.notify = ["finance", "executive"]
```

### User Impact
```python
# High-Value User Alert
if (
  event.user.subscription == "enterprise" or
  event.user.ltv > 10000
):
  alert.priority = "high"
  alert.support_ticket = True
```

## Testing Your Alerts

### 1. Test Error Generation
```bash
# Backend test
curl -X POST https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev/api/test-error

# Frontend test (in browser console)
window.Sentry.captureException(new Error("Test alert from frontend"));
```

### 2. Verify Alert Delivery
- Check email inbox
- Check Slack/Discord channels
- Verify SMS delivery (if configured)
- Check Sentry Issues dashboard

## Alert Management Best Practices

### 1. Avoid Alert Fatigue
- Set appropriate thresholds
- Group similar errors
- Use smart notifications
- Implement quiet hours

### 2. Priority Matrix
```
         Impact
        Low  High
    Low  P3   P2
Frequency
    High P2   P1
```

### 3. Response Playbooks
Create runbooks for each alert type:
- Investigation steps
- Mitigation actions
- Escalation paths
- Post-mortem requirements

## Monitoring Dashboard

### Key Metrics to Track
- Alert volume by type
- Response time to alerts
- False positive rate
- Resolution time

### Weekly Review Checklist
- [ ] Review all P1/P2 alerts
- [ ] Adjust thresholds if needed
- [ ] Update routing rules
- [ ] Archive resolved issues
- [ ] Update runbooks

## API Automation

### Get Alerts via API
```bash
curl -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  https://sentry.io/api/0/projects/pitchey/pitchey-backend/rules/

# Create alert via API
curl -X POST \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Created Alert",
    "conditions": [...],
    "actions": [...]
  }' \
  https://sentry.io/api/0/projects/pitchey/pitchey-backend/rules/
```

## Quick Action Checklist

Right now, set up these 4 essential alerts:

1. [ ] **High Error Rate** (>10 errors in 5 min)
2. [ ] **New Error Type** (First occurrence)
3. [ ] **Slow Performance** (P95 > 3s)
4. [ ] **Application Crashes** (>1% crash rate)

## Support Resources

- Sentry Docs: https://docs.sentry.io/product/alerts/
- Alert Rules: https://docs.sentry.io/product/alerts/alert-rules/
- Best Practices: https://blog.sentry.io/alert-rules-best-practices/