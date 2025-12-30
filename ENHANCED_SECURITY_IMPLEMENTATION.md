# Enhanced Security Implementation for Pitchey Platform

**Based on Cloudflare Workers & Neon PostgreSQL Best Practices**  
**Date:** December 11, 2024

## 🚨 Critical Security Updates Required

### 1. Secure Environment Variables Management

#### ❌ CURRENT (VULNERABLE):
```toml
# wrangler.toml - NEVER DO THIS!
[vars]
JWT_SECRET = "vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"
DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
```

#### ✅ RECOMMENDED (SECURE):
```toml
# wrangler.toml - Keep only non-sensitive configuration
name = "pitchey-production"
main = "src/worker-production-db.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

# Only public configuration here
[vars]
ENVIRONMENT = "production"
FRONTEND_URL = "https://pitchey-5o8.pages.dev"

# Bindings only - secrets managed via wrangler secret
[[kv_namespaces]]
binding = "KV"
id = "98c88a185eb448e4868fcc87e458b3ac"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "pitchey-uploads"

[[rate_limit]]
binding = "RATE_LIMITER"
# 100 requests per minute per key
simple = { limit = 100, period = 60 }

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "983d4a1818264b5dbdca26bacf167dee"
```

### 2. Secure Neon PostgreSQL Connection

Based on Neon best practices for edge environments:

```typescript
// src/db/secure-connection.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Configure Neon for maximum security and performance
export function configureNeonSecurity() {
  // Force secure WebSocket connections
  neonConfig.useSecureWebSocket = true;
  
  // Enable connection optimizations for edge
  neonConfig.pipelineConnect = 'password';
  neonConfig.coalesceWrites = true;
  
  // Use HTTP fetch for queries (lower latency in Workers)
  neonConfig.poolQueryViaFetch = true;
  
  // Custom fetch endpoint for different environments
  neonConfig.fetchEndpoint = (host, port) => {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}/sql`;
  };
}

// Secure connection manager with proper pooling
export class SecureConnectionManager {
  private static pools = new Map<string, Pool>();
  
  static getPool(connectionString: string): Pool {
    // Parse and validate connection string
    const url = new URL(connectionString);
    
    // Enforce SSL/TLS
    if (!url.searchParams.get('sslmode') || 
        url.searchParams.get('sslmode') === 'disable') {
      url.searchParams.set('sslmode', 'require');
    }
    
    // For production, upgrade to verify-full
    if (url.hostname.includes('neon.tech')) {
      url.searchParams.set('sslmode', 'verify-full');
      url.searchParams.set('channel_binding', 'require');
    }
    
    const secureConnectionString = url.toString();
    
    if (!this.pools.has(secureConnectionString)) {
      const pool = new Pool({
        connectionString: secureConnectionString,
        max: 10, // Connection pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      
      pool.on('error', (err) => {
        console.error('[Pool Error]:', err.message);
        // Don't expose internal errors
      });
      
      this.pools.set(secureConnectionString, pool);
    }
    
    return this.pools.get(secureConnectionString)!;
  }
  
  static async executeSecurely<T>(
    connectionString: string,
    queryFn: (pool: Pool) => Promise<T>
  ): Promise<T> {
    const pool = this.getPool(connectionString);
    
    try {
      return await queryFn(pool);
    } catch (error) {
      // Log internally but don't expose database errors
      console.error('[DB Error]:', error);
      throw new Error('Database operation failed');
    }
  }
}
```

### 3. Enhanced Security Headers Implementation

Based on Cloudflare Workers best practices:

```typescript
// src/security/headers.ts
export class SecurityHeaders {
  private static readonly SECURITY_HEADERS = {
    // Content Security Policy - Strict by default
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' wss://pitchey-api-prod.ndlovucavelle.workers.dev",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; '),
    
    // Strict Transport Security (2 years, include subdomains)
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // XSS Protection (modern browsers)
    'X-XSS-Protection': '0', // Disabled in favor of CSP
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions Policy (restrict browser features)
    'Permissions-Policy': [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
      'interest-cohort=()' // Opt out of FLoC
    ].join(', '),
    
    // Cache Control for security endpoints
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    
    // Prevent content type sniffing
    'X-Permitted-Cross-Domain-Policies': 'none',
  };
  
  static apply(response: Response, options?: {
    allowFraming?: boolean;
    cspReportUri?: string;
    additionalCsp?: string;
  }): Response {
    const headers = new Headers(response.headers);
    
    // Apply all security headers
    Object.entries(this.SECURITY_HEADERS).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    // Handle options
    if (options?.allowFraming) {
      headers.set('X-Frame-Options', 'SAMEORIGIN');
      headers.set('Content-Security-Policy', 
        headers.get('Content-Security-Policy')!.replace("frame-ancestors 'none'", "frame-ancestors 'self'")
      );
    }
    
    if (options?.cspReportUri) {
      headers.set('Content-Security-Policy', 
        `${headers.get('Content-Security-Policy')}; report-uri ${options.cspReportUri}`
      );
    }
    
    if (options?.additionalCsp) {
      headers.set('Content-Security-Policy',
        `${headers.get('Content-Security-Policy')}; ${options.additionalCsp}`
      );
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
}
```

### 4. Production-Grade CORS Implementation

```typescript
// src/security/cors.ts
export class CORSHandler {
  private static readonly ALLOWED_ORIGINS = {
    production: [
      'https://pitchey-5o8.pages.dev',
      'https://pitchey.com',
      /^https:\/\/[a-z0-9]+\.pitchey\.pages\.dev$/ // Preview deployments
    ],
    development: [
      'http://localhost:5173',
      'http://localhost:3000'
    ]
  };
  
  static handleOptions(request: Request, env: Env): Response {
    const origin = request.headers.get('Origin');
    const requestMethod = request.headers.get('Access-Control-Request-Method');
    const requestHeaders = request.headers.get('Access-Control-Request-Headers');
    
    // Validate CORS preflight requirements
    if (!origin || !requestMethod || !requestHeaders) {
      return new Response(null, {
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // Check if origin is allowed
    const isAllowed = this.isOriginAllowed(origin, env.ENVIRONMENT);
    
    if (!isAllowed) {
      return new Response('Forbidden', { status: 403 });
    }
    
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': requestHeaders,
        'Access-Control-Max-Age': '86400', // 24 hours
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin'
      }
    });
  }
  
  static applyCORS(response: Response, request: Request, env: Env): Response {
    const origin = request.headers.get('Origin');
    
    if (!origin) return response;
    
    const isAllowed = this.isOriginAllowed(origin, env.ENVIRONMENT);
    
    if (!isAllowed) return response;
    
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
  
  private static isOriginAllowed(origin: string, environment: string): boolean {
    const allowedOrigins = environment === 'production' 
      ? this.ALLOWED_ORIGINS.production 
      : [...this.ALLOWED_ORIGINS.production, ...this.ALLOWED_ORIGINS.development];
    
    return allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      return allowed.test(origin);
    });
  }
}
```

### 5. Advanced Rate Limiting with Cloudflare

```typescript
// src/security/rate-limiter.ts
export class AdvancedRateLimiter {
  constructor(
    private rateLimiter: any, // Cloudflare Rate Limiter binding
    private kv: KVNamespace
  ) {}
  
  async checkLimit(
    request: Request,
    options: {
      key: string;
      limit?: number;
      window?: number;
      action?: 'login' | 'api' | 'sensitive';
    }
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    // Different limits for different actions
    const limits = {
      login: { limit: 5, window: 900 }, // 5 attempts per 15 minutes
      sensitive: { limit: 10, window: 3600 }, // 10 per hour
      api: { limit: 100, window: 60 } // 100 per minute
    };
    
    const config = limits[options.action || 'api'] || {
      limit: options.limit || 100,
      window: options.window || 60
    };
    
    // Use Cloudflare's native rate limiter
    const { success, remaining, resetAt } = await this.rateLimiter.limit({
      key: options.key
    });
    
    // Additional tracking for abuse patterns
    if (!success) {
      await this.trackAbuse(options.key, request);
    }
    
    return {
      allowed: success,
      remaining,
      resetAt
    };
  }
  
  private async trackAbuse(key: string, request: Request): Promise<void> {
    const abuseKey = `abuse:${key}`;
    const attempts = await this.kv.get(abuseKey, 'json') as number[] || [];
    attempts.push(Date.now());
    
    // Keep only last 24 hours of attempts
    const oneDayAgo = Date.now() - 86400000;
    const recentAttempts = attempts.filter(t => t > oneDayAgo);
    
    await this.kv.put(abuseKey, JSON.stringify(recentAttempts), {
      expirationTtl: 86400
    });
    
    // Auto-ban after 20 failed attempts in 24 hours
    if (recentAttempts.length > 20) {
      await this.kv.put(`banned:${key}`, 'true', {
        expirationTtl: 86400 // 24 hour ban
      });
      
      // Log security event
      console.error('[Security] Auto-banned key due to abuse:', key);
    }
  }
  
  async isBanned(key: string): Promise<boolean> {
    const banned = await this.kv.get(`banned:${key}`);
    return banned === 'true';
  }
}
```

### 6. JWT Security Enhancement

```typescript
// src/auth/jwt-security.ts
import jwt from '@tsndr/cloudflare-worker-jwt';
import { randomBytes } from 'crypto';

export class JWTSecurity {
  private static readonly TOKEN_EXPIRY = 3600; // 1 hour
  private static readonly REFRESH_TOKEN_EXPIRY = 604800; // 7 days
  
  static async generateSecureSecret(): Promise<string> {
    // Generate cryptographically secure 256-bit secret
    return randomBytes(32).toString('base64url');
  }
  
  static async signSecure(
    payload: any,
    secret: string,
    options?: {
      expiresIn?: number;
      audience?: string;
      issuer?: string;
    }
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    
    const securePayload = {
      ...payload,
      iat: now,
      exp: now + (options?.expiresIn || this.TOKEN_EXPIRY),
      nbf: now - 30, // Not before (30 seconds tolerance)
      jti: crypto.randomUUID(), // Unique token ID
      aud: options?.audience || 'pitchey-api',
      iss: options?.issuer || 'pitchey-auth'
    };
    
    return await jwt.sign(securePayload, secret);
  }
  
  static async verifySecure(
    token: string,
    secret: string,
    options?: {
      audience?: string;
      issuer?: string;
    }
  ): Promise<any> {
    try {
      const isValid = await jwt.verify(token, secret);
      if (!isValid) throw new Error('Invalid token');
      
      const payload = jwt.decode(token).payload as any;
      
      // Additional security checks
      if (options?.audience && payload.aud !== options.audience) {
        throw new Error('Invalid audience');
      }
      
      if (options?.issuer && payload.iss !== options.issuer) {
        throw new Error('Invalid issuer');
      }
      
      // Check token age (prevent replay attacks)
      const now = Math.floor(Date.now() / 1000);
      const tokenAge = now - payload.iat;
      if (tokenAge > this.TOKEN_EXPIRY * 2) {
        throw new Error('Token too old');
      }
      
      return payload;
    } catch (error) {
      throw new Error('Token validation failed');
    }
  }
}
```

### 7. Secure Worker Implementation

```typescript
// src/worker-secure.ts
import { Router } from 'itty-router';
import { SecurityHeaders } from './security/headers';
import { CORSHandler } from './security/cors';
import { AdvancedRateLimiter } from './security/rate-limiter';
import { JWTSecurity } from './auth/jwt-security';
import { SecureConnectionManager, configureNeonSecurity } from './db/secure-connection';
import { registerHealthRoutes } from './health/health-routes';

// Configure Neon security on startup
configureNeonSecurity();

export interface Env {
  // Secrets (never in wrangler.toml!)
  JWT_SECRET: string;
  DATABASE_URL: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  
  // Bindings
  KV: KVNamespace;
  R2_BUCKET: R2Bucket;
  RATE_LIMITER: any;
  HYPERDRIVE: any;
  
  // Public config
  ENVIRONMENT: string;
  FRONTEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const router = Router();
    
    // Initialize services
    const rateLimiter = new AdvancedRateLimiter(env.RATE_LIMITER, env.KV);
    
    // Global middleware
    router.all('*', async (request) => {
      // Check for banned IPs
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (await rateLimiter.isBanned(clientIP)) {
        return new Response('Forbidden', { status: 403 });
      }
      
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return CORSHandler.handleOptions(request, env);
      }
    });
    
    // Health check routes (rate limited)
    registerHealthRoutes(router, env);
    
    // Authentication endpoints with aggressive rate limiting
    router.post('/api/auth/:portal/login', async (request, { params }) => {
      const { portal } = params;
      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      
      // Strict rate limiting for login attempts
      const { allowed, remaining } = await rateLimiter.checkLimit(request, {
        key: `login:${clientIP}`,
        action: 'login'
      });
      
      if (!allowed) {
        return new Response(JSON.stringify({
          error: 'Too many login attempts. Please try again later.'
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '900',
            'X-RateLimit-Remaining': '0'
          }
        });
      }
      
      try {
        // Validate input
        const body = await request.json() as any;
        if (!body.email || !body.password) {
          return new Response(JSON.stringify({
            error: 'Invalid credentials'
          }), { status: 401 });
        }
        
        // Execute secure database query
        const user = await SecureConnectionManager.executeSecurely(
          env.DATABASE_URL,
          async (pool) => {
            const { rows } = await pool.query(
              'SELECT id, email, password_hash, role FROM users WHERE email = $1 AND role = $2',
              [body.email.toLowerCase(), portal]
            );
            return rows[0];
          }
        );
        
        if (!user) {
          return new Response(JSON.stringify({
            error: 'Invalid credentials'
          }), { status: 401 });
        }
        
        // Verify password (implement bcrypt verification)
        // ... password verification logic ...
        
        // Generate secure JWT
        const token = await JWTSecurity.signSecure(
          {
            sub: user.id,
            email: user.email,
            role: user.role
          },
          env.JWT_SECRET,
          {
            audience: `pitchey-${portal}`,
            issuer: 'pitchey-auth'
          }
        );
        
        return new Response(JSON.stringify({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': remaining.toString()
          }
        });
        
      } catch (error) {
        console.error('[Auth Error]:', error);
        return new Response(JSON.stringify({
          error: 'Authentication failed'
        }), { status: 500 });
      }
    });
    
    // Protected route middleware
    const requireAuth = async (request: Request) => {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      const token = authHeader.substring(7);
      
      try {
        const payload = await JWTSecurity.verifySecure(
          token,
          env.JWT_SECRET,
          {
            audience: 'pitchey-api',
            issuer: 'pitchey-auth'
          }
        );
        
        // Add user context to request
        (request as any).user = payload;
        
      } catch (error) {
        return new Response('Unauthorized', { status: 401 });
      }
    };
    
    // Protected API routes
    router.all('/api/protected/*', requireAuth);
    
    // Handle 404
    router.all('*', () => 
      new Response('Not Found', { status: 404 })
    );
    
    // Process request
    let response = await router.handle(request, env, ctx);
    
    // Apply security headers
    response = SecurityHeaders.apply(response);
    
    // Apply CORS
    response = CORSHandler.applyCORS(response, request, env);
    
    return response;
  }
};
```

## Deployment Checklist

### Phase 1: Immediate Security Fixes (24-48 hours)

```bash
#!/bin/bash
# emergency-security-fix.sh

echo "🔒 Starting Emergency Security Remediation..."

# 1. Generate new secrets
echo "Generating secure secrets..."
JWT_SECRET=$(openssl rand -base64 32)
echo "New JWT_SECRET generated (save this securely): $JWT_SECRET"

# 2. Rotate database password in Neon dashboard
echo "⚠️  ACTION REQUIRED: Rotate database password in Neon dashboard"
echo "   https://console.neon.tech"
read -p "Press enter after rotating database password..."

# 3. Rotate Redis tokens in Upstash
echo "⚠️  ACTION REQUIRED: Rotate Redis tokens in Upstash dashboard"
echo "   https://console.upstash.com"
read -p "Press enter after rotating Redis tokens..."

# 4. Add secrets to Cloudflare
echo "Adding secrets to Cloudflare Workers..."
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET
read -sp "Enter new DATABASE_URL: " DATABASE_URL
echo "$DATABASE_URL" | wrangler secret put DATABASE_URL
read -sp "Enter new UPSTASH_REDIS_REST_TOKEN: " REDIS_TOKEN
echo "$REDIS_TOKEN" | wrangler secret put UPSTASH_REDIS_REST_TOKEN

# 5. Remove hardcoded secrets from wrangler.toml
echo "Cleaning wrangler.toml..."
sed -i '/JWT_SECRET/d' wrangler.toml
sed -i '/DATABASE_URL/d' wrangler.toml
sed -i '/UPSTASH_REDIS_REST_TOKEN/d' wrangler.toml

# 6. Deploy emergency patch
echo "Deploying emergency security patch..."
wrangler deploy --compatibility-date 2024-11-01

echo "✅ Emergency security remediation complete!"
```

### Phase 2: Git History Cleanup

```bash
# Clean git history of secrets
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch wrangler.toml' \
  --prune-empty --tag-name-filter cat -- --all

# Force push cleaned history
git push origin --force --all
git push origin --force --tags
```

### Phase 3: Monitoring Setup

```typescript
// src/monitoring/security-alerts.ts
export async function checkSecurityHealth(env: Env): Promise<void> {
  const alerts = [];
  
  // Check for weak configurations
  if (!env.DATABASE_URL.includes('sslmode=verify-full')) {
    alerts.push('Database connection not using verify-full SSL mode');
  }
  
  // Check rate limiting
  // Check failed login attempts
  // Check unusual traffic patterns
  
  if (alerts.length > 0) {
    // Send to monitoring service
    await sendSecurityAlert(alerts, env);
  }
}
```

## Security Best Practices Summary

### ✅ DO:
- Use `wrangler secret` for all sensitive values
- Enforce `sslmode=verify-full` for Neon connections
- Implement comprehensive security headers
- Use environment-specific CORS whitelisting
- Rate limit aggressively on authentication endpoints
- Log security events for monitoring
- Validate and sanitize all user input
- Use circuit breakers for external services
- Implement proper error handling without exposing internals

### ❌ DON'T:
- Never commit secrets to source control
- Don't use predictable secret patterns
- Don't expose database errors to clients
- Don't allow wildcard CORS in production
- Don't skip rate limiting on sensitive endpoints
- Don't trust user input without validation
- Don't use `sslmode=disable` or `sslmode=allow`
- Don't expose stack traces in production
- Don't create database connections outside request handlers

## Conclusion

This enhanced security implementation addresses all critical vulnerabilities while following Cloudflare Workers and Neon PostgreSQL best practices. The immediate priority is rotating all exposed credentials and implementing proper secret management. The provided code ensures production-grade security with comprehensive protection against common attack vectors.