# JWT Migration Strategy for Pitchey Platform

## Current Situation
- **Better Auth** is too heavy for Cloudflare Workers (causing Error 1102: Resource limits)
- You have a custom JWT implementation but need something more robust
- Platform has 3 user types: Creator, Investor, Production

## Recommended Lightweight JWT Libraries

### Option 1: @tsndr/cloudflare-worker-jwt ⭐ RECOMMENDED
**Best fit for your stack**
```bash
npm install @tsndr/cloudflare-worker-jwt
```

**Pros:**
- Specifically designed for Cloudflare Workers
- Only 4KB gzipped
- Built-in support for Web Crypto API
- Simple API, drop-in replacement
- Well-maintained, popular in CF community

**Implementation:**
```typescript
import jwt from '@tsndr/cloudflare-worker-jwt'

// Sign a token
const token = await jwt.sign({
  sub: userId,
  email: user.email,
  userType: 'creator', // or 'investor', 'production'
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
}, env.JWT_SECRET)

// Verify a token
const isValid = await jwt.verify(token, env.JWT_SECRET)
const { payload } = jwt.decode(token)
```

### Option 2: jose (Cloudflare Workers compatible subset)
```bash
npm install jose
```

**Pros:**
- More features (JWK, JWE, etc.)
- Standards compliant
- Good for complex auth scenarios

**Cons:**
- Larger bundle size (20KB)
- May still hit limits with all features

### Option 3: Keep Your Custom Implementation + Enhancements
Your current implementation works but needs:
- Token refresh mechanism
- Better error handling
- Session storage optimization

## Architecture Decision: Single vs Multiple Workers

### Recommended: Hybrid Approach ⭐

**Use a lightweight single worker with service bindings pattern:**

```typescript
// src/worker-service-auth-lite.ts
import jwt from '@tsndr/cloudflare-worker-jwt'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health checks first (no auth needed)
    if (path === '/api/health') {
      return new Response(JSON.stringify({ status: 'healthy' }));
    }

    // Authentication endpoints (lightweight)
    if (path.startsWith('/api/auth/')) {
      return handleAuth(request, env);
    }

    // Protected endpoints - verify JWT then proxy
    const token = getTokenFromRequest(request);
    if (token) {
      const isValid = await jwt.verify(token, env.JWT_SECRET);
      if (!isValid) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Proxy to backend or handle locally
    if (shouldHandleLocally(path)) {
      return handleLocalEndpoint(request, env);
    }

    // Proxy complex operations to Deno Deploy backend
    return proxyToBackend(request, env);
  }
}
```

### Why NOT Multiple Workers?

**Cons of splitting:**
- Increased complexity
- More deployment targets to manage
- Inter-worker communication overhead
- Higher costs (each worker = separate billing)
- Harder debugging

**Only split if you need:**
- Different rate limits per service
- Independent scaling
- Separate deployment cycles
- Team boundaries

## Migration Plan

### Phase 1: Replace Better Auth (Immediate)
1. Remove Better Auth completely
2. Install @tsndr/cloudflare-worker-jwt
3. Implement basic auth endpoints:
   ```typescript
   // Lightweight auth handler
   async function handleAuth(request: Request, env: Env) {
     const url = new URL(request.url);
     const path = url.pathname;
     
     if (path === '/api/auth/creator/login') {
       const body = await request.json();
       // Direct database query via Hyperdrive
       const user = await verifyUserCredentials(body, env.DB);
       if (user && user.userType === 'creator') {
         const token = await jwt.sign({
           sub: user.id,
           email: user.email,
           userType: 'creator',
           exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
         }, env.JWT_SECRET);
         
         return new Response(JSON.stringify({
           success: true,
           data: { token, user }
         }));
       }
     }
     // Similar for investor/production login
   }
   ```

### Phase 2: Optimize Database Access
Use Hyperdrive for connection pooling:
```typescript
// Direct PostgreSQL via Hyperdrive (no ORM in worker)
const db = env.DB; // Hyperdrive binding
const result = await db.prepare(
  'SELECT * FROM users WHERE email = ?1 AND user_type = ?2'
).bind(email, userType).first();
```

### Phase 3: Implement Missing Features
Add these lightweight implementations:
1. **Password Reset**
   - Store reset tokens in KV with TTL
   - Send email via Cloudflare Email Workers

2. **Session Management**
   - Use KV for session storage
   - Implement refresh tokens

3. **Email Verification**
   - Generate verification codes
   - Store in KV with expiry

## Database Connection Strategy

### Use Hyperdrive Direct Queries (No ORM in Worker)
```typescript
// wrangler.toml
[[hyperdrive]]
binding = "DB"
id = "your-hyperdrive-id"

// In worker
const user = await env.DB.prepare(
  'SELECT id, email, password_hash, user_type FROM users WHERE email = ?'
).bind(email).first();
```

### Why Direct Queries?
- Drizzle ORM is too heavy for workers
- Direct queries are faster
- Better control over query complexity
- Predictable resource usage

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Cloudflare Edge                        │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │         Optimized Worker (Single)               │     │
│  │                                                 │     │
│  │  - @tsndr/cloudflare-worker-jwt (4KB)         │     │
│  │  - Direct Hyperdrive queries (no ORM)         │     │
│  │  - KV for sessions/cache                      │     │
│  │  - Handles auth + simple endpoints            │     │
│  │  - Proxies complex ops to Deno Deploy         │     │
│  └────────────────────────────────────────────────┘     │
│                         │                                │
│                         ↓                                │
│  ┌────────────────────────────────────────────────┐     │
│  │          Deno Deploy Backend                    │     │
│  │                                                 │     │
│  │  - Complex business logic                      │     │
│  │  - Drizzle ORM                                │     │
│  │  - WebSocket handling                         │     │
│  │  - File uploads                               │     │
│  │  - Email sending                              │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Implementation Example

```typescript
// src/worker-jwt-auth.ts
import jwt from '@tsndr/cloudflare-worker-jwt'
import bcrypt from 'bcryptjs'

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check (no auth)
      if (path === '/api/health') {
        return jsonResponse({ status: 'healthy' }, corsHeaders);
      }

      // Authentication endpoints
      if (path === '/api/auth/creator/login') {
        return handleLogin(request, env, 'creator', corsHeaders);
      }
      if (path === '/api/auth/investor/login') {
        return handleLogin(request, env, 'investor', corsHeaders);
      }
      if (path === '/api/auth/production/login') {
        return handleLogin(request, env, 'production', corsHeaders);
      }

      // Verify JWT for protected routes
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const isValid = await jwt.verify(token, env.JWT_SECRET);
        
        if (!isValid) {
          return new Response('Unauthorized', { 
            status: 401, 
            headers: corsHeaders 
          });
        }

        // Add user context to request
        const { payload } = jwt.decode(token);
        request.headers.set('X-User-Id', payload.sub);
        request.headers.set('X-User-Type', payload.userType);
      }

      // Simple endpoints handled locally
      if (path === '/api/pitches/public') {
        return handlePublicPitches(env, corsHeaders);
      }

      // Proxy complex operations to Deno backend
      const backendUrl = new URL(path, env.BACKEND_URL);
      return fetch(backendUrl, request);

    } catch (error) {
      return jsonResponse({ 
        success: false, 
        error: error.message 
      }, corsHeaders, 500);
    }
  }
}

async function handleLogin(
  request: Request, 
  env: Env, 
  userType: string,
  headers: HeadersInit
): Promise<Response> {
  const { email, password } = await request.json();

  // Direct database query via Hyperdrive
  const user = await env.DB.prepare(`
    SELECT id, email, password_hash, first_name, last_name, company_name
    FROM users 
    WHERE email = ?1 AND user_type = ?2
  `).bind(email, userType).first();

  if (!user) {
    return jsonResponse({ 
      success: false, 
      message: 'Invalid credentials' 
    }, headers, 401);
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return jsonResponse({ 
      success: false, 
      message: 'Invalid credentials' 
    }, headers, 401);
  }

  // Create JWT
  const token = await jwt.sign({
    sub: user.id,
    email: user.email,
    userType,
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  }, env.JWT_SECRET);

  // Store session in KV
  await env.KV.put(
    `session:${user.id}`,
    JSON.stringify({ userId: user.id, userType }),
    { expirationTtl: 604800 } // 7 days
  );

  return jsonResponse({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company_name,
        userType
      }
    }
  }, headers);
}

function jsonResponse(
  data: any, 
  headers: HeadersInit, 
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    }
  });
}
```

## Decision Summary

### ✅ RECOMMENDED APPROACH:
1. **Use @tsndr/cloudflare-worker-jwt** (lightweight, CF-optimized)
2. **Keep single worker** with optimized code
3. **Direct Hyperdrive queries** (no ORM in worker)
4. **Proxy complex ops** to Deno Deploy backend
5. **Use KV for sessions** and caching

### Benefits:
- Solves resource limit issue immediately
- Minimal code changes needed
- Maintains your existing architecture
- Easy to debug and maintain
- Cost-effective (single worker)
- Can still use Better Auth in Deno backend if desired

### Migration Time:
- 2-3 hours to replace Better Auth with lightweight JWT
- 1-2 days to implement missing auth features
- Existing endpoints remain unchanged

This approach gives you the best balance of simplicity, performance, and functionality while staying well within Cloudflare Workers' resource limits.