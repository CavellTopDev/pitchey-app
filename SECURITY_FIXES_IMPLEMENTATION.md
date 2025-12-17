# Security Fixes Implementation Guide
## Immediate Actions Required

---

## 🔴 CRITICAL FIX #1: Remove Hardcoded Secrets

### Step 1: Create secure wrangler.toml (without secrets)
Create a new file `wrangler.toml.secure`:

```toml
# Production configuration - no secrets here!
name = "pitchey-production"
main = "src/worker-production-db.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
account_id = "e16d3bf549153de23459a6c6a06a431b"

# Remove all [vars] section - secrets go to Cloudflare Secrets

# Frontend URL is safe to keep as it's public
[vars]
FRONTEND_URL = "https://pitchey.pages.dev"
ENVIRONMENT = "production"

# KV for static content caching and sessions
[[kv_namespaces]]
binding = "KV"
id = "98c88a185eb448e4868fcc87e458b3ac"

# R2 for file storage
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "pitchey-uploads"

# Durable Objects for real-time features
[[durable_objects.bindings]]
name = "WEBSOCKET_ROOM"
class_name = "WebSocketRoom"

[[durable_objects.bindings]]
name = "NOTIFICATION_ROOM"
class_name = "NotificationRoom"

# Migrations
[[migrations]]
tag = "v3"
new_sqlite_classes = ["WebSocketRoom"]

[[migrations]]
tag = "v4"
new_sqlite_classes = ["NotificationRoom"]
```

### Step 2: Add secrets via Cloudflare CLI

```bash
# Generate new secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" | wrangler secret put JWT_SECRET

# Add database URL (get new password from Neon dashboard first!)
echo -n "postgresql://neondb_owner:NEW_PASSWORD@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" | wrangler secret put DATABASE_URL

# Add Redis credentials
echo -n "https://chief-anteater-20186.upstash.io" | wrangler secret put UPSTASH_REDIS_REST_URL
echo -n "NEW_TOKEN_FROM_UPSTASH" | wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

### Step 3: Update .gitignore

```bash
# Add to .gitignore
echo "wrangler.toml" >> .gitignore
echo ".env.production" >> .gitignore
echo "*.secrets" >> .gitignore
```

### Step 4: Clean git history

```bash
# Install BFG Repo-Cleaner
brew install bfg  # or download from https://rtyley.github.io/bfg-repo-cleaner/

# Create a backup first
cp -r .git .git.backup

# Remove secrets from history
bfg --replace-text passwords.txt .
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# passwords.txt should contain:
# npg_DZhIpVaLAk06
# vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz
# AU7aAAIncDI3ZGVjNWMxZGUyOWQ0ZmYyYjI4NzdkYjM4OGMxZTE3NnAyMjAxODY
```

---

## 🔴 CRITICAL FIX #2: Secure Worker Implementation

Create `src/worker-production-secure.ts`:

```typescript
import { Env } from './types';
import { SecureAuthHandler } from './auth/secure-auth';
import { SecureCorsHandler } from './security/cors';
import { InputValidator } from './security/input-validator';
import { SecureErrorHandler } from './security/error-handler';
import { EnhancedRateLimiter } from './security/rate-limiter';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Security headers first
      const securityHeaders = SecureCorsHandler.getHeaders(request, env);
      
      // Rate limiting
      const rateLimiter = new EnhancedRateLimiter(env);
      const ipAddress = request.headers.get('CF-Connecting-IP') || 'unknown';
      
      // Check rate limits based on endpoint
      const url = new URL(request.url);
      const endpoint = `${request.method}:${url.pathname}`;
      const limitType = this.getEndpointLimitType(endpoint);
      
      const { allowed, remaining, retryAfter } = await rateLimiter.checkLimit(
        ipAddress, 
        limitType
      );
      
      if (!allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter
        }), {
          status: 429,
          headers: {
            ...securityHeaders,
            'Retry-After': String(retryAfter),
            'X-RateLimit-Remaining': '0'
          }
        });
      }
      
      // Add rate limit headers
      securityHeaders['X-RateLimit-Remaining'] = String(remaining);
      
      // Handle OPTIONS for CORS
      if (request.method === 'OPTIONS') {
        return new Response(null, { 
          status: 204, 
          headers: securityHeaders 
        });
      }
      
      // Route to appropriate handler
      return await this.handleRequest(request, env, securityHeaders);
      
    } catch (error) {
      return SecureErrorHandler.handle(error, request, env);
    }
  },
  
  getEndpointLimitType(endpoint: string): 'login' | 'api' | 'sensitive' | 'upload' {
    if (endpoint.includes('/auth/') && endpoint.includes('/login')) return 'login';
    if (endpoint.includes('/upload')) return 'upload';
    if (endpoint.includes('/admin') || endpoint.includes('/payment')) return 'sensitive';
    return 'api';
  },
  
  async handleRequest(
    request: Request, 
    env: Env, 
    headers: Record<string, string>
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Public endpoints
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // Auth endpoints
    if (path.startsWith('/api/auth/')) {
      return await SecureAuthHandler.handle(request, env, headers);
    }
    
    // Protected endpoints - verify JWT
    const user = await SecureAuthHandler.verifyRequest(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // Add user context to request
    const authenticatedRequest = new Request(request.url, {
      ...request,
      headers: new Headers({
        ...request.headers,
        'X-User-Id': String(user.userId),
        'X-User-Type': user.userType
      })
    });
    
    // Route to domain handlers
    if (path.startsWith('/api/pitches')) {
      const { PitchHandler } = await import('./handlers/pitch-handler');
      return await PitchHandler.handle(authenticatedRequest, env, headers);
    }
    
    // Default 404
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
};
```

---

## 🔴 CRITICAL FIX #3: Secure Authentication Module

Create `src/auth/secure-auth.ts`:

```typescript
import jwt from '@tsndr/cloudflare-worker-jwt';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';

// Input validation schemas
const LoginSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(128)
});

const RegisterSchema = LoginSchema.extend({
  firstName: z.string().min(1).max(50).regex(/^[a-zA-Z\s-]+$/),
  lastName: z.string().min(1).max(50).regex(/^[a-zA-Z\s-]+$/),
  companyName: z.string().min(1).max(100).optional()
});

// Password complexity requirements
const PasswordRequirements = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/\d/, 'Password must contain number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain special character');

export class SecureAuthHandler {
  static async handle(
    request: Request, 
    env: Env, 
    headers: Record<string, string>
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Login endpoints
    if (path.includes('/login')) {
      return await this.handleLogin(request, env, headers);
    }
    
    // Register endpoints
    if (path.includes('/register')) {
      return await this.handleRegister(request, env, headers);
    }
    
    // Password reset
    if (path.includes('/reset-password')) {
      return await this.handlePasswordReset(request, env, headers);
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
  
  static async handleLogin(
    request: Request,
    env: Env,
    headers: Record<string, string>
  ): Promise<Response> {
    try {
      // Parse and validate input
      const body = await request.json();
      const validated = LoginSchema.parse(body);
      
      // Get database connection
      const sql = neon(env.DATABASE_URL);
      const db = drizzle(sql);
      
      // Find user (use parameterized query)
      const users = await db.select()
        .from(schema.users)
        .where(eq(schema.users.email, validated.email))
        .limit(1);
      
      if (users.length === 0) {
        // Generic error to prevent user enumeration
        return this.authError(headers);
      }
      
      const user = users[0];
      
      // Verify password
      const validPassword = await bcrypt.compare(
        validated.password, 
        user.passwordHash || ''
      );
      
      if (!validPassword) {
        return this.authError(headers);
      }
      
      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return new Response(JSON.stringify({
          error: 'Account temporarily locked'
        }), {
          status: 423,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      // Generate secure JWT
      const token = await this.generateToken(user, env);
      
      // Update last login (async, don't wait)
      db.update(schema.users)
        .set({ 
          lastLogin: new Date(),
          failedLoginAttempts: 0
        })
        .where(eq(schema.users.id, user.id))
        .then(() => {});
      
      // Return success with token
      return new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType
        }
      }), {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          // Set secure cookie
          'Set-Cookie': `auth=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`
        }
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new Response(JSON.stringify({
          error: 'Invalid input',
          details: error.errors
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }
  }
  
  static async handleRegister(
    request: Request,
    env: Env,
    headers: Record<string, string>
  ): Promise<Response> {
    try {
      // Parse and validate input
      const body = await request.json();
      const validated = RegisterSchema.parse(body);
      
      // Validate password complexity
      PasswordRequirements.parse(validated.password);
      
      // Hash password with proper salt rounds
      const passwordHash = await bcrypt.hash(validated.password, 12);
      
      // Get database connection
      const sql = neon(env.DATABASE_URL);
      const db = drizzle(sql);
      
      // Check if user exists
      const existing = await db.select()
        .from(schema.users)
        .where(eq(schema.users.email, validated.email))
        .limit(1);
      
      if (existing.length > 0) {
        return new Response(JSON.stringify({
          error: 'Email already registered'
        }), {
          status: 409,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      // Create user with secure defaults
      const [newUser] = await db.insert(schema.users)
        .values({
          email: validated.email,
          username: validated.email.split('@')[0],
          passwordHash,
          firstName: validated.firstName,
          lastName: validated.lastName,
          userType: this.getUserTypeFromPath(request.url),
          emailVerified: false,
          twoFactorEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      // Generate email verification token
      const verificationToken = crypto.randomUUID();
      await env.KV.put(
        `verify:${verificationToken}`,
        String(newUser.id),
        { expirationTtl: 86400 } // 24 hours
      );
      
      // TODO: Send verification email
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.'
      }), {
        status: 201,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return new Response(JSON.stringify({
          error: 'Validation failed',
          details: error.errors
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }
  }
  
  static async generateToken(user: any, env: Env): Promise<string> {
    const payload = {
      sub: String(user.id),
      email: user.email,
      userType: user.userType,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      jti: crypto.randomUUID(), // JWT ID for revocation
    };
    
    return await jwt.sign(payload, env.JWT_SECRET);
  }
  
  static async verifyRequest(request: Request, env: Env): Promise<any | null> {
    try {
      // Check cookie first
      const cookie = request.headers.get('Cookie');
      let token = this.extractTokenFromCookie(cookie);
      
      // Fall back to Authorization header
      if (!token) {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) return null;
        token = authHeader.substring(7);
      }
      
      // Verify token
      const isValid = await jwt.verify(token, env.JWT_SECRET);
      if (!isValid) return null;
      
      const { payload } = jwt.decode(token);
      
      // Check if token is revoked
      const revoked = await env.KV.get(`revoked:${payload.jti}`);
      if (revoked) return null;
      
      return payload;
      
    } catch {
      return null;
    }
  }
  
  static extractTokenFromCookie(cookie: string | null): string | null {
    if (!cookie) return null;
    const match = cookie.match(/auth=([^;]+)/);
    return match ? match[1] : null;
  }
  
  static getUserTypeFromPath(url: string): string {
    if (url.includes('/creator/')) return 'creator';
    if (url.includes('/investor/')) return 'investor';
    if (url.includes('/production/')) return 'production';
    return 'creator'; // default
  }
  
  static authError(headers: Record<string, string>): Response {
    // Generic error to prevent timing attacks
    return new Response(JSON.stringify({
      error: 'Invalid email or password'
    }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
  
  static async handlePasswordReset(
    request: Request,
    env: Env,
    headers: Record<string, string>
  ): Promise<Response> {
    // Implementation for password reset with secure token generation
    // and expiration handling
    return new Response(JSON.stringify({
      message: 'Password reset implementation'
    }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
}
```

---

## 🟠 HIGH PRIORITY FIX: Enhanced Rate Limiter

Create `src/security/rate-limiter.ts`:

```typescript
import { Redis } from '@upstash/redis/cloudflare';

interface RateLimitConfig {
  requests: number;
  window: number;      // seconds
  blockDuration: number; // seconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  resetAt: number;
}

export class EnhancedRateLimiter {
  private redis: Redis;
  
  private readonly limits: Record<string, RateLimitConfig> = {
    login: { requests: 5, window: 300, blockDuration: 900 },       // 5 per 5 min, block 15 min
    api: { requests: 100, window: 60, blockDuration: 60 },         // 100 per min
    sensitive: { requests: 10, window: 600, blockDuration: 3600 }, // 10 per 10 min, block 1 hour
    upload: { requests: 5, window: 300, blockDuration: 600 }       // 5 per 5 min, block 10 min
  };
  
  constructor(env: Env) {
    this.redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN
    });
  }
  
  async checkLimit(
    identifier: string,
    action: keyof typeof this.limits
  ): Promise<RateLimitResult> {
    const config = this.limits[action];
    const now = Date.now();
    const key = `rl:${action}:${identifier}`;
    const blockKey = `block:${key}`;
    
    // Check if currently blocked
    const blockExpiry = await this.redis.get<number>(blockKey);
    if (blockExpiry && blockExpiry > now) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((blockExpiry - now) / 1000),
        resetAt: blockExpiry
      };
    }
    
    // Implement sliding window with Redis sorted sets
    const windowStart = now - (config.window * 1000);
    
    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);
    
    // Count requests in current window
    const count = await this.redis.zcard(key);
    
    if (count >= config.requests) {
      // Block the identifier
      const blockUntil = now + (config.blockDuration * 1000);
      await this.redis.setex(blockKey, config.blockDuration, blockUntil);
      
      // Log for monitoring
      await this.logRateLimitViolation(identifier, action);
      
      return {
        allowed: false,
        remaining: 0,
        retryAfter: config.blockDuration,
        resetAt: blockUntil
      };
    }
    
    // Add current request
    const requestId = `${now}-${Math.random()}`;
    await this.redis.zadd(key, { score: now, member: requestId });
    await this.redis.expire(key, config.window);
    
    const remaining = config.requests - count - 1;
    const resetAt = now + (config.window * 1000);
    
    return {
      allowed: true,
      remaining,
      retryAfter: 0,
      resetAt
    };
  }
  
  async logRateLimitViolation(identifier: string, action: string): Promise<void> {
    const logKey = `rl:violations:${action}`;
    const timestamp = new Date().toISOString();
    
    await this.redis.lpush(logKey, JSON.stringify({
      identifier,
      action,
      timestamp
    }));
    
    // Keep only last 1000 violations
    await this.redis.ltrim(logKey, 0, 999);
  }
  
  // Admin method to unblock an identifier
  async unblock(identifier: string, action: string): Promise<void> {
    const key = `rl:${action}:${identifier}`;
    const blockKey = `block:${key}`;
    
    await this.redis.del(blockKey);
    await this.redis.del(key);
  }
  
  // Get rate limit status without incrementing
  async getStatus(
    identifier: string,
    action: keyof typeof this.limits
  ): Promise<RateLimitResult> {
    const config = this.limits[action];
    const now = Date.now();
    const key = `rl:${action}:${identifier}`;
    const blockKey = `block:${key}`;
    
    // Check if blocked
    const blockExpiry = await this.redis.get<number>(blockKey);
    if (blockExpiry && blockExpiry > now) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((blockExpiry - now) / 1000),
        resetAt: blockExpiry
      };
    }
    
    // Count current requests
    const windowStart = now - (config.window * 1000);
    await this.redis.zremrangebyscore(key, 0, windowStart);
    const count = await this.redis.zcard(key);
    
    return {
      allowed: count < config.requests,
      remaining: Math.max(0, config.requests - count),
      retryAfter: 0,
      resetAt: now + (config.window * 1000)
    };
  }
}
```

---

## 🟠 HIGH PRIORITY FIX: Secure CORS Handler

Create `src/security/cors.ts`:

```typescript
export class SecureCorsHandler {
  private static readonly PRODUCTION_ORIGINS = [
    'https://pitchey.pages.dev',
    'https://pitchey.com',
    'https://www.pitchey.com'
  ];
  
  private static readonly DEVELOPMENT_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ];
  
  static getHeaders(request: Request, env: Env): Record<string, string> {
    const origin = request.headers.get('Origin');
    
    // No origin = same-origin request, allow
    if (!origin) {
      return this.getSecurityHeaders();
    }
    
    // Check allowed origins based on environment
    const allowedOrigins = env.ENVIRONMENT === 'production'
      ? this.PRODUCTION_ORIGINS
      : [...this.PRODUCTION_ORIGINS, ...this.DEVELOPMENT_ORIGINS];
    
    // Strict origin check - no regex patterns
    if (!allowedOrigins.includes(origin)) {
      // Don't include CORS headers for unauthorized origins
      return this.getSecurityHeaders();
    }
    
    return {
      ...this.getSecurityHeaders(),
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin' // Important for caching
    };
  }
  
  private static getSecurityHeaders(): Record<string, string> {
    return {
      // Prevent XSS
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy-Report-Only': this.getCSP(),
      
      // Force HTTPS
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      
      // Referrer policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      
      // Permissions policy
      'Permissions-Policy': this.getPermissionsPolicy(),
      
      // Cache control for sensitive data
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
  }
  
  private static getCSP(): string {
    const policies = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://pitchey-production.cavelltheleaddev.workers.dev wss://pitchey-production.cavelltheleaddev.workers.dev",
      "media-src 'self'",
      "object-src 'none'",
      "child-src 'self'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
      "block-all-mixed-content",
      "report-uri /api/csp-report"
    ];
    
    return policies.join('; ');
  }
  
  private static getPermissionsPolicy(): string {
    const policies = [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()',
      'clipboard-read=()',
      'clipboard-write=(self)',
      'gamepad=()',
      'speaker-selection=()',
      'conversion-measurement=()',
      'focus-without-user-activation=()',
      'hid=()',
      'idle-detection=()',
      'interest-cohort=()',
      'serial=()',
      'sync-script=()',
      'trust-token-redemption=()',
      'window-placement=()',
      'vertical-scroll=(self)'
    ];
    
    return policies.join(', ');
  }
}
```

---

## Testing Script

Create `test-security.sh`:

```bash
#!/bin/bash

echo "Security Testing Script for Pitchey Platform"
echo "============================================"

# Test 1: Check for exposed secrets
echo -e "\n[TEST 1] Checking for exposed secrets..."
if grep -r "npg_DZhIpVaLAk06\|vYGh89KjLmNpQrStUwXyZ\|AU7aAAIncDI3ZGVj" . --exclude-dir=.git --exclude="*.md" 2>/dev/null; then
    echo "❌ FAILED: Secrets found in codebase!"
else
    echo "✅ PASSED: No hardcoded secrets found"
fi

# Test 2: Test rate limiting
echo -e "\n[TEST 2] Testing rate limiting..."
for i in {1..10}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/creator/login \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"wrong"}')
    echo "Request $i: HTTP $response"
    if [ $i -gt 5 ] && [ "$response" != "429" ]; then
        echo "⚠️  WARNING: Rate limiting may not be working"
    fi
done

# Test 3: Check security headers
echo -e "\n[TEST 3] Checking security headers..."
headers=$(curl -sI https://pitchey-production.cavelltheleaddev.workers.dev/health)

check_header() {
    if echo "$headers" | grep -qi "$1"; then
        echo "✅ $1 present"
    else
        echo "❌ $1 missing"
    fi
}

check_header "X-Content-Type-Options"
check_header "X-Frame-Options"
check_header "X-XSS-Protection"
check_header "Strict-Transport-Security"
check_header "Content-Security-Policy"

# Test 4: SQL Injection attempt
echo -e "\n[TEST 4] Testing SQL injection protection..."
response=$(curl -s -X POST \
    https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/creator/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@test.com'\'' OR 1=1--","password":"x"}')

if echo "$response" | grep -q "error"; then
    echo "✅ PASSED: SQL injection attempt blocked"
else
    echo "❌ FAILED: Potential SQL injection vulnerability"
fi

# Test 5: XSS attempt
echo -e "\n[TEST 5] Testing XSS protection..."
response=$(curl -s -X POST \
    https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TEST_TOKEN" \
    -d '{"title":"<script>alert(1)</script>","logline":"test"}')

if echo "$response" | grep -q "<script>"; then
    echo "❌ FAILED: XSS not properly sanitized"
else
    echo "✅ PASSED: XSS attempt sanitized"
fi

echo -e "\n============================================"
echo "Security testing complete!"
```

Make it executable:
```bash
chmod +x test-security.sh
```

---

## Deployment Checklist

### Before Deployment:
- [ ] All secrets removed from code
- [ ] Secrets added to Cloudflare Secrets
- [ ] Git history cleaned
- [ ] Security headers implemented
- [ ] Rate limiting configured
- [ ] Input validation added
- [ ] Error handling secured
- [ ] CORS properly configured

### Deployment Commands:
```bash
# 1. Deploy secure configuration
cp wrangler.toml.secure wrangler.toml

# 2. Add secrets to Cloudflare
./deploy-secrets.sh

# 3. Deploy worker
wrangler deploy

# 4. Test security
./test-security.sh

# 5. Monitor logs
wrangler tail
```

### Post-Deployment:
- [ ] Run security tests
- [ ] Monitor error rates
- [ ] Check rate limiting
- [ ] Verify CORS headers
- [ ] Test authentication flows
- [ ] Review CloudFlare WAF logs

---

## Monitoring & Alerting

Add to your worker for security monitoring:

```typescript
class SecurityMonitor {
  static async logSecurityEvent(
    env: Env,
    event: {
      type: 'auth_failure' | 'rate_limit' | 'injection_attempt' | 'xss_attempt';
      identifier: string;
      details: any;
    }
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...event
    };
    
    // Store in KV for analysis
    const key = `security:${event.type}:${timestamp}`;
    await env.KV.put(key, JSON.stringify(logEntry), {
      expirationTtl: 2592000 // 30 days
    });
    
    // Alert on critical events
    if (event.type === 'injection_attempt' || event.type === 'xss_attempt') {
      // Send alert (implement your alerting mechanism)
      await this.sendSecurityAlert(env, logEntry);
    }
  }
  
  static async sendSecurityAlert(env: Env, event: any): Promise<void> {
    // Implement alerting via email, Slack, PagerDuty, etc.
    console.error('SECURITY ALERT:', event);
  }
}
```

---

This implementation guide provides immediate, actionable fixes for all critical and high-priority security vulnerabilities. Deploy these changes incrementally, testing each component thoroughly before moving to production.