/**
 * Rate Limiter for Better Auth on Cloudflare Workers Free Tier
 * Optimized for 100k requests per day limit
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastRequest: number;
}

/**
 * In-memory rate limiter for Cloudflare Workers
 * Optimized for serverless environment
 */
export class BetterAuthRateLimiter {
  private cache: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  
  constructor(config: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100      // 100 requests per minute per IP
  }) {
    this.config = config;
  }

  /**
   * Check if request is allowed
   */
  async isAllowed(
    key: string, 
    customConfig?: Partial<RateLimitConfig>
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalRequests: number;
  }> {
    const finalConfig = { ...this.config, ...customConfig };
    const now = Date.now();
    
    // Get or create entry
    let entry = this.cache.get(key);
    
    // Reset if window has passed
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + finalConfig.windowMs,
        lastRequest: now
      };
    }
    
    // Check if allowed
    const allowed = entry.count < finalConfig.maxRequests;
    
    if (allowed) {
      entry.count++;
      entry.lastRequest = now;
      this.cache.set(key, entry);
    }
    
    // Cleanup old entries periodically (1% chance)
    if (Math.random() < 0.01) {
      this.cleanup();
    }
    
    return {
      allowed,
      remaining: Math.max(0, finalConfig.maxRequests - entry.count),
      resetTime: entry.resetTime,
      totalRequests: entry.count
    };
  }

  /**
   * Get client identifier from request
   */
  getClientKey(request: Request): string {
    // Use CF-Connecting-IP for Cloudflare
    const ip = request.headers.get('CF-Connecting-IP') ||
               request.headers.get('X-Forwarded-For')?.split(',')[0] ||
               request.headers.get('X-Real-IP') ||
               'unknown';
    
    // Add endpoint specificity for auth routes
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path.includes('/auth/')) {
      return `auth:${ip}`;
    }
    
    return `api:${ip}`;
  }

  /**
   * Create rate limit headers
   */
  createHeaders(result: {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalRequests: number;
  }): Record<string, string> {
    return {
      'X-RateLimit-Limit': this.config.maxRequests.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
      'X-RateLimit-Used': result.totalRequests.toString()
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.resetTime) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get current cache stats
   */
  getStats(): {
    totalKeys: number;
    memoryUsage: number;
    oldestEntry: number;
  } {
    const now = Date.now();
    let oldestEntry = now;
    
    for (const entry of this.cache.values()) {
      if (entry.lastRequest < oldestEntry) {
        oldestEntry = entry.lastRequest;
      }
    }
    
    return {
      totalKeys: this.cache.size,
      memoryUsage: this.cache.size * 64, // Approximate bytes
      oldestEntry
    };
  }
}

/**
 * Enhanced rate limiter with tiered limits for different auth operations
 */
export class TieredBetterAuthRateLimiter extends BetterAuthRateLimiter {
  private authConfig: Record<string, RateLimitConfig> = {
    // More restrictive for login attempts
    'login': {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10           // 10 login attempts per 15 minutes
    },
    
    // Moderate for registration
    'register': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5            // 5 registrations per hour
    },
    
    // Lenient for session checks
    'session': {
      windowMs: 60 * 1000,      // 1 minute
      maxRequests: 60           // 60 session checks per minute
    },
    
    // Very restrictive for password reset
    'reset': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3            // 3 password resets per hour
    }
  };

  /**
   * Check rate limit with operation-specific rules
   */
  async checkAuthOperation(
    request: Request,
    operation: 'login' | 'register' | 'session' | 'reset' | 'default'
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalRequests: number;
    headers: Record<string, string>;
  }> {
    const clientKey = this.getClientKey(request);
    const operationKey = `${operation}:${clientKey}`;
    const config = this.authConfig[operation] || this.config;
    
    const result = await this.isAllowed(operationKey, config);
    const headers = this.createHeaders(result);
    
    return {
      ...result,
      headers
    };
  }

  /**
   * Extract auth operation from request path
   */
  getAuthOperation(request: Request): 'login' | 'register' | 'session' | 'reset' | 'default' {
    const path = new URL(request.url).pathname;
    
    if (path.includes('/login')) return 'login';
    if (path.includes('/register')) return 'register';
    if (path.includes('/session')) return 'session';
    if (path.includes('/reset')) return 'reset';
    
    return 'default';
  }
}

/**
 * Middleware function for Better Auth rate limiting
 */
export async function rateLimitMiddleware(
  request: Request,
  rateLimiter: BetterAuthRateLimiter
): Promise<Response | null> {
  const clientKey = rateLimiter.getClientKey(request);
  const result = await rateLimiter.isAllowed(clientKey);
  
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          ...rateLimiter.createHeaders(result),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    );
  }
  
  return null; // Allow request to proceed
}

/**
 * Advanced middleware with tiered limits
 */
export async function tieredRateLimitMiddleware(
  request: Request,
  rateLimiter: TieredBetterAuthRateLimiter
): Promise<Response | null> {
  const operation = rateLimiter.getAuthOperation(request);
  const result = await rateLimiter.checkAuthOperation(request, operation);
  
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: `Rate limit exceeded for ${operation} operation`,
        operation,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        remaining: result.remaining
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          ...result.headers,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      }
    );
  }
  
  return null; // Allow request to proceed
}

/**
 * Daily request counter for free tier monitoring
 */
export class DailyRequestCounter {
  private dailyCount: { date: string; count: number } | null = null;
  private readonly dailyLimit = 95000; // Leave 5k buffer from 100k limit

  incrementCount(): {
    count: number;
    limit: number;
    remaining: number;
    isNearLimit: boolean;
  } {
    const today = new Date().toISOString().split('T')[0];
    
    if (!this.dailyCount || this.dailyCount.date !== today) {
      this.dailyCount = { date: today, count: 0 };
    }
    
    this.dailyCount.count++;
    
    const remaining = Math.max(0, this.dailyLimit - this.dailyCount.count);
    const isNearLimit = remaining < 1000; // Alert when under 1k remaining
    
    return {
      count: this.dailyCount.count,
      limit: this.dailyLimit,
      remaining,
      isNearLimit
    };
  }

  getStatus(): {
    count: number;
    limit: number;
    remaining: number;
    isNearLimit: boolean;
    date: string;
  } {
    const today = new Date().toISOString().split('T')[0];
    
    if (!this.dailyCount || this.dailyCount.date !== today) {
      return {
        count: 0,
        limit: this.dailyLimit,
        remaining: this.dailyLimit,
        isNearLimit: false,
        date: today
      };
    }
    
    const remaining = Math.max(0, this.dailyLimit - this.dailyCount.count);
    
    return {
      count: this.dailyCount.count,
      limit: this.dailyLimit,
      remaining,
      isNearLimit: remaining < 1000,
      date: this.dailyCount.date
    };
  }
}

/**
 * Create configured rate limiter instances
 */
export function createBetterAuthRateLimiters() {
  const basicLimiter = new BetterAuthRateLimiter({
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 100         // 100 requests per minute
  });
  
  const tieredLimiter = new TieredBetterAuthRateLimiter({
    windowMs: 60 * 1000,     // 1 minute  
    maxRequests: 100         // Default limit
  });
  
  const dailyCounter = new DailyRequestCounter();
  
  return {
    basicLimiter,
    tieredLimiter,
    dailyCounter
  };
}