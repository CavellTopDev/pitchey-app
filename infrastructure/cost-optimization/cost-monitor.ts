/**
 * Cost Monitoring Service
 * Real-time cost tracking and analysis for all cloud services
 */

import { Redis } from '@upstash/redis/cloudflare';

export interface ServiceCost {
  service: string;
  provider: string;
  cost: number;
  usage: Record<string, number>;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface CostAlert {
  id: string;
  type: 'threshold' | 'anomaly' | 'forecast';
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  message: string;
  currentCost: number;
  threshold?: number;
  timestamp: number;
}

export interface CostForecast {
  service: string;
  currentMonthProjected: number;
  nextMonthProjected: number;
  confidence: number;
  recommendations: string[];
}

export class CostMonitor {
  private redis: Redis;
  private alertThresholds: Map<string, number> = new Map();
  private costHistory: Map<string, ServiceCost[]> = new Map();
  
  constructor(redisUrl: string, redisToken: string) {
    this.redis = new Redis({
      url: redisUrl,
      token: redisToken
    });
    
    this.initializeThresholds();
  }
  
  private initializeThresholds(): void {
    // Set default spending thresholds
    this.alertThresholds.set('cloudflare', 500);
    this.alertThresholds.set('neon', 800);
    this.alertThresholds.set('upstash', 200);
    this.alertThresholds.set('github', 150);
    this.alertThresholds.set('total', 1650);
  }
  
  /**
   * Track cost for a service
   */
  async trackCost(serviceCost: ServiceCost): Promise<void> {
    const key = `cost:${serviceCost.service}:${serviceCost.timestamp}`;
    
    // Store in Redis with 90-day retention
    await this.redis.setex(key, 7776000, JSON.stringify(serviceCost));
    
    // Update running totals
    await this.updateRunningTotals(serviceCost);
    
    // Check for alerts
    await this.checkAlerts(serviceCost);
    
    // Update cost history
    const history = this.costHistory.get(serviceCost.service) || [];
    history.push(serviceCost);
    
    // Keep last 30 days of history in memory
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.costHistory.set(
      serviceCost.service,
      history.filter(h => h.timestamp > thirtyDaysAgo)
    );
  }
  
  /**
   * Get current month costs
   */
  async getCurrentMonthCosts(): Promise<Record<string, number>> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const costs: Record<string, number> = {};
    
    for (const service of ['cloudflare', 'neon', 'upstash', 'github']) {
      const monthKey = `monthly:${service}:${startOfMonth.getTime()}`;
      const cost = await this.redis.get<number>(monthKey);
      costs[service] = cost || 0;
    }
    
    costs.total = Object.values(costs).reduce((a, b) => a + b, 0);
    return costs;
  }
  
  /**
   * Generate cost forecast
   */
  async generateForecast(service: string): Promise<CostForecast> {
    const history = this.costHistory.get(service) || [];
    
    if (history.length < 7) {
      return {
        service,
        currentMonthProjected: 0,
        nextMonthProjected: 0,
        confidence: 0,
        recommendations: ['Insufficient data for accurate forecast']
      };
    }
    
    // Simple linear regression for forecasting
    const recentCosts = history.slice(-30);
    const dailyAverage = recentCosts.reduce((sum, c) => sum + c.cost, 0) / recentCosts.length;
    
    const daysInCurrentMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();
    
    const currentMonthProjected = dailyAverage * daysInCurrentMonth;
    
    // Trend analysis
    const weeklyAverages = this.calculateWeeklyAverages(recentCosts);
    const trend = this.calculateTrend(weeklyAverages);
    
    const nextMonthProjected = currentMonthProjected * (1 + trend);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(service, {
      currentMonthProjected,
      trend,
      dailyAverage
    });
    
    return {
      service,
      currentMonthProjected,
      nextMonthProjected,
      confidence: Math.min(history.length / 30, 1) * 0.85, // Max 85% confidence
      recommendations
    };
  }
  
  /**
   * Get cost optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<Array<{
    service: string;
    recommendation: string;
    estimatedSavings: number;
    implementation: string;
    priority: 'low' | 'medium' | 'high';
  }>> {
    const recommendations = [];
    
    // Analyze Cloudflare usage
    const cfMetrics = await this.getServiceMetrics('cloudflare');
    if (cfMetrics.cacheHitRate < 0.8) {
      recommendations.push({
        service: 'cloudflare',
        recommendation: 'Improve cache hit rate',
        estimatedSavings: 50,
        implementation: 'Increase cache TTL and optimize cache keys',
        priority: 'high' as const
      });
    }
    
    // Analyze Neon usage
    const neonMetrics = await this.getServiceMetrics('neon');
    if (neonMetrics.idleTime > 0.4) {
      recommendations.push({
        service: 'neon',
        recommendation: 'Enable auto-suspend for idle databases',
        estimatedSavings: 150,
        implementation: 'Set auto-suspend to 5 minutes of inactivity',
        priority: 'high' as const
      });
    }
    
    if (neonMetrics.branchCount > 5) {
      recommendations.push({
        service: 'neon',
        recommendation: 'Reduce preview branch lifetime',
        estimatedSavings: 100,
        implementation: 'Set TTL to 4 hours for preview branches',
        priority: 'medium' as const
      });
    }
    
    // Analyze Redis usage
    const redisMetrics = await this.getServiceMetrics('upstash');
    if (redisMetrics.keyCount > 100000) {
      recommendations.push({
        service: 'upstash',
        recommendation: 'Implement aggressive key expiry',
        estimatedSavings: 30,
        implementation: 'Set TTL for all cache keys, remove unused keys',
        priority: 'medium' as const
      });
    }
    
    // GitHub Actions optimization
    const ghMetrics = await this.getServiceMetrics('github');
    if (ghMetrics.averageRunTime > 600) {
      recommendations.push({
        service: 'github',
        recommendation: 'Optimize CI/CD pipeline',
        estimatedSavings: 40,
        implementation: 'Parallelize tests, cache dependencies, use matrix builds',
        priority: 'medium' as const
      });
    }
    
    return recommendations;
  }
  
  /**
   * Set budget alert threshold
   */
  async setBudgetAlert(service: string, threshold: number): Promise<void> {
    this.alertThresholds.set(service, threshold);
    await this.redis.set(`threshold:${service}`, threshold);
  }
  
  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<CostAlert[]> {
    const alerts: CostAlert[] = [];
    const currentCosts = await this.getCurrentMonthCosts();
    
    for (const [service, threshold] of this.alertThresholds) {
      const currentCost = currentCosts[service] || 0;
      
      if (currentCost > threshold) {
        alerts.push({
          id: `alert-${service}-${Date.now()}`,
          type: 'threshold',
          severity: currentCost > threshold * 1.5 ? 'critical' : 'high',
          service,
          message: `${service} costs exceed threshold`,
          currentCost,
          threshold,
          timestamp: Date.now()
        });
      }
      
      // Check for anomalies
      const anomaly = await this.detectAnomaly(service, currentCost);
      if (anomaly) {
        alerts.push(anomaly);
      }
    }
    
    return alerts;
  }
  
  /**
   * Private helper methods
   */
  
  private async updateRunningTotals(serviceCost: ServiceCost): Promise<void> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthKey = `monthly:${serviceCost.service}:${startOfMonth.getTime()}`;
    const currentTotal = await this.redis.get<number>(monthKey) || 0;
    
    await this.redis.set(monthKey, currentTotal + serviceCost.cost);
    
    // Update daily total
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `daily:${serviceCost.service}:${today}`;
    const dailyTotal = await this.redis.get<number>(dailyKey) || 0;
    
    await this.redis.setex(dailyKey, 86400 * 7, dailyTotal + serviceCost.cost);
  }
  
  private async checkAlerts(serviceCost: ServiceCost): Promise<void> {
    const threshold = this.alertThresholds.get(serviceCost.service);
    if (!threshold) return;
    
    const currentMonthCost = await this.getServiceMonthCost(serviceCost.service);
    
    if (currentMonthCost > threshold * 0.8 && currentMonthCost <= threshold) {
      // Send warning alert at 80%
      await this.sendAlert({
        id: `warn-${serviceCost.service}-${Date.now()}`,
        type: 'threshold',
        severity: 'medium',
        service: serviceCost.service,
        message: `${serviceCost.service} costs at 80% of budget`,
        currentCost: currentMonthCost,
        threshold,
        timestamp: Date.now()
      });
    }
  }
  
  private async getServiceMonthCost(service: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthKey = `monthly:${service}:${startOfMonth.getTime()}`;
    return await this.redis.get<number>(monthKey) || 0;
  }
  
  private async detectAnomaly(service: string, currentCost: number): Promise<CostAlert | null> {
    const history = this.costHistory.get(service) || [];
    if (history.length < 7) return null;
    
    const recentAverage = history.slice(-7).reduce((sum, h) => sum + h.cost, 0) / 7;
    const stdDev = this.calculateStandardDeviation(history.slice(-7).map(h => h.cost));
    
    if (currentCost > recentAverage + (2 * stdDev)) {
      return {
        id: `anomaly-${service}-${Date.now()}`,
        type: 'anomaly',
        severity: 'high',
        service,
        message: `Unusual spike in ${service} costs detected`,
        currentCost,
        timestamp: Date.now()
      };
    }
    
    return null;
  }
  
  private calculateWeeklyAverages(costs: ServiceCost[]): number[] {
    const weeks: number[] = [];
    const weekSize = 7;
    
    for (let i = 0; i < costs.length; i += weekSize) {
      const weekCosts = costs.slice(i, i + weekSize);
      const average = weekCosts.reduce((sum, c) => sum + c.cost, 0) / weekCosts.length;
      weeks.push(average);
    }
    
    return weeks;
  }
  
  private calculateTrend(weeklyAverages: number[]): number {
    if (weeklyAverages.length < 2) return 0;
    
    const firstWeek = weeklyAverages[0];
    const lastWeek = weeklyAverages[weeklyAverages.length - 1];
    
    return (lastWeek - firstWeek) / firstWeek;
  }
  
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  private generateRecommendations(
    service: string,
    metrics: { currentMonthProjected: number; trend: number; dailyAverage: number }
  ): string[] {
    const recommendations: string[] = [];
    
    if (metrics.trend > 0.1) {
      recommendations.push(`Costs increasing ${(metrics.trend * 100).toFixed(1)}% - review usage patterns`);
    }
    
    const threshold = this.alertThresholds.get(service) || 0;
    if (metrics.currentMonthProjected > threshold * 0.9) {
      recommendations.push('Consider increasing budget or optimizing usage');
    }
    
    // Service-specific recommendations
    switch (service) {
      case 'cloudflare':
        if (metrics.dailyAverage > 20) {
          recommendations.push('Enable more aggressive caching');
          recommendations.push('Optimize Worker bundle size');
        }
        break;
      case 'neon':
        if (metrics.dailyAverage > 30) {
          recommendations.push('Review database branch lifecycle');
          recommendations.push('Enable auto-suspend for idle compute');
        }
        break;
      case 'upstash':
        if (metrics.dailyAverage > 10) {
          recommendations.push('Implement key expiry policies');
          recommendations.push('Consider data compression');
        }
        break;
    }
    
    return recommendations;
  }
  
  private async getServiceMetrics(service: string): Promise<any> {
    // This would fetch actual metrics from each service's API
    // Placeholder implementation
    return {
      cacheHitRate: 0.75,
      idleTime: 0.5,
      branchCount: 6,
      keyCount: 150000,
      averageRunTime: 700
    };
  }
  
  private async sendAlert(alert: CostAlert): Promise<void> {
    // Store alert
    await this.redis.lpush('cost-alerts', JSON.stringify(alert));
    await this.redis.ltrim('cost-alerts', 0, 99);
    
    // In production, this would send to Slack, email, etc.
    console.log('Cost Alert:', alert);
  }
}

// Export singleton instance
export const costMonitor = (env: any) => {
  return new CostMonitor(
    env.UPSTASH_REDIS_REST_URL,
    env.UPSTASH_REDIS_REST_TOKEN
  );
};