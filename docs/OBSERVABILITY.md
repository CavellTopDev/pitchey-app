# Full Observability Stack

This document describes Pitchey's complete observability architecture for production monitoring.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY STACK                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   Sentry     │    │    Axiom     │    │  Cloudflare  │              │
│  │   Errors     │    │    Logs      │    │  Analytics   │              │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │
│         │                   │                   │                       │
│         └───────────────────┼───────────────────┘                       │
│                             │                                           │
│                    ┌────────┴────────┐                                  │
│                    │  Observability  │                                  │
│                    │     Client      │                                  │
│                    └────────┬────────┘                                  │
│                             │                                           │
│         ┌───────────────────┼───────────────────┐                       │
│         │                   │                   │                       │
│  ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐                │
│  │   Worker    │    │  Database   │    │   Auth      │                │
│  │   Handler   │    │   Queries   │    │   Events    │                │
│  └─────────────┘    └─────────────┘    └─────────────┘                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Sentry (Error Tracking)

**Purpose**: Real-time error tracking and crash reporting

**What it captures**:
- Exceptions with stack traces
- Fatal errors
- Performance transactions
- User context

**Configuration**: Already configured in `wrangler.toml`:
```toml
SENTRY_DSN = "https://..."
SENTRY_ENVIRONMENT = "production"
SENTRY_TRACES_SAMPLE_RATE = "0.1"
```

**Dashboard**: https://sentry.io

### 2. Axiom (Log Aggregation)

**Purpose**: Centralized log storage, search, and analysis

**What it captures**:
- All structured logs
- Request/response logs
- Database query logs
- Auth events

**Setup**:
1. Create account at https://axiom.co (free tier: 500GB/month)
2. Create dataset named `pitchey-logs`
3. Generate API token
4. Set secret: `wrangler secret put AXIOM_TOKEN`

**Configuration** in `wrangler.toml`:
```toml
AXIOM_DATASET = "pitchey-logs"
```

**Query Examples** (APL - Axiom Processing Language):
```apl
// Errors in last hour
['pitchey-logs']
| where level == "error"
| where _time > ago(1h)
| order by _time desc

// Slow requests
['pitchey-logs']
| where duration > 1000
| summarize count() by bin(_time, 5m), path

// Auth failures by IP
['pitchey-logs']
| where authEvent == "login_failed"
| summarize attempts = count() by ip
| where attempts > 3
| order by attempts desc
```

### 3. Cloudflare Analytics Engine (Metrics)

**Purpose**: High-cardinality metrics at edge

**What it captures**:
- Request counts and latency
- Error rates
- Database query performance
- Cache hit/miss rates

**Bindings** in `wrangler.toml`:
```toml
[[analytics_engine_datasets]]
binding = "METRICS"
dataset = "pitchey_metrics"

[[analytics_engine_datasets]]
binding = "ERROR_TRACKING"
dataset = "pitchey_errors"
```

**Query via GraphQL**:
```graphql
query {
  viewer {
    accounts(filter: {accountTag: "your-account-id"}) {
      pitchey_metrics(
        filter: { datetime_gt: "2024-01-01T00:00:00Z" }
        limit: 100
      ) {
        dimensions {
          metric
        }
        sum {
          value
        }
      }
    }
  }
}
```

### 4. Cloudflare Dashboard Logs

**Purpose**: Real-time log streaming

**Access**:
1. Workers & Pages → Your Worker → Logs
2. Filter by time, level, or search terms
3. Use request ID to trace specific requests

**Configuration** in `wrangler.toml`:
```toml
[observability]
enabled = true

[observability.logs]
enabled = true
head_sampling_rate = 1.0
invocation_logs = true
persist = true
```

## Integration with Better Auth

The observability stack integrates with Better Auth through hooks:

```typescript
import { createAuthHooks } from './lib/auth-observability';
import { createObservability } from './lib/observability';

// In your auth config
const obs = createObservability(env);

const auth = betterAuth({
  // ... your config
  hooks: createAuthHooks(obs),
});
```

### Tracked Auth Events

| Event | Level | Description |
|-------|-------|-------------|
| `login_success` | info | Successful authentication |
| `login_failed` | error | Failed login attempt |
| `logout` | info | User signed out |
| `signup` | info | New account created |
| `session_created` | info | New session started |
| `session_expired` | warn | Session timed out |
| `password_reset_requested` | warn | Password reset initiated |
| `two_factor_enabled` | info | 2FA activated |
| `account_locked` | error | Too many failed attempts |
| `suspicious_activity` | error | Security alert triggered |

### Security Features

**Brute Force Protection**:
- Tracks failed login attempts per email and IP
- Locks account after 5 failures in 15 minutes
- Alerts on credential stuffing attacks

**Automatic Alerts** sent to Sentry for:
- Brute force attacks (5+ failures)
- Credential stuffing (10+ failures from same IP)
- Impossible travel (login from distant locations)

## Usage Examples

### Basic Request Logging

```typescript
import { createObservability, observabilityMiddleware } from './lib/observability';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { handle } = observabilityMiddleware(env);

    return handle(request, async (obs) => {
      obs.info('Processing request');

      // Your handler logic
      const result = await processRequest(request);

      return new Response(JSON.stringify(result));
    });
  }
};
```

### Database Query Logging

```typescript
const obs = createObservability(env);
const startTime = Date.now();

try {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const duration = Date.now() - startTime;

  obs.recordQuery('SELECT', 'users', duration, result.length, true);

  return result;
} catch (error) {
  const duration = Date.now() - startTime;
  obs.recordQuery('SELECT', 'users', duration, 0, false);
  obs.error('Database query failed', error);
  throw error;
}
```

### Auth Event Logging

```typescript
import { createAuthObservability } from './lib/auth-observability';

const authObs = createAuthObservability(obs);

// On successful login
await authObs.loginSuccess({
  userId: user.id,
  email: user.email,
  portal: 'creator',
  method: 'email',
  ip: request.headers.get('cf-connecting-ip'),
});

// On failed login
await authObs.loginFailed({
  email: credentials.email,
  ip: request.headers.get('cf-connecting-ip'),
  reason: 'Invalid password',
});
```

### Custom Metrics

```typescript
const metrics = obs.getMetrics();

// Counter
metrics.counter('api.requests', 1, { endpoint: '/pitches' });

// Gauge
metrics.gauge('queue.depth', 42, { queue: 'email' });

// Histogram (for durations)
metrics.histogram('api.latency', 156, { endpoint: '/pitches' });
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `SENTRY_DSN` | Yes | Sentry Data Source Name | - |
| `SENTRY_ENVIRONMENT` | No | Environment tag | production |
| `AXIOM_TOKEN` | No* | Axiom API token | - |
| `AXIOM_DATASET` | No | Axiom dataset name | pitchey-logs |
| `LOG_LEVEL` | No | Minimum log level | info |
| `SLOW_QUERY_THRESHOLD_MS` | No | Slow query threshold | 1000 |

*Axiom is optional but recommended for full observability

## Setting Up Axiom

1. **Create Account**:
   - Go to https://axiom.co
   - Sign up (free tier: 500GB/month ingest)

2. **Create Dataset**:
   - Navigate to Datasets
   - Click "New Dataset"
   - Name: `pitchey-logs`

3. **Generate API Token**:
   - Go to Settings → API Tokens
   - Create token with ingest permissions
   - Copy the token

4. **Configure Worker**:
   ```bash
   wrangler secret put AXIOM_TOKEN
   # Paste your token when prompted
   ```

5. **Verify**:
   - Deploy your worker
   - Make some requests
   - Check Axiom dashboard for incoming logs

## Alerting

### Sentry Alerts

Configure in Sentry dashboard:
- Error rate > 5% in 5 minutes
- New error types
- Performance degradation

### Axiom Alerts

Create monitors for:
```apl
// High error rate
['pitchey-logs']
| where level == "error"
| where _time > ago(5m)
| summarize errors = count()
| where errors > 10

// Slow responses
['pitchey-logs']
| where duration > 5000
| where _time > ago(5m)
| summarize slow_requests = count()
| where slow_requests > 5

// Failed logins spike
['pitchey-logs']
| where authEvent == "login_failed"
| where _time > ago(15m)
| summarize failures = count()
| where failures > 20
```

## Dashboard Recommendations

### Grafana Cloud (Optional)

Connect Axiom as data source:
1. Add Axiom plugin
2. Configure with API token
3. Create dashboards

**Suggested Panels**:
- Request rate (requests/min)
- Error rate (%)
- P95 latency
- Active users
- Failed logins
- Slow queries

### Cloudflare Dashboard

Built-in metrics available:
- Workers Analytics (requests, CPU time)
- KV Analytics (reads, writes)
- R2 Analytics (storage, operations)

## Troubleshooting

### Logs Not Appearing in Axiom

1. Verify `AXIOM_TOKEN` is set: `wrangler secret list`
2. Check token has ingest permissions
3. Verify dataset name matches
4. Check Axiom status page

### Missing Metrics

1. Ensure Analytics Engine bindings exist
2. Check binding names match code
3. Metrics may take 1-2 minutes to appear

### Sentry Not Receiving Errors

1. Verify `SENTRY_DSN` is correct
2. Check error level (only error/fatal sent)
3. Verify Sentry project quota

## Best Practices

1. **Use structured logging**: Always pass objects, not formatted strings
2. **Include context**: Add requestId, userId, traceId to all logs
3. **Set appropriate levels**: Don't over-use error/warn
4. **Redact sensitive data**: Never log passwords, tokens, PII
5. **Monitor costs**: Watch Axiom ingestion, Sentry event quotas
6. **Set up alerts**: Don't just collect data—act on it
