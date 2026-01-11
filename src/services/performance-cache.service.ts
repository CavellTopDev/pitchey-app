import { Redis } from '@upstash/redis'
import { Env } from '../types/env'

interface CacheOptions {
  ttl?: number // Time to live in seconds
  tags?: string[] // Cache tags for invalidation
  compress?: boolean // Compress large payloads
  staleWhileRevalidate?: number // Serve stale content while revalidating
}

interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  tags?: string[]
  compressed?: boolean
  staleUntil?: number
}

export class PerformanceCacheService {
  private redis: Redis | null = null
  private localCache: Map<string, CacheEntry> = new Map()
  private pendingRevalidations: Set<string> = new Set()
  
  // Cache key prefixes for different data types
  private readonly PREFIXES = {
    PITCH: 'pitch:',
    USER: 'user:',
    LIST: 'list:',
    ANALYTICS: 'analytics:',
    SEARCH: 'search:',
    DASHBOARD: 'dashboard:',
    API: 'api:',
    SESSION: 'session:',
    QUERY: 'query:',
    AGGREGATE: 'agg:'
  }
  
  // Default TTLs for different data types (in seconds)
  private readonly TTL = {
    SHORT: 60, // 1 minute
    MEDIUM: 300, // 5 minutes
    LONG: 3600, // 1 hour
    DAY: 86400, // 24 hours
    WEEK: 604800, // 7 days
    PITCH_LIST: 180, // 3 minutes for lists
    PITCH_DETAIL: 600, // 10 minutes for details
    USER_PROFILE: 1800, // 30 minutes
    ANALYTICS: 300, // 5 minutes for analytics
    SEARCH_RESULTS: 120, // 2 minutes for search
    DASHBOARD_METRICS: 60, // 1 minute for real-time metrics
    TRENDING: 900, // 15 minutes for trending content
  }
  
  constructor(private env: Env) {
    this.initializeRedis()
  }
  
  private initializeRedis() {
    if (this.env.UPSTASH_REDIS_REST_URL && this.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        this.redis = new Redis({
          url: this.env.UPSTASH_REDIS_REST_URL,
          token: this.env.UPSTASH_REDIS_REST_TOKEN
        })
      } catch (error) {
        console.error('Failed to initialize Redis:', error)
        this.redis = null
      }
    }
  }
  
  // =====================================================
  // CORE CACHING METHODS
  // =====================================================
  
  async get<T>(key: string): Promise<T | null> {
    // Check local cache first (L1)
    const localEntry = this.localCache.get(key)
    if (localEntry && this.isValid(localEntry)) {
      // Check if stale while revalidate is enabled
      if (localEntry.staleUntil && Date.now() > localEntry.timestamp + localEntry.ttl * 1000) {
        this.revalidateInBackground(key)
      }
      return localEntry.data as T
    }
    
    // Check Redis cache (L2)
    if (!this.redis) return null
    
    try {
      const entry = await this.redis.get<CacheEntry<T>>(key)
      if (entry && this.isValid(entry)) {
        // Store in local cache for faster access
        this.localCache.set(key, entry)
        
        // Handle stale while revalidate
        if (entry.staleUntil && Date.now() > entry.timestamp + entry.ttl * 1000) {
          this.revalidateInBackground(key)
        }
        
        return entry.data
      }
    } catch (error) {
      console.error('Cache get error:', error)
    }
    
    return null
  }
  
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || this.TTL.MEDIUM
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      tags: options.tags,
      compressed: options.compress,
      staleUntil: options.staleWhileRevalidate 
        ? Date.now() + (ttl + options.staleWhileRevalidate) * 1000
        : undefined
    }
    
    // Store in local cache (L1)
    this.localCache.set(key, entry)
    
    // Store in Redis (L2)
    if (this.redis) {
      try {
        await this.redis.set(key, entry, { ex: ttl + (options.staleWhileRevalidate || 0) })
        
        // Store tags for invalidation
        if (options.tags) {
          await this.storeTags(key, options.tags)
        }
      } catch (error) {
        console.error('Cache set error:', error)
      }
    }
  }
  
  async delete(key: string): Promise<void> {
    // Remove from local cache
    this.localCache.delete(key)
    
    // Remove from Redis
    if (this.redis) {
      try {
        await this.redis.del(key)
      } catch (error) {
        console.error('Cache delete error:', error)
      }
    }
  }
  
  // =====================================================
  // CACHE INVALIDATION
  // =====================================================
  
  async invalidateByTags(tags: string[]): Promise<void> {
    if (!this.redis) return
    
    try {
      const keys = new Set<string>()
      
      // Get all keys associated with the tags
      for (const tag of tags) {
        const tagKeys = await this.redis.smembers(`tag:${tag}`)
        tagKeys.forEach(key => keys.add(key))
      }
      
      // Invalidate all keys
      for (const key of keys) {
        await this.delete(key)
      }
      
      // Clean up tag sets
      for (const tag of tags) {
        await this.redis.del(`tag:${tag}`)
      }
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    // Invalidate local cache entries matching pattern
    for (const key of this.localCache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.localCache.delete(key)
      }
    }
    
    // Note: Redis pattern deletion requires SCAN which is expensive
    // Consider using tags instead for production
  }
  
  // =====================================================
  // SPECIALIZED CACHING METHODS
  // =====================================================
  
  async cachePitchList(
    queryKey: string,
    pitches: any[],
    options: { page?: number; filters?: any } = {}
  ): Promise<void> {
    const key = `${this.PREFIXES.LIST}pitches:${queryKey}`
    await this.set(key, pitches, {
      ttl: this.TTL.PITCH_LIST,
      tags: ['pitch-list', `page-${options.page || 1}`],
      staleWhileRevalidate: 60
    })
  }
  
  async getCachedPitchList(
    queryKey: string
  ): Promise<any[] | null> {
    const key = `${this.PREFIXES.LIST}pitches:${queryKey}`
    return this.get<any[]>(key)
  }
  
  async cachePitchDetail(pitchId: string, pitch: any): Promise<void> {
    const key = `${this.PREFIXES.PITCH}${pitchId}`
    await this.set(key, pitch, {
      ttl: this.TTL.PITCH_DETAIL,
      tags: ['pitch', `pitch-${pitchId}`, `user-${pitch.user_id}`],
      staleWhileRevalidate: 300
    })
  }
  
  async getCachedPitchDetail(pitchId: string): Promise<any | null> {
    const key = `${this.PREFIXES.PITCH}${pitchId}`
    return this.get(key)
  }
  
  async cacheDashboardMetrics(
    userId: string,
    userType: string,
    metrics: any
  ): Promise<void> {
    const key = `${this.PREFIXES.DASHBOARD}${userType}:${userId}`
    await this.set(key, metrics, {
      ttl: this.TTL.DASHBOARD_METRICS,
      tags: ['dashboard', `user-${userId}`, userType],
      staleWhileRevalidate: 30
    })
  }
  
  async getCachedDashboardMetrics(
    userId: string,
    userType: string
  ): Promise<any | null> {
    const key = `${this.PREFIXES.DASHBOARD}${userType}:${userId}`
    return this.get(key)
  }
  
  async cacheSearchResults(
    query: string,
    filters: any,
    results: any[]
  ): Promise<void> {
    const key = `${this.PREFIXES.SEARCH}${this.hashQuery(query, filters)}`
    await this.set(key, results, {
      ttl: this.TTL.SEARCH_RESULTS,
      tags: ['search', 'results'],
      compress: results.length > 100
    })
  }
  
  async getCachedSearchResults(
    query: string,
    filters: any
  ): Promise<any[] | null> {
    const key = `${this.PREFIXES.SEARCH}${this.hashQuery(query, filters)}`
    return this.get<any[]>(key)
  }
  
  async cacheAnalytics(
    analyticsType: string,
    timeRange: string,
    data: any
  ): Promise<void> {
    const key = `${this.PREFIXES.ANALYTICS}${analyticsType}:${timeRange}`
    await this.set(key, data, {
      ttl: this.TTL.ANALYTICS,
      tags: ['analytics', analyticsType, timeRange],
      compress: true
    })
  }
  
  async getCachedAnalytics(
    analyticsType: string,
    timeRange: string
  ): Promise<any | null> {
    const key = `${this.PREFIXES.ANALYTICS}${analyticsType}:${timeRange}`
    return this.get(key)
  }
  
  // =====================================================
  // QUERY RESULT CACHING
  // =====================================================
  
  async cacheQueryResult<T>(
    queryHash: string,
    result: T,
    ttl?: number
  ): Promise<void> {
    const key = `${this.PREFIXES.QUERY}${queryHash}`
    await this.set(key, result, {
      ttl: ttl || this.TTL.MEDIUM,
      tags: ['query'],
      compress: JSON.stringify(result).length > 10000
    })
  }
  
  async getCachedQueryResult<T>(queryHash: string): Promise<T | null> {
    const key = `${this.PREFIXES.QUERY}${queryHash}`
    return this.get<T>(key)
  }
  
  // =====================================================
  // AGGREGATION CACHING
  // =====================================================
  
  async cacheAggregation(
    aggregationType: string,
    params: any,
    result: any
  ): Promise<void> {
    const key = `${this.PREFIXES.AGGREGATE}${aggregationType}:${this.hashQuery('', params)}`
    await this.set(key, result, {
      ttl: this.TTL.ANALYTICS,
      tags: ['aggregation', aggregationType],
      staleWhileRevalidate: 120
    })
  }
  
  async getCachedAggregation(
    aggregationType: string,
    params: any
  ): Promise<any | null> {
    const key = `${this.PREFIXES.AGGREGATE}${aggregationType}:${this.hashQuery('', params)}`
    return this.get(key)
  }
  
  // =====================================================
  // CACHE WARMING
  // =====================================================
  
  async warmCache(warmupTasks: Array<() => Promise<void>>): Promise<void> {
    const batchSize = 5
    for (let i = 0; i < warmupTasks.length; i += batchSize) {
      const batch = warmupTasks.slice(i, i + batchSize)
      await Promise.all(batch.map(task => task().catch(console.error)))
    }
  }
  
  async warmPitchCache(pitchIds: string[]): Promise<void> {
    // Implement pitch cache warming logic
    console.log(`Warming cache for ${pitchIds.length} pitches`)
  }
  
  // =====================================================
  // UTILITY METHODS
  // =====================================================
  
  private isValid(entry: CacheEntry): boolean {
    const now = Date.now()
    const age = now - entry.timestamp
    
    // Check if within TTL
    if (age <= entry.ttl * 1000) {
      return true
    }
    
    // Check if within stale period
    if (entry.staleUntil && now <= entry.staleUntil) {
      return true
    }
    
    return false
  }
  
  private async revalidateInBackground(key: string): Promise<void> {
    if (this.pendingRevalidations.has(key)) return
    
    this.pendingRevalidations.add(key)
    
    // Trigger revalidation (implementation depends on your data fetching strategy)
    setTimeout(() => {
      this.pendingRevalidations.delete(key)
    }, 5000)
  }
  
  private async storeTags(key: string, tags: string[]): Promise<void> {
    if (!this.redis) return
    
    try {
      for (const tag of tags) {
        await this.redis.sadd(`tag:${tag}`, key)
      }
    } catch (error) {
      console.error('Store tags error:', error)
    }
  }
  
  private hashQuery(query: string, filters: any = {}): string {
    const data = JSON.stringify({ query, filters })
    // Simple hash function for demo - use crypto.subtle.digest in production
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }
  
  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return regex.test(key)
  }
  
  // =====================================================
  // MONITORING AND STATS
  // =====================================================
  
  async getStats(): Promise<{
    localCacheSize: number
    hitRate: number
    missRate: number
    avgResponseTime: number
  }> {
    // Implement cache statistics tracking
    return {
      localCacheSize: this.localCache.size,
      hitRate: 0,
      missRate: 0,
      avgResponseTime: 0
    }
  }
  
  async flushLocal(): Promise<void> {
    this.localCache.clear()
  }
  
  async flushAll(): Promise<void> {
    this.localCache.clear()
    if (this.redis) {
      try {
        await this.redis.flushall()
      } catch (error) {
        console.error('Flush all error:', error)
      }
    }
  }
}

// Export singleton instance factory
export function createPerformanceCacheService(env: Env): PerformanceCacheService {
  return new PerformanceCacheService(env)
}