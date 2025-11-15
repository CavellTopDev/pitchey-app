/**
 * Database Optimization Management Routes
 * Provides endpoints for managing and monitoring intelligent database optimization
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";
import { DatabaseOptimizerService } from "../services/database-optimizer.service.ts";
import { telemetry } from "../utils/telemetry.ts";

// Get database optimization metrics and insights
export const getDatabaseMetrics: RouteHandler = async (request, url) => {
  try {
    const metrics = DatabaseOptimizerService.getMetrics();
    const performanceStats = DatabaseOptimizerService.getPerformanceStats();
    const healthStatus = DatabaseOptimizerService.getHealthStatus();
    
    // Calculate trend analysis
    const queryTrends = {
      average_execution_time: performanceStats.avgExecutionTime,
      query_volume: metrics.totalQueries,
      optimization_rate: metrics.optimizedQueries > 0 
        ? (metrics.optimizedQueries / metrics.totalQueries) * 100 
        : 0,
      performance_improvement: performanceStats.improvementPercentage || 0
    };

    // Identify performance issues
    const performanceIssues = [];
    if (performanceStats.avgExecutionTime > 1000) {
      performanceIssues.push("High average query execution time detected");
    }
    if (performanceStats.slowQueries > 10) {
      performanceIssues.push("Multiple slow queries identified");
    }
    if (healthStatus.indexUsage < 80) {
      performanceIssues.push("Low index usage efficiency");
    }

    return successResponse({
      timestamp: new Date().toISOString(),
      metrics,
      performance_stats: performanceStats,
      health_status: healthStatus,
      query_trends: queryTrends,
      performance_issues: performanceIssues,
      recommendations: generatePerformanceRecommendations(metrics, performanceStats, healthStatus)
    });

  } catch (error) {
    telemetry.logger.error("Database metrics error", error);
    return errorResponse("Failed to get database metrics", 500);
  }
};

// Get detailed query analysis
export const getQueryAnalysis: RouteHandler = async (request, url) => {
  try {
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const sortBy = url.searchParams.get("sort") || "executionTime";
    const order = url.searchParams.get("order") || "desc";
    const includeOptimized = url.searchParams.get("include_optimized") === "true";

    const queryStats = DatabaseOptimizerService.getQueryStats();
    
    let filteredQueries = includeOptimized 
      ? queryStats 
      : queryStats.filter(q => !q.isOptimized);

    // Sort queries
    filteredQueries.sort((a, b) => {
      const aVal = a[sortBy as keyof typeof a] || 0;
      const bVal = b[sortBy as keyof typeof b] || 0;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === "desc" ? bVal - aVal : aVal - bVal;
      }
      return String(aVal).localeCompare(String(bVal));
    });

    // Limit results
    const paginatedQueries = filteredQueries.slice(0, limit);

    // Calculate statistics
    const statistics = {
      total_unique_queries: queryStats.length,
      slow_queries: queryStats.filter(q => q.avgExecutionTime > 1000).length,
      frequent_queries: queryStats.filter(q => q.executionCount > 100).length,
      optimized_queries: queryStats.filter(q => q.isOptimized).length,
      queries_needing_attention: queryStats.filter(q => 
        q.avgExecutionTime > 1000 || q.executionCount > 100
      ).length
    };

    return successResponse({
      queries: paginatedQueries.map(query => ({
        query_hash: query.queryHash,
        sql_pattern: query.sql.length > 200 ? query.sql.substring(0, 200) + "..." : query.sql,
        execution_count: query.executionCount,
        avg_execution_time: query.avgExecutionTime,
        total_execution_time: query.totalExecutionTime,
        is_optimized: query.isOptimized,
        last_executed: new Date(query.lastExecuted).toISOString(),
        complexity_score: query.analysis?.complexity || "unknown",
        optimization_suggestions: query.analysis?.optimizations?.length || 0
      })),
      statistics,
      pagination: {
        limit,
        showing: paginatedQueries.length,
        sort: { by: sortBy, order }
      }
    });

  } catch (error) {
    telemetry.logger.error("Query analysis error", error);
    return errorResponse("Failed to get query analysis", 500);
  }
};

// Get optimization recommendations
export const getOptimizationRecommendations: RouteHandler = async (request, url) => {
  try {
    const priority = url.searchParams.get("priority") || "all";
    const category = url.searchParams.get("category") || "all";
    
    const globalRecommendations = DatabaseOptimizerService.getGlobalOptimizations();
    
    let filteredRecommendations = globalRecommendations;
    
    if (priority !== "all") {
      filteredRecommendations = filteredRecommendations.filter(r => 
        r.priority === priority
      );
    }
    
    if (category !== "all") {
      filteredRecommendations = filteredRecommendations.filter(r => 
        r.category === category
      );
    }

    // Group by category
    const groupedRecommendations = filteredRecommendations.reduce((groups, rec) => {
      const category = rec.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(rec);
      return groups;
    }, {} as Record<string, typeof filteredRecommendations>);

    // Calculate impact summary
    const impactSummary = {
      high_impact: filteredRecommendations.filter(r => r.estimatedImpact > 30).length,
      medium_impact: filteredRecommendations.filter(r => r.estimatedImpact > 15 && r.estimatedImpact <= 30).length,
      low_impact: filteredRecommendations.filter(r => r.estimatedImpact <= 15).length,
      total_estimated_improvement: filteredRecommendations.reduce((sum, r) => sum + r.estimatedImpact, 0)
    };

    return successResponse({
      recommendations: groupedRecommendations,
      summary: {
        total: filteredRecommendations.length,
        categories: Object.keys(groupedRecommendations),
        impact_summary: impactSummary
      },
      filters: { priority, category },
      available_categories: ["indexing", "query_structure", "schema", "caching", "configuration"],
      priority_levels: ["high", "medium", "low"]
    });

  } catch (error) {
    telemetry.logger.error("Optimization recommendations error", error);
    return errorResponse("Failed to get optimization recommendations", 500);
  }
};

// Analyze specific query
export const analyzeQuery: RouteHandler = async (request, url) => {
  try {
    const { sql, includeExplanation } = await request.json();
    
    if (!sql || typeof sql !== "string") {
      return errorResponse("Valid SQL query is required", 400);
    }

    if (sql.length > 10000) {
      return errorResponse("Query too long (max 10,000 characters)", 400);
    }

    // Analyze the query
    const analysis = await DatabaseOptimizerService.analyzeQuery(sql);
    
    // Get execution plan if requested
    let executionPlan = null;
    if (includeExplanation) {
      executionPlan = await DatabaseOptimizerService.getQueryPlan(sql);
    }

    // Format response with detailed analysis
    return successResponse({
      query: {
        sql: sql.trim(),
        normalized: analysis.normalizedSql,
        hash: analysis.queryHash
      },
      analysis: {
        complexity: analysis.complexity,
        estimated_cost: analysis.performance.estimatedCost,
        table_count: analysis.tables?.length || 0,
        join_count: analysis.joinCount || 0,
        subquery_count: analysis.subqueryCount || 0
      },
      performance: {
        expected_execution_time: analysis.performance.estimatedExecutionTime,
        index_usage_score: analysis.performance.indexUsage,
        optimization_score: analysis.performance.optimizationScore
      },
      optimizations: analysis.optimizations.map(opt => ({
        type: opt.type,
        priority: opt.priority,
        description: opt.description,
        estimated_improvement: opt.estimatedImprovement,
        difficulty: opt.difficulty,
        sql_suggestion: opt.sqlSuggestion
      })),
      warnings: analysis.warnings,
      execution_plan: executionPlan,
      recommendations: generateQueryRecommendations(analysis)
    });

  } catch (error) {
    telemetry.logger.error("Analyze query error", error);
    return errorResponse("Failed to analyze query", 500);
  }
};

// Apply query optimization
export const applyOptimization: RouteHandler = async (request, url) => {
  try {
    const { originalSql, optimizationId, autoApply } = await request.json();
    
    if (!originalSql || !optimizationId) {
      return errorResponse("Original SQL and optimization ID are required", 400);
    }

    // Get the optimization suggestion
    const analysis = await DatabaseOptimizerService.analyzeQuery(originalSql);
    const optimization = analysis.optimizations.find(opt => opt.id === optimizationId);
    
    if (!optimization) {
      return errorResponse("Optimization not found", 404);
    }

    let result;
    if (autoApply) {
      // Automatically apply the optimization
      result = await DatabaseOptimizerService.applyOptimization(originalSql, optimization);
    } else {
      // Just return the optimized query for review
      result = {
        optimized_sql: optimization.sqlSuggestion,
        applied: false,
        message: "Optimization prepared for review"
      };
    }

    return successResponse({
      original_sql: originalSql,
      optimization: {
        id: optimization.id,
        type: optimization.type,
        description: optimization.description,
        estimated_improvement: optimization.estimatedImprovement
      },
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Apply optimization error", error);
    return errorResponse("Failed to apply optimization", 500);
  }
};

// Run database health check
export const runHealthCheck: RouteHandler = async (request, url) => {
  try {
    const comprehensive = url.searchParams.get("comprehensive") === "true";
    
    const healthStatus = DatabaseOptimizerService.getHealthStatus();
    const metrics = DatabaseOptimizerService.getMetrics();
    const performanceStats = DatabaseOptimizerService.getPerformanceStats();

    // Run additional checks if comprehensive
    let additionalChecks = {};
    if (comprehensive) {
      additionalChecks = {
        slow_query_analysis: await DatabaseOptimizerService.analyzeSlowQueries(),
        index_efficiency: await DatabaseOptimizerService.analyzeIndexEfficiency(),
        table_statistics: await DatabaseOptimizerService.getTableStatistics()
      };
    }

    // Calculate overall health score
    const healthScore = calculateHealthScore(healthStatus, metrics, performanceStats);
    
    // Generate health recommendations
    const healthRecommendations = generateHealthRecommendations(
      healthStatus, 
      metrics, 
      performanceStats,
      healthScore
    );

    return successResponse({
      health_score: healthScore,
      status: healthScore > 80 ? "excellent" : 
              healthScore > 60 ? "good" :
              healthScore > 40 ? "fair" : "poor",
      metrics: {
        query_performance: performanceStats,
        optimization_metrics: metrics,
        system_health: healthStatus
      },
      recommendations: healthRecommendations,
      additional_checks: comprehensive ? additionalChecks : undefined,
      last_updated: new Date().toISOString(),
      next_recommended_check: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Health check error", error);
    return errorResponse("Failed to run health check", 500);
  }
};

// Get optimization history
export const getOptimizationHistory: RouteHandler = async (request, url) => {
  try {
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    
    const history = DatabaseOptimizerService.getOptimizationHistory();
    
    let filteredHistory = history;
    
    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      filteredHistory = filteredHistory.filter(h => new Date(h.timestamp) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      filteredHistory = filteredHistory.filter(h => new Date(h.timestamp) <= end);
    }
    
    // Sort by timestamp (newest first)
    filteredHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Limit results
    const paginatedHistory = filteredHistory.slice(0, limit);
    
    // Calculate summary statistics
    const summary = {
      total_optimizations: filteredHistory.length,
      successful_optimizations: filteredHistory.filter(h => h.success).length,
      total_performance_gain: filteredHistory
        .filter(h => h.success)
        .reduce((sum, h) => sum + (h.performanceImprovement || 0), 0),
      most_common_optimization: getMostCommonOptimizationType(filteredHistory)
    };

    return successResponse({
      history: paginatedHistory.map(h => ({
        id: h.id,
        timestamp: h.timestamp,
        query_hash: h.queryHash,
        optimization_type: h.optimizationType,
        success: h.success,
        performance_improvement: h.performanceImprovement,
        error_message: h.errorMessage,
        applied_by: h.appliedBy || "system"
      })),
      summary,
      pagination: {
        limit,
        showing: paginatedHistory.length,
        total: filteredHistory.length
      },
      filters: {
        start_date: startDate,
        end_date: endDate
      }
    });

  } catch (error) {
    telemetry.logger.error("Optimization history error", error);
    return errorResponse("Failed to get optimization history", 500);
  }
};

// Configure optimization settings
export const configureOptimization: RouteHandler = async (request, url) => {
  try {
    const settings = await request.json();
    
    // Validate settings
    const validSettings = {
      autoOptimization: settings.autoOptimization === true,
      optimizationThreshold: Math.max(0, Math.min(100, settings.optimizationThreshold || 10)),
      maxOptimizationsPerHour: Math.max(1, Math.min(1000, settings.maxOptimizationsPerHour || 10)),
      analysisDepth: ["shallow", "medium", "deep"].includes(settings.analysisDepth) 
        ? settings.analysisDepth 
        : "medium",
      enableBackgroundAnalysis: settings.enableBackgroundAnalysis === true,
      retentionDays: Math.max(1, Math.min(365, settings.retentionDays || 30))
    };

    // Apply settings
    DatabaseOptimizerService.updateSettings(validSettings);
    
    telemetry.logger.info("Database optimization settings updated", validSettings);

    return successResponse({
      message: "Optimization settings updated successfully",
      settings: validSettings,
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Configure optimization error", error);
    return errorResponse("Failed to configure optimization settings", 500);
  }
};

// Helper functions

function generatePerformanceRecommendations(metrics: any, stats: any, health: any): string[] {
  const recommendations = [];
  
  if (stats.avgExecutionTime > 1000) {
    recommendations.push("Consider optimizing slow queries with execution time > 1s");
  }
  
  if (health.indexUsage < 80) {
    recommendations.push("Review index usage - consider adding indexes for better performance");
  }
  
  if (metrics.totalQueries > 10000 && metrics.optimizedQueries / metrics.totalQueries < 0.1) {
    recommendations.push("Enable automatic optimization for high-volume query patterns");
  }
  
  if (stats.slowQueries > 20) {
    recommendations.push("Investigate and optimize frequently slow queries");
  }
  
  if (health.connectionUsage > 90) {
    recommendations.push("Monitor connection pool usage - consider increasing pool size");
  }

  return recommendations;
}

function generateQueryRecommendations(analysis: any): string[] {
  const recommendations = [];
  
  if (analysis.complexity === "high") {
    recommendations.push("Consider breaking down complex query into smaller parts");
  }
  
  if (analysis.joinCount > 5) {
    recommendations.push("Review join structure - consider denormalization for better performance");
  }
  
  if (analysis.performance.indexUsage < 50) {
    recommendations.push("Add appropriate indexes to improve query performance");
  }
  
  if (analysis.subqueryCount > 3) {
    recommendations.push("Consider converting subqueries to JOINs where possible");
  }

  return recommendations;
}

function calculateHealthScore(health: any, metrics: any, stats: any): number {
  let score = 100;
  
  // Performance factors
  if (stats.avgExecutionTime > 2000) score -= 20;
  else if (stats.avgExecutionTime > 1000) score -= 10;
  
  // Index usage
  if (health.indexUsage < 60) score -= 15;
  else if (health.indexUsage < 80) score -= 8;
  
  // Slow queries
  if (stats.slowQueries > 50) score -= 15;
  else if (stats.slowQueries > 20) score -= 8;
  
  // Connection usage
  if (health.connectionUsage > 95) score -= 10;
  else if (health.connectionUsage > 85) score -= 5;
  
  // Optimization rate
  const optimizationRate = metrics.totalQueries > 0 
    ? (metrics.optimizedQueries / metrics.totalQueries) * 100 
    : 0;
  if (optimizationRate < 5) score -= 10;
  
  return Math.max(0, Math.min(100, score));
}

function generateHealthRecommendations(health: any, metrics: any, stats: any, score: number): string[] {
  const recommendations = [];
  
  if (score < 60) {
    recommendations.push("Database performance needs immediate attention");
  }
  
  if (stats.avgExecutionTime > 1000) {
    recommendations.push("Focus on optimizing slow queries to improve overall performance");
  }
  
  if (health.indexUsage < 70) {
    recommendations.push("Audit and optimize database indexes");
  }
  
  if (health.connectionUsage > 80) {
    recommendations.push("Monitor connection pool and consider scaling");
  }
  
  recommendations.push("Schedule regular performance reviews");
  recommendations.push("Enable automated optimization for continuous improvement");

  return recommendations;
}

function getMostCommonOptimizationType(history: any[]): string {
  const types = history.reduce((acc, h) => {
    acc[h.optimizationType] = (acc[h.optimizationType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(types).reduce((a, b) => types[a[0]] > types[b[0]] ? a : b)?.[0] || "none";
}