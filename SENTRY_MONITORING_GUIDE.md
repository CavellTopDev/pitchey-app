# Sentry Monitoring Implementation Guide for Pitchey Platform

## Overview
This document outlines the comprehensive Sentry monitoring implementation across all Pitchey portal dashboards (Creator, Investor, Production) and their integration with Cloudflare Workers.

## Current Sentry Configuration

### Backend (Cloudflare Worker)
- **DSN**: `https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536`
- **Environment**: `production`
- **Release**: Automatically versioned on deployment

### Frontend (React)
- **DSN**: Same as backend (shared project)
- **Environment**: Based on build environment (`development` / `production`)

## Portal Dashboard Monitoring Setup

### 1. Creator Portal Dashboard

```typescript
// frontend/src/portals/creator/CreatorDashboard.tsx
import * as Sentry from "@sentry/react";

export const CreatorDashboard = () => {
  // Track dashboard views
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'Creator Dashboard Loaded',
      category: 'navigation',
      level: 'info',
      data: {
        portal: 'creator',
        userId: currentUser?.id,
        timestamp: new Date().toISOString()
      }
    });
  }, []);

  // Error boundary for creator-specific operations
  const handlePitchCreation = async (data) => {
    try {
      const result = await createPitch(data);
      // Track successful operations
      Sentry.captureMessage('Pitch created successfully', 'info');
      return result;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          portal: 'creator',
          operation: 'pitch_creation'
        },
        extra: {
          pitchData: data,
          userId: currentUser?.id
        }
      });
      throw error;
    }
  };
};
```

### 2. Investor Portal Dashboard

```typescript
// frontend/src/portals/investor/InvestorDashboard.tsx
import * as Sentry from "@sentry/react";

export const InvestorDashboard = () => {
  // Monitor investment operations
  const trackInvestmentActivity = (action, data) => {
    Sentry.addBreadcrumb({
      message: `Investment Action: ${action}`,
      category: 'business',
      level: 'info',
      data: {
        portal: 'investor',
        action,
        ...data
      }
    });
  };

  // Track NDA requests
  const requestNDA = async (pitchId) => {
    const transaction = Sentry.startTransaction({
      op: 'nda.request',
      name: 'NDA Request Flow'
    });

    try {
      const result = await api.requestNDA(pitchId);
      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('internal_error');
      Sentry.captureException(error, {
        tags: {
          portal: 'investor',
          operation: 'nda_request'
        }
      });
      throw error;
    } finally {
      transaction.finish();
    }
  };
};
```

### 3. Production Portal Dashboard

```typescript
// frontend/src/portals/production/ProductionDashboard.tsx
import * as Sentry from "@sentry/react";

export const ProductionDashboard = () => {
  // Monitor production pipeline
  const monitorProductionPipeline = () => {
    const span = Sentry.getCurrentHub().getScope()?.getSpan()?.startChild({
      op: 'production.pipeline',
      description: 'Monitor Production Pipeline'
    });

    // Track each stage
    ['pre-production', 'production', 'post-production'].forEach(stage => {
      Sentry.addBreadcrumb({
        message: `Production Stage: ${stage}`,
        category: 'production',
        data: { stage }
      });
    });

    span?.finish();
  };
};
```

## Performance Monitoring

### Key Metrics to Track

```typescript
// frontend/src/utils/sentry-performance.ts

export const trackPortalPerformance = {
  // Page Load Performance
  trackPageLoad: (portal: string) => {
    const transaction = Sentry.startTransaction({
      op: 'pageload',
      name: `${portal} Dashboard Load`,
      tags: {
        portal,
        browser: navigator.userAgent
      }
    });

    // Track key resources
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      transaction.setData('loadTime', perfData.loadEventEnd - perfData.fetchStart);
      transaction.setData('domReady', perfData.domContentLoadedEventEnd - perfData.fetchStart);
      transaction.finish();
    });
  },

  // API Call Performance
  trackAPICall: async (endpoint: string, portal: string) => {
    const span = Sentry.getCurrentHub().getScope()?.getSpan()?.startChild({
      op: 'http.client',
      description: `${endpoint}`
    });

    span?.setTag('portal', portal);
    span?.setTag('endpoint', endpoint);

    try {
      const startTime = performance.now();
      const result = await fetch(endpoint);
      const endTime = performance.now();
      
      span?.setData('responseTime', endTime - startTime);
      span?.setStatus('ok');
      
      return result;
    } catch (error) {
      span?.setStatus('internal_error');
      throw error;
    } finally {
      span?.finish();
    }
  }
};
```

## Error Tracking Configuration

### Global Error Handler

```typescript
// frontend/src/index.tsx
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new BrowserTracing({
      // Set sampling rates
      tracingOrigins: ['localhost', 'pitchey.pages.dev', /^\//],
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      ),
    }),
  ],
  // Performance Monitoring
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Release tracking
  release: import.meta.env.VITE_APP_VERSION,
  
  // User context
  beforeSend(event, hint) {
    // Add user context
    if (window.currentUser) {
      event.user = {
        id: window.currentUser.id,
        email: window.currentUser.email,
        username: window.currentUser.username,
        portal: window.currentUser.userType
      };
    }
    
    // Add portal context
    event.tags = {
      ...event.tags,
      portal: window.location.pathname.split('/')[1] // creator/investor/production
    };
    
    return event;
  }
});
```

## Backend Worker Monitoring

### Cloudflare Worker Integration

```typescript
// src/worker-service-optimized.ts
import { Toucan } from 'toucan-js';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: ctx,
      environment: env.SENTRY_ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE || 'unknown',
      request,
    });

    try {
      // Track request metrics
      sentry.addBreadcrumb({
        message: 'Request received',
        category: 'request',
        data: {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries())
        }
      });

      // Portal-specific tracking
      const pathname = new URL(request.url).pathname;
      const portal = determinePortal(pathname);
      
      sentry.setTag('portal', portal);
      sentry.setTag('endpoint', pathname);
      
      // Process request...
      const response = await handleRequest(request, env);
      
      // Track successful responses
      if (response.ok) {
        sentry.addBreadcrumb({
          message: 'Request successful',
          category: 'response',
          level: 'info',
          data: { status: response.status }
        });
      }
      
      return response;
    } catch (error) {
      // Capture errors with context
      sentry.captureException(error, {
        tags: {
          portal: determinePortal(request.url),
          endpoint: new URL(request.url).pathname
        },
        extra: {
          requestBody: await request.text().catch(() => 'Unable to read body'),
          userId: extractUserId(request)
        }
      });
      
      throw error;
    }
  }
};
```

## Custom Alerts and Dashboards

### Alert Rules

1. **Creator Portal Alerts**
   - Pitch creation failures > 5 in 5 minutes
   - Upload failures > 3 in 10 minutes
   - Dashboard load time > 3 seconds

2. **Investor Portal Alerts**
   - NDA request failures > 3 in 5 minutes
   - Payment processing errors > 1 in 1 hour
   - Investment tracking errors > 5 in 15 minutes

3. **Production Portal Alerts**
   - Project management errors > 5 in 10 minutes
   - Resource allocation failures > 2 in 5 minutes
   - Communication system errors > 3 in 5 minutes

### Dashboard Configuration

```javascript
// Sentry Dashboard Configuration
{
  "dashboards": [
    {
      "name": "Portal Performance Overview",
      "widgets": [
        {
          "type": "line-chart",
          "title": "Portal Response Times",
          "query": "avg(transaction.duration) by:portal"
        },
        {
          "type": "table",
          "title": "Error Rate by Portal",
          "query": "count() by:portal,error.type"
        },
        {
          "type": "big-number",
          "title": "Total Active Users",
          "query": "count_unique(user.id)"
        }
      ]
    },
    {
      "name": "Creator Portal Metrics",
      "widgets": [
        {
          "type": "line-chart",
          "title": "Pitch Creation Success Rate",
          "query": "count() by:outcome where:operation=pitch_creation"
        },
        {
          "type": "table",
          "title": "Most Common Errors",
          "query": "count() by:error.message where:portal=creator"
        }
      ]
    }
  ]
}
```

## Implementation Checklist

- [ ] Install Sentry SDK in frontend
- [ ] Configure environment-specific DSNs
- [ ] Implement error boundaries for each portal
- [ ] Set up performance monitoring
- [ ] Configure user context tracking
- [ ] Create portal-specific dashboards
- [ ] Set up alert rules
- [ ] Implement session replay
- [ ] Configure release tracking
- [ ] Test error reporting pipeline

## Testing Sentry Integration

```bash
# Test error capture
curl -X POST https://pitchey-optimized.cavelltheleaddev.workers.dev/api/test/sentry \
  -H "Content-Type: application/json" \
  -d '{"trigger": "test_error"}'

# Verify in Sentry Dashboard
# https://sentry.io/organizations/pitchey/issues/
```

## Monitoring Best Practices

1. **Use Descriptive Error Messages**: Include context about what operation failed
2. **Add Breadcrumbs**: Track user journey leading to errors
3. **Set User Context**: Always include user information when available
4. **Use Tags Wisely**: portal, operation, endpoint, user_type
5. **Monitor Performance**: Track slow queries and API calls
6. **Regular Reviews**: Weekly error report reviews
7. **Alert Fatigue Prevention**: Fine-tune alert thresholds
8. **Privacy Compliance**: Don't log sensitive user data

## Support and Maintenance

- Review Sentry issues daily
- Update alert rules based on patterns
- Archive resolved issues after 30 days
- Maintain 90-day data retention
- Regular SDK updates