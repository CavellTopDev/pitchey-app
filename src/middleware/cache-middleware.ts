/**
 * Cache Middleware for Cloudflare Workers
 * Implements intelligent caching strategies with edge optimization
 */

import { CacheManager } from '../services/cache-manager';

export interface CacheMiddlewareConfig {
  enabled: boolean;
  defaultTTL: number;
  varyHeaders: string[];
  bypassHeaders: string[];
  cacheableStatusCodes: number[];
}

export interface CacheRule {
  pattern: RegExp;
  ttl: number;
  varyBy?: string[];
  condition?: (request: Request) => boolean;
  transform?: (response: Response) => Response;
}

/**
 * Cache key strategies
 */
export class CacheKeyBuilder {
  static build(request: Request, varyBy: string[] = []): string {
    const url = new URL(request.url);
    const parts: string[] = [
      request.method,
      url.hostname,
      url.pathname
    ];

    // Add query parameters
    const params = Array.from(url.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    
    if (params.length > 0) {
      parts.push(params.map(([k, v]) => `${k}=${v}`).join('&'));
    }

    // Add vary headers
    for (const header of varyBy) {
      const value = request.headers.get(header);
      if (value) {
        parts.push(`${header}:${value}`);
      }
    }

    return parts.join(':');
  }

  static buildWithUser(request: Request, userId: string): string {
    const baseKey = this.build(request);
    return `${baseKey}:user:${userId}`;
  }

  static buildWithPortal(request: Request, portal: string): string {
    const baseKey = this.build(request);
    return `${baseKey}:portal:${portal}`;
  }
}

/**
 * Cache middleware implementation
 */
export class CacheMiddleware {
  private cache: CacheManager;
  private config: CacheMiddlewareConfig;
  private rules: CacheRule[];

  constructor(cache: CacheManager, config?: Partial<CacheMiddlewareConfig>) {
    this.cache = cache;
    this.config = {
      enabled: true,
      defaultTTL: 300, // 5 minutes
      varyHeaders: ['Accept', 'Accept-Language'],
      bypassHeaders: ['Cache-Control', 'Pragma'],
      cacheableStatusCodes: [200, 203, 204, 206, 300, 301, 404],
      ...config
    };

    this.rules = this.initializeRules();
  }

  /**
   * Initialize caching rules for different endpoints
   */
  private initializeRules(): CacheRule[] {
    return [
      // Static assets - long cache
      {
        pattern: /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/,
        ttl: 86400 * 7, // 7 days
      },
      
      // Public API endpoints
      {
        pattern: /^\/api\/browse/,
        ttl: 300, // 5 minutes
        varyBy: ['Accept-Language'],
      },
      
      {
        pattern: /^\/api\/search/,
        ttl: 180, // 3 minutes
        varyBy: ['Accept-Language'],
      },
      
      {
        pattern: /^\/api\/pitches\/[^\/]+$/,
        ttl: 60, // 1 minute for individual pitches
        condition: (req) => req.method === 'GET',
      },
      
      {
        pattern: /^\/api\/pitches$/,
        ttl: 120, // 2 minutes for pitch lists
        condition: (req) => req.method === 'GET',
      },
      
      // Dashboard endpoints - shorter cache
      {
        pattern: /^\/api\/.*\/dashboard$/,
        ttl: 30, // 30 seconds
        varyBy: ['Authorization'],
      },
      
      // User-specific endpoints
      {
        pattern: /^\/api\/users\/profile$/,
        ttl: 60,
        varyBy: ['Authorization'],
      },
      
      // Never cache these
      {
        pattern: /^\/api\/auth/,
        ttl: 0,
      },
      
      {
        pattern: /^\/api\/ndas/,
        ttl: 0, // NDAs should always be fresh
      },
      
      {
        pattern: /^\/api\/investments/,
        ttl: 0, // Financial data should not be cached
      },
    ];
  }

  /**
   * Handle request with caching
   */
  async handle(
    request: Request,
    handler: (request: Request) => Promise<Response>
  ): Promise<Response> {
    // Skip caching if disabled
    if (!this.config.enabled) {
      return handler(request);
    }

    // Skip caching for non-GET requests by default
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return handler(request);
    }

    // Check bypass headers
    if (this.shouldBypass(request)) {
      return handler(request);
    }

    // Find matching rule
    const rule = this.findMatchingRule(request);
    if (!rule || rule.ttl === 0) {
      return handler(request);
    }

    // Check condition
    if (rule.condition && !rule.condition(request)) {
      return handler(request);
    }

    // Build cache key
    const cacheKey = CacheKeyBuilder.build(request, rule.varyBy || this.config.varyHeaders);

    // Try to get from cache
    const cached = await this.cache.get<CachedResponse>(cacheKey);
    if (cached) {
      return this.buildResponse(cached);
    }

    // Execute handler
    const response = await handler(request);

    // Cache if response is cacheable
    if (this.isCacheable(response)) {
      const transformed = rule.transform ? rule.transform(response) : response;
      await this.cacheResponse(cacheKey, transformed, rule.ttl);
    }

    return response;
  }

  /**
   * Invalidate cache for specific patterns
   */
  async invalidate(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      await this.cache.invalidatePattern(pattern);
    }
  }

  /**
   * Edge-side includes (ESI) support
   */
  async processESI(response: Response): Promise<Response> {
    const text = await response.text();
    const processed = await this.replaceESITags(text);
    
    return new Response(processed, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  private async replaceESITags(html: string): Promise<string> {
    const esiRegex = /<esi:include\s+src="([^"]+)"\s*\/>/g;
    const matches = Array.from(html.matchAll(esiRegex));
    
    let result = html;
    for (const match of matches) {
      const [tag, url] = match;
      const fragment = await this.fetchESIFragment(url);
      result = result.replace(tag, fragment);
    }
    
    return result;
  }

  private async fetchESIFragment(url: string): Promise<string> {
    const cacheKey = `esi:${url}`;
    
    // Check cache first
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) return cached;
    
    try {
      const response = await fetch(url);
      const content = await response.text();
      
      // Cache fragment
      await this.cache.set(cacheKey, content, 300);
      
      return content;
    } catch (error) {
      console.error(`ESI fetch failed for ${url}:`, error);
      return '';
    }
  }

  /**
   * Check if request should bypass cache
   */
  private shouldBypass(request: Request): boolean {
    for (const header of this.config.bypassHeaders) {
      const value = request.headers.get(header);
      if (value && (value.includes('no-cache') || value.includes('no-store'))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find matching cache rule
   */
  private findMatchingRule(request: Request): CacheRule | null {
    const url = new URL(request.url);
    const path = url.pathname;
    
    for (const rule of this.rules) {
      if (rule.pattern.test(path)) {
        return rule;
      }
    }
    
    return null;
  }

  /**
   * Check if response is cacheable
   */
  private isCacheable(response: Response): boolean {
    // Check status code
    if (!this.config.cacheableStatusCodes.includes(response.status)) {
      return false;
    }

    // Check cache-control headers
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl) {
      if (cacheControl.includes('no-store') || 
          cacheControl.includes('private')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Cache response
   */
  private async cacheResponse(
    key: string,
    response: Response,
    ttl: number
  ): Promise<void> {
    const cachedResponse: CachedResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.clone().text(),
      timestamp: Date.now()
    };

    await this.cache.set(key, cachedResponse, ttl);
  }

  /**
   * Build response from cached data
   */
  private buildResponse(cached: CachedResponse): Response {
    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    headers.set('X-Cache-Age', String(Math.floor((Date.now() - cached.timestamp) / 1000)));

    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers
    });
  }
}

interface CachedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

/**
 * Stale-while-revalidate implementation
 */
export class StaleWhileRevalidate {
  private cache: CacheManager;
  private revalidating: Set<string>;

  constructor(cache: CacheManager) {
    this.cache = cache;
    this.revalidating = new Set();
  }

  async handle(
    key: string,
    loader: () => Promise<any>,
    options: {
      ttl: number;
      staleTTL: number;
    }
  ): Promise<any> {
    // Try to get from cache
    const cached = await this.cache.get(key);
    
    if (cached) {
      const age = Date.now() - (cached as any).timestamp;
      
      // Fresh - return immediately
      if (age < options.ttl * 1000) {
        return (cached as any).data;
      }
      
      // Stale but still valid
      if (age < options.staleTTL * 1000) {
        // Return stale data
        const staleData = (cached as any).data;
        
        // Revalidate in background if not already doing so
        if (!this.revalidating.has(key)) {
          this.revalidating.add(key);
          this.revalidateInBackground(key, loader, options.ttl).finally(() => {
            this.revalidating.delete(key);
          });
        }
        
        return staleData;
      }
    }
    
    // No cache or too stale - load fresh
    const fresh = await loader();
    await this.cache.set(key, {
      data: fresh,
      timestamp: Date.now()
    }, options.staleTTL);
    
    return fresh;
  }

  private async revalidateInBackground(
    key: string,
    loader: () => Promise<any>,
    ttl: number
  ): Promise<void> {
    try {
      const fresh = await loader();
      await this.cache.set(key, {
        data: fresh,
        timestamp: Date.now()
      }, ttl);
    } catch (error) {
      console.error(`Background revalidation failed for ${key}:`, error);
    }
  }
}