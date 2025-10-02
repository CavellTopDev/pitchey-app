/**
 * Standardized Response Utilities
 * Ensures consistent API response format across all endpoints
 */

export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface ErrorDetails {
  code?: string;
  field?: string;
  details?: any;
}

// CORS configuration - centralized
const ALLOWED_ORIGINS = [
  'https://pitchey.netlify.app',
  'https://pitchey.com',
  'http://localhost:5173',
  'http://localhost:3000'
];

// Global context to store the current request origin
let currentRequestOrigin: string | null = null;

/**
 * Set the current request origin for CORS handling
 * This should be called at the start of each request
 */
export function setRequestOrigin(origin: string | null) {
  currentRequestOrigin = origin;
}

/**
 * Get CORS headers for a specific origin
 */
export function getCorsHeaders(origin?: string): Record<string, string> {
  // Use provided origin, or fall back to current request origin, or default
  const requestOrigin = origin || currentRequestOrigin;
  const isAllowedOrigin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin);
  
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin ? requestOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

// Legacy CORS headers for backward compatibility
export const corsHeaders = getCorsHeaders();

/**
 * Success response wrapper
 */
export function successResponse<T>(
  data: T,
  message?: string,
  metadata?: StandardResponse["metadata"],
  origin?: string
): Response {
  const response: StandardResponse<T> = {
    success: true,
    data,
    message,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...getCorsHeaders(origin), "content-type": "application/json" },
  });
}

/**
 * Error response wrapper
 */
export function errorResponse(
  error: string,
  status = 400,
  details?: ErrorDetails,
  origin?: string
): Response {
  const response: StandardResponse = {
    success: false,
    error,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };

  if (details) {
    response.metadata!.details = details;
  }

  return new Response(JSON.stringify(response), {
    status,
    headers: { ...getCorsHeaders(origin), "content-type": "application/json" },
  });
}

/**
 * Validation error response
 */
export function validationErrorResponse(
  fieldOrMessage: string,
  message?: string,
  origin?: string
): Response {
  // If only one parameter is provided, treat it as a general validation message
  if (message === undefined) {
    return errorResponse(fieldOrMessage, 422, {
      code: "VALIDATION_ERROR",
    }, origin);
  }
  
  // If two parameters provided, treat first as field and second as message
  return errorResponse("Validation failed", 422, {
    code: "VALIDATION_ERROR",
    field: fieldOrMessage,
    details: message,
  }, origin);
}

/**
 * Authentication error response
 */
export function authErrorResponse(message = "Authentication required", origin?: string): Response {
  return errorResponse(message, 401, {
    code: "AUTH_REQUIRED",
  }, origin);
}

/**
 * Authorization error response
 */
export function forbiddenResponse(message = "Access denied", origin?: string): Response {
  return errorResponse(message, 403, {
    code: "ACCESS_DENIED",
  }, origin);
}

/**
 * Not found error response
 */
export function notFoundResponse(resource = "Resource", origin?: string): Response {
  return errorResponse(`${resource} not found`, 404, {
    code: "NOT_FOUND",
  }, origin);
}

/**
 * Rate limit error response
 */
export function rateLimitResponse(
  retryAfter: number = 60,
  limit: number = 100,
  origin?: string
): Response {
  const response = errorResponse("Rate limit exceeded", 429, {
    code: "RATE_LIMIT_EXCEEDED",
    details: {
      retryAfter,
      limit,
    },
  }, origin);

  // Add rate limit headers
  response.headers.set("X-RateLimit-Limit", limit.toString());
  response.headers.set("X-RateLimit-Remaining", "0");
  response.headers.set("X-RateLimit-Reset", new Date(Date.now() + retryAfter * 1000).toISOString());
  response.headers.set("Retry-After", retryAfter.toString());

  return response;
}

/**
 * Server error response
 */
export function serverErrorResponse(
  message = "Internal server error",
  requestId?: string,
  origin?: string
): Response {
  console.error("Server Error:", message, requestId ? `[${requestId}]` : '');
  
  return errorResponse(message, 500, {
    code: "INTERNAL_ERROR",
    details: requestId ? { requestId } : undefined,
  }, origin);
}

/**
 * Paginated response wrapper
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  message?: string,
  origin?: string
): Response {
  const { page, limit, total } = pagination;
  const hasNext = page * limit < total;
  const hasPrev = page > 1;

  return successResponse(data, message, {
    pagination: {
      page,
      limit,
      total,
      hasNext,
      hasPrev,
    },
  }, origin);
}

/**
 * Handle CORS preflight requests
 */
export function corsPreflightResponse(origin?: string): Response {
  return new Response(null, { 
    status: 204,
    headers: getCorsHeaders(origin)
  });
}

/**
 * Standardized JSON response helper (legacy compatibility)
 */
export function jsonResponse(data: any, status = 200, origin?: string): Response {
  // If data is already in standard format, use it directly
  if (data && typeof data === 'object' && 'success' in data) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...getCorsHeaders(origin), "content-type": "application/json" },
    });
  }

  // Wrap legacy responses in standard format
  return successResponse(data, undefined, undefined, origin);
}