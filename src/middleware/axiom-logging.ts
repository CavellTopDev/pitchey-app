/**
 * Axiom Logging Middleware
 * Automatically logs all requests and errors to Axiom
 */

interface AxiomEvent {
  _time: string;
  service: string;
  environment: string;
  type: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  [key: string]: any;
}

/**
 * Create an Axiom logger instance
 */
export function createAxiomLogger(env: any) {
  const dataset = env.AXIOM_DATASET || 'pitchey-logs';
  const token = env.AXIOM_TOKEN;

  return {
    /**
     * Log an event to Axiom
     */
    async log(event: Partial<AxiomEvent>): Promise<void> {
      if (!token) {
        console.log('[Axiom] No token configured, skipping:', event.type);
        return;
      }

      const fullEvent: AxiomEvent = {
        _time: new Date().toISOString(),
        service: 'pitchey-api',
        environment: env.ENVIRONMENT || 'production',
        type: 'log',
        level: 'info',
        ...event
      };

      try {
        await fetch(`https://api.axiom.co/v1/datasets/${dataset}/ingest`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([fullEvent])
        });
      } catch (error) {
        console.error('[Axiom] Failed to send log:', error);
      }
    },

    /**
     * Log request metrics
     */
    async logRequest(
      request: Request,
      response: Response,
      duration: number,
      userId?: string
    ): Promise<void> {
      const url = new URL(request.url);

      await this.log({
        type: 'request',
        level: response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info',
        request: {
          method: request.method,
          path: url.pathname,
          query: url.search || undefined,
          userAgent: request.headers.get('User-Agent'),
          ip: request.headers.get('CF-Connecting-IP'),
          country: request.headers.get('CF-IPCountry'),
          ray: request.headers.get('CF-Ray')
        },
        response: {
          status: response.status,
          duration
        },
        userId
      });
    },

    /**
     * Log an error
     */
    async logError(
      error: Error,
      request: Request,
      context: Record<string, any> = {}
    ): Promise<void> {
      const url = new URL(request.url);

      await this.log({
        type: 'error',
        level: 'error',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 10).join('\n')
        },
        request: {
          method: request.method,
          path: url.pathname,
          userAgent: request.headers.get('User-Agent'),
          ip: request.headers.get('CF-Connecting-IP')
        },
        ...context
      });
    },

    /**
     * Log authentication events
     */
    async logAuth(
      action: 'login' | 'logout' | 'signup' | 'password_reset' | 'failed_login',
      userId: string | null,
      request: Request,
      success: boolean,
      details?: Record<string, any>
    ): Promise<void> {
      await this.log({
        type: 'auth',
        level: success ? 'info' : 'warn',
        auth: {
          action,
          userId,
          success,
          ip: request.headers.get('CF-Connecting-IP'),
          userAgent: request.headers.get('User-Agent'),
          ...details
        }
      });
    },

    /**
     * Log database queries (for slow query detection)
     */
    async logQuery(
      query: string,
      duration: number,
      success: boolean,
      rowCount?: number
    ): Promise<void> {
      // Only log slow queries (>1s) or failures
      if (duration < 1000 && success) {
        return;
      }

      await this.log({
        type: 'database',
        level: success ? (duration > 2000 ? 'warn' : 'info') : 'error',
        database: {
          query: query.substring(0, 200), // Truncate long queries
          duration,
          success,
          rowCount,
          slow: duration > 1000
        }
      });
    },

    /**
     * Log business events
     */
    async logEvent(
      eventName: string,
      userId: string | null,
      data: Record<string, any> = {}
    ): Promise<void> {
      await this.log({
        type: 'event',
        level: 'info',
        event: {
          name: eventName,
          userId,
          ...data
        }
      });
    }
  };
}

/**
 * Middleware that wraps a handler with Axiom logging
 */
export function withAxiomLogging(
  handler: (request: Request, env: any, ctx: ExecutionContext) => Promise<Response>,
  env: any
) {
  const logger = createAxiomLogger(env);

  return async (request: Request, env: any, ctx: ExecutionContext): Promise<Response> => {
    const startTime = Date.now();

    try {
      const response = await handler(request, env, ctx);
      const duration = Date.now() - startTime;

      // Log request in background
      ctx.waitUntil(logger.logRequest(request, response, duration));

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error
      ctx.waitUntil(logger.logError(error as Error, request, { duration }));

      throw error;
    }
  };
}

/**
 * Alert thresholds for monitoring
 */
export const AlertThresholds = {
  ERROR_RATE_WARNING: 0.01,      // 1%
  ERROR_RATE_CRITICAL: 0.05,    // 5%
  RESPONSE_TIME_WARNING: 2000,  // 2 seconds
  RESPONSE_TIME_CRITICAL: 5000, // 5 seconds
  ERROR_COUNT_SPIKE: 50,        // 50 errors in 5 minutes
  FAILED_LOGIN_THRESHOLD: 10    // 10 failed logins from same IP
};

/**
 * Check if an error should trigger an alert
 */
export function shouldAlert(
  errorCount: number,
  totalRequests: number,
  timeWindow: number = 300000 // 5 minutes
): { alert: boolean; level: 'warning' | 'critical' | null; reason: string } {
  const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

  if (errorRate >= AlertThresholds.ERROR_RATE_CRITICAL) {
    return {
      alert: true,
      level: 'critical',
      reason: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds critical threshold`
    };
  }

  if (errorRate >= AlertThresholds.ERROR_RATE_WARNING) {
    return {
      alert: true,
      level: 'warning',
      reason: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds warning threshold`
    };
  }

  if (errorCount >= AlertThresholds.ERROR_COUNT_SPIKE) {
    return {
      alert: true,
      level: 'critical',
      reason: `${errorCount} errors in ${timeWindow / 1000}s window`
    };
  }

  return { alert: false, level: null, reason: '' };
}
