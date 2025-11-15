/**
 * Advanced Metrics and Business Intelligence Dashboard Routes
 * Provides endpoints for comprehensive analytics, insights, and business intelligence
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";
import { BusinessIntelligenceService } from "../services/business-intelligence.service.ts";
import { telemetry } from "../utils/telemetry.ts";

const businessIntelligence = BusinessIntelligenceService.getInstance();

// Get comprehensive business intelligence overview
export const getBusinessOverview: RouteHandler = async (request, url) => {
  try {
    const timeRange = url.searchParams.get("time_range") || "24h";
    const includeInsights = url.searchParams.get("include_insights") !== "false";
    const includePredictions = url.searchParams.get("include_predictions") !== "false";

    // Get platform metrics
    const platformMetrics = businessIntelligence.getPlatformMetrics(timeRange);
    
    // Get KPI metrics
    const kpiMetrics = businessIntelligence.getMetrics({ isKPI: true });
    
    // Get recent insights
    let insights = [];
    if (includeInsights) {
      insights = businessIntelligence.getInsights({ actionable: true }).slice(0, 10);
    }

    // Calculate business health score
    const healthScore = calculateBusinessHealthScore(platformMetrics, kpiMetrics);

    return successResponse({
      timestamp: new Date().toISOString(),
      time_range: timeRange,
      business_health: {
        score: healthScore,
        status: getHealthStatus(healthScore),
        factors: getHealthFactors(platformMetrics)
      },
      platform_metrics: platformMetrics,
      kpi_summary: {
        total_kpis: kpiMetrics.length,
        kpis_on_target: kpiMetrics.filter(m => 
          m.data.length > 0 && 
          m.target && 
          m.data[m.data.length - 1].value >= m.target
        ).length,
        kpis_below_threshold: kpiMetrics.filter(m =>
          m.data.length > 0 &&
          m.threshold &&
          m.data[m.data.length - 1].value < m.threshold.warning
        ).length
      },
      insights: includeInsights ? insights.map(formatInsightForOverview) : undefined,
      recommendations: generateBusinessRecommendations(platformMetrics, insights),
      next_update: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
    });

  } catch (error) {
    telemetry.logger.error("Business overview error", error);
    return errorResponse("Failed to get business overview", 500);
  }
};

// Get detailed metrics with filtering and analysis
export const getMetrics: RouteHandler = async (request, url) => {
  try {
    const category = url.searchParams.get("category") || undefined;
    const isKPI = url.searchParams.get("kpi") === "true" ? true : undefined;
    const tags = url.searchParams.get("tags")?.split(",") || undefined;
    const timeRange = url.searchParams.get("time_range") || "24h";
    const aggregation = url.searchParams.get("aggregation") || undefined;

    let metrics = businessIntelligence.getMetrics({ category, isKPI, tags });

    // Apply time range filtering to metric data
    const cutoff = Date.now() - parseTimeRange(timeRange);
    metrics = metrics.map(metric => ({
      ...metric,
      data: metric.data.filter(dp => dp.timestamp > cutoff),
      summary: calculateMetricSummary(metric, cutoff)
    }));

    // Group by category
    const metricsByCategory = metrics.reduce((acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push(metric);
      return acc;
    }, {} as Record<string, typeof metrics>);

    return successResponse({
      metrics: metrics.map(formatMetricForResponse),
      metrics_by_category: metricsByCategory,
      summary: {
        total_metrics: metrics.length,
        categories: Object.keys(metricsByCategory),
        kpi_metrics: metrics.filter(m => m.isKPI).length,
        active_metrics: metrics.filter(m => m.data.length > 0).length,
        time_range: timeRange
      },
      available_filters: {
        categories: [...new Set(metrics.map(m => m.category))],
        tags: [...new Set(metrics.flatMap(m => m.tags))],
        time_ranges: ["1h", "6h", "24h", "7d", "30d", "90d"]
      }
    });

  } catch (error) {
    telemetry.logger.error("Get metrics error", error);
    return errorResponse("Failed to get metrics", 500);
  }
};

// Get specific metric details and analysis
export const getMetricDetails: RouteHandler = async (request, url) => {
  try {
    const metricId = url.searchParams.get("metric_id");
    if (!metricId) {
      return errorResponse("Metric ID is required", 400);
    }

    const timeRange = url.searchParams.get("time_range") || "30d";
    const includeAnalysis = url.searchParams.get("include_analysis") !== "false";

    const metric = businessIntelligence.getMetric(metricId);
    if (!metric) {
      return errorResponse("Metric not found", 404);
    }

    // Filter data by time range
    const cutoff = Date.now() - parseTimeRange(timeRange);
    const filteredData = metric.data.filter(dp => dp.timestamp > cutoff);

    let analysis = {};
    if (includeAnalysis && filteredData.length > 0) {
      analysis = {
        trend: calculateTrend(filteredData),
        statistics: calculateStatistics(filteredData),
        anomalies: detectAnomalies(filteredData),
        seasonality: analyzeSeasonality(filteredData),
        forecast: generateForecast(filteredData)
      };
    }

    // Get related insights
    const insights = businessIntelligence.getInsights()
      .filter(insight => insight.metrics.includes(metricId))
      .slice(0, 5);

    return successResponse({
      metric: {
        ...metric,
        data: filteredData,
        last_updated_formatted: new Date(metric.lastUpdated).toISOString()
      },
      analysis: includeAnalysis ? analysis : undefined,
      insights: insights.map(formatInsightForResponse),
      performance: {
        vs_target: metric.target ? calculateTargetPerformance(filteredData, metric.target) : null,
        vs_threshold: calculateThresholdStatus(filteredData, metric.threshold),
        data_quality: assessDataQuality(filteredData)
      },
      recommendations: generateMetricRecommendations(metric, analysis)
    });

  } catch (error) {
    telemetry.logger.error("Get metric details error", error);
    return errorResponse("Failed to get metric details", 500);
  }
};

// Record new metric value
export const recordMetricValue: RouteHandler = async (request, url) => {
  try {
    const { metric_id, value, metadata } = await request.json();

    if (!metric_id || value === undefined) {
      return errorResponse("Metric ID and value are required", 400);
    }

    if (typeof value !== "number") {
      return errorResponse("Value must be a number", 400);
    }

    businessIntelligence.recordMetricValue(metric_id, value, metadata);

    return successResponse({
      message: "Metric value recorded successfully",
      metric_id,
      value,
      metadata,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Record metric value error", error);
    return errorResponse("Failed to record metric value", 500);
  }
};

// Register new metric
export const registerMetric: RouteHandler = async (request, url) => {
  try {
    const metricData = await request.json();

    // Validate required fields
    const requiredFields = ["name", "category", "description", "unit", "dataType"];
    for (const field of requiredFields) {
      if (!metricData[field]) {
        return errorResponse(`Missing required field: ${field}`, 400);
      }
    }

    // Validate enums
    if (!["counter", "gauge", "histogram", "rate"].includes(metricData.dataType)) {
      return errorResponse("Invalid dataType", 400);
    }

    if (!["sum", "avg", "max", "min", "count", "percentile"].includes(metricData.aggregation)) {
      return errorResponse("Invalid aggregation", 400);
    }

    // Set defaults
    const metric = {
      name: metricData.name,
      category: metricData.category,
      description: metricData.description,
      unit: metricData.unit,
      dataType: metricData.dataType,
      aggregation: metricData.aggregation,
      tags: metricData.tags || [],
      isKPI: metricData.isKPI || false,
      target: metricData.target,
      threshold: metricData.threshold || { warning: 0, critical: 0 },
      retentionDays: metricData.retentionDays || 30
    };

    const metricId = businessIntelligence.registerMetric(metric);

    return successResponse({
      message: "Metric registered successfully",
      metric_id: metricId,
      metric: { ...metric, id: metricId }
    });

  } catch (error) {
    telemetry.logger.error("Register metric error", error);
    return errorResponse("Failed to register metric", 500);
  }
};

// Get dashboards
export const getDashboards: RouteHandler = async (request, url) => {
  try {
    const category = url.searchParams.get("category") || undefined;
    const includeData = url.searchParams.get("include_data") === "true";

    let dashboards = businessIntelligence.getDashboards(category);

    // Optionally include widget data
    if (includeData) {
      dashboards = dashboards.map(dashboard => 
        businessIntelligence.refreshDashboard(dashboard.id) || dashboard
      );
    }

    const summary = {
      total_dashboards: dashboards.length,
      categories: [...new Set(dashboards.map(d => d.category))],
      public_dashboards: dashboards.filter(d => d.isPublic).length,
      most_viewed: dashboards
        .sort((a, b) => b.views - a.views)
        .slice(0, 3)
        .map(d => ({ id: d.id, name: d.name, views: d.views }))
    };

    return successResponse({
      dashboards: dashboards.map(formatDashboardForResponse),
      summary,
      filters: { category },
      available_categories: [...new Set(dashboards.map(d => d.category))]
    });

  } catch (error) {
    telemetry.logger.error("Get dashboards error", error);
    return errorResponse("Failed to get dashboards", 500);
  }
};

// Get specific dashboard with real-time data
export const getDashboard: RouteHandler = async (request, url) => {
  try {
    const dashboardId = url.searchParams.get("dashboard_id");
    if (!dashboardId) {
      return errorResponse("Dashboard ID is required", 400);
    }

    const refreshData = url.searchParams.get("refresh") !== "false";

    let dashboard = businessIntelligence.getDashboard(dashboardId);
    if (!dashboard) {
      return errorResponse("Dashboard not found", 404);
    }

    // Refresh data if requested
    if (refreshData) {
      dashboard = businessIntelligence.refreshDashboard(dashboardId) || dashboard;
    }

    // Calculate dashboard performance metrics
    const performance = {
      widget_count: dashboard.widgets.length,
      last_refresh: Math.max(...dashboard.widgets.map(w => w.lastUpdated || 0)),
      data_freshness: calculateDataFreshness(dashboard.widgets),
      load_time_estimate: dashboard.widgets.length * 100 // Simple estimate
    };

    return successResponse({
      dashboard: {
        ...dashboard,
        last_modified_formatted: new Date(dashboard.lastModified).toISOString()
      },
      performance,
      metadata: {
        total_views: dashboard.views,
        refresh_interval_minutes: dashboard.refreshInterval / (60 * 1000),
        widget_types: [...new Set(dashboard.widgets.map(w => w.type))]
      }
    });

  } catch (error) {
    telemetry.logger.error("Get dashboard error", error);
    return errorResponse("Failed to get dashboard", 500);
  }
};

// Create new dashboard
export const createDashboard: RouteHandler = async (request, url) => {
  try {
    const dashboardData = await request.json();

    // Validate required fields
    const requiredFields = ["name", "description", "category"];
    for (const field of requiredFields) {
      if (!dashboardData[field]) {
        return errorResponse(`Missing required field: ${field}`, 400);
      }
    }

    // Set defaults
    const dashboard = {
      name: dashboardData.name,
      description: dashboardData.description,
      category: dashboardData.category,
      widgets: dashboardData.widgets || [],
      layout: dashboardData.layout || {
        columns: 12,
        rows: 8,
        responsive: true,
        theme: "light"
      },
      filters: dashboardData.filters || [],
      refreshInterval: dashboardData.refreshInterval || 300000, // 5 minutes
      isPublic: dashboardData.isPublic || false,
      owner: "user" // Would get from authentication
    };

    const dashboardId = businessIntelligence.createDashboard(dashboard);

    return successResponse({
      message: "Dashboard created successfully",
      dashboard_id: dashboardId,
      dashboard: { ...dashboard, id: dashboardId }
    });

  } catch (error) {
    telemetry.logger.error("Create dashboard error", error);
    return errorResponse("Failed to create dashboard", 500);
  }
};

// Update dashboard
export const updateDashboard: RouteHandler = async (request, url) => {
  try {
    const dashboardId = url.searchParams.get("dashboard_id");
    if (!dashboardId) {
      return errorResponse("Dashboard ID is required", 400);
    }

    const updates = await request.json();
    const success = businessIntelligence.updateDashboard(dashboardId, updates);

    if (!success) {
      return errorResponse("Dashboard not found", 404);
    }

    return successResponse({
      message: "Dashboard updated successfully",
      dashboard_id: dashboardId,
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Update dashboard error", error);
    return errorResponse("Failed to update dashboard", 500);
  }
};

// Get analytics insights
export const getInsights: RouteHandler = async (request, url) => {
  try {
    const type = url.searchParams.get("type") || undefined;
    const category = url.searchParams.get("category") || undefined;
    const impact = url.searchParams.get("impact") || undefined;
    const actionable = url.searchParams.get("actionable") === "true" ? true : undefined;
    const generateNew = url.searchParams.get("generate") === "true";

    let insights;
    if (generateNew) {
      insights = businessIntelligence.generateInsights(category, "24h");
    } else {
      insights = businessIntelligence.getInsights({ type, category, impact, actionable });
    }

    // Group insights by category
    const insightsByCategory = insights.reduce((acc, insight) => {
      if (!acc[insight.category]) {
        acc[insight.category] = [];
      }
      acc[insight.category].push(insight);
      return acc;
    }, {} as Record<string, typeof insights>);

    // Calculate insight statistics
    const stats = {
      total_insights: insights.length,
      actionable_insights: insights.filter(i => i.actionable).length,
      high_impact: insights.filter(i => i.impact === "high").length,
      recent_insights: insights.filter(i => Date.now() - i.timestamp < 24 * 60 * 60 * 1000).length,
      avg_confidence: insights.length > 0 
        ? insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length 
        : 0
    };

    return successResponse({
      insights: insights.map(formatInsightForResponse),
      insights_by_category: insightsByCategory,
      statistics: stats,
      filters: { type, category, impact, actionable },
      available_filters: {
        types: ["trend", "anomaly", "correlation", "prediction", "recommendation"],
        categories: [...new Set(insights.map(i => i.category))],
        impact_levels: ["high", "medium", "low"]
      }
    });

  } catch (error) {
    telemetry.logger.error("Get insights error", error);
    return errorResponse("Failed to get insights", 500);
  }
};

// Perform advanced analytics
export const performAnalytics: RouteHandler = async (request, url) => {
  try {
    const { analysis_type, parameters } = await request.json();

    if (!analysis_type) {
      return errorResponse("Analysis type is required", 400);
    }

    let results;
    switch (analysis_type) {
      case "cohort":
        results = businessIntelligence.performCohortAnalysis(
          parameters.metric || "daily_active_users",
          parameters.timeRange || "90d"
        );
        break;

      case "funnel":
        if (!parameters.steps || !Array.isArray(parameters.steps)) {
          return errorResponse("Steps array is required for funnel analysis", 400);
        }
        results = businessIntelligence.performFunnelAnalysis(parameters.steps);
        break;

      default:
        return errorResponse("Unsupported analysis type", 400);
    }

    return successResponse({
      analysis_type,
      parameters,
      results,
      timestamp: new Date().toISOString(),
      recommendations: generateAnalyticsRecommendations(analysis_type, results)
    });

  } catch (error) {
    telemetry.logger.error("Perform analytics error", error);
    return errorResponse("Failed to perform analytics", 500);
  }
};

// Export data
export const exportData: RouteHandler = async (request, url) => {
  try {
    const metrics = url.searchParams.get("metrics")?.split(",") || [];
    const format = url.searchParams.get("format") as "json" | "csv" | "excel" || "json";
    const timeRange = url.searchParams.get("time_range") || "30d";

    if (metrics.length === 0) {
      return errorResponse("At least one metric is required", 400);
    }

    const data = businessIntelligence.exportData(metrics, format, timeRange);

    const contentTypes = {
      json: "application/json",
      csv: "text/csv",
      excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };

    const filenames = {
      json: "metrics-export.json",
      csv: "metrics-export.csv", 
      excel: "metrics-export.xlsx"
    };

    return new Response(
      typeof data === "string" ? data : JSON.stringify(data, null, 2),
      {
        headers: {
          "Content-Type": contentTypes[format],
          "Content-Disposition": `attachment; filename=${filenames[format]}`
        }
      }
    );

  } catch (error) {
    telemetry.logger.error("Export data error", error);
    return errorResponse("Failed to export data", 500);
  }
};

// Generate business report
export const generateReport: RouteHandler = async (request, url) => {
  try {
    const reportType = url.searchParams.get("type") || "executive";
    const format = url.searchParams.get("format") || "json";
    const timeRange = url.searchParams.get("time_range") || "30d";

    // For demo purposes, create a simple report template
    const reportId = "default-" + reportType;
    const report = businessIntelligence.generateReport(reportId);

    if (!report) {
      // Create a default report if none exists
      const defaultReport = {
        id: reportId,
        name: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
        type: reportType as any,
        schedule: "monthly" as any,
        format: format as any,
        sections: [
          {
            id: "summary",
            title: "Executive Summary", 
            type: "summary" as any,
            content: {},
            order: 1
          }
        ],
        recipients: [],
        lastGenerated: Date.now(),
        nextScheduled: Date.now() + 30 * 24 * 60 * 60 * 1000
      };
      
      return successResponse({
        message: "Report generated successfully",
        report: defaultReport,
        note: "This is a demo report - full reporting system would integrate with actual data"
      });
    }

    return successResponse({
      message: "Report generated successfully", 
      report,
      download_url: `/api/bi/reports/download?id=${report.id}`
    });

  } catch (error) {
    telemetry.logger.error("Generate report error", error);
    return errorResponse("Failed to generate report", 500);
  }
};

// Get BI service settings
export const getSettings: RouteHandler = async (request, url) => {
  try {
    const settings = businessIntelligence.getSettings();

    return successResponse({
      settings,
      capabilities: {
        real_time_analytics: settings.enableRealTimeAnalytics,
        predictive_analytics: settings.enablePredictiveAnalytics,
        anomaly_detection: settings.enableAnomalyDetection,
        auto_insights: settings.autoGenerateInsights
      },
      limits: {
        max_metrics: settings.maxMetrics,
        max_dashboards: settings.maxDashboards,
        data_retention_days: settings.dataRetentionDays
      }
    });

  } catch (error) {
    telemetry.logger.error("Get BI settings error", error);
    return errorResponse("Failed to get BI settings", 500);
  }
};

// Update BI service settings
export const updateSettings: RouteHandler = async (request, url) => {
  try {
    const settings = await request.json();

    // Validate numeric settings
    const numericFields = ["dataRetentionDays", "refreshInterval", "maxMetrics", "maxDashboards"];
    for (const field of numericFields) {
      if (settings[field] !== undefined && (typeof settings[field] !== "number" || settings[field] < 0)) {
        return errorResponse(`Invalid value for ${field}: must be a non-negative number`, 400);
      }
    }

    businessIntelligence.updateSettings(settings);

    return successResponse({
      message: "BI settings updated successfully",
      settings: businessIntelligence.getSettings(),
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Update BI settings error", error);
    return errorResponse("Failed to update BI settings", 500);
  }
};

// Test BI system functionality
export const testBusinessIntelligence: RouteHandler = async (request, url) => {
  try {
    const { test_type = "basic" } = await request.json();
    const testResults = [];

    switch (test_type) {
      case "basic":
        // Test metric recording
        const testMetricId = businessIntelligence.registerMetric({
          name: "Test Metric",
          category: "test",
          description: "Test metric for validation",
          unit: "count",
          dataType: "counter",
          aggregation: "sum",
          tags: ["test"],
          isKPI: false,
          retentionDays: 1
        });
        
        businessIntelligence.recordMetricValue(testMetricId, 42);
        testResults.push({
          test: "metric_registration",
          status: "success",
          result: `Registered and recorded metric: ${testMetricId}`
        });

        // Test dashboard creation
        const testDashboardId = businessIntelligence.createDashboard({
          name: "Test Dashboard",
          description: "Test dashboard",
          category: "test",
          widgets: [],
          layout: { columns: 12, rows: 8, responsive: true, theme: "light" },
          filters: [],
          refreshInterval: 60000,
          isPublic: false,
          owner: "test"
        });
        
        testResults.push({
          test: "dashboard_creation",
          status: "success",
          result: `Created dashboard: ${testDashboardId}`
        });
        break;

      case "analytics":
        // Test insight generation
        const insights = businessIntelligence.generateInsights("test", "1h");
        testResults.push({
          test: "insight_generation",
          status: "success",
          result: `Generated ${insights.length} insights`
        });

        // Test cohort analysis
        const cohortResults = businessIntelligence.performCohortAnalysis("test_metric", "30d");
        testResults.push({
          test: "cohort_analysis", 
          status: "success",
          result: `Performed cohort analysis with ${cohortResults.cohorts.length} cohorts`
        });
        break;

      default:
        return errorResponse("Invalid test type", 400);
    }

    return successResponse({
      message: "Business intelligence test completed",
      test_type,
      results: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Test BI error", error);
    return errorResponse("Failed to test business intelligence", 500);
  }
};

// Helper functions

function parseTimeRange(timeRange: string): number {
  const match = timeRange.match(/^(\d+)([hdmw])$/);
  if (!match) return 24 * 60 * 60 * 1000; // Default 24 hours

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    case 'm': return value * 30 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

function calculateBusinessHealthScore(platformMetrics: any, kpiMetrics: any[]): number {
  let score = 100;

  // User engagement factors
  if (platformMetrics.userEngagement.retentionRate < 0.6) score -= 15;
  if (platformMetrics.userEngagement.bounceRate > 0.4) score -= 10;

  // Technical factors
  if (platformMetrics.technicalMetrics.uptime < 0.99) score -= 20;
  if (platformMetrics.technicalMetrics.errorRate > 0.05) score -= 15;

  // Business factors
  if (platformMetrics.businessMetrics.churnRate > 0.1) score -= 15;
  if (platformMetrics.businessMetrics.conversionRate < 0.05) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function getHealthStatus(score: number): string {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "critical";
}

function getHealthFactors(platformMetrics: any): string[] {
  const factors = [];
  
  if (platformMetrics.userEngagement.retentionRate > 0.8) {
    factors.push("High user retention rate");
  }
  if (platformMetrics.technicalMetrics.uptime > 0.99) {
    factors.push("Excellent system uptime");
  }
  if (platformMetrics.businessMetrics.conversionRate > 0.1) {
    factors.push("Strong conversion performance");
  }
  if (platformMetrics.investorMetrics.successRate > 0.3) {
    factors.push("High investment success rate");
  }

  return factors;
}

function formatInsightForOverview(insight: any) {
  return {
    id: insight.id,
    type: insight.type,
    title: insight.title,
    impact: insight.impact,
    confidence: insight.confidence,
    actionable: insight.actionable
  };
}

function formatInsightForResponse(insight: any) {
  return {
    ...insight,
    timestamp_formatted: new Date(insight.timestamp).toISOString(),
    expires_at_formatted: new Date(insight.expiresAt).toISOString()
  };
}

function formatMetricForResponse(metric: any) {
  return {
    id: metric.id,
    name: metric.name,
    category: metric.category,
    unit: metric.unit,
    isKPI: metric.isKPI,
    current_value: metric.data.length > 0 ? metric.data[metric.data.length - 1].value : null,
    data_points: metric.data.length,
    last_updated: new Date(metric.lastUpdated).toISOString(),
    summary: metric.summary
  };
}

function formatDashboardForResponse(dashboard: any) {
  return {
    id: dashboard.id,
    name: dashboard.name,
    description: dashboard.description,
    category: dashboard.category,
    widget_count: dashboard.widgets.length,
    views: dashboard.views,
    is_public: dashboard.isPublic,
    last_modified: new Date(dashboard.lastModified).toISOString(),
    owner: dashboard.owner
  };
}

function calculateMetricSummary(metric: any, cutoff: number) {
  const data = metric.data.filter((dp: any) => dp.timestamp > cutoff);
  if (data.length === 0) return null;

  const values = data.map((dp: any) => dp.value);
  const latest = values[values.length - 1];
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return { latest, avg, min, max, count: data.length };
}

function calculateTrend(data: any[]) {
  if (data.length < 2) return null;
  
  const values = data.map(dp => dp.value);
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
  
  const direction = secondAvg > firstAvg ? "increasing" : "decreasing";
  const magnitude = Math.abs((secondAvg - firstAvg) / firstAvg) * 100;
  
  return { direction, magnitude: magnitude.toFixed(2) };
}

function calculateStatistics(data: any[]) {
  const values = data.map(dp => dp.value);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  
  return {
    count: values.length,
    sum: values.reduce((sum, v) => sum + v, 0),
    avg: avg.toFixed(2),
    min: Math.min(...values),
    max: Math.max(...values),
    stdDev: Math.sqrt(variance).toFixed(2)
  };
}

function detectAnomalies(data: any[]) {
  // Simple anomaly detection
  const values = data.map(dp => dp.value);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length);
  
  return data.filter(dp => Math.abs(dp.value - avg) > 2 * stdDev)
    .map(dp => ({
      timestamp: dp.timestamp,
      value: dp.value,
      deviation: Math.abs(dp.value - avg)
    }));
}

function analyzeSeasonality(data: any[]) {
  // Simplified seasonality analysis
  return {
    detected: false,
    pattern: "none",
    confidence: 0,
    note: "Seasonality analysis requires more sophisticated algorithms"
  };
}

function generateForecast(data: any[]) {
  // Simple linear forecast
  if (data.length < 3) return null;
  
  const values = data.map(dp => dp.value);
  const trend = calculateTrend(data);
  const lastValue = values[values.length - 1];
  
  return {
    next_24h: trend?.direction === "increasing" ? lastValue * 1.05 : lastValue * 0.95,
    confidence: 60,
    method: "linear_trend",
    note: "Simplified forecast - production would use advanced forecasting models"
  };
}

function calculateTargetPerformance(data: any[], target: number) {
  if (data.length === 0) return null;
  
  const latest = data[data.length - 1].value;
  const performance = (latest / target) * 100;
  
  return {
    current: latest,
    target,
    performance: performance.toFixed(2) + "%",
    status: performance >= 100 ? "on_target" : performance >= 90 ? "close" : "below_target"
  };
}

function calculateThresholdStatus(data: any[], threshold: any) {
  if (!threshold || data.length === 0) return null;
  
  const latest = data[data.length - 1].value;
  
  let status = "normal";
  if (latest <= threshold.critical) {
    status = "critical";
  } else if (latest <= threshold.warning) {
    status = "warning";
  }
  
  return {
    current: latest,
    warning_threshold: threshold.warning,
    critical_threshold: threshold.critical,
    status
  };
}

function assessDataQuality(data: any[]) {
  const totalPoints = data.length;
  const timeSpan = data.length > 1 ? data[data.length - 1].timestamp - data[0].timestamp : 0;
  const expectedPoints = timeSpan > 0 ? Math.floor(timeSpan / (60 * 60 * 1000)) : 1; // Hourly expected
  
  const completeness = totalPoints > 0 ? Math.min(100, (totalPoints / expectedPoints) * 100) : 0;
  
  return {
    completeness: completeness.toFixed(2) + "%",
    total_points: totalPoints,
    time_span_hours: Math.floor(timeSpan / (60 * 60 * 1000)),
    quality_score: completeness > 90 ? "excellent" : completeness > 70 ? "good" : "poor"
  };
}

function calculateDataFreshness(widgets: any[]) {
  const now = Date.now();
  const freshnessScores = widgets
    .filter(w => w.lastUpdated)
    .map(w => {
      const age = now - w.lastUpdated!;
      const ageMinutes = age / (60 * 1000);
      return Math.max(0, 100 - ageMinutes); // 100% fresh at 0 minutes, 0% at 100+ minutes
    });
  
  return freshnessScores.length > 0 
    ? freshnessScores.reduce((sum, score) => sum + score, 0) / freshnessScores.length
    : 0;
}

function generateBusinessRecommendations(platformMetrics: any, insights: any[]): string[] {
  const recommendations = [];
  
  if (platformMetrics.userEngagement.retentionRate < 0.7) {
    recommendations.push("Focus on improving user onboarding and engagement features");
  }
  
  if (platformMetrics.businessMetrics.conversionRate < 0.1) {
    recommendations.push("Optimize conversion funnel and reduce friction points");
  }
  
  if (platformMetrics.technicalMetrics.errorRate > 0.03) {
    recommendations.push("Address technical issues affecting user experience");
  }
  
  const highImpactInsights = insights.filter(i => i.impact === "high" && i.actionable);
  if (highImpactInsights.length > 0) {
    recommendations.push(`Act on ${highImpactInsights.length} high-impact actionable insights`);
  }
  
  return recommendations;
}

function generateMetricRecommendations(metric: any, analysis: any): string[] {
  const recommendations = [];
  
  if (analysis.trend?.direction === "decreasing" && metric.isKPI) {
    recommendations.push(`Investigate causes of declining ${metric.name}`);
  }
  
  if (analysis.anomalies?.length > 0) {
    recommendations.push("Review anomalous data points for quality issues");
  }
  
  if (metric.data.length < 10) {
    recommendations.push("Collect more data points for better analysis accuracy");
  }
  
  if (metric.threshold && analysis.statistics) {
    const latest = parseFloat(analysis.statistics.avg);
    if (latest < metric.threshold.warning) {
      recommendations.push(`${metric.name} is below warning threshold - take corrective action`);
    }
  }
  
  return recommendations;
}

function generateAnalyticsRecommendations(type: string, results: any): string[] {
  const recommendations = [];
  
  if (type === "cohort" && results.insights) {
    recommendations.push("Focus retention efforts on early user lifecycle stages");
    recommendations.push("Analyze successful cohorts to replicate their characteristics");
  }
  
  if (type === "funnel" && results.recommendations) {
    return results.recommendations;
  }
  
  return recommendations;
}