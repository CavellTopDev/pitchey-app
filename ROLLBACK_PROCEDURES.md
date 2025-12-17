# Rollback Procedures

## 🔄 Overview

This document provides step-by-step procedures for rolling back deployments in case of production issues.

## 🚨 When to Rollback

Initiate rollback if:
- Error rate exceeds 5% for more than 5 minutes
- P95 response time exceeds 5 seconds
- Database connectivity is lost
- Critical functionality is broken
- Security vulnerability is discovered

## 📊 Rollback Decision Matrix

| Severity | Symptoms | Action | Timeline |
|----------|----------|---------|----------|
| **Critical** | Site down, data loss risk | Immediate rollback | < 5 minutes |
| **High** | Major feature broken | Rollback after quick fix attempt | < 15 minutes |
| **Medium** | Performance degradation | Monitor and decide | < 30 minutes |
| **Low** | Minor UI issues | Forward fix | Next deployment |

## 🔄 Rollback Procedures

### 1. Cloudflare Worker Rollback

#### Automatic Rollback (GitHub Actions)
```bash
# Trigger rollback workflow
gh workflow run rollback.yml \
  --field environment=production \
  --field component=worker
```

#### Manual Rollback (Wrangler)
```bash
# List recent deployments
wrangler deployments list

# Rollback to specific deployment
wrangler rollback --deployment-id=<DEPLOYMENT_ID>

# Or rollback to previous
wrangler rollback
```

#### Emergency Rollback Script
```bash
#!/bin/bash
# Save as emergency-rollback.sh

echo "🚨 EMERGENCY ROLLBACK INITIATED"

# 1. Rollback Worker
wrangler rollback --env production

# 2. Clear cache
curl -X DELETE https://pitchey-production.cavelltheleaddev.workers.dev/api/admin/cache \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Notify team
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{"text":"🚨 Emergency rollback executed on production"}'

echo "✅ Rollback complete"
```

### 2. Frontend Rollback (Cloudflare Pages)

```bash
# List deployments
wrangler pages deployments list --project-name=pitchey

# Rollback to specific deployment
wrangler pages rollback --project-name=pitchey --deployment-id=<ID>

# Or use GitHub to revert commit
git revert HEAD
git push origin main
# This triggers automatic deployment of reverted code
```

### 3. Database Rollback

#### Schema Rollback
```bash
# Check current migration version
deno run --allow-all src/db/migrate.ts status

# Rollback last migration
deno run --allow-all src/db/migrate.ts rollback

# Rollback to specific version
deno run --allow-all src/db/migrate.ts rollback --to=20240115120000
```

#### Data Rollback
```bash
# Restore from backup (R2 storage)
# 1. List available backups
wrangler r2 object list pitchey-backups/db/

# 2. Download backup
wrangler r2 object get pitchey-backups/db/backup_20240115_020000.sql.gz \
  --file backup.sql.gz

# 3. Restore database
gunzip backup.sql.gz
psql "$DATABASE_URL" < backup.sql
```

### 4. Configuration Rollback

```bash
# Revert secret changes
wrangler secret put JWT_SECRET < previous-jwt-secret.txt
wrangler secret put DATABASE_URL < previous-db-url.txt

# Revert environment variables
wrangler deploy --env production --var FEATURE_FLAG=false
```

## 📋 Rollback Checklist

### Pre-Rollback
- [ ] Identify the issue and impact
- [ ] Document current state
- [ ] Notify stakeholders
- [ ] Prepare rollback commands
- [ ] Have monitoring dashboard open

### During Rollback
- [ ] Execute rollback procedure
- [ ] Monitor error rates
- [ ] Check critical endpoints
- [ ] Verify database connectivity
- [ ] Test authentication flow

### Post-Rollback
- [ ] Confirm system stability
- [ ] Clear caches if needed
- [ ] Update status page
- [ ] Send all-clear notification
- [ ] Schedule post-mortem

## 🔍 Verification After Rollback

```bash
# Run verification script
./scripts/verify-deployment.sh

# Manual checks
curl https://pitchey-production.cavelltheleaddev.workers.dev/health
curl https://pitchey.pages.dev

# Check error rates
curl https://pitchey-production.cavelltheleaddev.workers.dev/metrics | grep error_rate

# Test critical user flows
# 1. Login as each portal type
# 2. Create a test pitch
# 3. Request NDA
# 4. Upload document
```

## 📊 Monitoring During Rollback

### Key Metrics to Watch
1. **Error Rate**: Should drop below 0.5% within 2 minutes
2. **Response Time**: Should return to baseline within 5 minutes
3. **Active Users**: Monitor for user session disruption
4. **Cache Hit Rate**: May temporarily drop, should recover within 10 minutes

### Dashboard URLs
- Cloudflare Analytics: https://dash.cloudflare.com
- Sentry Issues: https://sentry.io/organizations/pitchey/issues/
- Application Metrics: https://pitchey-production.cavelltheleaddev.workers.dev/metrics

## 🚦 Rollback Communication

### Internal Communication
```markdown
**ROLLBACK IN PROGRESS**
- Component: [Worker/Frontend/Database]
- Reason: [Brief description]
- Impact: [User impact]
- ETA: [Expected completion time]
- Status Page: [Updated/Updating]
```

### External Communication (Status Page)
```markdown
**Investigating** - We're investigating reports of [issue description]
**Identified** - We've identified the issue and are implementing a fix
**Monitoring** - A fix has been implemented and we're monitoring the results
**Resolved** - The issue has been resolved
```

## 🔧 Rollback Automation

### GitHub Actions Workflow
Create `.github/workflows/rollback.yml`:
```yaml
name: Emergency Rollback

on:
  workflow_dispatch:
    inputs:
      component:
        description: 'Component to rollback'
        required: true
        type: choice
        options:
          - worker
          - frontend
          - both
      reason:
        description: 'Reason for rollback'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Rollback Worker
        if: ${{ github.event.inputs.component == 'worker' || github.event.inputs.component == 'both' }}
        run: |
          npm install -g wrangler
          wrangler rollback --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Rollback Frontend
        if: ${{ github.event.inputs.component == 'frontend' || github.event.inputs.component == 'both' }}
        run: |
          wrangler pages rollback --project-name=pitchey
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Clear Cache
        run: |
          curl -X DELETE ${{ secrets.PRODUCTION_URL }}/api/admin/cache \
            -H "Authorization: Bearer ${{ secrets.ADMIN_TOKEN }}"
      
      - name: Notify Team
        uses: 8398a7/action-slack@v3
        with:
          status: custom
          custom_payload: |
            {
              text: "🔄 Rollback executed",
              attachments: [{
                color: 'warning',
                fields: [
                  { title: 'Component', value: '${{ github.event.inputs.component }}' },
                  { title: 'Reason', value: '${{ github.event.inputs.reason }}' },
                  { title: 'Initiated by', value: '${{ github.actor }}' }
                ]
              }]
            }
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 📝 Post-Mortem Template

After rollback, create a post-mortem document:

```markdown
# Post-Mortem: [Date] [Issue Title]

## Summary
- **Date**: [YYYY-MM-DD HH:MM UTC]
- **Duration**: [X minutes]
- **Impact**: [User impact description]
- **Root Cause**: [Brief description]

## Timeline
- HH:MM - Issue detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Rollback initiated
- HH:MM - Rollback completed
- HH:MM - System stable

## Root Cause Analysis
[Detailed explanation]

## Resolution
[What was done to resolve]

## Lessons Learned
1. What went well
2. What went wrong
3. Where we got lucky

## Action Items
- [ ] [Owner] - [Action item 1]
- [ ] [Owner] - [Action item 2]

## Prevention Measures
[Steps to prevent recurrence]
```

## 🆘 Emergency Contacts

| Role | Name | Contact | Escalation Level |
|------|------|---------|-----------------|
| On-Call Engineer | Rotation | PagerDuty | Level 1 |
| DevOps Lead | TBD | Slack/Phone | Level 2 |
| CTO | TBD | Phone | Level 3 |
| Cloudflare Support | - | support@cloudflare.com | Vendor |
| Neon Support | - | support@neon.tech | Vendor |

## 🔐 Access Requirements

Ensure you have:
- Cloudflare API Token with deployment permissions
- GitHub repository write access
- Database connection string
- Admin token for cache operations
- Slack webhook for notifications
- Access to monitoring dashboards

---

**Remember**: Stay calm, follow the procedures, and communicate clearly. Every incident is a learning opportunity.