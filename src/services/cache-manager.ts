/**
 * Advanced Cache Manager Service
 * Implements multi-layer caching with Cloudflare KV, Redis, and in-memory fallback
 */

import { createClient } from '@upstash/redis';

export interface CacheConfig {
  defaultTTL: number;
  maxMemorySize: number;
  compressionThreshold: number;
  namespace: string;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
  compressed?: boolean;
  etag?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  entries: number;
}

/**
 * Multi-layer cache implementation
 */
export class CacheManager {
  private kv?: KVNamespace;
  private redis?: any;
  private memory: Map<string, CacheEntry>;
  private stats: CacheStats;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 300, // 5 minutes
      maxMemorySize: 50 * 1024 * 1024, // 50MB
      compressionThreshold: 1024, // 1KB
      namespace: 'pitchey',
      ...config
    };

    this.memory = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      entries: 0
    };
  }

  /**
   * Initialize cache layers
   */
  async initialize(env: any) {
    // Cloudflare KV
    if (env.KV) {
      this.kv = env.KV;
    }

    // Upstash Redis
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        this.redis = createClient({
          url: env.UPSTASH_REDIS_REST_URL,
          token: env.UPSTASH_REDIS_REST_TOKEN
        });
      } catch (error) {
        console.warn('Redis initialization failed, using fallback:', error);
      }
    }
  }

  /**
   * Get value from cache (checks all layers)
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);

    // Layer 1: Memory cache
    const memoryResult = this.getFromMemory<T>(fullKey);
    if (memoryResult !== null) {
      this.stats.hits++;
      return memoryResult;
    }

    // Layer 2: KV cache
    if (this.kv) {
      const kvResult = await this.getFromKV<T>(fullKey);
      if (kvResult !== null) {
        this.stats.hits++;
        // Populate memory cache
        this.setInMemory(fullKey, kvResult, 60); // Short TTL for memory
        return kvResult;
      }
    }

    // Layer 3: Redis cache
    if (this.redis) {
      const redisResult = await this.getFromRedis<T>(fullKey);
      if (redisResult !== null) {
        this.stats.hits++;
        // Populate faster layers
        this.setInMemory(fullKey, redisResult, 60);
        if (this.kv) {
          await this.setInKV(fullKey, redisResult, 300);
        }
        return redisResult;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set value in cache (writes to all layers)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const finalTTL = ttl || this.config.defaultTTL;

    // Write to all layers in parallel
    const writes: Promise<void>[] = [];

    // Memory cache
    writes.push(Promise.resolve(this.setInMemory(fullKey, value, Math.min(finalTTL, 300))));

    // KV cache
    if (this.kv) {
      writes.push(this.setInKV(fullKey, value, finalTTL));
    }

    // Redis cache
    if (this.redis) {
      writes.push(this.setInRedis(fullKey, value, finalTTL));
    }

    await Promise.all(writes);
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    const deletes: Promise<void>[] = [];

    // Memory
    this.memory.delete(fullKey);

    // KV
    if (this.kv) {
      deletes.push(this.kv.delete(fullKey));
    }

    // Redis
    if (this.redis) {
      deletes.push(this.redis.del(fullKey));
    }

    await Promise.all(deletes);
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // Memory cache
    const keysToDelete: string[] = [];
    for (const key of this.memory.keys()) {
      if (this.matchPattern(key, pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.memory.delete(key));

    // Redis cache (supports pattern deletion)
    if (this.redis) {
      const keys = await this.redis.keys(`${this.config.namespace}:${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }

    // KV doesn't support pattern deletion efficiently
    // Would need to maintain an index
  }

  /**
   * Cache warming - preload frequently accessed data
   */
  async warm(keys: Array<{ key: string; loader: () => Promise<any>; ttl?: number }>) {
    const warmingTasks = keys.map(async ({ key, loader, ttl }) => {
      try {
        const cached = await this.get(key);
        if (!cached) {
          const data = await loader();
          await this.set(key, data, ttl);
        }
      } catch (error) {
        console.error(`Cache warming failed for ${key}:`, error);
      }
    });

    await Promise.all(warmingTasks);
  }

  /**
   * Get or set with loader function
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await loader();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    // Try memory first for all keys
    const missingKeys: string[] = [];
    for (const key of keys) {
      const fullKey = this.getFullKey(key);
      const memResult = this.getFromMemory<T>(fullKey);
      if (memResult !== null) {
        results.set(key, memResult);
        this.stats.hits++;
      } else {
        missingKeys.push(key);
      }
    }

    // Try Redis for missing keys
    if (this.redis && missingKeys.length > 0) {
      const fullKeys = missingKeys.map(k => this.getFullKey(k));
      const redisResults = await this.redis.mget(...fullKeys);
      
      for (let i = 0; i < missingKeys.length; i++) {
        const value = redisResults[i];
        if (value) {
          const parsed = JSON.parse(value);
          results.set(missingKeys[i], parsed);
          this.stats.hits++;
          // Populate memory cache
          this.setInMemory(fullKeys[i], parsed, 60);
        } else {
          results.set(missingKeys[i], null);
          this.stats.misses++;
        }
      }
    } else {
      // Mark remaining as misses
      for (const key of missingKeys) {
        results.set(key, null);
        this.stats.misses++;
      }
    }

    return results;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      entries: this.memory.size,
      size: this.calculateMemorySize()
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memory.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      entries: 0
    };

    if (this.redis) {
      const keys = await this.redis.keys(`${this.config.namespace}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  // Private helper methods

  private getFullKey(key: string): string {
    return `${this.config.namespace}:${key}`;
  }

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memory.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl * 1000) {
      this.memory.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data as T;
  }

  private setInMemory<T>(key: string, value: T, ttl: number): void {
    const size = this.estimateSize(value);
    
    // Evict if necessary
    if (this.calculateMemorySize() + size > this.config.maxMemorySize) {
      this.evictLRU();
    }

    this.memory.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size
    });
  }

  private async getFromKV<T>(key: string): Promise<T | null> {
    try {
      const value = await this.kv!.get(key, 'json');
      return value as T;
    } catch (error) {
      console.error('KV get error:', error);
      return null;
    }
  }

  private async setInKV<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      await this.kv!.put(key, JSON.stringify(value), {
        expirationTtl: ttl
      });
    } catch (error) {
      console.error('KV set error:', error);
    }
  }

  private async getFromRedis<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  private async setInRedis<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  private evictLRU(): void {
    let oldest: string | null = null;
    let oldestHits = Infinity;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memory.entries()) {
      const score = entry.hits * 1000 + (Date.now() - entry.timestamp);
      if (score < oldestTime) {
        oldest = key;
        oldestTime = score;
        oldestHits = entry.hits;
      }
    }

    if (oldest) {
      this.memory.delete(oldest);
      this.stats.evictions++;
    }
  }

  private calculateMemorySize(): number {
    let total = 0;
    for (const entry of this.memory.values()) {
      total += entry.size;
    }
    return total;
  }

  private estimateSize(value: any): number {
    const str = JSON.stringify(value);
    return str.length * 2; // Rough estimate (2 bytes per char)
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }
}

/**
 * Cache decorators for methods
 */
export function Cacheable(ttl?: number) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = (this as any).cache as CacheManager;
      if (!cache) {
        return method.apply(this, args);
      }

      const key = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      return cache.getOrSet(
        key,
        () => method.apply(this, args),
        ttl
      );
    };

    return descriptor;
  };
}

/**
 * Cache invalidation decorator
 */
export function InvalidateCache(patterns: string[]) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      const cache = (this as any).cache as CacheManager;
      if (cache) {
        for (const pattern of patterns) {
          await cache.invalidatePattern(pattern);
        }
      }

      return result;
    };

    return descriptor;
  };
}