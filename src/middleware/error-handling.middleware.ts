/**
 * Centralized Error Handling Middleware
 * Provides comprehensive error handling for all endpoints
 */

import { 
  errorResponse, 
  validationErrorResponse, 
  serverErrorResponse,
  setRequestOrigin 
} from "../utils/response.ts";
import { 
  parseAndValidateJson, 
  ValidationSchema,
  type RequestBody 
} from "./json-validation.middleware.ts";
import { handleDatabaseError } from "../utils/database-error-handler.ts";
import { createAuthErrorResponse } from "../utils/auth-error-handler.ts";
import { captureException } from "../services/sentry.service.ts";

export interface ErrorContext {
  endpoint: string;
  method: string;
  userId?: string;
  requestId?: string;
  userAgent?: string;
  origin?: string;
}

export interface HandlerResult {
  success: boolean;
  response?: Response;
  data?: any;
  error?: any;
}

/**
 * Request handler wrapper with comprehensive error handling
 */
export async function withErrorHandling<T = any>(
  handler: (request: Request, body?: RequestBody, context?: ErrorContext) => Promise<T | Response>,
  options?: {
    requireAuth?: boolean;
    requireJson?: boolean;
    validationSchema?: ValidationSchema;
    userType?: string;
    permissions?: string[];
  }
) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    
    // Set origin for CORS handling
    setRequestOrigin(origin);
    
    // Create error context for better debugging
    const context: ErrorContext = {
      endpoint: url.pathname,
      method: request.method,
      requestId: crypto.randomUUID(),
      userAgent: request.headers.get('user-agent') || '',
      origin: origin || undefined
    };

    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { 
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin || "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",
          }
        });
      }

      let body: RequestBody | undefined;
      let user: any;

      // Parse and validate JSON if required
      if (options?.requireJson || options?.validationSchema) {
        const jsonResult = await parseAndValidateJson(request, options.validationSchema);
        
        if (!jsonResult.success) {
          // Add request context to error logging
          console.warn(`JSON validation failed for ${context.method} ${context.endpoint}:`, {
            requestId: context.requestId,
            userAgent: context.userAgent
          });
          return jsonResult.response!;
        }
        
        body = jsonResult.data;
      }

      // Handle authentication if required
      if (options?.requireAuth) {
        try {
          const authResult = await authenticateRequest(request, context);
          
          if (!authResult.success) {
            return authResult.response!;
          }
          
          user = authResult.user;
          context.userId = user?.id || user?.userId;
          
          // Validate user type and permissions
          if (options.userType && user.userType !== options.userType) {
            console.warn(`Wrong user type for ${context.method} ${context.endpoint}:`, {
              requestId: context.requestId,
              expected: options.userType,
              actual: user.userType,
              userId: context.userId
            });
            
            return createAuthErrorResponse('WRONG_USER_TYPE', origin);
          }
          
          if (options.permissions) {
            const userPermissions = user.permissions || [];
            const hasRequiredPermissions = options.permissions.every(
              permission => userPermissions.includes(permission)
            );
            
            if (!hasRequiredPermissions) {
              console.warn(`Insufficient permissions for ${context.method} ${context.endpoint}:`, {
                requestId: context.requestId,
                required: options.permissions,
                user: userPermissions,
                userId: context.userId
              });
              
              return createAuthErrorResponse('INSUFFICIENT_PERMISSIONS', origin);
            }
          }
          
        } catch (authError) {
          console.error(`Auth error for ${context.method} ${context.endpoint}:`, {
            requestId: context.requestId,
            error: authError,
            userAgent: context.userAgent
          });
          
          return createAuthErrorResponse(authError, origin);
        }
      }

      // Add user to context for handler
      if (user) {
        (context as any).user = user;
      }

      // Execute the main handler
      const result = await handler(request, body, context);
      
      // If handler returns a Response, return it directly
      if (result instanceof Response) {
        return result;
      }
      
      // Otherwise, it's a success result, wrap it
      return new Response(JSON.stringify({
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: context.requestId
        }
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": origin || "*",
          "Access-Control-Allow-Credentials": "true"
        }
      });
      
    } catch (error) {
      return await handleUnexpectedError(error, context);
    }
  };
}

/**
 * Authenticate request and return user data
 */
async function authenticateRequest(
  request: Request,
  context: ErrorContext
): Promise<{ success: boolean; user?: any; response?: Response }> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return {
      success: false,
      response: createAuthErrorResponse('MISSING_TOKEN', context.origin)
    };
  }
  
  // Basic token format validation
  if (!authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      response: createAuthErrorResponse('INVALID_TOKEN_FORMAT', context.origin)
    };
  }
  
  const token = authHeader.substring(7);
  
  if (!token || token.trim() === '') {
    return {
      success: false,
      response: createAuthErrorResponse('MISSING_TOKEN', context.origin)
    };
  }
  
  try {
    // Import JWT verification (this would need to be imported from your JWT service)
    // For now, this is a placeholder that would integrate with your existing auth logic
    const user = await verifyJWTToken(token);
    
    if (!user) {
      return {
        success: false,
        response: createAuthErrorResponse('TOKEN_INVALID', context.origin)
      };
    }
    
    return { success: true, user };
    
  } catch (jwtError) {
    console.warn(`JWT verification failed for ${context.method} ${context.endpoint}:`, {
      requestId: context.requestId,
      error: jwtError.message
    });
    
    return {
      success: false,
      response: createAuthErrorResponse(jwtError, context.origin)
    };
  }
}

/**
 * Placeholder for JWT verification - replace with your actual implementation
 */
async function verifyJWTToken(token: string): Promise<any> {
  // This would integrate with your existing JWT verification logic
  throw new Error('JWT verification not implemented - replace with actual implementation');
}

/**
 * Handle unexpected errors with proper logging and sanitized responses
 */
async function handleUnexpectedError(error: any, context: ErrorContext): Promise<Response> {
  // Log the full error for debugging
  console.error(`Unexpected error in ${context.method} ${context.endpoint}:`, {
    requestId: context.requestId,
    error: error.stack || error.message || error,
    userId: context.userId,
    userAgent: context.userAgent
  });
  
  // Send to Sentry for error tracking
  try {
    captureException(error, {
      tags: {
        endpoint: context.endpoint,
        method: context.method
      },
      extra: {
        requestId: context.requestId,
        userId: context.userId,
        userAgent: context.userAgent
      }
    });
  } catch (sentryError) {
    console.error('Failed to send error to Sentry:', sentryError);
  }
  
  // Check if it's a database error
  if (isDatabaseError(error)) {
    return handleDatabaseError(error, context.origin);
  }
  
  // Check if it's an authentication error
  if (isAuthError(error)) {
    return createAuthErrorResponse(error, context.origin);
  }
  
  // Check if it's a validation error
  if (isValidationError(error)) {
    return validationErrorResponse(error.message || 'Validation failed', context.origin);
  }
  
  // Generic server error (don't expose internal details)
  return serverErrorResponse(
    'An unexpected error occurred', 
    context.requestId, 
    context.origin
  );
}

/**
 * Check if error is database-related
 */
function isDatabaseError(error: any): boolean {
  if (!error) return false;
  
  // Check for common database error indicators
  const errorStr = (error.message || error.toString()).toLowerCase();
  
  return (
    error.code || // PostgreSQL errors have codes
    errorStr.includes('database') ||
    errorStr.includes('constraint') ||
    errorStr.includes('foreign key') ||
    errorStr.includes('unique') ||
    errorStr.includes('not null') ||
    errorStr.includes('duplicate key') ||
    errorStr.includes('relation') ||
    errorStr.includes('column') ||
    errorStr.includes('table')
  );
}

/**
 * Check if error is authentication-related
 */
function isAuthError(error: any): boolean {
  if (!error) return false;
  
  const errorStr = (error.message || error.toString()).toLowerCase();
  
  return (
    errorStr.includes('jwt') ||
    errorStr.includes('token') ||
    errorStr.includes('unauthorized') ||
    errorStr.includes('authentication') ||
    errorStr.includes('invalid signature') ||
    errorStr.includes('expired')
  );
}

/**
 * Check if error is validation-related
 */
function isValidationError(error: any): boolean {
  if (!error) return false;
  
  const errorStr = (error.message || error.toString()).toLowerCase();
  
  return (
    errorStr.includes('validation') ||
    errorStr.includes('invalid') ||
    errorStr.includes('required') ||
    errorStr.includes('format') ||
    error.name === 'ValidationError'
  );
}

/**
 * Helper to create simple endpoint handlers with error handling
 */
export function createEndpointHandler(
  handler: (request: Request, body?: RequestBody, context?: ErrorContext) => Promise<any>,
  options?: {
    requireAuth?: boolean;
    requireJson?: boolean;
    validationSchema?: ValidationSchema;
    userType?: string;
    permissions?: string[];
  }
) {
  return withErrorHandling(handler, options);
}

/**
 * Database operation wrapper with error handling
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Database error in ${context?.endpoint || 'unknown'}:`, {
      requestId: context?.requestId,
      error: error.message || error
    });
    
    // Re-throw so the main error handler can process it
    throw error;
  }
}

export default {
  withErrorHandling,
  createEndpointHandler,
  withDatabaseErrorHandling
};