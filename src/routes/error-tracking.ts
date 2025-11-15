/**
 * Advanced Error Tracking and Alerting Routes
 * Provides endpoints for managing and monitoring comprehensive error tracking
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";
import { ErrorTrackingService } from "../services/error-tracking.service.ts";
import { telemetry } from "../utils/telemetry.ts";

const errorTracking = ErrorTrackingService.getInstance();

// Get error tracking metrics and statistics
export const getErrorMetrics: RouteHandler = async (request, url) => {
  try {
    const timeWindow = parseInt(url.searchParams.get("time_window") || "86400000"); // 24 hours default
    const includePatterns = url.searchParams.get("include_patterns") === "true";
    
    const metrics = errorTracking.getMetrics(timeWindow);
    
    let additionalData = {};
    if (includePatterns) {
      const patterns = errorTracking.getErrorPatterns();
      additionalData = {
        patterns: patterns.slice(0, 10).map(p => ({
          fingerprint: p.fingerprint,
          prediction: p.pattern.prediction,
          confidence: p.pattern.confidence,
          count: p.pattern.count,
          error_message: p.error.message,
          error_level: p.error.level
        }))
      };
    }

    // Calculate health score
    const healthScore = calculateErrorHealthScore(metrics);
    
    return successResponse({
      timestamp: new Date().toISOString(),
      time_window_hours: timeWindow / (60 * 60 * 1000),
      health_score: healthScore,
      health_status: getHealthStatus(healthScore),
      metrics,
      ...additionalData,
      recommendations: generateErrorRecommendations(metrics, healthScore)
    });

  } catch (error) {
    telemetry.logger.error("Error metrics error", error);
    return errorResponse("Failed to get error metrics", 500);
  }
};

// Get filtered list of errors
export const getErrors: RouteHandler = async (request, url) => {
  try {
    const level = url.searchParams.get("level") || undefined;
    const resolved = url.searchParams.get("resolved") === "true" ? true : 
                    url.searchParams.get("resolved") === "false" ? false : undefined;
    const route = url.searchParams.get("route") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const search = url.searchParams.get("search") || undefined;

    let errors = errorTracking.getErrors({
      level,
      resolved,
      route,
      limit: limit + offset, // Get more to allow for search filtering
      offset: 0
    });

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      errors = errors.filter(error => 
        error.message.toLowerCase().includes(searchLower) ||
        error.context.route?.toLowerCase().includes(searchLower) ||
        error.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply pagination after search
    const paginatedErrors = errors.slice(offset, offset + limit);

    // Format errors for response
    const formattedErrors = paginatedErrors.map(error => ({
      id: error.id,
      fingerprint: error.fingerprint,
      level: error.level,
      message: error.message,
      count: error.count,
      resolved: error.resolved,
      first_seen: new Date(error.firstSeen).toISOString(),
      last_seen: new Date(error.lastSeen).toISOString(),
      context: {
        route: error.context.route,
        method: error.context.method,
        environment: error.context.environment,
        user_agent: error.context.userAgent?.substring(0, 50) + "..." || undefined
      },
      tags: error.tags,
      has_stack: !!error.stack
    }));

    return successResponse({
      errors: formattedErrors,
      pagination: {
        total: errors.length,
        limit,
        offset,
        has_more: offset + limit < errors.length
      },
      filters: {
        level,
        resolved,
        route,
        search
      },
      summary: {
        total_showing: formattedErrors.length,
        unresolved_in_results: formattedErrors.filter(e => !e.resolved).length,
        critical_in_results: formattedErrors.filter(e => e.level === "critical").length
      }
    });

  } catch (error) {
    telemetry.logger.error("Get errors error", error);
    return errorResponse("Failed to get errors", 500);
  }
};

// Get detailed information about a specific error
export const getErrorDetails: RouteHandler = async (request, url) => {
  try {
    const errorId = url.searchParams.get("error_id");
    const fingerprint = url.searchParams.get("fingerprint");
    
    if (!errorId && !fingerprint) {
      return errorResponse("Error ID or fingerprint is required", 400);
    }

    let error;
    if (errorId) {
      error = errorTracking.getErrorById(errorId);
    } else {
      error = errorTracking.getErrorByFingerprint(fingerprint!);
    }

    if (!error) {
      return errorResponse("Error not found", 404);
    }

    // Get related errors (same fingerprint, different occurrences)
    const relatedErrors = errorTracking.getErrors({})
      .filter(e => e.fingerprint === error.fingerprint && e.id !== error.id)
      .slice(0, 5);

    // Check if there are patterns for this error
    const patterns = errorTracking.getErrorPatterns()
      .filter(p => p.fingerprint === error.fingerprint);

    return successResponse({
      error: {
        ...error,
        first_seen_formatted: new Date(error.firstSeen).toISOString(),
        last_seen_formatted: new Date(error.lastSeen).toISOString()
      },
      related_errors: relatedErrors.map(e => ({
        id: e.id,
        timestamp: new Date(e.timestamp).toISOString(),
        count: e.count,
        context: e.context
      })),
      patterns: patterns.map(p => ({
        prediction: p.pattern.prediction,
        confidence: p.pattern.confidence,
        trend_analysis: generateTrendAnalysis(p.pattern)
      })),
      suggestions: generateErrorSuggestions(error)
    });

  } catch (error) {
    telemetry.logger.error("Get error details error", error);
    return errorResponse("Failed to get error details", 500);
  }
};

// Resolve an error manually
export const resolveError: RouteHandler = async (request, url) => {
  try {
    const { fingerprint, resolution_note } = await request.json();
    
    if (!fingerprint) {
      return errorResponse("Fingerprint is required", 400);
    }

    const userId = "admin"; // In real app, get from auth token
    const resolved = errorTracking.resolveError(fingerprint, userId);

    if (!resolved) {
      return errorResponse("Error not found or already resolved", 404);
    }

    // Track the resolution
    errorTracking.trackError(
      { message: "Error resolved", resolution_note },
      { route: "/api/errors/resolve", method: "POST", userId }
    );

    return successResponse({
      message: "Error resolved successfully",
      fingerprint,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
      resolution_note
    });

  } catch (error) {
    telemetry.logger.error("Resolve error error", error);
    return errorResponse("Failed to resolve error", 500);
  }
};

// Manually track a new error for testing
export const trackError: RouteHandler = async (request, url) => {
  try {
    const { 
      message, 
      level = "error",
      context = {},
      simulate_stack = false 
    } = await request.json();
    
    if (!message) {
      return errorResponse("Error message is required", 400);
    }

    // Create a test error
    let testError;
    if (simulate_stack) {
      testError = new Error(message);
    } else {
      testError = { message, level };
    }

    const errorId = errorTracking.trackError(testError, {
      route: "/api/errors/track",
      method: "POST",
      ...context,
      manual: true
    });

    return successResponse({
      message: "Error tracked successfully",
      error_id: errorId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Track error error", error);
    return errorResponse("Failed to track error", 500);
  }
};

// Get alert rules
export const getAlertRules: RouteHandler = async (request, url) => {
  try {
    const rules = errorTracking.getAlertRules();
    
    return successResponse({
      rules: rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        condition: rule.condition,
        channels: rule.channels,
        filters: rule.filters,
        cooldown_minutes: rule.cooldown / (60 * 1000),
        last_triggered: rule.lastTriggered ? new Date(rule.lastTriggered).toISOString() : null
      })),
      summary: {
        total_rules: rules.length,
        enabled_rules: rules.filter(r => r.enabled).length,
        recently_triggered: rules.filter(r => 
          r.lastTriggered && Date.now() - r.lastTriggered < 24 * 60 * 60 * 1000
        ).length
      }
    });

  } catch (error) {
    telemetry.logger.error("Get alert rules error", error);
    return errorResponse("Failed to get alert rules", 500);
  }
};

// Add new alert rule
export const addAlertRule: RouteHandler = async (request, url) => {
  try {
    const ruleData = await request.json();
    
    // Validate required fields
    if (!ruleData.name || !ruleData.condition) {
      return errorResponse("Name and condition are required", 400);
    }

    // Set defaults
    const rule = {
      name: ruleData.name,
      condition: ruleData.condition,
      channels: ruleData.channels || [],
      enabled: ruleData.enabled !== false,
      cooldown: (ruleData.cooldown_minutes || 15) * 60 * 1000,
      filters: ruleData.filters || {}
    };

    const ruleId = errorTracking.addAlertRule(rule);

    return successResponse({
      message: "Alert rule added successfully",
      rule_id: ruleId,
      rule: { ...rule, id: ruleId }
    });

  } catch (error) {
    telemetry.logger.error("Add alert rule error", error);
    return errorResponse("Failed to add alert rule", 500);
  }
};

// Remove alert rule
export const removeAlertRule: RouteHandler = async (request, url) => {
  try {
    const ruleId = url.searchParams.get("rule_id");
    
    if (!ruleId) {
      return errorResponse("Rule ID is required", 400);
    }

    const removed = errorTracking.removeAlertRule(ruleId);

    if (!removed) {
      return errorResponse("Alert rule not found", 404);
    }

    return successResponse({
      message: "Alert rule removed successfully",
      rule_id: ruleId,
      removed_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Remove alert rule error", error);
    return errorResponse("Failed to remove alert rule", 500);
  }
};

// Get alert channels
export const getAlertChannels: RouteHandler = async (request, url) => {
  try {
    const channels = errorTracking.getAlertChannels();
    
    return successResponse({
      channels: channels.map(channel => ({
        id: channel.id,
        type: channel.type,
        name: channel.name,
        enabled: channel.enabled,
        config: sanitizeChannelConfig(channel.config)
      })),
      supported_types: ["email", "webhook", "slack", "discord", "sms"],
      summary: {
        total_channels: channels.length,
        enabled_channels: channels.filter(c => c.enabled).length,
        by_type: channels.reduce((acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });

  } catch (error) {
    telemetry.logger.error("Get alert channels error", error);
    return errorResponse("Failed to get alert channels", 500);
  }
};

// Add new alert channel
export const addAlertChannel: RouteHandler = async (request, url) => {
  try {
    const channelData = await request.json();
    
    // Validate required fields
    if (!channelData.type || !channelData.name) {
      return errorResponse("Type and name are required", 400);
    }

    if (!["email", "webhook", "slack", "discord", "sms"].includes(channelData.type)) {
      return errorResponse("Invalid channel type", 400);
    }

    const channel = {
      type: channelData.type,
      name: channelData.name,
      config: channelData.config || {},
      enabled: channelData.enabled !== false
    };

    const channelId = errorTracking.addAlertChannel(channel);

    return successResponse({
      message: "Alert channel added successfully",
      channel_id: channelId,
      channel: { ...channel, id: channelId, config: sanitizeChannelConfig(channel.config) }
    });

  } catch (error) {
    telemetry.logger.error("Add alert channel error", error);
    return errorResponse("Failed to add alert channel", 500);
  }
};

// Remove alert channel
export const removeAlertChannel: RouteHandler = async (request, url) => {
  try {
    const channelId = url.searchParams.get("channel_id");
    
    if (!channelId) {
      return errorResponse("Channel ID is required", 400);
    }

    const removed = errorTracking.removeAlertChannel(channelId);

    if (!removed) {
      return errorResponse("Alert channel not found", 404);
    }

    return successResponse({
      message: "Alert channel removed successfully",
      channel_id: channelId,
      removed_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Remove alert channel error", error);
    return errorResponse("Failed to remove alert channel", 500);
  }
};

// Update error tracking settings
export const updateSettings: RouteHandler = async (request, url) => {
  try {
    const settings = await request.json();
    
    // Validate numeric settings
    const numericFields = ["maxErrors", "retentionDays", "autoResolutionHours", "alertCooldownMinutes"];
    for (const field of numericFields) {
      if (settings[field] !== undefined && (typeof settings[field] !== "number" || settings[field] < 0)) {
        return errorResponse(`Invalid value for ${field}: must be a non-negative number`, 400);
      }
    }

    errorTracking.updateSettings(settings);
    
    return successResponse({
      message: "Error tracking settings updated successfully",
      settings: errorTracking.getSettings(),
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("Update settings error", error);
    return errorResponse("Failed to update settings", 500);
  }
};

// Get current error tracking configuration
export const getConfiguration: RouteHandler = async (request, url) => {
  try {
    const settings = errorTracking.getSettings();
    const rules = errorTracking.getAlertRules();
    const channels = errorTracking.getAlertChannels();
    const metrics = errorTracking.getMetrics(24 * 60 * 60 * 1000); // Last 24 hours

    return successResponse({
      settings,
      statistics: {
        total_alert_rules: rules.length,
        active_alert_rules: rules.filter(r => r.enabled).length,
        total_alert_channels: channels.length,
        active_alert_channels: channels.filter(c => c.enabled).length,
        errors_last_24h: metrics.totalErrors,
        unresolved_errors: metrics.unresolvedErrors
      },
      capabilities: {
        auto_resolution: settings.enableAutoResolution,
        trend_analysis: settings.enableTrendAnalysis,
        machine_learning: settings.enableMachineLearning,
        external_integrations: true
      },
      integration_status: {
        sentry: !!Deno.env.get("SENTRY_DSN"),
        external_logging: true,
        telemetry: true
      }
    });

  } catch (error) {
    telemetry.logger.error("Get configuration error", error);
    return errorResponse("Failed to get configuration", 500);
  }
};

// Test error tracking system
export const testErrorTracking: RouteHandler = async (request, url) => {
  try {
    const { test_type = "basic", severity = "error" } = await request.json();
    
    const testResults = [];
    
    switch (test_type) {
      case "basic":
        // Test basic error tracking
        const basicErrorId = errorTracking.trackError(
          new Error("Test error from API endpoint"),
          { route: "/api/errors/test", method: "POST", test: true }
        );
        testResults.push({ type: "basic_tracking", error_id: basicErrorId, status: "success" });
        break;

      case "volume":
        // Test volume handling
        for (let i = 0; i < 10; i++) {
          const errorId = errorTracking.trackError(
            new Error(`Volume test error ${i}`),
            { route: "/api/test", method: "GET", iteration: i }
          );
          testResults.push({ type: "volume_test", iteration: i, error_id: errorId });
        }
        break;

      case "patterns":
        // Test pattern detection
        for (let i = 0; i < 5; i++) {
          errorTracking.trackError(
            new Error("Repeating pattern error"),
            { route: "/api/pattern", method: "GET", iteration: i }
          );
        }
        testResults.push({ type: "pattern_detection", iterations: 5, status: "completed" });
        break;

      case "alerts":
        // Test alert triggers
        errorTracking.trackError(
          new Error("Critical system failure"),
          { route: "/api/critical", method: "POST", level: "critical" }
        );
        testResults.push({ type: "alert_trigger", status: "triggered" });
        break;

      default:
        return errorResponse("Invalid test type", 400);
    }

    return successResponse({
      message: "Error tracking test completed",
      test_type,
      results: testResults,
      timestamp: new Date().toISOString(),
      next_steps: [
        "Check error metrics to see tracked errors",
        "Review alert rules to ensure proper triggering",
        "Monitor error patterns for trend analysis"
      ]
    });

  } catch (error) {
    telemetry.logger.error("Test error tracking error", error);
    return errorResponse("Failed to test error tracking", 500);
  }
};

// Helper functions

function calculateErrorHealthScore(metrics: any): number {
  let score = 100;

  // Critical errors impact
  if (metrics.criticalErrors > 0) {
    score -= Math.min(30, metrics.criticalErrors * 5);
  }

  // Error rate impact
  if (metrics.errorRate > 10) { // More than 10 errors per minute
    score -= 20;
  } else if (metrics.errorRate > 5) {
    score -= 10;
  }

  // Unresolved errors impact
  if (metrics.unresolvedErrors > 50) {
    score -= 15;
  } else if (metrics.unresolvedErrors > 20) {
    score -= 8;
  }

  // MTTR impact
  const mttrHours = metrics.mttr / (60 * 60 * 1000);
  if (mttrHours > 24) {
    score -= 10;
  } else if (mttrHours > 8) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

function getHealthStatus(score: number): string {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "critical";
}

function generateErrorRecommendations(metrics: any, healthScore: number): string[] {
  const recommendations = [];

  if (healthScore < 70) {
    recommendations.push("Error health is degraded - immediate attention required");
  }

  if (metrics.criticalErrors > 0) {
    recommendations.push("Critical errors detected - investigate and resolve immediately");
  }

  if (metrics.errorRate > 5) {
    recommendations.push("High error rate detected - review recent changes and system health");
  }

  if (metrics.unresolvedErrors > 20) {
    recommendations.push("Many unresolved errors - consider batch resolution or auto-resolution");
  }

  const mttrHours = metrics.mttr / (60 * 60 * 1000);
  if (mttrHours > 8) {
    recommendations.push("Mean time to resolution is high - improve error handling processes");
  }

  if (recommendations.length === 0) {
    recommendations.push("Error tracking is healthy - continue monitoring");
  }

  return recommendations;
}

function generateTrendAnalysis(pattern: any): string {
  const { prediction, confidence, count } = pattern;
  
  if (prediction === "increasing" && confidence > 70) {
    return `Error frequency is increasing with ${confidence}% confidence (${count} occurrences)`;
  } else if (prediction === "decreasing" && confidence > 70) {
    return `Error frequency is decreasing with ${confidence}% confidence (${count} occurrences)`;
  } else {
    return `Error pattern is stable with ${confidence}% confidence (${count} occurrences)`;
  }
}

function generateErrorSuggestions(error: any): string[] {
  const suggestions = [];
  
  if (error.count > 10) {
    suggestions.push("High occurrence count - consider implementing a permanent fix");
  }
  
  if (error.level === "critical") {
    suggestions.push("Critical error - escalate to senior developers immediately");
  }
  
  if (error.context.route) {
    suggestions.push(`Review implementation of route: ${error.context.route}`);
  }
  
  if (error.stack && error.stack.includes("TypeError")) {
    suggestions.push("Type error detected - review variable types and null checks");
  }
  
  if (error.stack && error.stack.includes("fetch")) {
    suggestions.push("Network error detected - review API calls and error handling");
  }

  return suggestions;
}

function sanitizeChannelConfig(config: Record<string, any>): Record<string, any> {
  const sanitized = { ...config };
  
  // Remove sensitive information
  if (sanitized.password) sanitized.password = "[REDACTED]";
  if (sanitized.token) sanitized.token = "[REDACTED]";
  if (sanitized.apiKey) sanitized.apiKey = "[REDACTED]";
  if (sanitized.secret) sanitized.secret = "[REDACTED]";
  
  return sanitized;
}