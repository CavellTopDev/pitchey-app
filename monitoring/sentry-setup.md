# Sentry Error Tracking Setup

## Overview
Sentry provides real-time error tracking and performance monitoring for production applications.

## Free Tier Benefits
- 5,000 errors/month
- 10,000 performance units
- 1GB attachments
- 30-day data retention
- Unlimited users

## Setup Instructions

### 1. Create Sentry Account
1. Go to https://sentry.io/signup/
2. Sign up with GitHub/Google or email
3. Create organization (e.g., "pitchey")

### 2. Create Projects

#### Backend Project (Deno)
1. Click "Create Project"
2. Select "JavaScript" platform
3. Name it "pitchey-backend"
4. Copy the DSN

#### Frontend Project (React)
1. Click "Create Project"
2. Select "React" platform
3. Name it "pitchey-frontend"
4. Copy the DSN

### 3. Backend Integration

Create `monitoring/sentry-backend.ts`:
```typescript
// Sentry configuration for Deno backend
import * as Sentry from "https://deno.land/x/sentry@7.77.0/index.mjs";

// Initialize Sentry
export function initSentry() {
  const dsn = Deno.env.get("SENTRY_DSN");
  
  if (!dsn) {
    console.log("Sentry DSN not configured, skipping initialization");
    return;
  }

  Sentry.init({
    dsn,
    environment: Deno.env.get("DENO_ENV") || "production",
    tracesSampleRate: 0.1, // 10% of transactions
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.authorization;
      }
      return event;
    },
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
    ],
  });

  console.log("Sentry initialized successfully");
}

// Error handler middleware
export function sentryErrorHandler(error: Error, context?: any) {
  Sentry.captureException(error, {
    extra: context,
    tags: {
      section: 'backend',
    },
  });
}

// Performance monitoring
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}
```

Add to `working-server.ts`:
```typescript
import { initSentry, sentryErrorHandler } from "./monitoring/sentry-backend.ts";

// Initialize Sentry at startup
initSentry();

// Wrap error responses
catch (error) {
  sentryErrorHandler(error, { url: req.url, method: req.method });
  return serverErrorResponse("Internal server error");
}
```

### 4. Frontend Integration

Install Sentry:
```bash
cd frontend
npm install @sentry/react
```

Create `frontend/src/monitoring/sentry.ts`:
```typescript
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.log("Sentry DSN not configured");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      new BrowserTracing(),
      new Sentry.Replay({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      // Filter sensitive data
      if (event.request) {
        delete event.request.cookies;
      }
      return event;
    },
  });
}
```

Add to `frontend/src/main.tsx`:
```typescript
import { initSentry } from './monitoring/sentry';

// Initialize before React
initSentry();

// Wrap App with ErrorBoundary
import { ErrorBoundary } from '@sentry/react';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary fallback={<ErrorFallback />} showDialog>
    <App />
  </ErrorBoundary>
);
```

### 5. Environment Variables

#### Backend (.env.deploy)
```
SENTRY_DSN=https://YOUR_BACKEND_DSN@sentry.io/PROJECT_ID
```

#### Frontend (.env)
```
VITE_SENTRY_DSN=https://YOUR_FRONTEND_DSN@sentry.io/PROJECT_ID
```

### 6. Configure Alerts

1. Go to Settings → Alerts
2. Create alert rules:
   - **High Error Rate**: >10 errors in 5 minutes
   - **New Error Type**: First occurrence
   - **Performance**: P95 response time >2s
   - **Crash Rate**: >1% sessions crashing

### 7. Source Maps (Frontend)

Add to `vite.config.ts`:
```typescript
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    sentryVitePlugin({
      org: "pitchey",
      project: "pitchey-frontend",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  build: {
    sourcemap: true,
  },
});
```

### 8. Testing Integration

#### Backend Test
```typescript
// Add test endpoint
if (url.pathname === "/api/test-sentry" && method === "GET") {
  throw new Error("Test Sentry error tracking");
}
```

#### Frontend Test
```typescript
// Add test button
<button onClick={() => {
  throw new Error("Test Sentry error");
}}>Test Error</button>
```

## Monitoring Dashboard

### Key Metrics to Track
1. **Error Rate**: Errors per minute/hour
2. **Apdex Score**: User satisfaction metric
3. **Crash Free Rate**: % of sessions without crashes
4. **Performance**: P50, P75, P95, P99 latencies
5. **User Impact**: Number of users affected

### Custom Dashboards
1. Go to Dashboards → Create Dashboard
2. Add widgets:
   - Error count by endpoint
   - Response time by route
   - User sessions by browser
   - Geographic distribution

## Best Practices

### 1. Error Filtering
```typescript
// Ignore known non-critical errors
beforeSend(event) {
  // Ignore network errors from ad blockers
  if (event.exception?.values?.[0]?.value?.includes('AdBlock')) {
    return null;
  }
  return event;
}
```

### 2. User Context
```typescript
// Set user context after login
Sentry.setUser({
  id: user.id,
  email: user.email,
  userType: user.userType,
});
```

### 3. Custom Tags
```typescript
// Add custom tags for filtering
Sentry.setTag("feature", "payment");
Sentry.setTag("customer_tier", "premium");
```

### 4. Breadcrumbs
```typescript
// Add custom breadcrumbs
Sentry.addBreadcrumb({
  message: 'User clicked checkout',
  category: 'ui',
  level: 'info',
  data: { amount: 100 },
});
```

## Cost Management

### Stay Within Free Tier
1. **Sampling**: Set `tracesSampleRate: 0.1` (10%)
2. **Filtering**: Filter out non-critical errors
3. **Quotas**: Set up spike protection
4. **Retention**: Use 30-day retention

### Monitor Usage
1. Go to Settings → Usage & Billing
2. Set up alerts at 80% usage
3. Review monthly reports

## Integration with Other Tools

### Slack Integration
1. Go to Settings → Integrations → Slack
2. Connect workspace
3. Configure alert channels

### GitHub Integration
1. Go to Settings → Integrations → GitHub
2. Connect repository
3. Link commits to releases

### Jira Integration
1. Go to Settings → Integrations → Jira
2. Connect account
3. Create issues from errors

## Troubleshooting

### Common Issues

#### DSN Not Working
- Check environment variables
- Verify project exists
- Check network connectivity

#### Source Maps Not Uploading
- Verify auth token
- Check build configuration
- Ensure maps are generated

#### High Usage
- Reduce sample rate
- Filter more errors
- Enable spike protection

## Next Steps

1. **Sign up**: https://sentry.io/signup/
2. **Create projects**: Backend and Frontend
3. **Add DSNs** to environment files
4. **Deploy** with Sentry integration
5. **Test** error tracking
6. **Configure** alerts and dashboards

## Resources

- [Sentry Docs](https://docs.sentry.io/)
- [Deno SDK](https://docs.sentry.io/platforms/javascript/guides/node/)
- [React SDK](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Best Practices](https://docs.sentry.io/product/best-practices/)