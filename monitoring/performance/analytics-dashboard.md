# Cloudflare Analytics Dashboard Setup

## Key Metrics to Monitor

### 1. Worker Analytics
- **Requests per second**: Monitor traffic patterns
- **CPU time**: Track compute usage
- **Duration**: Response time distribution
- **Subrequests**: Database and cache calls

### 2. Cache Performance
- **Cache hit ratio**: Should be >80% for frequently accessed data
- **Cache misses**: Identify patterns for optimization
- **KV operations**: Read/write patterns

### 3. Error Tracking
- **Error rate**: Should be <1%
- **Error types**: Identify common failures
- **Status codes**: Monitor 4xx and 5xx responses

## Setting Up Custom Analytics

1. **Enable Logpush** (Enterprise only):
```bash
wrangler logpush create \
  --dataset workers \
  --destination "s3://your-bucket/logs" \
  --fields "timestamp,outcome,scriptName,duration"
```

2. **Use Workers Analytics Engine**:
```javascript
// In your worker
env.ANALYTICS.writeDataPoint({
  blobs: ['cache-hit', request.url],
  doubles: [responseTime],
  indexes: ['endpoint']
});
```

3. **Create Custom Dashboards**:
- Use Cloudflare Dashboard → Analytics → Workers
- Filter by worker name: `pitchey-production`
- Create saved views for common queries

## Alert Configuration

### Set up alerts for:
1. **High error rate**: >5% errors
2. **Slow responses**: p99 latency >1s
3. **Cache degradation**: Hit rate <70%
4. **Rate limiting**: Too many 429 responses

### Webhook Integration:
```bash
curl -X POST https://api.cloudflare.com/client/v4/accounts/{account_id}/alerting/policies \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Worker Performance Alert",
    "alert_type": "workers_performance",
    "filters": {
      "services": ["pitchey-production"]
    },
    "conditions": {
      "cpu_time": ">100ms",
      "error_rate": ">0.05"
    }
  }'
```
