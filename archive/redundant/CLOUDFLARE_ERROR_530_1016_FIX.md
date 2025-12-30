# Cloudflare Worker Error 530/1016 Fix Documentation

## Problem Summary
The Cloudflare Worker is returning HTTP 530 with error code 1016 when attempting database queries. This error indicates that the origin server (in this case, the database connection through Hyperdrive) is unreachable.

### Error Details
- **HTTP Status**: 530 (Origin DNS Error)
- **Error Code**: 1016
- **Error Message**: "Server error (HTTP status 530): error code: 1016"
- **Affected Endpoints**: All database-dependent endpoints (`/api/auth/*`, `/api/pitches/*`, etc.)
- **Health Check**: Returns 200 OK (bypasses database check)

## Root Cause Analysis

### 1. **Hyperdrive Connection String Format**
The Hyperdrive pooler requires specific connection string formatting that differs from direct database connections:
- **Direct Connection** (works): `postgresql://user:pass@host.neon.tech/db`
- **Pooler Connection** (required): `postgresql://user:pass@host-pooler.neon.tech:5432/db?sslmode=require`

### 2. **Connection Pooling Issues**
- Hyperdrive expects pooled connections from Neon's pooler endpoint
- The pooler endpoint uses a different hostname suffix (`-pooler`)
- SSL mode must be explicitly set to `require`

### 3. **Worker Configuration Mismatch**
- The Worker is trying to use both `DATABASE_URL` secret and `HYPERDRIVE` binding
- Connection initialization may be happening before bindings are available
- The current implementation doesn't properly handle Hyperdrive's connection string

## Solution Architecture

### Phase 1: Fix Connection String Format
1. Ensure the connection string uses the pooler endpoint
2. Add explicit port number (5432)
3. Include `sslmode=require` parameter
4. Properly encode special characters in password

### Phase 2: Update Worker Connection Logic
1. Prioritize Hyperdrive binding over DATABASE_URL
2. Implement proper connection pooling
3. Add connection retry logic
4. Improve error handling and logging

### Phase 3: Implement Fallback Mechanism
1. Primary: Use Hyperdrive for edge-optimized connections
2. Fallback: Direct DATABASE_URL if Hyperdrive fails
3. Cache successful connections
4. Monitor connection health

## Implementation Plan

### 1. Update Hyperdrive Configuration
```bash
# Correct format for Neon pooler with Hyperdrive
wrangler hyperdrive update 983d4a1818264b5dbdca26bacf167dee \
  --connection-string="postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech:5432/neondb?sslmode=require"
```

### 2. Fix Worker Database Connection
```typescript
// src/db/connection-fix.ts
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export function getDatabase(env: Env) {
  // Configure Neon for Cloudflare Workers
  neonConfig.useSecureWebSocket = true;
  neonConfig.wsProxy = (host) => `wss://${host}/v1/ws`;
  
  // Prioritize Hyperdrive binding
  if (env.HYPERDRIVE?.connectionString) {
    console.log('Using Hyperdrive connection');
    const sql = neon(env.HYPERDRIVE.connectionString);
    return drizzle(sql, { schema });
  }
  
  // Fallback to DATABASE_URL
  if (env.DATABASE_URL) {
    console.log('Using direct DATABASE_URL');
    const sql = neon(env.DATABASE_URL);
    return drizzle(sql, { schema });
  }
  
  throw new Error('No database connection available');
}
```

### 3. Update Worker Request Handler
```typescript
// Fix the main worker file to properly handle database connections
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      // Initialize database with proper error handling
      const db = getDatabase(env);
      
      // Test connection for non-health endpoints
      if (!request.url.includes('/health')) {
        await db.execute(sql`SELECT 1`);
      }
      
      // Continue with request handling...
    } catch (error) {
      console.error('Database connection error:', error);
      
      // Return appropriate error response
      if (error.message.includes('1016')) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Database connection failed',
          error: 'Origin unreachable (1016)'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      throw error;
    }
  }
}
```

## Testing Strategy

### 1. Connection Test Script
```bash
#!/bin/bash
# Test database connectivity through Worker

echo "Testing database connection..."

# Test health (should always work)
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health

# Test auth endpoint (requires database)
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'
```

### 2. Verify Hyperdrive Configuration
```bash
# Check Hyperdrive status
wrangler hyperdrive get 983d4a1818264b5dbdca26bacf167dee

# Test direct connection
PGPASSWORD="npg_YibeIGRuv40J" psql \
  -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner -d neondb -c "SELECT 1;"
```

## Monitoring & Alerts

### Key Metrics to Track
- Database connection success rate
- Response times for database queries
- Error rate for 530/1016 errors
- Hyperdrive cache hit rate

### Alert Conditions
- More than 5% of requests returning 530 error
- Database connection time > 1 second
- Hyperdrive binding unavailable

## Prevention Measures

1. **Use Connection Pooling**: Always use Neon's pooler endpoint for serverless environments
2. **Set Proper Timeouts**: Configure reasonable connection and query timeouts
3. **Implement Health Checks**: Regular database connectivity tests
4. **Monitor Connection String Changes**: Alert on any database credential updates
5. **Test Before Deployment**: Verify database connectivity in staging environment

## Additional Resources
- [Cloudflare Hyperdrive Documentation](https://developers.cloudflare.com/workers/databases/hyperdrive)
- [Neon Pooler Documentation](https://neon.tech/docs/connect/connection-pooling)
- [Cloudflare Worker Error Codes](https://developers.cloudflare.com/workers/observability/errors)

## Summary
The 530/1016 error is caused by incorrect Hyperdrive configuration with the Neon database pooler. The solution involves:
1. Using the correct pooler endpoint format
2. Properly configuring the Worker to use Hyperdrive bindings
3. Implementing proper error handling and fallback mechanisms
4. Testing and monitoring the connection regularly