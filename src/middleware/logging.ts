/**
 * Logging Middleware for Cloudflare Workers
 *
 * Provides request/response logging, error tracking, and performance monitoring.
 */

import {
  ProductionLogger,
  createRequestLogger,
  generateRequestId,
  generateTraceId,
  generateSpanId,
  type LogContext,
} from '../lib/production-logger';
import * as Sentry from '@sentry/cloudflare';

// ============================================================================
// Types
// ============================================================================

export interface LoggingEnv {
  ENVIRONMENT?: string;
  SENTRY_DSN?: string;
  LOG_LEVEL?: string;
  LOG_SAMPLE_RATE?: string;
}

export interface RequestWithLogger extends Request {
  logger?: ProductionLogger;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  startTime?: number;
}

export interface LoggingContext {
  logger: ProductionLogger;
  requestId: string;
  traceId: string;
  spanId: string;
  startTime: number;
  endRequest: (response: Response) => Response;
}

// ============================================================================
// Logging Middleware
// ============================================================================

/**
 * Initialize logging context for a request
 */
export function initLogging(request: Request, env: LoggingEnv): LoggingContext {
  const startTime = Date.now();
  const url = new URL(request.url);

  // Parse trace context from incoming headers
  const traceParent = request.headers.get('traceparent');
  let traceId: string;
  let parentSpanId: string | undefined;

  if (traceParent) {
    const parts = traceParent.split('-');
    if (parts.length >= 3) {
      traceId = parts[1];
      parentSpanId = parts[2];
    } else {
      traceId = generateTraceId();
    }
  } else {
    traceId = generateTraceId();
  }

  const requestId = request.headers.get('x-request-id') || generateRequestId();
  const spanId = generateSpanId();

  // Create logger with full context
  const logger = createRequestLogger({
    request,
    env,
  });

  // Set additional context
  logger.setContext({
    requestId,
    traceId,
    spanId,
    parentSpanId,
    method: request.method,
    path: url.pathname,
  });

  // Log request start (skip health checks for noise reduction)
  if (!isHealthCheck(url.pathname)) {
    logger.info('Request started', {
      query: url.search || undefined,
      headers: sanitizeHeaders(request.headers),
    });
  }

  // Set Sentry context
  if (env.SENTRY_DSN) {
    Sentry.setTag('request_id', requestId);
    Sentry.setTag('trace_id', traceId);
    Sentry.setContext('request', {
      method: request.method,
      url: url.pathname,
      query: url.search,
    });
  }

  return {
    logger,
    requestId,
    traceId,
    spanId,
    startTime,
    endRequest: (response: Response) => endLogging(response, logger, startTime, url.pathname),
  };
}

/**
 * Finalize logging for a request
 */
function endLogging(
  response: Response,
  logger: ProductionLogger,
  startTime: number,
  path: string
): Response {
  const duration = Date.now() - startTime;
  const context = logger.getContext();

  // Skip logging for health checks unless there's an error
  if (isHealthCheck(path) && response.status < 400) {
    return addTraceHeaders(response, context);
  }

  // Determine log level based on status
  if (response.status >= 500) {
    logger.error('Request failed', undefined, {
      statusCode: response.status,
      duration,
    });
  } else if (response.status >= 400) {
    // 401/403/404 are expected client errors — log as info, not warn
    const isExpectedClientError = [401, 403, 404].includes(response.status);
    if (isExpectedClientError) {
      logger.info('Request completed', {
        statusCode: response.status,
        duration,
      });
    } else {
      logger.warn('Request error', {
        statusCode: response.status,
        duration,
      });
    }
  } else {
    logger.info('Request completed', {
      statusCode: response.status,
      duration,
    });
  }

  return addTraceHeaders(response, context);
}

/**
 * Add trace headers to response
 */
function addTraceHeaders(response: Response, context: LogContext): Response {
  // CRITICAL: WebSocket responses (status 101) must be returned as-is
  // Creating a new Response loses the webSocket property
  if (response.status === 101 || (response as any).webSocket) {
    console.log('[Logging] Returning WebSocket response unmodified');
    return response;
  }

  const headers = new Headers(response.headers);

  if (context.requestId) {
    headers.set('x-request-id', context.requestId);
  }
  if (context.traceId) {
    headers.set('x-trace-id', context.traceId);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ============================================================================
// Error Logging
// ============================================================================

/**
 * Log an error with full context
 */
export function logError(
  logger: ProductionLogger,
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);

  logger.error(`Error: ${errorMessage}`, error, {
    ...context,
    errorType: error instanceof Error ? error.name : 'Unknown',
  });
}

/**
 * Create error response with logging
 */
export function loggedErrorResponse(
  logger: ProductionLogger,
  error: Error | unknown,
  statusCode: number = 500,
  message?: string
): Response {
  logError(logger, error);

  const errorMessage = message || (error instanceof Error ? error.message : 'Internal server error');
  const context = logger.getContext();

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        message: errorMessage,
        code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      },
      meta: {
        requestId: context.requestId,
        traceId: context.traceId,
      },
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': context.requestId || '',
        'x-trace-id': context.traceId || '',
      },
    }
  );
}

// ============================================================================
// Performance Logging
// ============================================================================

/**
 * Create a performance timer
 */
export function createTimer(logger: ProductionLogger, name: string): () => void {
  const start = Date.now();

  return () => {
    const duration = Date.now() - start;
    logger.debug(`Performance: ${name}`, {
      timerName: name,
      duration,
      slow: duration > 1000,
    });
  };
}

/**
 * Log a slow operation
 */
export function logSlowOperation(
  logger: ProductionLogger,
  operation: string,
  duration: number,
  threshold: number = 1000
): void {
  if (duration > threshold) {
    logger.warn(`Slow operation: ${operation}`, {
      operation,
      duration,
      threshold,
      exceededBy: duration - threshold,
    });
  }
}

// ============================================================================
// Database Query Logging
// ============================================================================

/**
 * Log a database query with timing
 */
export function logDatabaseQuery(
  logger: ProductionLogger,
  query: string,
  params: unknown[],
  duration: number,
  rowCount?: number
): void {
  // Sanitize query for logging (truncate long queries)
  const sanitizedQuery = query.length > 500 ? query.substring(0, 500) + '...' : query;

  // Sanitize params (hide sensitive values, truncate long strings)
  const sanitizedParams = params.map((p, i) => {
    if (p === null || p === undefined) return p;
    if (typeof p === 'string') {
      if (p.length > 100) return `$${i + 1}:[${p.length}chars]`;
      // Check for potentially sensitive data
      if (looksLikeSensitive(p)) return `$${i + 1}:[REDACTED]`;
    }
    return p;
  });

  const level = duration > 1000 ? 'warn' : 'debug';

  if (level === 'warn') {
    logger.warn('Slow database query', {
      query: sanitizedQuery,
      params: sanitizedParams,
      duration,
      rowCount,
    });
  } else {
    logger.debug('Database query', {
      query: sanitizedQuery,
      duration,
      rowCount,
    });
  }
}

// ============================================================================
// External API Call Logging
// ============================================================================

/**
 * Log an external API call
 */
export function logExternalCall(
  logger: ProductionLogger,
  service: string,
  method: string,
  url: string,
  duration: number,
  statusCode?: number,
  error?: Error
): void {
  // Sanitize URL (remove tokens/keys from query strings)
  const sanitizedUrl = sanitizeUrl(url);

  if (error) {
    logger.error(`External API error: ${service}`, error, {
      service,
      method,
      url: sanitizedUrl,
      duration,
      statusCode,
    });
  } else if (statusCode && statusCode >= 400) {
    logger.warn(`External API failure: ${service}`, {
      service,
      method,
      url: sanitizedUrl,
      duration,
      statusCode,
    });
  } else {
    logger.debug(`External API call: ${service}`, {
      service,
      method,
      url: sanitizedUrl,
      duration,
      statusCode,
    });
  }
}

// ============================================================================
// Authentication Logging
// ============================================================================

/**
 * Log authentication events
 */
export function logAuthEvent(
  logger: ProductionLogger,
  event: 'login' | 'logout' | 'signup' | 'password_reset' | 'session_refresh' | 'failed_login',
  userId?: string,
  details?: Record<string, unknown>
): void {
  const level = event === 'failed_login' ? 'warn' : 'info';

  if (level === 'warn') {
    logger.warn(`Auth event: ${event}`, {
      authEvent: event,
      userId: userId || 'anonymous',
      ...details,
    });
  } else {
    logger.info(`Auth event: ${event}`, {
      authEvent: event,
      userId: userId || 'anonymous',
      ...details,
    });
  }

  // Set user context in Sentry
  if (userId) {
    Sentry.setUser({ id: userId });
  }
}

// ============================================================================
// WebSocket Logging
// ============================================================================

/**
 * Log WebSocket events
 */
export function logWebSocketEvent(
  logger: ProductionLogger,
  event: 'connect' | 'disconnect' | 'message' | 'error',
  connectionId: string,
  details?: Record<string, unknown>
): void {
  if (event === 'error') {
    logger.error('WebSocket error', undefined, {
      wsEvent: event,
      connectionId,
      ...details,
    });
  } else {
    logger.debug(`WebSocket: ${event}`, {
      wsEvent: event,
      connectionId,
      ...details,
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if path is a health check endpoint
 */
function isHealthCheck(path: string): boolean {
  const healthPaths = ['/health', '/healthz', '/ready', '/live', '/api/health', '/_health'];
  return healthPaths.some(hp => path === hp || path.startsWith(hp + '/'));
}

/**
 * Sanitize headers for logging
 */
function sanitizeHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveHeaders = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
  ]);

  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (sensitiveHeaders.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

/**
 * Sanitize URL by removing sensitive query parameters
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth', 'api_key', 'apikey'];

    sensitiveParams.forEach(param => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    });

    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Check if a string looks like sensitive data
 */
function looksLikeSensitive(value: string): boolean {
  // Check for patterns that look like tokens, keys, or passwords
  const sensitivePatterns = [
    /^[a-f0-9]{32,}$/i,  // Hex tokens
    /^[a-z0-9+/]{40,}={0,2}$/i,  // Base64 tokens
    /^sk_[a-z]+_[a-zA-Z0-9]+$/,  // Stripe-style keys
    /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,  // JWTs
  ];

  return sensitivePatterns.some(pattern => pattern.test(value));
}

export default {
  initLogging,
  logError,
  loggedErrorResponse,
  createTimer,
  logSlowOperation,
  logDatabaseQuery,
  logExternalCall,
  logAuthEvent,
  logWebSocketEvent,
};
