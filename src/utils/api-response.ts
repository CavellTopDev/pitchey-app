/**
 * Standardized API Response Utilities
 * Ensures consistent response format across all endpoints
 */

import { getCorsHeaders } from './response';

/**
 * Standard API Response Format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

/**
 * Error codes for standardized error handling
 */
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_FIELD = 'MISSING_FIELD',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // File operations
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  
  // Business logic
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED'
}

/**
 * HTTP Status codes mapping
 */
const ErrorStatusMap: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_FIELD]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.UPLOAD_ERROR]: 400,
  [ErrorCode.FILE_NOT_FOUND]: 404,
  [ErrorCode.FILE_TOO_LARGE]: 413,
  [ErrorCode.INVALID_FILE_TYPE]: 415,
  [ErrorCode.INSUFFICIENT_FUNDS]: 402,
  [ErrorCode.QUOTA_EXCEEDED]: 403,
  [ErrorCode.OPERATION_NOT_ALLOWED]: 403
};

/**
 * API Response Builder Class
 */
export class ApiResponseBuilder {
  private origin?: string;
  private requestId?: string;

  constructor(request?: Request) {
    this.origin = request?.headers.get('Origin') || undefined;
    this.requestId = request?.headers.get('X-Request-Id') || crypto.randomUUID();
  }

  /**
   * Create success response
   */
  success<T>(data: T, meta?: Partial<ApiResponse['meta']>): Response {
    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.requestId,
        ...meta
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...getCorsHeaders(this.origin),
        'Content-Type': 'application/json',
        'X-Request-Id': this.requestId || ''
      }
    });
  }

  /**
   * Create error response
   */
  error(
    code: ErrorCode,
    message: string,
    details?: any,
    statusOverride?: number
  ): Response {
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.requestId
      }
    };

    const status = statusOverride || ErrorStatusMap[code] || 500;

    return new Response(JSON.stringify(response), {
      status,
      headers: {
        ...getCorsHeaders(this.origin),
        'Content-Type': 'application/json',
        'X-Request-Id': this.requestId || ''
      }
    });
  }

  /**
   * Create paginated response
   */
  paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): Response {
    const hasMore = page * limit < total;
    
    const response: ApiResponse<T[]> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.requestId,
        pagination: {
          page,
          limit,
          total,
          hasMore
        }
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...getCorsHeaders(this.origin),
        'Content-Type': 'application/json',
        'X-Request-Id': this.requestId || '',
        'X-Total-Count': total.toString(),
        'X-Page': page.toString(),
        'X-Limit': limit.toString()
      }
    });
  }

  /**
   * Create no content response (204)
   */
  noContent(): Response {
    return new Response(null, {
      status: 204,
      headers: {
        ...getCorsHeaders(this.origin),
        'X-Request-Id': this.requestId || ''
      }
    });
  }

  /**
   * Create redirect response
   */
  redirect(url: string, permanent = false): Response {
    return new Response(null, {
      status: permanent ? 301 : 302,
      headers: {
        ...getCorsHeaders(this.origin),
        'Location': url,
        'X-Request-Id': this.requestId || ''
      }
    });
  }
}

/**
 * Response adapter for legacy frontend compatibility
 * Transforms standardized responses to match frontend expectations
 */
export class LegacyResponseAdapter {
  /**
   * Transform response for pitch service compatibility
   */
  static transformPitchResponse(standardResponse: ApiResponse): any {
    if (!standardResponse.success) {
      return standardResponse;
    }

    // Handle array of pitches
    if (Array.isArray(standardResponse.data)) {
      return {
        success: true,
        data: {
          data: {
            pitches: standardResponse.data
          }
        }
      };
    }

    // Handle single pitch
    if (standardResponse.data && typeof standardResponse.data === 'object') {
      // Check if it's already wrapped
      if ('pitch' in standardResponse.data || 'pitches' in standardResponse.data) {
        return {
          success: true,
          data: standardResponse.data
        };
      }

      // Wrap single pitch
      return {
        success: true,
        data: {
          pitch: standardResponse.data
        }
      };
    }

    return standardResponse;
  }

  /**
   * Transform response for user service compatibility
   */
  static transformUserResponse(standardResponse: ApiResponse): any {
    if (!standardResponse.success) {
      return standardResponse;
    }

    // Handle user with token (login/register responses)
    if (standardResponse.data?.token) {
      return {
        success: true,
        data: standardResponse.data
      };
    }

    // Handle user profile responses
    if (standardResponse.data?.user) {
      return {
        success: true,
        data: standardResponse.data
      };
    }

    return standardResponse;
  }

  /**
   * Apply transformation based on endpoint pattern
   */
  static transform(endpoint: string, standardResponse: ApiResponse): any {
    // Pitch endpoints
    if (endpoint.includes('/pitch') || endpoint.includes('/browse')) {
      return this.transformPitchResponse(standardResponse);
    }

    // User endpoints
    if (endpoint.includes('/user') || endpoint.includes('/auth')) {
      return this.transformUserResponse(standardResponse);
    }

    // Default: return as-is
    return standardResponse;
  }
}

/**
 * Validation helpers
 */
export class ValidationHelpers {
  /**
   * Validate required fields
   */
  static validateRequired(
    data: any,
    fields: string[]
  ): { valid: boolean; missing: string[] } {
    const missing = fields.filter(field => !data[field]);
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate phone number
   */
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s-()]/g, ''));
  }

  /**
   * Sanitize input string
   */
  static sanitize(input: string): string {
    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '');
  }
}

/**
 * Error handler middleware
 */
export async function errorHandler(
  error: any,
  request: Request
): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  
  // Log error for monitoring
  console.error('API Error:', {
    error: error.message || error,
    stack: error.stack,
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString()
  });

  // Database errors
  if (error.code === '23505') {
    return builder.error(
      ErrorCode.ALREADY_EXISTS,
      'Resource already exists',
      { field: error.detail }
    );
  }

  if (error.code === '23503') {
    return builder.error(
      ErrorCode.VALIDATION_ERROR,
      'Referenced resource not found',
      { field: error.detail }
    );
  }

  // Network errors
  if (error.name === 'NetworkError' || error.code === 'ECONNREFUSED') {
    return builder.error(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Service temporarily unavailable'
    );
  }

  // Default error
  return builder.error(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    process.env.NODE_ENV === 'development' ? error.message : undefined
  );
}

/**
 * Request ID middleware
 */
export function addRequestId(request: Request): Request {
  const requestId = request.headers.get('X-Request-Id') || crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set('X-Request-Id', requestId);
  
  return new Request(request, { headers });
}

// Export convenience functions
export function createResponse(request?: Request): ApiResponseBuilder {
  return new ApiResponseBuilder(request);
}

export function successResponse<T>(data: T, request?: Request): Response {
  return new ApiResponseBuilder(request).success(data);
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  request?: Request,
  details?: any
): Response {
  return new ApiResponseBuilder(request).error(code, message, details);
}