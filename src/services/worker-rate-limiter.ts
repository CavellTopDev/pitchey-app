/**
 * Rate Limiter for Cloudflare Workers Free Plan
 * Uses in-memory storage with sliding window algorithm
 */

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  keyPrefix?: string;    // Optional prefix for keys
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skipFailedRequests?: boolean;     // Only count successful requests
}

interface RateLimitEntry {
  requests: number[];    // Timestamps of requests
  blocked: boolean;      // Currently blocked
  blockedUntil?: number; // Block expiry timestamp
}

export class WorkerRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly maxEntries = 10000; // Limit entries to prevent memory issues
  private readonly cleanupInterval = 60000; // Cleanup every minute
  private lastCleanup = Date.now();
  
  // Default configurations for different endpoints (relaxed for better UX)
  private readonly configs: Record<string, RateLimitConfig> = {
    default: {
      windowMs: 60000,     // 1 minute
      maxRequests: 100     // 100 requests per minute
    },
    auth: {
      windowMs: 300000,    // 5 minutes  
      maxRequests: 20,     // 20 auth attempts per 5 min
      skipSuccessfulRequests: true
    },
    upload: {
      windowMs: 3600000,   // 1 hour
      maxRequests: 50      // 50 uploads per hour
    },
    api: {
      windowMs: 60000,     // 1 minute
      maxRequests: 200     // 200 API calls per minute
    },
    strict: {
      windowMs: 60000,     // 1 minute
      maxRequests: 50      // 50 requests per minute (for sensitive operations)
    }
  };
  
  constructor(customConfigs?: Record<string, RateLimitConfig>) {
    if (customConfigs) {
      this.configs = { ...this.configs, ...customConfigs };
    }
  }
  
  /**
   * Check if request should be rate limited
   */
  async checkLimit(
    key: string,
    configName: string = 'default',
    customConfig?: RateLimitConfig
  ): Promise<{ 
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
  }> {
    // Periodic cleanup
    this.cleanupIfNeeded();
    
    const config = customConfig || this.configs[configName] || this.configs.default;
    const fullKey = `${config.keyPrefix || configName}:${key}`;
    const now = Date.now();
    
    // Get or create entry
    let entry = this.limits.get(fullKey);
    if (!entry) {
      entry = { requests: [], blocked: false };
      this.limits.set(fullKey, entry);
    }
    
    // Check if currently blocked
    if (entry.blocked && entry.blockedUntil && entry.blockedUntil > now) {
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetAt: entry.blockedUntil,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000)
      };
    }
    
    // Remove expired requests outside the window
    const windowStart = now - config.windowMs;
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    if (entry.requests.length >= config.maxRequests) {
      // Calculate when the oldest request will expire
      const oldestRequest = entry.requests[0];
      const resetAt = oldestRequest + config.windowMs;
      
      // Block for additional time on repeated violations
      if (!entry.blocked) {
        entry.blocked = true;
        entry.blockedUntil = resetAt + 60000; // Extra minute penalty
      }
      
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000)
      };
    }
    
    // Add current request
    entry.requests.push(now);
    
    // Clear blocked status if under limit
    if (entry.blocked) {
      entry.blocked = false;
      entry.blockedUntil = undefined;
    }
    
    // Calculate remaining
    const remaining = config.maxRequests - entry.requests.length;
    const resetAt = entry.requests[0] ? entry.requests[0] + config.windowMs : now + config.windowMs;
    
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining,
      resetAt
    };
  }
  
  /**
   * Reset rate limit for a key
   */
  reset(key: string, configName: string = 'default'): void {
    const config = this.configs[configName] || this.configs.default;
    const fullKey = `${config.keyPrefix || configName}:${key}`;
    this.limits.delete(fullKey);
  }
  
  /**
   * Get current usage for a key
   */
  getUsage(key: string, configName: string = 'default'): {
    requests: number;
    limit: number;
    windowMs: number;
  } | null {
    const config = this.configs[configName] || this.configs.default;
    const fullKey = `${config.keyPrefix || configName}:${key}`;
    const entry = this.limits.get(fullKey);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const activeRequests = entry.requests.filter(timestamp => timestamp > windowStart);
    
    return {
      requests: activeRequests.length,
      limit: config.maxRequests,
      windowMs: config.windowMs
    };
  }
  
  /**
   * Clean up old entries to prevent memory issues
   */
  private cleanupIfNeeded(): void {
    const now = Date.now();
    
    // Only cleanup periodically
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }
    
    this.lastCleanup = now;
    
    // Remove entries with no recent requests
    for (const [key, entry] of this.limits.entries()) {
      const hasRecentRequests = entry.requests.some(
        timestamp => timestamp > now - 3600000 // Keep entries active in last hour
      );
      
      if (!hasRecentRequests && !entry.blocked) {
        this.limits.delete(key);
      }
    }
    
    // If still too many entries, remove oldest
    if (this.limits.size > this.maxEntries) {
      const entriesToRemove = this.limits.size - this.maxEntries;
      const sortedEntries = Array.from(this.limits.entries())
        .sort((a, b) => {
          const aLatest = Math.max(...a[1].requests, 0);
          const bLatest = Math.max(...b[1].requests, 0);
          return aLatest - bLatest;
        });
      
      for (let i = 0; i < entriesToRemove; i++) {
        this.limits.delete(sortedEntries[i][0]);
      }
    }
  }
  
  /**
   * Get statistics about rate limiter usage
   */
  getStats(): {
    totalEntries: number;
    blockedEntries: number;
    memoryUsage: string;
  } {
    let blockedCount = 0;
    
    for (const entry of this.limits.values()) {
      if (entry.blocked) {
        blockedCount++;
      }
    }
    
    return {
      totalEntries: this.limits.size,
      blockedEntries: blockedCount,
      memoryUsage: `${this.limits.size}/${this.maxEntries} entries`
    };
  }
}

/**
 * Middleware for rate limiting
 */
export function createRateLimitMiddleware(limiter: WorkerRateLimiter) {
  return async function rateLimitMiddleware(
    request: Request,
    configName: string = 'default'
  ): Promise<Response | null> {
    // Extract key from request (IP or user ID)
    const key = extractRateLimitKey(request);
    
    // Check rate limit
    const result = await limiter.checkLimit(key, configName);
    
    // Add rate limit headers to response
    const headers = new Headers({
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetAt).toISOString()
    });
    
    if (!result.allowed) {
      headers.set('Retry-After', result.retryAfter?.toString() || '60');
      
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests, please try again later',
          retryAfter: result.retryAfter
        }
      }), {
        status: 429,
        headers
      });
    }
    
    // Request allowed - return null to continue
    return null;
  };
}

/**
 * Extract rate limit key from request
 */
function extractRateLimitKey(request: Request): string {
  // Try to get authenticated user ID from authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Simple extraction - in production, verify JWT
    const token = authHeader.substring(7);
    if (token.length > 20) {
      // Use first 20 chars of token as key (avoid storing full tokens)
      return `user:${token.substring(0, 20)}`;
    }
  }
  
  // Fall back to IP address
  const cfConnectingIp = request.headers.get('CF-Connecting-IP');
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  const xRealIp = request.headers.get('X-Real-IP');
  
  const ip = cfConnectingIp || 
    (xForwardedFor ? xForwardedFor.split(',')[0].trim() : null) || 
    xRealIp || 
    'unknown';
  
  return `ip:${ip}`;
}

// Singleton instance for worker
let rateLimiterInstance: WorkerRateLimiter | null = null;

/**
 * Get or create rate limiter instance
 */
export function getRateLimiter(): WorkerRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new WorkerRateLimiter();
  }
  return rateLimiterInstance;
}