# Error Tracking Configuration

## Overview
This document outlines the error tracking setup for Pitchey application in production.

## Current Status
- **Backend Errors**: Logged to Deno Deploy console
- **Frontend Errors**: Basic console logging
- **Monitoring**: Health check script created

## Recommended Error Tracking Services

### 1. Sentry (Recommended)
Free tier includes:
- 5K errors/month
- 10K performance units
- 1GB attachments
- 30 day data retention

Setup:
```bash
# Backend (Deno)
import * as Sentry from "https://deno.land/x/sentry/mod.ts";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production",
  tracesSampleRate: 0.1,
});

# Frontend (React)
npm install @sentry/react
```

### 2. LogRocket
- Session replay capability
- Network request logging
- Redux action logging
- Free tier: 1K sessions/month

### 3. Rollbar
- Real-time error alerts
- Deployment tracking
- Free tier: 5K events/month

## Implementation Priority

### Phase 1: Basic Logging (Completed ✅)
- [x] Console logging in place
- [x] Health check monitoring script
- [x] Alert log file created

### Phase 2: Centralized Logging (Next)
- [ ] Implement structured logging
- [ ] Add request IDs for tracing
- [ ] Set up log aggregation

### Phase 3: Error Tracking Service
- [ ] Choose and configure Sentry/Rollbar
- [ ] Add source maps for frontend
- [ ] Configure alert rules

### Phase 4: Advanced Monitoring
- [ ] Add custom metrics
- [ ] Set up performance monitoring
- [ ] Implement distributed tracing

## Current Logs Location

### Production
- **Deno Deploy**: https://dash.deno.com/projects/pitchey-backend-fresh/logs
- **cloudflare-pages**: https://app.cloudflare-pages.com/sites/pitchey/deploys

### Local Monitoring
- Health checks: `monitoring/health-check.log`
- Alerts: `monitoring/alerts.log`

## Error Patterns to Monitor

1. **Authentication Errors**
   - Failed login attempts
   - Token expiration issues
   - Permission denials

2. **Database Errors**
   - Connection timeouts
   - Query failures
   - Transaction rollbacks

3. **API Errors**
   - 5xx server errors
   - Rate limiting
   - CORS issues

4. **Frontend Errors**
   - Component render errors
   - Network request failures
   - JavaScript exceptions

## Alert Configuration

### Critical Alerts (Immediate)
- Server down (5xx errors spike)
- Database connection lost
- Authentication service failure
- Payment processing errors

### Warning Alerts (15 min delay)
- High error rate (>1%)
- Slow response times (>2s)
- Memory usage >80%
- Failed background jobs

### Info Alerts (Daily digest)
- New error types
- Deprecated API usage
- Performance degradation trends

## Monitoring Commands

```bash
# Run health check
./monitoring/health-check.sh

# View recent alerts
tail -f monitoring/alerts.log

# Check error patterns
grep "ERROR" monitoring/health-check.log | tail -20

# Monitor in real-time
watch -n 300 ./monitoring/health-check.sh
```

## Next Steps

1. **Immediate**: Fix the public pitches 401 error detected
2. **This Week**: Set up Sentry free tier
3. **Next Week**: Add custom error boundaries in React
4. **Month 2**: Implement distributed tracing

## Contact for Issues

- **Deno Deploy Support**: support@deno.com
- **cloudflare-pages Support**: https://www.cloudflare-pages.com/support/
- **Database (Neon)**: https://neon.tech/support