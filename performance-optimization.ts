/**
 * Performance Optimization System
 * Implements request coalescing, circuit breakers, and adaptive optimization
 */

interface PerformanceConfig {
  coalescing: {
    enabled: boolean;
    windowMs: number;
    maxBatchSize: number;
    deduplication: boolean;
  };
  circuitBreaker: {
    enabled: boolean;
    errorThreshold: number;
    volumeThreshold: number;
    sleepWindow: number;
    bucketSize: number;
  };
  caching: {
    enabled: boolean;
    defaultTTL: number;
    maxSize: number;
    staleWhileRevalidate: number;
    compressionThreshold: number;
  };
  rateLimit: {
    enabled: boolean;
    globalLimit: number;
    perIpLimit: number;
    burstAllowance: number;
    windowMs: number;
  };
  timeout: {
    request: number;
    database: number;
    external: number;
    websocket: number;
  };
  compression: {
    enabled: boolean;
    threshold: number;
    level: number;
  };
}

// Default configuration
export const PERFORMANCE_CONFIG: PerformanceConfig = {
  coalescing: {
    enabled: true,
    windowMs: 100,
    maxBatchSize: 50,
    deduplication: true
  },
  circuitBreaker: {
    enabled: true,
    errorThreshold: 50,  // 50% error rate
    volumeThreshold: 20,  // minimum requests
    sleepWindow: 30000,  // 30 seconds
    bucketSize: 10000  // 10 seconds
  },
  caching: {
    enabled: true,
    defaultTTL: 300,  // 5 minutes
    maxSize: 10000,
    staleWhileRevalidate: 86400,  // 24 hours
    compressionThreshold: 1024  // 1KB
  },
  rateLimit: {
    enabled: true,
    globalLimit: 10000,  // per minute
    perIpLimit: 100,  // per minute
    burstAllowance: 20,
    windowMs: 60000
  },
  timeout: {
    request: 30000,  // 30 seconds
    database: 10000,  // 10 seconds
    external: 15000,  // 15 seconds
    websocket: 60000  // 60 seconds
  },
  compression: {
    enabled: true,
    threshold: 1024,  // 1KB
    level: 6  // zlib compression level
  }
};

// Request coalescing implementation
export class RequestCoalescer {
  private pendingRequests: Map<string, {
    promise: Promise<Response>;
    timestamp: number;
    count: number;
  }> = new Map();
  
  private config: PerformanceConfig['coalescing'];
  
  constructor(config = PERFORMANCE_CONFIG.coalescing) {
    this.config = config;
    this.startCleanup();
  }
  
  async coalesce(
    key: string,
    handler: () => Promise<Response>
  ): Promise<Response> {
    if (!this.config.enabled) {
      return handler();
    }
    
    // Check for existing pending request
    const existing = this.pendingRequests.get(key);
    if (existing) {
      const age = Date.now() - existing.timestamp;
      
      if (age < this.config.windowMs && existing.count < this.config.maxBatchSize) {
        // Increment count and return existing promise
        existing.count++;
        return existing.promise.then(r => r.clone());
      }
    }
    
    // Create new coalesced request
    const promise = handler();
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      count: 1
    });
    
    // Clean up after completion
    promise.finally(() => {
      setTimeout(() => {
        this.pendingRequests.delete(key);
      }, this.config.windowMs);
    });
    
    return promise;
  }
  
  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const maxAge = this.config.windowMs * 2;
      
      for (const [key, value] of this.pendingRequests.entries()) {
        if (now - value.timestamp > maxAge) {
          this.pendingRequests.delete(key);
        }
      }
    }, 10000);  // Every 10 seconds
  }
  
  getStats(): any {
    return {
      pendingRequests: this.pendingRequests.size,
      config: this.config
    };
  }
}

// Circuit breaker implementation
export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure: number = 0;
  private nextAttempt: number = 0;
  private requestCounts: number[] = [];
  private errorCounts: number[] = [];
  private config: PerformanceConfig['circuitBreaker'];
  
  constructor(
    private name: string,
    config = PERFORMANCE_CONFIG.circuitBreaker
  ) {
    this.config = config;
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return fn();
    }
    
    // Check circuit state
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is open for ${this.name}`);
      }
      // Try half-open
      this.state = 'half-open';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.successes++;
    
    if (this.state === 'half-open') {
      if (this.successes >= 5) {
        // Close circuit after successful requests
        this.state = 'closed';
        this.failures = 0;
        console.log(`Circuit breaker closed for ${this.name}`);
      }
    }
    
    this.updateMetrics(false);
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.state === 'half-open') {
      // Immediately open on failure
      this.openCircuit();
    } else if (this.state === 'closed') {
      // Check if we should open
      if (this.shouldOpen()) {
        this.openCircuit();
      }
    }
    
    this.updateMetrics(true);
  }
  
  private shouldOpen(): boolean {
    const totalRequests = this.requestCounts.reduce((a, b) => a + b, 0);
    
    if (totalRequests < this.config.volumeThreshold) {
      return false;
    }
    
    const totalErrors = this.errorCounts.reduce((a, b) => a + b, 0);
    const errorRate = (totalErrors / totalRequests) * 100;
    
    return errorRate >= this.config.errorThreshold;
  }
  
  private openCircuit(): void {
    this.state = 'open';
    this.nextAttempt = Date.now() + this.config.sleepWindow;
    this.successes = 0;
    console.error(`Circuit breaker opened for ${this.name}`);
  }
  
  private updateMetrics(isError: boolean): void {
    const bucketIndex = Math.floor(Date.now() / this.config.bucketSize) % 6;
    
    if (!this.requestCounts[bucketIndex]) {
      this.requestCounts[bucketIndex] = 0;
      this.errorCounts[bucketIndex] = 0;
    }
    
    this.requestCounts[bucketIndex]++;
    if (isError) {
      this.errorCounts[bucketIndex]++;
    }
  }
  
  getState(): string {
    return this.state;
  }
  
  getStats(): any {
    const totalRequests = this.requestCounts.reduce((a, b) => a + b, 0);
    const totalErrors = this.errorCounts.reduce((a, b) => a + b, 0);
    
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests * 100).toFixed(2) : 0,
      lastFailure: this.lastFailure,
      nextAttempt: this.nextAttempt
    };
  }
}

// Advanced caching system
export class CacheManager {
  private cache: Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
    size: number;
    hits: number;
    etag?: string;
  }> = new Map();
  
  private sizeUsed: number = 0;
  private config: PerformanceConfig['caching'];
  
  constructor(config = PERFORMANCE_CONFIG.caching) {
    this.config = config;
    this.startEviction();
  }
  
  async get(key: string): Promise<any | null> {
    if (!this.config.enabled) {
      return null;
    }
    
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    
    const age = Date.now() - entry.timestamp;
    
    // Check if expired
    if (age > entry.ttl * 1000) {
      // Check stale-while-revalidate
      if (age < (entry.ttl + this.config.staleWhileRevalidate) * 1000) {
        // Return stale data and trigger background revalidation
        this.revalidateInBackground(key);
        entry.hits++;
        return entry.data;
      }
      
      // Fully expired
      this.delete(key);
      return null;
    }
    
    entry.hits++;
    return entry.data;
  }
  
  async set(
    key: string, 
    data: any, 
    ttl: number = this.config.defaultTTL,
    etag?: string
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    // Calculate size
    const size = this.calculateSize(data);
    
    // Check if we need to evict
    while (this.sizeUsed + size > this.config.maxSize * 1024 * 1024) {
      this.evictLRU();
    }
    
    // Compress if needed
    let storedData = data;
    if (size > this.config.compressionThreshold) {
      storedData = await this.compress(data);
    }
    
    // Remove old entry if exists
    this.delete(key);
    
    // Store new entry
    this.cache.set(key, {
      data: storedData,
      timestamp: Date.now(),
      ttl,
      size,
      hits: 0,
      etag
    });
    
    this.sizeUsed += size;
  }
  
  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.sizeUsed -= entry.size;
      this.cache.delete(key);
    }
  }
  
  private calculateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2;  // UTF-16
    }
    return JSON.stringify(data).length * 2;
  }
  
  private async compress(data: any): Promise<any> {
    // In a real implementation, use actual compression
    // For now, just return the data
    return data;
  }
  
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruHits = Infinity;
    let lruTimestamp = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < lruHits || 
          (entry.hits === lruHits && entry.timestamp < lruTimestamp)) {
        lruKey = key;
        lruHits = entry.hits;
        lruTimestamp = entry.timestamp;
      }
    }
    
    if (lruKey) {
      this.delete(lruKey);
    }
  }
  
  private revalidateInBackground(key: string): void {
    // Trigger background revalidation
    // This would typically call the original data fetcher
    console.log(`Background revalidation triggered for ${key}`);
  }
  
  private startEviction(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const [key, entry] of this.cache.entries()) {
        const age = now - entry.timestamp;
        
        if (age > (entry.ttl + this.config.staleWhileRevalidate) * 1000) {
          this.delete(key);
        }
      }
    }, 60000);  // Every minute
  }
  
  getStats(): any {
    let totalHits = 0;
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalSize += entry.size;
    }
    
    return {
      entries: this.cache.size,
      sizeUsed: `${(this.sizeUsed / 1024 / 1024).toFixed(2)} MB`,
      maxSize: `${this.config.maxSize} MB`,
      totalHits,
      avgHitsPerEntry: this.cache.size > 0 ? (totalHits / this.cache.size).toFixed(2) : 0
    };
  }
}

// Adaptive timeout manager
export class TimeoutManager {
  private latencies: Map<string, number[]> = new Map();
  private config: PerformanceConfig['timeout'];
  
  constructor(config = PERFORMANCE_CONFIG.timeout) {
    this.config = config;
  }
  
  async withTimeout<T>(
    fn: () => Promise<T>,
    type: keyof PerformanceConfig['timeout'] = 'request',
    adaptiveKey?: string
  ): Promise<T> {
    const timeout = adaptiveKey ? 
      this.getAdaptiveTimeout(adaptiveKey, this.config[type]) :
      this.config[type];
    
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
        )
      ]);
      
      if (adaptiveKey) {
        this.recordLatency(adaptiveKey, Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      if (adaptiveKey && error.message.includes('Timeout')) {
        // Increase timeout for future requests
        this.adjustTimeout(adaptiveKey, timeout);
      }
      throw error;
    }
  }
  
  private getAdaptiveTimeout(key: string, defaultTimeout: number): number {
    const latencies = this.latencies.get(key);
    if (!latencies || latencies.length < 5) {
      return defaultTimeout;
    }
    
    // Calculate P95 latency
    const sorted = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95Latency = sorted[p95Index];
    
    // Set timeout to 2x P95 latency, within bounds
    const adaptive = Math.min(
      Math.max(p95Latency * 2, defaultTimeout * 0.5),
      defaultTimeout * 2
    );
    
    return Math.round(adaptive);
  }
  
  private recordLatency(key: string, latency: number): void {
    if (!this.latencies.has(key)) {
      this.latencies.set(key, []);
    }
    
    const latencies = this.latencies.get(key)!;
    latencies.push(latency);
    
    // Keep only last 100 measurements
    if (latencies.length > 100) {
      latencies.shift();
    }
  }
  
  private adjustTimeout(key: string, currentTimeout: number): void {
    // Record a synthetic high latency to increase future timeouts
    this.recordLatency(key, currentTimeout * 1.5);
  }
  
  getStats(): any {
    const stats: any = {};
    
    for (const [key, latencies] of this.latencies.entries()) {
      if (latencies.length > 0) {
        const sorted = [...latencies].sort((a, b) => a - b);
        stats[key] = {
          count: latencies.length,
          avg: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2),
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)]
        };
      }
    }
    
    return stats;
  }
}

// Queue management system
export class QueueManager {
  private queues: Map<string, {
    items: any[];
    processing: boolean;
    config: {
      maxSize: number;
      batchSize: number;
      flushInterval: number;
      priority: number;
    };
  }> = new Map();
  
  constructor() {
    this.startFlushing();
  }
  
  createQueue(
    name: string,
    config: {
      maxSize?: number;
      batchSize?: number;
      flushInterval?: number;
      priority?: number;
    } = {}
  ): void {
    this.queues.set(name, {
      items: [],
      processing: false,
      config: {
        maxSize: config.maxSize || 1000,
        batchSize: config.batchSize || 10,
        flushInterval: config.flushInterval || 5000,
        priority: config.priority || 0
      }
    });
  }
  
  async enqueue(
    queueName: string,
    item: any,
    processor?: (items: any[]) => Promise<void>
  ): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }
    
    if (queue.items.length >= queue.config.maxSize) {
      throw new Error(`Queue ${queueName} is full`);
    }
    
    queue.items.push(item);
    
    // Check if we should process immediately
    if (queue.items.length >= queue.config.batchSize && processor) {
      await this.processQueue(queueName, processor);
    }
  }
  
  async processQueue(
    queueName: string,
    processor: (items: any[]) => Promise<void>
  ): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.processing || queue.items.length === 0) {
      return;
    }
    
    queue.processing = true;
    
    try {
      // Process in batches
      while (queue.items.length > 0) {
        const batch = queue.items.splice(0, queue.config.batchSize);
        await processor(batch);
      }
    } finally {
      queue.processing = false;
    }
  }
  
  private startFlushing(): void {
    setInterval(() => {
      // Process queues by priority
      const sortedQueues = Array.from(this.queues.entries())
        .sort((a, b) => b[1].config.priority - a[1].config.priority);
      
      for (const [name, queue] of sortedQueues) {
        if (queue.items.length > 0 && !queue.processing) {
          // Trigger flush if interval reached
          console.log(`Auto-flushing queue ${name} with ${queue.items.length} items`);
        }
      }
    }, 1000);  // Check every second
  }
  
  getStats(): any {
    const stats: any = {};
    
    for (const [name, queue] of this.queues.entries()) {
      stats[name] = {
        size: queue.items.length,
        maxSize: queue.config.maxSize,
        processing: queue.processing,
        config: queue.config
      };
    }
    
    return stats;
  }
}

// Resource prioritization
export class ResourcePrioritizer {
  private resources: Map<string, {
    priority: number;
    weight: number;
    allocated: number;
    limit: number;
  }> = new Map();
  
  registerResource(
    name: string,
    config: {
      priority: number;
      weight: number;
      limit: number;
    }
  ): void {
    this.resources.set(name, {
      ...config,
      allocated: 0
    });
  }
  
  async allocate(resourceName: string, amount: number = 1): Promise<boolean> {
    const resource = this.resources.get(resourceName);
    if (!resource) {
      return true;  // Unknown resource, allow
    }
    
    if (resource.allocated + amount > resource.limit) {
      // Check if we can steal from lower priority resources
      const canSteal = this.tryStealResources(resourceName, amount);
      if (!canSteal) {
        return false;
      }
    }
    
    resource.allocated += amount;
    return true;
  }
  
  release(resourceName: string, amount: number = 1): void {
    const resource = this.resources.get(resourceName);
    if (resource) {
      resource.allocated = Math.max(0, resource.allocated - amount);
    }
  }
  
  private tryStealResources(targetResource: string, amount: number): boolean {
    const target = this.resources.get(targetResource);
    if (!target) return false;
    
    // Find lower priority resources
    const lowerPriority = Array.from(this.resources.entries())
      .filter(([name, res]) => name !== targetResource && res.priority < target.priority)
      .sort((a, b) => a[1].priority - b[1].priority);
    
    let stolen = 0;
    for (const [name, resource] of lowerPriority) {
      const available = Math.min(resource.allocated, amount - stolen);
      if (available > 0) {
        resource.allocated -= available;
        stolen += available;
        console.log(`Stole ${available} resources from ${name} for ${targetResource}`);
      }
      
      if (stolen >= amount) {
        return true;
      }
    }
    
    return false;
  }
  
  getStats(): any {
    const stats: any = {};
    
    for (const [name, resource] of this.resources.entries()) {
      stats[name] = {
        priority: resource.priority,
        allocated: resource.allocated,
        limit: resource.limit,
        utilization: `${(resource.allocated / resource.limit * 100).toFixed(2)}%`
      };
    }
    
    return stats;
  }
}

// Performance monitor
export class PerformanceMonitor {
  private metrics: {
    requests: number;
    errors: number;
    latencies: number[];
    cacheHits: number;
    cacheMisses: number;
    coalescedRequests: number;
    circuitBreakerTrips: number;
  } = {
    requests: 0,
    errors: 0,
    latencies: [],
    cacheHits: 0,
    cacheMisses: 0,
    coalescedRequests: 0,
    circuitBreakerTrips: 0
  };
  
  recordRequest(latency: number, success: boolean): void {
    this.metrics.requests++;
    if (!success) this.metrics.errors++;
    
    this.metrics.latencies.push(latency);
    if (this.metrics.latencies.length > 1000) {
      this.metrics.latencies.shift();
    }
  }
  
  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }
  
  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }
  
  recordCoalescedRequest(): void {
    this.metrics.coalescedRequests++;
  }
  
  recordCircuitBreakerTrip(): void {
    this.metrics.circuitBreakerTrips++;
  }
  
  getReport(): any {
    const sorted = [...this.metrics.latencies].sort((a, b) => a - b);
    
    return {
      summary: {
        requests: this.metrics.requests,
        errors: this.metrics.errors,
        errorRate: this.metrics.requests > 0 ? 
          `${(this.metrics.errors / this.metrics.requests * 100).toFixed(2)}%` : '0%',
        cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 ?
          `${(this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(2)}%` : '0%',
        coalescedRequests: this.metrics.coalescedRequests,
        circuitBreakerTrips: this.metrics.circuitBreakerTrips
      },
      latency: sorted.length > 0 ? {
        avg: (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        min: sorted[0],
        max: sorted[sorted.length - 1]
      } : null
    };
  }
}

// Export configured instances
export const coalescer = new RequestCoalescer();
export const cacheManager = new CacheManager();
export const timeoutManager = new TimeoutManager();
export const queueManager = new QueueManager();
export const resourcePrioritizer = new ResourcePrioritizer();
export const performanceMonitor = new PerformanceMonitor();

// Initialize default queues
queueManager.createQueue('async-tasks', { 
  maxSize: 10000, 
  batchSize: 100, 
  flushInterval: 5000,
  priority: 1
});

queueManager.createQueue('analytics', { 
  maxSize: 50000, 
  batchSize: 500, 
  flushInterval: 30000,
  priority: 0
});

queueManager.createQueue('notifications', { 
  maxSize: 1000, 
  batchSize: 10, 
  flushInterval: 1000,
  priority: 2
});

// Register default resources
resourcePrioritizer.registerResource('cpu', {
  priority: 10,
  weight: 1,
  limit: 100
});

resourcePrioritizer.registerResource('memory', {
  priority: 9,
  weight: 1,
  limit: 1024  // MB
});

resourcePrioritizer.registerResource('connections', {
  priority: 8,
  weight: 1,
  limit: 1000
});

resourcePrioritizer.registerResource('bandwidth', {
  priority: 7,
  weight: 1,
  limit: 10000  // Mbps
});