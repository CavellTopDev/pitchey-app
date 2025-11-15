/**
 * Performance Profiler Service
 * Provides comprehensive performance monitoring, profiling, and optimization tools
 */

import { telemetry } from "../utils/telemetry.ts";

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  type: "database" | "api" | "cache" | "computation" | "network";
  details?: Record<string, any>;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

export interface PerformanceProfile {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  metrics: PerformanceMetric[];
  summary?: PerformanceSummary;
}

export interface PerformanceSummary {
  totalDuration: number;
  slowestOperations: PerformanceMetric[];
  databaseTime: number;
  cacheTime: number;
  computationTime: number;
  networkTime: number;
  memoryPeak: number;
  recommendations: string[];
}

export interface PerformanceAnalysis {
  timestamp: string;
  systemHealth: "excellent" | "good" | "degraded" | "poor";
  bottlenecks: string[];
  optimizations: string[];
  metrics: {
    averageResponseTime: number;
    databasePerformance: number;
    cacheHitRate: number;
    memoryEfficiency: number;
    cpuUtilization: number;
  };
  trends: {
    responseTimeTrend: "improving" | "stable" | "degrading";
    memoryTrend: "optimized" | "stable" | "growing";
    errorTrend: "decreasing" | "stable" | "increasing";
  };
}

export class PerformanceProfiler {
  private static profiles = new Map<string, PerformanceProfile>();
  private static globalMetrics: PerformanceMetric[] = [];
  private static isEnabled = true;
  
  /**
   * Start a performance profile session
   */
  static startProfile(name: string): string {
    if (!this.isEnabled) return "";
    
    const id = crypto.randomUUID();
    const profile: PerformanceProfile = {
      id,
      name,
      startTime: performance.now(),
      metrics: []
    };
    
    this.profiles.set(id, profile);
    
    telemetry.logger.debug("Performance profile started", { profileId: id, name });
    return id;
  }
  
  /**
   * End a performance profile session
   */
  static endProfile(profileId: string): PerformanceProfile | null {
    if (!this.isEnabled || !profileId) return null;
    
    const profile = this.profiles.get(profileId);
    if (!profile) return null;
    
    profile.endTime = performance.now();
    profile.summary = this.generateSummary(profile);
    
    // Add to global metrics
    this.globalMetrics.push(...profile.metrics);
    
    // Keep global metrics manageable
    if (this.globalMetrics.length > 10000) {
      this.globalMetrics = this.globalMetrics.slice(-5000);
    }
    
    telemetry.logger.info("Performance profile completed", {
      profileId,
      name: profile.name,
      duration: profile.endTime - profile.startTime,
      operations: profile.metrics.length
    });
    
    // Clean up completed profile after 1 hour
    setTimeout(() => this.profiles.delete(profileId), 3600000);
    
    return profile;
  }
  
  /**
   * Record a performance metric within a profile
   */
  static recordMetric(
    profileId: string, 
    name: string, 
    duration: number, 
    type: PerformanceMetric["type"],
    details?: Record<string, any>
  ): void {
    if (!this.isEnabled || !profileId) return;
    
    const profile = this.profiles.get(profileId);
    if (!profile) return;
    
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: performance.now(),
      type,
      details,
      memoryUsage: this.getMemoryUsage()
    };
    
    profile.metrics.push(metric);
  }
  
  /**
   * Time a function execution and record metrics
   */
  static async timeFunction<T>(
    profileId: string,
    name: string,
    type: PerformanceMetric["type"],
    fn: () => Promise<T>,
    details?: Record<string, any>
  ): Promise<T> {
    if (!this.isEnabled) return await fn();
    
    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      this.recordMetric(profileId, name, duration, type, {
        ...details,
        success: true,
        memoryDelta: this.calculateMemoryDelta(startMemory, this.getMemoryUsage())
      });
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordMetric(profileId, name, duration, type, {
        ...details,
        success: false,
        error: error.message,
        memoryDelta: this.calculateMemoryDelta(startMemory, this.getMemoryUsage())
      });
      
      throw error;
    }
  }
  
  /**
   * Measure database query performance
   */
  static async measureQuery<T>(
    profileId: string,
    queryName: string,
    query: () => Promise<T>,
    queryType?: string
  ): Promise<T> {
    return this.timeFunction(profileId, `DB: ${queryName}`, "database", query, {
      queryType: queryType || "unknown"
    });
  }
  
  /**
   * Measure cache operation performance
   */
  static async measureCache<T>(
    profileId: string,
    operation: string,
    cacheOp: () => Promise<T>,
    cacheKey?: string
  ): Promise<T> {
    return this.timeFunction(profileId, `Cache: ${operation}`, "cache", cacheOp, {
      cacheKey: cacheKey || "unknown"
    });
  }
  
  /**
   * Measure API call performance
   */
  static async measureApiCall<T>(
    profileId: string,
    endpoint: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    return this.timeFunction(profileId, `API: ${endpoint}`, "api", apiCall, {
      endpoint
    });
  }
  
  /**
   * Analyze system performance and provide insights
   */
  static analyzePerformance(): PerformanceAnalysis {
    const recentMetrics = this.globalMetrics.slice(-1000); // Last 1000 operations
    
    if (recentMetrics.length === 0) {
      return {
        timestamp: new Date().toISOString(),
        systemHealth: "excellent",
        bottlenecks: [],
        optimizations: [],
        metrics: {
          averageResponseTime: 0,
          databasePerformance: 100,
          cacheHitRate: 100,
          memoryEfficiency: 100,
          cpuUtilization: 0
        },
        trends: {
          responseTimeTrend: "stable",
          memoryTrend: "stable",
          errorTrend: "stable"
        }
      };
    }
    
    // Calculate performance metrics
    const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
    const databaseMetrics = recentMetrics.filter(m => m.type === "database");
    const cacheMetrics = recentMetrics.filter(m => m.type === "cache");
    
    const databasePerformance = this.calculateDatabasePerformance(databaseMetrics);
    const cacheHitRate = this.calculateCacheHitRate(cacheMetrics);
    const memoryEfficiency = this.calculateMemoryEfficiency(recentMetrics);
    
    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(recentMetrics);
    
    // Generate optimization recommendations
    const optimizations = this.generateOptimizations(recentMetrics, {
      averageResponseTime,
      databasePerformance,
      cacheHitRate,
      memoryEfficiency
    });
    
    // Determine system health
    const systemHealth = this.determineSystemHealth({
      averageResponseTime,
      databasePerformance,
      cacheHitRate,
      memoryEfficiency
    });
    
    // Calculate trends
    const trends = this.calculateTrends(recentMetrics);
    
    return {
      timestamp: new Date().toISOString(),
      systemHealth,
      bottlenecks,
      optimizations,
      metrics: {
        averageResponseTime,
        databasePerformance,
        cacheHitRate,
        memoryEfficiency,
        cpuUtilization: 0 // Would be calculated from actual CPU metrics
      },
      trends
    };
  }
  
  /**
   * Get performance recommendations based on current metrics
   */
  static getPerformanceRecommendations(): string[] {
    const analysis = this.analyzePerformance();
    const recommendations: string[] = [];
    
    if (analysis.metrics.averageResponseTime > 1000) {
      recommendations.push("Consider implementing response time optimization strategies");
      recommendations.push("Review slow database queries and add appropriate indexes");
    }
    
    if (analysis.metrics.databasePerformance < 70) {
      recommendations.push("Database performance is suboptimal - review query patterns");
      recommendations.push("Consider database connection pooling optimization");
    }
    
    if (analysis.metrics.cacheHitRate < 80) {
      recommendations.push("Cache hit rate is low - review cache strategies");
      recommendations.push("Consider extending cache TTL for stable data");
    }
    
    if (analysis.metrics.memoryEfficiency < 70) {
      recommendations.push("Memory usage is high - review memory leaks");
      recommendations.push("Consider implementing more aggressive garbage collection");
    }
    
    if (analysis.trends.responseTimeTrend === "degrading") {
      recommendations.push("Response times are trending worse - immediate investigation needed");
    }
    
    return recommendations;
  }
  
  /**
   * Generate performance report
   */
  static generateReport(): {
    summary: PerformanceAnalysis;
    topSlowOperations: PerformanceMetric[];
    memoryUsagePattern: any;
    recommendations: string[];
  } {
    const analysis = this.analyzePerformance();
    const recentMetrics = this.globalMetrics.slice(-1000);
    
    // Find slowest operations
    const topSlowOperations = recentMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    // Analyze memory usage patterns
    const memoryUsagePattern = this.analyzeMemoryPattern(recentMetrics);
    
    return {
      summary: analysis,
      topSlowOperations,
      memoryUsagePattern,
      recommendations: this.getPerformanceRecommendations()
    };
  }
  
  // Private helper methods
  
  private static getMemoryUsage() {
    if (typeof Deno !== "undefined" && Deno.memoryUsage) {
      return Deno.memoryUsage();
    }
    
    // Fallback for non-Deno environments
    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0
    };
  }
  
  private static calculateMemoryDelta(before: any, after: any) {
    return {
      heapUsed: after.heapUsed - before.heapUsed,
      heapTotal: after.heapTotal - before.heapTotal,
      external: after.external - before.external,
      rss: after.rss - before.rss
    };
  }
  
  private static generateSummary(profile: PerformanceProfile): PerformanceSummary {
    const totalDuration = (profile.endTime || performance.now()) - profile.startTime;
    
    const slowestOperations = profile.metrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    
    const databaseTime = profile.metrics
      .filter(m => m.type === "database")
      .reduce((sum, m) => sum + m.duration, 0);
    
    const cacheTime = profile.metrics
      .filter(m => m.type === "cache")
      .reduce((sum, m) => sum + m.duration, 0);
    
    const computationTime = profile.metrics
      .filter(m => m.type === "computation")
      .reduce((sum, m) => sum + m.duration, 0);
    
    const networkTime = profile.metrics
      .filter(m => m.type === "network")
      .reduce((sum, m) => sum + m.duration, 0);
    
    const memoryPeak = Math.max(
      ...profile.metrics.map(m => m.memoryUsage?.heapUsed || 0)
    );
    
    const recommendations = this.generateProfileRecommendations(profile.metrics);
    
    return {
      totalDuration,
      slowestOperations,
      databaseTime,
      cacheTime,
      computationTime,
      networkTime,
      memoryPeak,
      recommendations
    };
  }
  
  private static generateProfileRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];
    
    const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
    const slowOperations = metrics.filter(m => m.duration > avgDuration * 2);
    
    if (slowOperations.length > 0) {
      recommendations.push(`${slowOperations.length} operations are significantly slower than average`);
    }
    
    const dbOperations = metrics.filter(m => m.type === "database");
    if (dbOperations.length > 0) {
      const avgDbTime = dbOperations.reduce((sum, m) => sum + m.duration, 0) / dbOperations.length;
      if (avgDbTime > 100) {
        recommendations.push("Database queries are taking longer than expected");
      }
    }
    
    return recommendations;
  }
  
  private static calculateDatabasePerformance(dbMetrics: PerformanceMetric[]): number {
    if (dbMetrics.length === 0) return 100;
    
    const avgTime = dbMetrics.reduce((sum, m) => sum + m.duration, 0) / dbMetrics.length;
    const successRate = dbMetrics.filter(m => m.details?.success !== false).length / dbMetrics.length;
    
    // Score based on average response time and success rate
    const timeScore = Math.max(0, 100 - (avgTime / 10)); // 1000ms = 0 score, 0ms = 100 score
    const reliabilityScore = successRate * 100;
    
    return Math.round((timeScore + reliabilityScore) / 2);
  }
  
  private static calculateCacheHitRate(cacheMetrics: PerformanceMetric[]): number {
    if (cacheMetrics.length === 0) return 100;
    
    const hits = cacheMetrics.filter(m => 
      m.name.includes("get") && m.details?.success !== false && m.duration < 10
    ).length;
    
    return Math.round((hits / cacheMetrics.length) * 100);
  }
  
  private static calculateMemoryEfficiency(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 100;
    
    const memoryMetrics = metrics.filter(m => m.memoryUsage);
    if (memoryMetrics.length === 0) return 100;
    
    const avgMemory = memoryMetrics.reduce((sum, m) => sum + (m.memoryUsage?.heapUsed || 0), 0) / memoryMetrics.length;
    
    // Score based on memory usage (lower is better)
    // Assuming 100MB as baseline, scale accordingly
    return Math.max(0, 100 - (avgMemory / (100 * 1024 * 1024) * 100));
  }
  
  private static identifyBottlenecks(metrics: PerformanceMetric[]): string[] {
    const bottlenecks: string[] = [];
    
    // Group by operation type
    const byType = metrics.reduce((acc, m) => {
      acc[m.type] = acc[m.type] || [];
      acc[m.type].push(m);
      return acc;
    }, {} as Record<string, PerformanceMetric[]>);
    
    for (const [type, typeMetrics] of Object.entries(byType)) {
      const avgTime = typeMetrics.reduce((sum, m) => sum + m.duration, 0) / typeMetrics.length;
      
      if (avgTime > 500 && type === "database") {
        bottlenecks.push("Slow database queries detected");
      } else if (avgTime > 200 && type === "api") {
        bottlenecks.push("Slow API responses detected");
      } else if (avgTime > 50 && type === "cache") {
        bottlenecks.push("Cache operations are slower than expected");
      }
    }
    
    return bottlenecks;
  }
  
  private static generateOptimizations(metrics: PerformanceMetric[], analysis: any): string[] {
    const optimizations: string[] = [];
    
    if (analysis.averageResponseTime > 500) {
      optimizations.push("Implement request-level caching");
      optimizations.push("Optimize critical path operations");
    }
    
    if (analysis.databasePerformance < 80) {
      optimizations.push("Add database indexes for frequently queried fields");
      optimizations.push("Implement query result caching");
    }
    
    if (analysis.cacheHitRate < 70) {
      optimizations.push("Review cache key strategies");
      optimizations.push("Implement cache warming for popular content");
    }
    
    const slowOperations = metrics.filter(m => m.duration > 1000);
    if (slowOperations.length > 0) {
      optimizations.push("Optimize or parallelize slow operations");
      optimizations.push("Consider implementing background job processing");
    }
    
    return optimizations;
  }
  
  private static determineSystemHealth(metrics: any): PerformanceAnalysis["systemHealth"] {
    const score = (
      (metrics.averageResponseTime < 200 ? 25 : metrics.averageResponseTime < 500 ? 15 : 0) +
      (metrics.databasePerformance > 90 ? 25 : metrics.databasePerformance > 70 ? 15 : 0) +
      (metrics.cacheHitRate > 90 ? 25 : metrics.cacheHitRate > 70 ? 15 : 0) +
      (metrics.memoryEfficiency > 90 ? 25 : metrics.memoryEfficiency > 70 ? 15 : 0)
    );
    
    if (score >= 80) return "excellent";
    if (score >= 60) return "good";
    if (score >= 40) return "degraded";
    return "poor";
  }
  
  private static calculateTrends(metrics: PerformanceMetric[]): PerformanceAnalysis["trends"] {
    // Simple trend analysis based on recent vs older metrics
    const half = Math.floor(metrics.length / 2);
    const olderMetrics = metrics.slice(0, half);
    const recentMetrics = metrics.slice(half);
    
    const olderAvgTime = olderMetrics.reduce((sum, m) => sum + m.duration, 0) / olderMetrics.length;
    const recentAvgTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
    
    let responseTimeTrend: "improving" | "stable" | "degrading" = "stable";
    const timeDiff = recentAvgTime - olderAvgTime;
    if (timeDiff > olderAvgTime * 0.1) responseTimeTrend = "degrading";
    else if (timeDiff < -olderAvgTime * 0.1) responseTimeTrend = "improving";
    
    return {
      responseTimeTrend,
      memoryTrend: "stable", // Would need memory analysis
      errorTrend: "stable" // Would need error analysis
    };
  }
  
  private static analyzeMemoryPattern(metrics: PerformanceMetric[]) {
    const memoryMetrics = metrics.filter(m => m.memoryUsage);
    
    if (memoryMetrics.length === 0) {
      return { pattern: "no_data", trend: "stable" };
    }
    
    const memoryUsages = memoryMetrics.map(m => m.memoryUsage?.heapUsed || 0);
    const avgMemory = memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length;
    const maxMemory = Math.max(...memoryUsages);
    const minMemory = Math.min(...memoryUsages);
    
    return {
      pattern: "analyzed",
      average: avgMemory,
      peak: maxMemory,
      baseline: minMemory,
      variance: maxMemory - minMemory,
      trend: maxMemory > avgMemory * 1.5 ? "growing" : "stable"
    };
  }
  
  /**
   * Enable or disable performance profiling
   */
  static setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    telemetry.logger.info(`Performance profiling ${enabled ? "enabled" : "disabled"}`);
  }
  
  /**
   * Clear all stored metrics and profiles
   */
  static clearMetrics(): void {
    this.globalMetrics = [];
    this.profiles.clear();
    telemetry.logger.info("Performance metrics cleared");
  }
  
  /**
   * Get current system performance snapshot
   */
  static getSnapshot(): {
    activeProfiles: number;
    totalMetrics: number;
    systemHealth: string;
    memoryUsage: any;
  } {
    return {
      activeProfiles: this.profiles.size,
      totalMetrics: this.globalMetrics.length,
      systemHealth: this.analyzePerformance().systemHealth,
      memoryUsage: this.getMemoryUsage()
    };
  }
}