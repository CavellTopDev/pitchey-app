/**
 * Cost Monitoring and Optimization System for Pitchey Platform
 * Tracks and optimizes costs across Cloudflare services, databases, and third-party integrations
 */

export interface CostMetrics {
  timestamp: string;
  period: 'hourly' | 'daily' | 'monthly';
  services: ServiceCosts;
  total: number;
  currency: string;
  trends: CostTrends;
  optimizations: CostOptimization[];
}

export interface ServiceCosts {
  cloudflare: CloudflareCosts;
  database: DatabaseCosts;
  thirdParty: ThirdPartyCosts;
  storage: StorageCosts;
  monitoring: MonitoringCosts;
}

export interface CloudflareCosts {
  workers: {
    requests: number;
    cpu_time_ms: number;
    estimated_cost: number;
    breakdown: {
      base_cost: number;
      request_cost: number;
      cpu_cost: number;
      kv_operations: number;
      durable_objects: number;
    };
  };
  pages: {
    builds: number;
    bandwidth_gb: number;
    estimated_cost: number;
  };
  r2: {
    storage_gb: number;
    class_a_operations: number;  // PUT, POST, LIST
    class_b_operations: number;  // GET, HEAD
    data_transfer_gb: number;
    estimated_cost: number;
  };
  analytics: {
    events: number;
    estimated_cost: number;
  };
}

export interface DatabaseCosts {
  neon: {
    compute_hours: number;
    storage_gb: number;
    data_transfer_gb: number;
    estimated_cost: number;
  };
  hyperdrive: {
    queries: number;
    estimated_cost: number;
  };
}

export interface ThirdPartyCosts {
  upstash_redis: {
    requests: number;
    storage_mb: number;
    estimated_cost: number;
  };
  sendgrid: {
    emails_sent: number;
    estimated_cost: number;
  };
  stripe: {
    transactions: number;
    volume_usd: number;
    estimated_cost: number;
  };
}

export interface StorageCosts {
  total_storage_gb: number;
  backup_storage_gb: number;
  estimated_cost: number;
}

export interface MonitoringCosts {
  logs_ingested_gb: number;
  metrics_samples: number;
  estimated_cost: number;
}

export interface CostTrends {
  hourly_change_percent: number;
  daily_change_percent: number;
  monthly_change_percent: number;
  projected_monthly_cost: number;
}

export interface CostOptimization {
  category: string;
  recommendation: string;
  estimated_savings_usd: number;
  implementation_effort: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high' | 'critical';
  automated: boolean;
}

export interface CostAlert {
  type: 'budget_exceeded' | 'unusual_spike' | 'optimization_opportunity' | 'waste_detected';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  cost_impact_usd: number;
  service: string;
  recommendation?: string;
  auto_action?: string;
}

export class CostMonitor {
  private redis: any;
  private env: {
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
    NEON_API_KEY?: string;
    UPSTASH_API_KEY?: string;
  };

  constructor(env: any, redis?: any) {
    this.env = env;
    this.redis = redis;
  }

  // Fetch Cloudflare usage and cost data
  async getCloudflareMetrics(): Promise<CloudflareCosts> {
    try {
      // Fetch Workers analytics
      const workersAnalytics = await this.fetchCloudflareAnalytics('workers');
      const pagesAnalytics = await this.fetchCloudflareAnalytics('pages');
      const r2Analytics = await this.fetchCloudflareAnalytics('r2');

      return {
        workers: {
          requests: workersAnalytics.requests || 0,
          cpu_time_ms: workersAnalytics.cpu_time || 0,
          estimated_cost: this.calculateWorkersCost(workersAnalytics),
          breakdown: {
            base_cost: 5.00, // $5/month base
            request_cost: (workersAnalytics.requests || 0) * 0.00000015, // $0.15 per million
            cpu_cost: (workersAnalytics.cpu_time || 0) * 0.000002, // $2 per million CPU ms
            kv_operations: (workersAnalytics.kv_operations || 0) * 0.0000005, // $0.50 per million
            durable_objects: (workersAnalytics.durable_objects || 0) * 0.000015 // $15 per million
          }
        },
        pages: {
          builds: pagesAnalytics.builds || 0,
          bandwidth_gb: pagesAnalytics.bandwidth_gb || 0,
          estimated_cost: this.calculatePagesCost(pagesAnalytics)
        },
        r2: {
          storage_gb: r2Analytics.storage_gb || 0,
          class_a_operations: r2Analytics.class_a_operations || 0,
          class_b_operations: r2Analytics.class_b_operations || 0,
          data_transfer_gb: r2Analytics.data_transfer_gb || 0,
          estimated_cost: this.calculateR2Cost(r2Analytics)
        },
        analytics: {
          events: workersAnalytics.analytics_events || 0,
          estimated_cost: (workersAnalytics.analytics_events || 0) * 0.000001 // $1 per million events
        }
      };
    } catch (error) {
      console.error('Failed to fetch Cloudflare metrics:', error);
      throw error;
    }
  }

  // Fetch database costs
  async getDatabaseMetrics(): Promise<DatabaseCosts> {
    try {
      // Neon database metrics
      const neonUsage = await this.fetchNeonUsage();
      
      return {
        neon: {
          compute_hours: neonUsage.compute_hours || 0,
          storage_gb: neonUsage.storage_gb || 0,
          data_transfer_gb: neonUsage.data_transfer_gb || 0,
          estimated_cost: this.calculateNeonCost(neonUsage)
        },
        hyperdrive: {
          queries: neonUsage.hyperdrive_queries || 0,
          estimated_cost: (neonUsage.hyperdrive_queries || 0) * 0.0000001 // Estimate
        }
      };
    } catch (error) {
      console.error('Failed to fetch database metrics:', error);
      return {
        neon: { compute_hours: 0, storage_gb: 0, data_transfer_gb: 0, estimated_cost: 0 },
        hyperdrive: { queries: 0, estimated_cost: 0 }
      };
    }
  }

  // Get comprehensive cost metrics
  async getCostMetrics(): Promise<CostMetrics> {
    const [cloudflare, database, thirdParty] = await Promise.all([
      this.getCloudflareMetrics(),
      this.getDatabaseMetrics(),
      this.getThirdPartyMetrics()
    ]);

    const services: ServiceCosts = {
      cloudflare,
      database,
      thirdParty,
      storage: await this.getStorageMetrics(),
      monitoring: await this.getMonitoringMetrics()
    };

    const total = this.calculateTotalCost(services);
    const trends = await this.calculateCostTrends(total);
    const optimizations = await this.generateOptimizations(services);

    return {
      timestamp: new Date().toISOString(),
      period: 'hourly',
      services,
      total,
      currency: 'USD',
      trends,
      optimizations
    };
  }

  // Analyze costs and generate alerts
  async analyzeCosts(): Promise<CostAlert[]> {
    const metrics = await this.getCostMetrics();
    const alerts: CostAlert[] = [];

    // Budget threshold alerts
    const monthlyBudget = 500; // $500/month budget
    if (metrics.trends.projected_monthly_cost > monthlyBudget) {
      alerts.push({
        type: 'budget_exceeded',
        severity: 'critical',
        message: `Projected monthly cost $${metrics.trends.projected_monthly_cost.toFixed(2)} exceeds budget of $${monthlyBudget}`,
        cost_impact_usd: metrics.trends.projected_monthly_cost - monthlyBudget,
        service: 'all',
        recommendation: 'Review usage patterns and implement cost optimizations'
      });
    }

    // Unusual spike detection
    if (metrics.trends.hourly_change_percent > 50) {
      alerts.push({
        type: 'unusual_spike',
        severity: 'warning',
        message: `Hourly cost increased by ${metrics.trends.hourly_change_percent.toFixed(1)}%`,
        cost_impact_usd: metrics.total * (metrics.trends.hourly_change_percent / 100),
        service: await this.identifySpikingService(metrics),
        recommendation: 'Investigate traffic patterns and potential abuse'
      });
    }

    // Service-specific alerts
    alerts.push(...await this.analyzeCloudflareUsage(metrics.services.cloudflare));
    alerts.push(...await this.analyzeDatabaseUsage(metrics.services.database));
    alerts.push(...await this.analyzeThirdPartyUsage(metrics.services.thirdParty));

    // Optimization opportunities
    for (const optimization of metrics.optimizations) {
      if (optimization.priority === 'high' || optimization.priority === 'critical') {
        alerts.push({
          type: 'optimization_opportunity',
          severity: optimization.priority === 'critical' ? 'critical' : 'warning',
          message: optimization.recommendation,
          cost_impact_usd: optimization.estimated_savings_usd,
          service: optimization.category,
          recommendation: optimization.recommendation,
          auto_action: optimization.automated ? 'Available' : undefined
        });
      }
    }

    // Store alerts for historical analysis
    await this.storeCostAlerts(alerts);

    return alerts;
  }

  // Automated cost optimizations
  async implementAutomaticOptimizations(): Promise<string[]> {
    const optimizations = await this.generateOptimizations(
      (await this.getCostMetrics()).services
    );
    
    const implemented: string[] = [];

    for (const optimization of optimizations) {
      if (optimization.automated && optimization.priority === 'high') {
        try {
          await this.executeOptimization(optimization);
          implemented.push(optimization.recommendation);
        } catch (error) {
          console.error(`Failed to implement optimization: ${optimization.recommendation}`, error);
        }
      }
    }

    return implemented;
  }

  // Private helper methods
  private async fetchCloudflareAnalytics(service: string): Promise<any> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/analytics/dashboard`,
      {
        headers: {
          'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        cf: { cacheTtl: 300 } // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.statusText}`);
    }

    return (await response.json()).result;
  }

  private calculateWorkersCost(analytics: any): number {
    const baseCost = 5.00; // $5/month
    const requestCost = (analytics.requests || 0) * 0.00000015;
    const cpuCost = (analytics.cpu_time || 0) * 0.000002;
    const kvCost = (analytics.kv_operations || 0) * 0.0000005;
    const durableObjectsCost = (analytics.durable_objects || 0) * 0.000015;

    return baseCost + requestCost + cpuCost + kvCost + durableObjectsCost;
  }

  private calculatePagesCost(analytics: any): number {
    const builds = analytics.builds || 0;
    const bandwidth = analytics.bandwidth_gb || 0;

    // First 500 builds free, then $0.25 per build
    const buildCost = Math.max(0, builds - 500) * 0.25;
    
    // First 100GB free, then $0.20 per GB
    const bandwidthCost = Math.max(0, bandwidth - 100) * 0.20;

    return buildCost + bandwidthCost;
  }

  private calculateR2Cost(analytics: any): number {
    const storage = analytics.storage_gb || 0;
    const classAOps = analytics.class_a_operations || 0;
    const classBOps = analytics.class_b_operations || 0;
    const transfer = analytics.data_transfer_gb || 0;

    // First 10GB storage free, then $0.015 per GB
    const storageCost = Math.max(0, storage - 10) * 0.015;
    
    // Class A operations: $4.50 per million
    const classACost = classAOps * 0.0000045;
    
    // Class B operations: $0.36 per million  
    const classBCost = classBOps * 0.00000036;
    
    // No egress fees for R2
    
    return storageCost + classACost + classBCost;
  }

  private calculateNeonCost(usage: any): number {
    // Neon pricing is complex, this is a simplified calculation
    const computeHours = usage.compute_hours || 0;
    const storageGB = usage.storage_gb || 0;

    // Estimate based on Pro plan
    const computeCost = computeHours * 0.102; // $0.102 per hour
    const storageCost = storageGB * 0.00015; // $0.15 per GB-month, prorated

    return computeCost + storageCost;
  }

  private async getThirdPartyMetrics(): Promise<ThirdPartyCosts> {
    // Simplified third-party cost estimation
    return {
      upstash_redis: {
        requests: 1000000, // Estimate based on usage
        storage_mb: 100,
        estimated_cost: 50 // Estimate
      },
      sendgrid: {
        emails_sent: 1000,
        estimated_cost: 15 // $15/month for basic plan
      },
      stripe: {
        transactions: 100,
        volume_usd: 10000,
        estimated_cost: 29 + (10000 * 0.029) // Base + 2.9% fee estimate
      }
    };
  }

  private async getStorageMetrics(): Promise<StorageCosts> {
    return {
      total_storage_gb: 50,
      backup_storage_gb: 25,
      estimated_cost: 5.0
    };
  }

  private async getMonitoringMetrics(): Promise<MonitoringCosts> {
    return {
      logs_ingested_gb: 10,
      metrics_samples: 1000000,
      estimated_cost: 20
    };
  }

  private calculateTotalCost(services: ServiceCosts): number {
    return (
      services.cloudflare.workers.estimated_cost +
      services.cloudflare.pages.estimated_cost +
      services.cloudflare.r2.estimated_cost +
      services.cloudflare.analytics.estimated_cost +
      services.database.neon.estimated_cost +
      services.database.hyperdrive.estimated_cost +
      services.thirdParty.upstash_redis.estimated_cost +
      services.thirdParty.sendgrid.estimated_cost +
      services.thirdParty.stripe.estimated_cost +
      services.storage.estimated_cost +
      services.monitoring.estimated_cost
    );
  }

  private async calculateCostTrends(currentCost: number): Promise<CostTrends> {
    // Get historical costs from Redis
    const hourlyHistory = await this.getHistoricalCosts('hourly', 24);
    const dailyHistory = await this.getHistoricalCosts('daily', 30);

    const previousHourCost = hourlyHistory[hourlyHistory.length - 2] || currentCost;
    const previousDayCost = dailyHistory[dailyHistory.length - 2] || currentCost;

    const hourlyChange = ((currentCost - previousHourCost) / previousHourCost) * 100;
    const dailyChange = ((currentCost - previousDayCost) / previousDayCost) * 100;

    // Project monthly cost based on current daily average
    const avgDailyCost = dailyHistory.reduce((sum, cost) => sum + cost, 0) / dailyHistory.length;
    const projectedMonthlyCost = avgDailyCost * 30;

    return {
      hourly_change_percent: hourlyChange,
      daily_change_percent: dailyChange,
      monthly_change_percent: 0, // Calculate from monthly history
      projected_monthly_cost: projectedMonthlyCost
    };
  }

  private async generateOptimizations(services: ServiceCosts): Promise<CostOptimization[]> {
    const optimizations: CostOptimization[] = [];

    // Cloudflare Workers optimizations
    if (services.cloudflare.workers.cpu_time_ms > 10000000) { // 10M CPU ms
      optimizations.push({
        category: 'cloudflare-workers',
        recommendation: 'Optimize Worker code to reduce CPU time usage',
        estimated_savings_usd: services.cloudflare.workers.breakdown.cpu_cost * 0.3,
        implementation_effort: 'medium',
        priority: 'high',
        automated: false
      });
    }

    // R2 storage optimizations
    if (services.cloudflare.r2.storage_gb > 100) {
      optimizations.push({
        category: 'r2-storage',
        recommendation: 'Implement automated cleanup of old files',
        estimated_savings_usd: services.cloudflare.r2.storage_gb * 0.015 * 0.2, // 20% savings
        implementation_effort: 'low',
        priority: 'medium',
        automated: true
      });
    }

    // Database optimizations
    if (services.database.neon.compute_hours > 500) {
      optimizations.push({
        category: 'database',
        recommendation: 'Implement connection pooling and query optimization',
        estimated_savings_usd: services.database.neon.estimated_cost * 0.25,
        implementation_effort: 'high',
        priority: 'high',
        automated: false
      });
    }

    return optimizations;
  }

  private async analyzeCloudflareUsage(cf: CloudflareCosts): Promise<CostAlert[]> {
    const alerts: CostAlert[] = [];

    // Check for excessive CPU usage
    if (cf.workers.cpu_time_ms > 15000000) { // 15M CPU ms per hour
      alerts.push({
        type: 'waste_detected',
        severity: 'warning',
        message: 'High Worker CPU usage detected - potential inefficient code',
        cost_impact_usd: cf.workers.breakdown.cpu_cost,
        service: 'cloudflare-workers',
        recommendation: 'Review and optimize Worker code for CPU efficiency'
      });
    }

    return alerts;
  }

  private async analyzeDatabaseUsage(db: DatabaseCosts): Promise<CostAlert[]> {
    const alerts: CostAlert[] = [];

    // Check for excessive compute usage
    if (db.neon.compute_hours > 24) { // More than 24 hours in a day
      alerts.push({
        type: 'unusual_spike',
        severity: 'critical',
        message: 'Database compute usage exceeds expected limits',
        cost_impact_usd: db.neon.estimated_cost,
        service: 'neon-database',
        recommendation: 'Review database queries and connection management'
      });
    }

    return alerts;
  }

  private async analyzeThirdPartyUsage(tp: ThirdPartyCosts): Promise<CostAlert[]> {
    const alerts: CostAlert[] = [];

    // Check Stripe transaction volume
    if (tp.stripe.volume_usd > 50000) {
      alerts.push({
        type: 'optimization_opportunity',
        severity: 'info',
        message: 'High transaction volume - consider negotiating better Stripe rates',
        cost_impact_usd: tp.stripe.volume_usd * 0.005, // Potential 0.5% savings
        service: 'stripe',
        recommendation: 'Contact Stripe for enterprise pricing discussion'
      });
    }

    return alerts;
  }

  private async identifySpikingService(metrics: CostMetrics): Promise<string> {
    // Compare current costs with historical averages to identify the spiking service
    // This is a simplified implementation
    return 'cloudflare-workers';
  }

  private async executeOptimization(optimization: CostOptimization): Promise<void> {
    switch (optimization.category) {
      case 'r2-storage':
        if (optimization.recommendation.includes('cleanup')) {
          await this.cleanupOldR2Files();
        }
        break;
      
      case 'cloudflare-workers':
        // Automated optimizations could include cache adjustments, etc.
        break;
      
      default:
        throw new Error(`No automation available for ${optimization.category}`);
    }
  }

  private async cleanupOldR2Files(): Promise<void> {
    // Implementation would connect to R2 and clean up old files
    // This is a placeholder
    console.log('Executing automated R2 cleanup...');
  }

  private async getHistoricalCosts(period: string, count: number): Promise<number[]> {
    if (!this.redis) return [];
    
    try {
      const key = `cost_history:${period}`;
      const history = await this.redis.lrange(key, -count, -1);
      return history.map((cost: string) => parseFloat(cost));
    } catch (error) {
      console.error('Failed to get historical costs:', error);
      return [];
    }
  }

  private async storeCostAlerts(alerts: CostAlert[]): Promise<void> {
    if (!this.redis) return;

    try {
      const key = 'cost_alerts:latest';
      await this.redis.setex(key, 3600, JSON.stringify(alerts)); // Store for 1 hour
    } catch (error) {
      console.error('Failed to store cost alerts:', error);
    }
  }

  // Public method to get Prometheus metrics format
  async getPrometheusMetrics(): Promise<string> {
    const metrics = await this.getCostMetrics();
    const timestamp = Date.now();

    return `
# HELP cost_total_usd Total estimated cost in USD
# TYPE cost_total_usd gauge
cost_total_usd ${metrics.total} ${timestamp}

# HELP cost_cloudflare_workers_usd Cloudflare Workers cost
# TYPE cost_cloudflare_workers_usd gauge
cost_cloudflare_workers_usd ${metrics.services.cloudflare.workers.estimated_cost} ${timestamp}

# HELP cost_database_usd Database cost
# TYPE cost_database_usd gauge  
cost_database_usd ${metrics.services.database.neon.estimated_cost} ${timestamp}

# HELP cost_projected_monthly_usd Projected monthly cost
# TYPE cost_projected_monthly_usd gauge
cost_projected_monthly_usd ${metrics.trends.projected_monthly_cost} ${timestamp}

# HELP cloudflare_workers_requests_total Total Worker requests
# TYPE cloudflare_workers_requests_total counter
cloudflare_workers_requests_total ${metrics.services.cloudflare.workers.requests} ${timestamp}

# HELP cloudflare_workers_cpu_time_ms Total Worker CPU time
# TYPE cloudflare_workers_cpu_time_ms counter
cloudflare_workers_cpu_time_ms ${metrics.services.cloudflare.workers.cpu_time_ms} ${timestamp}
`.trim();
  }
}

// Factory function to create cost monitor
export function createCostMonitor(env: any, redis?: any): CostMonitor {
  return new CostMonitor(env, redis);
}