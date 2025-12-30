# Pitchey Grafana Cloud Monitoring Setup

This comprehensive monitoring system tracks the performance, cache efficiency, and business metrics of your Pitchey Cloudflare Worker deployment.

## 🎯 Overview

The monitoring system includes:

### 📊 **Dashboards**
- **Worker Performance Overview**: Request rates, response times, error rates, CPU usage
- **Cache Performance**: Hit rates, latency, warming effectiveness, memory usage  
- **Database & Infrastructure**: Connection pools, query performance, Redis metrics
- **Business Metrics**: User engagement, API usage patterns, cost tracking

### 🚨 **Alerts**
- Cache hit rate below 70%
- Error rate above 5%
- Response time P95 above 1000ms
- Database connection pool near limit
- Worker memory usage above 80%
- Service outage detection

### 📈 **Metrics Collection**
- **Cloudflare Analytics API**: Worker performance and zone metrics
- **Custom Worker Metrics**: Application-specific business metrics
- **Log Aggregation**: Structured logs from Cloudflare for detailed analysis

## 🚀 Quick Start

### Prerequisites

1. **Grafana Cloud Account** with Prometheus and Loki access
2. **Cloudflare API Token** with Analytics and Zone permissions
3. **Cloudflare Worker** deployed at: `https://pitchey-api-prod.ndlovucavelle.workers.dev`
4. **Deno Runtime** for metrics collection scripts

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Grafana Cloud Configuration
GRAFANA_URL="https://your-org.grafana.net"
GRAFANA_API_KEY="your-grafana-api-key"
GRAFANA_ORG_ID="1"
GRAFANA_PROMETHEUS_URL="https://prometheus-us-central1.grafana.net"
GRAFANA_LOKI_URL="https://logs-prod-us-central1.grafana.net"
GRAFANA_PUSH_URL="https://prometheus-us-central1.grafana.net/api/prom/push"

# Cloudflare Configuration  
CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
CLOUDFLARE_ZONE_ID="your-zone-id"
CLOUDFLARE_WORKER_NAME="pitchey-production"

# Worker Metrics (Optional)
WORKER_METRICS_TOKEN="your-worker-metrics-token"

# Alert Configuration (Optional)
SLACK_WEBHOOK_URL="your-slack-webhook-url"
ALERT_EMAIL_ADDRESSES="alerts@yourcompany.com"
PAGERDUTY_INTEGRATION_KEY="your-pagerduty-key"

# Collection Settings (Optional)
METRICS_COLLECTION_INTERVAL="5"  # minutes
LOG_RETENTION_DAYS="7"
```

## 📋 Installation Steps

### 1. Deploy Dashboards and Alerts

```bash
# Set environment variables
source .env

# Deploy all dashboards, alerts, and data sources
./monitoring/grafana/scripts/deploy-dashboards.sh
```

### 2. Start Metrics Collection

```bash
# Test configuration first
./monitoring/grafana/scripts/start-metrics-collection.sh test

# Start metrics collection service
./monitoring/grafana/scripts/start-metrics-collection.sh start
```

### 3. Enable Log Aggregation (Optional)

```bash
# Start log aggregation service
deno run --allow-all monitoring/grafana/scripts/cloudflare-log-aggregation.ts --interval=5 &
```

### 4. Integrate Worker Metrics

Add the metrics endpoint to your Cloudflare Worker by importing the metrics collector:

```typescript
// Add to your worker's main file
import { workerMetrics } from './monitoring/grafana/scripts/worker-metrics-endpoint.ts';

// In your request handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    
    try {
      // Your existing request handling...
      const response = await handleRequest(request, env);
      
      // Record metrics
      const responseTime = Date.now() - startTime;
      workerMetrics.recordEndpointMetrics(
        new URL(request.url).pathname,
        responseTime,
        !response.ok
      );
      
      return response;
    } catch (error) {
      // Record error metrics
      workerMetrics.recordBusinessOperation('error', undefined, true);
      throw error;
    }
  }
};

// Add metrics endpoint
if (url.pathname === '/metrics') {
  return new Response(workerMetrics.getPrometheusMetrics(), {
    headers: { 'Content-Type': 'text/plain' }
  });
}
```

## 🔧 Configuration Details

### Current Worker Status
- **Deployment**: https://pitchey-api-prod.ndlovucavelle.workers.dev
- **Version ID**: 3c5d4b31-030c-48b9-be42-9bccd7177da5
- **Cache System**: Advanced cache with management endpoints active
- **Target Cache Hit Rate**: >80%

### Performance Targets
- **Response Time P95**: <1000ms
- **Error Rate**: <5%
- **Cache Hit Rate**: >80% 
- **Database Query P95**: <500ms
- **Worker Memory Usage**: <80%

### Alert Thresholds
- **Critical**: Service outage, error rate >5%
- **Warning**: Cache hit rate <70%, response time >1000ms
- **Info**: Cost spikes >$10/hour

## 📊 Dashboard Access

Once deployed, access your dashboards at:
- **Worker Overview**: `${GRAFANA_URL}/d/pitchey-worker-overview`
- **Cache Performance**: `${GRAFANA_URL}/d/pitchey-cache-performance`  
- **Database Metrics**: `${GRAFANA_URL}/d/pitchey-database-infrastructure`
- **Business Metrics**: `${GRAFANA_URL}/d/pitchey-business-metrics`

## 🔍 Monitoring Validation

### 1. Test Dashboard Access
```bash
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
     "$GRAFANA_URL/api/search?query=pitchey"
```

### 2. Verify Metrics Collection
```bash
# Check metrics collection status
./monitoring/grafana/scripts/start-metrics-collection.sh status

# Test single metrics collection
deno run --allow-all monitoring/grafana/scripts/metrics-collector.ts --once
```

### 3. Test Worker Metrics Endpoint
```bash
curl "https://pitchey-api-prod.ndlovucavelle.workers.dev/metrics"
```

### 4. Validate Alert Configuration
```bash
# Check alert rules
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
     "$GRAFANA_URL/api/ruler/grafana/api/v1/rules"
```

## 🛠 Troubleshooting

### Common Issues

#### 1. **Metrics Not Appearing**
```bash
# Check collection service logs
./monitoring/grafana/scripts/start-metrics-collection.sh status

# Verify environment variables
echo $CLOUDFLARE_API_TOKEN | cut -c1-10  # Should show first 10 chars
echo $GRAFANA_PUSH_URL  # Should show push endpoint
```

#### 2. **Dashboard Import Fails**
```bash
# Check Grafana API connectivity
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
     "$GRAFANA_URL/api/health"

# Verify dashboard JSON format
jq . monitoring/grafana/dashboards/pitchey-worker-overview.json
```

#### 3. **Alerts Not Triggering**
```bash
# Check alert rules status
curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
     "$GRAFANA_URL/api/alertmanager/grafana/api/v2/alerts"

# Test notification channels
curl -X POST "$SLACK_WEBHOOK_URL" \
     -d '{"text":"Test alert from Pitchey monitoring"}'
```

#### 4. **High Memory Usage in Collection**
```bash
# Restart collection service with lower interval
export METRICS_COLLECTION_INTERVAL="10"
./monitoring/grafana/scripts/start-metrics-collection.sh restart
```

### Log Locations
- **Metrics Collection**: `~/.pitchey-metrics-collector.log` (user) or `/var/log/pitchey-metrics-collector.log` (system)
- **Dashboard Deployment**: Check script output for errors
- **Worker Logs**: Available through Cloudflare dashboard

## 📚 Advanced Configuration

### Custom Metrics
Add custom business metrics to your worker:

```typescript
// Record pitch creation
workerMetrics.recordBusinessOperation('pitch_created', userId);

// Record NDA request
workerMetrics.recordBusinessOperation('nda_request', userId);

// Record cache operation
workerMetrics.recordCacheOperation('hit', 25); // 25ms response time
```

### Log Analysis Queries
Use these Loki queries in Grafana for detailed analysis:

```logql
# Error rate by endpoint
rate({service="pitchey-worker"} |= "error" [5m])

# Slow requests
{service="pitchey-worker"} | json | ttfb > 1000

# Top user countries
topk(10, count by (country) ({service="pitchey-worker"}))
```

### Cache Performance Optimization
Monitor cache warming effectiveness:

```promql
# Cache warming success rate
pitchey_cache_warmer_success_rate

# Cache hit rate trend
rate(pitchey_cache_hits_total[5m]) / rate(pitchey_cache_requests_total[5m]) * 100
```

## 🔄 Maintenance

### Daily Tasks
- Monitor alert notifications
- Review performance trends  
- Check cost optimization metrics

### Weekly Tasks
- Review top slow endpoints
- Analyze traffic patterns
- Update alert thresholds if needed

### Monthly Tasks
- Review dashboard effectiveness
- Update monitoring queries
- Optimize collection intervals

## 📞 Support

### Monitoring Runbooks
- **Cache Performance**: https://docs.pitchey.com/runbooks/cache-performance
- **Error Response**: https://docs.pitchey.com/runbooks/error-response  
- **Database Performance**: https://docs.pitchey.com/runbooks/database-performance
- **Service Outage**: https://docs.pitchey.com/runbooks/service-outage

### Contact Information
- **Team**: Platform Team
- **Slack**: #pitchey-alerts
- **Escalation**: PagerDuty integration configured

---

## 🎉 Success Criteria

Your monitoring setup is working correctly when you see:

✅ **Dashboards displaying data within 5-10 minutes of deployment**  
✅ **Cache hit rate consistently above 80%**  
✅ **Response times under 1000ms for P95**  
✅ **Error rates below 5%**  
✅ **Alerts configured and tested**  
✅ **Log aggregation showing request patterns**

**Next Steps**: Monitor the cache warming system effectiveness and track cache hit rate improvements over time. Set up cost optimization alerts if cache performance degrades below 70%.