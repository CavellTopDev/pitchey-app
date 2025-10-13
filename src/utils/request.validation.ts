/**
 * Request Validation Utilities
 * Provides safe JSON parsing and request validation with proper error handling
 */

import { badRequestResponse, validationErrorResponse } from "./response.ts";

export interface ParseJsonResult<T = any> {
  success: boolean;
  data?: T;
  error?: Response;
}

/**
 * Safely parse JSON from a request body
 * Returns proper 400 Bad Request response for malformed JSON
 */
export async function safeParseJson<T = any>(request: Request): Promise<ParseJsonResult<T>> {
  try {
    // Check if content-type is JSON - client error, should be 400
    const contentType = request.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      return {
        success: false,
        error: badRequestResponse("Content-Type must be application/json")
      };
    }

    // Check if request has a body - client error, should be 400
    if (!request.body) {
      return {
        success: false,
        error: badRequestResponse("Request body is required")
      };
    }

    const data = await request.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    // JSON parsing errors - client syntax error, should be 400
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: badRequestResponse("Invalid JSON format in request body")
      };
    }

    // Other errors (likely network/stream related)
    return {
      success: false,
      error: validationErrorResponse("Failed to read request body")
    };
  }
}

/**
 * Validate that required fields are present in the request body
 */
export function validateRequiredFields(
  data: any,
  requiredFields: string[]
): { isValid: boolean; error?: Response } {
  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      error: validationErrorResponse("Request body must be a valid JSON object")
    };
  }

  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    return {
      isValid: false,
      error: validationErrorResponse(`Missing required fields: ${missingFields.join(', ')}`)
    };
  }

  return { isValid: true };
}

/**
 * Comprehensive request validation for POST/PUT endpoints
 */
export async function validateJsonRequest<T = any>(
  request: Request,
  requiredFields: string[] = []
): Promise<{ success: boolean; data?: T; error?: Response }> {
  const parseResult = await safeParseJson<T>(request);
  
  if (!parseResult.success) {
    return parseResult;
  }

  if (requiredFields.length > 0) {
    const validationResult = validateRequiredFields(parseResult.data, requiredFields);
    if (!validationResult.isValid) {
      return {
        success: false,
        error: validationResult.error
      };
    }
  }

  return {
    success: true,
    data: parseResult.data
  };
}

/**
 * Custom error class for client-side errors that should return 400
 */
export class ClientError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ClientError';
  }
}

/**
 * Custom error class for database/server errors that should return 500
 */
export class ServerError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'ServerError';
  }
}

/**
 * Determine if an error is a client error (400) or server error (500)
 */
export function isClientError(error: any): boolean {
  // Explicit client errors
  if (error instanceof ClientError) {
    return true;
  }

  // JSON parsing errors
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return true;
  }

  // Validation errors
  if (error.name === 'ValidationError' || error.message.includes('validation')) {
    return true;
  }

  // HTTP errors with 4xx status codes
  if (error.status && error.status >= 400 && error.status < 500) {
    return true;
  }

  // Common client error patterns
  const clientErrorPatterns = [
    'invalid',
    'malformed',
    'required',
    'missing',
    'unauthorized',
    'forbidden',
    'not found',
    'conflict',
    'too large',
    'unsupported media type'
  ];

  const errorMessage = error.message?.toLowerCase() || '';
  return clientErrorPatterns.some(pattern => errorMessage.includes(pattern));
}