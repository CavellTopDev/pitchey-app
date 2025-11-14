/**
 * Production Telemetry & Observability Setup
 * Integrates Sentry error tracking with Deno Deploy OpenTelemetry
 */

import * as Sentry from "npm:@sentry/deno@^8.0.0";

interface TelemetryConfig {
  sentryDsn?: string;
  environment: string;
  serviceName: string;
  version: string;
  enableTracing: boolean;
  sampleRate: number;
}

export class TelemetryManager {
  private config: TelemetryConfig;
  private isInitialized = false;

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = {
      sentryDsn: Deno.env.get("SENTRY_DSN"),
      environment: Deno.env.get("DENO_ENV") || "development",
      serviceName: "pitchey-backend",
      version: "3.4-redis-cache",
      enableTracing: true,
      sampleRate: Deno.env.get("DENO_ENV") === "production" ? 0.1 : 1.0,
      ...config
    };
  }

  /**
   * Initialize Sentry with production-optimized configuration
   */
  initialize(): void {
    if (this.isInitialized) return;

    if (!this.config.sentryDsn) {
      console.warn("🔶 Sentry DSN not provided - error tracking disabled");
      return;
    }

    try {
      Sentry.init({
        dsn: this.config.sentryDsn,
        environment: this.config.environment,
        serverName: `${this.config.serviceName}-${this.config.environment}`,
        release: this.config.version,
        
        // Performance monitoring
        tracesSampleRate: this.config.sampleRate,
        
        // Integrations
        integrations: [
          // Automatic HTTP request tracing  
          new Sentry.Integrations.Http({ tracing: this.config.enableTracing }),
          // Deno-specific integrations
          new Sentry.Integrations.OnUncaughtException(),
          new Sentry.Integrations.OnUnhandledRejection(),
        ],
        
        // Data filtering for security
        beforeSend: this.filterSensitiveData,
        beforeSendTransaction: this.filterSensitiveTransactions,
        
        // Additional configuration
        maxBreadcrumbs: 50,
        debug: this.config.environment === "development",
        
        // Performance settings
        profilesSampleRate: this.config.environment === "production" ? 0.1 : 1.0,
      });

      // Set global context
      Sentry.setContext("service", {
        name: this.config.serviceName,
        version: this.config.version,
        environment: this.config.environment,
      });

      this.isInitialized = true;
      this.logger.info("✅ Sentry telemetry initialized", { 
        environment: this.config.environment,
        version: this.config.version 
      });
    } catch (error) {
      console.error("❌ Failed to initialize Sentry:", error);
    }
  }

  /**
   * Filter sensitive data from error reports
   */
  private filterSensitiveData(event: Sentry.Event): Sentry.Event | null {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-api-key"];
    }

    // Filter sensitive form data
    if (event.request?.data) {
      if (typeof event.request.data === "object") {
        const data = { ...event.request.data };
        delete data.password;
        delete data.token;
        delete data.secret;
        event.request.data = data;
      }
    }

    // Remove sensitive context data
    if (event.contexts?.user) {
      delete event.contexts.user.ip_address;
      delete event.contexts.user.email;
    }

    return event;
  }

  /**
   * Filter sensitive data from performance transactions
   */
  private filterSensitiveTransactions(transaction: Sentry.Transaction): Sentry.Transaction | null {
    // Skip health check transactions in production to reduce noise
    if (this.config.environment === "production" && 
        transaction.name?.includes("/api/health")) {
      return null;
    }

    return transaction;
  }

  /**
   * Structured logger with Sentry integration
   */
  public logger = {
    info: (message: string, meta?: Record<string, any>) => {
      const logEntry = {
        level: "info",
        message,
        timestamp: new Date().toISOString(),
        service: this.config.serviceName,
        environment: this.config.environment,
        ...meta,
      };
      
      console.log(JSON.stringify(logEntry));
      
      // Add breadcrumb to Sentry
      if (this.isInitialized) {
        Sentry.addBreadcrumb({
          message,
          level: "info",
          data: meta,
        });
      }
    },

    warn: (message: string, meta?: Record<string, any>) => {
      const logEntry = {
        level: "warn",
        message,
        timestamp: new Date().toISOString(),
        service: this.config.serviceName,
        environment: this.config.environment,
        ...meta,
      };
      
      console.warn(JSON.stringify(logEntry));
      
      if (this.isInitialized) {
        Sentry.addBreadcrumb({
          message,
          level: "warning", 
          data: meta,
        });
      }
    },

    error: (message: string, error?: Error | unknown, meta?: Record<string, any>) => {
      const logEntry = {
        level: "error",
        message,
        timestamp: new Date().toISOString(),
        service: this.config.serviceName,
        environment: this.config.environment,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error,
        ...meta,
      };
      
      console.error(JSON.stringify(logEntry));
      
      // Send to Sentry
      if (this.isInitialized) {
        if (error instanceof Error) {
          Sentry.captureException(error, {
            tags: {
              service: this.config.serviceName,
              environment: this.config.environment,
            },
            contexts: {
              error_details: meta,
            },
          });
        } else {
          Sentry.captureMessage(message, "error");
        }
      }
    },
  };

  /**
   * Create performance transaction for monitoring
   */
  public startTransaction(name: string, op?: string): Sentry.Transaction | null {
    if (!this.isInitialized) return null;

    return Sentry.startTransaction({
      name,
      op: op || "http.server",
      tags: {
        service: this.config.serviceName,
        environment: this.config.environment,
      },
    });
  }

  /**
   * Add user context to error tracking
   */
  public setUser(user: { id?: string; email?: string; userType?: string }) {
    if (!this.isInitialized) return;

    Sentry.setUser({
      id: user.id,
      // Don't send email to Sentry for privacy
      username: user.email?.split("@")[0],
      segment: user.userType,
    });
  }

  /**
   * Clear user context (e.g., on logout)
   */
  public clearUser(): void {
    if (!this.isInitialized) return;
    Sentry.setUser(null);
  }

  /**
   * Add custom tags for filtering
   */
  public setTag(key: string, value: string): void {
    if (!this.isInitialized) return;
    Sentry.setTag(key, value);
  }

  /**
   * Manually capture a message
   */
  public captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
    if (!this.isInitialized) return;
    Sentry.captureMessage(message, level);
  }

  /**
   * Health check for telemetry system
   */
  public getHealthStatus(): { initialized: boolean; environment: string; config: any } {
    return {
      initialized: this.isInitialized,
      environment: this.config.environment,
      config: {
        serviceName: this.config.serviceName,
        version: this.config.version,
        enableTracing: this.config.enableTracing,
        sampleRate: this.config.sampleRate,
        sentryConfigured: !!this.config.sentryDsn,
      },
    };
  }
}

// Global telemetry instance
export const telemetry = new TelemetryManager();

/**
 * Middleware wrapper for HTTP handlers with automatic tracing
 */
export function withTelemetry(
  handler: (request: Request, info?: any) => Promise<Response> | Response
) {
  return async (request: Request, info?: any): Promise<Response> => {
    const transaction = telemetry.startTransaction(
      `${request.method} ${new URL(request.url).pathname}`,
      "http.server"
    );

    const startTime = performance.now();
    
    try {
      // Add request context
      telemetry.setTag("http.method", request.method);
      telemetry.setTag("http.url", new URL(request.url).pathname);

      const response = await handler(request, info);
      
      const duration = performance.now() - startTime;
      
      // Log successful requests
      telemetry.logger.info("Request processed", {
        method: request.method,
        url: new URL(request.url).pathname,
        status: response.status,
        duration_ms: Math.round(duration),
      });

      // Set transaction status  
      transaction?.setHttpStatus(response.status);
      transaction?.finish();

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Log error with context
      telemetry.logger.error("Request failed", error, {
        method: request.method,
        url: new URL(request.url).pathname,
        duration_ms: Math.round(duration),
      });

      // Mark transaction as error
      transaction?.setStatus("internal_error");
      transaction?.finish();

      throw error;
    }
  };
}

/**
 * Database query wrapper with performance monitoring
 */
export function withDatabaseTelemetry<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return telemetry.startTransaction(queryName, "db.query")?.finish() 
    ? (async () => {
        const startTime = performance.now();
        try {
          const result = await queryFn();
          const duration = performance.now() - startTime;
          
          telemetry.logger.info("Database query completed", {
            query: queryName,
            duration_ms: Math.round(duration),
            success: true,
          });

          // Alert on slow queries
          if (duration > 1000) {
            telemetry.logger.warn("Slow database query detected", {
              query: queryName,
              duration_ms: Math.round(duration),
            });
          }

          return result;
        } catch (error) {
          const duration = performance.now() - startTime;
          telemetry.logger.error("Database query failed", error, {
            query: queryName,
            duration_ms: Math.round(duration),
          });
          throw error;
        }
      })()
    : queryFn();
}