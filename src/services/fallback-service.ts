/**
 * Fallback Service for Free Tier Limit Management
 * Provides graceful degradation when approaching or exceeding limits
 */

import { getCorsHeaders } from '../utils/response';

export interface FallbackConfig {
  enableStaticFallback?: boolean;
  enableQueueing?: boolean;
  enableCacheFallback?: boolean;
  maxQueueSize?: number;
}

export class FallbackService {
  private kv: KVNamespace;
  private config: FallbackConfig;
  private staticResponses: Map<string, any>;

  constructor(kv: KVNamespace, config: FallbackConfig = {}) {
    this.kv = kv;
    this.config = {
      enableStaticFallback: true,
      enableQueueing: true,
      enableCacheFallback: true,
      maxQueueSize: 100,
      ...config
    };
    
    // Pre-defined static responses for common endpoints
    this.staticResponses = new Map([
      ['/api/health', { status: 'ok', message: 'Service operational (static response)' }],
      ['/api/browse', { pitches: [], message: 'Browse temporarily unavailable. Please try again later.' }],
      ['/api/dashboard', { 
        stats: {
          views: 0,
          pitches: 0,
          messages: 0
        },
        message: 'Dashboard data temporarily cached'
      }],
      ['/api/notifications', { notifications: [], unread: 0 }]
    ]);
  }

  /**
   * Get fallback response for an endpoint
   */
  async getFallbackResponse(request: Request, reason: string): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Try cache fallback first
    if (this.config.enableCacheFallback) {
      const cachedResponse = await this.getCachedFallback(pathname);
      if (cachedResponse) {
        return new Response(JSON.stringify({
          ...cachedResponse,
          _fallback: true,
          _reason: reason
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Fallback': 'cache',
            'X-Fallback-Reason': reason,
            ...getCorsHeaders(request.headers.get('Origin'))
          }
        });
      }
    }

    // Try static fallback
    if (this.config.enableStaticFallback) {
      const staticResponse = this.getStaticFallback(pathname);
      if (staticResponse) {
        return new Response(JSON.stringify({
          ...staticResponse,
          _fallback: true,
          _reason: reason
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Fallback': 'static',
            'X-Fallback-Reason': reason,
            ...getCorsHeaders(request.headers.get('Origin'))
          }
        });
      }
    }

    // Queue the request for later processing
    if (this.config.enableQueueing && request.method === 'POST') {
      const queued = await this.queueRequest(request);
      if (queued) {
        return new Response(JSON.stringify({
          message: 'Request queued for processing',
          queueId: queued,
          _fallback: true,
          _reason: reason
        }), {
          status: 202, // Accepted
          headers: {
            'Content-Type': 'application/json',
            'X-Fallback': 'queued',
            'X-Fallback-Reason': reason,
            ...getCorsHeaders(request.headers.get('Origin'))
          }
        });
      }
    }

    // Default fallback response
    return new Response(JSON.stringify({
      error: 'Service temporarily unavailable',
      message: 'We are experiencing high traffic. Please try again in a few minutes.',
      _reason: reason
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        'X-Fallback': 'default',
        'X-Fallback-Reason': reason,
        ...getCorsHeaders(request.headers.get('Origin'))
      }
    });
  }

  /**
   * Get cached fallback data
   */
  private async getCachedFallback(pathname: string): Promise<any | null> {
    try {
      // Look for any cached version, even if expired
      const cacheKey = `fallback:${pathname}`;
      const cached = await this.kv.get(cacheKey, 'json');
      
      if (cached) {
        return cached;
      }

      // Try to get from regular cache
      const regularCacheKey = `cache:GET:${pathname}:anon`;
      const regularCached = await this.kv.get(regularCacheKey, 'json');
      
      if (regularCached && regularCached.body) {
        const data = JSON.parse(regularCached.body);
        // Store in fallback cache for next time
        await this.kv.put(cacheKey, JSON.stringify(data), {
          expirationTtl: 3600 // Keep fallback for 1 hour
        });
        return data;
      }
    } catch (error) {
      console.error('Fallback cache error:', error);
    }
    
    return null;
  }

  /**
   * Get static fallback response
   */
  private getStaticFallback(pathname: string): any | null {
    // Direct match
    if (this.staticResponses.has(pathname)) {
      return this.staticResponses.get(pathname);
    }

    // Pattern matching
    if (pathname.startsWith('/api/pitches/')) {
      return {
        id: 'static',
        title: 'Pitch data temporarily unavailable',
        message: 'Please refresh the page in a moment'
      };
    }

    if (pathname.startsWith('/api/users/')) {
      return {
        id: 'static',
        name: 'User',
        email: 'loading@pitchey.com'
      };
    }

    return null;
  }

  /**
   * Queue request for later processing
   */
  private async queueRequest(request: Request): Promise<string | null> {
    try {
      const queueSizeKey = 'queue:size';
      const currentSize = parseInt(await this.kv.get(queueSizeKey) || '0');
      
      if (currentSize >= this.config.maxQueueSize!) {
        return null; // Queue is full
      }

      const queueId = `queue:${Date.now()}:${Math.random().toString(36).substring(7)}`;
      const requestData = {
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        body: await request.text(),
        timestamp: Date.now()
      };

      await this.kv.put(queueId, JSON.stringify(requestData), {
        expirationTtl: 300 // Keep queued requests for 5 minutes
      });

      await this.kv.put(queueSizeKey, String(currentSize + 1), {
        expirationTtl: 300
      });

      return queueId;
    } catch (error) {
      console.error('Queue error:', error);
      return null;
    }
  }

  /**
   * Process queued requests (called when capacity is available)
   */
  async processQueue(limit: number = 10): Promise<number> {
    let processed = 0;
    
    try {
      // Get queue keys (this is a limitation - KV doesn't support listing)
      // In production, you'd need a different approach
      const queuePattern = 'queue:';
      
      // Process up to 'limit' requests
      // Note: This is simplified - real implementation would need better queue management
      
      processed = 0; // Placeholder
    } catch (error) {
      console.error('Queue processing error:', error);
    }
    
    return processed;
  }

  /**
   * Adaptive response based on current load
   */
  async getAdaptiveResponse(
    request: Request,
    currentLoad: number,
    maxLoad: number
  ): Promise<Response | null> {
    const loadPercentage = (currentLoad / maxLoad) * 100;
    
    // Normal operation
    if (loadPercentage < 70) {
      return null; // Process normally
    }
    
    // Start degrading non-essential features
    if (loadPercentage < 85) {
      const url = new URL(request.url);
      const nonEssential = [
        '/api/analytics',
        '/api/search/autocomplete',
        '/api/trending',
        '/api/recommendations'
      ];
      
      if (nonEssential.some(path => url.pathname.startsWith(path))) {
        return this.getFallbackResponse(request, 'load-shedding');
      }
    }
    
    // Heavy degradation
    if (loadPercentage < 95) {
      const url = new URL(request.url);
      const essential = [
        '/api/auth',
        '/api/health',
        '/api/profile'
      ];
      
      if (!essential.some(path => url.pathname.startsWith(path))) {
        return this.getFallbackResponse(request, 'high-load');
      }
    }
    
    // Circuit breaker - only allow critical endpoints
    return this.getFallbackResponse(request, 'circuit-breaker');
  }
}

/**
 * Fallback middleware
 */
export function withFallback(
  handler: (request: Request, env: any) => Promise<Response>,
  fallbackService: FallbackService
) {
  return async function(request: Request, env: any): Promise<Response> {
    try {
      // Try to execute the handler
      const response = await handler(request, env);
      
      // If successful, cache for fallback
      if (response.status === 200) {
        const url = new URL(request.url);
        const cacheKey = `fallback:${url.pathname}`;
        const clonedResponse = response.clone();
        const body = await clonedResponse.text();
        
        // Store successful response for fallback use
        env.KV?.put(cacheKey, body, {
          expirationTtl: 3600
        });
      }
      
      return response;
    } catch (error: any) {
      // Check if error is due to limits
      if (error.message?.includes('CPU limit') || 
          error.message?.includes('rate limit') ||
          error.message?.includes('quota exceeded')) {
        return fallbackService.getFallbackResponse(request, error.message);
      }
      
      // Re-throw other errors
      throw error;
    }
  };
}