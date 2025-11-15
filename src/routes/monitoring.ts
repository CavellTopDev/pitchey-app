/**
 * Monitoring and Health Check Routes
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { MonitoringService } from "../services/monitoring.service.ts";
import { ErrorHandler } from "../middleware/error-handler.ts";
import { DatabaseOptimizationService } from "../services/database-optimization.service.ts";

// Health check endpoint
export const healthCheck: RouteHandler = async (request, url) => {
  try {
    const status = await MonitoringService.performHealthCheck();
    
    const responseCode = status.overall === "operational" ? 200 : 
                        status.overall === "degraded" ? 207 : 503;
    
    return new Response(JSON.stringify({
      success: true,
      data: status
    }), {
      status: responseCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });

  } catch (error) {
    telemetry.logger.error("Health check error", error);
    return errorResponse("Health check failed", 503);
  }
};

// System metrics endpoint
export const getMetrics: RouteHandler = async (request, url) => {
  try {
    const metrics = await MonitoringService.collectSystemMetrics();
    
    return successResponse({
      metrics,
      collected_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Metrics collection error", error);
    return errorResponse("Failed to collect metrics", 500);
  }
};

// Comprehensive monitoring dashboard
export const getDashboard: RouteHandler = async (request, url) => {
  try {
    const dashboardData = await MonitoringService.getDashboardData();
    
    return successResponse(dashboardData);

  } catch (error) {
    telemetry.logger.error("Dashboard data error", error);
    return errorResponse("Failed to load dashboard data", 500);
  }
};

// System alerts endpoint
export const getAlerts: RouteHandler = async (request, url) => {
  try {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const alerts = MonitoringService.getRecentAlerts(limit);
    
    return successResponse({
      alerts,
      total: alerts.length
    });

  } catch (error) {
    telemetry.logger.error("Alerts retrieval error", error);
    return errorResponse("Failed to retrieve alerts", 500);
  }
};

// Error statistics endpoint
export const getErrorStats: RouteHandler = async (request, url) => {
  try {
    const timeRange = (url.searchParams.get("timeRange") as any) || "24h";
    const stats = await ErrorHandler.getErrorStats(timeRange);
    
    return successResponse({
      timeRange,
      statistics: stats,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Error stats error", error);
    return errorResponse("Failed to retrieve error statistics", 500);
  }
};

// System status page endpoint (public)
export const getSystemStatus: RouteHandler = async (request, url) => {
  try {
    const status = await MonitoringService.performHealthCheck();
    
    // Public-facing status (less detailed)
    const publicStatus = {
      status: status.overall,
      services: status.services.map(service => ({
        name: service.service,
        status: service.status,
        message: service.message
      })),
      lastUpdated: status.lastChecked
    };
    
    return successResponse(publicStatus);

  } catch (error) {
    telemetry.logger.error("System status error", error);
    return errorResponse("Failed to retrieve system status", 500);
  }
};

// Performance metrics endpoint
export const getPerformanceMetrics: RouteHandler = async (request, url) => {
  try {
    const metrics = await MonitoringService.collectSystemMetrics();
    
    // Return only performance-related metrics
    const performanceData = {
      responseTime: metrics.performance.responseTime,
      requestsPerSecond: metrics.performance.requestsPerSecond,
      errorRate: metrics.performance.errorRate,
      uptime: metrics.uptime,
      memory: {
        usage: metrics.memory.percentage,
        used: Math.round(metrics.memory.used / 1024 / 1024), // MB
        total: Math.round(metrics.memory.total / 1024 / 1024) // MB
      },
      timestamp: metrics.timestamp
    };
    
    return successResponse(performanceData);

  } catch (error) {
    telemetry.logger.error("Performance metrics error", error);
    return errorResponse("Failed to retrieve performance metrics", 500);
  }
};

// Trigger manual health check
export const triggerHealthCheck: RouteHandler = async (request, url) => {
  try {
    // Force a comprehensive health check
    const status = await MonitoringService.performHealthCheck();
    
    // Also check alerts
    await MonitoringService.checkAlerts();
    
    return successResponse({
      message: "Health check completed",
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Manual health check error", error);
    return errorResponse("Failed to trigger health check", 500);
  }
};

// Get service uptime
export const getUptime: RouteHandler = async (request, url) => {
  try {
    const metrics = await MonitoringService.collectSystemMetrics();
    
    const uptimeData = {
      uptime: metrics.uptime,
      uptimeFormatted: formatUptime(metrics.uptime),
      startTime: new Date(Date.now() - metrics.uptime * 1000).toISOString(),
      currentTime: new Date().toISOString()
    };
    
    return successResponse(uptimeData);

  } catch (error) {
    telemetry.logger.error("Uptime retrieval error", error);
    return errorResponse("Failed to retrieve uptime", 500);
  }
};

// Database optimization endpoint
export const optimizeDatabase: RouteHandler = async (request, url) => {
  try {
    const optimization = await DatabaseOptimizationService.runOptimization();
    
    return successResponse({
      message: "Database optimization completed",
      results: optimization
    });

  } catch (error) {
    telemetry.logger.error("Database optimization error", error);
    return errorResponse("Failed to optimize database", 500);
  }
};

// Get database performance stats
export const getDatabaseStats: RouteHandler = async (request, url) => {
  try {
    const [tableStats, indexStats, queryAnalysis] = await Promise.all([
      DatabaseOptimizationService.analyzeTableStats(),
      DatabaseOptimizationService.getIndexUsageStats(),
      DatabaseOptimizationService.analyzeSlowQueries()
    ]);
    
    return successResponse({
      tables: tableStats,
      indexes: indexStats,
      queryAnalysis,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Database stats error", error);
    return errorResponse("Failed to retrieve database statistics", 500);
  }
};

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}