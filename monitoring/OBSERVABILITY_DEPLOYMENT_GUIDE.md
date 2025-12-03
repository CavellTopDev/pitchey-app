# Pitchey Platform Observability & Monitoring Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the complete observability and monitoring solution for the Pitchey platform. The monitoring stack includes:

- **Real-time Monitoring**: Health checks, uptime monitoring, performance metrics
- **Log Aggregation**: Centralized logging with search and retention policies
- **Application Performance Monitoring (APM)**: Distributed tracing and performance analytics
- **Infrastructure Monitoring**: Worker, R2, KV, and Durable Object monitoring
- **Alerting System**: Multi-channel alerts with PagerDuty and Slack integration
- **Security Monitoring**: Rate limiting, threat detection, and anomaly detection
- **Web Vitals Monitoring**: Frontend performance and Core Web Vitals tracking

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Monitoring Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (React)          Backend (Workers)          Services  │
│  ┌─────────────────┐      ┌─────────────────┐      ┌──────────┐ │
│  │ Web Vitals      │────▶ │ Monitoring      │────▶ │ Sentry   │ │
│  │ Performance     │      │ Worker          │      │ PagerDuty│ │
│  │ Error Boundary  │      │                 │      │ Slack    │ │
│  └─────────────────┘      └─────────────────┘      └──────────┘ │
│                                   │                              │
│  ┌─────────────────┐      ┌─────────────────┐      ┌──────────┐ │
│  │ Application     │      │ Log Aggregation │      │ KV Store │ │
│  │ Metrics         │────▶ │ Service         │────▶ │ R2 Storage│ │
│  │ Traces          │      │                 │      │ Analytics│ │
│  └─────────────────┘      └─────────────────┘      └──────────┘ │
│                                   │                              │
│  ┌─────────────────┐      ┌─────────────────┐      ┌──────────┐ │
│  │ Security        │      │ Infrastructure  │      │ Dashboard│ │
│  │ Monitoring      │────▶ │ Monitoring      │────▶ │ Real-time│ │
│  │ Rate Limiting   │      │                 │      │ Reports  │ │
│  └─────────────────┘      └─────────────────┘      └──────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. Cloudflare Configuration

- Active Cloudflare account with Workers Paid plan
- KV namespace for monitoring data storage
- R2 bucket for log archival
- Durable Objects enabled

### 2. External Services

- **Sentry Account**: Error tracking and performance monitoring
- **PagerDuty Account**: Incident management (optional)
- **Slack Workspace**: Alert notifications

### 3. Environment Variables

Required environment variables for monitoring services:

```bash
# Sentry Configuration
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_RELEASE=v1.0.0
ENVIRONMENT=production

# Alerting Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/your-webhook-url
PAGERDUTY_INTEGRATION_KEY=your-integration-key
PAGERDUTY_API_KEY=your-api-key

# Database Configuration (if applicable)
DATABASE_URL=postgresql://user:pass@host:port/db

# Additional Configuration
LOG_LEVEL=info
ENABLE_DEBUG_LOGS=false
```

## Deployment Steps

### Step 1: Deploy Monitoring Workers

#### 1.1 Create Monitoring Worker Configuration

Create `wrangler-monitoring.toml`:

```toml
name = "pitchey-monitoring"
main = "src/monitoring-worker.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "info"

# KV namespace for monitoring data
[[kv_namespaces]]
binding = "KV"
id = "your-monitoring-kv-id"

# R2 bucket for log archival
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "pitchey-monitoring-logs"

# Scheduled tasks for automated monitoring
[triggers]
crons = ["*/1 * * * *", "*/5 * * * *", "*/15 * * * *", "0 * * * *", "0 0 * * *"]
```

#### 1.2 Deploy Workers

```bash
# Deploy monitoring worker
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
wrangler deploy -c wrangler-monitoring.toml

# Deploy log aggregation service
wrangler deploy src/log-aggregation-service.ts --name pitchey-logs

# Deploy APM service
wrangler deploy src/apm-service.ts --name pitchey-apm

# Deploy infrastructure monitoring
wrangler deploy src/infrastructure-monitoring.ts --name pitchey-infra

# Deploy alerting service
wrangler deploy src/alerting-service.ts --name pitchey-alerts

# Deploy security monitoring
wrangler deploy src/security-monitoring-service.ts --name pitchey-security
```

### Step 2: Configure Sentry Integration

#### 2.1 Sentry Project Setup

1. Create a new Sentry project for Pitchey platform
2. Configure environments (development, staging, production)
3. Set up release tracking
4. Configure alert rules

#### 2.2 Update Sentry Configuration

Add to your main worker configuration:

```javascript
// In your main worker file
import { Toucan } from "toucan-js";

const sentry = new Toucan({
  dsn: env.SENTRY_DSN,
  context: {
    waitUntil: (promise) => promise,
    request,
  },
  environment: env.ENVIRONMENT,
  release: env.SENTRY_RELEASE,
  beforeSend(event) {
    // Add monitoring-specific context
    event.tags = {
      ...event.tags,
      service: 'main-platform',
      component: 'api-gateway'
    };
    return event;
  }
});
```

### Step 3: Set Up Web Vitals Monitoring

#### 3.1 Install Frontend Dependencies

```bash
cd frontend
npm install web-vitals
```

#### 3.2 Initialize Web Vitals in Frontend

Add to your main React application:

```typescript
// In your main App.tsx or index.tsx
import { webVitalsMonitor } from './utils/web-vitals-monitor';

// Initialize with user ID if available
const userId = getCurrentUserId(); // Your user identification logic
webVitalsMonitor.initializeMonitoring();

// Set user context when user logs in
webVitalsMonitor.setUserId(userId);
```

### Step 4: Configure Alerting Channels

#### 4.1 Slack Integration

1. Create a Slack app in your workspace
2. Add incoming webhooks capability
3. Generate webhook URL
4. Test webhook connection

```bash
# Test Slack webhook
curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"Test alert from Pitchey monitoring"}' \
    YOUR_SLACK_WEBHOOK_URL
```

#### 4.2 PagerDuty Integration (Optional)

1. Create PagerDuty service
2. Generate integration key
3. Configure escalation policies
4. Test integration

```bash
# Test PagerDuty integration
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "YOUR_INTEGRATION_KEY",
    "event_action": "trigger",
    "payload": {
      "summary": "Test alert from Pitchey monitoring",
      "source": "monitoring-test",
      "severity": "info"
    }
  }'
```

### Step 5: Deploy Monitoring Dashboard

#### 5.1 Configure Dashboard Access

The monitoring dashboard is available at:
- Local: `file:///path/to/monitoring/comprehensive-dashboard.html`
- Production: Deploy to Cloudflare Pages or serve via Worker

#### 5.2 Production Dashboard Deployment

```bash
# Option 1: Deploy via Cloudflare Pages
wrangler pages deploy monitoring/comprehensive-dashboard.html \
  --project-name=pitchey-monitoring-dashboard

# Option 2: Serve via Worker
# Create a worker that serves the dashboard HTML
```

### Step 6: Configure Rate Limiting

#### 6.1 Apply Rate Limiting Middleware

Add to your main API worker:

```typescript
import { SecurityMonitoringService } from './security-monitoring-service';

export default {
  async fetch(request, env) {
    const securityService = new SecurityMonitoringService(sentry, env);
    
    // Check rate limits
    const identifier = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitResult = await securityService.checkRateLimit(
      new URL(request.url).pathname,
      identifier,
      getUserId(request)
    );
    
    if (!rateLimitResult.allowed) {
      return new Response('Rate limit exceeded', { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        }
      });
    }
    
    // Continue with normal request processing
    return handleRequest(request, env);
  }
};
```

## Configuration

### Monitoring Configuration Files

#### monitoring-config.json
```json
{
  "healthChecks": {
    "interval": 60000,
    "timeout": 10000,
    "endpoints": [
      "/api/health",
      "/api/auth/health",
      "/api/pitches/health"
    ]
  },
  "metrics": {
    "collection": {
      "interval": 30000,
      "retention": "7d"
    },
    "aggregation": {
      "windowSize": "5m",
      "functions": ["avg", "p95", "p99", "count"]
    }
  },
  "logging": {
    "level": "info",
    "retention": "30d",
    "structured": true,
    "sampling": {
      "error": 1.0,
      "warn": 1.0,
      "info": 0.1,
      "debug": 0.01
    }
  },
  "alerting": {
    "channels": {
      "slack": {
        "enabled": true,
        "webhook": "env:SLACK_WEBHOOK_URL"
      },
      "pagerduty": {
        "enabled": true,
        "integrationKey": "env:PAGERDUTY_INTEGRATION_KEY"
      },
      "email": {
        "enabled": true,
        "recipients": ["alerts@pitchey.com"]
      }
    },
    "rules": [
      {
        "name": "High Error Rate",
        "condition": "error_rate > 0.05",
        "severity": "warning",
        "channels": ["slack"]
      },
      {
        "name": "Critical Error Rate",
        "condition": "error_rate > 0.1",
        "severity": "critical",
        "channels": ["slack", "pagerduty"]
      },
      {
        "name": "High Response Time",
        "condition": "p95_response_time > 2000",
        "severity": "warning",
        "channels": ["slack"]
      }
    ]
  }
}
```

### Web Vitals Thresholds

Configure Core Web Vitals thresholds:

```typescript
const webVitalsThresholds = {
  cls: { good: 0.1, poor: 0.25 },
  fid: { good: 100, poor: 300 },
  lcp: { good: 2500, poor: 4000 },
  fcp: { good: 1800, poor: 3000 },
  ttfb: { good: 800, poor: 1800 },
  inp: { good: 200, poor: 500 }
};
```

### Security Rules Configuration

```typescript
const securityRules = [
  {
    id: 'rate-limit-auth',
    endpoint: '/api/auth/*',
    limits: [
      { requests: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
      { requests: 20, windowMs: 60 * 60 * 1000 }  // 20 per hour
    ]
  },
  {
    id: 'rate-limit-api',
    endpoint: '/api/*',
    limits: [
      { requests: 100, windowMs: 60 * 1000 },      // 100 per minute
      { requests: 1000, windowMs: 60 * 60 * 1000 } // 1000 per hour
    ]
  }
];
```

## Testing

### 1. Health Check Testing

```bash
# Test monitoring worker health endpoint
curl https://your-monitoring-worker.workers.dev/monitoring/health

# Test infrastructure monitoring
curl https://your-monitoring-worker.workers.dev/infra/health

# Test log aggregation
curl -X POST https://your-logs-worker.workers.dev/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "level": "info",
    "message": "Test log entry",
    "service": "test",
    "timestamp": '$(date +%s000)'
  }'
```

### 2. Performance Testing

```bash
# Test APM endpoints
curl https://your-apm-worker.workers.dev/apm/summary

# Test Web Vitals collection
# (This would be tested through the frontend interface)
```

### 3. Alert Testing

```bash
# Trigger test alert
curl -X POST https://your-alerts-worker.workers.dev/alerts/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "type": "warning",
    "title": "Test Alert",
    "message": "This is a test alert",
    "source": "deployment-test",
    "component": "monitoring"
  }'
```

### 4. Security Testing

```bash
# Test rate limiting
for i in {1..10}; do
  curl -w "%{http_code}\n" https://your-api.workers.dev/api/auth/login
done

# Test security monitoring
curl "https://your-api.workers.dev/api/test?param=<script>alert('xss')</script>"
```

## Monitoring and Maintenance

### Daily Operations

1. **Check Dashboard**: Review monitoring dashboard for anomalies
2. **Alert Review**: Verify alert channels are working
3. **Log Analysis**: Review critical errors and warnings
4. **Performance Review**: Check Web Vitals and response times

### Weekly Operations

1. **Metrics Review**: Analyze weekly trends and patterns
2. **Capacity Planning**: Review infrastructure usage
3. **Alert Tuning**: Adjust thresholds based on patterns
4. **Security Review**: Review security events and threats

### Monthly Operations

1. **Cost Analysis**: Review monitoring costs and optimization opportunities
2. **Retention Policy**: Review and adjust log retention policies
3. **Performance Baseline**: Update performance baselines
4. **Incident Review**: Analyze incidents and improve processes

## Troubleshooting

### Common Issues

#### 1. High Memory Usage in Workers

**Symptoms**: Worker hitting memory limits, poor performance

**Diagnosis**:
```bash
# Check worker memory metrics
curl https://your-monitoring-worker.workers.dev/infra/worker
```

**Resolution**:
- Review log aggregation batch sizes
- Implement more aggressive cleanup
- Consider splitting responsibilities across multiple workers

#### 2. Missing Metrics Data

**Symptoms**: Dashboard showing no data or stale data

**Diagnosis**:
```bash
# Check KV storage
curl https://your-monitoring-worker.workers.dev/monitoring/metrics

# Check scheduled tasks
wrangler tail your-monitoring-worker --format pretty
```

**Resolution**:
- Verify scheduled tasks are running
- Check KV namespace permissions
- Validate metric collection endpoints

#### 3. Alert Delivery Issues

**Symptoms**: No alerts received despite issues

**Diagnosis**:
```bash
# Test alert channels
curl -X POST https://your-alerts-worker.workers.dev/alerts/trigger \
  -H "Content-Type: application/json" \
  -d '{"type": "warning", "title": "Test", "message": "Test alert"}'
```

**Resolution**:
- Verify webhook URLs and API keys
- Check alert rule configurations
- Test external service connectivity

#### 4. Performance Impact

**Symptoms**: Monitoring causing performance degradation

**Diagnosis**:
- Check monitoring worker response times
- Review metric collection frequency
- Analyze network requests overhead

**Resolution**:
- Reduce collection frequency for non-critical metrics
- Implement sampling for high-volume events
- Optimize batch processing

## Security Considerations

### Data Privacy

1. **Sensitive Data**: Ensure no sensitive user data in logs
2. **PII Scrubbing**: Implement automatic PII detection and removal
3. **Access Control**: Restrict monitoring dashboard access
4. **Audit Logging**: Log all monitoring system access

### Infrastructure Security

1. **API Keys**: Rotate keys regularly
2. **Network Security**: Use HTTPS for all monitoring endpoints
3. **Rate Limiting**: Apply rate limits to monitoring endpoints
4. **Monitoring of Monitoring**: Monitor the monitoring system itself

## Performance Optimization

### Resource Usage

1. **KV Optimization**: Use appropriate TTLs and key structures
2. **R2 Optimization**: Implement lifecycle policies for log archival
3. **Worker Optimization**: Minimize CPU time and memory usage
4. **Network Optimization**: Batch requests where possible

### Cost Optimization

1. **Sampling**: Implement intelligent sampling for high-volume data
2. **Retention**: Use appropriate retention policies
3. **Compression**: Compress logs before storage
4. **Alerting**: Avoid alert storms with throttling

## Conclusion

This comprehensive monitoring and observability solution provides enterprise-grade monitoring for the Pitchey platform. The system offers:

- **Complete Coverage**: Frontend to backend monitoring
- **Real-time Insights**: Live dashboards and instant alerts
- **Scalable Architecture**: Built on Cloudflare's edge infrastructure
- **Cost-Effective**: Optimized for efficiency and cost
- **Security-First**: Built-in security monitoring and threat detection

For additional support or questions, refer to the individual service documentation or contact the platform engineering team.

## Additional Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Web Vitals Documentation](https://web.dev/vitals/)
- [PagerDuty API Documentation](https://developer.pagerduty.com/)
- [Slack API Documentation](https://api.slack.com/)

---

**Version**: 1.0.0  
**Last Updated**: December 2, 2025  
**Next Review**: January 2026