/**
 * Free Tier Monitoring Service
 * Tracks usage and warns when approaching limits
 */

export interface UsageMetrics {
  requests: {
    daily: number;
    limit: number;
    percentage: number;
  };
  kvOperations: {
    reads: number;
    writes: number;
    storage: number;
    limit: number;
  };
  cpuTime: {
    average: number;
    p95: number;
    p99: number;
    violations: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  rateLimit: {
    blocked: number;
    passed: number;
  };
}

export class FreeTierMonitor {
  private kv: KVNamespace;
  private readonly LIMITS = {
    dailyRequests: 100000,
    kvReads: 100000,
    kvWrites: 1000,
    kvStorage: 1073741824, // 1GB in bytes
    cpuMs: 10,
    cacheTargetHitRate: 0.8 // 80% cache hit rate target
  };

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Track a request
   */
  async trackRequest(request: Request, responseTime: number, cached: boolean): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const metricsKey = `metrics:${today}`;
    
    try {
      // Get current metrics
      const current = await this.kv.get(metricsKey, 'json') as any || this.getEmptyMetrics();
      
      // Update metrics
      current.requests.total++;
      current.cpuTime.samples.push(responseTime);
      
      if (cached) {
        current.cache.hits++;
      } else {
        current.cache.misses++;
      }
      
      // Store updated metrics (fire and forget)
      this.kv.put(metricsKey, JSON.stringify(current), {
        expirationTtl: 86400 * 2 // Keep for 2 days
      });
      
      // Check if approaching limits
      if (current.requests.total > this.LIMITS.dailyRequests * 0.9) {
        console.warn(`⚠️ Approaching daily request limit: ${current.requests.total}/${this.LIMITS.dailyRequests}`);
      }
      
      if (responseTime > this.LIMITS.cpuMs) {
        console.error(`❌ CPU limit exceeded: ${responseTime}ms > ${this.LIMITS.cpuMs}ms`);
        current.cpuTime.violations++;
      }
    } catch (error) {
      // Don't let monitoring errors affect the main request
      console.error('Monitoring error:', error);
    }
  }

  /**
   * Track KV operation
   */
  async trackKVOperation(operation: 'read' | 'write', size?: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const metricsKey = `metrics:${today}`;
    
    try {
      const current = await this.kv.get(metricsKey, 'json') as any || this.getEmptyMetrics();
      
      if (operation === 'read') {
        current.kvOperations.reads++;
        
        if (current.kvOperations.reads > this.LIMITS.kvReads * 0.9) {
          console.warn(`⚠️ Approaching KV read limit: ${current.kvOperations.reads}/${this.LIMITS.kvReads}`);
        }
      } else {
        current.kvOperations.writes++;
        if (size) {
          current.kvOperations.storage += size;
        }
      }
      
      this.kv.put(metricsKey, JSON.stringify(current), {
        expirationTtl: 86400 * 2
      });
    } catch (error) {
      console.error('KV tracking error:', error);
    }
  }

  /**
   * Get current usage metrics
   */
  async getMetrics(): Promise<UsageMetrics> {
    const today = new Date().toISOString().split('T')[0];
    const metricsKey = `metrics:${today}`;
    
    const current = await this.kv.get(metricsKey, 'json') as any || this.getEmptyMetrics();
    
    // Calculate statistics
    const cpuSamples = current.cpuTime.samples || [];
    const cpuAverage = cpuSamples.length > 0 
      ? cpuSamples.reduce((a: number, b: number) => a + b, 0) / cpuSamples.length 
      : 0;
    
    const cpuSorted = [...cpuSamples].sort((a, b) => a - b);
    const p95Index = Math.floor(cpuSamples.length * 0.95);
    const p99Index = Math.floor(cpuSamples.length * 0.99);
    
    const totalCacheRequests = current.cache.hits + current.cache.misses;
    const hitRate = totalCacheRequests > 0 ? current.cache.hits / totalCacheRequests : 0;
    
    return {
      requests: {
        daily: current.requests.total,
        limit: this.LIMITS.dailyRequests,
        percentage: (current.requests.total / this.LIMITS.dailyRequests) * 100
      },
      kvOperations: {
        reads: current.kvOperations.reads,
        writes: current.kvOperations.writes,
        storage: current.kvOperations.storage,
        limit: this.LIMITS.kvStorage
      },
      cpuTime: {
        average: cpuAverage,
        p95: cpuSorted[p95Index] || 0,
        p99: cpuSorted[p99Index] || 0,
        violations: current.cpuTime.violations
      },
      cache: {
        hits: current.cache.hits,
        misses: current.cache.misses,
        hitRate: hitRate
      },
      rateLimit: {
        blocked: current.rateLimit.blocked,
        passed: current.rateLimit.passed
      }
    };
  }

  /**
   * Get health status based on metrics
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const metrics = await this.getMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    // Check request limit
    if (metrics.requests.percentage > 90) {
      status = 'critical';
      issues.push(`Daily requests at ${metrics.requests.percentage.toFixed(1)}% of limit`);
      recommendations.push('Consider upgrading to paid tier or implementing more aggressive caching');
    } else if (metrics.requests.percentage > 75) {
      status = 'warning';
      issues.push(`Daily requests at ${metrics.requests.percentage.toFixed(1)}% of limit`);
      recommendations.push('Monitor request patterns and optimize high-traffic endpoints');
    }
    
    // Check CPU time
    if (metrics.cpuTime.p95 > this.LIMITS.cpuMs) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`95th percentile CPU time is ${metrics.cpuTime.p95.toFixed(2)}ms`);
      recommendations.push('Optimize database queries and increase cache TTLs');
    }
    
    // Check cache hit rate
    if (metrics.cache.hitRate < this.LIMITS.cacheTargetHitRate) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Cache hit rate is ${(metrics.cache.hitRate * 100).toFixed(1)}%`);
      recommendations.push('Review cache keys and TTL values for frequently accessed data');
    }
    
    // Check KV operations
    if (metrics.kvOperations.reads > this.LIMITS.kvReads * 0.9) {
      status = 'critical';
      issues.push(`KV reads at ${(metrics.kvOperations.reads / this.LIMITS.kvReads * 100).toFixed(1)}% of limit`);
      recommendations.push('Implement local caching or reduce KV operations');
    }
    
    return { status, issues, recommendations };
  }

  /**
   * Get empty metrics object
   */
  private getEmptyMetrics() {
    return {
      requests: { total: 0 },
      kvOperations: { reads: 0, writes: 0, storage: 0 },
      cpuTime: { samples: [], violations: 0 },
      cache: { hits: 0, misses: 0 },
      rateLimit: { blocked: 0, passed: 0 }
    };
  }

  /**
   * Export metrics for analysis
   */
  async exportMetrics(days: number = 7): Promise<any[]> {
    const metrics = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const metricsKey = `metrics:${dateStr}`;
      
      const dayMetrics = await this.kv.get(metricsKey, 'json');
      if (dayMetrics) {
        metrics.push({
          date: dateStr,
          ...dayMetrics
        });
      }
    }
    
    return metrics;
  }

  /**
   * Circuit breaker for when limits are exceeded
   */
  async shouldCircuitBreak(): Promise<boolean> {
    const metrics = await this.getMetrics();
    
    // Circuit break if we're over 95% of daily requests
    if (metrics.requests.percentage > 95) {
      return true;
    }
    
    // Circuit break if KV reads are over 95%
    if (metrics.kvOperations.reads > this.LIMITS.kvReads * 0.95) {
      return true;
    }
    
    // Circuit break if we have too many CPU violations
    if (metrics.cpuTime.violations > 100) {
      return true;
    }
    
    return false;
  }
}

/**
 * Monitoring middleware
 */
export function withMonitoring(
  handler: (request: Request, env: any) => Promise<Response>,
  monitor: FreeTierMonitor
) {
  return async function(request: Request, env: any): Promise<Response> {
    const startTime = Date.now();
    let cached = false;
    
    try {
      // Check circuit breaker
      if (await monitor.shouldCircuitBreak()) {
        return new Response(JSON.stringify({
          error: 'Service temporarily unavailable',
          message: 'Daily limits reached. Please try again tomorrow.'
        }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '3600'
          }
        });
      }
      
      // Execute handler
      const response = await handler(request, env);
      
      // Check if response was cached
      cached = response.headers.get('X-Cache') === 'HIT';
      
      // Track metrics
      const responseTime = Date.now() - startTime;
      await monitor.trackRequest(request, responseTime, cached);
      
      // Add monitoring headers
      response.headers.set('X-Response-Time', `${responseTime}ms`);
      
      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await monitor.trackRequest(request, responseTime, false);
      throw error;
    }
  };
}