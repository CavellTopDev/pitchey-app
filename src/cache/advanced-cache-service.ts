/**
 * Advanced Multi-Layer Cache Service
 * Implements sophisticated caching strategies with multiple layers
 */

import { LRUCache } from './lru-cache';
import { BloomFilter } from './bloom-filter';
import { CacheMetrics } from './cache-metrics';

// Cache layer configuration
export interface CacheLayerConfig {
  maxSize: number;
  ttlMs: number;
  compressionEnabled?: boolean;
  shardCount?: number;
}

// Cache entry metadata
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: Set<string>;
  compressed: boolean;
  accessCount: number;
  lastAccessed: number;
  size: number;
  etag?: string;
  version?: number;
}

// Cache invalidation strategies
export enum InvalidationStrategy {
  TTL = 'ttl',
  LRU = 'lru',
  LFU = 'lfu',
  FIFO = 'fifo',
  TAG_BASED = 'tag_based',
  DEPENDENCY = 'dependency',
}

// Cache write strategies
export enum WriteStrategy {
  WRITE_THROUGH = 'write_through',
  WRITE_BEHIND = 'write_behind',
  WRITE_AROUND = 'write_around',
}

// Advanced cache service
export class AdvancedCacheService {
  private layers: Map<string, CacheLayer>;
  private bloomFilter: BloomFilter;
  private metrics: CacheMetrics;
  private dependencies: Map<string, Set<string>>;
  private compressionWorker?: Worker;
  
  constructor() {
    this.layers = new Map();
    this.bloomFilter = new BloomFilter(100000, 0.01);
    this.metrics = new CacheMetrics();
    this.dependencies = new Map();
    
    // Initialize cache layers
    this.initializeLayers();
    
    // Setup compression worker if available
    if (typeof Worker !== 'undefined') {
      this.setupCompressionWorker();
    }
  }
  
  private initializeLayers() {
    // L1: In-memory hot cache (ultra-fast, small)
    this.layers.set('l1_hot', new CacheLayer({
      maxSize: 100, // 100 entries
      ttlMs: 30000, // 30 seconds
      strategy: InvalidationStrategy.LFU,
    }));
    
    // L2: In-memory standard cache (fast, medium)
    this.layers.set('l2_memory', new CacheLayer({
      maxSize: 1000, // 1000 entries
      ttlMs: 300000, // 5 minutes
      strategy: InvalidationStrategy.LRU,
    }));
    
    // L3: SessionStorage cache (persistent during session)
    this.layers.set('l3_session', new CacheLayer({
      maxSize: 500,
      ttlMs: 1800000, // 30 minutes
      strategy: InvalidationStrategy.TTL,
      storage: 'session',
    }));
    
    // L4: LocalStorage cache (persistent)
    this.layers.set('l4_local', new CacheLayer({
      maxSize: 200,
      ttlMs: 86400000, // 24 hours
      strategy: InvalidationStrategy.LRU,
      storage: 'local',
      compressionEnabled: true,
    }));
    
    // L5: IndexedDB cache (large persistent storage)
    this.layers.set('l5_indexed', new CacheLayer({
      maxSize: 10000,
      ttlMs: 604800000, // 7 days
      strategy: InvalidationStrategy.TTL,
      storage: 'indexed',
      compressionEnabled: true,
    }));
  }
  
  private setupCompressionWorker() {
    // Worker will be created separately for compression tasks
    // This avoids blocking the main thread
  }
  
  // Multi-layer get with cascade
  async get<T = any>(
    key: string,
    options?: {
      skipLayers?: string[];
      forceRefresh?: boolean;
      decompress?: boolean;
    }
  ): Promise<T | null> {
    const startTime = performance.now();
    
    // Check bloom filter for non-existence
    if (!this.bloomFilter.mightExist(key)) {
      this.metrics.recordMiss(key, 'bloom_filter');
      return null;
    }
    
    // Try each layer in order
    for (const [layerName, layer] of this.layers) {
      if (options?.skipLayers?.includes(layerName)) continue;
      if (options?.forceRefresh && layerName !== 'l1_hot') continue;
      
      const result = await layer.get<T>(key);
      
      if (result !== null) {
        this.metrics.recordHit(key, layerName, performance.now() - startTime);
        
        // Promote to higher layers (cache promotion)
        if (layerName !== 'l1_hot') {
          this.promoteToHigherLayers(key, result, layerName);
        }
        
        return result;
      }
    }
    
    this.metrics.recordMiss(key, 'all_layers');
    return null;
  }
  
  // Multi-layer set with write strategies
  async set<T = any>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
      layers?: string[];
      writeStrategy?: WriteStrategy;
      compress?: boolean;
    }
  ): Promise<void> {
    const startTime = performance.now();
    
    // Add to bloom filter
    this.bloomFilter.add(key);
    
    // Determine which layers to write to
    const targetLayers = options?.layers || this.getDefaultLayersForValue(value);
    
    // Apply write strategy
    switch (options?.writeStrategy) {
      case WriteStrategy.WRITE_THROUGH:
        await this.writeThrough(key, value, targetLayers, options);
        break;
      case WriteStrategy.WRITE_BEHIND:
        this.writeBehind(key, value, targetLayers, options);
        break;
      case WriteStrategy.WRITE_AROUND:
        await this.writeAround(key, value, targetLayers, options);
        break;
      default:
        await this.writeThrough(key, value, targetLayers, options);
    }
    
    // Track dependencies
    if (options?.dependencies) {
      this.trackDependencies(key, options.dependencies);
    }
    
    this.metrics.recordWrite(key, performance.now() - startTime);
  }
  
  // Invalidate by key
  async invalidate(key: string): Promise<void> {
    // Remove from all layers
    for (const [_, layer] of this.layers) {
      await layer.delete(key);
    }
    
    // Invalidate dependents
    await this.invalidateDependents(key);
    
    // Update bloom filter (mark for rebuild)
    this.bloomFilter.markForRebuild();
    
    this.metrics.recordInvalidation(key);
  }
  
  // Invalidate by tag
  async invalidateByTag(tag: string): Promise<void> {
    const invalidated = new Set<string>();
    
    for (const [_, layer] of this.layers) {
      const keys = await layer.getKeysByTag(tag);
      for (const key of keys) {
        if (!invalidated.has(key)) {
          await this.invalidate(key);
          invalidated.add(key);
        }
      }
    }
    
    this.metrics.recordTagInvalidation(tag, invalidated.size);
  }
  
  // Invalidate by pattern
  async invalidateByPattern(pattern: RegExp): Promise<void> {
    const invalidated = new Set<string>();
    
    for (const [_, layer] of this.layers) {
      const keys = await layer.getAllKeys();
      for (const key of keys) {
        if (pattern.test(key) && !invalidated.has(key)) {
          await this.invalidate(key);
          invalidated.add(key);
        }
      }
    }
    
    this.metrics.recordPatternInvalidation(pattern.toString(), invalidated.size);
  }
  
  // Cache warming
  async warmCache(
    keys: string[],
    fetcher: (key: string) => Promise<any>,
    options?: {
      batchSize?: number;
      delayMs?: number;
      priority?: 'high' | 'normal' | 'low';
    }
  ): Promise<void> {
    const batchSize = options?.batchSize || 10;
    const delayMs = options?.delayMs || 100;
    
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (key) => {
          try {
            const value = await fetcher(key);
            await this.set(key, value, {
              layers: options?.priority === 'high' ? ['l1_hot', 'l2_memory'] : ['l2_memory'],
            });
          } catch (error) {
            console.error(`Failed to warm cache for key ${key}:`, error);
          }
        })
      );
      
      if (i + batchSize < keys.length && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  // Predictive pre-fetching
  async predictivePreFetch(
    currentKey: string,
    predictor: (key: string) => string[],
    fetcher: (key: string) => Promise<any>
  ): Promise<void> {
    const predictedKeys = predictor(currentKey);
    
    // Pre-fetch in background with lower priority
    setTimeout(() => {
      this.warmCache(predictedKeys, fetcher, {
        priority: 'low',
        batchSize: 5,
      }).catch(error => {
        console.error('Predictive pre-fetch failed:', error);
      });
    }, 0);
  }
  
  // Get cache statistics
  getStatistics(): CacheStatistics {
    return {
      metrics: this.metrics.getMetrics(),
      layers: Array.from(this.layers.entries()).map(([name, layer]) => ({
        name,
        stats: layer.getStatistics(),
      })),
      bloomFilter: {
        falsePositiveRate: this.bloomFilter.getFalsePositiveRate(),
        size: this.bloomFilter.getSize(),
      },
    };
  }
  
  // Private helper methods
  private promoteToHigherLayers(key: string, value: any, currentLayer: string): void {
    const layerOrder = Array.from(this.layers.keys());
    const currentIndex = layerOrder.indexOf(currentLayer);
    
    // Promote to all higher layers (lower index = higher layer)
    for (let i = currentIndex - 1; i >= 0; i--) {
      const higherLayer = this.layers.get(layerOrder[i]);
      if (higherLayer) {
        higherLayer.set(key, value, { skipMetrics: true });
      }
    }
  }
  
  private getDefaultLayersForValue(value: any): string[] {
    const size = this.estimateSize(value);
    
    if (size < 1024) {
      // Small items go to hot cache
      return ['l1_hot', 'l2_memory'];
    } else if (size < 10240) {
      // Medium items skip hot cache
      return ['l2_memory', 'l3_session'];
    } else {
      // Large items go to persistent storage
      return ['l4_local', 'l5_indexed'];
    }
  }
  
  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1024; // Default estimate
    }
  }
  
  private async writeThrough(
    key: string,
    value: any,
    layers: string[],
    options?: any
  ): Promise<void> {
    // Write to all layers simultaneously
    await Promise.all(
      layers.map(layerName => {
        const layer = this.layers.get(layerName);
        return layer?.set(key, value, options);
      })
    );
  }
  
  private writeBehind(
    key: string,
    value: any,
    layers: string[],
    options?: any
  ): void {
    // Write to fastest layer immediately, others asynchronously
    const fastLayer = this.layers.get(layers[0]);
    if (fastLayer) {
      fastLayer.set(key, value, options);
    }
    
    // Write to other layers in background
    setTimeout(() => {
      layers.slice(1).forEach(layerName => {
        const layer = this.layers.get(layerName);
        layer?.set(key, value, options);
      });
    }, 0);
  }
  
  private async writeAround(
    key: string,
    value: any,
    layers: string[],
    options?: any
  ): Promise<void> {
    // Skip hot cache, write to persistent layers only
    const persistentLayers = layers.filter(l => l.includes('session') || l.includes('local') || l.includes('indexed'));
    await this.writeThrough(key, value, persistentLayers, options);
  }
  
  private trackDependencies(key: string, dependencies: string[]): void {
    for (const dep of dependencies) {
      if (!this.dependencies.has(dep)) {
        this.dependencies.set(dep, new Set());
      }
      this.dependencies.get(dep)?.add(key);
    }
  }
  
  private async invalidateDependents(key: string): Promise<void> {
    const dependents = this.dependencies.get(key);
    if (dependents) {
      for (const dependent of dependents) {
        await this.invalidate(dependent);
      }
      this.dependencies.delete(key);
    }
  }
}

// Cache layer implementation
class CacheLayer {
  private cache: LRUCache<CacheEntry> | Map<string, CacheEntry>;
  private config: any;
  private storage?: 'memory' | 'session' | 'local' | 'indexed';
  private tagIndex: Map<string, Set<string>>;
  
  constructor(config: any) {
    this.config = config;
    this.storage = config.storage || 'memory';
    this.tagIndex = new Map();
    
    if (config.strategy === InvalidationStrategy.LRU) {
      this.cache = new LRUCache<CacheEntry>(config.maxSize);
    } else {
      this.cache = new Map();
    }
  }
  
  async get<T>(key: string): Promise<T | null> {
    let entry: CacheEntry | undefined;
    
    if (this.storage === 'memory') {
      entry = this.cache.get(key);
    } else {
      entry = await this.getFromStorage(key);
    }
    
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      await this.delete(key);
      return null;
    }
    
    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    // Decompress if needed
    if (entry.compressed) {
      return this.decompress(entry.data);
    }
    
    return entry.data as T;
  }
  
  async set(key: string, value: any, options?: any): Promise<void> {
    const entry: CacheEntry = {
      data: options?.compress ? await this.compress(value) : value,
      timestamp: Date.now(),
      ttl: options?.ttl || this.config.ttlMs,
      tags: new Set(options?.tags || []),
      compressed: options?.compress || false,
      accessCount: 0,
      lastAccessed: Date.now(),
      size: this.estimateSize(value),
      version: options?.version,
    };
    
    // Update tag index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)?.add(key);
    }
    
    if (this.storage === 'memory') {
      this.cache.set(key, entry);
    } else {
      await this.setToStorage(key, entry);
    }
  }
  
  async delete(key: string): Promise<void> {
    if (this.storage === 'memory') {
      this.cache.delete(key);
    } else {
      await this.deleteFromStorage(key);
    }
    
    // Clean up tag index
    for (const [_, keys] of this.tagIndex) {
      keys.delete(key);
    }
  }
  
  async getAllKeys(): Promise<string[]> {
    if (this.storage === 'memory') {
      return Array.from((this.cache as Map<string, CacheEntry>).keys());
    } else {
      return this.getKeysFromStorage();
    }
  }
  
  async getKeysByTag(tag: string): Promise<Set<string>> {
    return this.tagIndex.get(tag) || new Set();
  }
  
  getStatistics(): any {
    const size = this.cache instanceof Map ? this.cache.size : (this.cache as any).size;
    return {
      size,
      maxSize: this.config.maxSize,
      hitRate: 0, // Would need to track this
      storage: this.storage,
    };
  }
  
  // Storage abstraction methods
  private async getFromStorage(key: string): Promise<CacheEntry | undefined> {
    try {
      switch (this.storage) {
        case 'session':
          const sessionData = sessionStorage.getItem(key);
          return sessionData ? JSON.parse(sessionData) : undefined;
        case 'local':
          const localData = localStorage.getItem(key);
          return localData ? JSON.parse(localData) : undefined;
        case 'indexed':
          return this.getFromIndexedDB(key);
        default:
          return undefined;
      }
    } catch {
      return undefined;
    }
  }
  
  private async setToStorage(key: string, entry: CacheEntry): Promise<void> {
    try {
      const data = JSON.stringify(entry);
      switch (this.storage) {
        case 'session':
          sessionStorage.setItem(key, data);
          break;
        case 'local':
          localStorage.setItem(key, data);
          break;
        case 'indexed':
          await this.setToIndexedDB(key, entry);
          break;
      }
    } catch (error) {
      console.error(`Failed to set ${key} to ${this.storage} storage:`, error);
    }
  }
  
  private async deleteFromStorage(key: string): Promise<void> {
    switch (this.storage) {
      case 'session':
        sessionStorage.removeItem(key);
        break;
      case 'local':
        localStorage.removeItem(key);
        break;
      case 'indexed':
        await this.deleteFromIndexedDB(key);
        break;
    }
  }
  
  private async getKeysFromStorage(): Promise<string[]> {
    switch (this.storage) {
      case 'session':
        return Object.keys(sessionStorage);
      case 'local':
        return Object.keys(localStorage);
      case 'indexed':
        return this.getKeysFromIndexedDB();
      default:
        return [];
    }
  }
  
  // IndexedDB operations
  private async getFromIndexedDB(key: string): Promise<CacheEntry | undefined> {
    // Implementation would use IndexedDB API
    return undefined;
  }
  
  private async setToIndexedDB(key: string, entry: CacheEntry): Promise<void> {
    // Implementation would use IndexedDB API
  }
  
  private async deleteFromIndexedDB(key: string): Promise<void> {
    // Implementation would use IndexedDB API
  }
  
  private async getKeysFromIndexedDB(): Promise<string[]> {
    // Implementation would use IndexedDB API
    return [];
  }
  
  // Compression methods
  private async compress(data: any): Promise<any> {
    // Implementation would use CompressionStream API or worker
    return data;
  }
  
  private async decompress(data: any): Promise<any> {
    // Implementation would use DecompressionStream API or worker
    return data;
  }
  
  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1024;
    }
  }
}

// Export singleton instance
export const advancedCache = new AdvancedCacheService();

// Types
export interface CacheStatistics {
  metrics: {
    hits: number;
    misses: number;
    writes: number;
    invalidations: number;
    hitRate: number;
    avgLatencyMs: number;
  };
  layers: Array<{
    name: string;
    stats: any;
  }>;
  bloomFilter: {
    falsePositiveRate: number;
    size: number;
  };
}