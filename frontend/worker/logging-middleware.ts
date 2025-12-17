/**
 * Comprehensive Logging Middleware for Cloudflare Workers
 * Provides structured logging with multiple output targets
 */

export interface LogContext {
  requestId: string;
  userId?: string | number;
  endpoint: string;
  method: string;
  ip?: string;
  country?: string;
  userAgent?: string;
  timestamp: string;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  context: LogContext;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number;
    databaseTime?: number;
    cacheHit?: boolean;
  };
}

export class Logger {
  private context: LogContext;
  private startTime: number;
  private env: any;
  private logs: LogEntry[] = [];

  constructor(request: Request, env: any) {
    const url = new URL(request.url);
    this.env = env;
    this.startTime = performance.now();
    
    this.context = {
      requestId: crypto.randomUUID(),
      endpoint: url.pathname,
      method: request.method,
      ip: request.headers.get('CF-Connecting-IP') || undefined,
      country: request.headers.get('CF-IPCountry') || undefined,
      userAgent: request.headers.get('User-Agent') || undefined,
      timestamp: new Date().toISOString()
    };
  }

  setUserId(userId: string | number) {
    this.context.userId = userId;
  }

  private createEntry(
    level: LogEntry['level'],
    message: string,
    data?: any,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      data,
      performance: {
        duration: performance.now() - this.startTime
      }
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    return entry;
  }

  debug(message: string, data?: any) {
    const entry = this.createEntry('debug', message, data);
    this.logs.push(entry);
    
    if (this.env.DEBUG === 'true') {
      console.log(JSON.stringify(entry));
    }
  }

  info(message: string, data?: any) {
    const entry = this.createEntry('info', message, data);
    this.logs.push(entry);
    console.log(JSON.stringify(entry));
  }

  warn(message: string, data?: any) {
    const entry = this.createEntry('warn', message, data);
    this.logs.push(entry);
    console.warn(JSON.stringify(entry));
  }

  error(message: string, error?: Error, data?: any) {
    const entry = this.createEntry('error', message, data, error);
    this.logs.push(entry);
    console.error(JSON.stringify(entry));
    
    // Send to Sentry if configured
    if (this.env.SENTRY_DSN && typeof Sentry !== 'undefined') {
      (globalThis as any).Sentry?.captureException(error, {
        tags: {
          endpoint: this.context.endpoint,
          method: this.context.method,
          requestId: this.context.requestId
        },
        extra: data
      });
    }
  }

  fatal(message: string, error?: Error, data?: any) {
    const entry = this.createEntry('fatal', message, data, error);
    this.logs.push(entry);
    console.error('FATAL:', JSON.stringify(entry));
    
    // Always send fatal errors to monitoring
    this.sendToAnalytics(entry);
  }

  // Log database query performance
  async logDatabaseQuery<T>(
    query: string,
    params: any[],
    executor: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await executor();
      const duration = performance.now() - startTime;
      
      this.debug('Database query executed', {
        query: query.substring(0, 100), // Truncate for security
        paramCount: params.length,
        duration,
        slow: duration > 1000
      });
      
      if (duration > 1000) {
        this.warn('Slow database query detected', {
          query: query.substring(0, 200),
          duration
        });
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.error('Database query failed', error as Error, {
        query: query.substring(0, 100),
        duration
      });
      
      throw error;
    }
  }

  // Log cache operations
  logCacheOperation(operation: 'hit' | 'miss' | 'set', key: string, duration?: number) {
    this.debug(`Cache ${operation}`, {
      key,
      operation,
      duration
    });
  }

  // Log HTTP response
  logResponse(response: Response, additionalData?: any) {
    const duration = performance.now() - this.startTime;
    
    const logData = {
      status: response.status,
      duration,
      ...additionalData
    };
    
    if (response.status >= 500) {
      this.error('Server error response', undefined, logData);
    } else if (response.status >= 400) {
      this.warn('Client error response', logData);
    } else {
      this.info('Request completed', logData);
    }
    
    // Send metrics to Analytics Engine
    this.sendToAnalytics({
      level: 'info',
      message: 'Request completed',
      context: this.context,
      performance: { duration },
      data: { status: response.status }
    });
  }

  // Send to Cloudflare Analytics Engine
  private sendToAnalytics(entry: LogEntry) {
    if (this.env.ANALYTICS) {
      try {
        this.env.ANALYTICS.writeDataPoint({
          indexes: [
            entry.context.endpoint,
            entry.level,
            String(entry.data?.status || 0)
          ],
          doubles: [
            entry.performance?.duration || 0,
            entry.performance?.databaseTime || 0
          ],
          blobs: [
            entry.context.requestId,
            entry.context.userAgent || '',
            entry.message
          ]
        });
      } catch (error) {
        console.error('Failed to send to Analytics Engine:', error);
      }
    }
  }

  // Get all logs for this request
  getLogs(): LogEntry[] {
    return this.logs;
  }

  // Export logs as JSON for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Middleware factory
export function withLogging(
  handler: (request: Request, env: any, ctx: any, logger: Logger) => Promise<Response>
) {
  return async (request: Request, env: any, ctx: any): Promise<Response> => {
    const logger = new Logger(request, env);
    
    try {
      // Log incoming request
      logger.info('Request received', {
        headers: Object.fromEntries(request.headers),
        url: request.url
      });
      
      // Execute handler with logger
      const response = await handler(request, env, ctx, logger);
      
      // Log response
      logger.logResponse(response);
      
      // Add request ID to response headers
      const modifiedResponse = new Response(response.body, response);
      modifiedResponse.headers.set('X-Request-ID', logger.context.requestId);
      
      // In debug mode, add logs to response header
      if (env.DEBUG === 'true') {
        modifiedResponse.headers.set(
          'X-Debug-Logs',
          Buffer.from(logger.exportLogs()).toString('base64')
        );
      }
      
      return modifiedResponse;
    } catch (error) {
      // Log fatal error
      logger.fatal('Unhandled error in request', error as Error);
      
      // Return error response
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Internal server error',
          requestId: logger.context.requestId
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': logger.context.requestId
          }
        }
      );
    }
  };
}

// Database query logger wrapper
export function loggedQuery(logger: Logger) {
  return function(sql: any) {
    return new Proxy(sql, {
      apply: async function(target, thisArg, args) {
        const query = args[0];
        const params = args.slice(1);
        
        return logger.logDatabaseQuery(
          typeof query === 'string' ? query : query.toString(),
          params,
          () => target.apply(thisArg, args)
        );
      }
    });
  };
}

// Example usage in Worker
export const exampleUsage = `
import { withLogging, Logger } from './logging-middleware';

export default {
  fetch: withLogging(async (request, env, ctx, logger) => {
    // Logger is automatically provided
    logger.setUserId(123);
    
    // Log custom events
    logger.info('Processing payment', { amount: 100 });
    
    // Database queries are automatically logged
    const sql = loggedQuery(logger)(neon(env.DATABASE_URL));
    const users = await sql\`SELECT * FROM users\`;
    
    // Cache operations
    logger.logCacheOperation('hit', 'user:123');
    
    // Errors are automatically captured
    try {
      // Some operation
    } catch (error) {
      logger.error('Operation failed', error);
    }
    
    return new Response('Success');
  })
};
`;