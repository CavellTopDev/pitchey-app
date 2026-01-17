# Production Logging Architecture

This document describes Pitchey's comprehensive logging system for Cloudflare Workers.

## Overview

The logging architecture provides:

- **Structured JSON logging** for machine-readable logs
- **Request context propagation** (requestId, traceId, spanId)
- **Sensitive data redaction** for security
- **Sentry integration** for error tracking
- **Performance monitoring** with slow query detection
- **Database query logging** with timing metrics

## Components

### 1. Production Logger (`src/lib/production-logger.ts`)

The core logging class with full context support.

```typescript
import { ProductionLogger, createRequestLogger } from './lib/production-logger';

// Create a logger for a request
const logger = createRequestLogger({
  request,
  env: { ENVIRONMENT: 'production', SENTRY_DSN: '...' }
});

// Log messages at different levels
logger.debug('Processing started', { step: 'init' });
logger.info('User authenticated', { userId: '123' });
logger.warn('Rate limit approaching', { current: 90, limit: 100 });
logger.error('Payment failed', error, { orderId: 'ord_123' });
logger.fatal('Database connection lost', error);
```

### 2. Logging Middleware (`src/middleware/logging.ts`)

Request/response logging middleware for the Worker.

```typescript
import { initLogging } from './middleware/logging';

// In your fetch handler
const { logger, endRequest } = initLogging(request, env);

// Process request...
const response = await handleRequest();

// Wrap response with logging (adds trace headers, logs completion)
return endRequest(response);
```

### 3. Logged Database (`src/db/logged-connection.ts`)

Database wrapper with query logging and metrics.

```typescript
import { createLoggedDatabase } from './db/logged-connection';

const db = createLoggedDatabase(env, logger);

// All queries are automatically logged with timing
const users = await db.query('SELECT * FROM users WHERE status = $1', ['active']);
```

## Log Levels

| Level   | Use Case                                          | Sentry |
|---------|---------------------------------------------------|--------|
| `debug` | Development details, query details                | No     |
| `info`  | Normal operations, request completion             | No     |
| `warn`  | Potential issues, slow queries, approaching limits| No     |
| `error` | Failures, exceptions, errors                      | Yes    |
| `fatal` | Critical failures requiring immediate attention   | Yes    |

## Log Format

All logs are output as structured JSON:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "context": {
    "requestId": "req_abc123",
    "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
    "spanId": "00f067aa0ba902b7",
    "service": "pitchey-api",
    "method": "GET",
    "path": "/api/pitches"
  },
  "data": {
    "statusCode": 200,
    "duration": 45
  }
}
```

## Request Context

Every request gets automatic context:

| Field         | Description                              | Source                    |
|---------------|------------------------------------------|---------------------------|
| `requestId`   | Unique request identifier                | Generated or X-Request-ID |
| `traceId`     | W3C Trace Context trace ID               | traceparent header        |
| `spanId`      | Current span ID                          | Generated                 |
| `parentSpanId`| Parent span for distributed tracing      | traceparent header        |
| `method`      | HTTP method                              | Request                   |
| `path`        | Request path                             | Request URL               |
| `ip`          | Client IP address                        | CF-Connecting-IP          |
| `userAgent`   | Browser/client identifier                | User-Agent header         |

## Response Headers

Every response includes trace headers:

```
X-Request-ID: req_abc123
X-Trace-ID: 4bf92f3577b34da6a3ce929d0e0e4736
```

## Sensitive Data Redaction

The following fields are automatically redacted:

- `password`, `token`, `secret`
- `authorization`, `cookie`
- `apiKey`, `api_key`
- `accessToken`, `refreshToken`
- `creditCard`, `ssn`, `cvv`

Example output:
```json
{
  "data": {
    "email": "user@example.com",
    "password": "[REDACTED]",
    "apiKey": "[REDACTED]"
  }
}
```

## Database Query Logging

### Slow Query Detection

Queries exceeding the threshold (default: 1000ms) are logged as warnings:

```json
{
  "level": "warn",
  "message": "Slow database query",
  "data": {
    "query": "SELECT * FROM pitches WHERE...",
    "duration": 1523,
    "threshold": 1000,
    "exceededBy": 523
  }
}
```

### Query Metrics

Access cumulative metrics:

```typescript
const stats = db.getStats();
// {
//   totalQueries: 1250,
//   slowQueries: 12,
//   failedQueries: 3,
//   avgQueryDuration: 45.2,
//   slowQueryRate: 0.0096,
//   errorRate: 0.0024
// }
```

## Sentry Integration

Errors are automatically sent to Sentry with context:

```typescript
// Automatic for error() and fatal() calls
logger.error('Payment processing failed', error, {
  userId: '123',
  orderId: 'ord_456'
});
```

Sentry receives:
- Error with stack trace
- Request context (requestId, traceId)
- Extra data (redacted)
- Tags (service, component)
- Breadcrumbs (recent operations)

## Cloudflare Observability

Enabled in `wrangler.toml`:

```toml
[observability]
enabled = true

[observability.logs]
enabled = true
head_sampling_rate = 1.0
invocation_logs = true
persist = true
```

View logs in Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select your Worker
3. Click "Logs" tab
4. Use filters for requestId or traceId

## Usage Examples

### Basic Request Logging

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { logger, endRequest } = initLogging(request, env);

    try {
      const result = await processRequest(request, logger);
      return endRequest(new Response(JSON.stringify(result)));
    } catch (error) {
      logger.error('Request failed', error);
      return endRequest(new Response('Error', { status: 500 }));
    }
  }
};
```

### With Child Loggers

```typescript
async function processPayment(orderId: string, logger: ProductionLogger) {
  // Create child logger with additional context
  const paymentLogger = logger.child({
    component: 'payment',
    orderId
  });

  paymentLogger.info('Starting payment processing');

  try {
    const result = await chargeCard();
    paymentLogger.info('Payment successful', { transactionId: result.id });
    return result;
  } catch (error) {
    paymentLogger.error('Payment failed', error);
    throw error;
  }
}
```

### With Spans for Tracing

```typescript
const result = await logger.span('fetchUserProfile', async (spanLogger) => {
  spanLogger.info('Fetching profile from database');
  const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [userId]);

  spanLogger.info('Fetching preferences');
  const prefs = await db.queryOne('SELECT * FROM preferences WHERE user_id = $1', [userId]);

  return { user, prefs };
});
```

### Timing Operations

```typescript
const endTimer = logger.startTimer('externalApiCall');

const response = await fetch('https://api.external.com/data');

const duration = endTimer(); // Logs and returns duration
```

### Authentication Events

```typescript
import { logAuthEvent } from './middleware/logging';

// Log successful login
logAuthEvent(logger, 'login', userId, { portal: 'creator', method: 'email' });

// Log failed login attempt
logAuthEvent(logger, 'failed_login', undefined, {
  email: 'user@example.com',
  reason: 'invalid_password',
  attempts: 3
});
```

## Configuration

### Environment Variables

| Variable                  | Description                    | Default      |
|---------------------------|--------------------------------|--------------|
| `ENVIRONMENT`             | Environment name               | production   |
| `SENTRY_DSN`              | Sentry Data Source Name        | -            |
| `LOG_LEVEL`               | Minimum log level              | info         |
| `SLOW_QUERY_THRESHOLD_MS` | Slow query threshold           | 1000         |
| `LOG_ALL_QUERIES`         | Log all database queries       | false        |

### Logger Configuration

```typescript
const logger = new ProductionLogger({
  service: 'pitchey-api',
  environment: 'production',
  minLevel: 'info',           // debug, info, warn, error, fatal
  enableConsole: true,
  enableSentry: true,
  sampleRate: 1.0,            // 1.0 = log everything
  redactPaths: [              // Additional fields to redact
    'customSecret',
    'internalToken'
  ]
});
```

## Best Practices

1. **Always use structured data**: Pass objects, not formatted strings
   ```typescript
   // Good
   logger.info('User created', { userId, email });

   // Bad
   logger.info(`User ${userId} created with email ${email}`);
   ```

2. **Include relevant context**: Add data that helps debugging
   ```typescript
   logger.error('API call failed', error, {
     endpoint: '/users',
     statusCode: response.status,
     requestId: externalRequestId
   });
   ```

3. **Use appropriate log levels**: Don't overuse error/warn
   ```typescript
   // Use debug for development details
   logger.debug('Cache check', { key, hit: false });

   // Use info for normal operations
   logger.info('Order processed', { orderId });

   // Use warn for potential issues
   logger.warn('Retry attempt', { attempt: 2, maxAttempts: 3 });

   // Use error for actual failures
   logger.error('Order failed', error, { orderId });
   ```

4. **Create child loggers for components**:
   ```typescript
   const dbLogger = logger.child({ component: 'database' });
   const authLogger = logger.child({ component: 'auth' });
   ```

5. **Use spans for distributed operations**:
   ```typescript
   await logger.span('processOrder', async (spanLogger) => {
     await spanLogger.span('validateInventory', validateInventory);
     await spanLogger.span('chargePayment', chargePayment);
     await spanLogger.span('fulfillOrder', fulfillOrder);
   });
   ```

## Viewing Logs

### Cloudflare Dashboard

1. Navigate to Workers & Pages > Your Worker > Logs
2. Filter by:
   - Time range
   - Log level
   - Search for requestId or traceId

### Local Development

Logs appear in the terminal as JSON. Use `jq` for formatting:

```bash
wrangler dev 2>&1 | jq -R 'fromjson? // .'
```

### Sentry Dashboard

1. Go to your Sentry project
2. Issues show errors with full context
3. Use requestId or traceId to correlate
4. View breadcrumbs for request timeline

## Troubleshooting

### Logs Not Appearing

1. Check `[observability.logs]` is enabled in wrangler.toml
2. Verify log level isn't filtering messages
3. Check Cloudflare Dashboard's time range

### Missing Context

1. Ensure `initLogging()` is called at request start
2. Pass logger to child functions
3. Use `logger.child()` for component context

### Sentry Not Receiving Errors

1. Verify `SENTRY_DSN` is set correctly
2. Check error level (only error/fatal sent)
3. Verify Sentry project accepts events
