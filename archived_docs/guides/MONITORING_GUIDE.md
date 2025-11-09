# Monitoring Guide

## Overview
Complete monitoring and alerting system for Pitchey production deployment.

## Quick Start

### 1. Run Health Check
```bash
./monitoring/health-check.sh
```

### 2. View Performance Dashboard
```bash
# Open in browser
open monitoring/performance-dashboard.html

# Or with Python server
cd monitoring && python3 -m http.server 8080
# Then visit http://localhost:8080/performance-dashboard.html
```

### 3. Configure Alerts
```bash
# Copy template
cp monitoring/.env.alerts.template monitoring/.env.alerts

# Edit with your webhook URLs/email
nano monitoring/.env.alerts
```

## Monitoring Components

### 1. Health Check Script (`health-check.sh`)
Performs comprehensive system checks:
- Backend API availability
- Frontend accessibility
- Database connectivity
- Response time measurement
- CORS configuration verification
- Public endpoint testing

**Schedule**: Every 5 minutes via cron

### 2. Performance Dashboard (`performance-dashboard.html`)
Real-time visualization of:
- System status
- Backend/Frontend response times
- Error rates
- Active users (simulated)
- Request volume (simulated)
- Historical trends via charts

**Features**:
- Auto-refresh every 30 seconds
- Color-coded status indicators
- SVG charts for trends
- Mobile responsive

### 3. Uptime Monitor (`uptime-monitor.sh`)
Continuous monitoring with immediate alerts:
- Checks services every 60 seconds
- Sends alerts via webhooks (Discord/Slack)
- Implements cooldown to prevent spam
- Logs all incidents

**Usage**:
```bash
# Run in background
nohup ./monitoring/uptime-monitor.sh > monitoring/logs/uptime.log 2>&1 &

# Check if running
ps aux | grep uptime-monitor

# Stop monitoring
pkill -f uptime-monitor.sh
```

### 4. Alert System
Multiple notification channels:
- **Email**: Via configured SMTP
- **Discord**: Webhook integration
- **Slack**: Webhook integration
- **Logs**: Local file storage

### 5. Daily Reports (`daily-summary.sh`)
Automated daily summary includes:
- Total alerts count
- Alert type breakdown
- Health check statistics
- Average response times

**Schedule**: Daily at 9 AM via cron

## Setting Up Automated Monitoring

### 1. Add Cron Jobs
```bash
# Open crontab editor
crontab -e

# Add these lines:
*/5 * * * * /home/supremeisbeing/pitcheymovie/pitchey_v0.2/monitoring/health-check.sh > /dev/null 2>&1
0 9 * * * /home/supremeisbeing/pitcheymovie/pitchey_v0.2/monitoring/daily-summary.sh
0 10 * * 1 /home/supremeisbeing/pitcheymovie/pitchey_v0.2/monitoring/weekly-report.sh
0 2 * * 0 find /home/supremeisbeing/pitcheymovie/pitchey_v0.2/monitoring/logs -name "*.log" -mtime +30 -delete
```

### 2. Configure Webhooks

#### Discord Webhook
1. Go to Server Settings → Integrations → Webhooks
2. Create new webhook
3. Copy URL to `.env.alerts`

#### Slack Webhook
1. Visit https://api.slack.com/messaging/webhooks
2. Create incoming webhook
3. Copy URL to `.env.alerts`

### 3. Test Alert System
```bash
# Send test alert
echo "Test alert from monitoring system" | ./monitoring/webhook-alert.sh

# Check alert log
tail monitoring/alerts.log
```

## Monitoring Locations

| Type | Location | Purpose |
|------|----------|---------|
| **Logs** | `monitoring/logs/` | Health check results |
| **Alerts** | `monitoring/alerts.log` | All system alerts |
| **Reports** | `monitoring/reports/` | Daily/weekly summaries |
| **Dashboard** | `monitoring/performance-dashboard.html` | Visual monitoring |

## Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Backend Response | > 1000ms | > 3000ms |
| Frontend Response | > 2000ms | > 5000ms |
| Error Rate | > 2% | > 5% |
| Uptime | < 99.5% | < 99% |

## Troubleshooting

### Issue: Health check shows 401 on public endpoints
**Current Status**: Known issue with `/api/public/pitches`
**Workaround**: Endpoint requires authentication (being fixed)

### Issue: Dashboard not updating
**Solution**: Check browser console, ensure CORS is enabled

### Issue: Alerts not sending
**Check**:
1. Webhook URLs in `.env.alerts`
2. Network connectivity
3. Alert log for errors

### Issue: Cron jobs not running
**Verify**:
```bash
# Check if cron is running
service cron status

# Check cron logs
grep CRON /var/log/syslog

# List current crontab
crontab -l
```

## Production Dashboards

### External Monitoring
- **Deno Deploy**: https://dash.deno.com/projects/pitchey-backend-fresh/logs
- **cloudflare-pages**: https://app.cloudflare-pages.com/sites/pitchey/overview
- **Neon Database**: https://console.neon.tech

### Recommended Third-Party Services

#### Free Tier Options
1. **UptimeRobot**: 50 monitors, 5-min intervals
2. **Pingdom**: 1 monitor free
3. **StatusCake**: 10 tests free
4. **Better Uptime**: 10 monitors free

#### Setup UptimeRobot (Recommended)
1. Sign up at https://uptimerobot.com
2. Add monitor for: https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev/api/health
3. Add monitor for: https://pitchey.pages.dev
4. Configure email/webhook alerts

## Maintenance

### Weekly Tasks
- Review alert trends
- Check response time degradation
- Clean old log files (automated)

### Monthly Tasks
- Analyze performance metrics
- Update alert thresholds
- Review error patterns
- Test disaster recovery

## Emergency Procedures

### Service Down
1. Check monitoring dashboard
2. Review recent alerts
3. Check deployment platform logs
4. Restart service if needed
5. Notify team via configured channels

### High Error Rate
1. Check error logs
2. Identify error pattern
3. Review recent deployments
4. Rollback if necessary
5. Create incident report

## Contact

### Platform Support
- **Deno Deploy**: support@deno.com
- **cloudflare-pages**: https://www.cloudflare-pages.com/support/
- **Neon**: https://neon.tech/support

### Alert Configuration Help
- Check `monitoring/setup-alerts.sh` for setup instructions
- Review `.env.alerts.template` for configuration options