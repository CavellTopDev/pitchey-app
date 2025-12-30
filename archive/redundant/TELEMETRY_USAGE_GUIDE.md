# Pitchey Telemetry & Observability Guide

## 🎯 Overview

The Pitchey platform now includes comprehensive telemetry and observability powered by Sentry. This system provides real-time monitoring, error tracking, and performance insights across both frontend and backend systems.

## 🏗️ System Architecture

### Backend Telemetry (`src/utils/telemetry.ts`)
- **Sentry Integration**: Automatic error capture and performance monitoring
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Database Monitoring**: Query performance tracking with slow query alerts
- **Privacy-First**: Automatic filtering of sensitive data (passwords, tokens, emails)

### Frontend Telemetry (`frontend/src/utils/telemetry.ts`)
- **Browser Monitoring**: Page load performance and user interactions
- **Session Replay**: Debug production issues with user session recordings
- **API Tracking**: Automatic monitoring of API call performance
- **Error Boundaries**: React error handling with context capture

## 🚀 Quick Start for Developers

### Backend Usage

```typescript
import { telemetry, withTelemetry, withDatabaseTelemetry } from "./src/utils/telemetry.ts";

// Wrap HTTP handlers with automatic telemetry
const handler = withTelemetry(async (request: Request) => {
  // Your handler logic
  return new Response("Success");
});

// Track database operations
const result = await withDatabaseTelemetry(
  "getUsersByType", 
  () => UserService.findByType("creator")
);

// Manual logging with context
telemetry.logger.info("User action completed", {
  userId: user.id,
  action: "pitch_created",
  duration_ms: 1250
});

// Capture errors with context
telemetry.logger.error("Payment processing failed", error, {
  userId: user.id,
  amount: payment.amount,
  provider: "stripe"
});
```

### Frontend Usage

```typescript
import { useTelemetry, withTelemetry, fetchWithTelemetry } from "./utils/telemetry";

// React Hook for telemetry
function MyComponent() {
  const { trackUserAction, captureException } = useTelemetry();
  
  const handleClick = () => {
    trackUserAction("button_click", { buttonId: "create-pitch" });
  };
  
  try {
    // Your component logic
  } catch (error) {
    captureException(error, { component: "MyComponent" });
  }
}

// Wrap components with error boundaries
const SafeComponent = withTelemetry(MyComponent);

// Automatic API call tracking
const response = await fetchWithTelemetry("/api/pitches", {
  method: "POST",
  body: JSON.stringify(pitchData)
});
```

## 📊 Key Metrics & Alerts

### Performance Budgets

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Page Load Time | 2s | 3s | 5s |
| API Response (P95) | 500ms | 1s | 2s |
| Database Queries | 100ms | 500ms | 1s |
| Time to Interactive | 3s | 5s | 8s |

### Alert Rules

- **High Error Rate**: >5% errors in 5 minutes
- **API Performance**: P95 response time >2 seconds
- **Database Issues**: Query duration >1 second
- **Critical Errors**: Any fatal system errors
- **Auth Failures**: >10% authentication failures
- **WebSocket Issues**: >15% connection failures

## 🏷️ Custom Tags & Context

### Automatic Tags
- `user_type`: creator, investor, production
- `portal`: dashboard, browse, pitch_detail
- `feature`: auth, pitch_mgmt, nda, messaging, investment
- `environment`: production, development
- `deployment_env`: production, staging

### Adding Custom Context

```typescript
// Backend - Set user context
telemetry.setUser({
  id: user.id,
  email: user.email,
  userType: user.type
});

// Add custom tags
telemetry.setTag("feature", "pitch_creation");
telemetry.setTag("experiment", "new_ui_v2");

// Frontend - Track user actions
trackUserAction("pitch_created", {
  genre: "sci-fi",
  duration_minutes: 15,
  hasMedia: true
});
```

## 🔍 Debugging Production Issues

### Finding Errors

**Sentry Search Queries:**
- Authentication: `event.type:error AND message:"auth*"`
- Database: `event.type:error AND message:"database*" OR message:"sql*"`
- API Timeouts: `event.type:error AND message:"timeout*"`
- WebSocket: `event.type:error AND message:"websocket*"`
- Payments: `event.type:error AND message:"payment*" OR message:"stripe*"`

### Using Session Replay

1. Navigate to Sentry Issues
2. Find error with "Session Replay" badge
3. Click replay to see user's exact experience
4. Review network requests, console logs, and user interactions

### Performance Analysis

1. **Sentry Performance Tab**: View transaction traces
2. **Database Queries**: Check slow query alerts
3. **API Endpoints**: Review P95 response times
4. **Frontend Vitals**: Monitor Core Web Vitals

## 🔧 Local Development

### Environment Setup

```bash
# Backend
export SENTRY_DSN="your-backend-dsn"
export DENO_ENV="development"

# Frontend  
export VITE_SENTRY_DSN="your-frontend-dsn"
export VITE_NODE_ENV="development"
```

### Testing Telemetry

```bash
# Run health checks
deno run --allow-net health-check.ts

# Test error scenarios
deno run --allow-net test-telemetry-scenarios.ts

# Check local telemetry
SENTRY_DSN="your-dsn" deno run --allow-net debug-sentry.ts
```

## 📈 Dashboard Configuration

### Key Widgets

1. **Error Rate Trends** (24h timeframe)
   - Breakdown by endpoint, user type, environment
   
2. **API Response Times** (4h timeframe) 
   - P50, P95, P99 percentiles
   
3. **Active Users by Portal** (1h timeframe)
   - Creator, Investor, Production portals
   
4. **Database Performance** (4h timeframe)
   - Query duration, connections, slow queries
   
5. **Feature Adoption** (7d timeframe)
   - Pitch creation, NDA requests, investments, messaging

### Custom Dashboards

Create focused dashboards for:
- **Engineering Team**: Errors, performance, deployments
- **Product Team**: User behavior, feature usage, conversions  
- **Business Team**: User activity, revenue events, growth metrics

## 🚨 Incident Response

### Alert Escalation

1. **Low/Medium**: Email notification
2. **High**: Email + Slack notification
3. **Critical**: Email + Slack + PagerDuty

### Response Playbook

1. **Acknowledge** the alert in Sentry
2. **Assess** impact using dashboard metrics
3. **Investigate** using error details and session replay
4. **Fix** the issue and deploy
5. **Monitor** recovery and close the incident
6. **Document** findings and prevention measures

## 🔐 Security & Privacy

### Data Protection

- **Automatic PII Filtering**: Removes emails, passwords, tokens
- **Request Sanitization**: Filters sensitive headers and form data
- **User Context**: Only stores user ID and type, not personal data
- **IP Anonymization**: User IP addresses are not logged

### Compliance

- All telemetry follows GDPR data protection requirements
- User consent for session replay (when enabled)
- Data retention follows Sentry's data retention policies
- No sensitive business data is transmitted to Sentry

## 🔄 Maintenance & Updates

### Weekly Review Tasks

- [ ] Review error trends and patterns
- [ ] Check performance budget compliance  
- [ ] Analyze user experience metrics
- [ ] Review security-related alerts
- [ ] Update alert thresholds based on traffic patterns

### Monthly Tasks

- [ ] Review and update alert rules
- [ ] Analyze feature adoption metrics
- [ ] Update performance budgets
- [ ] Review team notification settings
- [ ] Update dashboard widgets

### Quarterly Tasks

- [ ] Review telemetry data retention policies
- [ ] Update team access and permissions
- [ ] Review and update monitoring documentation
- [ ] Conduct incident response training

## 🆘 Getting Help

### Sentry Resources

- **Documentation**: https://docs.sentry.io/
- **Support**: https://sentry.io/support/
- **Status Page**: https://status.sentry.io/

### Team Contacts

- **DevOps Lead**: Primary contact for infrastructure alerts
- **Engineering Manager**: Escalation for critical production issues
- **Product Manager**: Feature usage and business metric questions

### Internal Resources

- **Runbooks**: Located in `/monitoring/runbooks/`
- **Deployment Guides**: See `CLOUDFLARE_DEPLOYMENT_GUIDE.md`
- **Architecture Docs**: See `DEPLOYMENT_ARCHITECTURE.md`

---

## 📋 Quick Reference

### Health Check Endpoints

- **Backend**: https://pitchey-backend-fresh.deno.dev/api/health
- **Frontend**: https://pitchey-5o8.pages.dev
- **Worker API**: https://pitchey-api-prod.ndlovucavelle.workers.dev/health

### Key Commands

```bash
# Health monitoring
deno run --allow-net health-check.ts

# Error testing  
deno run --allow-net test-telemetry-scenarios.ts

# Local development
PORT=8001 deno run --allow-all working-server.ts

# Frontend development
cd frontend && npm run dev
```

### Sentry Projects

- **Backend**: pitchey-backend (Node.js/Deno)
- **Frontend**: pitchey-frontend (React/Vite)
- **Organization**: Your Sentry organization

---

*This guide is maintained by the Engineering Team. Last updated: November 2025*