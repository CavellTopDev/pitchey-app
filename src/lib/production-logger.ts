/**
 * Production Logger for Cloudflare Workers
 *
 * Provides structured logging with:
 * - Request context propagation (requestId, traceId, spanId)
 * - Log levels with filtering
 * - Sensitive data redaction
 * - Performance timing
 * - Sentry integration for errors
 * - Analytics Engine integration for metrics
 */

import * as Sentry from '@sentry/cloudflare';

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  service?: string;
  component?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ip?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface LoggerConfig {
  service: string;
  environment: string;
  minLevel: LogLevel;
  enableConsole: boolean;
  enableSentry: boolean;
  enableAnalytics: boolean;
  redactPaths: string[];
  sampleRate: number;
}

// ============================================================================
// Constants
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const DEFAULT_CONFIG: LoggerConfig = {
  service: 'pitchey-api',
  environment: 'production',
  minLevel: 'info',
  enableConsole: true,
  enableSentry: true,
  enableAnalytics: true,
  redactPaths: [
    'password',
    'token',
    'secret',
    'authorization',
    'cookie',
    'apiKey',
    'api_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'creditCard',
    'credit_card',
    'ssn',
    'cvv',
  ],
  sampleRate: 1.0,
};

// Sensitive headers to always redact
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
]);

// ============================================================================
// Request Context Storage
// ============================================================================

// Use a WeakMap to store context per request without memory leaks
const requestContextMap = new WeakMap<Request, LogContext>();

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a trace ID (W3C Trace Context format)
 */
export function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a span ID
 */
export function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Production Logger Class
// ============================================================================

export class ProductionLogger {
  private config: LoggerConfig;
  private context: LogContext;
  private startTime: number;

  constructor(config: Partial<LoggerConfig> = {}, context: LogContext = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = {
      service: this.config.service,
      ...context,
    };
    this.startTime = Date.now();
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): ProductionLogger {
    const childLogger = new ProductionLogger(this.config, {
      ...this.context,
      ...additionalContext,
    });
    childLogger.startTime = this.startTime;
    return childLogger;
  }

  /**
   * Set the context for this logger
   */
  setContext(context: Partial<LogContext>): void {
    Object.assign(this.context, context);
  }

  /**
   * Get the current context
   */
  getContext(): LogContext {
    return { ...this.context };
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData = this.formatError(error);
    this.log('error', message, { ...data, ...errorData });

    // Send to Sentry for error level
    if (this.config.enableSentry && error instanceof Error) {
      Sentry.withScope((scope) => {
        scope.setTags({
          requestId: this.context.requestId || 'unknown',
          service: this.context.service || 'pitchey-api',
          component: this.context.component || 'unknown',
        });
        scope.setExtras(this.redact(data || {}));
        Sentry.captureException(error);
      });
    }
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData = this.formatError(error);
    this.log('fatal', message, { ...data, ...errorData });

    // Always send fatal errors to Sentry
    if (this.config.enableSentry) {
      Sentry.withScope((scope) => {
        scope.setLevel('fatal');
        scope.setTags({
          requestId: this.context.requestId || 'unknown',
          service: this.context.service || 'pitchey-api',
          component: this.context.component || 'unknown',
        });
        scope.setExtras(this.redact(data || {}));
        if (error instanceof Error) {
          Sentry.captureException(error);
        } else {
          Sentry.captureMessage(message, 'fatal');
        }
      });
    }
  }

  /**
   * Log HTTP request start
   */
  logRequest(request: Request): void {
    const url = new URL(request.url);
    this.info('Incoming request', {
      method: request.method,
      path: url.pathname,
      query: url.search,
      userAgent: request.headers.get('user-agent') || undefined,
      contentType: request.headers.get('content-type') || undefined,
      contentLength: request.headers.get('content-length') || undefined,
    });

    // Add Sentry breadcrumb
    if (this.config.enableSentry) {
      Sentry.addBreadcrumb({
        category: 'http',
        message: `${request.method} ${url.pathname}`,
        level: 'info',
        data: {
          requestId: this.context.requestId,
          method: request.method,
          url: url.pathname,
        },
      });
    }
  }

  /**
   * Log HTTP response
   */
  logResponse(response: Response, startTime?: number): void {
    const duration = startTime ? Date.now() - startTime : Date.now() - this.startTime;
    const level = response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info';

    this.log(level, 'Request completed', {
      statusCode: response.status,
      duration,
      contentType: response.headers.get('content-type') || undefined,
      contentLength: response.headers.get('content-length') || undefined,
    });
  }

  /**
   * Log a database query
   */
  logQuery(query: string, params: unknown[], duration: number, rowCount?: number): void {
    // Redact sensitive data in query parameters
    const safeParams = params.map((p, i) => {
      if (typeof p === 'string' && p.length > 100) {
        return `$${i + 1}:[string:${p.length}chars]`;
      }
      return p;
    });

    // Truncate long queries
    const safeQuery = query.length > 500 ? query.substring(0, 500) + '...' : query;

    const level = duration > 1000 ? 'warn' : 'debug';
    this.log(level, 'Database query', {
      query: safeQuery,
      params: safeParams,
      duration,
      rowCount,
      slow: duration > 1000,
    });

    // Add Sentry breadcrumb for queries
    if (this.config.enableSentry) {
      Sentry.addBreadcrumb({
        category: 'query',
        message: safeQuery.substring(0, 100),
        level: duration > 1000 ? 'warning' : 'info',
        data: {
          duration,
          rowCount,
        },
      });
    }
  }

  /**
   * Log an external API call
   */
  logExternalCall(service: string, method: string, url: string, duration: number, statusCode?: number): void {
    const level = statusCode && statusCode >= 500 ? 'error' : statusCode && statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `External API call: ${service}`, {
      externalService: service,
      method,
      url: this.redactUrl(url),
      duration,
      statusCode,
    });
  }

  /**
   * Log a cache operation
   */
  logCache(operation: 'get' | 'set' | 'delete' | 'hit' | 'miss', key: string, duration?: number): void {
    this.debug(`Cache ${operation}`, {
      cacheOperation: operation,
      cacheKey: key,
      duration,
    });
  }

  /**
   * Start a timer for measuring duration
   */
  startTimer(name: string): () => number {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`Timer: ${name}`, { timerName: name, duration });
      return duration;
    };
  }

  /**
   * Create a span for tracing
   */
  span<T>(name: string, fn: (spanLogger: ProductionLogger) => T | Promise<T>): Promise<T> {
    const spanId = generateSpanId();
    const spanLogger = this.child({
      spanId,
      component: name,
    });

    const start = Date.now();

    const complete = (result: T, error?: Error) => {
      const duration = Date.now() - start;
      if (error) {
        spanLogger.error(`Span failed: ${name}`, error, { duration });
      } else {
        spanLogger.debug(`Span completed: ${name}`, { duration });
      }
      return result;
    };

    try {
      const result = fn(spanLogger);
      if (result instanceof Promise) {
        return result
          .then((r) => complete(r))
          .catch((e) => {
            complete(undefined as T, e);
            throw e;
          });
      }
      return Promise.resolve(complete(result));
    } catch (error) {
      complete(undefined as T, error as Error);
      throw error;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    // Check minimum log level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.minLevel]) {
      return;
    }

    // Apply sampling for non-error logs
    if (level !== 'error' && level !== 'fatal') {
      if (Math.random() > this.config.sampleRate) {
        return;
      }
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data: data ? this.redact(data) : undefined,
    };

    // Console output (structured JSON for production)
    if (this.config.enableConsole) {
      const consoleMethod = level === 'debug' ? 'log' : level === 'fatal' ? 'error' : level;
      const output = JSON.stringify(entry);
      console[consoleMethod](output);
    }
  }

  private formatError(error: unknown): Record<string, unknown> | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        },
      };
    }

    if (typeof error === 'string') {
      return {
        error: {
          name: 'Error',
          message: error,
        },
      };
    }

    return {
      error: {
        name: 'UnknownError',
        message: String(error),
      },
    };
  }

  private redact(data: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      // Check if this key should be redacted
      if (this.config.redactPaths.some(path => lowerKey.includes(path.toLowerCase()))) {
        redacted[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        redacted[key] = this.redact(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        redacted[key] = value.map(item =>
          typeof item === 'object' && item !== null
            ? this.redact(item as Record<string, unknown>)
            : item
        );
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  private redactUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Redact query parameters that look sensitive
      const params = new URLSearchParams(parsed.search);
      const keysToRedact: string[] = [];
      params.forEach((_, key) => {
        if (this.config.redactPaths.some(path => key.toLowerCase().includes(path.toLowerCase()))) {
          keysToRedact.push(key);
        }
      });
      keysToRedact.forEach(key => params.set(key, '[REDACTED]'));
      parsed.search = params.toString();
      return parsed.toString();
    } catch {
      return url;
    }
  }
}

// ============================================================================
// Request Logger Factory
// ============================================================================

export interface RequestLoggerOptions {
  request: Request;
  env: {
    ENVIRONMENT?: string;
    SENTRY_DSN?: string;
  };
  ctx?: ExecutionContext;
}

/**
 * Create a logger for a specific request with full context
 */
export function createRequestLogger(options: RequestLoggerOptions): ProductionLogger {
  const { request, env } = options;
  const url = new URL(request.url);

  // Extract trace context from headers (W3C Trace Context)
  const traceParent = request.headers.get('traceparent');
  let traceId = generateTraceId();
  let parentSpanId: string | undefined;

  if (traceParent) {
    const parts = traceParent.split('-');
    if (parts.length >= 3) {
      traceId = parts[1];
      parentSpanId = parts[2];
    }
  }

  const requestId = request.headers.get('x-request-id') || generateRequestId();
  const spanId = generateSpanId();

  // Extract client IP
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || 'unknown';

  const context: LogContext = {
    requestId,
    traceId,
    spanId,
    parentSpanId,
    method: request.method,
    path: url.pathname,
    ip,
    userAgent: request.headers.get('user-agent') || undefined,
  };

  const logger = new ProductionLogger({
    environment: env.ENVIRONMENT || 'production',
    enableSentry: !!env.SENTRY_DSN,
    minLevel: env.ENVIRONMENT === 'development' ? 'debug' : 'info',
  }, context);

  // Store context for later retrieval
  requestContextMap.set(request, context);

  return logger;
}

/**
 * Get the logger context for a request
 */
export function getRequestContext(request: Request): LogContext | undefined {
  return requestContextMap.get(request);
}

// ============================================================================
// Middleware
// ============================================================================

export interface LoggingMiddlewareResult {
  logger: ProductionLogger;
  response: (res: Response) => Response;
}

/**
 * Create logging middleware for request/response
 */
export function createLoggingMiddleware(options: RequestLoggerOptions): LoggingMiddlewareResult {
  const logger = createRequestLogger(options);
  const startTime = Date.now();

  // Log the incoming request
  logger.logRequest(options.request);

  return {
    logger,
    response: (res: Response) => {
      // Log the response
      logger.logResponse(res, startTime);

      // Add trace headers to response
      const headers = new Headers(res.headers);
      headers.set('x-request-id', logger.getContext().requestId || '');
      headers.set('x-trace-id', logger.getContext().traceId || '');

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    },
  };
}

// ============================================================================
// Global Logger Instance (for non-request contexts)
// ============================================================================

let globalLogger: ProductionLogger | null = null;

/**
 * Get or create the global logger instance
 */
export function getGlobalLogger(config?: Partial<LoggerConfig>): ProductionLogger {
  if (!globalLogger) {
    globalLogger = new ProductionLogger(config);
  }
  return globalLogger;
}

// ============================================================================
// Legacy Compatibility (drop-in replacement for existing logger)
// ============================================================================

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => getGlobalLogger().info(message, data),
  error: (message: string, data?: Record<string, unknown>) => getGlobalLogger().error(message, undefined, data),
  warn: (message: string, data?: Record<string, unknown>) => getGlobalLogger().warn(message, data),
  debug: (message: string, data?: Record<string, unknown>) => getGlobalLogger().debug(message, data),
};

export default ProductionLogger;
