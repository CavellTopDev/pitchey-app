/**
 * Error Serialization Utility
 * 
 * Safely extracts error information from various error types including
 * Drizzle ORM errors with circular references, preventing "Maximum call 
 * stack size exceeded" errors during console.error() calls.
 */

export interface SerializedError {
  message: string;
  name?: string;
  stack?: string;
  code?: string | number;
  sqlState?: string;
  constraint?: string;
  table?: string;
  column?: string;
  detail?: string;
  hint?: string;
  position?: string;
  where?: string;
  schema?: string;
  dataType?: string;
  file?: string;
  line?: string;
  routine?: string;
  severity?: string;
  type: 'standard' | 'database' | 'drizzle' | 'unknown';
  originalType?: string;
}

/**
 * Safely serializes any error object, extracting useful information
 * while avoiding circular references that can cause stack overflow errors.
 */
export function serializeError(error: unknown): SerializedError {
  // Handle null/undefined
  if (!error) {
    return {
      message: 'Unknown error occurred',
      type: 'unknown'
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      type: 'unknown'
    };
  }

  // Handle non-object errors
  if (typeof error !== 'object') {
    return {
      message: String(error),
      type: 'unknown'
    };
  }

  const errorObj = error as any;
  const serialized: SerializedError = {
    message: 'Unknown error occurred',
    type: 'unknown',
    originalType: errorObj.constructor?.name || typeof error
  };

  try {
    // Extract basic Error properties
    if (errorObj.message) {
      serialized.message = String(errorObj.message);
    }
    
    if (errorObj.name) {
      serialized.name = String(errorObj.name);
    }

    // Extract stack trace safely
    if (errorObj.stack && typeof errorObj.stack === 'string') {
      // Limit stack trace to prevent massive logs
      serialized.stack = errorObj.stack.split('\n').slice(0, 10).join('\n');
    }

    // Check if it's a standard Error instance
    if (error instanceof Error) {
      serialized.type = 'standard';
    }

    // Extract database/SQL error properties (common in PostgreSQL/Drizzle errors)
    if (errorObj.code) {
      serialized.code = String(errorObj.code);
      serialized.type = 'database';
    }

    // PostgreSQL specific error fields
    const pgFields = [
      'sqlState', 'constraint', 'table', 'column', 'detail', 
      'hint', 'position', 'where', 'schema', 'dataType',
      'file', 'line', 'routine', 'severity'
    ];

    for (const field of pgFields) {
      if (errorObj[field] && typeof errorObj[field] === 'string') {
        (serialized as any)[field] = errorObj[field];
        serialized.type = 'database';
      }
    }

    // Drizzle specific error detection
    if (errorObj.constructor?.name?.includes('Drizzle') || 
        errorObj.message?.includes('drizzle') ||
        errorObj.name?.includes('Drizzle')) {
      serialized.type = 'drizzle';
    }

    // Handle cause chain for nested errors
    if (errorObj.cause) {
      const causeInfo = serializeError(errorObj.cause);
      serialized.message += ` (Cause: ${causeInfo.message})`;
      
      // Inherit important properties from cause if not already set
      if (!serialized.code && causeInfo.code) {
        serialized.code = causeInfo.code;
      }
      if (!serialized.sqlState && causeInfo.sqlState) {
        serialized.sqlState = causeInfo.sqlState;
      }
    }

  } catch (extractionError) {
    // If extraction itself fails, provide a safe fallback
    serialized.message = 'Error occurred but could not be serialized safely';
    serialized.type = 'unknown';
  }

  return serialized;
}

/**
 * Safely logs an error with additional context, preventing circular reference issues.
 */
export function logError(error: unknown, context: string = '', additionalData?: Record<string, any>) {
  const serialized = serializeError(error);
  
  const logMessage = context 
    ? `${context}: ${serialized.message}` 
    : serialized.message;
  
  console.error(logMessage);
  
  // Log additional error details if available
  if (serialized.code) {
    console.error(`Error Code: ${serialized.code}`);
  }
  
  if (serialized.sqlState) {
    console.error(`SQL State: ${serialized.sqlState}`);
  }
  
  if (serialized.detail) {
    console.error(`Detail: ${serialized.detail}`);
  }
  
  if (serialized.stack) {
    console.error(`Stack: ${serialized.stack}`);
  }
  
  // Log additional context data safely
  if (additionalData) {
    try {
      console.error('Additional Data:', JSON.stringify(additionalData, null, 2));
    } catch {
      console.error('Additional Data: [Could not stringify]');
    }
  }
  
  console.error(`Error Type: ${serialized.type}`);
}

/**
 * Converts a serialized error to a safe response object for API responses.
 */
export function errorToResponse(error: unknown, fallbackMessage: string = 'An error occurred') {
  const serialized = serializeError(error);
  
  return {
    message: serialized.message || fallbackMessage,
    code: serialized.code,
    type: serialized.type,
    // Only include technical details in non-production environments
    ...(process.env.NODE_ENV !== 'production' && {
      detail: serialized.detail,
      sqlState: serialized.sqlState,
      originalType: serialized.originalType
    })
  };
}

/**
 * Quick helper to get just the error message safely.
 */
export function getErrorMessage(error: unknown): string {
  const serialized = serializeError(error);
  return serialized.message;
}