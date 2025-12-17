/**
 * A/B Test Integration for Cloudflare Worker
 * Integrates the A/B testing framework with cache optimization
 */

export interface ABTestVariant {
  id: string;
  name: string;
  config: {
    cacheWarming: boolean;
    edgeOptimization: boolean;
    compressionLevel: string;
    ttl: number;
    smartTTL?: boolean;
    preloadCriticalData?: boolean;
  };
}

export class ABTestManager {
  private kv: KVNamespace;
  private testId = 'cache-optimization-v1';
  
  // Traffic split: 90% control, 10% enhanced
  private trafficSplit = {
    control: 0.9,
    enhanced: 0.1
  };

  constructor(kv: KVNamespace | undefined) {
    if (!kv) {
      console.warn('ABTestManager: KV namespace not available, A/B testing disabled');
      this.kv = null as any;
      return;
    }
    this.kv = kv;
  }

  /**
   * Assign user to variant based on consistent hashing
   */
  async assignVariant(userId: string): Promise<ABTestVariant> {
    // Return control variant if KV not available
    if (!this.kv) {
      return {
        id: 'control',
        name: 'Default Implementation (KV Unavailable)',
        config: {
          cacheWarming: false,
          edgeOptimization: false,
          compressionLevel: 'standard',
          ttl: 300
        }
      };
    }

    try {
      // Check if user already has assignment
      const existingAssignment = await this.kv.get(`ab:${this.testId}:${userId}`);
      if (existingAssignment) {
        return JSON.parse(existingAssignment);
      }
    } catch (error) {
      console.warn('Failed to get existing A/B test assignment, using control:', error);
      return {
        id: 'control',
        name: 'Control (Assignment Failed)',
        config: {
          cacheWarming: false,
          edgeOptimization: false,
          compressionLevel: 'standard',
          ttl: 300
        }
      };
    }

    // Consistent hash based on userId
    const hash = this.hashUserId(userId);
    const randomValue = hash / 0xFFFFFFFF; // Normalize to 0-1

    // Assign variant based on traffic split
    const variant: ABTestVariant = randomValue < this.trafficSplit.control
      ? {
          id: 'control',
          name: 'Current Cache Implementation',
          config: {
            cacheWarming: false,
            edgeOptimization: false,
            compressionLevel: 'standard',
            ttl: 300 // 5 minutes
          }
        }
      : {
          id: 'enhanced',
          name: 'Enhanced Cache Strategy',
          config: {
            cacheWarming: true,
            edgeOptimization: true,
            compressionLevel: 'aggressive',
            ttl: 900, // 15 minutes
            smartTTL: true,
            preloadCriticalData: true
          }
        };

    // Store assignment for consistency
    try {
      await this.kv.put(
        `ab:${this.testId}:${userId}`,
        JSON.stringify(variant),
        { expirationTtl: 86400 * 7 } // 7 days
      );
    } catch (error) {
      console.warn('Failed to store A/B test assignment:', error);
      // Continue anyway, assignment will work this session
    }

    return variant;
  }

  /**
   * Get cache TTL based on variant configuration
   */
  getCacheTTL(variant: ABTestVariant, endpoint: string): number {
    if (!variant.config.smartTTL) {
      return variant.config.ttl;
    }

    // Smart TTL based on endpoint type
    if (endpoint.includes('/trending') || endpoint.includes('/new')) {
      return 60; // 1 minute for dynamic content
    }
    if (endpoint.includes('/browse')) {
      return 300; // 5 minutes for browse
    }
    if (endpoint.includes('/health')) {
      return 30; // 30 seconds for health checks
    }
    
    return variant.config.ttl; // Default TTL
  }

  /**
   * Track metrics for the variant
   */
  async trackMetrics(
    variant: ABTestVariant,
    metrics: {
      responseTime: number;
      cacheHit: boolean;
      statusCode: number;
      endpoint: string;
    }
  ): Promise<void> {
    const key = `ab:metrics:${this.testId}:${variant.id}:${Date.now()}`;
    
    await this.kv.put(
      key,
      JSON.stringify({
        variant: variant.id,
        timestamp: Date.now(),
        ...metrics
      }),
      { expirationTtl: 86400 * 7 } // Keep metrics for 7 days
    );

    // Update aggregated metrics
    await this.updateAggregatedMetrics(variant.id, metrics);
  }

  /**
   * Update aggregated metrics for reporting
   */
  private async updateAggregatedMetrics(
    variantId: string,
    metrics: any
  ): Promise<void> {
    const key = `ab:aggregate:${this.testId}:${variantId}`;
    const existing = await this.kv.get(key);
    
    const aggregated = existing ? JSON.parse(existing) : {
      totalRequests: 0,
      cacheHits: 0,
      totalResponseTime: 0,
      errors: 0
    };

    aggregated.totalRequests++;
    if (metrics.cacheHit) aggregated.cacheHits++;
    aggregated.totalResponseTime += metrics.responseTime;
    if (metrics.statusCode >= 400) aggregated.errors++;

    await this.kv.put(
      key,
      JSON.stringify(aggregated),
      { expirationTtl: 86400 * 30 } // Keep aggregates for 30 days
    );
  }

  /**
   * Get A/B test results
   */
  async getTestResults(): Promise<any> {
    const controlKey = `ab:aggregate:${this.testId}:control`;
    const enhancedKey = `ab:aggregate:${this.testId}:enhanced`;

    const [control, enhanced] = await Promise.all([
      this.kv.get(controlKey),
      this.kv.get(enhancedKey)
    ]);

    if (!control || !enhanced) {
      return { message: 'Insufficient data for A/B test results' };
    }

    const controlData = JSON.parse(control);
    const enhancedData = JSON.parse(enhanced);

    return {
      testId: this.testId,
      control: {
        ...controlData,
        avgResponseTime: controlData.totalResponseTime / controlData.totalRequests,
        cacheHitRate: (controlData.cacheHits / controlData.totalRequests) * 100,
        errorRate: (controlData.errors / controlData.totalRequests) * 100
      },
      enhanced: {
        ...enhancedData,
        avgResponseTime: enhancedData.totalResponseTime / enhancedData.totalRequests,
        cacheHitRate: (enhancedData.cacheHits / enhancedData.totalRequests) * 100,
        errorRate: (enhancedData.errors / enhancedData.totalRequests) * 100
      },
      improvement: {
        responseTime: ((controlData.totalResponseTime / controlData.totalRequests) - 
                      (enhancedData.totalResponseTime / enhancedData.totalRequests)) /
                      (controlData.totalResponseTime / controlData.totalRequests) * 100,
        cacheHitRate: ((enhancedData.cacheHits / enhancedData.totalRequests) - 
                       (controlData.cacheHits / controlData.totalRequests)) * 100
      }
    };
  }

  /**
   * Simple hash function for user ID
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Check if we should rollback based on metrics
   */
  async checkRollbackTriggers(): Promise<boolean> {
    const results = await this.getTestResults();
    
    if (!results.enhanced || !results.control) {
      return false;
    }

    // Rollback if enhanced variant has:
    // - Error rate > 10%
    // - Response time > 150% of control
    // - Cache hit rate < 20%
    if (results.enhanced.errorRate > 10) {
      console.log('🚨 A/B Test Rollback: Error rate too high');
      return true;
    }

    if (results.enhanced.avgResponseTime > results.control.avgResponseTime * 1.5) {
      console.log('🚨 A/B Test Rollback: Response time degradation');
      return true;
    }

    if (results.enhanced.cacheHitRate < 20) {
      console.log('⚠️ A/B Test Warning: Low cache hit rate in enhanced variant');
      // Don't rollback yet, just warn
    }

    return false;
  }
}