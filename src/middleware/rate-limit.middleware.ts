// Rate limiting middleware to prevent abuse and DDoS attacks
// Implements token bucket algorithm with sliding window

import { securityConfig } from "../config/security.config.ts";

// Store for rate limit tracking
// In production, use Redis or similar distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  attempts: number[];
  blocked: boolean;
  blockExpiry?: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  blockDuration?: number; // How long to block after exceeding limits
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries older than 1 hour
    if (now - entry.lastRefill > 3600000) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Run every minute

// Generate rate limit key from request
function generateKey(req: Request): string {
  // Use IP address as key (with fallback to a header for proxied requests)
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  const url = new URL(req.url);
  
  // Include path in key to have separate limits per endpoint
  return `${ip}:${url.pathname}`;
}

// Get client IP for logging
function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  return forwarded?.split(",")[0].trim() || realIp || "unknown";
}

// Rate limiting middleware factory
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = "Too many requests, please try again later",
    keyGenerator = generateKey,
    skipSuccessfulRequests = false,
    blockDuration = windowMs * 2, // Default: block for 2x the window duration
  } = options;

  return async function rateLimitMiddleware(
    req: Request,
    next: () => Promise<Response>
  ): Promise<Response> {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    
    if (!entry) {
      entry = {
        tokens: maxRequests,
        lastRefill: now,
        attempts: [],
        blocked: false,
      };
      rateLimitStore.set(key, entry);
    }
    
    // Check if client is blocked
    if (entry.blocked && entry.blockExpiry && entry.blockExpiry > now) {
      const retryAfter = Math.ceil((entry.blockExpiry - now) / 1000);
      
      // Log potential abuse
      console.warn(`[RATE_LIMIT] Blocked request from ${getClientIp(req)} to ${req.url}`);
      
      return new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: `You have been temporarily blocked. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(entry.blockExpiry).toISOString(),
          },
        }
      );
    }
    
    // Clean old attempts outside the window
    entry.attempts = entry.attempts.filter(timestamp => now - timestamp < windowMs);
    
    // Refill tokens if needed (token bucket algorithm)
    const timeSinceLastRefill = now - entry.lastRefill;
    if (timeSinceLastRefill >= windowMs) {
      entry.tokens = maxRequests;
      entry.lastRefill = now;
      entry.attempts = [];
      entry.blocked = false;
      entry.blockExpiry = undefined;
    } else {
      // Partial refill based on time elapsed
      const refillRate = maxRequests / windowMs;
      const tokensToAdd = Math.floor(timeSinceLastRefill * refillRate);
      entry.tokens = Math.min(maxRequests, entry.tokens + tokensToAdd);
      if (tokensToAdd > 0) {
        entry.lastRefill = now;
      }
    }
    
    // Check if request exceeds rate limit
    if (entry.attempts.length >= maxRequests || entry.tokens <= 0) {
      // Block the client
      entry.blocked = true;
      entry.blockExpiry = now + blockDuration;
      
      const retryAfter = Math.ceil(blockDuration / 1000);
      
      // Log rate limit violation
      console.warn(
        `[RATE_LIMIT] Rate limit exceeded for ${getClientIp(req)} ` +
        `on ${req.url} (${entry.attempts.length} attempts in ${windowMs}ms)`
      );
      
      return new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message,
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(now + windowMs).toISOString(),
          },
        }
      );
    }
    
    // Consume a token
    entry.tokens--;
    entry.attempts.push(now);
    
    // Process the request
    const response = await next();
    
    // Optionally don't count successful requests
    if (skipSuccessfulRequests && response.status < 400) {
      entry.tokens++;
      entry.attempts.pop();
    }
    
    // Add rate limit headers to response
    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Limit", maxRequests.toString());
    headers.set("X-RateLimit-Remaining", Math.max(0, entry.tokens).toString());
    headers.set("X-RateLimit-Reset", new Date(entry.lastRefill + windowMs).toISOString());
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

// Pre-configured rate limiters for different endpoint types
export const rateLimiters = {
  // Authentication endpoints - very strict
  auth: createRateLimiter({
    ...securityConfig.rateLimit.auth,
    blockDuration: 15 * 60 * 1000, // Block for 15 minutes after exceeding
  }),
  
  // Password reset - extremely strict
  passwordReset: createRateLimiter({
    ...securityConfig.rateLimit.passwordReset,
    blockDuration: 60 * 60 * 1000, // Block for 1 hour
  }),
  
  // General API endpoints
  api: createRateLimiter(securityConfig.rateLimit.api),
  
  // File upload endpoints
  upload: createRateLimiter({
    ...securityConfig.rateLimit.upload,
    blockDuration: 30 * 60 * 1000, // Block for 30 minutes
  }),
  
  // Custom rate limiter for specific needs
  custom: (options: Partial<RateLimitOptions>) => createRateLimiter({
    windowMs: 60000,
    maxRequests: 100,
    ...options,
  }),
};

// IP-based blocking for severe violations
const blockedIPs = new Set<string>();
const ipViolations = new Map<string, number>();

export function blockIP(ip: string, duration: number = 24 * 60 * 60 * 1000) {
  blockedIPs.add(ip);
  setTimeout(() => blockedIPs.delete(ip), duration);
  console.error(`[SECURITY] IP ${ip} has been blocked for ${duration / 1000} seconds`);
}

export function isIPBlocked(req: Request): boolean {
  const ip = getClientIp(req);
  return blockedIPs.has(ip);
}

// Track violations and auto-block repeat offenders
export function trackViolation(req: Request, type: string = "general") {
  const ip = getClientIp(req);
  const key = `${ip}:${type}`;
  
  const count = (ipViolations.get(key) || 0) + 1;
  ipViolations.set(key, count);
  
  // Auto-block after 10 violations
  if (count >= 10) {
    blockIP(ip, 24 * 60 * 60 * 1000); // Block for 24 hours
    ipViolations.delete(key);
  }
  
  // Clear violations after 1 hour
  setTimeout(() => {
    const currentCount = ipViolations.get(key);
    if (currentCount === count) {
      ipViolations.delete(key);
    }
  }, 60 * 60 * 1000);
}

// Middleware to check for blocked IPs
export async function ipBlockMiddleware(
  req: Request,
  next: () => Promise<Response>
): Promise<Response> {
  if (isIPBlocked(req)) {
    console.warn(`[SECURITY] Blocked IP ${getClientIp(req)} attempted to access ${req.url}`);
    return new Response(
      JSON.stringify({
        error: "Forbidden",
        message: "Your IP address has been temporarily blocked due to suspicious activity",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  
  return next();
}