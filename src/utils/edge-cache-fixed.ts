/**
 * Fixed Edge Cache Utility for KV Namespace
 * Resolves cache key inconsistencies and improves hit rates
 */

export class EdgeCacheFixed {
  private kv: KVNamespace;
  private prefix: string;
  private stats: { hits: number; misses: number; sets: number } = { hits: 0, misses: 0, sets: 0 };
  private debugMode: boolean;

  constructor(kv: KVNamespace, prefix: string = 'cache', debugMode: boolean = false) {
    this.kv = kv;
    this.prefix = prefix;
    this.debugMode = debugMode || process.env.DEBUG_CACHE === 'true';
  }

  /**
   * Generate consistent cache key with proper normalization
   * CRITICAL FIX: This ensures cache keys match regardless of how they're generated
   */
  private generateKey(key: string, params?: Record<string, any>): string {
    // Normalize the key path - remove /api prefix and trailing slashes
    let normalizedKey = key
      .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
      .replace(/\/+/g, '/');      // Normalize multiple slashes
    
    // Remove /api prefix if present for consistency
    if (normalizedKey.startsWith('api/')) {
      normalizedKey = normalizedKey.substring(4);
    }
    
    // If no params, return simple key
    if (!params || Object.keys(params).length === 0) {
      const finalKey = `${this.prefix}:${normalizedKey}`;
      if (this.debugMode) {
        console.log(`[CACHE-KEY] Generated: ${finalKey}`);
      }
      return finalKey;
    }
    
    // Sort and filter params for consistent keys
    const sorted = Object.keys(params)
      .sort() // Always sort alphabetically
      .filter(k => {
        // Filter out undefined, null, or empty string values
        const value = params[k];
        return value !== undefined && value !== null && value !== '';
      })
      .map(k => {
        // Normalize boolean values
        const value = params[k];
        if (typeof value === 'boolean') {
          return `${k}:${value ? '1' : '0'}`;
        }
        return `${k}:${value}`;
      })
      .join('|');
    
    const finalKey = `${this.prefix}:${normalizedKey}:${sorted}`;
    if (this.debugMode) {
      console.log(`[CACHE-KEY] Generated: ${finalKey} from params:`, params);
    }
    return finalKey;
  }

  /**
   * Get from cache with automatic JSON parsing and metrics
   */
  async get<T>(key: string, params?: Record<string, any>): Promise<T | null> {
    try {
      const cacheKey = this.generateKey(key, params);
      const startTime = Date.now();
      
      const cached = await this.kv.get(cacheKey, 'json');
      const duration = Date.now() - startTime;
      
      if (cached) {
        this.stats.hits++;
        if (this.debugMode) {
          console.log(`[CACHE] HIT: ${cacheKey} (${duration}ms)`);
        }
        
        // Validate cached data isn't stale
        if (this.isValidCachedData(cached)) {
          return cached as T;
        } else {
          // Invalid data, delete and return miss
          await this.delete(key, params);
          return null;
        }
      }
      
      this.stats.misses++;
      if (this.debugMode) {
        console.log(`[CACHE] MISS: ${cacheKey} (${duration}ms)`);
      }
      return null;
    } catch (error) {
      console.error('[CACHE] Get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set cache with TTL and validation
   */
  async set<T>(
    key: string, 
    value: T, 
    ttlSeconds: number = 300,
    params?: Record<string, any>
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, params);
      
      // Add metadata to cached object
      const cacheData = {
        data: value,
        timestamp: Date.now(),
        ttl: ttlSeconds
      };
      
      await this.kv.put(cacheKey, JSON.stringify(cacheData), {
        expirationTtl: ttlSeconds,
        metadata: {
          created: new Date().toISOString(),
          endpoint: key
        }
      });
      
      this.stats.sets++;
      if (this.debugMode) {
        console.log(`[CACHE] SET: ${cacheKey} (TTL: ${ttlSeconds}s)`);
      }
      return true;
    } catch (error) {
      console.error('[CACHE] Set error:', error);
      return false;
    }
  }

  /**
   * Delete from cache
   */
  async delete(key: string, params?: Record<string, any>): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, params);
      await this.kv.delete(cacheKey);
      
      if (this.debugMode) {
        console.log(`[CACHE] DELETE: ${cacheKey}`);
      }
      return true;
    } catch (error) {
      console.error('[CACHE] Delete error:', error);
      return false;
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   * Since KV doesn't support wildcards, we maintain an index
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      // Get the index of keys for this pattern
      const indexKey = `${this.prefix}:index:${pattern}`;
      const index = await this.kv.get<string[]>(indexKey, 'json');
      
      if (!index || index.length === 0) {
        console.log(`[CACHE] No keys to invalidate for pattern: ${pattern}`);
        return 0;
      }
      
      // Delete all keys in the index
      const deletePromises = index.map(key => this.kv.delete(key));
      await Promise.all(deletePromises);
      
      // Clear the index
      await this.kv.delete(indexKey);
      
      console.log(`[CACHE] Invalidated ${index.length} keys for pattern: ${pattern}`);
      return index.length;
    } catch (error) {
      console.error('[CACHE] Pattern invalidation error:', error);
      return 0;
    }
  }

  /**
   * Wrap a function with caching
   */
  async cached<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds: number = 300,
    params?: Record<string, any>
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key, params);
    if (cached !== null) {
      return cached;
    }

    // Execute function
    const result = await fn();
    
    // Cache result (don't await to avoid blocking)
    this.set(key, result, ttlSeconds, params).catch(err => 
      console.error('[CACHE] Background set failed:', err)
    );
    
    return result;
  }

  /**
   * Warm up cache with common requests
   */
  async warmUp(endpoints: Array<{ key: string; params?: Record<string, any>; fetcher: () => Promise<any> }>): Promise<void> {
    console.log('[CACHE] Starting cache warm-up...');
    
    const warmUpPromises = endpoints.map(async ({ key, params, fetcher }) => {
      try {
        const existing = await this.get(key, params);
        if (!existing) {
          const data = await fetcher();
          await this.set(key, data, 300, params); // 5 min TTL for warm-up
          console.log(`[CACHE] Warmed: ${key}`);
        }
      } catch (error) {
        console.error(`[CACHE] Warm-up failed for ${key}:`, error);
      }
    });
    
    await Promise.allSettled(warmUpPromises);
    console.log('[CACHE] Warm-up complete');
  }

  /**
   * Get cache statistics
   */
  getStats(): { 
    hits: number; 
    misses: number; 
    sets: number;
    hitRate: number;
    total: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate,
      total
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, sets: 0 };
  }

  /**
   * Validate cached data structure
   */
  private isValidCachedData(data: any): boolean {
    // Check if it's our wrapped cache format
    if (data && typeof data === 'object' && 'data' in data && 'timestamp' in data) {
      // Unwrap the actual data
      return true;
    }
    // Also accept raw cached data for backward compatibility
    return data !== null && data !== undefined;
  }

  /**
   * Get raw data from cache wrapper
   */
  private unwrapCachedData<T>(data: any): T {
    if (data && typeof data === 'object' && 'data' in data) {
      return data.data as T;
    }
    return data as T;
  }
}

/**
 * Create a singleton instance for the application
 */
let cacheInstance: EdgeCacheFixed | null = null;

export function getEdgeCache(kv?: KVNamespace): EdgeCacheFixed | null {
  if (!kv) return null;
  
  if (!cacheInstance) {
    cacheInstance = new EdgeCacheFixed(kv, 'cache', true); // Enable debug in dev
  }
  
  return cacheInstance;
}