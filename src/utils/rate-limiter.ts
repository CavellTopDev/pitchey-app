/**
 * IP-based rate limiting utility for public endpoints
 * Provides basic rate limiting to prevent scraping and abuse
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix?: string; // Optional prefix for cache keys
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 100, // 100 requests per hour
  keyPrefix: 'rate_limit'
};

/**
 * Memory-based rate limiter for development and fallback
 */
class MemoryRateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();

  async checkLimit(
    identifier: string, 
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `${config.keyPrefix || DEFAULT_CONFIG.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean expired entries
    for (const [k, v] of this.store.entries()) {
      if (v.resetTime < now) {
        this.store.delete(k);
      }
    }

    let entry = this.store.get(key);
    
    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      entry = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    const allowed = entry.count < config.maxRequests;
    
    if (allowed) {
      entry.count++;
      this.store.set(key, entry);
    }

    const remaining = Math.max(0, config.maxRequests - entry.count);
    const retryAfter = allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000);

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
      retryAfter
    };
  }
}

/**
 * Redis-based rate limiter for production
 */
class RedisRateLimiter {
  constructor(private redis: any) {}

  async checkLimit(
    identifier: string, 
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `${config.keyPrefix || DEFAULT_CONFIG.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Remove old entries
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      
      // Count current entries
      pipeline.zcard(key);
      
      // Add current request
      pipeline.zadd(key, now, now);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(config.windowMs / 1000));
      
      const results = await pipeline.exec();
      const currentCount = results[1][1] as number;

      const allowed = currentCount < config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - (currentCount + 1));
      const resetTime = now + config.windowMs;
      const retryAfter = allowed ? undefined : Math.ceil(config.windowMs / 1000);

      // If not allowed, remove the request we just added
      if (!allowed) {
        await this.redis.zrem(key, now);
      }

      return {
        allowed,
        remaining,
        resetTime,
        retryAfter
      };
    } catch (error) {
      console.error('Redis rate limiter error:', error);
      // Fallback to allowing the request
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: now + config.windowMs
      };
    }
  }
}

/**
 * Extract IP address from request with proper proxy header handling
 */
export function extractClientIP(request: Request): string {
  // Check Cloudflare headers first
  let ip = request.headers.get('CF-Connecting-IP') ||
           request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
           request.headers.get('X-Real-IP') ||
           '127.0.0.1';

  // Handle IPv6 mapped IPv4 addresses
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return ip;
}

/**
 * Create rate limiter instance
 */
export class RateLimiter {
  private limiter: MemoryRateLimiter | RedisRateLimiter;

  constructor(redis?: any) {
    this.limiter = redis ? new RedisRateLimiter(redis) : new MemoryRateLimiter();
  }

  /**
   * Check if request is within rate limits
   */
  async checkLimit(
    identifier: string,
    config: Partial<RateLimitConfig> = {}
  ): Promise<RateLimitResult> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    return this.limiter.checkLimit(identifier, fullConfig);
  }

  /**
   * Check rate limit for a request
   */
  async checkRequest(
    request: Request,
    config: Partial<RateLimitConfig> = {}
  ): Promise<RateLimitResult> {
    const ip = extractClientIP(request);
    return this.checkLimit(ip, config);
  }

  /**
   * Create rate limit response headers
   */
  createHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(result.remaining + (result.allowed ? 0 : 1)),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.floor(result.resetTime / 1000))
    };

    if (result.retryAfter) {
      headers['Retry-After'] = String(result.retryAfter);
    }

    return headers;
  }
}

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
  // Public browsing - generous limits for normal browsing
  public: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100, // 100 requests per hour
    keyPrefix: 'public'
  },
  
  // Search endpoints - more restrictive to prevent scraping
  search: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50, // 50 searches per hour
    keyPrefix: 'search'
  },
  
  // Individual pitch viewing - balanced limits
  pitchDetail: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 200, // 200 pitch views per hour
    keyPrefix: 'pitch_detail'
  },

  // Trending/featured endpoints - cached so can be more generous
  cached: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 300, // 300 requests per hour
    keyPrefix: 'cached'
  }
};

/**
 * Middleware helper for rate limiting
 */
export async function applyRateLimit(
  request: Request,
  rateLimiter: RateLimiter,
  config: keyof typeof RATE_LIMIT_CONFIGS = 'public'
): Promise<Response | null> {
  const result = await rateLimiter.checkRequest(request, RATE_LIMIT_CONFIGS[config]);
  
  if (!result.allowed) {
    const headers = rateLimiter.createHeaders(result);
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }
    );
  }

  return null; // No rate limit hit, proceed with request
}