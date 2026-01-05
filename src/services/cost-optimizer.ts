/**
 * Container Cost Optimization and Monitoring Service
 * Tracks spending, predicts costs, and optimizes resource usage
 */

import { DatabaseConnectionManager } from '../config/hyperdrive-config';

export interface CostMetrics {
  daily_cost: number;
  monthly_projection: number;
  cost_per_job: number;
  efficiency_score: number;
  top_cost_drivers: Array<{
    container_type: string;
    cost_percentage: number;
    optimization_suggestions: string[];
  }>;
}

export interface BudgetAlert {
  id: string;
  alert_type: 'budget_threshold' | 'cost_spike' | 'efficiency_drop';
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold_value: number;
  current_value: number;
  description: string;
  recommended_actions: string[];
  created_at: Date;
}

export interface OptimizationRecommendation {
  type: 'scaling' | 'scheduling' | 'resource_allocation' | 'queue_optimization';
  container_type: string;
  current_config: any;
  recommended_config: any;
  estimated_savings_usd: number;
  implementation_effort: 'low' | 'medium' | 'high';
  risk_level: 'low' | 'medium' | 'high';
}

/**
 * Cost Optimization Engine
 */
export class CostOptimizer {
  private dbManager: DatabaseConnectionManager;
  private env: Env;

  // Cloudflare Container Pricing (as of 2024)
  private readonly PRICING = {
    'lite': {
      cpu: 0.001,      // $0.001 per vCPU per second
      memory: 0.000125, // $0.000125 per GB per second
      base: 0.0006     // Base cost per minute
    },
    'standard-1': {
      cpu: 0.002,
      memory: 0.00025,
      base: 0.0012
    },
    'standard-2': {
      cpu: 0.004,
      memory: 0.0005,
      base: 0.0024
    },
    'standard-4': {
      cpu: 0.008,
      memory: 0.001,
      base: 0.0048
    }
  };

  constructor(env: Env) {
    this.env = env;
    this.dbManager = new DatabaseConnectionManager(env);
  }

  /**
   * Calculate real-time cost metrics
   */
  async getCostMetrics(): Promise<CostMetrics> {
    const db = this.dbManager.getConnection('read');
    
    // Get today's costs
    const dailyCosts = await db`
      SELECT 
        container_type,
        SUM(total_cost_usd) as cost,
        SUM(total_job_count) as jobs,
        AVG(total_instance_hours) as avg_hours
      FROM container_costs 
      WHERE date = CURRENT_DATE
      GROUP BY container_type
    `;

    // Calculate total daily cost
    const totalDailyCost = dailyCosts.reduce((sum, row) => sum + parseFloat(row.cost), 0);
    const totalJobs = dailyCosts.reduce((sum, row) => sum + parseInt(row.jobs), 0);

    // Monthly projection (30-day average)
    const monthlyProjection = await db`
      SELECT AVG(daily_total) * 30 as monthly_projection
      FROM (
        SELECT date, SUM(total_cost_usd) as daily_total
        FROM container_costs
        WHERE date > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY date
      ) daily_totals
    `;

    // Calculate efficiency score (jobs completed per dollar spent)
    const efficiencyData = await db`
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        SUM(estimated_cost_usd) as total_cost
      FROM container_jobs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const completedJobs = parseInt(efficiencyData[0]?.completed_jobs || 0);
    const totalSpent = parseFloat(efficiencyData[0]?.total_cost || 0);
    const efficiencyScore = totalSpent > 0 ? (completedJobs / totalSpent) * 100 : 0;

    // Identify top cost drivers
    const topCostDrivers = dailyCosts
      .map(row => ({
        container_type: row.container_type,
        cost_percentage: totalDailyCost > 0 ? (parseFloat(row.cost) / totalDailyCost) * 100 : 0,
        optimization_suggestions: this.generateOptimizationSuggestions(row)
      }))
      .sort((a, b) => b.cost_percentage - a.cost_percentage)
      .slice(0, 5);

    return {
      daily_cost: totalDailyCost,
      monthly_projection: parseFloat(monthlyProjection[0]?.monthly_projection || 0),
      cost_per_job: totalJobs > 0 ? totalDailyCost / totalJobs : 0,
      efficiency_score: Math.round(efficiencyScore),
      top_cost_drivers: topCostDrivers
    };
  }

  /**
   * Generate optimization suggestions for container type
   */
  private generateOptimizationSuggestions(costData: any): string[] {
    const suggestions: string[] = [];
    const avgHours = parseFloat(costData.avg_hours);
    const costPerJob = parseFloat(costData.cost) / parseInt(costData.jobs);

    if (avgHours > 8) {
      suggestions.push('Consider reducing max_instances or idle_timeout');
    }

    if (costPerJob > 0.05) {
      suggestions.push('Optimize batch processing or use smaller instance types');
    }

    if (costData.container_type === 'video-processing' && costPerJob > 0.10) {
      suggestions.push('Implement video pre-processing to reduce container time');
    }

    if (costData.container_type === 'ai-inference' && costPerJob > 0.15) {
      suggestions.push('Consider model optimization or caching strategies');
    }

    return suggestions;
  }

  /**
   * Monitor budget and generate alerts
   */
  async checkBudgetAlerts(): Promise<BudgetAlert[]> {
    const alerts: BudgetAlert[] = [];
    const metrics = await this.getCostMetrics();

    // Daily budget alert ($50/day default)
    const dailyBudget = parseFloat(this.env.DAILY_BUDGET_USD || '50');
    if (metrics.daily_cost > dailyBudget * 0.8) {
      alerts.push({
        id: crypto.randomUUID(),
        alert_type: 'budget_threshold',
        severity: metrics.daily_cost > dailyBudget ? 'critical' : 'high',
        threshold_value: dailyBudget,
        current_value: metrics.daily_cost,
        description: `Daily cost $${metrics.daily_cost.toFixed(2)} approaching budget limit of $${dailyBudget}`,
        recommended_actions: [
          'Review auto-scaling settings',
          'Check for stuck or inefficient jobs',
          'Consider pausing non-critical containers'
        ],
        created_at: new Date()
      });
    }

    // Monthly projection alert
    const monthlyBudget = parseFloat(this.env.MONTHLY_BUDGET_USD || '1000');
    if (metrics.monthly_projection > monthlyBudget * 0.9) {
      alerts.push({
        id: crypto.randomUUID(),
        alert_type: 'budget_threshold',
        severity: 'high',
        threshold_value: monthlyBudget,
        current_value: metrics.monthly_projection,
        description: `Monthly projection $${metrics.monthly_projection.toFixed(2)} exceeds budget of $${monthlyBudget}`,
        recommended_actions: [
          'Implement stricter auto-scaling policies',
          'Review job priorities and optimize queue processing',
          'Consider capacity planning adjustments'
        ],
        created_at: new Date()
      });
    }

    // Cost spike detection
    const avgDailyCost = await this.getAverageDailyCost();
    if (metrics.daily_cost > avgDailyCost * 2) {
      alerts.push({
        id: crypto.randomUUID(),
        alert_type: 'cost_spike',
        severity: 'high',
        threshold_value: avgDailyCost * 2,
        current_value: metrics.daily_cost,
        description: `Cost spike detected: Current daily cost is ${((metrics.daily_cost / avgDailyCost) * 100).toFixed(0)}% above average`,
        recommended_actions: [
          'Check for runaway containers or jobs',
          'Review recent job submissions for anomalies',
          'Verify auto-scaling is working correctly'
        ],
        created_at: new Date()
      });
    }

    // Efficiency drop alert
    if (metrics.efficiency_score < 50) {
      alerts.push({
        id: crypto.randomUUID(),
        alert_type: 'efficiency_drop',
        severity: 'medium',
        threshold_value: 50,
        current_value: metrics.efficiency_score,
        description: `Low efficiency score: ${metrics.efficiency_score} jobs per dollar`,
        recommended_actions: [
          'Review failed jobs and error patterns',
          'Optimize container configurations',
          'Consider job batching improvements'
        ],
        created_at: new Date()
      });
    }

    return alerts;
  }

  /**
   * Get average daily cost over past 30 days
   */
  private async getAverageDailyCost(): Promise<number> {
    const db = this.dbManager.getConnection('read');
    
    const result = await db`
      SELECT AVG(daily_total) as avg_daily_cost
      FROM (
        SELECT date, SUM(total_cost_usd) as daily_total
        FROM container_costs
        WHERE date > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY date
      ) daily_totals
    `;

    return parseFloat(result[0]?.avg_daily_cost || 0);
  }

  /**
   * Generate optimization recommendations
   */
  async generateOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const db = this.dbManager.getConnection('read');

    // Analyze container utilization
    const utilizationData = await db`
      SELECT 
        ci.container_type,
        ci.instance_type,
        AVG(ci.cpu_usage_percent) as avg_cpu,
        AVG(ci.memory_usage_percent) as avg_memory,
        COUNT(CASE WHEN ci.status = 'ready' AND ci.active_jobs_count = 0 THEN 1 END) as idle_instances
      FROM container_instances ci
      WHERE ci.last_health_check > NOW() - INTERVAL '1 hour'
      GROUP BY ci.container_type, ci.instance_type
    `;

    for (const data of utilizationData) {
      const avgCpu = parseFloat(data.avg_cpu || 0);
      const avgMemory = parseFloat(data.avg_memory || 0);
      const idleInstances = parseInt(data.idle_instances || 0);

      // CPU under-utilization recommendation
      if (avgCpu < 30 && data.instance_type !== 'lite') {
        const currentType = data.instance_type;
        const recommendedType = this.getDowngradedInstanceType(currentType);
        
        if (recommendedType) {
          recommendations.push({
            type: 'resource_allocation',
            container_type: data.container_type,
            current_config: { instance_type: currentType },
            recommended_config: { instance_type: recommendedType },
            estimated_savings_usd: this.calculateSavingsForDowngrade(currentType, recommendedType),
            implementation_effort: 'medium',
            risk_level: 'low'
          });
        }
      }

      // Excessive idle instances recommendation
      if (idleInstances > 2) {
        recommendations.push({
          type: 'scaling',
          container_type: data.container_type,
          current_config: { min_instances: 'auto-detected' },
          recommended_config: { 
            min_instances: Math.max(1, idleInstances - 1),
            idle_timeout: 300 
          },
          estimated_savings_usd: idleInstances * this.getPricingForType(data.instance_type).base * 60,
          implementation_effort: 'low',
          risk_level: 'low'
        });
      }
    }

    // Queue optimization recommendations
    const queueData = await db`
      SELECT 
        type,
        AVG(processing_time_seconds) as avg_processing_time,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
        COUNT(*) as total_jobs
      FROM container_jobs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY type
    `;

    for (const queue of queueData) {
      const failureRate = parseInt(queue.failed_jobs) / parseInt(queue.total_jobs);
      
      if (failureRate > 0.05) { // >5% failure rate
        recommendations.push({
          type: 'queue_optimization',
          container_type: queue.type,
          current_config: { max_retries: 3 },
          recommended_config: { 
            max_retries: 2,
            timeout_seconds: Math.round(parseFloat(queue.avg_processing_time) * 1.5)
          },
          estimated_savings_usd: this.calculateFailureReductionSavings(queue),
          implementation_effort: 'low',
          risk_level: 'medium'
        });
      }
    }

    // Schedule-based recommendations
    const hourlyUsage = await db`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as job_count
      FROM container_jobs
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY job_count DESC
    `;

    const peakHours = hourlyUsage.slice(0, 8).map(h => parseInt(h.hour));
    const offPeakHours = hourlyUsage.slice(-8).map(h => parseInt(h.hour));

    if (peakHours.length > 0 && offPeakHours.length > 0) {
      recommendations.push({
        type: 'scheduling',
        container_type: 'all',
        current_config: { scaling_policy: 'reactive' },
        recommended_config: { 
          peak_hours: peakHours,
          off_peak_hours: offPeakHours,
          pre_warm_containers: true
        },
        estimated_savings_usd: 50, // Estimated monthly savings
        implementation_effort: 'high',
        risk_level: 'medium'
      });
    }

    return recommendations.sort((a, b) => b.estimated_savings_usd - a.estimated_savings_usd);
  }

  /**
   * Get downgraded instance type
   */
  private getDowngradedInstanceType(currentType: string): string | null {
    const downgrades: Record<string, string> = {
      'standard-4': 'standard-2',
      'standard-2': 'standard-1',
      'standard-1': 'lite'
    };
    return downgrades[currentType] || null;
  }

  /**
   * Calculate savings for instance type downgrade
   */
  private calculateSavingsForDowngrade(currentType: string, newType: string): number {
    const currentPricing = this.getPricingForType(currentType);
    const newPricing = this.getPricingForType(newType);
    
    // Estimate based on 8 hours daily usage
    const dailySavings = (currentPricing.base - newPricing.base) * 60 * 8;
    return dailySavings * 30; // Monthly savings
  }

  /**
   * Get pricing for instance type
   */
  private getPricingForType(instanceType: string): any {
    return this.PRICING[instanceType as keyof typeof this.PRICING] || this.PRICING['lite'];
  }

  /**
   * Calculate savings from reducing failure rates
   */
  private calculateFailureReductionSavings(queueData: any): number {
    const failedJobs = parseInt(queueData.failed_jobs);
    const avgProcessingTime = parseFloat(queueData.avg_processing_time);
    const instanceType = this.getInstanceTypeForContainer(queueData.type);
    const pricing = this.getPricingForType(instanceType);
    
    // Calculate cost of failed processing time
    const failureCost = (failedJobs * avgProcessingTime * pricing.base) / 60;
    
    // Assume 50% reduction in failures
    return failureCost * 0.5 * 30; // Monthly savings
  }

  /**
   * Map container type to instance type
   */
  private getInstanceTypeForContainer(containerType: string): string {
    const mapping: Record<string, string> = {
      'video-processing': 'standard-2',
      'document-processing': 'standard-1',
      'ai-inference': 'standard-4',
      'media-transcoding': 'standard-2',
      'code-execution': 'lite'
    };
    return mapping[containerType] || 'standard-1';
  }

  /**
   * Apply optimization recommendation
   */
  async applyRecommendation(recommendationId: string, recommendation: OptimizationRecommendation): Promise<boolean> {
    try {
      switch (recommendation.type) {
        case 'scaling':
          return await this.updateScalingConfig(recommendation);
        case 'resource_allocation':
          return await this.updateResourceConfig(recommendation);
        case 'queue_optimization':
          return await this.updateQueueConfig(recommendation);
        case 'scheduling':
          return await this.updateSchedulingConfig(recommendation);
        default:
          return false;
      }
    } catch (error) {
      console.error('Failed to apply optimization:', error);
      return false;
    }
  }

  /**
   * Update scaling configuration
   */
  private async updateScalingConfig(recommendation: OptimizationRecommendation): Promise<boolean> {
    // This would update the wrangler.toml configuration
    // For now, just log the recommendation
    console.log(`Scaling optimization for ${recommendation.container_type}:`, recommendation.recommended_config);
    
    // Store recommendation in database for manual review
    const db = this.dbManager.getConnection('write');
    await db`
      INSERT INTO optimization_recommendations (
        type, container_type, recommended_config, estimated_savings, created_at, status
      ) VALUES (
        ${recommendation.type}, 
        ${recommendation.container_type}, 
        ${JSON.stringify(recommendation.recommended_config)}, 
        ${recommendation.estimated_savings_usd}, 
        NOW(), 
        'pending_review'
      )
    `;

    return true;
  }

  /**
   * Update resource configuration
   */
  private async updateResourceConfig(recommendation: OptimizationRecommendation): Promise<boolean> {
    console.log(`Resource optimization for ${recommendation.container_type}:`, recommendation.recommended_config);
    return true;
  }

  /**
   * Update queue configuration
   */
  private async updateQueueConfig(recommendation: OptimizationRecommendation): Promise<boolean> {
    console.log(`Queue optimization for ${recommendation.container_type}:`, recommendation.recommended_config);
    return true;
  }

  /**
   * Update scheduling configuration
   */
  private async updateSchedulingConfig(recommendation: OptimizationRecommendation): Promise<boolean> {
    console.log(`Scheduling optimization:`, recommendation.recommended_config);
    return true;
  }

  /**
   * Generate cost report
   */
  async generateCostReport(days: number = 30): Promise<any> {
    const db = this.dbManager.getConnection('read');
    
    const report = await db`
      SELECT 
        date,
        container_type,
        SUM(total_cost_usd) as daily_cost,
        SUM(total_job_count) as daily_jobs,
        SUM(total_instance_hours) as daily_hours,
        CASE 
          WHEN SUM(total_job_count) > 0 
          THEN SUM(total_cost_usd) / SUM(total_job_count)
          ELSE 0 
        END as cost_per_job
      FROM container_costs
      WHERE date > CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY date, container_type
      ORDER BY date DESC, container_type
    `;

    const summary = {
      report_period: `${days} days`,
      total_cost: report.reduce((sum, row) => sum + parseFloat(row.daily_cost), 0),
      total_jobs: report.reduce((sum, row) => sum + parseInt(row.daily_jobs), 0),
      avg_cost_per_job: 0,
      cost_by_container: {} as Record<string, number>,
      daily_breakdown: report
    };

    // Calculate average cost per job
    if (summary.total_jobs > 0) {
      summary.avg_cost_per_job = summary.total_cost / summary.total_jobs;
    }

    // Group costs by container type
    for (const row of report) {
      const type = row.container_type;
      summary.cost_by_container[type] = (summary.cost_by_container[type] || 0) + parseFloat(row.daily_cost);
    }

    return summary;
  }

  /**
   * Set cost alerts and thresholds
   */
  async setCostAlert(
    alertType: 'daily' | 'monthly' | 'per_job',
    threshold: number,
    containerType?: string
  ): Promise<void> {
    await this.env.CONTAINER_CONFIG_KV.put(
      `cost_alert:${alertType}${containerType ? `:${containerType}` : ''}`,
      JSON.stringify({
        threshold,
        enabled: true,
        created_at: new Date().toISOString()
      })
    );
  }
}

/**
 * Cost monitoring cron job handler
 */
export async function handleCostMonitoring(env: Env): Promise<void> {
  const optimizer = new CostOptimizer(env);
  
  try {
    // Check for budget alerts
    const alerts = await optimizer.checkBudgetAlerts();
    
    if (alerts.length > 0) {
      // Send alerts to monitoring webhooks
      for (const alert of alerts) {
        if (env.COST_ALERTS_WEBHOOK) {
          await fetch(env.COST_ALERTS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert)
          });
        }
      }
    }

    // Generate and apply recommendations daily
    if (new Date().getHours() === 2) { // 2 AM daily
      const recommendations = await optimizer.generateOptimizationRecommendations();
      
      // Auto-apply low-risk, high-impact recommendations
      for (const rec of recommendations) {
        if (rec.risk_level === 'low' && rec.estimated_savings_usd > 10) {
          await optimizer.applyRecommendation(crypto.randomUUID(), rec);
        }
      }
    }

    console.log('Cost monitoring completed successfully');
  } catch (error) {
    console.error('Cost monitoring failed:', error);
  }
}