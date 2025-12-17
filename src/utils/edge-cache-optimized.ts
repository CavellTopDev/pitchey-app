/**
 * Optimized Edge Cache Utility for KV Namespace
 * Fixes cache MISS issues with improved key generation and debugging
 */

export class EdgeCache {
  private kv: KVNamespace;
  private prefix: string;
  private stats = {
    hits: 0,
    misses: 0,
    errors: 0
  };

  constructor(kv: KVNamespace, prefix: string = 'cache') {
    this.kv = kv;
    this.prefix = prefix;
    console.log(`EdgeCache initialized with prefix: ${prefix}`);
  }

  /**
   * Generate normalized cache key with consistent formatting
   */
  private generateKey(key: string, params?: Record<string, any>): string {
    // Normalize the key (remove /api prefix for consistency)
    const normalizedKey = key.startsWith('/api/') 
      ? key.substring(5) 
      : key.startsWith('api/') 
      ? key.substring(4)
      : key;
    
    // If no params, return simple key
    if (!params || Object.keys(params).length === 0) {
      const finalKey = `${this.prefix}:${normalizedKey}`;
      console.log(`Cache key generated: ${finalKey}`);
      return finalKey;
    }
    
    // Sort and filter params for consistent keys
    const sortedParams = Object.keys(params)
      .sort()
      .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map(k => `${k}:${params[k]}`)
      .join('|');
    
    const finalKey = `${this.prefix}:${normalizedKey}:${sortedParams}`;
    console.log(`Cache key with params: ${finalKey}`);
    return finalKey;
  }

  /**
   * Get from cache with improved error handling and stats
   */
  async get<T>(key: string, params?: Record<string, any>): Promise<T | null> {
    if (!this.kv) {
      console.warn('KV namespace not available');
      return null;
    }

    try {
      const cacheKey = this.generateKey(key, params);
      const startTime = Date.now();
      
      const cached = await this.kv.get(cacheKey, 'json');
      const duration = Date.now() - startTime;
      
      if (cached) {
        this.stats.hits++;
        console.log(`Cache HIT: ${cacheKey} (${duration}ms) - Hit rate: ${this.getHitRate()}%`);
        return cached as T;
      }
      
      this.stats.misses++;
      console.log(`Cache MISS: ${cacheKey} (${duration}ms) - Hit rate: ${this.getHitRate()}%`);
      return null;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cache with improved TTL handling
   */
  async set<T>(
    key: string, 
    value: T, 
    ttlSeconds: number = 300,
    params?: Record<string, any>
  ): Promise<boolean> {
    if (!this.kv) {
      console.warn('KV namespace not available for set');
      return false;
    }

    try {
      const cacheKey = this.generateKey(key, params);
      const startTime = Date.now();
      
      // Ensure we're storing valid JSON
      const jsonValue = JSON.stringify(value);
      
      await this.kv.put(cacheKey, jsonValue, {
        expirationTtl: ttlSeconds,
        metadata: {
          timestamp: Date.now(),
          ttl: ttlSeconds,
          key: key,
          params: params
        }
      });
      
      const duration = Date.now() - startTime;
      console.log(`Cache SET: ${cacheKey} (TTL: ${ttlSeconds}s, Duration: ${duration}ms)`);
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete from cache with logging
   */
  async delete(key: string, params?: Record<string, any>): Promise<boolean> {
    if (!this.kv) {
      console.warn('KV namespace not available for delete');
      return false;
    }

    try {
      const cacheKey = this.generateKey(key, params);
      await this.kv.delete(cacheKey);
      console.log(`Cache DELETE: ${cacheKey}`);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Invalidate multiple patterns at once
   */
  async invalidatePattern(pattern: string): Promise<void> {
    console.log(`Cache invalidation requested for pattern: ${pattern}`);
    // Since KV doesn't support wildcards, we track and invalidate known keys
    // In production, you might want to maintain a key index
    const commonKeys = [
      'pitches/browse/enhanced',
      'pitches/browse/general',
      'pitches/trending',
      'pitches/new',
      'dashboard/stats'
    ];

    for (const key of commonKeys) {
      if (key.includes(pattern)) {
        await this.delete(key);
      }
    }
  }

  /**
   * Wrap a function with caching - improved version
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

    // Execute function and cache result
    try {
      const result = await fn();
      await this.set(key, result, ttlSeconds, params);
      return result;
    } catch (error) {
      console.error(`Error executing cached function for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { hits: number; misses: number; errors: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Get hit rate percentage
   */
  private getHitRate(): string {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return '0';
    return ((this.stats.hits / total) * 100).toFixed(1);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, errors: 0 };
    console.log('Cache statistics reset');
  }

  /**
   * Warm cache with multiple keys
   */
  async warmCache(items: Array<{ key: string; value: any; ttl?: number; params?: Record<string, any> }>): Promise<void> {
    console.log(`Warming cache with ${items.length} items...`);
    const results = await Promise.allSettled(
      items.map(item => this.set(item.key, item.value, item.ttl || 300, item.params))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    console.log(`Cache warming complete: ${successful}/${items.length} items cached`);
  }
}