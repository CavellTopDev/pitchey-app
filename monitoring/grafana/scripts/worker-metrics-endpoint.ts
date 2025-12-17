/**
 * Worker Metrics Endpoint - Add to your Cloudflare Worker
 * Collects internal metrics and exposes them for Grafana collection
 */

interface WorkerMetrics {
  timestamp: number;
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    avgResponseTime: number;
    totalRequests: number;
    evictions: number;
    memoryUsage: number;
    memoryLimit: number;
  };
  database: {
    queries: number;
    avgQueryTime: number;
    activeConnections: number;
    errors: number;
    slowQueries: number;
  };
  business: {
    pitchesCreated: number;
    userLogins: number;
    ndaRequests: number;
    apiCalls: number;
    activeUsers: number;
    errorRate: number;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    memoryUsage: number;
    cpuTime: number;
  };
  endpoints: {
    [endpoint: string]: {
      requests: number;
      avgTime: number;
      errors: number;
    };
  };
}

class WorkerMetricsCollector {
  private metricsStore: Map<string, any> = new Map();
  private cacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    responseTimes: [] as number[],
    evictions: 0
  };
  private dbStats = {
    queries: 0,
    queryTimes: [] as number[],
    activeConnections: 0,
    errors: 0,
    slowQueries: 0
  };
  private businessStats = {
    pitchesCreated: 0,
    userLogins: 0,
    ndaRequests: 0,
    apiCalls: 0,
    activeUsers: new Set<string>(),
    errors: 0
  };
  private endpointStats = new Map<string, { requests: number; times: number[]; errors: number }>();

  constructor() {
    // Reset counters every hour to prevent memory buildup
    setInterval(() => this.resetCounters(), 60 * 60 * 1000);
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(operation: 'hit' | 'miss', responseTime: number, eviction?: boolean): void {
    if (operation === 'hit') {
      this.cacheStats.hits++;
    } else {
      this.cacheStats.misses++;
    }
    
    this.cacheStats.totalRequests++;
    this.cacheStats.responseTimes.push(responseTime);
    
    if (eviction) {
      this.cacheStats.evictions++;
    }

    // Keep only last 1000 response times to prevent memory issues
    if (this.cacheStats.responseTimes.length > 1000) {
      this.cacheStats.responseTimes = this.cacheStats.responseTimes.slice(-500);
    }
  }

  /**
   * Record database operation metrics
   */
  recordDatabaseOperation(queryTime: number, error?: boolean): void {
    this.dbStats.queries++;
    this.dbStats.queryTimes.push(queryTime);
    
    if (error) {
      this.dbStats.errors++;
    }
    
    if (queryTime > 1000) { // Slow query threshold: 1 second
      this.dbStats.slowQueries++;
    }

    // Keep only last 1000 query times
    if (this.dbStats.queryTimes.length > 1000) {
      this.dbStats.queryTimes = this.dbStats.queryTimes.slice(-500);
    }
  }

  /**
   * Record business operation metrics
   */
  recordBusinessOperation(operation: string, userId?: string, error?: boolean): void {
    this.businessStats.apiCalls++;
    
    if (userId) {
      this.businessStats.activeUsers.add(userId);
    }
    
    if (error) {
      this.businessStats.errors++;
    }

    switch (operation) {
      case 'pitch_created':
        this.businessStats.pitchesCreated++;
        break;
      case 'user_login':
        this.businessStats.userLogins++;
        break;
      case 'nda_request':
        this.businessStats.ndaRequests++;
        break;
    }
  }

  /**
   * Record endpoint performance metrics
   */
  recordEndpointMetrics(endpoint: string, responseTime: number, error?: boolean): void {
    if (!this.endpointStats.has(endpoint)) {
      this.endpointStats.set(endpoint, { requests: 0, times: [], errors: 0 });
    }

    const stats = this.endpointStats.get(endpoint)!;
    stats.requests++;
    stats.times.push(responseTime);
    
    if (error) {
      stats.errors++;
    }

    // Keep only last 100 times per endpoint
    if (stats.times.length > 100) {
      stats.times = stats.times.slice(-50);
    }
  }

  /**
   * Calculate cache hit rate
   */
  private getCacheHitRate(): number {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
  }

  /**
   * Calculate average response time
   */
  private getAverageResponseTime(times: number[]): number {
    if (times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(times: number[], percentile: number): number {
    if (times.length === 0) return 0;
    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Get current memory usage (approximation)
   */
  private getMemoryUsage(): number {
    // Approximate memory usage based on stored data
    const cacheMemory = this.cacheStats.responseTimes.length * 8; // 8 bytes per number
    const dbMemory = this.dbStats.queryTimes.length * 8;
    const businessMemory = this.businessStats.activeUsers.size * 32; // Approximate string size
    const endpointMemory = Array.from(this.endpointStats.values())
      .reduce((sum, stats) => sum + stats.times.length * 8, 0);
    
    return cacheMemory + dbMemory + businessMemory + endpointMemory;
  }

  /**
   * Generate complete metrics object
   */
  getMetrics(): WorkerMetrics {
    const now = Date.now();
    
    return {
      timestamp: now,
      cache: {
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        hitRate: this.getCacheHitRate(),
        avgResponseTime: this.getAverageResponseTime(this.cacheStats.responseTimes),
        totalRequests: this.cacheStats.totalRequests,
        evictions: this.cacheStats.evictions,
        memoryUsage: this.getMemoryUsage(),
        memoryLimit: 128 * 1024 * 1024 // 128MB typical worker limit
      },
      database: {
        queries: this.dbStats.queries,
        avgQueryTime: this.getAverageResponseTime(this.dbStats.queryTimes),
        activeConnections: this.dbStats.activeConnections,
        errors: this.dbStats.errors,
        slowQueries: this.dbStats.slowQueries
      },
      business: {
        pitchesCreated: this.businessStats.pitchesCreated,
        userLogins: this.businessStats.userLogins,
        ndaRequests: this.businessStats.ndaRequests,
        apiCalls: this.businessStats.apiCalls,
        activeUsers: this.businessStats.activeUsers.size,
        errorRate: this.businessStats.apiCalls > 0 ? 
          (this.businessStats.errors / this.businessStats.apiCalls) * 100 : 0
      },
      performance: {
        avgResponseTime: this.getAverageResponseTime([
          ...this.cacheStats.responseTimes,
          ...this.dbStats.queryTimes
        ]),
        p95ResponseTime: this.calculatePercentile([
          ...this.cacheStats.responseTimes,
          ...this.dbStats.queryTimes
        ], 95),
        p99ResponseTime: this.calculatePercentile([
          ...this.cacheStats.responseTimes,
          ...this.dbStats.queryTimes
        ], 99),
        memoryUsage: this.getMemoryUsage(),
        cpuTime: 0 // Worker doesn't expose CPU time directly
      },
      endpoints: Object.fromEntries(
        Array.from(this.endpointStats.entries()).map(([endpoint, stats]) => [
          endpoint,
          {
            requests: stats.requests,
            avgTime: this.getAverageResponseTime(stats.times),
            errors: stats.errors
          }
        ])
      )
    };
  }

  /**
   * Reset counters (called hourly)
   */
  private resetCounters(): void {
    // Reset accumulating counters but keep some recent data
    this.cacheStats.responseTimes = this.cacheStats.responseTimes.slice(-100);
    this.dbStats.queryTimes = this.dbStats.queryTimes.slice(-100);
    this.businessStats.activeUsers.clear();
    
    // Reset endpoint stats but keep structure
    for (const stats of this.endpointStats.values()) {
      stats.times = stats.times.slice(-50);
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];
    const timestamp = metrics.timestamp;

    // Cache metrics
    lines.push(`pitchey_cache_hits_total ${metrics.cache.hits} ${timestamp}`);
    lines.push(`pitchey_cache_misses_total ${metrics.cache.misses} ${timestamp}`);
    lines.push(`pitchey_cache_hit_rate ${metrics.cache.hitRate} ${timestamp}`);
    lines.push(`pitchey_cache_response_time_ms ${metrics.cache.avgResponseTime} ${timestamp}`);
    lines.push(`pitchey_cache_evictions_total ${metrics.cache.evictions} ${timestamp}`);
    lines.push(`pitchey_cache_memory_usage_bytes ${metrics.cache.memoryUsage} ${timestamp}`);

    // Database metrics
    lines.push(`pitchey_db_queries_total ${metrics.database.queries} ${timestamp}`);
    lines.push(`pitchey_db_query_time_ms ${metrics.database.avgQueryTime} ${timestamp}`);
    lines.push(`pitchey_db_connections_active ${metrics.database.activeConnections} ${timestamp}`);
    lines.push(`pitchey_db_errors_total ${metrics.database.errors} ${timestamp}`);
    lines.push(`pitchey_db_slow_queries_total ${metrics.database.slowQueries} ${timestamp}`);

    // Business metrics
    lines.push(`pitchey_pitches_created_total ${metrics.business.pitchesCreated} ${timestamp}`);
    lines.push(`pitchey_user_logins_total ${metrics.business.userLogins} ${timestamp}`);
    lines.push(`pitchey_nda_requests_total ${metrics.business.ndaRequests} ${timestamp}`);
    lines.push(`pitchey_api_calls_total ${metrics.business.apiCalls} ${timestamp}`);
    lines.push(`pitchey_active_users ${metrics.business.activeUsers} ${timestamp}`);
    lines.push(`pitchey_error_rate ${metrics.business.errorRate} ${timestamp}`);

    // Performance metrics
    lines.push(`pitchey_response_time_avg_ms ${metrics.performance.avgResponseTime} ${timestamp}`);
    lines.push(`pitchey_response_time_p95_ms ${metrics.performance.p95ResponseTime} ${timestamp}`);
    lines.push(`pitchey_response_time_p99_ms ${metrics.performance.p99ResponseTime} ${timestamp}`);

    // Endpoint metrics
    for (const [endpoint, stats] of Object.entries(metrics.endpoints)) {
      const endpointLabel = endpoint.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`pitchey_endpoint_requests_total{endpoint="${endpoint}"} ${stats.requests} ${timestamp}`);
      lines.push(`pitchey_endpoint_time_avg_ms{endpoint="${endpoint}"} ${stats.avgTime} ${timestamp}`);
      lines.push(`pitchey_endpoint_errors_total{endpoint="${endpoint}"} ${stats.errors} ${timestamp}`);
    }

    return lines.join('\n');
  }
}

// Singleton instance
const workerMetrics = new WorkerMetricsCollector();

export { workerMetrics, WorkerMetricsCollector, type WorkerMetrics };