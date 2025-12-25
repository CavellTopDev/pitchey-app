/**
 * Rate Limiting Middleware for Cloudflare Free Tier
 * Essential to prevent abuse within 100k requests/day limit
 */

export interface RateLimitConfig {
  limit: number; // Max requests per window
  window: number; // Time window in seconds
  keyGenerator?: (request: Request) => string; // Custom key generator
  skipRateLimit?: (request: Request) => boolean; // Skip certain requests
}

/**
 * Default key generator based on IP address
 */
function defaultKeyGenerator(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown';
}

/**
 * Rate limit middleware
 */
export async function rateLimit(
  request: Request,
  env: any,
  config: RateLimitConfig = { limit: 10, window: 60 }
): Promise<Response | null> {
  // Skip rate limiting if configured
  if (config.skipRateLimit && config.skipRateLimit(request)) {
    return null;
  }
  
  const kv = env.KV || env.RATE_LIMIT_KV;
  if (!kv) {
    // No KV available, can't rate limit
    console.warn('Rate limiting disabled: No KV namespace available');
    return null;
  }
  
  const keyGen = config.keyGenerator || defaultKeyGenerator;
  const identifier = keyGen(request);
  const windowId = Math.floor(Date.now() / 1000 / config.window);
  const key = `ratelimit:${identifier}:${windowId}`;
  
  try {
    // Get current count
    const current = await kv.get(key);
    const count = current ? parseInt(current, 10) : 0;
    
    // Check if limit exceeded
    if (count >= config.limit) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Please slow down your requests',
          retryAfter: config.window
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(config.window),
            'X-RateLimit-Limit': String(config.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String((windowId + 1) * config.window)
          }
        }
      );
    }
    
    // Increment counter
    await kv.put(key, String(count + 1), {
      expirationTtl: config.window
    });
    
    // Return null to continue processing
    return null;
  } catch (error) {
    console.error('Rate limit error:', error);
    // On error, allow request to proceed
    return null;
  }
}

/**
 * Different rate limit configurations for various endpoints
 */
export const RATE_LIMIT_CONFIGS = {
  // Relaxed limits for auth (was too strict)
  auth: {
    limit: 20,
    window: 60, // 20 requests per minute (allows multiple login attempts)
    keyGenerator: (req: Request) => {
      const ip = defaultKeyGenerator(req);
      return `auth:${ip}`;
    }
  },
  
  // Increased limits for API calls
  api: {
    limit: 100,
    window: 60, // 100 requests per minute
    keyGenerator: (req: Request) => {
      const ip = defaultKeyGenerator(req);
      const userId = req.headers.get('X-User-Id') || 'anon';
      return `api:${ip}:${userId}`;
    }
  },
  
  // Relaxed limits for static content
  static: {
    limit: 200,
    window: 60, // 200 requests per minute
    skipRateLimit: (req: Request) => {
      // Skip rate limiting for cached responses
      return req.headers.get('Cache-Control')?.includes('max-age') || false;
    }
  },
  
  // Reasonable limits for file uploads
  upload: {
    limit: 10,
    window: 300, // 10 uploads per 5 minutes
    keyGenerator: (req: Request) => {
      const userId = req.headers.get('X-User-Id') || 'anon';
      return `upload:${userId}`;
    }
  },
  
  // Polling endpoints (more relaxed)
  polling: {
    limit: 120,
    window: 60, // 2 requests per second average
    keyGenerator: (req: Request) => {
      const userId = req.headers.get('X-User-Id') || 'anon';
      return `poll:${userId}`;
    }
  },
  
  // Search endpoints
  search: {
    limit: 20,
    window: 60, // 20 searches per minute
    keyGenerator: (req: Request) => {
      const ip = defaultKeyGenerator(req);
      return `search:${ip}`;
    }
  },
  
  // Strict limits for sensitive operations (investment/NDA)
  strict: {
    limit: 50,
    window: 60, // 50 requests per minute
    keyGenerator: (req: Request) => {
      const ip = defaultKeyGenerator(req);
      const userId = req.headers.get('X-User-Id') || 'anon';
      return `strict:${ip}:${userId}`;
    }
  }
};

/**
 * Middleware wrapper for rate limiting
 */
export function withRateLimit(
  handler: (request: Request, env: any) => Promise<Response>,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.api
) {
  return async function(request: Request, env: any): Promise<Response> {
    // Check rate limit
    const rateLimitResponse = await rateLimit(request, env, config);
    
    // Return rate limit error if exceeded
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Proceed with handler
    const response = await handler(request, env);
    
    // Add rate limit headers to response
    const keyGen = config.keyGenerator || defaultKeyGenerator;
    const identifier = keyGen(request);
    const windowId = Math.floor(Date.now() / 1000 / config.window);
    const key = `ratelimit:${identifier}:${windowId}`;
    
    try {
      const current = await env.KV?.get(key);
      const count = current ? parseInt(current, 10) : 1;
      
      response.headers.set('X-RateLimit-Limit', String(config.limit));
      response.headers.set('X-RateLimit-Remaining', String(Math.max(0, config.limit - count)));
      response.headers.set('X-RateLimit-Reset', String((windowId + 1) * config.window));
    } catch (error) {
      // Ignore errors when setting headers
    }
    
    return response;
  };
}

/**
 * Global rate limit tracker for monitoring
 */
export async function getRateLimitStats(env: any, identifier: string): Promise<any> {
  const kv = env.KV;
  if (!kv) return null;
  
  const stats = {
    auth: 0,
    api: 0,
    upload: 0,
    search: 0,
    total: 0
  };
  
  const windowId = Math.floor(Date.now() / 1000 / 60); // Current minute
  
  try {
    // Get counts for different categories
    const keys = [
      `ratelimit:auth:${identifier}:${windowId}`,
      `ratelimit:api:${identifier}:${windowId}`,
      `ratelimit:upload:${identifier}:${windowId}`,
      `ratelimit:search:${identifier}:${windowId}`
    ];
    
    const results = await Promise.all(
      keys.map(key => kv.get(key))
    );
    
    stats.auth = results[0] ? parseInt(results[0], 10) : 0;
    stats.api = results[1] ? parseInt(results[1], 10) : 0;
    stats.upload = results[2] ? parseInt(results[2], 10) : 0;
    stats.search = results[3] ? parseInt(results[3], 10) : 0;
    stats.total = stats.auth + stats.api + stats.upload + stats.search;
    
    return stats;
  } catch (error) {
    console.error('Failed to get rate limit stats:', error);
    return stats;
  }
}