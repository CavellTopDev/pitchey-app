import { Context, Next } from "https://deno.land/x/oak@v17.1.5/mod.ts";
import { compress } from "https://deno.land/x/oak_compress@v0.0.2/mod.ts";

/**
 * Performance Middleware for Deno/Oak server
 * 
 * Features:
 * - Response compression (gzip, brotli)
 * - Caching headers
 * - Performance timing
 * - Request/Response logging
 */

// Cache durations in seconds
export const CACHE_DURATIONS = {
  API_PUBLIC: 300,        // 5 minutes for public API data
  API_PRIVATE: 0,         // No cache for private data
  STATIC_ASSETS: 31536000, // 1 year for static assets
  IMAGES: 2592000,        // 30 days for images
  DEFAULT: 3600,          // 1 hour default
};

/**
 * Compression middleware
 */
export const compressionMiddleware = compress({
  gzip: true,
  br: true,
  threshold: 1024, // Only compress responses larger than 1kb
});

/**
 * Performance timing middleware
 */
export const performanceMiddleware = async (ctx: Context, next: Next) => {
  const start = performance.now();
  const requestId = crypto.randomUUID();
  
  // Add request ID to context
  ctx.state.requestId = requestId;
  
  // Log request
  if (Deno.env.get("LOG_LEVEL") === "debug") {
    console.log(`[${requestId}] ${ctx.request.method} ${ctx.request.url.pathname}`);
  }
  
  try {
    await next();
  } finally {
    const duration = performance.now() - start;
    
    // Add performance headers
    ctx.response.headers.set("X-Response-Time", `${duration.toFixed(2)}ms`);
    ctx.response.headers.set("X-Request-Id", requestId);
    
    // Log response
    if (Deno.env.get("LOG_LEVEL") === "debug") {
      console.log(
        `[${requestId}] ${ctx.response.status} - ${duration.toFixed(2)}ms`
      );
    }
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(
        `[SLOW REQUEST] ${ctx.request.method} ${ctx.request.url.pathname} took ${duration.toFixed(2)}ms`
      );
    }
  }
};

/**
 * Caching middleware
 */
export const cacheMiddleware = async (ctx: Context, next: Next) => {
  await next();
  
  // Skip caching for non-successful responses
  if (ctx.response.status !== 200) return;
  
  const path = ctx.request.url.pathname;
  
  // Determine cache duration based on path
  let cacheDuration = 0;
  
  if (path.startsWith("/api/public/")) {
    cacheDuration = CACHE_DURATIONS.API_PUBLIC;
  } else if (path.startsWith("/api/") && ctx.state.user) {
    cacheDuration = CACHE_DURATIONS.API_PRIVATE;
  } else if (path.match(/\.(js|css|woff2?|ttf|otf)$/)) {
    cacheDuration = CACHE_DURATIONS.STATIC_ASSETS;
  } else if (path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
    cacheDuration = CACHE_DURATIONS.IMAGES;
  }
  
  if (cacheDuration > 0) {
    ctx.response.headers.set(
      "Cache-Control",
      `public, max-age=${cacheDuration}, immutable`
    );
  } else {
    ctx.response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );
  }
  
  // Add ETag for cache validation
  if (ctx.response.body && cacheDuration > 0) {
    const bodyText = typeof ctx.response.body === "string" 
      ? ctx.response.body 
      : JSON.stringify(ctx.response.body);
    
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(bodyText)
    );
    const etag = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    
    ctx.response.headers.set("ETag", `"${etag}"`);
    
    // Check if client has valid cache
    const ifNoneMatch = ctx.request.headers.get("If-None-Match");
    if (ifNoneMatch === `"${etag}"`) {
      ctx.response.status = 304;
      ctx.response.body = null;
    }
  }
};

/**
 * CORS middleware with performance considerations
 */
export const corsMiddleware = async (ctx: Context, next: Next) => {
  const origin = ctx.request.headers.get("Origin");
  
  // Set CORS headers
  if (origin) {
    ctx.response.headers.set("Access-Control-Allow-Origin", origin);
    ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  
  ctx.response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  
  ctx.response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  
  ctx.response.headers.set(
    "Access-Control-Max-Age",
    "86400" // Cache preflight for 24 hours
  );
  
  // Handle preflight requests
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  
  await next();
};

/**
 * Security headers middleware
 */
export const securityMiddleware = async (ctx: Context, next: Next) => {
  await next();
  
  // Add security headers
  ctx.response.headers.set("X-Content-Type-Options", "nosniff");
  ctx.response.headers.set("X-Frame-Options", "SAMEORIGIN");
  ctx.response.headers.set("X-XSS-Protection", "1; mode=block");
  ctx.response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  ctx.response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );
  
  // Content Security Policy
  if (!ctx.request.url.pathname.startsWith("/api/")) {
    ctx.response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:;"
    );
  }
};

/**
 * Rate limiting with sliding window
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = (
  maxRequests: number = 100,
  windowMs: number = 60000
) => {
  return async (ctx: Context, next: Next) => {
    const identifier = ctx.request.ip || "unknown";
    const now = Date.now();
    
    let rateLimit = rateLimitMap.get(identifier);
    
    if (!rateLimit || now > rateLimit.resetTime) {
      rateLimit = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitMap.set(identifier, rateLimit);
    }
    
    rateLimit.count++;
    
    // Add rate limit headers
    ctx.response.headers.set("X-RateLimit-Limit", maxRequests.toString());
    ctx.response.headers.set(
      "X-RateLimit-Remaining",
      Math.max(0, maxRequests - rateLimit.count).toString()
    );
    ctx.response.headers.set(
      "X-RateLimit-Reset",
      new Date(rateLimit.resetTime).toISOString()
    );
    
    if (rateLimit.count > maxRequests) {
      ctx.response.status = 429;
      ctx.response.body = {
        error: "Too Many Requests",
        retryAfter: Math.ceil((rateLimit.resetTime - now) / 1000),
      };
      return;
    }
    
    await next();
  };
};

/**
 * Response optimization middleware
 */
export const responseOptimizationMiddleware = async (ctx: Context, next: Next) => {
  await next();
  
  // Optimize JSON responses
  if (
    ctx.response.body &&
    typeof ctx.response.body === "object" &&
    !ctx.response.headers.has("Content-Type")
  ) {
    ctx.response.headers.set("Content-Type", "application/json; charset=utf-8");
    
    // Minify JSON in production
    if (Deno.env.get("NODE_ENV") === "production") {
      ctx.response.body = JSON.stringify(ctx.response.body);
    } else {
      ctx.response.body = JSON.stringify(ctx.response.body, null, 2);
    }
  }
  
  // Add Vary header for proper caching
  if (!ctx.response.headers.has("Vary")) {
    ctx.response.headers.set("Vary", "Accept-Encoding, Origin");
  }
};

/**
 * Memory cache for expensive operations
 */
export class MemoryCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  private cleanupInterval: number;
  
  constructor(cleanupIntervalMs: number = 60000) {
    // Cleanup expired entries periodically
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (value.expiry < now) {
          this.cache.delete(key);
        }
      }
    }, cleanupIntervalMs);
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: any, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Export a singleton cache instance
export const memoryCache = new MemoryCache();

/**
 * Database query caching middleware
 */
export const dbCacheMiddleware = (cache: MemoryCache, ttlMs: number = 5000) => {
  return async (ctx: Context, next: Next) => {
    // Only cache GET requests
    if (ctx.request.method !== "GET") {
      await next();
      return;
    }
    
    const cacheKey = `db:${ctx.request.url.pathname}:${ctx.request.url.search}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      ctx.response.headers.set("X-Cache", "HIT");
      ctx.response.body = cachedData;
      return;
    }
    
    // Store original send function
    const originalBody = ctx.response.body;
    
    await next();
    
    // Cache successful responses
    if (ctx.response.status === 200 && ctx.response.body) {
      cache.set(cacheKey, ctx.response.body, ttlMs);
      ctx.response.headers.set("X-Cache", "MISS");
    }
  };
};

export default {
  compressionMiddleware,
  performanceMiddleware,
  cacheMiddleware,
  corsMiddleware,
  securityMiddleware,
  rateLimitMiddleware,
  responseOptimizationMiddleware,
  dbCacheMiddleware,
  MemoryCache,
  memoryCache,
};