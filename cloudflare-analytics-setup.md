# Cloudflare Analytics Dashboard Setup

## 1. Worker Analytics
- Go to: https://dash.cloudflare.com/
- Navigate to Workers & Pages > Analytics
- Create custom dashboard with:
  - Request rate
  - Error rate
  - Response time percentiles
  - CPU time
  - Exceptions

## 2. Alert Policies
Set up alerts for:
- Error rate > 5%
- Response time P95 > 1000ms
- CPU time > 50ms
- Exceptions > 10/minute

## 3. Custom Metrics to Track
- Connection pool size
- Database query duration
- Cache hit rate
- Concurrent connections

## 4. Recommended Dashboards

### Performance Dashboard
- Requests per second
- Response time histogram
- Error rate over time
- Top endpoints by latency

### Health Dashboard
- Uptime percentage
- Failed requests by endpoint
- Connection pool utilization
- Database connection failures

### Business Metrics
- API calls by endpoint
- User activity patterns
- Peak usage times
- Geographic distribution
