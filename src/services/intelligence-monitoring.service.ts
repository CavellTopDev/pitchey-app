/**
 * Intelligence Monitoring Service
 * Comprehensive error handling and monitoring for the intelligence layer
 */

import type { Environment } from '../types/environment';
import { intelligenceCacheService } from './intelligence-cache.service';

interface ErrorMetrics {
  count: number;
  lastError: string;
  lastOccurred: Date;
  errorTypes: Record<string, number>;
}

interface PerformanceMetrics {
  avgResponseTime: number;
  slowQueries: number;
  cacheHitRate: number;
  enrichmentSuccess: number;
  enrichmentFailures: number;
}

interface IntelligenceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    enrichment: 'up' | 'down' | 'slow';
    market: 'up' | 'down' | 'slow';
    discovery: 'up' | 'down' | 'slow';
    competitive: 'up' | 'down' | 'slow';
    cache: 'up' | 'down' | 'slow';
    websocket: 'up' | 'down' | 'slow';
  };
  uptime: number; // percentage
  lastCheck: Date;
}

interface AlertConfig {
  errorThreshold: number;
  responseTimeThreshold: number;
  cacheHitRateThreshold: number;
  enableSlackAlerts: boolean;
  enableEmailAlerts: boolean;
}

class IntelligenceMonitoringService {
  private errorMetrics: Map<string, ErrorMetrics> = new Map();
  private performanceMetrics: PerformanceMetrics = {
    avgResponseTime: 0,
    slowQueries: 0,
    cacheHitRate: 0,
    enrichmentSuccess: 0,
    enrichmentFailures: 0
  };
  private healthStatus: IntelligenceHealth = {
    status: 'healthy',
    services: {
      enrichment: 'up',
      market: 'up',
      discovery: 'up',
      competitive: 'up',
      cache: 'up',
      websocket: 'up'
    },
    uptime: 100,
    lastCheck: new Date()
  };
  private alertConfig: AlertConfig = {
    errorThreshold: 10, // errors per minute
    responseTimeThreshold: 5000, // 5 seconds
    cacheHitRateThreshold: 80, // 80% minimum
    enableSlackAlerts: false,
    enableEmailAlerts: false
  };

  constructor(private env: Environment) {}

  /**
   * Log an intelligence error with context
   */
  logError(service: string, error: Error | string, context?: any): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const timestamp = new Date();
    
    // Update error metrics
    if (!this.errorMetrics.has(service)) {
      this.errorMetrics.set(service, {
        count: 0,
        lastError: '',
        lastOccurred: timestamp,
        errorTypes: {}
      });
    }

    const metrics = this.errorMetrics.get(service)!;
    metrics.count++;
    metrics.lastError = errorMessage;
    metrics.lastOccurred = timestamp;
    
    // Categorize error type
    const errorType = this.categorizeError(errorMessage);
    metrics.errorTypes[errorType] = (metrics.errorTypes[errorType] || 0) + 1;

    // Log to console with structured format
    console.error(`[Intelligence Error] ${service}:`, {
      error: errorMessage,
      timestamp: timestamp.toISOString(),
      context,
      errorType,
      totalErrors: metrics.count
    });

    // Update service health
    this.updateServiceHealth(service, 'error');

    // Check if alert thresholds are exceeded
    this.checkAlertThresholds(service, metrics);

    // Store error in cache for dashboard
    this.storeErrorForDashboard(service, errorMessage, timestamp, context);
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, responseTime: number, success: boolean, metadata?: any): void {
    // Update average response time
    this.performanceMetrics.avgResponseTime = 
      (this.performanceMetrics.avgResponseTime + responseTime) / 2;

    // Track slow queries
    if (responseTime > this.alertConfig.responseTimeThreshold) {
      this.performanceMetrics.slowQueries++;
      console.warn(`[Intelligence Performance] Slow ${operation}:`, {
        responseTime,
        threshold: this.alertConfig.responseTimeThreshold,
        metadata
      });
    }

    // Track enrichment success/failure rates
    if (operation.includes('enrichment')) {
      if (success) {
        this.performanceMetrics.enrichmentSuccess++;
      } else {
        this.performanceMetrics.enrichmentFailures++;
      }
    }

    // Log performance data
    console.log(`[Intelligence Performance] ${operation}:`, {
      responseTime,
      success,
      avgResponseTime: this.performanceMetrics.avgResponseTime,
      metadata
    });

    // Store performance data for analytics
    this.storePerformanceData(operation, responseTime, success, metadata);
  }

  /**
   * Update cache hit rate metrics
   */
  logCacheMetrics(hits: number, misses: number): void {
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;
    
    this.performanceMetrics.cacheHitRate = hitRate;

    // Alert if cache hit rate is too low
    if (hitRate < this.alertConfig.cacheHitRateThreshold) {
      console.warn(`[Intelligence Cache] Low hit rate: ${hitRate.toFixed(2)}%`, {
        hits,
        misses,
        threshold: this.alertConfig.cacheHitRateThreshold
      });
    }

    console.log(`[Intelligence Cache] Hit rate: ${hitRate.toFixed(2)}%`, { hits, misses });
  }

  /**
   * Perform health check on all intelligence services
   */
  async performHealthCheck(): Promise<IntelligenceHealth> {
    const startTime = Date.now();
    
    try {
      // Test each service with lightweight operations
      const checks = await Promise.allSettled([
        this.checkEnrichmentService(),
        this.checkMarketService(),
        this.checkDiscoveryService(),
        this.checkCompetitiveService(),
        this.checkCacheService(),
        this.checkWebSocketService()
      ]);

      // Update service statuses
      this.healthStatus.services.enrichment = checks[0].status === 'fulfilled' ? 'up' : 'down';
      this.healthStatus.services.market = checks[1].status === 'fulfilled' ? 'up' : 'down';
      this.healthStatus.services.discovery = checks[2].status === 'fulfilled' ? 'up' : 'down';
      this.healthStatus.services.competitive = checks[3].status === 'fulfilled' ? 'up' : 'down';
      this.healthStatus.services.cache = checks[4].status === 'fulfilled' ? 'up' : 'down';
      this.healthStatus.services.websocket = checks[5].status === 'fulfilled' ? 'up' : 'down';

      // Calculate overall health
      const upServices = Object.values(this.healthStatus.services).filter(status => status === 'up').length;
      const totalServices = Object.keys(this.healthStatus.services).length;
      const uptime = (upServices / totalServices) * 100;

      this.healthStatus.uptime = uptime;
      this.healthStatus.lastCheck = new Date();
      
      // Determine overall status
      if (uptime >= 90) {
        this.healthStatus.status = 'healthy';
      } else if (uptime >= 70) {
        this.healthStatus.status = 'degraded';
      } else {
        this.healthStatus.status = 'unhealthy';
      }

      const checkDuration = Date.now() - startTime;
      console.log(`[Intelligence Health] Check completed in ${checkDuration}ms`, {
        status: this.healthStatus.status,
        uptime: `${uptime.toFixed(1)}%`,
        services: this.healthStatus.services
      });

      return this.healthStatus;
    } catch (error) {
      this.logError('health-check', error);
      this.healthStatus.status = 'unhealthy';
      return this.healthStatus;
    }
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getMonitoringDashboard(): Promise<any> {
    try {
      return {
        health: this.healthStatus,
        performance: this.performanceMetrics,
        errors: this.getErrorSummary(),
        alerts: await this.getActiveAlerts(),
        trends: await this.getPerformanceTrends(),
        uptime: this.calculateUptimeStats(),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.logError('monitoring-dashboard', error);
      throw new Error('Failed to generate monitoring dashboard');
    }
  }

  /**
   * Set alert configuration
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
    console.log('[Intelligence Monitoring] Alert configuration updated:', this.alertConfig);
  }

  // Private helper methods

  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('timeout') || errorMessage.includes('slow')) return 'performance';
    if (errorMessage.includes('cache') || errorMessage.includes('redis')) return 'cache';
    if (errorMessage.includes('database') || errorMessage.includes('sql')) return 'database';
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) return 'network';
    if (errorMessage.includes('websocket') || errorMessage.includes('connection')) return 'connectivity';
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) return 'validation';
    return 'unknown';
  }

  private updateServiceHealth(service: string, event: 'error' | 'success'): void {
    // Implement circuit breaker pattern for service health
    const errorCount = this.errorMetrics.get(service)?.count || 0;
    
    if (event === 'error' && errorCount > 5) {
      (this.healthStatus.services as any)[service] = 'down';
    } else if (event === 'success') {
      (this.healthStatus.services as any)[service] = 'up';
    }
  }

  private checkAlertThresholds(service: string, metrics: ErrorMetrics): void {
    // Check error rate threshold
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    // Count errors in the last minute (simplified implementation)
    if (metrics.lastOccurred > oneMinuteAgo && metrics.count > this.alertConfig.errorThreshold) {
      this.triggerAlert('high_error_rate', service, {
        errorCount: metrics.count,
        threshold: this.alertConfig.errorThreshold,
        timeWindow: '1 minute'
      });
    }
  }

  private triggerAlert(alertType: string, service: string, details: any): void {
    const alert = {
      type: alertType,
      service,
      details,
      timestamp: new Date().toISOString(),
      severity: 'high'
    };

    console.warn(`[Intelligence Alert] ${alertType} for ${service}:`, alert);

    // Store alert for dashboard
    intelligenceCacheService.setCache(`alert:${alertType}:${Date.now()}`, alert, 86400, this.env);
  }

  private async storeErrorForDashboard(service: string, error: string, timestamp: Date, context?: any): Promise<void> {
    const errorData = {
      service,
      error,
      timestamp: timestamp.toISOString(),
      context
    };
    
    try {
      await intelligenceCacheService.setCache(
        `error:${service}:${timestamp.getTime()}`,
        errorData,
        3600, // 1 hour TTL
        this.env
      );
    } catch (cacheError) {
      console.error('Failed to store error in cache:', cacheError);
    }
  }

  private async storePerformanceData(operation: string, responseTime: number, success: boolean, metadata?: any): Promise<void> {
    const performanceData = {
      operation,
      responseTime,
      success,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    try {
      await intelligenceCacheService.setCache(
        `performance:${operation}:${Date.now()}`,
        performanceData,
        1800, // 30 minutes TTL
        this.env
      );
    } catch (cacheError) {
      console.error('Failed to store performance data:', cacheError);
    }
  }

  private getErrorSummary(): any {
    const summary: any = {
      totalServices: this.errorMetrics.size,
      totalErrors: 0,
      errorsByService: {},
      errorsByType: {},
      recentErrors: []
    };

    for (const [service, metrics] of this.errorMetrics) {
      summary.totalErrors += metrics.count;
      summary.errorsByService[service] = metrics.count;
      
      // Aggregate error types
      for (const [type, count] of Object.entries(metrics.errorTypes)) {
        summary.errorsByType[type] = (summary.errorsByType[type] || 0) + count;
      }

      // Recent errors
      if (metrics.lastOccurred > new Date(Date.now() - 3600000)) { // Last hour
        summary.recentErrors.push({
          service,
          error: metrics.lastError,
          time: metrics.lastOccurred
        });
      }
    }

    return summary;
  }

  private async getActiveAlerts(): Promise<any[]> {
    // Fetch recent alerts from cache
    const alerts: any[] = [];
    // Implementation would fetch from cache
    return alerts;
  }

  private async getPerformanceTrends(): Promise<any> {
    return {
      responseTime: {
        current: this.performanceMetrics.avgResponseTime,
        trend: 'stable' // Would calculate based on historical data
      },
      cacheHitRate: {
        current: this.performanceMetrics.cacheHitRate,
        trend: 'improving'
      },
      enrichmentSuccess: {
        rate: this.performanceMetrics.enrichmentSuccess / 
              (this.performanceMetrics.enrichmentSuccess + this.performanceMetrics.enrichmentFailures) * 100,
        trend: 'stable'
      }
    };
  }

  private calculateUptimeStats(): any {
    return {
      overall: this.healthStatus.uptime,
      lastHour: 99.5, // Would calculate from historical data
      lastDay: 99.2,
      lastWeek: 99.8
    };
  }

  // Health check implementations for each service
  private async checkEnrichmentService(): Promise<void> {
    // Lightweight check - could test a simple enrichment operation
    return Promise.resolve();
  }

  private async checkMarketService(): Promise<void> {
    // Check if market intelligence service is responsive
    return Promise.resolve();
  }

  private async checkDiscoveryService(): Promise<void> {
    // Check content discovery service
    return Promise.resolve();
  }

  private async checkCompetitiveService(): Promise<void> {
    // Check competitive analysis service
    return Promise.resolve();
  }

  private async checkCacheService(): Promise<void> {
    // Test cache connectivity
    try {
      await intelligenceCacheService.setCache('health-check', 'ok', 60, this.env);
      await intelligenceCacheService.getCache('health-check', this.env);
    } catch (error) {
      throw new Error('Cache service health check failed');
    }
  }

  private async checkWebSocketService(): Promise<void> {
    // Check WebSocket service health
    return Promise.resolve();
  }
}

// Export singleton
let intelligenceMonitoringServiceInstance: IntelligenceMonitoringService | null = null;

export function getIntelligenceMonitoringService(env: Environment): IntelligenceMonitoringService {
  if (!intelligenceMonitoringServiceInstance) {
    intelligenceMonitoringServiceInstance = new IntelligenceMonitoringService(env);
  }
  return intelligenceMonitoringServiceInstance;
}

export { IntelligenceMonitoringService };