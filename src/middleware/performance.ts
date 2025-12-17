/**
 * Performance Middleware for Cloudflare Workers
 * Adds caching, timing, and optimization features
 */

import { EdgeCache } from '../utils/edge-cache';

export interface PerformanceOptions {
  enableCache: boolean;
  cacheTtl: number;
  enableTiming: boolean;
  enableCompression: boolean;
}

export class PerformanceMiddleware {
  private cache: EdgeCache | null;
  private options: PerformanceOptions;
  private startTime: number;

  constructor(kv?: KVNamespace, options?: Partial<PerformanceOptions>) {
    try {
      this.cache = kv ? new EdgeCache(kv) : null;
    } catch (error) {
      console.warn('EdgeCache initialization failed in PerformanceMiddleware:', error);
      this.cache = null;
    }
    
    this.options = {
      enableCache: !!this.cache && !!kv,
      cacheTtl: 300, // 5 minutes default
      enableTiming: true,
      enableCompression: false, // Disable by default to avoid issues
      ...options
    };
    this.startTime = Date.now();
  }

  /**
   * Wrap response with performance headers
   */
  wrapResponse(response: Response, cacheStatus: 'HIT' | 'MISS' | 'BYPASS' = 'BYPASS'): Response {
    const headers = new Headers(response.headers);
    
    // Add performance headers
    if (this.options.enableTiming) {
      const duration = Date.now() - this.startTime;
      headers.set('X-Response-Time', `${duration}ms`);
    }
    
    headers.set('X-Cache-Status', cacheStatus);
    headers.set('X-Powered-By', 'Cloudflare Workers');
    
    // Add cache control headers for successful responses
    if (response.status === 200 && this.options.enableCache) {
      headers.set('Cache-Control', `public, max-age=60, s-maxage=${this.options.cacheTtl}`);
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  /**
   * Try to get cached response for GET requests
   */
  async getCachedResponse(request: Request): Promise<Response | null> {
    if (!this.cache || !this.options.enableCache) {
      return null;
    }

    // Only cache GET requests
    if (request.method !== 'GET') {
      return null;
    }

    const url = new URL(request.url);
    const cacheKey = url.pathname;
    const params = Object.fromEntries(url.searchParams);

    const cached = await this.cache.get(cacheKey, params);
    if (cached) {
      return this.wrapResponse(
        new Response(JSON.stringify(cached), {
          headers: { 'Content-Type': 'application/json' }
        }),
        'HIT'
      );
    }

    return null;
  }

  /**
   * Cache response for future requests
   */
  async cacheResponse(request: Request, response: Response): Promise<void> {
    if (!this.cache || !this.options.enableCache) {
      return;
    }

    // Only cache successful GET requests
    if (request.method !== 'GET' || response.status !== 200) {
      return;
    }

    try {
      const url = new URL(request.url);
      const cacheKey = url.pathname;
      const params = Object.fromEntries(url.searchParams);
      
      // Clone response to read body
      const cloned = response.clone();
      const body = await cloned.json();
      
      await this.cache.set(cacheKey, body, this.options.cacheTtl, params);
    } catch (error) {
      console.error('Failed to cache response:', error);
    }
  }

  /**
   * Invalidate cache for mutations
   */
  async invalidateCache(pattern: string): Promise<void> {
    if (!this.cache) {
      return;
    }

    await this.cache.invalidatePattern(pattern);
  }

  /**
   * Add retry logic for database operations
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 100
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        console.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const waitTime = delay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Measure and log performance
   */
  logPerformance(operation: string, startTime: number): void {
    if (!this.options.enableTiming) {
      return;
    }

    const duration = Date.now() - startTime;
    console.log(`Performance: ${operation} took ${duration}ms`);
    
    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow operation detected: ${operation} (${duration}ms)`);
    }
  }
}
