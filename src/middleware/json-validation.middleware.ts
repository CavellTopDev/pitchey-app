/**
 * JSON Validation Middleware
 * Provides comprehensive JSON parsing and validation with user-friendly error messages
 */

import { badRequestResponse, validationErrorResponse, serverErrorResponse } from "../utils/response.ts";

export interface RequestBody {
  [key: string]: any;
}

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => string | null; // Return error message or null if valid
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface JsonValidationResult {
  success: boolean;
  data?: RequestBody;
  errors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

/**
 * Safe JSON parsing with detailed error handling
 */
export async function safeJsonParse(request: Request): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    // Check if request has content
    const contentLength = request.headers.get('content-length');
    const contentType = request.headers.get('content-type');
    
    // Check for missing content-type
    if (!contentType || !contentType.includes('application/json')) {
      return {
        success: false,
        error: "Request must have Content-Type: application/json"
      };
    }

    // Check for empty body
    if (contentLength === '0') {
      return {
        success: false,
        error: "Request body cannot be empty"
      };
    }

    // Get the raw text first to provide better error messages
    const text = await request.text();
    
    if (!text.trim()) {
      return {
        success: false,
        error: "Request body cannot be empty"
      };
    }

    // Attempt to parse JSON
    const data = JSON.parse(text);
    
    return {
      success: true,
      data
    };
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Provide specific JSON syntax error messages
      let errorMessage = "Invalid JSON format";
      const errorStr = error.message.toLowerCase();
      
      if (errorStr.includes('unexpected token')) {
        errorMessage = "Invalid JSON syntax: unexpected character found";
      } else if (errorStr.includes('unexpected end')) {
        errorMessage = "Invalid JSON syntax: incomplete JSON data";
      } else if (errorStr.includes('string')) {
        errorMessage = "Invalid JSON syntax: malformed string value";
      } else if (errorStr.includes('number')) {
        errorMessage = "Invalid JSON syntax: malformed number value";
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
    
    return {
      success: false,
      error: "Failed to process request body"
    };
  }
}

/**
 * Validate request body against schema
 */
export function validateRequestBody(data: any, schema: ValidationSchema): JsonValidationResult {
  const errors: Array<{ field: string; message: string; value?: any }> = [];
  
  // Ensure data is an object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      success: false,
      errors: [{ field: 'body', message: 'Request body must be a JSON object' }]
    };
  }

  // Validate each field in schema
  for (const [fieldName, rules] of Object.entries(schema)) {
    const value = data[fieldName];
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' is required`,
        value: value
      });
      continue;
    }
    
    // Skip validation for optional missing fields
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }
    
    // Type validation
    if (rules.type) {
      const expectedType = rules.type;
      let actualType = typeof value;
      
      if (expectedType === 'array' && Array.isArray(value)) {
        actualType = 'array';
      }
      
      if (actualType !== expectedType) {
        errors.push({
          field: fieldName,
          message: `Field '${fieldName}' must be of type ${expectedType}, got ${actualType}`,
          value: value
        });
        continue;
      }
    }
    
    // String-specific validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          field: fieldName,
          message: `Field '${fieldName}' must be at least ${rules.minLength} characters long`,
          value: value
        });
      }
      
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          field: fieldName,
          message: `Field '${fieldName}' must be no more than ${rules.maxLength} characters long`,
          value: value
        });
      }
      
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({
          field: fieldName,
          message: `Field '${fieldName}' has invalid format`,
          value: value
        });
      }
    }
    
    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field: fieldName,
        message: `Field '${fieldName}' must be one of: ${rules.enum.join(', ')}`,
        value: value
      });
    }
    
    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        errors.push({
          field: fieldName,
          message: customError,
          value: value
        });
      }
    }
  }
  
  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }
  
  return {
    success: true,
    data
  };
}

/**
 * Middleware function to parse and validate JSON requests
 */
export async function parseAndValidateJson(
  request: Request,
  schema?: ValidationSchema
): Promise<{
  success: boolean;
  data?: RequestBody;
  response?: Response;
}> {
  // Parse JSON with detailed error handling
  const parseResult = await safeJsonParse(request);
  
  if (!parseResult.success) {
    return {
      success: false,
      response: badRequestResponse(parseResult.error!)
    };
  }
  
  // If no schema provided, return parsed data
  if (!schema) {
    return {
      success: true,
      data: parseResult.data
    };
  }
  
  // Validate against schema
  const validationResult = validateRequestBody(parseResult.data, schema);
  
  if (!validationResult.success) {
    const firstError = validationResult.errors![0];
    return {
      success: false,
      response: validationErrorResponse(firstError.field, firstError.message)
    };
  }
  
  return {
    success: true,
    data: validationResult.data
  };
}

/**
 * Common validation schemas for different endpoints
 */
export const ValidationSchemas = {
  // Authentication schemas
  login: {
    email: {
      required: true,
      type: 'string' as const,
      minLength: 3,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      custom: (email: string) => {
        if (!email.includes('@')) return 'Email must contain @ symbol';
        if (email.length > 254) return 'Email address is too long';
        return null;
      }
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 6,
      maxLength: 128
    }
  },
  
  register: {
    email: {
      required: true,
      type: 'string' as const,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    password: {
      required: true,
      type: 'string' as const,
      minLength: 8,
      custom: (password: string) => {
        if (!/(?=.*[a-z])/.test(password)) {
          return 'Password must contain at least one lowercase letter';
        }
        if (!/(?=.*[A-Z])/.test(password)) {
          return 'Password must contain at least one uppercase letter';
        }
        if (!/(?=.*\d)/.test(password)) {
          return 'Password must contain at least one number';
        }
        return null;
      }
    },
    username: {
      required: true,
      type: 'string' as const,
      minLength: 3,
      maxLength: 30,
      pattern: /^[a-zA-Z0-9_-]+$/
    },
    userType: {
      required: true,
      type: 'string' as const,
      enum: ['creator', 'investor', 'production']
    },
    companyName: {
      required: false,
      type: 'string' as const,
      maxLength: 100
    }
  },
  
  // Pitch schemas
  createPitch: {
    title: {
      required: true,
      type: 'string' as const,
      minLength: 3,
      maxLength: 200
    },
    description: {
      required: true,
      type: 'string' as const,
      minLength: 50,
      maxLength: 5000
    },
    budget: {
      required: true,
      type: 'number' as const,
      custom: (value: number) => {
        if (value < 0) return 'Budget must be a positive number';
        if (value > 1000000000) return 'Budget exceeds maximum allowed amount';
        return null;
      }
    },
    genre: {
      required: true,
      type: 'string' as const,
      enum: ['action', 'comedy', 'drama', 'horror', 'thriller', 'sci-fi', 'romance', 'documentary', 'other']
    }
  },
  
  // Message schemas
  sendMessage: {
    receiverId: {
      required: true,
      type: 'string' as const,
      minLength: 1
    },
    content: {
      required: true,
      type: 'string' as const,
      minLength: 1,
      maxLength: 2000
    },
    type: {
      required: false,
      type: 'string' as const,
      enum: ['text', 'system', 'file']
    }
  }
};