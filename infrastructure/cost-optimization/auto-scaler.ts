/**
 * Auto-Scaling Service
 * Intelligent scaling based on traffic patterns and cost optimization
 */

export interface ScalingMetrics {
  cpu: number;
  memory: number;
  requestsPerSecond: number;
  responseTime: number;
  errorRate: number;
  concurrentConnections: number;
  queueDepth: number;
}

export interface ScalingPolicy {
  name: string;
  service: string;
  minInstances: number;
  maxInstances: number;
  targetMetric: keyof ScalingMetrics;
  targetValue: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
  costWeight: number; // 0-1, higher means more cost-conscious
}

export interface ScalingDecision {
  action: 'scale-up' | 'scale-down' | 'maintain';
  currentInstances: number;
  targetInstances: number;
  reason: string;
  estimatedCostImpact: number;
  confidence: number;
}

export interface PredictiveScalingEvent {
  eventName: string;
  expectedTime: Date;
  expectedLoad: number;
  preScaleTime: Date;
  targetInstances: number;
}

export class AutoScaler {
  private policies: Map<string, ScalingPolicy> = new Map();
  private metricsHistory: Map<string, ScalingMetrics[]> = new Map();
  private lastScaleAction: Map<string, number> = new Map();
  private predictedEvents: PredictiveScalingEvent[] = [];
  
  constructor() {
    this.initializeDefaultPolicies();
  }
  
  private initializeDefaultPolicies(): void {
    // Cloudflare Workers scaling policy
    this.policies.set('cloudflare-workers', {
      name: 'cloudflare-workers',
      service: 'cloudflare',
      minInstances: 1,
      maxInstances: 100,
      targetMetric: 'responseTime',
      targetValue: 100, // ms
      scaleUpThreshold: 150,
      scaleDownThreshold: 50,
      cooldownPeriod: 300000, // 5 minutes
      costWeight: 0.7
    });
    
    // Neon database scaling policy
    this.policies.set('neon-compute', {
      name: 'neon-compute',
      service: 'neon',
      minInstances: 1,
      maxInstances: 10,
      targetMetric: 'cpu',
      targetValue: 60,
      scaleUpThreshold: 80,
      scaleDownThreshold: 30,
      cooldownPeriod: 600000, // 10 minutes
      costWeight: 0.8
    });
    
    // Redis connection pool scaling
    this.policies.set('redis-connections', {
      name: 'redis-connections',
      service: 'upstash',
      minInstances: 5,
      maxInstances: 50,
      targetMetric: 'concurrentConnections',
      targetValue: 20,
      scaleUpThreshold: 30,
      scaleDownThreshold: 10,
      cooldownPeriod: 180000, // 3 minutes
      costWeight: 0.6
    });
  }
  
  /**
   * Evaluate scaling decision based on current metrics
   */
  async evaluateScaling(
    service: string,
    currentMetrics: ScalingMetrics,
    currentInstances: number
  ): Promise<ScalingDecision> {
    const policy = this.policies.get(service);
    if (!policy) {
      return {
        action: 'maintain',
        currentInstances,
        targetInstances: currentInstances,
        reason: 'No scaling policy defined',
        estimatedCostImpact: 0,
        confidence: 0
      };
    }
    
    // Check cooldown period
    if (this.isInCooldown(service)) {
      return {
        action: 'maintain',
        currentInstances,
        targetInstances: currentInstances,
        reason: 'In cooldown period',
        estimatedCostImpact: 0,
        confidence: 1
      };
    }
    
    // Store metrics history
    this.updateMetricsHistory(service, currentMetrics);
    
    // Get metric value
    const metricValue = currentMetrics[policy.targetMetric];
    
    // Calculate scaling decision
    let decision: ScalingDecision;
    
    if (metricValue > policy.scaleUpThreshold) {
      decision = this.calculateScaleUp(policy, currentInstances, metricValue);
    } else if (metricValue < policy.scaleDownThreshold) {
      decision = this.calculateScaleDown(policy, currentInstances, metricValue);
    } else {
      decision = {
        action: 'maintain',
        currentInstances,
        targetInstances: currentInstances,
        reason: 'Metrics within target range',
        estimatedCostImpact: 0,
        confidence: 0.9
      };
    }
    
    // Apply cost optimization
    decision = this.applyCostOptimization(decision, policy);
    
    // Check predictive scaling
    const predictiveDecision = await this.checkPredictiveScaling(service, currentInstances);
    if (predictiveDecision.confidence > decision.confidence) {
      decision = predictiveDecision;
    }
    
    // Record scaling action
    if (decision.action !== 'maintain') {
      this.lastScaleAction.set(service, Date.now());
    }
    
    return decision;
  }
  
  /**
   * Register a predictive scaling event
   */
  registerPredictiveEvent(event: PredictiveScalingEvent): void {
    this.predictedEvents.push(event);
    
    // Sort by pre-scale time
    this.predictedEvents.sort((a, b) => 
      a.preScaleTime.getTime() - b.preScaleTime.getTime()
    );
    
    // Keep only future events
    const now = new Date();
    this.predictedEvents = this.predictedEvents.filter(e => 
      e.expectedTime > now
    );
  }
  
  /**
   * Get scaling recommendations
   */
  getScalingRecommendations(service: string): Array<{
    recommendation: string;
    impact: 'cost' | 'performance' | 'both';
    priority: 'low' | 'medium' | 'high';
    estimatedSavings?: number;
  }> {
    const recommendations = [];
    const history = this.metricsHistory.get(service) || [];
    
    if (history.length < 10) {
      return [{
        recommendation: 'Insufficient data for recommendations',
        impact: 'both',
        priority: 'low'
      }];
    }
    
    // Analyze scaling patterns
    const avgMetrics = this.calculateAverageMetrics(history);
    const policy = this.policies.get(service);
    
    if (!policy) return recommendations;
    
    // Check if policy thresholds need adjustment
    const scalingFrequency = this.calculateScalingFrequency(service);
    
    if (scalingFrequency > 10) {
      recommendations.push({
        recommendation: 'High scaling frequency detected - consider adjusting thresholds',
        impact: 'both',
        priority: 'high',
        estimatedSavings: 50
      });
    }
    
    // Check for over-provisioning
    if (avgMetrics.cpu < 30 && avgMetrics.memory < 30) {
      recommendations.push({
        recommendation: 'Resources consistently under-utilized - reduce minimum instances',
        impact: 'cost',
        priority: 'medium',
        estimatedSavings: 100
      });
    }
    
    // Check for performance issues
    if (avgMetrics.responseTime > policy.targetValue * 1.5) {
      recommendations.push({
        recommendation: 'Response time consistently high - consider lowering scale-up threshold',
        impact: 'performance',
        priority: 'high'
      });
    }
    
    // Check error rate
    if (avgMetrics.errorRate > 0.01) {
      recommendations.push({
        recommendation: 'Error rate above 1% - may indicate capacity issues',
        impact: 'performance',
        priority: 'high'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Calculate optimal instance count for cost
   */
  calculateOptimalInstanceCount(
    service: string,
    currentMetrics: ScalingMetrics,
    costPerInstance: number
  ): {
    optimal: number;
    currentCost: number;
    optimalCost: number;
    performanceImpact: string;
  } {
    const policy = this.policies.get(service);
    if (!policy) {
      return {
        optimal: 1,
        currentCost: costPerInstance,
        optimalCost: costPerInstance,
        performanceImpact: 'Unknown'
      };
    }
    
    // Calculate based on Little's Law and queuing theory
    const arrivalRate = currentMetrics.requestsPerSecond;
    const serviceTime = currentMetrics.responseTime / 1000; // Convert to seconds
    const utilization = arrivalRate * serviceTime;
    
    // Target utilization for optimal cost/performance balance
    const targetUtilization = 0.7 * (1 - policy.costWeight) + 0.4 * policy.costWeight;
    
    const optimalInstances = Math.ceil(utilization / targetUtilization);
    const boundedOptimal = Math.min(
      Math.max(optimalInstances, policy.minInstances),
      policy.maxInstances
    );
    
    // Calculate costs
    const currentCost = costPerInstance * policy.minInstances;
    const optimalCost = costPerInstance * boundedOptimal;
    
    // Estimate performance impact
    let performanceImpact = 'Neutral';
    if (boundedOptimal < optimalInstances) {
      performanceImpact = 'May experience increased latency during peak';
    } else if (boundedOptimal > optimalInstances * 1.5) {
      performanceImpact = 'Over-provisioned for current load';
    }
    
    return {
      optimal: boundedOptimal,
      currentCost,
      optimalCost,
      performanceImpact
    };
  }
  
  /**
   * Private helper methods
   */
  
  private isInCooldown(service: string): boolean {
    const lastAction = this.lastScaleAction.get(service);
    if (!lastAction) return false;
    
    const policy = this.policies.get(service);
    if (!policy) return false;
    
    return Date.now() - lastAction < policy.cooldownPeriod;
  }
  
  private updateMetricsHistory(service: string, metrics: ScalingMetrics): void {
    const history = this.metricsHistory.get(service) || [];
    history.push(metrics);
    
    // Keep last hour of metrics
    const oneHourAgo = Date.now() - 3600000;
    this.metricsHistory.set(
      service,
      history.slice(-60) // Keep last 60 data points
    );
  }
  
  private calculateScaleUp(
    policy: ScalingPolicy,
    currentInstances: number,
    metricValue: number
  ): ScalingDecision {
    // Calculate how many instances to add
    const overage = metricValue / policy.targetValue;
    const additionalInstances = Math.ceil(currentInstances * (overage - 1));
    const targetInstances = Math.min(
      currentInstances + additionalInstances,
      policy.maxInstances
    );
    
    const estimatedCostImpact = this.estimateCostImpact(
      policy.service,
      currentInstances,
      targetInstances
    );
    
    return {
      action: 'scale-up',
      currentInstances,
      targetInstances,
      reason: `${policy.targetMetric} at ${metricValue} exceeds threshold`,
      estimatedCostImpact,
      confidence: 0.8
    };
  }
  
  private calculateScaleDown(
    policy: ScalingPolicy,
    currentInstances: number,
    metricValue: number
  ): ScalingDecision {
    // Calculate how many instances to remove
    const underUtilization = metricValue / policy.targetValue;
    const instancesToRemove = Math.floor(currentInstances * (1 - underUtilization));
    const targetInstances = Math.max(
      currentInstances - instancesToRemove,
      policy.minInstances
    );
    
    const estimatedCostImpact = this.estimateCostImpact(
      policy.service,
      currentInstances,
      targetInstances
    );
    
    return {
      action: 'scale-down',
      currentInstances,
      targetInstances,
      reason: `${policy.targetMetric} at ${metricValue} below threshold`,
      estimatedCostImpact,
      confidence: 0.7
    };
  }
  
  private applyCostOptimization(
    decision: ScalingDecision,
    policy: ScalingPolicy
  ): ScalingDecision {
    if (policy.costWeight > 0.7 && decision.action === 'scale-up') {
      // Be more conservative with scaling up
      const reducedTarget = Math.ceil(
        decision.currentInstances +
        (decision.targetInstances - decision.currentInstances) * (1 - policy.costWeight)
      );
      
      return {
        ...decision,
        targetInstances: reducedTarget,
        reason: `${decision.reason} (cost-optimized)`,
        confidence: decision.confidence * 0.9
      };
    }
    
    return decision;
  }
  
  private async checkPredictiveScaling(
    service: string,
    currentInstances: number
  ): Promise<ScalingDecision> {
    const now = new Date();
    const upcomingEvent = this.predictedEvents.find(e => 
      e.preScaleTime <= now && e.expectedTime > now
    );
    
    if (!upcomingEvent) {
      return {
        action: 'maintain',
        currentInstances,
        targetInstances: currentInstances,
        reason: 'No predictive events',
        estimatedCostImpact: 0,
        confidence: 0
      };
    }
    
    const targetInstances = upcomingEvent.targetInstances;
    const estimatedCostImpact = this.estimateCostImpact(
      service,
      currentInstances,
      targetInstances
    );
    
    return {
      action: targetInstances > currentInstances ? 'scale-up' : 'scale-down',
      currentInstances,
      targetInstances,
      reason: `Pre-scaling for ${upcomingEvent.eventName}`,
      estimatedCostImpact,
      confidence: 0.95
    };
  }
  
  private estimateCostImpact(
    service: string,
    currentInstances: number,
    targetInstances: number
  ): number {
    // Service-specific cost estimates per instance per hour
    const costPerInstance: Record<string, number> = {
      cloudflare: 0.015,
      neon: 0.09,
      upstash: 0.005
    };
    
    const hourlyRate = costPerInstance[service] || 0.01;
    const dailyCostDifference = (targetInstances - currentInstances) * hourlyRate * 24;
    
    return dailyCostDifference * 30; // Monthly impact
  }
  
  private calculateAverageMetrics(history: ScalingMetrics[]): ScalingMetrics {
    const sum = history.reduce((acc, metrics) => ({
      cpu: acc.cpu + metrics.cpu,
      memory: acc.memory + metrics.memory,
      requestsPerSecond: acc.requestsPerSecond + metrics.requestsPerSecond,
      responseTime: acc.responseTime + metrics.responseTime,
      errorRate: acc.errorRate + metrics.errorRate,
      concurrentConnections: acc.concurrentConnections + metrics.concurrentConnections,
      queueDepth: acc.queueDepth + metrics.queueDepth
    }), {
      cpu: 0,
      memory: 0,
      requestsPerSecond: 0,
      responseTime: 0,
      errorRate: 0,
      concurrentConnections: 0,
      queueDepth: 0
    });
    
    const count = history.length;
    
    return {
      cpu: sum.cpu / count,
      memory: sum.memory / count,
      requestsPerSecond: sum.requestsPerSecond / count,
      responseTime: sum.responseTime / count,
      errorRate: sum.errorRate / count,
      concurrentConnections: sum.concurrentConnections / count,
      queueDepth: sum.queueDepth / count
    };
  }
  
  private calculateScalingFrequency(service: string): number {
    // This would analyze historical scaling actions
    // Placeholder implementation
    return 5;
  }
}

// Export singleton instance
export const autoScaler = new AutoScaler();