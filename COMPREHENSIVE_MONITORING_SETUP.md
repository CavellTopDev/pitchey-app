# Comprehensive Monitoring & Alerting Setup for Pitchey Platform

## 🎯 Overview

This document provides a complete implementation of production-ready monitoring and alerting for the Pitchey platform. The system includes real-time health monitoring, performance metrics collection, automated alerting, synthetic monitoring, and interactive dashboards.

## 📊 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Applications  │───▶│  Metrics Gateway │───▶│  Time Series DB │
│  (Workers, API) │    │  (Analytics Eng) │    │  (Prometheus)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Health Checks  │    │   Alert Manager  │    │   Dashboards    │
│  (Synthetic)    │───▶│   (Rules, Routes)│───▶│   (Grafana)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Log Analysis   │    │  Notifications   │    │  Status Pages   │
│  (Structured)   │    │  (Slack/Email)   │    │  (Public/Ops)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🛠 Implementation Components

### 1. Health Monitoring (`src/monitoring/health-monitor.ts`)
- **Real-time health checks** for all system components
- **Configurable thresholds** for degraded/unhealthy states
- **Detailed latency measurements** and connection pool monitoring
- **Automatic problem detection** with contextual error reporting

### 2. Metrics Collection (`src/monitoring/metrics-collector.ts`)
- **Multi-format metric support** (Counter, Gauge, Histogram, Summary)
- **Cloudflare Analytics Engine integration** for edge metrics
- **Real-time aggregation** with rolling windows (1m, 5m, 15m, 1h)
- **Business metric tracking** (user actions, conversions, revenue)

### 3. Alerting Service (`src/monitoring/alerting-service.ts`)
- **Smart alert routing** based on severity and conditions
- **Deduplication and cooldown periods** to prevent alert fatigue
- **Multi-channel notifications** (Slack, Email, PagerDuty, SMS)
- **Escalation policies** with business hours consideration

### 4. Synthetic Monitoring (`src/monitoring/synthetic-monitor.ts`)
- **User journey testing** for critical paths (signup, login, pitch creation)
- **API endpoint monitoring** with response time tracking
- **Multi-location testing** for global performance validation
- **Automated failure detection** with detailed error reporting

### 5. Dashboard Service (`src/monitoring/dashboard-service.ts`)
- **Real-time metric visualization** with 5-second refresh
- **Customizable widgets** (charts, gauges, tables, heatmaps)
- **Interactive dashboards** with drill-down capabilities
- **WebSocket integration** for live updates

### 6. Structured Logging (`src/monitoring/structured-logger.ts`)
- **Contextual log enrichment** with trace IDs and user context
- **Multi-destination logging** (Console, Elasticsearch, Loki)
- **Automatic sensitive data scrubbing** for security compliance
- **Performance correlation** with request/response data

## 🚀 Quick Setup

### 1. Run Setup Script
```bash
cd /path/to/pitchey_v0.2
./scripts/setup-monitoring.sh
```

### 2. Configure Environment Variables
Add to your `.env` or `wrangler.toml`:

```bash
# Core Configuration
ENVIRONMENT=production
VERSION=1.0.0
API_BASE_URL=https://pitchey-production.cavelltheleaddev.workers.dev

# Cloudflare Bindings
ANALYTICS_ENGINE=pitchey_metrics
KV_NAMESPACE=pitchey-monitoring

# Alerting Channels
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-key
ALERT_EMAIL_FROM=alerts@pitchey.com

# SMTP Configuration
SMTP_HOST=smtp.sendgrid.net:587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key

# External Services
SENTRY_DSN=https://your-sentry-dsn@sentry.io
```

### 3. Integrate with Worker
```typescript
import { addMonitoringToWorker } from './src/monitoring/worker-integration';
import { Router } from 'itty-router';

const router = Router();

// Add monitoring to existing worker
const monitoring = addMonitoringToWorker(router, env, db, redis);

// Your existing routes...
router.get('/api/pitches', handlePitches);

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env, ctx);
  }
};
```

## 📈 Key Metrics Tracked

### System Performance
- **Request Rate**: Requests per second across all endpoints
- **Error Rate**: Percentage of failed requests (4xx/5xx)
- **Response Time**: P50, P95, P99 percentiles for all routes
- **Resource Usage**: CPU, memory, database connections
- **Cache Performance**: Hit rate, miss rate, evictions

### Business Metrics
- **Active Users**: Real-time and rolling windows
- **Pitch Activity**: Views, creations, updates per period
- **Investment Flow**: Request rate, conversion funnel
- **NDA Processing**: Signature rate, approval latency
- **Revenue Tracking**: Subscription events, payment success

### Infrastructure Health
- **Database**: Connection pool, query latency, lock contention
- **Cache**: Redis connectivity, memory usage, replication lag
- **Storage**: R2 upload/download success rates and latency
- **WebSockets**: Connection count, message throughput, errors

## 🚨 Alert Configuration

### Critical Alerts (PagerDuty + Slack + Email)
- Error rate > 5% for 2 minutes
- Database unavailable for 1 minute
- Worker unresponsive for 3 minutes
- Synthetic test failures (consecutive)

### Warning Alerts (Slack)
- Error rate > 2% for 5 minutes
- Response time P95 > 3 seconds for 5 minutes
- Memory usage > 85% for 5 minutes
- Cache hit rate < 70% for 10 minutes

### Info Alerts (Slack)
- New deployment notifications
- Scheduled maintenance windows
- Performance threshold updates

## 📊 Dashboard Examples

### 1. System Overview Dashboard
- Health status matrix for all components
- Real-time error rate and response time gauges
- Request throughput and active user trends
- Recent alerts and system events

### 2. Performance Dashboard
- Response time percentiles over time
- Database query performance trends
- Cache hit rates and memory usage
- Resource utilization heatmaps

### 3. Business Intelligence Dashboard
- User activity and engagement metrics
- Revenue and conversion funnels
- Feature usage analytics
- Geographic distribution maps

## 🔧 API Endpoints

### Health Monitoring
```
GET /api/health/all          # Complete health check
GET /api/health/live         # Liveness probe (K8s compatible)
GET /api/health/ready        # Readiness probe (K8s compatible)
```

### Metrics
```
GET  /api/monitoring/metrics           # Current metrics (JSON/Prometheus)
POST /api/monitoring/metrics           # Record custom metrics
GET  /api/monitoring/metrics/query     # Query historical data
GET  /api/monitoring/realtime          # Real-time dashboard data
```

### Alerting
```
GET  /api/monitoring/alerts            # List alerts (active/history)
POST /api/monitoring/alerts            # Create manual alert
POST /api/monitoring/alerts/:id/resolve # Resolve alert
```

### Dashboards
```
GET  /api/monitoring/dashboards        # List available dashboards
GET  /api/monitoring/dashboards/:id    # Get dashboard with data
POST /api/monitoring/dashboards        # Create/update dashboard
```

### Synthetic Monitoring
```
GET  /api/monitoring/synthetic         # Test results and summaries
POST /api/monitoring/synthetic         # Add new test/journey
```

## 🏃‍♂️ Running Synthetic Monitoring

### Start Continuous Monitoring
```bash
# Install Python dependencies
pip3 install requests schedule

# Run synthetic tests
python3 monitoring/synthetic/run_tests.py
```

### Install as System Service
```bash
# Copy service file
sudo cp monitoring/config/pitchey-synthetic.service /etc/systemd/system/

# Enable and start
sudo systemctl enable pitchey-synthetic
sudo systemctl start pitchey-synthetic

# Check status
sudo systemctl status pitchey-synthetic
```

## 📱 Grafana Integration

### Import Dashboards
1. Open Grafana (typically `http://localhost:3000`)
2. Go to **Dashboards** → **Import**
3. Upload `monitoring/grafana-dashboards/pitchey-overview.json`
4. Configure Prometheus datasource URL
5. Set refresh interval to 5 seconds

### Custom Queries
```promql
# Error rate percentage
rate(pitchey_http_errors_total[5m]) / rate(pitchey_http_requests_total[5m]) * 100

# Response time 95th percentile
histogram_quantile(0.95, rate(pitchey_http_response_time_bucket[5m]))

# Active user count
pitchey_active_users_5m

# Database connection pool utilization
pitchey_db_connections_active / pitchey_db_connections_max * 100
```

## 🛡 Security & Compliance

### Data Privacy
- **Automatic PII scrubbing** in logs and metrics
- **Configurable sensitive field detection**
- **GDPR-compliant data retention policies**
- **Audit trail** for all monitoring access

### Access Control
- **Role-based dashboard access** (public vs operational)
- **API authentication** for metric submission
- **Alert channel permissions** based on severity
- **Encrypted webhook endpoints**

### Compliance Features
- **SOC 2 Type II** monitoring coverage
- **GDPR Article 32** security monitoring
- **PCI DSS** transaction monitoring
- **HIPAA** (if handling health data) audit logging

## 📚 Troubleshooting

### Common Issues

1. **Health Checks Failing**
   ```bash
   # Check API accessibility
   curl -f http://localhost:8001/api/health/all
   
   # Review logs
   tail -f monitoring/logs/health-check.log
   
   # Verify database connectivity
   curl -f http://localhost:8001/api/health/db
   ```

2. **No Metrics Data**
   ```bash
   # Test metrics endpoint
   curl http://localhost:8001/api/monitoring/metrics
   
   # Check Analytics Engine binding
   wrangler tail --format=pretty
   
   # Verify KV namespace
   wrangler kv:namespace list
   ```

3. **Alerts Not Firing**
   ```bash
   # Check alert rules
   cat monitoring/alerting/alert_rules.yml
   
   # Test webhook connectivity
   curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Test alert"}'
   
   # Review alert logs
   grep "alert" monitoring/logs/pitchey.log
   ```

### Performance Optimization
- **Metric sampling** for high-traffic environments
- **Async metric recording** to avoid request latency
- **Batch processing** for bulk operations
- **Edge caching** for dashboard queries

## 🔄 Maintenance Tasks

### Daily
- Review active alerts and false positives
- Check synthetic monitoring results
- Verify log retention policies
- Update dashboard data sources

### Weekly
- Analyze performance trends
- Review and tune alert thresholds
- Update synthetic test scenarios
- Clean up old metric data

### Monthly
- Security audit of monitoring access
- Performance review of monitoring overhead
- Update documentation and runbooks
- Review and optimize metric collection

## 📞 Support & Contact

### Runbook References
- **High Error Rate**: `/docs/runbooks/high-error-rate.md`
- **Database Issues**: `/docs/runbooks/database-problems.md`
- **Performance Degradation**: `/docs/runbooks/performance-issues.md`
- **Alert Fatigue**: `/docs/runbooks/alert-tuning.md`

### Emergency Contacts
- **Platform Team**: `#platform-team` (Slack)
- **On-Call Engineer**: `+1-555-ONCALL`
- **Management Escalation**: `management@pitchey.com`

---

## ✅ Implementation Checklist

- [ ] Run `./scripts/setup-monitoring.sh`
- [ ] Configure environment variables
- [ ] Add monitoring integration to Worker
- [ ] Test all health endpoints
- [ ] Configure alert channels (Slack/Email/PagerDuty)
- [ ] Start synthetic monitoring
- [ ] Import Grafana dashboards
- [ ] Set up log rotation and retention
- [ ] Document custom metrics and alerts
- [ ] Train team on monitoring tools
- [ ] Create incident response procedures
- [ ] Schedule regular monitoring reviews

---

*For questions or issues with this monitoring setup, please refer to the troubleshooting section above or contact the Platform Team.*