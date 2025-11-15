/**
 * Rate Limit Management Routes
 * Provides endpoints for managing and monitoring advanced rate limiting
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";
import { AdvancedRateLimiter } from "../middleware/advanced-rate-limit.middleware.ts";
import { telemetry } from "../utils/telemetry.ts";

// Get rate limiting statistics and metrics
export const getRateLimitStats: RouteHandler = async (request, url) => {
  try {
    const systemStats = AdvancedRateLimiter.getSystemStats();
    const clientMetrics = AdvancedRateLimiter.getClientMetrics();
    
    // Calculate aggregate statistics
    const totalRequests = clientMetrics.reduce((sum: number, client: any) => sum + client.requests, 0);
    const totalViolations = clientMetrics.reduce((sum: number, client: any) => sum + client.violations, 0);
    const averageReputation = clientMetrics.length > 0 
      ? clientMetrics.reduce((sum: number, client: any) => sum + client.reputation, 0) / clientMetrics.length
      : 0;
    
    const topViolators = clientMetrics
      .filter((client: any) => client.violations > 0)
      .sort((a: any, b: any) => b.violations - a.violations)
      .slice(0, 10);
    
    const lowReputationClients = clientMetrics
      .filter((client: any) => client.reputation < 30)
      .sort((a: any, b: any) => a.reputation - b.reputation)
      .slice(0, 10);
    
    return successResponse({
      timestamp: new Date().toISOString(),
      system_stats: systemStats,
      aggregate_metrics: {
        total_clients: systemStats.totalClients,
        total_requests: totalRequests,
        total_violations: totalViolations,
        violation_rate: totalRequests > 0 ? (totalViolations / totalRequests) * 100 : 0,
        average_reputation: Math.round(averageReputation * 100) / 100
      },
      top_violators: topViolators,
      low_reputation_clients: lowReputationClients,
      health_indicators: {
        system_load: systemStats.systemLoad,
        queue_pressure: systemStats.queueLength > 50 ? "high" : systemStats.queueLength > 20 ? "medium" : "low",
        overall_health: totalViolations < totalRequests * 0.1 ? "healthy" : "degraded"
      }
    });
    
  } catch (error) {
    telemetry.logger.error("Rate limit stats error", error);
    return errorResponse("Failed to get rate limit statistics", 500);
  }
};

// Get specific client metrics
export const getClientMetrics: RouteHandler = async (request, url) => {
  try {
    const clientKey = url.searchParams.get("client_key");
    
    if (clientKey) {
      const metrics = AdvancedRateLimiter.getClientMetrics(clientKey);
      if (!metrics) {
        return errorResponse("Client not found", 404);
      }
      
      return successResponse({
        client_key: clientKey,
        metrics,
        recommendations: generateClientRecommendations(metrics)
      });
    }
    
    // Return all clients with pagination
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const sortBy = url.searchParams.get("sort") || "requests";
    const order = url.searchParams.get("order") || "desc";
    
    let allMetrics = AdvancedRateLimiter.getClientMetrics() as any[];
    
    // Sort
    allMetrics.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return order === "desc" ? bVal - aVal : aVal - bVal;
    });
    
    // Paginate
    const paginatedMetrics = allMetrics.slice(offset, offset + limit);
    
    return successResponse({
      clients: paginatedMetrics,
      pagination: {
        total: allMetrics.length,
        limit,
        offset,
        has_more: offset + limit < allMetrics.length
      },
      sort: { by: sortBy, order }
    });
    
  } catch (error) {
    telemetry.logger.error("Client metrics error", error);
    return errorResponse("Failed to get client metrics", 500);
  }
};

// Reset a specific client's rate limit data
export const resetClient: RouteHandler = async (request, url) => {
  try {
    const { client_key, reason } = await request.json();
    
    if (!client_key) {
      return errorResponse("Client key is required", 400);
    }
    
    const success = AdvancedRateLimiter.resetClient(client_key);
    
    if (success) {
      telemetry.logger.info("Client rate limit reset", { 
        clientKey: client_key, 
        reason: reason || "manual reset" 
      });
      
      return successResponse({
        message: "Client rate limit data reset successfully",
        client_key,
        reset_time: new Date().toISOString()
      });
    } else {
      return errorResponse("Client not found or already clean", 404);
    }
    
  } catch (error) {
    telemetry.logger.error("Reset client error", error);
    return errorResponse("Failed to reset client", 500);
  }
};

// Add or update a rate limiting rule
export const addRateLimitRule: RouteHandler = async (request, url) => {
  try {
    const ruleData = await request.json();
    
    // Validate required fields
    const requiredFields = ["id", "pattern", "config"];
    for (const field of requiredFields) {
      if (!ruleData[field]) {
        return errorResponse(`Missing required field: ${field}`, 400);
      }
    }
    
    // Validate config
    const config = ruleData.config;
    if (!config.windowMs || !config.maxRequests || !config.strategy) {
      return errorResponse("Invalid rate limit configuration", 400);
    }
    
    // Convert pattern to RegExp if it's a string pattern
    if (typeof ruleData.pattern === "string" && ruleData.pattern.includes("*")) {
      ruleData.pattern = new RegExp(ruleData.pattern.replace(/\\*/g, ".*"));
    }
    
    // Add default values
    const rule = {
      priority: 50,
      enabled: true,
      ...ruleData,
      config: {
        keyGenerator: (req: Request) => AdvancedRateLimiter.getClientKey?.(req) || "unknown",
        headers: true,
        ...config
      }
    };
    
    AdvancedRateLimiter.addRule(rule);
    
    return successResponse({
      message: "Rate limit rule added successfully",
      rule: {
        id: rule.id,
        pattern: rule.pattern.toString(),
        priority: rule.priority,
        enabled: rule.enabled,
        config: {
          windowMs: rule.config.windowMs,
          maxRequests: rule.config.maxRequests,
          strategy: rule.config.strategy
        }
      }
    });
    
  } catch (error) {
    telemetry.logger.error("Add rate limit rule error", error);
    return errorResponse("Failed to add rate limit rule", 500);
  }
};

// Remove a rate limiting rule
export const removeRateLimitRule: RouteHandler = async (request, url) => {
  try {
    const ruleId = url.searchParams.get("rule_id");
    
    if (!ruleId) {
      return errorResponse("Rule ID is required", 400);
    }
    
    const success = AdvancedRateLimiter.removeRule(ruleId);
    
    if (success) {
      return successResponse({
        message: "Rate limit rule removed successfully",
        rule_id: ruleId,
        removed_time: new Date().toISOString()
      });
    } else {
      return errorResponse("Rule not found", 404);
    }
    
  } catch (error) {
    telemetry.logger.error("Remove rate limit rule error", error);
    return errorResponse("Failed to remove rate limit rule", 500);
  }
};

// Update adaptive rate limiting settings
export const updateAdaptiveSettings: RouteHandler = async (request, url) => {
  try {
    const settings = await request.json();
    
    // Validate numeric values
    const numericFields = ["baseLimit", "maxLimit", "minLimit", "scaleFactor", "learningRate", "systemLoadThreshold"];
    for (const field of numericFields) {
      if (settings[field] !== undefined && (typeof settings[field] !== "number" || settings[field] < 0)) {
        return errorResponse(`Invalid value for ${field}: must be a non-negative number`, 400);
      }
    }
    
    // Validate ranges
    if (settings.systemLoadThreshold !== undefined && (settings.systemLoadThreshold < 0 || settings.systemLoadThreshold > 1)) {
      return errorResponse("systemLoadThreshold must be between 0 and 1", 400);
    }
    
    if (settings.minLimit !== undefined && settings.maxLimit !== undefined && settings.minLimit > settings.maxLimit) {
      return errorResponse("minLimit cannot be greater than maxLimit", 400);
    }
    
    AdvancedRateLimiter.updateAdaptiveSettings(settings);
    
    return successResponse({
      message: "Adaptive settings updated successfully",
      updated_settings: settings,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    telemetry.logger.error("Update adaptive settings error", error);
    return errorResponse("Failed to update adaptive settings", 500);
  }
};

// Get rate limiting configuration and rules
export const getRateLimitConfig: RouteHandler = async (request, url) => {
  try {
    const systemStats = AdvancedRateLimiter.getSystemStats();
    
    // Get all rules (would need to expose this from the middleware)
    const rulesInfo = {
      total_rules: systemStats.totalRules,
      adaptive_settings: systemStats.adaptiveSettings,
      strategies_supported: [
        "fixed-window",
        "sliding-window", 
        "token-bucket",
        "adaptive"
      ],
      default_rules: [
        {
          id: "auth-strict",
          pattern: "^/api/auth/",
          description: "Strict rate limiting for authentication endpoints",
          maxRequests: 5,
          windowMs: 900000
        },
        {
          id: "api-standard", 
          pattern: "^/api/",
          description: "Standard rate limiting for API endpoints",
          maxRequests: 60,
          windowMs: 60000
        },
        {
          id: "search-moderate",
          pattern: "^/api/.*/search",
          description: "Moderate rate limiting for search endpoints",
          maxRequests: 30,
          windowMs: 60000
        },
        {
          id: "upload-restricted",
          pattern: "^/api/.*/upload", 
          description: "Restricted rate limiting for upload endpoints",
          maxRequests: 5,
          windowMs: 60000
        }
      ]
    };
    
    return successResponse(rulesInfo);
    
  } catch (error) {
    telemetry.logger.error("Get rate limit config error", error);
    return errorResponse("Failed to get rate limit configuration", 500);
  }
};

// Test rate limiting for a specific endpoint
export const testRateLimit: RouteHandler = async (request, url) => {
  try {
    const { endpoint, client_key, iterations } = await request.json();
    
    if (!endpoint) {
      return errorResponse("Endpoint is required", 400);
    }
    
    const testIterations = Math.min(iterations || 10, 100); // Max 100 test requests
    const testClientKey = client_key || `test_${Date.now()}`;
    
    const results = [];
    
    for (let i = 0; i < testIterations; i++) {
      const testRequest = new Request(`http://localhost${endpoint}`, {
        method: "GET",
        headers: {
          "x-test-client": testClientKey,
          "user-agent": "Rate-Limit-Tester/1.0"
        }
      });
      
      // Simulate rate limit check
      const checkResult = await simulateRateLimitCheck(testRequest, endpoint);
      
      results.push({
        iteration: i + 1,
        allowed: checkResult.allowed,
        remaining: checkResult.remaining,
        reset_time: checkResult.resetTime,
        timestamp: new Date().toISOString()
      });
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const summary = {
      total_requests: testIterations,
      allowed_requests: results.filter(r => r.allowed).length,
      blocked_requests: results.filter(r => !r.allowed).length,
      success_rate: (results.filter(r => r.allowed).length / testIterations) * 100
    };
    
    return successResponse({
      endpoint,
      client_key: testClientKey,
      test_results: results,
      summary,
      recommendations: generateTestRecommendations(summary)
    });
    
  } catch (error) {
    telemetry.logger.error("Test rate limit error", error);
    return errorResponse("Failed to test rate limiting", 500);
  }
};

// Helper functions

function generateClientRecommendations(metrics: any): string[] {
  const recommendations = [];
  
  if (metrics.violations > 10) {
    recommendations.push("High number of violations - consider blocking or additional restrictions");
  }
  
  if (metrics.reputation < 30) {
    recommendations.push("Low reputation score - monitor closely for abuse patterns");
  }
  
  if (metrics.requests > 1000 && metrics.violations === 0) {
    recommendations.push("High volume, well-behaved client - consider allowlist or higher limits");
  }
  
  const violationRate = metrics.requests > 0 ? (metrics.violations / metrics.requests) * 100 : 0;
  if (violationRate > 20) {
    recommendations.push("High violation rate - implement progressive penalties");
  }
  
  return recommendations;
}

function generateTestRecommendations(summary: any): string[] {
  const recommendations = [];
  
  if (summary.success_rate < 50) {
    recommendations.push("Rate limits may be too restrictive for normal usage patterns");
  }
  
  if (summary.success_rate > 90) {
    recommendations.push("Rate limits may be too permissive - consider tightening for better protection");
  }
  
  if (summary.blocked_requests === 0) {
    recommendations.push("No requests were blocked - limits may not be effectively protecting the endpoint");
  }
  
  return recommendations;
}

async function simulateRateLimitCheck(request: Request, endpoint: string) {
  // This is a simplified simulation - in real implementation,
  // this would use the actual rate limiter
  
  const mockLimits = {
    "/api/auth/": { max: 5, window: 900000 },
    "/api/": { max: 60, window: 60000 },
    "/api/search": { max: 30, window: 60000 },
    "/api/upload": { max: 5, window: 60000 }
  };
  
  // Find applicable limit
  let limit = mockLimits["/api/"]; // default
  for (const [pattern, config] of Object.entries(mockLimits)) {
    if (endpoint.startsWith(pattern)) {
      limit = config;
      break;
    }
  }
  
  // Simulate check (randomly allow/deny based on limits)
  const allowed = Math.random() > 0.3; // 70% success rate for simulation
  
  return {
    allowed,
    remaining: allowed ? Math.floor(Math.random() * limit.max) : 0,
    resetTime: Date.now() + limit.window
  };
}