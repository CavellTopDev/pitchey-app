/**
 * Cache Warming Service
 * Pre-populates cache with critical data to ensure fast response times
 */

import { EdgeCacheLayer } from './worker-cache-layer.ts';
import { Toucan } from 'toucan-js';

export interface CacheWarmingConfig {
  endpoints: WarmingEndpoint[];
  schedule: string; // Cron expression
  parallel: number; // Number of concurrent warming operations
  timeout: number; // Timeout per endpoint in ms
}

export interface WarmingEndpoint {
  name: string;
  url: string;
  priority: number; // 1 = highest priority
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

export class CacheWarmer {
  private isWarming = false;
  private lastWarmTime: Date | null = null;
  private warmingStats = {
    successful: 0,
    failed: 0,
    totalTime: 0,
    endpoints: new Map<string, { success: number; failure: number; avgTime: number }>()
  };

  constructor(
    private cache: EdgeCacheLayer,
    private config: CacheWarmingConfig,
    private sentry?: Toucan
  ) {}

  /**
   * Warm all configured endpoints
   */
  async warmCache(env: any): Promise<WarmingResult> {
    if (this.isWarming) {
      console.log('[CacheWarmer] Already warming, skipping...');
      return {
        success: false,
        message: 'Cache warming already in progress',
        stats: this.getStats()
      };
    }

    this.isWarming = true;
    const startTime = Date.now();
    const results: EndpointWarmingResult[] = [];

    try {
      console.log(`[CacheWarmer] Starting cache warming for ${this.config.endpoints.length} endpoints`);

      // Sort endpoints by priority
      const sortedEndpoints = [...this.config.endpoints].sort((a, b) => a.priority - b.priority);

      // Process in batches based on parallel config
      for (let i = 0; i < sortedEndpoints.length; i += this.config.parallel) {
        const batch = sortedEndpoints.slice(i, i + this.config.parallel);
        const batchResults = await Promise.allSettled(
          batch.map(endpoint => this.warmEndpoint(endpoint, env))
        );

        // Process results
        batchResults.forEach((result, index) => {
          const endpoint = batch[index];
          if (result.status === 'fulfilled') {
            results.push(result.value);
            this.updateStats(endpoint.name, result.value);
          } else {
            results.push({
              endpoint: endpoint.name,
              success: false,
              error: result.reason?.message || 'Unknown error',
              duration: 0
            });
            this.updateStats(endpoint.name, { success: false, duration: 0 });
          }
        });
      }

      const totalTime = Date.now() - startTime;
      this.lastWarmTime = new Date();
      this.warmingStats.totalTime = totalTime;

      const successCount = results.filter(r => r.success).length;
      console.log(`[CacheWarmer] Completed: ${successCount}/${results.length} successful in ${totalTime}ms`);

      return {
        success: true,
        message: `Warmed ${successCount}/${results.length} endpoints`,
        duration: totalTime,
        results,
        stats: this.getStats()
      };

    } catch (error) {
      console.error('[CacheWarmer] Error during cache warming:', error);
      if (this.sentry) {
        this.sentry.captureException(error);
      }

      return {
        success: false,
        message: 'Cache warming failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        stats: this.getStats()
      };

    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm a single endpoint
   */
  private async warmEndpoint(endpoint: WarmingEndpoint, env: any): Promise<EndpointWarmingResult> {
    const startTime = Date.now();

    try {
      // Build URL with params
      const url = new URL(endpoint.url);
      if (endpoint.params) {
        Object.entries(endpoint.params).forEach(([key, value]) => {
          url.searchParams.set(key, String(value));
        });
      }

      // Determine cache key and fetcher based on endpoint
      const cacheKey = this.getCacheKey(endpoint);
      const fetcher = () => this.fetchEndpointData(url.toString(), endpoint.headers);

      // Use cache layer to warm the endpoint
      await this.cache.get(cacheKey, fetcher, { ttl: this.getCacheTTL(endpoint) });

      const duration = Date.now() - startTime;
      console.log(`[CacheWarmer] Warmed ${endpoint.name} in ${duration}ms`);

      return {
        endpoint: endpoint.name,
        success: true,
        duration,
        cached: true
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[CacheWarmer] Failed to warm ${endpoint.name}:`, error);

      return {
        endpoint: endpoint.name,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch data from endpoint
   */
  private async fetchEndpointData(url: string, headers?: Record<string, string>): Promise<any> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Generate cache key for endpoint
   */
  private getCacheKey(endpoint: WarmingEndpoint): string {
    const baseKey = endpoint.name.toLowerCase().replace(/\s+/g, '_');
    
    if (endpoint.params) {
      const paramStr = Object.entries(endpoint.params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(':');
      return `${baseKey}:${paramStr}`;
    }

    return baseKey;
  }

  /**
   * Get cache TTL for endpoint type
   */
  private getCacheTTL(endpoint: WarmingEndpoint): number {
    // Map endpoint names to TTLs
    const ttlMap: Record<string, number> = {
      'trending_pitches': 300,
      'new_releases': 300,
      'public_pitches': 300,
      'featured_creators': 600,
      'popular_genres': 3600,
      'dashboard_stats': 60
    };

    return ttlMap[endpoint.name] || 300; // Default 5 minutes
  }

  /**
   * Update warming statistics
   */
  private updateStats(endpointName: string, result: { success: boolean; duration: number }): void {
    const current = this.warmingStats.endpoints.get(endpointName) || {
      success: 0,
      failure: 0,
      avgTime: 0
    };

    if (result.success) {
      current.success++;
      this.warmingStats.successful++;
    } else {
      current.failure++;
      this.warmingStats.failed++;
    }

    // Update average time
    const totalRequests = current.success + current.failure;
    current.avgTime = ((current.avgTime * (totalRequests - 1)) + result.duration) / totalRequests;

    this.warmingStats.endpoints.set(endpointName, current);
  }

  /**
   * Get warming statistics
   */
  getStats(): WarmingStats {
    return {
      isWarming: this.isWarming,
      lastWarmTime: this.lastWarmTime,
      totalSuccessful: this.warmingStats.successful,
      totalFailed: this.warmingStats.failed,
      averageTime: this.warmingStats.totalTime / (this.warmingStats.successful + this.warmingStats.failed),
      endpoints: Array.from(this.warmingStats.endpoints.entries()).map(([name, stats]) => ({
        name,
        ...stats
      }))
    };
  }

  /**
   * Check if cache needs warming
   */
  shouldWarm(): boolean {
    if (!this.lastWarmTime) return true;

    const timeSinceLastWarm = Date.now() - this.lastWarmTime.getTime();
    const warmingInterval = 5 * 60 * 1000; // 5 minutes

    return timeSinceLastWarm >= warmingInterval;
  }
}

// Types
export interface WarmingResult {
  success: boolean;
  message: string;
  duration?: number;
  results?: EndpointWarmingResult[];
  error?: string;
  stats: WarmingStats;
}

export interface EndpointWarmingResult {
  endpoint: string;
  success: boolean;
  duration: number;
  cached?: boolean;
  error?: string;
}

export interface WarmingStats {
  isWarming: boolean;
  lastWarmTime: Date | null;
  totalSuccessful: number;
  totalFailed: number;
  averageTime: number;
  endpoints: Array<{
    name: string;
    success: number;
    failure: number;
    avgTime: number;
  }>;
}

// Default configuration for critical endpoints
export const DEFAULT_WARMING_CONFIG: CacheWarmingConfig = {
  endpoints: [
    {
      name: 'trending_pitches',
      url: '/api/pitches/trending',
      priority: 1,
      params: { limit: 10 }
    },
    {
      name: 'new_releases',
      url: '/api/pitches/new',
      priority: 1,
      params: { limit: 10 }
    },
    {
      name: 'public_pitches',
      url: '/api/pitches/public',
      priority: 2,
      params: { limit: 20, offset: 0 }
    },
    {
      name: 'featured_creators',
      url: '/api/creators/featured',
      priority: 3,
      params: { limit: 5 }
    },
    {
      name: 'popular_genres',
      url: '/api/genres/popular',
      priority: 4
    },
    {
      name: 'dashboard_stats',
      url: '/api/dashboard/stats',
      priority: 2
    }
  ],
  schedule: '*/5 * * * *', // Every 5 minutes
  parallel: 3, // Process 3 endpoints concurrently
  timeout: 5000 // 5 second timeout per endpoint
};

// Scheduled warming function for Cloudflare Workers
export async function scheduledCacheWarming(
  event: ScheduledEvent,
  env: any,
  ctx: ExecutionContext
): Promise<void> {
  const cache = new EdgeCacheLayer(env.PITCHEY_KV || null);
  const warmer = new CacheWarmer(cache, DEFAULT_WARMING_CONFIG);

  // Only warm if needed
  if (!warmer.shouldWarm()) {
    console.log('[Scheduled] Cache recently warmed, skipping...');
    return;
  }

  console.log('[Scheduled] Starting cache warming...');
  const result = await warmer.warmCache(env);

  if (!result.success) {
    console.error('[Scheduled] Cache warming failed:', result.error);
  } else {
    console.log(`[Scheduled] Cache warming completed: ${result.message}`);
  }

  // Store stats in KV for monitoring
  if (env.PITCHEY_KV) {
    await env.PITCHEY_KV.put(
      'cache_warming_stats',
      JSON.stringify(result.stats),
      { expirationTtl: 3600 }
    );
  }
}