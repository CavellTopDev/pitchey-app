# Sentry Error Tracking Documentation

**Project**: Pitchey Platform
**Sentry Organization**: pitchey
**Sentry Project**: node
**Region**: EU (de.sentry.io)
**Last Updated**: 2026-01-15

---

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [Error Categories](#error-categories)
4. [Historical Error Analysis](#historical-error-analysis)
5. [Common Error Patterns](#common-error-patterns)
6. [Error Response Format](#error-response-format)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview

The Pitchey platform uses Sentry for comprehensive error tracking and performance monitoring. The integration uses the official `@sentry/cloudflare` SDK with the `withSentry` wrapper pattern for automatic error capture.

### Key Features

- **Automatic Exception Capture**: All uncaught exceptions are automatically reported
- **Transaction Tracing**: 10% sample rate for performance monitoring
- **Release Tracking**: Automatic versioning via `CF_VERSION_METADATA`
- **Breadcrumb Trail**: Request context preserved for debugging
- **Environment Separation**: Production/staging/development environments

### DSN Configuration

```
https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536
```

---

## Configuration

### Wrangler Configuration (`wrangler.toml`)

```toml
# Required compatibility flags
compatibility_flags = ["nodejs_compat", "nodejs_als"]

# Version metadata for automatic release tracking
[version_metadata]
binding = "CF_VERSION_METADATA"

# Sentry environment variables
[vars]
SENTRY_DSN = "https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536"
SENTRY_ENVIRONMENT = "production"
SENTRY_TRACES_SAMPLE_RATE = "0.1"
```

### Worker Integration

```typescript
import * as Sentry from '@sentry/cloudflare';

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    release: env.CF_VERSION_METADATA?.id,
    environment: env.SENTRY_ENVIRONMENT || 'production',
    tracesSampleRate: parseFloat(env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    beforeSendTransaction: (transaction) => {
      // Filter out health checks
      if (transaction.transaction?.includes('/health')) {
        return null;
      }
      return transaction;
    },
  }),
  workerHandler
);
```

---

## Error Categories

### 1. Validation Errors (400)

Errors from invalid input data.

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "_errors": [],
      "password": {
        "_errors": ["Required"]
      }
    }
  }
}
```

**Common Causes:**
- Missing required fields (email, password)
- Invalid email format
- Invalid UUID format for IDs
- Malformed JSON body

### 2. Authentication Errors (401)

Errors from failed authentication attempts.

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials"
  }
}
```

**Common Causes:**
- Invalid email/password combination
- Expired session token
- Missing authentication cookie
- Invalid Bearer token

### 3. Authorization Errors (403)

Errors from insufficient permissions.

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied to this resource"
  }
}
```

**Common Causes:**
- User accessing another user's resources
- Portal type mismatch (creator accessing investor endpoints)
- NDA not signed for protected content

### 4. Not Found Errors (404)

Errors from non-existent resources.

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Endpoint not found"
  }
}
```

**Common Causes:**
- Invalid pitch ID
- Non-existent user profile
- Deleted resources

### 5. Internal Server Errors (500)

Unexpected server-side errors.

**Example Response:**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": "invalid input syntax for type integer: \"invalid-test-id\""
  },
  "meta": {
    "timestamp": "2026-01-15T20:51:33.627Z",
    "requestId": "6f6e54ef-9576-4d12-92ae-5a7a816421a1"
  }
}
```

**Common Causes:**
- Database query failures
- Invalid type coercion
- Unhandled exceptions
- External service timeouts

---

## Historical Error Analysis

### Release History with Issue Counts

| Release | Date | New Issues | Status |
|---------|------|------------|--------|
| `cfedc916-28a9-41f7-b0d5-49e21a02de8a` | 2026-01-15 | 0 | ✅ Current (withSentry) |
| `database-schema-fix-v1.2` | 2025-12-01 | 0 | ✅ Stable |
| `unified-worker-v1.6-connection-pool-fix` | 2025-11-18 | 25 | ⚠️ Connection issues |
| `unified-worker-v1.4-auth-complete-token-validation-fixed` | 2025-11-17 | 33 | ⚠️ Auth issues |
| `worker-v1.0` | 2025-11-17 | 2 | Initial release |
| `3.4-redis-cache` | 2025-11-14 | 7 | Redis integration |

### Key Observations

1. **v1.4 Auth Issues (33 new issues)**
   - Token validation errors
   - Session management problems
   - Better Auth migration issues

2. **v1.6 Connection Pool Issues (25 new issues)**
   - Database connection exhaustion
   - Neon pooler timeouts
   - Concurrent request failures

3. **Current Release (0 new issues)**
   - `withSentry` wrapper properly configured
   - Automatic error capture working
   - No new regressions

---

## Common Error Patterns

### Pattern 1: Invalid Pitch ID Format

**Error:**
```
invalid input syntax for type integer: "browse"
```

**Cause:** Route matching issue where path segments are parsed as IDs

**Fix:** Ensure specific routes are registered before parameterized routes:
```typescript
// Correct order
this.register('GET', '/api/pitches/browse', this.browsePitches);
this.register('GET', '/api/pitches/:id', this.getPitch);
```

**Status:** ✅ Fixed in current release

### Pattern 2: Database Connection Timeout

**Error:**
```
Connection terminated unexpectedly
```

**Cause:** Neon connection pooler timeout under high load

**Fix:**
- Use Hyperdrive for connection pooling
- Implement connection retry logic
- Set appropriate timeout values

### Pattern 3: JWT Validation Failure

**Error:**
```
invalid signature
```

**Cause:** Mismatched JWT secrets between services

**Fix:**
- Ensure `JWT_SECRET` is consistent across deployments
- Migrate to Better Auth session-based authentication

### Pattern 4: CORS Preflight Failure

**Error:**
```
CORS policy blocked
```

**Cause:** Missing CORS headers on OPTIONS requests

**Fix:**
- Return proper CORS headers for all origins
- Handle OPTIONS method explicitly

---

## Error Response Format

All API errors follow a consistent format:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: string | object;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE';
```

### Request ID Tracking

Every request receives a unique `requestId` that can be used to:
- Correlate frontend errors with backend logs
- Search Sentry for specific incidents
- Debug user-reported issues

---

## Monitoring & Alerts

### Recommended Alert Configuration

1. **Error Spike Alert**
   - Trigger: >10 errors in 5 minutes
   - Action: Slack notification + PagerDuty

2. **New Issue Alert**
   - Trigger: First occurrence of error type
   - Action: Email notification

3. **Performance Degradation**
   - Trigger: P95 latency >2s
   - Action: Dashboard highlight

### Dashboard Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Error Rate | <0.1% | >1% |
| P50 Latency | <200ms | >500ms |
| P95 Latency | <500ms | >2000ms |
| Uptime | 99.9% | <99% |

---

## Troubleshooting Guide

### Issue: Errors Not Appearing in Sentry

1. **Check DSN Configuration**
   ```bash
   wrangler secret list
   # Verify SENTRY_DSN is set
   ```

2. **Verify Compatibility Flags**
   ```toml
   compatibility_flags = ["nodejs_compat", "nodejs_als"]
   ```

3. **Check Network Connectivity**
   - Ensure `de.sentry.io` is reachable from worker
   - Verify no firewall blocks

### Issue: Missing Release Information

1. **Verify Version Metadata Binding**
   ```toml
   [version_metadata]
   binding = "CF_VERSION_METADATA"
   ```

2. **Check Worker Export**
   ```typescript
   release: env.CF_VERSION_METADATA?.id,
   ```

### Issue: High Sample Rate Costs

1. **Reduce Traces Sample Rate**
   ```toml
   SENTRY_TRACES_SAMPLE_RATE = "0.01"  # 1%
   ```

2. **Filter Noisy Transactions**
   ```typescript
   beforeSendTransaction: (transaction) => {
     if (transaction.transaction?.includes('/health')) {
       return null;
     }
     return transaction;
   }
   ```

---

## API Endpoints for Error Logging

### Client-Side Error Reporting

```
POST /api/errors/log
```

**Request Body:**
```json
{
  "message": "Error description",
  "stack": "Error stack trace",
  "level": "error",
  "context": {
    "page": "/browse",
    "action": "fetch_pitches"
  },
  "tags": {
    "portal": "investor",
    "version": "1.0.0"
  },
  "user": {
    "id": "user-123",
    "email": "user@example.com"
  }
}
```

**Note:** This endpoint requires authentication (401 if not authenticated).

### Console Error Capture

```
POST /api/monitoring/console-error
```

For capturing frontend console errors automatically.

---

## Best Practices

1. **Always Include Request IDs**
   - Pass `X-Request-ID` header from frontend
   - Log request IDs in error messages

2. **Use Structured Logging**
   - Include context with all errors
   - Tag errors by component/feature

3. **Set User Context**
   ```typescript
   Sentry.setUser({
     id: userId,
     email: userEmail,
     portal: userType
   });
   ```

4. **Add Breadcrumbs**
   ```typescript
   Sentry.addBreadcrumb({
     message: 'User clicked submit',
     category: 'ui',
     level: 'info'
   });
   ```

5. **Monitor Release Health**
   - Compare error rates between releases
   - Roll back if new release shows regression

---

## Resources

- [Sentry Cloudflare Documentation](https://docs.sentry.io/platforms/javascript/guides/cloudflare/)
- [Pitchey Sentry Dashboard](https://pitchey.sentry.io)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

---

*Document Version: 1.0*
*Last Updated: 2026-01-15*
