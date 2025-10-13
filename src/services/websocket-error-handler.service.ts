/**
 * WebSocket Error Handler Service
 * Comprehensive error handling, logging, and recovery for WebSocket operations
 */

import { sentryService, captureException } from "./sentry.service.ts";
import { webSocketAnalyticsService } from "./websocket-analytics.service.ts";
import { redisService } from "./redis.service.ts";
import { WSSession, WSMessage, WSMessageType } from "./websocket.service.ts";

// Error severity levels
export enum ErrorSeverity {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

// Error categories
export enum ErrorCategory {
  CONNECTION = "connection",
  AUTHENTICATION = "authentication", 
  MESSAGE_PROCESSING = "message_processing",
  RATE_LIMITING = "rate_limiting",
  VALIDATION = "validation",
  DATABASE = "database",
  REDIS = "redis",
  NETWORK = "network",
  INTERNAL = "internal",
  SECURITY = "security"
}

// Error codes
export enum WSErrorCode {
  // Connection errors (1000-1999)
  CONNECTION_FAILED = 1000,
  CONNECTION_TIMEOUT = 1001,
  CONNECTION_REJECTED = 1002,
  INVALID_HANDSHAKE = 1003,
  
  // Authentication errors (2000-2999)
  AUTH_TOKEN_MISSING = 2000,
  AUTH_TOKEN_INVALID = 2001,
  AUTH_TOKEN_EXPIRED = 2002,
  AUTH_INSUFFICIENT_PERMISSIONS = 2003,
  
  // Message errors (3000-3999)
  MESSAGE_INVALID_FORMAT = 3000,
  MESSAGE_VALIDATION_FAILED = 3001,
  MESSAGE_TOO_LARGE = 3002,
  MESSAGE_HANDLER_NOT_FOUND = 3003,
  MESSAGE_PROCESSING_FAILED = 3004,
  
  // Rate limiting errors (4000-4999)
  RATE_LIMIT_EXCEEDED = 4000,
  RATE_LIMIT_WINDOW_EXCEEDED = 4001,
  RATE_LIMIT_BLOCKED = 4002,
  
  // Database errors (5000-5999)
  DATABASE_CONNECTION_FAILED = 5000,
  DATABASE_QUERY_FAILED = 5001,
  DATABASE_TIMEOUT = 5002,
  
  // Redis errors (6000-6999)
  REDIS_CONNECTION_FAILED = 6000,
  REDIS_OPERATION_FAILED = 6001,
  REDIS_TIMEOUT = 6002,
  
  // Security errors (7000-7999)
  SECURITY_VIOLATION = 7000,
  SUSPICIOUS_ACTIVITY = 7001,
  MALICIOUS_PAYLOAD = 7002,
  
  // Internal errors (8000-8999)
  INTERNAL_SERVER_ERROR = 8000,
  SERVICE_UNAVAILABLE = 8001,
  RESOURCE_EXHAUSTED = 8002,
  
  // Network errors (9000-9999)
  NETWORK_TIMEOUT = 9000,
  NETWORK_UNREACHABLE = 9001,
  NETWORK_CONGESTION = 9002
}

// Error details interface
export interface WSError {
  code: WSErrorCode;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  details?: Record<string, any>;
  sessionId?: string;
  userId?: number;
  timestamp: Date;
  stackTrace?: string;
  context?: Record<string, any>;
  recovery?: {
    action: string;
    attempted: boolean;
    successful?: boolean;
  };
}

// Recovery strategy interface
export interface RecoveryStrategy {
  errorCode: WSErrorCode;
  action: () => Promise<boolean>;
  description: string;
  maxAttempts: number;
}

// Circuit breaker state
export enum CircuitBreakerState {
  CLOSED = "closed",
  OPEN = "open", 
  HALF_OPEN = "half_open"
}

// Circuit breaker for service failures
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state = CircuitBreakerState.CLOSED;
  
  constructor(
    private name: string,
    private failureThreshold = 5,
    private timeout = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      } else {
        this.state = CircuitBreakerState.HALF_OPEN;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = CircuitBreakerState.CLOSED;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }
}

/**
 * WebSocket Error Handler Service Class
 */
export class WebSocketErrorHandlerService {
  private errorLog: WSError[] = [];
  private recoveryStrategies = new Map<WSErrorCode, RecoveryStrategy>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private errorCounts = new Map<string, number>();
  private suppressedErrors = new Set<string>();
  private cleanupInterval: number;

  // Configuration
  private readonly MAX_ERROR_LOG_SIZE = 10000;
  private readonly ERROR_SUPPRESSION_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly RECOVERY_ATTEMPT_DELAY = 1000; // 1 second

  constructor() {
    this.setupRecoveryStrategies();
    this.setupCircuitBreakers();
    this.setupCleanup();
    console.log("[WebSocket Error Handler] Initialized");
  }

  /**
   * Setup recovery strategies for different error types
   */
  private setupRecoveryStrategies(): void {
    // Connection recovery
    this.recoveryStrategies.set(WSErrorCode.CONNECTION_FAILED, {
      errorCode: WSErrorCode.CONNECTION_FAILED,
      action: async () => {
        // Attempt to restart connection handling
        return true;
      },
      description: "Restart connection handling",
      maxAttempts: 3
    });

    // Database recovery
    this.recoveryStrategies.set(WSErrorCode.DATABASE_CONNECTION_FAILED, {
      errorCode: WSErrorCode.DATABASE_CONNECTION_FAILED,
      action: async () => {
        // Attempt to reconnect to database
        return true;
      },
      description: "Reconnect to database",
      maxAttempts: 5
    });

    // Redis recovery
    this.recoveryStrategies.set(WSErrorCode.REDIS_CONNECTION_FAILED, {
      errorCode: WSErrorCode.REDIS_CONNECTION_FAILED,
      action: async () => {
        // Attempt to reconnect to Redis
        return redisService.isEnabled();
      },
      description: "Reconnect to Redis",
      maxAttempts: 3
    });

    // Rate limit recovery
    this.recoveryStrategies.set(WSErrorCode.RATE_LIMIT_EXCEEDED, {
      errorCode: WSErrorCode.RATE_LIMIT_EXCEEDED,
      action: async () => {
        // Wait and reset rate limit
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
        return true;
      },
      description: "Wait for rate limit reset",
      maxAttempts: 1
    });
  }

  /**
   * Setup circuit breakers for external services
   */
  private setupCircuitBreakers(): void {
    this.circuitBreakers.set("database", new CircuitBreaker("database", 5, 60000));
    this.circuitBreakers.set("redis", new CircuitBreaker("redis", 3, 30000));
    this.circuitBreakers.set("analytics", new CircuitBreaker("analytics", 5, 120000));
  }

  /**
   * Setup periodic cleanup
   */
  private setupCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupErrorLog();
      this.cleanupSuppressionList();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Handle WebSocket error
   */
  async handleError(
    error: Error | WSError,
    context?: {
      sessionId?: string;
      userId?: number;
      messageType?: WSMessageType;
      operation?: string;
      additionalContext?: Record<string, any>;
    }
  ): Promise<WSMessage | null> {
    try {
      let wsError: WSError;

      // Convert Error to WSError if needed
      if (error instanceof Error) {
        wsError = this.convertErrorToWSError(error, context);
      } else {
        wsError = error;
      }

      // Add context information
      if (context) {
        wsError.sessionId = context.sessionId;
        wsError.userId = context.userId;
        wsError.context = {
          messageType: context.messageType,
          operation: context.operation,
          ...context.additionalContext
        };
      }

      // Check if error should be suppressed
      if (this.shouldSuppressError(wsError)) {
        return null;
      }

      // Log the error
      await this.logError(wsError);

      // Track error analytics
      await this.trackErrorAnalytics(wsError);

      // Attempt recovery
      const recovered = await this.attemptRecovery(wsError);
      if (recovered) {
        console.log(`[WebSocket Error Handler] Successfully recovered from error: ${wsError.code}`);
      }

      // Generate client error response
      return this.generateErrorResponse(wsError);

    } catch (handlingError) {
      console.error("[WebSocket Error Handler] Error while handling error:", handlingError);
      captureException(handlingError);
      
      // Return basic error response
      return {
        type: WSMessageType.ERROR,
        payload: {
          error: "Internal error occurred",
          code: WSErrorCode.INTERNAL_SERVER_ERROR,
          timestamp: Date.now()
        },
        messageId: crypto.randomUUID()
      };
    }
  }

  /**
   * Convert Error to WSError
   */
  private convertErrorToWSError(error: Error, context?: any): WSError {
    let code = WSErrorCode.INTERNAL_SERVER_ERROR;
    let category = ErrorCategory.INTERNAL;
    let severity = ErrorSeverity.MEDIUM;

    // Determine error code based on error message/type
    if (error.message.includes("authentication") || error.message.includes("token")) {
      code = WSErrorCode.AUTH_TOKEN_INVALID;
      category = ErrorCategory.AUTHENTICATION;
      severity = ErrorSeverity.HIGH;
    } else if (error.message.includes("validation")) {
      code = WSErrorCode.MESSAGE_VALIDATION_FAILED;
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.LOW;
    } else if (error.message.includes("database")) {
      code = WSErrorCode.DATABASE_QUERY_FAILED;
      category = ErrorCategory.DATABASE;
      severity = ErrorSeverity.HIGH;
    } else if (error.message.includes("redis")) {
      code = WSErrorCode.REDIS_OPERATION_FAILED;
      category = ErrorCategory.REDIS;
      severity = ErrorSeverity.MEDIUM;
    } else if (error.message.includes("rate limit")) {
      code = WSErrorCode.RATE_LIMIT_EXCEEDED;
      category = ErrorCategory.RATE_LIMITING;
      severity = ErrorSeverity.LOW;
    } else if (error.message.includes("timeout")) {
      code = WSErrorCode.NETWORK_TIMEOUT;
      category = ErrorCategory.NETWORK;
      severity = ErrorSeverity.MEDIUM;
    }

    return {
      code,
      category,
      severity,
      message: error.message,
      timestamp: new Date(),
      stackTrace: error.stack,
      details: {
        name: error.name,
        originalError: error.toString()
      },
      context
    };
  }

  /**
   * Check if error should be suppressed to avoid spam
   */
  private shouldSuppressError(error: WSError): boolean {
    const errorKey = `${error.code}_${error.sessionId || 'global'}`;
    
    // Check if this error is temporarily suppressed
    if (this.suppressedErrors.has(errorKey)) {
      return true;
    }

    // Check error frequency
    const count = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, count + 1);

    // Suppress if too many similar errors
    if (count > 10) { // More than 10 similar errors
      this.suppressedErrors.add(errorKey);
      setTimeout(() => {
        this.suppressedErrors.delete(errorKey);
        this.errorCounts.delete(errorKey);
      }, this.ERROR_SUPPRESSION_DURATION);
      
      return true;
    }

    return false;
  }

  /**
   * Log error to various destinations
   */
  private async logError(error: WSError): Promise<void> {
    try {
      // Add to local error log
      this.errorLog.push(error);
      
      // Trim log if too large
      if (this.errorLog.length > this.MAX_ERROR_LOG_SIZE) {
        this.errorLog.splice(0, this.errorLog.length - this.MAX_ERROR_LOG_SIZE);
      }

      // Log to console based on severity
      const logMessage = `[WebSocket Error] ${error.category}:${error.code} - ${error.message}`;
      
      switch (error.severity) {
        case ErrorSeverity.LOW:
          console.log(logMessage);
          break;
        case ErrorSeverity.MEDIUM:
          console.warn(logMessage);
          break;
        case ErrorSeverity.HIGH:
        case ErrorSeverity.CRITICAL:
          console.error(logMessage);
          break;
      }

      // Store in Redis for monitoring
      await this.storeErrorInRedis(error);

      // Send to Sentry for critical/high severity errors
      if (error.severity >= ErrorSeverity.HIGH) {
        sentryService.addBreadcrumb({
          category: `websocket.${error.category}`,
          message: error.message,
          level: error.severity === ErrorSeverity.CRITICAL ? 'fatal' : 'error',
          data: {
            code: error.code,
            sessionId: error.sessionId,
            userId: error.userId,
            context: error.context
          }
        });

        if (error.stackTrace) {
          captureException(new Error(error.message));
        }
      }

    } catch (loggingError) {
      console.error("[WebSocket Error Handler] Failed to log error:", loggingError);
    }
  }

  /**
   * Store error in Redis for monitoring dashboard
   */
  private async storeErrorInRedis(error: WSError): Promise<void> {
    try {
      const errorKey = `pitchey:websocket_errors:${Date.now()}`;
      await redisService.set(errorKey, {
        code: error.code,
        category: error.category,
        severity: error.severity,
        message: error.message,
        sessionId: error.sessionId,
        userId: error.userId,
        timestamp: error.timestamp,
        context: error.context
      }, 24 * 3600); // 24 hours TTL

      // Update error statistics
      const statsKey = "pitchey:websocket_error_stats";
      const stats = await redisService.get(statsKey) || {
        totalErrors: 0,
        errorsByCategory: {},
        errorsByCode: {},
        lastUpdated: new Date()
      };

      stats.totalErrors++;
      stats.errorsByCategory[error.category] = (stats.errorsByCategory[error.category] || 0) + 1;
      stats.errorsByCode[error.code] = (stats.errorsByCode[error.code] || 0) + 1;
      stats.lastUpdated = new Date();

      await redisService.set(statsKey, stats, 24 * 3600);

    } catch (storageError) {
      console.error("[WebSocket Error Handler] Failed to store error in Redis:", storageError);
    }
  }

  /**
   * Track error analytics
   */
  private async trackErrorAnalytics(error: WSError): Promise<void> {
    try {
      await webSocketAnalyticsService.trackError(
        error.sessionId || "unknown",
        error.category,
        error.message,
        {
          code: error.code,
          severity: error.severity,
          context: error.context
        }
      );
    } catch (analyticsError) {
      console.error("[WebSocket Error Handler] Failed to track error analytics:", analyticsError);
    }
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(error: WSError): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.code);
    if (!strategy) {
      return false;
    }

    if (error.recovery && error.recovery.attempted) {
      return false; // Already attempted recovery
    }

    try {
      console.log(`[WebSocket Error Handler] Attempting recovery for error ${error.code}: ${strategy.description}`);
      
      // Mark recovery as attempted
      error.recovery = {
        action: strategy.description,
        attempted: true
      };

      // Add delay before recovery attempt
      await new Promise(resolve => setTimeout(resolve, this.RECOVERY_ATTEMPT_DELAY));

      // Execute recovery action
      const success = await strategy.action();
      error.recovery.successful = success;

      if (success) {
        console.log(`[WebSocket Error Handler] Recovery successful for error ${error.code}`);
      } else {
        console.warn(`[WebSocket Error Handler] Recovery failed for error ${error.code}`);
      }

      return success;

    } catch (recoveryError) {
      console.error(`[WebSocket Error Handler] Recovery attempt failed for error ${error.code}:`, recoveryError);
      if (error.recovery) {
        error.recovery.successful = false;
      }
      return false;
    }
  }

  /**
   * Generate error response for client
   */
  private generateErrorResponse(error: WSError): WSMessage {
    // Don't expose internal error details to client
    const clientMessage = this.getClientFriendlyMessage(error);
    
    return {
      type: WSMessageType.ERROR,
      payload: {
        error: clientMessage,
        code: error.code,
        category: error.category,
        severity: error.severity,
        timestamp: error.timestamp.getTime(),
        recoverable: this.recoveryStrategies.has(error.code),
        retryAfter: this.getRetryAfter(error)
      },
      messageId: crypto.randomUUID()
    };
  }

  /**
   * Get client-friendly error message
   */
  private getClientFriendlyMessage(error: WSError): string {
    switch (error.code) {
      case WSErrorCode.AUTH_TOKEN_MISSING:
        return "Authentication token is required";
      case WSErrorCode.AUTH_TOKEN_INVALID:
        return "Invalid authentication token";
      case WSErrorCode.AUTH_TOKEN_EXPIRED:
        return "Authentication token has expired";
      case WSErrorCode.RATE_LIMIT_EXCEEDED:
        return "Rate limit exceeded. Please slow down your requests";
      case WSErrorCode.MESSAGE_VALIDATION_FAILED:
        return "Message format is invalid";
      case WSErrorCode.MESSAGE_TOO_LARGE:
        return "Message is too large";
      case WSErrorCode.CONNECTION_FAILED:
        return "Connection failed. Please try again";
      case WSErrorCode.SERVICE_UNAVAILABLE:
        return "Service is temporarily unavailable";
      default:
        return "An error occurred. Please try again";
    }
  }

  /**
   * Get retry after duration for recoverable errors
   */
  private getRetryAfter(error: WSError): number | undefined {
    switch (error.code) {
      case WSErrorCode.RATE_LIMIT_EXCEEDED:
        return 60; // 1 minute
      case WSErrorCode.SERVICE_UNAVAILABLE:
        return 30; // 30 seconds
      case WSErrorCode.NETWORK_TIMEOUT:
        return 10; // 10 seconds
      default:
        return undefined;
    }
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    service: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const circuitBreaker = this.circuitBreakers.get(service);
    if (!circuitBreaker) {
      return await operation();
    }

    return await circuitBreaker.execute(operation);
  }

  /**
   * Get error statistics
   */
  async getErrorStats(): Promise<{
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: WSError[];
    circuitBreakerStates: Record<string, CircuitBreakerState>;
  }> {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    const recentErrors = this.errorLog.filter(error => 
      error.timestamp.getTime() > hourAgo
    );

    const errorsByCategory = recentErrors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsBySeverity = recentErrors.reduce((acc, error) => {
      acc[ErrorSeverity[error.severity]] = (acc[ErrorSeverity[error.severity]] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const circuitBreakerStates = Object.fromEntries(
      Array.from(this.circuitBreakers.entries()).map(([name, breaker]) => [
        name,
        breaker.getState()
      ])
    );

    return {
      totalErrors: recentErrors.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors: recentErrors.slice(-10), // Last 10 errors
      circuitBreakerStates
    };
  }

  /**
   * Create custom error
   */
  createError(
    code: WSErrorCode,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    details?: Record<string, any>
  ): WSError {
    return {
      code,
      category: this.getErrorCategory(code),
      severity,
      message,
      details,
      timestamp: new Date()
    };
  }

  /**
   * Get error category from code
   */
  private getErrorCategory(code: WSErrorCode): ErrorCategory {
    if (code >= 1000 && code < 2000) return ErrorCategory.CONNECTION;
    if (code >= 2000 && code < 3000) return ErrorCategory.AUTHENTICATION;
    if (code >= 3000 && code < 4000) return ErrorCategory.MESSAGE_PROCESSING;
    if (code >= 4000 && code < 5000) return ErrorCategory.RATE_LIMITING;
    if (code >= 5000 && code < 6000) return ErrorCategory.DATABASE;
    if (code >= 6000 && code < 7000) return ErrorCategory.REDIS;
    if (code >= 7000 && code < 8000) return ErrorCategory.SECURITY;
    if (code >= 8000 && code < 9000) return ErrorCategory.INTERNAL;
    if (code >= 9000 && code < 10000) return ErrorCategory.NETWORK;
    return ErrorCategory.INTERNAL;
  }

  /**
   * Clean up error log
   */
  private cleanupErrorLog(): void {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.errorLog = this.errorLog.filter(error => 
      error.timestamp.getTime() > dayAgo
    );
  }

  /**
   * Clean up suppression list
   */
  private cleanupSuppressionList(): void {
    // Suppressed errors are automatically cleaned up by setTimeout
    // This is a placeholder for any additional cleanup logic
  }

  /**
   * Shutdown error handler
   */
  async shutdown(): Promise<void> {
    console.log("[WebSocket Error Handler] Shutting down...");
    
    clearInterval(this.cleanupInterval);
    
    // Clear data structures
    this.errorLog = [];
    this.errorCounts.clear();
    this.suppressedErrors.clear();
    
    console.log("[WebSocket Error Handler] Shutdown complete");
  }
}

// Export singleton instance
export const webSocketErrorHandler = new WebSocketErrorHandlerService();
export default webSocketErrorHandler;