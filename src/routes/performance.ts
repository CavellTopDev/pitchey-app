/**
 * Performance Monitoring Routes
 * Provides endpoints for performance analysis, profiling, and optimization insights
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";
import { PerformanceProfiler } from "../services/performance-profiler.service.ts";
import { MonitoringService } from "../services/monitoring.service.ts";
import { CacheOptimizationService } from "../services/cache-optimization.service.ts";
import { telemetry } from "../utils/telemetry.ts";

// Get comprehensive performance analysis
export const getPerformanceAnalysis: RouteHandler = async (request, url) => {
  try {
    const profileId = PerformanceProfiler.startProfile("Performance Analysis");
    
    const analysis = await PerformanceProfiler.timeFunction(
      profileId,
      "Generate Performance Analysis",
      "computation",
      async () => PerformanceProfiler.analyzePerformance()
    );
    
    const report = await PerformanceProfiler.timeFunction(
      profileId,
      "Generate Performance Report",
      "computation",
      async () => PerformanceProfiler.generateReport()
    );
    
    const cacheMetrics = await PerformanceProfiler.timeFunction(
      profileId,
      "Get Cache Metrics",
      "cache",
      async () => CacheOptimizationService.getMetrics()
    );
    
    const systemSnapshot = PerformanceProfiler.getSnapshot();
    
    PerformanceProfiler.endProfile(profileId);
    
    return successResponse({
      analysis,
      report,
      cache_metrics: cacheMetrics,
      system_snapshot: systemSnapshot,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    telemetry.logger.error("Performance analysis error", error);
    return errorResponse("Failed to generate performance analysis", 500);
  }
};

// Get real-time performance metrics
export const getRealTimeMetrics: RouteHandler = async (request, url) => {
  try {
    const profileId = PerformanceProfiler.startProfile("Real-time Metrics");
    
    // Gather real-time system metrics
    const memoryUsage = Deno.memoryUsage ? Deno.memoryUsage() : null;
    const systemSnapshot = PerformanceProfiler.getSnapshot();
    const monitoringStats = MonitoringService.getSystemStatus();
    
    // Get cache performance
    const cacheMetrics = CacheOptimizationService.getMetrics();
    
    // Performance recommendations
    const recommendations = await PerformanceProfiler.timeFunction(
      profileId,
      "Generate Recommendations",
      "computation",
      async () => PerformanceProfiler.getPerformanceRecommendations()
    );
    
    PerformanceProfiler.endProfile(profileId);
    
    const metrics = {
      timestamp: new Date().toISOString(),
      memory: memoryUsage,
      performance: systemSnapshot,
      monitoring: monitoringStats,
      cache: {
        hit_rate: cacheMetrics.hitRate,
        memory_usage: cacheMetrics.memoryUsage,
        key_count: cacheMetrics.keyCount,
        top_keys: cacheMetrics.topKeys.slice(0, 5)
      },
      recommendations,
      health_score: calculateHealthScore(systemSnapshot, cacheMetrics)
    };
    
    return successResponse(metrics);
    
  } catch (error) {
    telemetry.logger.error("Real-time metrics error", error);
    return errorResponse("Failed to get real-time metrics", 500);
  }
};

// Start a performance profiling session
export const startProfiling: RouteHandler = async (request, url) => {
  try {
    const { name, duration } = await request.json();
    
    if (!name) {
      return errorResponse("Profile name is required", 400);
    }
    
    const profileId = PerformanceProfiler.startProfile(name);
    
    // Auto-end profile after duration (if specified)
    if (duration && duration > 0 && duration <= 300000) { // Max 5 minutes
      setTimeout(() => {
        const profile = PerformanceProfiler.endProfile(profileId);
        if (profile) {
          telemetry.logger.info("Auto-ended performance profile", {
            profileId,
            name: profile.name,
            duration: profile.summary?.totalDuration
          });
        }
      }, duration);
    }
    
    return successResponse({
      profile_id: profileId,
      name,
      started_at: new Date().toISOString(),
      auto_end_duration: duration || null
    });
    
  } catch (error) {
    telemetry.logger.error("Start profiling error", error);
    return errorResponse("Failed to start profiling session", 500);
  }
};

// End a profiling session and get results
export const endProfiling: RouteHandler = async (request, url) => {
  try {
    const profileId = url.searchParams.get("profile_id");
    
    if (!profileId) {
      return errorResponse("Profile ID is required", 400);
    }
    
    const profile = PerformanceProfiler.endProfile(profileId);
    
    if (!profile) {
      return errorResponse("Profile not found or already ended", 404);
    }
    
    // Generate detailed analysis
    const analysis = {
      profile_info: {
        id: profile.id,
        name: profile.name,
        duration: profile.summary?.totalDuration,
        operations: profile.metrics.length
      },
      summary: profile.summary,
      detailed_metrics: profile.metrics.map(m => ({
        name: m.name,
        duration: m.duration,
        type: m.type,
        timestamp: m.timestamp,
        memory_delta: m.details?.memoryDelta,
        success: m.details?.success !== false
      })),
      optimization_insights: generateOptimizationInsights(profile)
    };
    
    return successResponse(analysis);
    
  } catch (error) {
    telemetry.logger.error("End profiling error", error);
    return errorResponse("Failed to end profiling session", 500);
  }
};

// Get performance optimization recommendations
export const getOptimizationRecommendations: RouteHandler = async (request, url) => {
  try {
    const profileId = PerformanceProfiler.startProfile("Optimization Recommendations");
    
    // Get comprehensive recommendations
    const performanceRecommendations = await PerformanceProfiler.timeFunction(
      profileId,
      "Performance Recommendations",
      "computation",
      async () => PerformanceProfiler.getPerformanceRecommendations()
    );
    
    const cacheAnalysis = await PerformanceProfiler.timeFunction(
      profileId,
      "Cache Analysis",
      "cache",
      async () => CacheOptimizationService.analyzePerformance()
    );
    
    const systemAnalysis = await PerformanceProfiler.timeFunction(
      profileId,
      "System Analysis",
      "computation",
      async () => PerformanceProfiler.analyzePerformance()
    );
    
    PerformanceProfiler.endProfile(profileId);
    
    const recommendations = {
      timestamp: new Date().toISOString(),
      system_health: systemAnalysis.systemHealth,
      priority_recommendations: categorizePriorityRecommendations([
        ...performanceRecommendations,
        ...cacheAnalysis.recommendations,
        ...systemAnalysis.optimizations
      ]),
      cache_optimization: {
        current_performance: cacheAnalysis,
        recommendations: cacheAnalysis.optimization_tips
      },
      system_optimization: {
        bottlenecks: systemAnalysis.bottlenecks,
        optimizations: systemAnalysis.optimizations
      },
      implementation_guides: generateImplementationGuides(systemAnalysis)
    };
    
    return successResponse(recommendations);
    
  } catch (error) {
    telemetry.logger.error("Optimization recommendations error", error);
    return errorResponse("Failed to generate optimization recommendations", 500);
  }
};

// Get performance benchmarks and trends
export const getPerformanceBenchmarks: RouteHandler = async (request, url) => {
  try {
    const period = url.searchParams.get("period") || "24h";
    const metric_type = url.searchParams.get("type") || "all";
    
    const profileId = PerformanceProfiler.startProfile("Performance Benchmarks");
    
    // Generate benchmark data
    const benchmarks = await PerformanceProfiler.timeFunction(
      profileId,
      "Generate Benchmarks",
      "computation",
      async () => generatePerformanceBenchmarks(period, metric_type)
    );
    
    const trends = await PerformanceProfiler.timeFunction(
      profileId,
      "Analyze Trends",
      "computation", 
      async () => PerformanceProfiler.analyzePerformance().trends
    );
    
    PerformanceProfiler.endProfile(profileId);
    
    return successResponse({
      period,
      metric_type,
      benchmarks,
      trends,
      comparison: {
        vs_baseline: calculateBaselineComparison(benchmarks),
        vs_targets: calculateTargetComparison(benchmarks)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    telemetry.logger.error("Performance benchmarks error", error);
    return errorResponse("Failed to generate performance benchmarks", 500);
  }
};

// Run performance diagnostic tests
export const runPerformanceDiagnostics: RouteHandler = async (request, url) => {
  try {
    const { test_type, iterations } = await request.json().catch(() => ({}));
    
    const profileId = PerformanceProfiler.startProfile("Performance Diagnostics");
    
    const diagnostics = await PerformanceProfiler.timeFunction(
      profileId,
      "Run Diagnostics",
      "computation",
      async () => await runDiagnosticTests(test_type || "comprehensive", iterations || 5)
    );
    
    PerformanceProfiler.endProfile(profileId);
    
    return successResponse({
      test_type: test_type || "comprehensive",
      iterations: iterations || 5,
      results: diagnostics,
      recommendations: generateDiagnosticRecommendations(diagnostics),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    telemetry.logger.error("Performance diagnostics error", error);
    return errorResponse("Failed to run performance diagnostics", 500);
  }
};

// Clear performance metrics
export const clearPerformanceMetrics: RouteHandler = async (request, url) => {
  try {
    const confirm = url.searchParams.get("confirm") === "true";
    
    if (!confirm) {
      return errorResponse("Add ?confirm=true to clear all performance metrics", 400);
    }
    
    PerformanceProfiler.clearMetrics();
    CacheOptimizationService.cleanUp();
    
    telemetry.logger.info("Performance metrics cleared by admin");
    
    return successResponse({
      message: "All performance metrics cleared successfully",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    telemetry.logger.error("Clear metrics error", error);
    return errorResponse("Failed to clear performance metrics", 500);
  }
};

// Helper functions

function calculateHealthScore(systemSnapshot: any, cacheMetrics: any): number {
  const scores = [
    Math.min(100, (1 - (systemSnapshot.totalMetrics / 10000)) * 100), // Metric volume score
    cacheMetrics.hitRate, // Cache performance
    systemSnapshot.systemHealth === "excellent" ? 100 : 
    systemSnapshot.systemHealth === "good" ? 80 :
    systemSnapshot.systemHealth === "degraded" ? 60 : 40, // System health
  ];
  
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function generateOptimizationInsights(profile: any) {
  const insights = [];
  
  if (profile.summary?.databaseTime > profile.summary?.totalDuration * 0.5) {
    insights.push({
      type: "database",
      severity: "high",
      message: "Database operations consume over 50% of total execution time",
      recommendation: "Consider database query optimization and indexing"
    });
  }
  
  if (profile.summary?.slowestOperations.length > 0) {
    const slowest = profile.summary.slowestOperations[0];
    insights.push({
      type: "performance",
      severity: "medium",
      message: `Slowest operation: ${slowest.name} (${slowest.duration}ms)`,
      recommendation: "Investigate and optimize the slowest operation first"
    });
  }
  
  return insights;
}

function categorizePriorityRecommendations(recommendations: string[]) {
  const high = recommendations.filter(r => 
    r.includes("critical") || r.includes("immediate") || r.includes("urgent")
  );
  
  const medium = recommendations.filter(r => 
    r.includes("consider") || r.includes("review") || r.includes("optimize")
  );
  
  const low = recommendations.filter(r => 
    !high.includes(r) && !medium.includes(r)
  );
  
  return { high, medium, low };
}

function generateImplementationGuides(analysis: any) {
  const guides = [];
  
  if (analysis.bottlenecks.includes("Slow database queries detected")) {
    guides.push({
      issue: "Database Performance",
      steps: [
        "Identify slow queries using EXPLAIN ANALYZE",
        "Add appropriate indexes for frequent queries",
        "Consider query optimization or rewriting",
        "Implement connection pooling if not already done"
      ]
    });
  }
  
  if (analysis.metrics.cacheHitRate < 70) {
    guides.push({
      issue: "Cache Optimization",
      steps: [
        "Review current cache key strategies",
        "Implement cache warming for popular content",
        "Adjust TTL values based on data volatility",
        "Consider implementing cache hierarchies"
      ]
    });
  }
  
  return guides;
}

async function generatePerformanceBenchmarks(period: string, metricType: string) {
  // Mock benchmark data - in real implementation, this would query historical metrics
  const benchmarks = {
    response_time: {
      p50: 120,
      p90: 280,
      p95: 450,
      p99: 800,
      avg: 150
    },
    throughput: {
      requests_per_second: 85,
      peak_rps: 150,
      avg_rps: 65
    },
    database: {
      avg_query_time: 45,
      slow_queries_count: 12,
      connection_pool_usage: 65
    },
    cache: {
      hit_rate: 78,
      miss_rate: 22,
      avg_lookup_time: 5
    },
    memory: {
      avg_usage_mb: 120,
      peak_usage_mb: 180,
      gc_frequency: 15
    }
  };
  
  return benchmarks;
}

function calculateBaselineComparison(benchmarks: any) {
  // Compare against ideal baseline values
  const baselines = {
    response_time_p95: 200,
    cache_hit_rate: 90,
    database_avg_query: 25,
    memory_efficiency: 80
  };
  
  return {
    response_time: benchmarks.response_time.p95 <= baselines.response_time_p95 ? "good" : "needs_improvement",
    cache_performance: benchmarks.cache.hit_rate >= baselines.cache_hit_rate ? "excellent" : "needs_improvement",
    database_performance: benchmarks.database.avg_query_time <= baselines.database_avg_query ? "excellent" : "needs_improvement"
  };
}

function calculateTargetComparison(benchmarks: any) {
  // Compare against target SLA values
  const targets = {
    response_time_p95: 300,
    cache_hit_rate: 75,
    uptime: 99.9
  };
  
  return {
    meeting_sla: benchmarks.response_time.p95 <= targets.response_time_p95 &&
                 benchmarks.cache.hit_rate >= targets.cache_hit_rate,
    margins: {
      response_time: (targets.response_time_p95 - benchmarks.response_time.p95) / targets.response_time_p95,
      cache_hit_rate: (benchmarks.cache.hit_rate - targets.cache_hit_rate) / targets.cache_hit_rate
    }
  };
}

async function runDiagnosticTests(testType: string, iterations: number) {
  const profileId = PerformanceProfiler.startProfile("Diagnostic Tests");
  const results: any = {};
  
  try {
    // Memory allocation test
    if (testType === "comprehensive" || testType === "memory") {
      results.memory_test = await PerformanceProfiler.timeFunction(
        profileId,
        "Memory Allocation Test",
        "computation",
        async () => {
          const allocations = [];
          for (let i = 0; i < iterations; i++) {
            allocations.push(new Array(1000).fill(Math.random()));
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          return { allocations: allocations.length, total_size: allocations.length * 1000 };
        }
      );
    }
    
    // CPU intensive test
    if (testType === "comprehensive" || testType === "cpu") {
      results.cpu_test = await PerformanceProfiler.timeFunction(
        profileId,
        "CPU Intensive Test",
        "computation",
        async () => {
          let result = 0;
          for (let i = 0; i < iterations * 10000; i++) {
            result += Math.sqrt(Math.random() * 1000);
          }
          return { operations: iterations * 10000, result };
        }
      );
    }
    
    // I/O simulation test
    if (testType === "comprehensive" || testType === "io") {
      results.io_test = await PerformanceProfiler.timeFunction(
        profileId,
        "I/O Simulation Test",
        "network",
        async () => {
          const promises = [];
          for (let i = 0; i < iterations; i++) {
            promises.push(new Promise(resolve => setTimeout(resolve, Math.random() * 50)));
          }
          await Promise.all(promises);
          return { concurrent_operations: iterations };
        }
      );
    }
    
  } finally {
    PerformanceProfiler.endProfile(profileId);
  }
  
  return results;
}

function generateDiagnosticRecommendations(diagnostics: any): string[] {
  const recommendations = [];
  
  if (diagnostics.memory_test?.duration > 1000) {
    recommendations.push("Memory allocation is slower than expected - review garbage collection settings");
  }
  
  if (diagnostics.cpu_test?.duration > 500) {
    recommendations.push("CPU performance is suboptimal - consider optimizing computational algorithms");
  }
  
  if (diagnostics.io_test?.duration > 300) {
    recommendations.push("I/O operations are slower than expected - review async operation patterns");
  }
  
  return recommendations;
}