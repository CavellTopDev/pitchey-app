/**
 * Input Validation and Sanitization Middleware
 * Prevents injection attacks and validates all user input
 * OWASP Input Validation Cheat Sheet compliant
 */

import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

export class InputValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'InputValidationError';
  }
}

/**
 * Common validation schemas
 */
export const ValidationSchemas = {
  // User authentication
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .toLowerCase()
    .transform(val => val.trim()),
    
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
    
  username: z.string()
    .min(3, 'Username too short')
    .max(30, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username contains invalid characters'),
    
  // Security tokens
  jwt: z.string()
    .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, 'Invalid JWT format'),
    
  uuid: z.string()
    .uuid('Invalid UUID format'),
    
  // File uploads
  fileName: z.string()
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename'),
    
  mimeType: z.string()
    .regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/i, 'Invalid MIME type'),
    
  // Content
  title: z.string()
    .min(1, 'Title required')
    .max(200, 'Title too long')
    .transform(val => DOMPurify.sanitize(val, { ALLOWED_TAGS: [] })),
    
  description: z.string()
    .max(5000, 'Description too long')
    .transform(val => DOMPurify.sanitize(val, { 
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: []
    })),
    
  // URLs
  url: z.string()
    .url('Invalid URL')
    .max(2048, 'URL too long')
    .refine(val => {
      const parsed = new URL(val);
      return ['http:', 'https:'].includes(parsed.protocol);
    }, 'Only HTTP/HTTPS URLs allowed'),
    
  // Phone numbers
  phone: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
    
  // Database IDs
  id: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number)
  ]),
  
  // Pagination
  page: z.number()
    .int()
    .min(1, 'Page must be positive')
    .max(10000, 'Page too large'),
    
  limit: z.number()
    .int()
    .min(1, 'Limit must be positive')
    .max(100, 'Limit too large'),
    
  // Search queries
  searchQuery: z.string()
    .max(100, 'Search query too long')
    .transform(val => DOMPurify.sanitize(val, { ALLOWED_TAGS: [] }))
    .transform(val => val.replace(/[%_]/g, '\\$&')), // Escape SQL wildcards
};

/**
 * SQL Injection Prevention
 */
export class SQLInjectionPrevention {
  private static readonly SQL_KEYWORDS = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE',
    'ALTER', 'TRUNCATE', 'EXEC', 'EXECUTE', 'UNION', 'FROM',
    'WHERE', 'JOIN', 'OR', 'AND', '--', '/*', '*/', 'XP_',
    'SP_', 'CHAR', 'NCHAR', 'VARCHAR', 'NVARCHAR', 'CAST',
    'CONVERT', 'WAITFOR', 'DELAY', 'BENCHMARK', 'SLEEP'
  ];
  
  /**
   * Check if input contains SQL injection attempts
   */
  static detectSQLInjection(input: string): boolean {
    const upperInput = input.toUpperCase();
    
    // Check for SQL keywords
    for (const keyword of this.SQL_KEYWORDS) {
      if (upperInput.includes(keyword)) {
        // Allow keywords in legitimate contexts (e.g., "select" in normal text)
        const regex = new RegExp(`\\b${keyword}\\b.*\\b(FROM|WHERE|JOIN)\\b`, 'i');
        if (regex.test(input)) {
          return true;
        }
      }
    }
    
    // Check for common SQL injection patterns
    const injectionPatterns = [
      /(\b(OR|AND)\b\s*\d+\s*=\s*\d+)/i, // OR 1=1
      /(\b(OR|AND)\b\s*'[^']*'\s*=\s*'[^']*')/i, // OR 'a'='a'
      /(--\s*$)/m, // SQL comment at end of line
      /(\/\*[\s\S]*?\*\/)/m, // Multi-line SQL comment
      /(\bUNION\b.*\bSELECT\b)/i, // UNION SELECT
      /(;\s*(DROP|DELETE|INSERT|UPDATE|CREATE)\b)/i, // Command chaining
      /(\bEXEC(UTE)?\s*\()/i, // EXEC commands
      /(xp_\w+|sp_\w+)/i, // System stored procedures
    ];
    
    return injectionPatterns.some(pattern => pattern.test(input));
  }
  
  /**
   * Escape special characters for SQL LIKE queries
   */
  static escapeLikePattern(pattern: string): string {
    return pattern.replace(/[%_\\]/g, '\\$&');
  }
  
  /**
   * Validate and sanitize table/column names
   */
  static validateIdentifier(identifier: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new InputValidationError('Invalid identifier format');
    }
    return identifier;
  }
}

/**
 * XSS Prevention
 */
export class XSSPrevention {
  private static readonly XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<applet/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
  ];
  
  /**
   * Detect potential XSS attempts
   */
  static detectXSS(input: string): boolean {
    return this.XSS_PATTERNS.some(pattern => pattern.test(input));
  }
  
  /**
   * Sanitize HTML content
   */
  static sanitizeHTML(html: string, options?: DOMPurify.Config): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
      ALLOW_DATA_ATTR: false,
      ...options
    });
  }
  
  /**
   * Escape HTML for display
   */
  static escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Validate and sanitize URLs
   */
  static sanitizeURL(url: string): string {
    try {
      const parsed = new URL(url);
      
      // Only allow safe protocols
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        throw new InputValidationError('Unsafe URL protocol');
      }
      
      // Prevent javascript: and data: URLs
      if (url.toLowerCase().includes('javascript:') || url.toLowerCase().includes('data:')) {
        throw new InputValidationError('Potentially malicious URL');
      }
      
      return parsed.toString();
    } catch (error) {
      throw new InputValidationError('Invalid URL format');
    }
  }
}

/**
 * File Upload Validation
 */
export class FileUploadValidation {
  private static readonly ALLOWED_MIME_TYPES = {
    images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    videos: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4']
  };
  
  private static readonly MAX_FILE_SIZES = {
    images: 10 * 1024 * 1024, // 10MB
    documents: 50 * 1024 * 1024, // 50MB
    videos: 500 * 1024 * 1024, // 500MB
    audio: 50 * 1024 * 1024 // 50MB
  };
  
  /**
   * Validate file upload
   */
  static validateFile(
    file: File,
    category: keyof typeof FileUploadValidation.ALLOWED_MIME_TYPES
  ): void {
    // Check file size
    const maxSize = this.MAX_FILE_SIZES[category];
    if (file.size > maxSize) {
      throw new InputValidationError(`File too large. Maximum size: ${maxSize / 1024 / 1024}MB`);
    }
    
    // Check MIME type
    const allowedTypes = this.ALLOWED_MIME_TYPES[category];
    if (!allowedTypes.includes(file.type)) {
      throw new InputValidationError(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
    }
    
    // Check file extension matches MIME type
    const extension = file.name.split('.').pop()?.toLowerCase();
    const expectedExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'application/pdf': ['pdf'],
      'video/mp4': ['mp4'],
      'audio/mpeg': ['mp3']
    };
    
    const expected = expectedExtensions[file.type];
    if (expected && extension && !expected.includes(extension)) {
      throw new InputValidationError('File extension does not match MIME type');
    }
    
    // Check for double extensions (e.g., file.pdf.exe)
    if ((file.name.match(/\./g) || []).length > 1) {
      const parts = file.name.split('.');
      if (parts.length > 2) {
        throw new InputValidationError('Suspicious filename with multiple extensions');
      }
    }
  }
  
  /**
   * Sanitize filename
   */
  static sanitizeFilename(filename: string): string {
    // Remove path components
    filename = filename.replace(/^.*[\\\/]/, '');
    
    // Remove special characters
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Limit length
    if (filename.length > 255) {
      const extension = filename.split('.').pop();
      const name = filename.substring(0, 250 - (extension?.length || 0));
      filename = extension ? `${name}.${extension}` : name;
    }
    
    return filename;
  }
}

/**
 * Request validation middleware
 */
export class RequestValidator {
  /**
   * Validate request body against schema
   */
  static validateBody<T>(
    data: unknown,
    schema: z.ZodSchema<T>
  ): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        throw new InputValidationError(
          firstError.message,
          firstError.path.join('.'),
          firstError.code
        );
      }
      throw error;
    }
  }
  
  /**
   * Validate query parameters
   */
  static validateQuery<T>(
    params: URLSearchParams,
    schema: z.ZodSchema<T>
  ): T {
    const data: Record<string, any> = {};
    params.forEach((value, key) => {
      data[key] = value;
    });
    
    return this.validateBody(data, schema);
  }
  
  /**
   * Create validation middleware
   */
  static middleware<T>(schema: z.ZodSchema<T>) {
    return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
      try {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          const contentType = request.headers.get('content-type');
          
          if (contentType?.includes('application/json')) {
            const body = await request.json();
            this.validateBody(body, schema);
          }
        }
        
        return await next();
      } catch (error) {
        if (error instanceof InputValidationError) {
          return new Response(
            JSON.stringify({
              error: 'Validation Error',
              message: error.message,
              field: error.field,
              code: error.code
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        throw error;
      }
    };
  }
}

// Export commonly used validators
export const validators = {
  email: (email: string) => ValidationSchemas.email.parse(email),
  password: (password: string) => ValidationSchemas.password.parse(password),
  username: (username: string) => ValidationSchemas.username.parse(username),
  url: (url: string) => ValidationSchemas.url.parse(url),
  sanitizeHTML: (html: string) => XSSPrevention.sanitizeHTML(html),
  escapeHTML: (text: string) => XSSPrevention.escapeHTML(text),
  validateFile: (file: File, category: 'images' | 'documents' | 'videos' | 'audio') =>
    FileUploadValidation.validateFile(file, category),
  sanitizeFilename: (filename: string) => FileUploadValidation.sanitizeFilename(filename),
};