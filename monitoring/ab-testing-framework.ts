/**
 * A/B Testing Framework for Cache Improvements
 * 
 * This framework enables safe testing of cache optimizations with automatic
 * rollback capabilities and comprehensive metrics collection.
 */

interface ABTestConfig {
  testId: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficSplit: number[]; // Percentages for each variant
  duration: number; // Duration in milliseconds
  startTime: number;
  endTime?: number;
  successMetrics: SuccessMetric[];
  rollbackTriggers: RollbackTrigger[];
}

interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  config: any; // Variant-specific configuration
  isControl: boolean;
}

interface SuccessMetric {
  name: string;
  metric: string;
  operator: '>' | '<' | '>=' | '<=';
  threshold: number;
  required: boolean; // Must pass for test to be considered successful
}

interface RollbackTrigger {
  name: string;
  metric: string;
  operator: '>' | '<' | '>=' | '<=';
  threshold: number;
  immediateRollback: boolean;
}

interface ABTestMetrics {
  testId: string;
  variant: string;
  timestamp: number;
  metrics: {
    responseTime: number;
    cacheHitRate: number;
    errorRate: number;
    throughput: number;
    userSatisfaction?: number;
    [key: string]: any;
  };
}

export class ABTestingFramework {
  private redis: any;
  private activeTests: Map<string, ABTestConfig> = new Map();
  private userAssignments: Map<string, string> = new Map(); // userId -> variantId
  
  constructor(redis: any) {
    this.redis = redis;
  }

  /**
   * Initialize A/B testing for cache improvements
   */
  async initializeCacheOptimizationTest(): Promise<string> {
    const testConfig: ABTestConfig = {
      testId: 'cache-optimization-v1',
      name: 'Enhanced Cache Strategy Test',
      description: 'Testing improved cache warming and edge optimization strategies',
      variants: [
        {
          id: 'control',
          name: 'Current Cache Implementation',
          description: 'Standard cache implementation without optimizations',
          isControl: true,
          config: {
            cacheWarming: false,
            edgeOptimization: false,
            compressionLevel: 'standard',
            ttl: 300 // 5 minutes
          }
        },
        {
          id: 'enhanced',
          name: 'Enhanced Cache Strategy',
          description: 'Optimized cache with warming, edge optimization, and smart TTL',
          isControl: false,
          config: {
            cacheWarming: true,
            edgeOptimization: true,
            compressionLevel: 'aggressive',
            ttl: 900, // 15 minutes
            smartTTL: true,
            preloadCriticalData: true
          }
        }
      ],
      trafficSplit: [90, 10], // 90% control, 10% enhanced
      duration: 7 * 24 * 60 * 60 * 1000, // 7 days
      startTime: Date.now(),
      successMetrics: [
        {
          name: 'Response Time Improvement',
          metric: 'responseTime',
          operator: '<',
          threshold: 0.8, // 20% improvement (80% of original)
          required: true
        },
        {
          name: 'Cache Hit Rate',
          metric: 'cacheHitRate',
          operator: '>=',
          threshold: 0.85, // 85% hit rate minimum
          required: true
        },
        {
          name: 'Error Rate Limit',
          metric: 'errorRate',
          operator: '<=',
          threshold: 0.01, // 1% maximum error rate
          required: true
        }
      ],
      rollbackTriggers: [
        {
          name: 'Critical Error Rate',
          metric: 'errorRate',
          operator: '>',
          threshold: 0.05, // 5% error rate
          immediateRollback: true
        },
        {
          name: 'Performance Degradation',
          metric: 'responseTime',
          operator: '>',
          threshold: 1.5, // 50% slower than baseline
          immediateRollback: true
        },
        {
          name: 'Cache Failure',
          metric: 'cacheHitRate',
          operator: '<',
          threshold: 0.3, // 30% hit rate minimum
          immediateRollback: true
        }
      ]
    };

    await this.startTest(testConfig);
    return testConfig.testId;
  }

  /**
   * Start an A/B test
   */
  async startTest(config: ABTestConfig): Promise<void> {
    // Validate configuration
    this.validateTestConfig(config);

    // Store test configuration
    this.activeTests.set(config.testId, config);
    await this.redis.setex(
      `ab_test:${config.testId}`, 
      config.duration / 1000,
      JSON.stringify(config)
    );

    // Initialize metrics collection
    await this.initializeMetricsCollection(config.testId);

    console.log(`✅ A/B Test started: ${config.name} (${config.testId})`);
  }

  /**
   * Assign user to a test variant
   */
  assignUserToVariant(userId: string, testId: string): string {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    // Use consistent hashing for stable assignment
    const hash = this.hashUserId(userId, testId);
    const bucket = hash % 100; // 0-99

    let cumulativePercentage = 0;
    for (let i = 0; i < test.variants.length; i++) {
      cumulativePercentage += test.trafficSplit[i];
      if (bucket < cumulativePercentage) {
        const variantId = test.variants[i].id;
        this.userAssignments.set(userId, variantId);
        return variantId;
      }
    }

    // Fallback to control
    return test.variants[0].id;
  }

  /**
   * Get cache configuration for user's assigned variant
   */
  getCacheConfigForUser(userId: string, testId: string): any {
    const variantId = this.assignUserToVariant(userId, testId);
    const test = this.activeTests.get(testId);
    
    if (!test) {
      return this.getDefaultCacheConfig();
    }

    const variant = test.variants.find(v => v.id === variantId);
    return variant?.config || this.getDefaultCacheConfig();
  }

  /**
   * Record test metrics
   */
  async recordMetrics(testId: string, variant: string, metrics: any): Promise<void> {
    const timestamp = Date.now();
    
    const testMetrics: ABTestMetrics = {
      testId,
      variant,
      timestamp,
      metrics
    };

    // Store in Redis with TTL
    const key = `ab_metrics:${testId}:${variant}:${timestamp}`;
    await this.redis.setex(key, 86400 * 7, JSON.stringify(testMetrics)); // 7 days

    // Add to time series for analysis
    await this.redis.zadd(
      `ab_timeseries:${testId}:${variant}`, 
      timestamp, 
      JSON.stringify(metrics)
    );

    // Check for rollback triggers
    await this.checkRollbackTriggers(testId, variant, metrics);
  }

  /**
   * Check if rollback is needed based on metrics
   */
  async checkRollbackTriggers(testId: string, variant: string, metrics: any): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test || variant === 'control') return; // Never rollback control

    for (const trigger of test.rollbackTriggers) {
      const metricValue = metrics[trigger.metric];
      if (metricValue === undefined) continue;

      const shouldRollback = this.evaluateCondition(
        metricValue, 
        trigger.operator, 
        trigger.threshold
      );

      if (shouldRollback) {
        console.log(`🚨 Rollback trigger activated: ${trigger.name}`);
        
        if (trigger.immediateRollback) {
          await this.executeEmergencyRollback(testId, trigger.name);
        } else {
          await this.scheduleRollback(testId, trigger.name);
        }
        
        break;
      }
    }
  }

  /**
   * Execute emergency rollback
   */
  async executeEmergencyRollback(testId: string, reason: string): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) return;

    console.log(`🚨 EMERGENCY ROLLBACK: ${testId} - Reason: ${reason}`);

    // Set all traffic to control variant
    test.trafficSplit = [100, 0];
    
    // Update test configuration
    await this.redis.setex(
      `ab_test:${testId}`, 
      test.duration / 1000,
      JSON.stringify(test)
    );

    // Log rollback event
    await this.logRollbackEvent(testId, reason, true);
    
    // Clear user assignments to force reassignment to control
    this.userAssignments.clear();
    await this.redis.del(`ab_assignments:${testId}`);

    // Notify monitoring systems
    await this.notifyRollback(testId, reason, true);
  }

  /**
   * Analyze test results
   */
  async analyzeTestResults(testId: string): Promise<any> {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const results = {
      testId,
      name: test.name,
      duration: Date.now() - test.startTime,
      variants: []
    };

    for (const variant of test.variants) {
      const metrics = await this.getVariantMetrics(testId, variant.id);
      const analysis = await this.analyzeVariantMetrics(metrics, test.successMetrics);
      
      results.variants.push({
        id: variant.id,
        name: variant.name,
        isControl: variant.isControl,
        metrics,
        analysis,
        passedCriteria: analysis.passedCriteria
      });
    }

    // Compare variants
    const comparison = await this.compareVariants(results.variants);
    results.comparison = comparison;
    results.recommendation = this.generateRecommendation(comparison, test);

    return results;
  }

  /**
   * Get variant metrics for analysis
   */
  async getVariantMetrics(testId: string, variantId: string): Promise<any> {
    const timeSeriesKey = `ab_timeseries:${testId}:${variantId}`;
    const rawMetrics = await this.redis.zrange(timeSeriesKey, 0, -1);
    
    const metrics = rawMetrics.map(m => JSON.parse(m));
    
    return {
      sampleSize: metrics.length,
      averageResponseTime: this.calculateAverage(metrics, 'responseTime'),
      p95ResponseTime: this.calculatePercentile(metrics, 'responseTime', 95),
      averageCacheHitRate: this.calculateAverage(metrics, 'cacheHitRate'),
      errorRate: this.calculateAverage(metrics, 'errorRate'),
      throughput: this.calculateSum(metrics, 'throughput'),
      trend: this.calculateTrend(metrics)
    };
  }

  /**
   * Compare variants for statistical significance
   */
  async compareVariants(variants: any[]): Promise<any> {
    if (variants.length < 2) return null;

    const control = variants.find(v => v.isControl);
    const treatment = variants.find(v => !v.isControl);

    if (!control || !treatment) return null;

    return {
      responseTimeImprovement: {
        percentage: ((control.metrics.averageResponseTime - treatment.metrics.averageResponseTime) / control.metrics.averageResponseTime) * 100,
        significant: await this.isStatisticallySignificant(
          control.metrics.averageResponseTime,
          treatment.metrics.averageResponseTime,
          control.metrics.sampleSize,
          treatment.metrics.sampleSize
        )
      },
      cacheHitRateImprovement: {
        percentage: ((treatment.metrics.averageCacheHitRate - control.metrics.averageCacheHitRate) / control.metrics.averageCacheHitRate) * 100,
        significant: await this.isStatisticallySignificant(
          control.metrics.averageCacheHitRate,
          treatment.metrics.averageCacheHitRate,
          control.metrics.sampleSize,
          treatment.metrics.sampleSize
        )
      },
      errorRateChange: {
        percentage: ((treatment.metrics.errorRate - control.metrics.errorRate) / control.metrics.errorRate) * 100
      }
    };
  }

  /**
   * Generate deployment recommendation
   */
  generateRecommendation(comparison: any, test: ABTestConfig): string {
    if (!comparison) {
      return 'Insufficient data for recommendation';
    }

    const { responseTimeImprovement, cacheHitRateImprovement } = comparison;
    
    // Check if treatment meets success criteria
    const hasSignificantImprovement = 
      responseTimeImprovement.significant && 
      responseTimeImprovement.percentage > 15; // 15% improvement threshold
      
    const hasGoodCachePerformance = 
      cacheHitRateImprovement.percentage > 5; // 5% improvement threshold

    if (hasSignificantImprovement && hasGoodCachePerformance) {
      return 'RECOMMEND DEPLOYMENT: Treatment variant shows significant improvements in both response time and cache performance.';
    } else if (responseTimeImprovement.percentage < -10) {
      return 'DO NOT DEPLOY: Treatment variant shows significant performance degradation.';
    } else {
      return 'EXTEND TEST: Results are inconclusive. Consider extending test duration or increasing traffic allocation.';
    }
  }

  /**
   * Middleware for cache optimization A/B testing
   */
  getCacheOptimizationMiddleware(testId: string) {
    return async (request: Request, env: any, ctx: any) => {
      const userId = await this.extractUserId(request);
      if (!userId) {
        // Use session ID or IP as fallback
        const sessionId = request.headers.get('x-session-id') || 
                         request.headers.get('cf-connecting-ip') || 
                         'anonymous';
        const cacheConfig = this.getCacheConfigForUser(sessionId, testId);
        return this.applyCacheConfiguration(request, cacheConfig, env, ctx);
      }

      const variantId = this.assignUserToVariant(userId, testId);
      const cacheConfig = this.getCacheConfigForUser(userId, testId);
      
      // Apply cache configuration
      const startTime = Date.now();
      const response = await this.applyCacheConfiguration(request, cacheConfig, env, ctx);
      const endTime = Date.now();

      // Record metrics
      await this.recordMetrics(testId, variantId, {
        responseTime: endTime - startTime,
        cacheHitRate: await this.calculateCacheHitRate(request, response),
        errorRate: response.status >= 400 ? 1 : 0,
        throughput: 1
      });

      return response;
    };
  }

  /**
   * Apply cache configuration based on A/B test variant
   */
  async applyCacheConfiguration(request: Request, config: any, env: any, ctx: any): Promise<Response> {
    // Configure cache based on variant
    if (config.cacheWarming) {
      await this.warmCriticalCache(env);
    }

    if (config.edgeOptimization) {
      return this.handleWithEdgeOptimization(request, config, env, ctx);
    }

    return this.handleWithStandardCache(request, config, env, ctx);
  }

  // Helper methods (simplified implementations)
  private validateTestConfig(config: ABTestConfig): void {
    if (!config.testId || !config.variants || config.variants.length === 0) {
      throw new Error('Invalid test configuration');
    }
    
    const totalSplit = config.trafficSplit.reduce((sum, split) => sum + split, 0);
    if (Math.abs(totalSplit - 100) > 0.1) {
      throw new Error('Traffic split must sum to 100%');
    }
  }

  private hashUserId(userId: string, testId: string): number {
    // Simple hash function for consistent user assignment
    let hash = 0;
    const str = userId + testId;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private getDefaultCacheConfig(): any {
    return {
      cacheWarming: false,
      edgeOptimization: false,
      compressionLevel: 'standard',
      ttl: 300
    };
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      default: return false;
    }
  }

  private calculateAverage(metrics: any[], field: string): number {
    const values = metrics.map(m => m[field]).filter(v => v !== undefined);
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(metrics: any[], field: string, percentile: number): number {
    const values = metrics.map(m => m[field]).filter(v => v !== undefined).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[index] || 0;
  }

  private calculateSum(metrics: any[], field: string): number {
    return metrics.reduce((sum, m) => sum + (m[field] || 0), 0);
  }

  private calculateTrend(metrics: any[]): 'improving' | 'degrading' | 'stable' {
    if (metrics.length < 10) return 'stable';
    
    const first = metrics.slice(0, Math.floor(metrics.length / 2));
    const second = metrics.slice(Math.floor(metrics.length / 2));
    
    const firstAvg = this.calculateAverage(first, 'responseTime');
    const secondAvg = this.calculateAverage(second, 'responseTime');
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.1) return 'degrading';
    if (change < -0.1) return 'improving';
    return 'stable';
  }

  private async isStatisticallySignificant(control: number, treatment: number, n1: number, n2: number): Promise<boolean> {
    // Simplified statistical significance test
    // In production, use proper t-test or z-test
    const pooledStd = Math.sqrt(((control + treatment) / 2) * 0.1); // Simplified
    const standardError = pooledStd * Math.sqrt(1/n1 + 1/n2);
    const tStat = Math.abs(treatment - control) / standardError;
    
    return tStat > 1.96; // 95% confidence level
  }

  private async initializeMetricsCollection(testId: string): Promise<void> {
    // Initialize metrics collection system
    await this.redis.set(`ab_test_active:${testId}`, '1');
  }

  private async logRollbackEvent(testId: string, reason: string, emergency: boolean): Promise<void> {
    const event = {
      testId,
      reason,
      emergency,
      timestamp: Date.now()
    };
    
    await this.redis.lpush('ab_rollback_events', JSON.stringify(event));
  }

  private async notifyRollback(testId: string, reason: string, emergency: boolean): Promise<void> {
    // Send notifications to monitoring systems, Slack, etc.
    console.log(`📢 A/B Test Rollback: ${testId} - ${reason} (Emergency: ${emergency})`);
  }

  private async scheduleRollback(testId: string, reason: string): Promise<void> {
    // Schedule a gradual rollback instead of immediate
    console.log(`⏰ Scheduled rollback for test ${testId}: ${reason}`);
  }

  private async analyzeVariantMetrics(metrics: any, successMetrics: SuccessMetric[]): Promise<any> {
    const analysis = {
      passedCriteria: true,
      results: []
    };

    for (const criterion of successMetrics) {
      const metricValue = metrics[criterion.metric.replace('Rate', '')]; // Handle naming differences
      const passed = this.evaluateCondition(metricValue, criterion.operator, criterion.threshold);
      
      analysis.results.push({
        metric: criterion.name,
        value: metricValue,
        threshold: criterion.threshold,
        passed,
        required: criterion.required
      });

      if (criterion.required && !passed) {
        analysis.passedCriteria = false;
      }
    }

    return analysis;
  }

  private async extractUserId(request: Request): Promise<string | null> {
    // Extract user ID from JWT token, session, etc.
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;
    
    // Simplified - in production, properly decode JWT
    return 'user123'; // Placeholder
  }

  private async calculateCacheHitRate(request: Request, response: Response): Promise<number> {
    const cacheStatus = response.headers.get('cf-cache-status');
    return cacheStatus === 'HIT' ? 1 : 0;
  }

  private async warmCriticalCache(env: any): Promise<void> {
    // Warm critical cache entries
    // Implementation depends on specific cache warming strategy
  }

  private async handleWithEdgeOptimization(request: Request, config: any, env: any, ctx: any): Promise<Response> {
    // Handle with edge optimization enabled
    // Implementation specific to optimization strategy
    return new Response('Optimized response');
  }

  private async handleWithStandardCache(request: Request, config: any, env: any, ctx: any): Promise<Response> {
    // Handle with standard cache configuration
    return new Response('Standard response');
  }
}

// Usage example for Cloudflare Worker
export async function handleABTestingRequest(request: Request, env: any, ctx: any): Promise<Response> {
  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  const abTesting = new ABTestingFramework(redis);
  
  // Initialize cache optimization test if not already running
  const testId = 'cache-optimization-v1';
  if (!await redis.exists(`ab_test:${testId}`)) {
    await abTesting.initializeCacheOptimizationTest();
  }

  // Apply A/B testing middleware
  const middleware = abTesting.getCacheOptimizationMiddleware(testId);
  return middleware(request, env, ctx);
}