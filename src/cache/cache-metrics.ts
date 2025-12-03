/**
 * Cache Metrics and Analytics
 * Tracks performance metrics for cache optimization
 */

export interface CacheEvent {
  type: 'hit' | 'miss' | 'write' | 'invalidation' | 'eviction';
  key: string;
  layer?: string;
  latencyMs?: number;
  timestamp: number;
  size?: number;
}

export interface LayerMetrics {
  hits: number;
  misses: number;
  writes: number;
  invalidations: number;
  evictions: number;
  hitRate: number;
  avgLatencyMs: number;
  totalBytes: number;
}

export class CacheMetrics {
  private events: CacheEvent[] = [];
  private layerMetrics: Map<string, LayerMetrics> = new Map();
  private globalMetrics: {
    totalHits: number;
    totalMisses: number;
    totalWrites: number;
    totalInvalidations: number;
    totalEvictions: number;
    startTime: number;
  };
  
  // Sliding window for real-time metrics
  private readonly WINDOW_SIZE = 1000;
  private readonly TIME_BUCKETS = 60; // 60 seconds of buckets
  private timeBuckets: Map<number, CacheEvent[]> = new Map();
  
  constructor() {
    this.globalMetrics = {
      totalHits: 0,
      totalMisses: 0,
      totalWrites: 0,
      totalInvalidations: 0,
      totalEvictions: 0,
      startTime: Date.now(),
    };
    
    // Start periodic cleanup
    this.startCleanup();
  }
  
  recordHit(key: string, layer: string, latencyMs: number): void {
    const event: CacheEvent = {
      type: 'hit',
      key,
      layer,
      latencyMs,
      timestamp: Date.now(),
    };
    
    this.addEvent(event);
    this.globalMetrics.totalHits++;
    this.updateLayerMetrics(layer, 'hit', latencyMs);
  }
  
  recordMiss(key: string, layer: string): void {
    const event: CacheEvent = {
      type: 'miss',
      key,
      layer,
      timestamp: Date.now(),
    };
    
    this.addEvent(event);
    this.globalMetrics.totalMisses++;
    this.updateLayerMetrics(layer, 'miss');
  }
  
  recordWrite(key: string, latencyMs: number, size?: number): void {
    const event: CacheEvent = {
      type: 'write',
      key,
      latencyMs,
      size,
      timestamp: Date.now(),
    };
    
    this.addEvent(event);
    this.globalMetrics.totalWrites++;
  }
  
  recordInvalidation(key: string): void {
    const event: CacheEvent = {
      type: 'invalidation',
      key,
      timestamp: Date.now(),
    };
    
    this.addEvent(event);
    this.globalMetrics.totalInvalidations++;
  }
  
  recordEviction(key: string, layer: string): void {
    const event: CacheEvent = {
      type: 'eviction',
      key,
      layer,
      timestamp: Date.now(),
    };
    
    this.addEvent(event);
    this.globalMetrics.totalEvictions++;
    this.updateLayerMetrics(layer, 'eviction');
  }
  
  recordTagInvalidation(tag: string, count: number): void {
    // Track tag-based invalidations
    console.log(`Tag invalidation: ${tag} (${count} keys)`);
  }
  
  recordPatternInvalidation(pattern: string, count: number): void {
    // Track pattern-based invalidations
    console.log(`Pattern invalidation: ${pattern} (${count} keys)`);
  }
  
  // Get overall metrics
  getMetrics(): {
    hits: number;
    misses: number;
    writes: number;
    invalidations: number;
    evictions: number;
    hitRate: number;
    avgLatencyMs: number;
    uptimeMs: number;
    requestsPerSecond: number;
  } {
    const total = this.globalMetrics.totalHits + this.globalMetrics.totalMisses;
    const hitRate = total > 0 ? this.globalMetrics.totalHits / total : 0;
    const uptimeMs = Date.now() - this.globalMetrics.startTime;
    const requestsPerSecond = total / (uptimeMs / 1000);
    
    // Calculate average latency from recent events
    const recentEvents = this.getRecentEvents(100);
    const latencies = recentEvents
      .filter(e => e.latencyMs !== undefined)
      .map(e => e.latencyMs!);
    const avgLatencyMs = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
    
    return {
      hits: this.globalMetrics.totalHits,
      misses: this.globalMetrics.totalMisses,
      writes: this.globalMetrics.totalWrites,
      invalidations: this.globalMetrics.totalInvalidations,
      evictions: this.globalMetrics.totalEvictions,
      hitRate,
      avgLatencyMs,
      uptimeMs,
      requestsPerSecond,
    };
  }
  
  // Get metrics for a specific layer
  getLayerMetrics(layer: string): LayerMetrics | undefined {
    return this.layerMetrics.get(layer);
  }
  
  // Get all layer metrics
  getAllLayerMetrics(): Map<string, LayerMetrics> {
    return this.layerMetrics;
  }
  
  // Get time-series data for graphing
  getTimeSeriesData(
    metricType: 'hits' | 'misses' | 'latency',
    intervalMs: number = 1000,
    points: number = 60
  ): Array<{ time: number; value: number }> {
    const now = Date.now();
    const data: Array<{ time: number; value: number }> = [];
    
    for (let i = 0; i < points; i++) {
      const startTime = now - (points - i) * intervalMs;
      const endTime = startTime + intervalMs;
      
      const events = this.events.filter(
        e => e.timestamp >= startTime && e.timestamp < endTime
      );
      
      let value = 0;
      switch (metricType) {
        case 'hits':
          value = events.filter(e => e.type === 'hit').length;
          break;
        case 'misses':
          value = events.filter(e => e.type === 'miss').length;
          break;
        case 'latency':
          const latencies = events
            .filter(e => e.latencyMs !== undefined)
            .map(e => e.latencyMs!);
          value = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;
          break;
      }
      
      data.push({ time: startTime, value });
    }
    
    return data;
  }
  
  // Get hot keys (most frequently accessed)
  getHotKeys(limit: number = 10): Array<{ key: string; count: number }> {
    const keyCounts = new Map<string, number>();
    
    for (const event of this.events) {
      if (event.type === 'hit' || event.type === 'miss') {
        keyCounts.set(event.key, (keyCounts.get(event.key) || 0) + 1);
      }
    }
    
    return Array.from(keyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({ key, count }));
  }
  
  // Get cache efficiency score
  getEfficiencyScore(): number {
    const metrics = this.getMetrics();
    
    // Weighted score based on multiple factors
    const hitRateScore = metrics.hitRate * 40;
    const latencyScore = Math.max(0, 40 - (metrics.avgLatencyMs / 10));
    const evictionScore = Math.max(0, 20 - (metrics.evictions / 100));
    
    return Math.min(100, hitRateScore + latencyScore + evictionScore);
  }
  
  // Export metrics for monitoring
  exportMetrics(): string {
    const metrics = this.getMetrics();
    const layerMetrics = Array.from(this.getAllLayerMetrics().entries());
    
    return JSON.stringify({
      timestamp: Date.now(),
      global: metrics,
      layers: layerMetrics.map(([name, data]) => ({
        name,
        ...data,
      })),
      hotKeys: this.getHotKeys(5),
      efficiencyScore: this.getEfficiencyScore(),
    }, null, 2);
  }
  
  // Reset metrics
  reset(): void {
    this.events = [];
    this.layerMetrics.clear();
    this.timeBuckets.clear();
    this.globalMetrics = {
      totalHits: 0,
      totalMisses: 0,
      totalWrites: 0,
      totalInvalidations: 0,
      totalEvictions: 0,
      startTime: Date.now(),
    };
  }
  
  // Private helper methods
  private addEvent(event: CacheEvent): void {
    // Add to main events array
    this.events.push(event);
    
    // Maintain sliding window
    if (this.events.length > this.WINDOW_SIZE) {
      this.events = this.events.slice(-this.WINDOW_SIZE);
    }
    
    // Add to time bucket
    const bucketKey = Math.floor(event.timestamp / 1000);
    if (!this.timeBuckets.has(bucketKey)) {
      this.timeBuckets.set(bucketKey, []);
    }
    this.timeBuckets.get(bucketKey)!.push(event);
  }
  
  private updateLayerMetrics(
    layer: string,
    type: 'hit' | 'miss' | 'eviction',
    latencyMs?: number
  ): void {
    if (!this.layerMetrics.has(layer)) {
      this.layerMetrics.set(layer, {
        hits: 0,
        misses: 0,
        writes: 0,
        invalidations: 0,
        evictions: 0,
        hitRate: 0,
        avgLatencyMs: 0,
        totalBytes: 0,
      });
    }
    
    const metrics = this.layerMetrics.get(layer)!;
    
    switch (type) {
      case 'hit':
        metrics.hits++;
        break;
      case 'miss':
        metrics.misses++;
        break;
      case 'eviction':
        metrics.evictions++;
        break;
    }
    
    // Update hit rate
    const total = metrics.hits + metrics.misses;
    metrics.hitRate = total > 0 ? metrics.hits / total : 0;
    
    // Update average latency
    if (latencyMs !== undefined) {
      const currentAvg = metrics.avgLatencyMs;
      const currentCount = metrics.hits;
      metrics.avgLatencyMs = (currentAvg * (currentCount - 1) + latencyMs) / currentCount;
    }
  }
  
  private getRecentEvents(count: number): CacheEvent[] {
    return this.events.slice(-count);
  }
  
  private startCleanup(): void {
    // Clean up old time buckets every minute
    setInterval(() => {
      const now = Date.now();
      const cutoff = Math.floor((now - this.TIME_BUCKETS * 1000) / 1000);
      
      for (const [bucketKey] of this.timeBuckets) {
        if (bucketKey < cutoff) {
          this.timeBuckets.delete(bucketKey);
        }
      }
    }, 60000);
  }
}

// Export singleton instance
export const cacheMetrics = new CacheMetrics();