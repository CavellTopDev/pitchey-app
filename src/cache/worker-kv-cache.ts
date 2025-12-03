/**
 * Enhanced Worker KV Cache with Smart Invalidation
 * Optimized for Cloudflare Workers with advanced caching patterns
 */

export interface KVCacheConfig {
  namespace: KVNamespace;
  defaultTTL?: number;
  compressionThreshold?: number;
  shardCount?: number;
}

export interface KVCacheEntry<T = any> {
  data: T;
  metadata: {
    created: number;
    accessed: number;
    accessCount: number;
    ttl: number;
    tags: string[];
    compressed: boolean;
    version: number;
    etag?: string;
    dependencies?: string[];
  };
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  dependencies?: string[];
  compress?: boolean;
  version?: number;
}

export class EnhancedKVCache {
  private kv: KVNamespace;
  private defaultTTL: number;
  private compressionThreshold: number;
  private shardCount: number;
  private tagIndex: Map<string, Set<string>> = new Map();
  
  constructor(config: KVCacheConfig) {
    this.kv = config.namespace;
    this.defaultTTL = config.defaultTTL || 3600; // 1 hour default
    this.compressionThreshold = config.compressionThreshold || 1024; // 1KB
    this.shardCount = config.shardCount || 10;
  }
  
  // Get with smart cache strategies
  async get<T = any>(
    key: string,
    options?: {
      consistentRead?: boolean;
      decompress?: boolean;
    }
  ): Promise<T | null> {
    const shardedKey = this.getShardedKey(key);
    
    try {
      // Get with metadata
      const result = await this.kv.getWithMetadata<KVCacheEntry<T>>(
        shardedKey,
        { type: 'json' }
      );
      
      if (!result.value) {
        return null;
      }
      
      const entry = result.value;
      
      // Check if expired
      if (this.isExpired(entry)) {
        await this.delete(key);
        return null;
      }
      
      // Update access metadata
      entry.metadata.accessed = Date.now();
      entry.metadata.accessCount++;
      
      // Update in background (fire and forget)
      this.updateMetadata(shardedKey, entry).catch(console.error);
      
      // Decompress if needed
      if (entry.metadata.compressed && options?.decompress !== false) {
        return this.decompress(entry.data);
      }
      
      return entry.data;
    } catch (error) {
      console.error(`KV Cache get error for ${key}:`, error);
      return null;
    }
  }
  
  // Set with advanced options
  async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<void> {
    const shardedKey = this.getShardedKey(key);
    const ttl = options?.ttl || this.defaultTTL;
    
    // Estimate size and compress if needed
    const size = this.estimateSize(value);
    const shouldCompress = options?.compress !== false && size > this.compressionThreshold;
    const data = shouldCompress ? await this.compress(value) : value;
    
    const entry: KVCacheEntry<T> = {
      data,
      metadata: {
        created: Date.now(),
        accessed: Date.now(),
        accessCount: 0,
        ttl,
        tags: options?.tags || [],
        compressed: shouldCompress,
        version: options?.version || 1,
        dependencies: options?.dependencies,
      },
    };
    
    try {
      await this.kv.put(
        shardedKey,
        JSON.stringify(entry),
        {
          expirationTtl: ttl,
          metadata: {
            tags: options?.tags,
            version: options?.version,
          },
        }
      );
      
      // Update tag index
      if (options?.tags) {
        await this.updateTagIndex(key, options.tags);
      }
      
      // Track dependencies
      if (options?.dependencies) {
        await this.trackDependencies(key, options.dependencies);
      }
    } catch (error) {
      console.error(`KV Cache set error for ${key}:`, error);
      throw error;
    }
  }
  
  // Delete with cascade
  async delete(key: string, cascade: boolean = true): Promise<void> {
    const shardedKey = this.getShardedKey(key);
    
    try {
      // Get entry to check for dependencies
      if (cascade) {
        const entry = await this.get<any>(key);
        if (entry) {
          await this.invalidateDependents(key);
        }
      }
      
      await this.kv.delete(shardedKey);
      
      // Clean up tag index
      await this.cleanTagIndex(key);
    } catch (error) {
      console.error(`KV Cache delete error for ${key}:`, error);
    }
  }
  
  // Invalidate by tag
  async invalidateByTag(tag: string): Promise<number> {
    const keys = await this.getKeysByTag(tag);
    let count = 0;
    
    // Batch delete for efficiency
    const deletePromises = [];
    for (const key of keys) {
      deletePromises.push(this.delete(key, false));
      count++;
      
      // Process in batches of 50
      if (deletePromises.length >= 50) {
        await Promise.all(deletePromises);
        deletePromises.length = 0;
      }
    }
    
    // Process remaining
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
    
    return count;
  }
  
  // Invalidate by pattern
  async invalidateByPattern(pattern: RegExp): Promise<number> {
    const keys = await this.getAllKeys();
    let count = 0;
    
    const deletePromises = [];
    for (const key of keys) {
      if (pattern.test(key)) {
        deletePromises.push(this.delete(key, false));
        count++;
        
        if (deletePromises.length >= 50) {
          await Promise.all(deletePromises);
          deletePromises.length = 0;
        }
      }
    }
    
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
    
    return count;
  }
  
  // Batch get for efficiency
  async getBatch<T = any>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    // Process in parallel with concurrency limit
    const batchSize = 10;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(key => this.get<T>(key).then(value => ({ key, value })))
      );
      
      for (const { key, value } of batchResults) {
        results.set(key, value);
      }
    }
    
    return results;
  }
  
  // Batch set for efficiency
  async setBatch<T = any>(
    entries: Map<string, T>,
    options?: CacheOptions
  ): Promise<void> {
    const promises = [];
    
    for (const [key, value] of entries) {
      promises.push(this.set(key, value, options));
      
      // Process in batches of 10
      if (promises.length >= 10) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }
    
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }
  
  // Cache warming
  async warm(
    keys: string[],
    fetcher: (key: string) => Promise<any>,
    options?: CacheOptions
  ): Promise<void> {
    const missing = [];
    
    // Check what's missing
    for (const key of keys) {
      const exists = await this.get(key);
      if (!exists) {
        missing.push(key);
      }
    }
    
    // Fetch and cache missing items
    const fetchPromises = missing.map(async (key) => {
      try {
        const value = await fetcher(key);
        await this.set(key, value, options);
      } catch (error) {
        console.error(`Failed to warm cache for ${key}:`, error);
      }
    });
    
    await Promise.all(fetchPromises);
  }
  
  // Get cache statistics
  async getStats(): Promise<{
    totalKeys: number;
    estimatedSize: number;
    shardDistribution: Map<number, number>;
  }> {
    const keys = await this.getAllKeys();
    const shardDistribution = new Map<number, number>();
    
    for (const key of keys) {
      const shard = this.getShardNumber(key);
      shardDistribution.set(shard, (shardDistribution.get(shard) || 0) + 1);
    }
    
    return {
      totalKeys: keys.length,
      estimatedSize: keys.length * 1024, // Rough estimate
      shardDistribution,
    };
  }
  
  // Private helper methods
  
  private getShardedKey(key: string): string {
    const shard = this.getShardNumber(key);
    return `shard:${shard}:${key}`;
  }
  
  private getShardNumber(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % this.shardCount;
  }
  
  private isExpired(entry: KVCacheEntry): boolean {
    const age = Date.now() - entry.metadata.created;
    return age > entry.metadata.ttl * 1000;
  }
  
  private async updateMetadata(key: string, entry: KVCacheEntry): Promise<void> {
    // Update only if significant change
    if (entry.metadata.accessCount % 10 === 0) {
      await this.kv.put(
        key,
        JSON.stringify(entry),
        {
          expirationTtl: entry.metadata.ttl,
        }
      );
    }
  }
  
  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1024;
    }
  }
  
  private async compress(data: any): Promise<any> {
    // In Workers environment, use CompressionStream
    if (typeof CompressionStream !== 'undefined') {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const encoder = new TextEncoder();
      writer.write(encoder.encode(JSON.stringify(data)));
      writer.close();
      
      const reader = stream.readable.getReader();
      const chunks = [];
      let result;
      while (!(result = await reader.read()).done) {
        chunks.push(result.value);
      }
      
      return Buffer.concat(chunks).toString('base64');
    }
    return data;
  }
  
  private async decompress(data: any): Promise<any> {
    // In Workers environment, use DecompressionStream
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(Buffer.from(data, 'base64'));
      writer.close();
      
      const reader = stream.readable.getReader();
      const decoder = new TextDecoder();
      const chunks = [];
      let result;
      while (!(result = await reader.read()).done) {
        chunks.push(decoder.decode(result.value));
      }
      
      return JSON.parse(chunks.join(''));
    }
    return data;
  }
  
  private async updateTagIndex(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      const keys = await this.kv.get<string[]>(tagKey, { type: 'json' }) || [];
      if (!keys.includes(key)) {
        keys.push(key);
        await this.kv.put(tagKey, JSON.stringify(keys), {
          expirationTtl: 86400, // 24 hours
        });
      }
    }
  }
  
  private async cleanTagIndex(key: string): Promise<void> {
    // This would need to scan all tags, which is expensive
    // In production, use a separate index or accept eventual consistency
  }
  
  private async getKeysByTag(tag: string): Promise<Set<string>> {
    const tagKey = `tag:${tag}`;
    const keys = await this.kv.get<string[]>(tagKey, { type: 'json' }) || [];
    return new Set(keys);
  }
  
  private async getAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    const list = await this.kv.list();
    
    for (const key of list.keys) {
      // Remove shard prefix
      const actualKey = key.name.replace(/^shard:\d+:/, '');
      keys.push(actualKey);
    }
    
    return keys;
  }
  
  private async trackDependencies(key: string, dependencies: string[]): Promise<void> {
    for (const dep of dependencies) {
      const depKey = `dep:${dep}`;
      const dependents = await this.kv.get<string[]>(depKey, { type: 'json' }) || [];
      if (!dependents.includes(key)) {
        dependents.push(key);
        await this.kv.put(depKey, JSON.stringify(dependents), {
          expirationTtl: 86400,
        });
      }
    }
  }
  
  private async invalidateDependents(key: string): Promise<void> {
    const depKey = `dep:${key}`;
    const dependents = await this.kv.get<string[]>(depKey, { type: 'json' }) || [];
    
    for (const dependent of dependents) {
      await this.delete(dependent, true);
    }
    
    await this.kv.delete(depKey);
  }
}

// Cache key builder with versioning
export class CacheKeyBuilder {
  private segments: string[] = [];
  private version: string = '1';
  
  constructor(private prefix: string) {}
  
  add(segment: string | number): this {
    this.segments.push(String(segment));
    return this;
  }
  
  setVersion(version: string): this {
    this.version = version;
    return this;
  }
  
  build(): string {
    return `${this.prefix}:v${this.version}:${this.segments.join(':')}`;
  }
  
  static fromPattern(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }
}