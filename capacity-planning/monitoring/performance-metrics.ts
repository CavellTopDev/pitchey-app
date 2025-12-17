/**
 * Performance Monitoring and Cost Analysis Dashboard
 * Real-time metrics collection and cost optimization tracking
 */

export interface PerformanceMetric {
  timestamp: Date;
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
}

export interface CostMetric {
  service: string;
  dailyCost: number;
  monthlyCost: number;
  yearlyProjection: number;
  optimizationPotential: number;
}

export interface PerformanceThresholds {
  critical: number;
  warning: number;
  target: number;
}

export class PerformanceMonitor {
  // Key performance indicators
  private static readonly KPIs = {
    // Latency metrics (ms)
    latency: {
      p50: { critical: 500, warning: 200, target: 100 },
      p95: { critical: 2000, warning: 1000, target: 500 },
      p99: { critical: 5000, warning: 2000, target: 1000 }
    },
    // Throughput metrics (req/s)
    throughput: {
      requests: { critical: 10000, warning: 5000, target: 2000 },
      bandwidth: { critical: 100, warning: 50, target: 20 } // Gbps
    },
    // Error rates (%)
    errors: {
      rate: { critical: 5, warning: 1, target: 0.1 },
      timeout: { critical: 2, warning: 0.5, target: 0.01 }
    },
    // Resource utilization (%)
    resources: {
      cpu: { critical: 90, warning: 70, target: 50 },
      memory: { critical: 85, warning: 70, target: 60 },
      disk: { critical: 90, warning: 80, target: 70 }
    },
    // Database metrics
    database: {
      connections: { critical: 90, warning: 70, target: 50 },
      queryTime: { critical: 1000, warning: 500, target: 100 }, // ms
      lockWaits: { critical: 100, warning: 50, target: 10 }
    },
    // Cache metrics (%)
    cache: {
      hitRate: { critical: 50, warning: 70, target: 85 },
      evictionRate: { critical: 20, warning: 10, target: 5 }
    }
  };

  /**
   * Collect real-time metrics from Cloudflare Analytics API
   */
  static async collectCloudflareMetrics(
    zoneId: string,
    apiToken: string
  ): Promise<PerformanceMetric[]> {
    const metrics: PerformanceMetric[] = [];
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Fetch analytics data
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/analytics/dashboard?since=${fiveMinutesAgo.toISOString()}&until=${now.toISOString()}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      const analytics = data.result.totals;

      // Extract metrics
      metrics.push({
        timestamp: now,
        name: 'requests_total',
        value: analytics.requests.all,
        unit: 'count',
        tags: { source: 'cloudflare' }
      });

      metrics.push({
        timestamp: now,
        name: 'bandwidth_bytes',
        value: analytics.bandwidth.all,
        unit: 'bytes',
        tags: { source: 'cloudflare' }
      });

      metrics.push({
        timestamp: now,
        name: 'cache_hit_rate',
        value: (analytics.requests.cached / analytics.requests.all) * 100,
        unit: 'percentage',
        tags: { source: 'cloudflare' }
      });

      metrics.push({
        timestamp: now,
        name: 'error_rate',
        value: ((analytics.requests.http_status['4xx'] + analytics.requests.http_status['5xx']) / analytics.requests.all) * 100,
        unit: 'percentage',
        tags: { source: 'cloudflare' }
      });
    }

    return metrics;
  }

  /**
   * Collect Neon database metrics
   */
  static async collectNeonMetrics(
    projectId: string,
    apiKey: string
  ): Promise<PerformanceMetric[]> {
    const metrics: PerformanceMetric[] = [];
    const now = new Date();

    const response = await fetch(
      `https://console.neon.tech/api/v2/projects/${projectId}/metrics`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      
      metrics.push({
        timestamp: now,
        name: 'db_connections_active',
        value: data.connections.active,
        unit: 'count',
        tags: { source: 'neon', database: 'primary' }
      });

      metrics.push({
        timestamp: now,
        name: 'db_storage_used',
        value: data.storage.used_bytes,
        unit: 'bytes',
        tags: { source: 'neon', database: 'primary' }
      });

      metrics.push({
        timestamp: now,
        name: 'db_compute_time',
        value: data.compute.active_time_seconds,
        unit: 'seconds',
        tags: { source: 'neon', database: 'primary' }
      });
    }

    return metrics;
  }

  /**
   * Calculate performance score
   */
  static calculatePerformanceScore(metrics: PerformanceMetric[]): number {
    let totalScore = 0;
    let metricCount = 0;

    for (const metric of metrics) {
      const kpiCategory = this.getKPICategory(metric.name);
      if (kpiCategory) {
        const threshold = kpiCategory.target;
        const actual = metric.value;
        
        // Calculate score (0-100)
        let score: number;
        if (metric.name.includes('error') || metric.name.includes('latency')) {
          // Lower is better
          score = Math.max(0, Math.min(100, (threshold / actual) * 100));
        } else if (metric.name.includes('hit_rate') || metric.name.includes('throughput')) {
          // Higher is better
          score = Math.max(0, Math.min(100, (actual / threshold) * 100));
        } else {
          // Target-based
          score = Math.max(0, 100 - Math.abs(actual - threshold));
        }
        
        totalScore += score;
        metricCount++;
      }
    }

    return metricCount > 0 ? totalScore / metricCount : 0;
  }

  /**
   * Get KPI category for a metric
   */
  private static getKPICategory(metricName: string): PerformanceThresholds | null {
    for (const [category, metrics] of Object.entries(this.KPIs)) {
      for (const [name, thresholds] of Object.entries(metrics)) {
        if (metricName.includes(name)) {
          return thresholds as PerformanceThresholds;
        }
      }
    }
    return null;
  }

  /**
   * Generate performance report
   */
  static generatePerformanceReport(
    metrics: PerformanceMetric[],
    timeRange: { start: Date; end: Date }
  ): {
    summary: {
      score: number;
      status: 'healthy' | 'degraded' | 'critical';
      issues: string[];
      recommendations: string[];
    };
    details: Record<string, any>;
  } {
    const score = this.calculatePerformanceScore(metrics);
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze metrics for issues
    for (const metric of metrics) {
      const kpi = this.getKPICategory(metric.name);
      if (kpi) {
        if (metric.value > kpi.critical) {
          issues.push(`${metric.name} is critical: ${metric.value}${metric.unit}`);
          recommendations.push(this.getRecommendation(metric.name, 'critical'));
        } else if (metric.value > kpi.warning) {
          issues.push(`${metric.name} warning: ${metric.value}${metric.unit}`);
          recommendations.push(this.getRecommendation(metric.name, 'warning'));
        }
      }
    }
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'critical';
    if (score >= 80) {
      status = 'healthy';
    } else if (score >= 50) {
      status = 'degraded';
    } else {
      status = 'critical';
    }
    
    return {
      summary: {
        score,
        status,
        issues,
        recommendations: [...new Set(recommendations)] // Remove duplicates
      },
      details: {
        metricsAnalyzed: metrics.length,
        timeRange,
        breakdown: this.getMetricsBreakdown(metrics)
      }
    };
  }

  /**
   * Get recommendation based on metric and severity
   */
  private static getRecommendation(metricName: string, severity: 'warning' | 'critical'): string {
    const recommendations: Record<string, Record<string, string>> = {
      latency: {
        warning: 'Consider enabling more aggressive caching and optimizing database queries',
        critical: 'Immediately scale up workers and investigate slow endpoints'
      },
      error_rate: {
        warning: 'Review error logs and add retry logic for failed requests',
        critical: 'Check service health and roll back recent deployments if needed'
      },
      cpu: {
        warning: 'Monitor CPU-intensive operations and consider code optimization',
        critical: 'Scale horizontally immediately and optimize worker code'
      },
      memory: {
        warning: 'Review memory usage patterns and check for memory leaks',
        critical: 'Increase memory limits or optimize memory-intensive operations'
      },
      cache_hit: {
        warning: 'Review cache TTLs and warming strategies',
        critical: 'Implement cache warming and increase cache capacity'
      },
      db_connections: {
        warning: 'Optimize connection pooling and review query patterns',
        critical: 'Scale database compute units and implement read replicas'
      }
    };
    
    for (const [key, recs] of Object.entries(recommendations)) {
      if (metricName.includes(key)) {
        return recs[severity];
      }
    }
    
    return severity === 'critical' 
      ? 'Investigate immediately and consider scaling resources'
      : 'Monitor closely and prepare scaling plan';
  }

  /**
   * Get metrics breakdown by category
   */
  private static getMetricsBreakdown(metrics: PerformanceMetric[]): Record<string, any> {
    const breakdown: Record<string, any> = {};
    
    for (const metric of metrics) {
      const category = metric.tags.source || 'other';
      if (!breakdown[category]) {
        breakdown[category] = {
          count: 0,
          metrics: []
        };
      }
      breakdown[category].count++;
      breakdown[category].metrics.push({
        name: metric.name,
        value: metric.value,
        unit: metric.unit
      });
    }
    
    return breakdown;
  }
}

export class CostAnalyzer {
  // Service pricing (monthly)
  private static readonly PRICING = {
    cloudflare: {
      workers: {
        requests: 0.0000005, // per request after 10M free
        duration: 0.0000125, // per GB-second
        kv: {
          reads: 0.0000005, // per read after 10M free
          writes: 0.000005, // per write after 1M free
          storage: 0.5 // per GB
        }
      },
      pages: 0, // Free for our usage
      r2: {
        storage: 0.015, // per GB
        classA: 0.0045, // per 1000 requests (writes)
        classB: 0.00036 // per 1000 requests (reads)
      }
    },
    neon: {
      compute: {
        '0.25': 19,
        '0.5': 39,
        '1': 79,
        '2': 159,
        '4': 319,
        '8': 639
      },
      storage: 0.09 // per GB
    },
    upstash: {
      requests: 0.0000002, // per request after 10K free
      storage: 0.25 // per GB
    }
  };

  /**
   * Calculate current monthly costs
   */
  static calculateCurrentCosts(
    usage: {
      cloudflare: {
        requests: number;
        duration: number; // GB-seconds
        kvReads: number;
        kvWrites: number;
        kvStorage: number; // GB
        r2Storage: number; // GB
        r2Writes: number;
        r2Reads: number;
      };
      neon: {
        computeSize: '0.25' | '0.5' | '1' | '2' | '4' | '8';
        storageGB: number;
      };
      upstash: {
        requests: number;
        storageGB: number;
      };
    }
  ): CostMetric[] {
    const costs: CostMetric[] = [];
    
    // Cloudflare Workers costs
    const workersCost = 
      Math.max(0, usage.cloudflare.requests - 10000000) * this.PRICING.cloudflare.workers.requests +
      usage.cloudflare.duration * this.PRICING.cloudflare.workers.duration;
    
    // Cloudflare KV costs
    const kvCost = 
      Math.max(0, usage.cloudflare.kvReads - 10000000) * this.PRICING.cloudflare.workers.kv.reads +
      Math.max(0, usage.cloudflare.kvWrites - 1000000) * this.PRICING.cloudflare.workers.kv.writes +
      usage.cloudflare.kvStorage * this.PRICING.cloudflare.workers.kv.storage;
    
    // Cloudflare R2 costs
    const r2Cost = 
      usage.cloudflare.r2Storage * this.PRICING.cloudflare.r2.storage +
      (usage.cloudflare.r2Writes / 1000) * this.PRICING.cloudflare.r2.classA +
      (usage.cloudflare.r2Reads / 1000) * this.PRICING.cloudflare.r2.classB;
    
    costs.push({
      service: 'Cloudflare Workers',
      dailyCost: workersCost / 30,
      monthlyCost: workersCost,
      yearlyProjection: workersCost * 12,
      optimizationPotential: this.calculateOptimizationPotential('workers', usage)
    });
    
    costs.push({
      service: 'Cloudflare KV',
      dailyCost: kvCost / 30,
      monthlyCost: kvCost,
      yearlyProjection: kvCost * 12,
      optimizationPotential: this.calculateOptimizationPotential('kv', usage)
    });
    
    costs.push({
      service: 'Cloudflare R2',
      dailyCost: r2Cost / 30,
      monthlyCost: r2Cost,
      yearlyProjection: r2Cost * 12,
      optimizationPotential: this.calculateOptimizationPotential('r2', usage)
    });
    
    // Neon costs
    const neonCost = 
      this.PRICING.neon.compute[usage.neon.computeSize] +
      usage.neon.storageGB * this.PRICING.neon.storage;
    
    costs.push({
      service: 'Neon Database',
      dailyCost: neonCost / 30,
      monthlyCost: neonCost,
      yearlyProjection: neonCost * 12,
      optimizationPotential: this.calculateOptimizationPotential('neon', usage)
    });
    
    // Upstash costs
    const upstashCost = 
      Math.max(0, usage.upstash.requests - 10000) * this.PRICING.upstash.requests +
      usage.upstash.storageGB * this.PRICING.upstash.storage;
    
    costs.push({
      service: 'Upstash Redis',
      dailyCost: upstashCost / 30,
      monthlyCost: upstashCost,
      yearlyProjection: upstashCost * 12,
      optimizationPotential: this.calculateOptimizationPotential('upstash', usage)
    });
    
    return costs;
  }

  /**
   * Calculate optimization potential
   */
  private static calculateOptimizationPotential(service: string, usage: any): number {
    const optimizations: Record<string, number> = {
      workers: 0.2, // 20% potential reduction through code optimization
      kv: 0.3, // 30% through better caching strategies
      r2: 0.15, // 15% through compression
      neon: 0.25, // 25% through query optimization
      upstash: 0.35 // 35% through better cache invalidation
    };
    
    return optimizations[service] || 0.1;
  }

  /**
   * Generate cost optimization recommendations
   */
  static generateCostOptimizations(
    costs: CostMetric[],
    metrics: PerformanceMetric[]
  ): Array<{
    service: string;
    currentCost: number;
    potentialSavings: number;
    recommendations: string[];
    implementation: string;
  }> {
    const optimizations = [];
    
    for (const cost of costs) {
      const potentialSavings = cost.monthlyCost * cost.optimizationPotential;
      
      if (potentialSavings > 10) { // Only show if savings > $10/month
        optimizations.push({
          service: cost.service,
          currentCost: cost.monthlyCost,
          potentialSavings,
          recommendations: this.getServiceOptimizations(cost.service, metrics),
          implementation: this.getImplementationGuide(cost.service)
        });
      }
    }
    
    return optimizations.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Get service-specific optimizations
   */
  private static getServiceOptimizations(service: string, metrics: PerformanceMetric[]): string[] {
    const recommendations: Record<string, string[]> = {
      'Cloudflare Workers': [
        'Implement request coalescing for duplicate requests',
        'Use Durable Objects for stateful operations',
        'Optimize bundle size to reduce cold starts',
        'Cache responses at the edge using Cache API'
      ],
      'Cloudflare KV': [
        'Increase TTLs for infrequently changing data',
        'Batch KV operations to reduce request count',
        'Use cache tags for efficient invalidation',
        'Implement local caching in Workers'
      ],
      'Cloudflare R2': [
        'Enable compression for text-based files',
        'Implement lifecycle policies for old objects',
        'Use multipart uploads for large files',
        'Cache frequently accessed objects in KV'
      ],
      'Neon Database': [
        'Optimize slow queries identified in metrics',
        'Implement connection pooling with PgBouncer',
        'Use read replicas for read-heavy workloads',
        'Archive old data to reduce storage costs'
      ],
      'Upstash Redis': [
        'Implement intelligent cache invalidation',
        'Use Redis data types efficiently',
        'Set appropriate TTLs based on access patterns',
        'Compress large cached values'
      ]
    };
    
    return recommendations[service] || ['Review service usage patterns'];
  }

  /**
   * Get implementation guide
   */
  private static getImplementationGuide(service: string): string {
    const guides: Record<string, string> = {
      'Cloudflare Workers': 'See capacity-planning/optimizations/workers-optimization.md',
      'Cloudflare KV': 'See capacity-planning/optimizations/kv-optimization.md',
      'Cloudflare R2': 'See capacity-planning/optimizations/r2-optimization.md',
      'Neon Database': 'See capacity-planning/optimizations/neon-optimization.md',
      'Upstash Redis': 'See capacity-planning/optimizations/redis-optimization.md'
    };
    
    return guides[service] || 'Contact DevOps team for optimization guidance';
  }
}

// Export monitoring dashboard configuration
export const monitoringDashboard = {
  panels: [
    {
      title: 'Request Rate',
      query: 'sum(rate(http_requests_total[5m]))',
      visualization: 'line',
      thresholds: PerformanceMonitor['KPIs'].throughput.requests
    },
    {
      title: 'Latency Percentiles',
      query: 'histogram_quantile(0.95, http_request_duration_seconds)',
      visualization: 'heatmap',
      thresholds: PerformanceMonitor['KPIs'].latency.p95
    },
    {
      title: 'Error Rate',
      query: 'sum(rate(http_requests_total{status=~"5.."}[5m]))',
      visualization: 'area',
      thresholds: PerformanceMonitor['KPIs'].errors.rate
    },
    {
      title: 'Cache Hit Rate',
      query: 'sum(rate(cache_hits_total[5m])) / sum(rate(cache_requests_total[5m]))',
      visualization: 'gauge',
      thresholds: PerformanceMonitor['KPIs'].cache.hitRate
    },
    {
      title: 'Database Connections',
      query: 'pg_stat_activity_count',
      visualization: 'line',
      thresholds: PerformanceMonitor['KPIs'].database.connections
    },
    {
      title: 'Cost Breakdown',
      query: 'custom:cost_by_service',
      visualization: 'pie',
      thresholds: null
    }
  ],
  alerts: [
    {
      name: 'HighErrorRate',
      condition: 'error_rate > 5',
      duration: '5m',
      severity: 'critical',
      actions: ['page', 'slack']
    },
    {
      name: 'HighLatency',
      condition: 'p95_latency > 2000',
      duration: '10m',
      severity: 'warning',
      actions: ['email', 'slack']
    },
    {
      name: 'LowCacheHitRate',
      condition: 'cache_hit_rate < 50',
      duration: '15m',
      severity: 'warning',
      actions: ['slack']
    },
    {
      name: 'HighCost',
      condition: 'daily_cost > daily_budget * 1.2',
      duration: '1h',
      severity: 'warning',
      actions: ['email']
    }
  ]
};