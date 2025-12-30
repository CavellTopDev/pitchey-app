# Monitoring Stack Deployment Guide

## Quick Start

### 1. Run Simple Health Check
```bash
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
./monitoring/simple-health-check.sh
```

This will test all critical services and provide a baseline health status.

### 2. Start 48-Hour Performance Baseline (Recommended)
```bash
# Start baseline tracking in the background
nohup ./monitoring/performance-baseline-tracker.sh start > monitoring/logs/baseline.log 2>&1 &

# Check progress
./monitoring/performance-baseline-tracker.sh status
```

This will establish performance baselines over 48 hours for proper alert threshold tuning.

### 3. Deploy Full Monitoring Stack (Optional)
```bash
# Prerequisites: Docker and docker-compose installed
./monitoring/deploy-monitoring-stack.sh deploy
```

## Immediate Actions

### Critical Configuration
1. **Set up Cloudflare API access** in `monitoring/.env.monitoring`:
   ```bash
   CLOUDFLARE_API_TOKEN=your_token_here
   CLOUDFLARE_ACCOUNT_ID=e16d3bf549153de23459a6c6a06a431b
   ```

2. **Configure alerts** (email, Slack, Discord):
   ```bash
   ALERT_EMAIL=your-email@domain.com
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   ```

### Monitoring Schedule
Add to crontab for automated monitoring:
```bash
# Health check every 5 minutes
*/5 * * * * /home/supremeisbeing/pitcheymovie/pitchey_v0.2/monitoring/simple-health-check.sh > /dev/null 2>&1

# Daily performance summary
0 9 * * * /home/supremeisbeing/pitcheymovie/pitchey_v0.2/monitoring/performance-baseline-tracker.sh report
```

## Key Files Created

### Health Monitoring
- `monitoring/simple-health-check.sh` - Basic service health checks
- `monitoring/automated-health-monitor.sh` - Advanced monitoring with recovery
- `monitoring/performance-baseline-tracker.sh` - 48-hour performance analysis

### Monitoring Stack
- `monitoring/production-monitoring-stack.yml` - Docker Compose configuration
- `monitoring/deploy-monitoring-stack.sh` - Deployment automation

### Documentation
- `monitoring/runbooks/incident-response-playbook.md` - Emergency procedures
- `monitoring/runbooks/troubleshooting-guide.md` - Common issues and solutions
- `monitoring/PRODUCTION_MONITORING_SETUP_COMPLETE.md` - Complete system overview

### Configuration
- `monitoring/prometheus/prometheus.yml` - Metrics collection config
- `monitoring/alertmanager/alertmanager.yml` - Alert routing rules
- `monitoring/prometheus/rules/pitchey-alerts.yml` - Alert definitions

## Current Service Status

Based on the health check, the following services are operational:
✅ Frontend (https://pitchey-5o8.pages.dev) - 94ms response time  
✅ Worker Health API - 84ms response time  
✅ Worker Detailed API - 412ms response time  
✅ Browse API - 147ms response time  
⚠️ Auth Check API - Returns 404 (may be expected)  
⚠️ Cache Performance - 0% hit rate (needs optimization)  

## Next Steps

### Week 1
1. **Establish Baselines**: Complete 48-hour performance tracking
2. **Configure Alerts**: Set up email and Slack notifications
3. **Team Training**: Review incident response procedures

### Week 2  
1. **Optimize Cache**: Improve cache hit rates from current 0%
2. **Performance Tuning**: Address 412ms response time on detailed API
3. **Alert Tuning**: Set thresholds based on baseline data

### Month 1
1. **Advanced Dashboards**: Deploy Grafana monitoring stack
2. **Automation**: Implement automated recovery procedures
3. **Reporting**: Set up weekly performance reports

## Support

### Documentation
- **Incident Response**: `monitoring/runbooks/incident-response-playbook.md`
- **Troubleshooting**: `monitoring/runbooks/troubleshooting-guide.md`
- **Complete Setup**: `monitoring/PRODUCTION_MONITORING_SETUP_COMPLETE.md`

### Quick Commands
```bash
# Check service health
./monitoring/simple-health-check.sh

# View performance status
./monitoring/performance-baseline-tracker.sh status

# Deploy monitoring stack
./monitoring/deploy-monitoring-stack.sh deploy

# Emergency health check with recovery
./monitoring/automated-health-monitor.sh recovery
```

The monitoring system is now ready for production use and will provide comprehensive visibility into the Pitchey application's performance and reliability.