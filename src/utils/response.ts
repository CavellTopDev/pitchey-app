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

// CORS headers - centralized
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/**
 * Success response wrapper
 */
export function successResponse<T>(
  data: T,
  message?: string,
  metadata?: StandardResponse["metadata"]
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
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

/**
 * Error response wrapper
 */
export function errorResponse(
  error: string,
  status = 400,
  details?: ErrorDetails
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
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

/**
 * Validation error response
 */
export function validationErrorResponse(
  field: string,
  message: string
): Response {
  return errorResponse("Validation failed", 422, {
    code: "VALIDATION_ERROR",
    field,
    details: message,
  });
}

/**
 * Authentication error response
 */
export function authErrorResponse(message = "Authentication required"): Response {
  return errorResponse(message, 401, {
    code: "AUTH_REQUIRED",
  });
}

/**
 * Authorization error response
 */
export function forbiddenResponse(message = "Access denied"): Response {
  return errorResponse(message, 403, {
    code: "ACCESS_DENIED",
  });
}

/**
 * Not found error response
 */
export function notFoundResponse(resource = "Resource"): Response {
  return errorResponse(`${resource} not found`, 404, {
    code: "NOT_FOUND",
  });
}

/**
 * Rate limit error response
 */
export function rateLimitResponse(
  retryAfter: number = 60,
  limit: number = 100
): Response {
  const response = errorResponse("Rate limit exceeded", 429, {
    code: "RATE_LIMIT_EXCEEDED",
    details: {
      retryAfter,
      limit,
    },
  });

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
  requestId?: string
): Response {
  console.error("Server Error:", message, requestId ? `[${requestId}]` : '');
  
  return errorResponse(message, 500, {
    code: "INTERNAL_ERROR",
    details: requestId ? { requestId } : undefined,
  });
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
  message?: string
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
  });
}

/**
 * Handle CORS preflight requests
 */
export function corsPreflightResponse(): Response {
  return new Response(null, { 
    status: 204,
    headers: corsHeaders 
  });
}

/**
 * Standardized JSON response helper (legacy compatibility)
 */
export function jsonResponse(data: any, status = 200): Response {
  // If data is already in standard format, use it directly
  if (data && typeof data === 'object' && 'success' in data) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  // Wrap legacy responses in standard format
  return successResponse(data);
}