/**
 * Comprehensive Error Handling Middleware
 * Provides centralized error handling, monitoring, and recovery
 */

import { telemetry } from "../utils/telemetry.ts";
import { errorResponse } from "../utils/response.ts";

export interface ErrorContext {
  route: string;
  method: string;
  userId?: number;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
  requestId?: string;
}

export interface ErrorDetails {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  statusCode: number;
  severity: "low" | "medium" | "high" | "critical";
  category: "validation" | "authentication" | "authorization" | "database" | "external_api" | "system" | "user_error";
}

export class ErrorHandler {
  
  /**
   * Handle and classify errors with comprehensive logging
   */
  static async handleError(error: any, context: ErrorContext): Promise<Response> {
    const errorDetails = this.analyzeError(error);
    const errorId = crypto.randomUUID();

    // Enhanced error logging with context
    await this.logError(error, errorDetails, context, errorId);

    // Alert on critical errors
    if (errorDetails.severity === "critical") {
      await this.sendCriticalAlert(error, errorDetails, context, errorId);
    }

    // Determine user-friendly response
    const userResponse = this.generateUserResponse(errorDetails, errorId);
    
    return errorResponse(userResponse.message, errorDetails.statusCode, {
      errorId,
      timestamp: new Date().toISOString(),
      ...userResponse.additionalInfo
    });
  }

  /**
   * Analyze error and classify it
   */
  private static analyzeError(error: any): ErrorDetails {
    // Database errors
    if (error.code?.startsWith('23') || error.message?.includes('database')) {
      return {
        name: error.name || "DatabaseError",
        message: error.message || "Database operation failed",
        stack: error.stack,
        code: error.code,
        statusCode: 500,
        severity: "high",
        category: "database"
      };
    }

    // Authentication errors
    if (error.name === "JwtError" || error.message?.includes('token') || error.message?.includes('unauthorized')) {
      return {
        name: "AuthenticationError",
        message: "Authentication failed",
        stack: error.stack,
        statusCode: 401,
        severity: "medium",
        category: "authentication"
      };
    }

    // Authorization errors
    if (error.message?.includes('forbidden') || error.message?.includes('access denied')) {
      return {
        name: "AuthorizationError",
        message: "Access denied",
        stack: error.stack,
        statusCode: 403,
        severity: "medium",
        category: "authorization"
      };
    }

    // Validation errors
    if (error.name === "ValidationError" || error.message?.includes('validation')) {
      return {
        name: "ValidationError",
        message: error.message || "Invalid input data",
        stack: error.stack,
        statusCode: 400,
        severity: "low",
        category: "validation"
      };
    }

    // External API errors
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return {
        name: "ExternalAPIError",
        message: "External service unavailable",
        stack: error.stack,
        statusCode: 502,
        severity: "medium",
        category: "external_api"
      };
    }

    // Rate limiting errors
    if (error.message?.includes('rate limit') || error.message?.includes('too many requests')) {
      return {
        name: "RateLimitError",
        message: "Rate limit exceeded",
        stack: error.stack,
        statusCode: 429,
        severity: "low",
        category: "user_error"
      };
    }

    // Default system error
    return {
      name: error.name || "SystemError",
      message: error.message || "An unexpected error occurred",
      stack: error.stack,
      statusCode: 500,
      severity: "high",
      category: "system"
    };
  }

  /**
   * Enhanced error logging with structured data
   */
  private static async logError(
    error: any, 
    errorDetails: ErrorDetails, 
    context: ErrorContext, 
    errorId: string
  ): Promise<void> {
    
    const logData = {
      errorId,
      error: {
        name: errorDetails.name,
        message: errorDetails.message,
        code: errorDetails.code,
        stack: errorDetails.stack,
        severity: errorDetails.severity,
        category: errorDetails.category
      },
      context: {
        route: context.route,
        method: context.method,
        userId: context.userId,
        userAgent: context.userAgent,
        ip: context.ip,
        timestamp: context.timestamp.toISOString(),
        requestId: context.requestId
      },
      environment: {
        nodeEnv: Deno.env.get("NODE_ENV"),
        denoEnv: Deno.env.get("DENO_ENV"),
        version: "3.4"
      }
    };

    // Log to telemetry system
    telemetry.logger.error("Application Error", error, logData);

    // Log to console with structured format
    console.error(`🚨 ERROR [${errorDetails.severity.toUpperCase()}] ${errorId}`, {
      message: errorDetails.message,
      category: errorDetails.category,
      route: `${context.method} ${context.route}`,
      userId: context.userId,
      timestamp: context.timestamp.toISOString()
    });

    // Store error metrics for monitoring
    await this.trackErrorMetrics(errorDetails, context);
  }

  /**
   * Track error metrics for monitoring dashboards
   */
  private static async trackErrorMetrics(errorDetails: ErrorDetails, context: ErrorContext): Promise<void> {
    try {
      // Track error counts by category
      const errorMetric = {
        timestamp: Date.now(),
        category: errorDetails.category,
        severity: errorDetails.severity,
        route: context.route,
        method: context.method,
        statusCode: errorDetails.statusCode
      };

      // This would typically be sent to a monitoring service
      telemetry.logger.info("Error Metrics", errorMetric);
      
    } catch (metricsError) {
      console.error("Failed to track error metrics:", metricsError);
    }
  }

  /**
   * Send critical alerts for high-severity errors
   */
  private static async sendCriticalAlert(
    error: any,
    errorDetails: ErrorDetails,
    context: ErrorContext,
    errorId: string
  ): Promise<void> {
    try {
      const alert = {
        severity: "CRITICAL",
        errorId,
        message: errorDetails.message,
        route: `${context.method} ${context.route}`,
        timestamp: new Date().toISOString(),
        environment: Deno.env.get("DENO_ENV") || "development",
        userId: context.userId,
        details: {
          name: errorDetails.name,
          category: errorDetails.category,
          stack: errorDetails.stack?.split('\n').slice(0, 5).join('\n') // Truncate stack
        }
      };

      // Log critical alert
      console.error("🚨 CRITICAL ALERT:", alert);
      
      // Send to telemetry with critical flag
      telemetry.logger.error("Critical Error Alert", error, { alert, critical: true });
      
      // In production, this would send to alerting services like PagerDuty, Slack, etc.
      
    } catch (alertError) {
      console.error("Failed to send critical alert:", alertError);
    }
  }

  /**
   * Generate user-friendly error responses
   */
  private static generateUserResponse(errorDetails: ErrorDetails, errorId: string): {
    message: string;
    additionalInfo?: any;
  } {
    
    // Don't expose sensitive error details to users
    switch (errorDetails.category) {
      case "validation":
        return {
          message: errorDetails.message,
          additionalInfo: { type: "validation_error" }
        };

      case "authentication":
        return {
          message: "Authentication required. Please log in to continue.",
          additionalInfo: { type: "auth_required" }
        };

      case "authorization":
        return {
          message: "You don't have permission to access this resource.",
          additionalInfo: { type: "access_denied" }
        };

      case "user_error":
        return {
          message: errorDetails.message,
          additionalInfo: { type: "user_error" }
        };

      case "database":
        return {
          message: "A database error occurred. Please try again later.",
          additionalInfo: { 
            type: "system_error",
            retryable: true 
          }
        };

      case "external_api":
        return {
          message: "An external service is temporarily unavailable. Please try again later.",
          additionalInfo: { 
            type: "service_unavailable",
            retryable: true 
          }
        };

      case "system":
      default:
        return {
          message: "An unexpected error occurred. Please try again later.",
          additionalInfo: { 
            type: "system_error",
            retryable: true 
          }
        };
    }
  }

  /**
   * Create error context from request
   */
  static createErrorContext(request: Request, url: URL, userId?: number): ErrorContext {
    return {
      route: url.pathname,
      method: request.method,
      userId,
      userAgent: request.headers.get("User-Agent") || undefined,
      ip: request.headers.get("CF-Connecting-IP") || 
          request.headers.get("X-Forwarded-For") || 
          request.headers.get("X-Real-IP") || undefined,
      timestamp: new Date(),
      requestId: crypto.randomUUID()
    };
  }

  /**
   * Middleware wrapper for route handlers
   */
  static withErrorHandling(handler: Function) {
    return async (request: Request, url: URL, params?: any) => {
      try {
        return await handler(request, url, params);
      } catch (error) {
        const context = this.createErrorContext(request, url);
        return this.handleError(error, context);
      }
    };
  }

  /**
   * Get error statistics for monitoring
   */
  static async getErrorStats(timeRange: "1h" | "24h" | "7d" = "24h"): Promise<{
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    topRoutes: Array<{ route: string; count: number }>;
    errorRate: number;
  }> {
    // This would typically query from a metrics store
    // For now, return mock data structure
    return {
      totalErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: {},
      topRoutes: [],
      errorRate: 0
    };
  }
}