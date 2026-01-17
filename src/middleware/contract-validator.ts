/**
 * Contract Validation Middleware for Cloudflare Workers
 * Ensures all API requests/responses match the defined contracts
 */

import { z } from 'zod';
import * as Sentry from '@sentry/cloudflare';
import { getCorsHeaders } from '../utils/response';
import type { 
  ApiResponseSchema,
  validateRequest 
} from '../shared/contracts';

export interface ValidationOptions {
  logErrors?: boolean;
  strictMode?: boolean;
  sanitizeErrors?: boolean;
}

/**
 * Middleware to validate request body against a Zod schema
 */
export function validateRequestBody<T>(
  schema: z.ZodType<T>,
  options: ValidationOptions = {}
) {
  return async (request: Request): Promise<{ valid: true; data: T } | { valid: false; response: Response }> => {
    try {
      const body = await request.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        const errors = options.sanitizeErrors 
          ? sanitizeZodErrors(result.error)
          : result.error.format();

        if (options.logErrors) {
          Sentry.captureException(new Error('Request validation failed'), {
            tags: {
              component: 'contract-validator',
              endpoint: new URL(request.url).pathname
            },
            extra: { errors, body }
          });
        }

        return {
          valid: false,
          response: new Response(JSON.stringify({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: errors
            }
          }), {
            status: 422,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(request.headers.get('Origin'))
            }
          })
        };
      }

      return { valid: true, data: result.data };
    } catch (error) {
      return {
        valid: false,
        response: new Response(JSON.stringify({
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: 'Invalid JSON in request body'
          }
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request.headers.get('Origin'))
          }
        })
      };
    }
  };
}

/**
 * Middleware to validate query parameters against a Zod schema
 */
export function validateQueryParams<T>(
  schema: z.ZodType<T>,
  options: ValidationOptions = {}
) {
  return (request: Request): { valid: true; data: T } | { valid: false; response: Response } => {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    
    // Convert string numbers to actual numbers for numeric fields
    const processedParams = processQueryParams(params, schema);
    const result = schema.safeParse(processedParams);

    if (!result.success) {
      const errors = options.sanitizeErrors 
        ? sanitizeZodErrors(result.error)
        : result.error.format();

      return {
        valid: false,
        response: new Response(JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: errors
          }
        }), {
          status: 422,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(request.headers.get('Origin'))
          }
        })
      };
    }

    return { valid: true, data: result.data };
  };
}

/**
 * Validate response data before sending
 */
export function validateResponse<T>(
  schema: z.ZodType<T>,
  data: T,
  options: ValidationOptions = {}
): T {
  const result = schema.safeParse(data);

  if (!result.success && options.strictMode) {
    Sentry.captureException(new Error('Response validation failed'), {
      tags: {
        component: 'contract-validator',
        type: 'response-validation'
      },
      extra: {
        errors: result.error.format(),
        data
      }
    });

    if (options.strictMode) {
      throw new Error('Response validation failed');
    }
  }

  return result.success ? result.data : data;
}

/**
 * Create a validated API handler
 */
export function createValidatedHandler<TBody = any, TQuery = any, TResponse = any>(
  config: {
    bodySchema?: z.ZodType<TBody>;
    querySchema?: z.ZodType<TQuery>;
    responseSchema?: z.ZodType<TResponse>;
    handler: (params: {
      body?: TBody;
      query?: TQuery;
      request: Request;
      env: any;
    }) => Promise<TResponse>;
    options?: ValidationOptions;
  }
) {
  return async (request: Request, env: any): Promise<Response> => {
    try {
      let body: TBody | undefined;
      let query: TQuery | undefined;

      // Validate body if schema provided
      if (config.bodySchema) {
        const bodyValidation = await validateRequestBody(config.bodySchema, config.options)(request);
        if (!bodyValidation.valid) return bodyValidation.response;
        body = bodyValidation.data;
      }

      // Validate query if schema provided
      if (config.querySchema) {
        const queryValidation = validateQueryParams(config.querySchema, config.options)(request);
        if (!queryValidation.valid) return queryValidation.response;
        query = queryValidation.data;
      }

      // Execute handler
      const response = await config.handler({ body, query, request, env });

      // Validate response if schema provided
      const validatedResponse = config.responseSchema
        ? validateResponse(config.responseSchema, response, config.options)
        : response;

      return new Response(JSON.stringify({
        success: true,
        data: validatedResponse
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin'))
        }
      });

    } catch (error) {
      Sentry.captureException(error);

      const message = error instanceof Error ? error.message : 'Internal server error';
      
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin'))
        }
      });
    }
  };
}

/**
 * Sanitize Zod errors for public consumption
 */
function sanitizeZodErrors(error: z.ZodError): Record<string, string[]> {
  const sanitized: Record<string, string[]> = {};
  
  error.issues.forEach(issue => {
    const path = issue.path.join('.');
    if (!sanitized[path]) {
      sanitized[path] = [];
    }
    sanitized[path].push(issue.message);
  });

  return sanitized;
}

/**
 * Process query parameters to match expected types
 */
function processQueryParams(params: Record<string, string>, schema: any): Record<string, any> {
  const processed: Record<string, any> = {};

  for (const [key, value] of Object.entries(params)) {
    // Try to parse as number if it looks like one
    if (/^\d+$/.test(value)) {
      processed[key] = parseInt(value, 10);
    } else if (/^\d+\.\d+$/.test(value)) {
      processed[key] = parseFloat(value);
    } else if (value === 'true') {
      processed[key] = true;
    } else if (value === 'false') {
      processed[key] = false;
    } else if (value.includes(',')) {
      // Handle comma-separated arrays
      processed[key] = value.split(',').map(v => v.trim());
    } else {
      processed[key] = value;
    }
  }

  return processed;
}

/**
 * Type-safe route handler builder
 */
export class ValidatedRoute {
  static get<TQuery = any, TResponse = any>(
    path: string,
    config: {
      querySchema?: z.ZodType<TQuery>;
      responseSchema?: z.ZodType<TResponse>;
      handler: (params: { query?: TQuery; request: Request; env: any }) => Promise<TResponse>;
    }
  ) {
    return {
      method: 'GET' as const,
      path,
      handler: createValidatedHandler({
        querySchema: config.querySchema,
        responseSchema: config.responseSchema,
        handler: config.handler
      })
    };
  }

  static post<TBody = any, TQuery = any, TResponse = any>(
    path: string,
    config: {
      bodySchema?: z.ZodType<TBody>;
      querySchema?: z.ZodType<TQuery>;
      responseSchema?: z.ZodType<TResponse>;
      handler: (params: { 
        body?: TBody; 
        query?: TQuery; 
        request: Request; 
        env: any 
      }) => Promise<TResponse>;
    }
  ) {
    return {
      method: 'POST' as const,
      path,
      handler: createValidatedHandler(config)
    };
  }

  static put<TBody = any, TQuery = any, TResponse = any>(
    path: string,
    config: {
      bodySchema?: z.ZodType<TBody>;
      querySchema?: z.ZodType<TQuery>;
      responseSchema?: z.ZodType<TResponse>;
      handler: (params: { 
        body?: TBody; 
        query?: TQuery; 
        request: Request; 
        env: any 
      }) => Promise<TResponse>;
    }
  ) {
    return {
      method: 'PUT' as const,
      path,
      handler: createValidatedHandler(config)
    };
  }

  static delete<TQuery = any, TResponse = any>(
    path: string,
    config: {
      querySchema?: z.ZodType<TQuery>;
      responseSchema?: z.ZodType<TResponse>;
      handler: (params: { query?: TQuery; request: Request; env: any }) => Promise<TResponse>;
    }
  ) {
    return {
      method: 'DELETE' as const,
      path,
      handler: createValidatedHandler({
        querySchema: config.querySchema,
        responseSchema: config.responseSchema,
        handler: config.handler
      })
    };
  }
}