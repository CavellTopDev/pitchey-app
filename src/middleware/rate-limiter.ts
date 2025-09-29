/**
 * Rate Limiting Middleware
 * Implements token bucket algorithm with sliding window
 */

import { db } from "../db/client.ts";
import { securityEvents } from "../db/schema.ts";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (request: Request) => string; // Custom key generator
  handler?: (request: Request) => Response; // Custom response handler
  onLimitReached?: (key: string, request: Request) => void; // Callback when limit reached
}

interface RateLimitStore {
  hits: number;
  resetTime: number;
}

// In-memory store for rate limiting (consider Redis for production)
const rateLimitStore = new Map<string, RateLimitStore>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ratelimit:${ip}`;
}

/**
 * Default rate limit exceeded handler
 */
function defaultHandler(request: Request): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: 60,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString(),
        'Retry-After': '60',
      },
    }
  );
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
    handler = defaultHandler,
    onLimitReached,
  } = config;
  
  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    const key = keyGenerator(request);
    const now = Date.now();
    const resetTime = now + windowMs;
    
    // Get or create rate limit entry
    let rateLimit = rateLimitStore.get(key);
    
    if (!rateLimit || rateLimit.resetTime < now) {
      // Create new window
      rateLimit = { hits: 0, resetTime };
      rateLimitStore.set(key, rateLimit);
    }
    
    // Check if limit exceeded
    if (rateLimit.hits >= maxRequests) {
      // Log rate limit violation
      await db.insert(securityEvents).values({
        userId: null,
        eventType: 'rate_limit_exceeded',
        eventStatus: 'warning',
        ipAddress: key.replace('ratelimit:', ''),
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          endpoint: new URL(request.url).pathname,
          method: request.method,
          limit: maxRequests,
          window: windowMs,
        },
      });
      
      if (onLimitReached) {
        onLimitReached(key, request);
      }
      
      return handler(request);
    }
    
    // Increment counter
    rateLimit.hits++;
    
    // Process request
    const response = await next();
    
    // Optionally skip counting based on response
    if (
      (skipSuccessfulRequests && response.status < 400) ||
      (skipFailedRequests && response.status >= 400)
    ) {
      rateLimit.hits--;
    }
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', Math.max(0, maxRequests - rateLimit.hits).toString());
    response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString());
    
    return response;
  };
}

/**
 * Predefined rate limiters for common use cases
 */
export const rateLimiters = {
  // Relaxed rate limiting for auth endpoints during testing
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10000, // Very high limit for testing
    skipSuccessfulRequests: false,
    onLimitReached: (key) => {
      console.warn(`Auth rate limit exceeded for ${key}`);
    },
  }),
  
  // Password reset rate limiting
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    handler: () => new Response(
      JSON.stringify({
        error: 'Too many password reset attempts',
        message: 'Please wait before requesting another password reset.',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    ),
  }),
  
  // API rate limiting - increased for testing
  api: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,   // Increased from 100 to 1000 for testing
    skipFailedRequests: true,
  }),
  
  // Strict rate limiting for registration
  registration: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyGenerator: (request) => {
      // Rate limit by IP and also by email if provided
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
      return `register:${ip}`;
    },
  }),
  
  // File upload rate limiting
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    handler: () => new Response(
      JSON.stringify({
        error: 'Upload limit exceeded',
        message: 'You have reached the maximum number of uploads. Please try again later.',
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    ),
  }),
};

/**
 * Apply rate limiting to specific endpoints
 */
export function applyRateLimiting(request: Request, endpoint: string): Response | null {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Define rate limits for specific endpoints
  const rateLimitRules: Array<[RegExp, RateLimitConfig]> = [
    // Authentication endpoints
    [/^\/api\/auth\/(login|creator\/login|investor\/login|production\/login)/, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100, // Increased from 20 to 100 for production use
    }],
    
    // Registration endpoints
    [/^\/api\/auth\/(register|creator\/register|investor\/register|production\/register)/, {
      windowMs: 60 * 60 * 1000,
      maxRequests: 3,
    }],
    
    // Password reset
    [/^\/api\/auth\/password-reset/, {
      windowMs: 60 * 60 * 1000,
      maxRequests: 3,
    }],
    
    // Email verification
    [/^\/api\/auth\/verify-email/, {
      windowMs: 60 * 60 * 1000,
      maxRequests: 5,
    }],
    
    // API endpoints - increased limits for testing
    [/^\/api\//, {
      windowMs: 60 * 1000,
      maxRequests: 1000,  // Increased from 100 to 1000 for testing
    }],
  ];
  
  // Find matching rule
  for (const [pattern, config] of rateLimitRules) {
    if (pattern.test(path)) {
      const limiter = createRateLimiter(config);
      // This would need to be integrated with your request handler
      // For now, return null to indicate no rate limit violation
      return null;
    }
  }
  
  return null;
}

/**
 * Distributed rate limiting using database (for multi-instance deployments)
 */
export class DistributedRateLimiter {
  private config: RateLimitConfig;
  
  constructor(config: RateLimitConfig) {
    this.config = config;
  }
  
  async checkLimit(key: string): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    // This would use a database or Redis for distributed rate limiting
    // For now, using in-memory store
    const now = Date.now();
    const resetTime = new Date(now + this.config.windowMs);
    
    let rateLimit = rateLimitStore.get(key);
    
    if (!rateLimit || rateLimit.resetTime < now) {
      rateLimit = { hits: 0, resetTime: resetTime.getTime() };
      rateLimitStore.set(key, rateLimit);
    }
    
    const allowed = rateLimit.hits < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - rateLimit.hits);
    
    if (allowed) {
      rateLimit.hits++;
    }
    
    return { allowed, remaining, resetTime: new Date(rateLimit.resetTime) };
  }
  
  async reset(key: string): Promise<void> {
    rateLimitStore.delete(key);
  }
}