// Input validation and sanitization utilities
// Implements OWASP Input Validation best practices

import { securityConfig } from "../config/security.config.ts";

// Common password list (top 100 most common passwords)
const COMMON_PASSWORDS = new Set([
  "password", "123456", "123456789", "12345678", "12345", "1234567",
  "password123", "password1", "password!", "qwerty", "abc123", "111111",
  "123123", "admin", "letmein", "welcome", "monkey", "dragon", "master",
  "sunshine", "princess", "123321", "654321", "superman", "batman"
]);

// SQL Injection patterns to detect
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|TRUNCATE)\b)/gi,
  /(--|#|\/\*|\*\/)/g,
  /(\bOR\b.*=.*\bOR\b)/gi,
  /('|(\')|"|(\"))\s*;\s*(SELECT|INSERT|UPDATE|DELETE|DROP)/gi,
  /\w*'\s+OR\s+'1'\s*=\s*'1/gi,
];

// XSS patterns to detect
const XSS_PATTERNS = [
  /<script[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<img[^>]+src[\\s]*=[\\s]*["\']javascript:/gi,
  /<embed[\s\S]*?>/gi,
  /<object[\s\S]*?>/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
];

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: any;
}

// Email validation
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email || typeof email !== "string") {
    errors.push("Email is required");
    return { isValid: false, errors };
  }

  const trimmedEmail = email.trim().toLowerCase();
  
  if (trimmedEmail.length > securityConfig.validation.email.maxLength) {
    errors.push(`Email must not exceed ${securityConfig.validation.email.maxLength} characters`);
  }
  
  if (!securityConfig.validation.email.pattern.test(trimmedEmail)) {
    errors.push("Invalid email format");
  }
  
  // Check for SQL injection attempts
  if (containsSQLInjection(trimmedEmail)) {
    errors.push("Email contains invalid characters");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? trimmedEmail : undefined,
  };
}

// Password validation with strength requirements
export function validatePassword(password: string, username?: string, email?: string): ValidationResult {
  const errors: string[] = [];
  const policy = securityConfig.passwordPolicy;
  
  if (!password || typeof password !== "string") {
    errors.push("Password is required");
    return { isValid: false, errors };
  }
  
  // Length check
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }
  
  // Complexity requirements
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  if (policy.requireSpecialChars && !new RegExp(`[${policy.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password)) {
    errors.push("Password must contain at least one special character");
  }
  
  // Check for common passwords
  if (policy.preventCommonPasswords && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("Password is too common. Please choose a more unique password");
  }
  
  // Check for user info in password
  if (policy.preventUserInfoInPassword) {
    const lowerPassword = password.toLowerCase();
    if (username && lowerPassword.includes(username.toLowerCase())) {
      errors.push("Password should not contain your username");
    }
    if (email) {
      const emailPart = email.split("@")[0].toLowerCase();
      if (lowerPassword.includes(emailPart)) {
        errors.push("Password should not contain parts of your email");
      }
    }
  }
  
  // Check for consecutive characters
  if (policy.maxConsecutiveChars) {
    let consecutiveCount = 1;
    for (let i = 1; i < password.length; i++) {
      if (password[i] === password[i - 1]) {
        consecutiveCount++;
        if (consecutiveCount > policy.maxConsecutiveChars) {
          errors.push(`Password should not contain more than ${policy.maxConsecutiveChars} consecutive identical characters`);
          break;
        }
      } else {
        consecutiveCount = 1;
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Username validation
export function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];
  const rules = securityConfig.validation.username;
  
  if (!username || typeof username !== "string") {
    errors.push("Username is required");
    return { isValid: false, errors };
  }
  
  const trimmedUsername = username.trim();
  
  if (trimmedUsername.length < rules.minLength) {
    errors.push(`Username must be at least ${rules.minLength} characters`);
  }
  
  if (trimmedUsername.length > rules.maxLength) {
    errors.push(`Username must not exceed ${rules.maxLength} characters`);
  }
  
  if (!rules.pattern.test(trimmedUsername)) {
    errors.push("Username can only contain letters, numbers, underscores, and hyphens");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? trimmedUsername : undefined,
  };
}

// Text input validation and sanitization
export function validateAndSanitizeText(
  text: string,
  maxLength: number = securityConfig.validation.text.maxLength,
  allowHtml: boolean = false
): ValidationResult {
  const errors: string[] = [];
  
  if (!text || typeof text !== "string") {
    errors.push("Text input is required");
    return { isValid: false, errors };
  }
  
  let sanitized = text.trim();
  
  // Length check
  if (sanitized.length > maxLength) {
    errors.push(`Text must not exceed ${maxLength} characters`);
  }
  
  // Check for SQL injection
  if (containsSQLInjection(sanitized)) {
    errors.push("Text contains potentially dangerous SQL patterns");
  }
  
  // Check for XSS if HTML is not allowed
  if (!allowHtml) {
    if (containsXSS(sanitized)) {
      errors.push("Text contains potentially dangerous script patterns");
    }
    
    // Strip HTML tags
    sanitized = stripHtmlTags(sanitized);
    
    // Escape special characters
    sanitized = escapeHtml(sanitized);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined,
  };
}

// Check for SQL injection patterns
export function containsSQLInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

// Check for XSS patterns
export function containsXSS(input: string): boolean {
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

// Strip HTML tags
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

// Escape HTML special characters
export function escapeHtml(input: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  
  return input.replace(/[&<>"'\/]/g, (char) => htmlEscapes[char]);
}

// Validate file upload
export function validateFileUpload(
  file: { name: string; size: number; type: string }
): ValidationResult {
  const errors: string[] = [];
  const rules = securityConfig.validation.file;
  
  // Check file size
  if (file.size > rules.maxSize) {
    errors.push(`File size exceeds maximum of ${rules.maxSize / (1024 * 1024)}MB`);
  }
  
  // Check MIME type
  if (!rules.allowedMimeTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }
  
  // Check file extension
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!rules.allowedExtensions.includes(extension)) {
    errors.push(`File extension ${extension} is not allowed`);
  }
  
  // Check for double extensions (potential bypass attempt)
  const parts = file.name.split(".");
  if (parts.length > 2) {
    const suspiciousExtensions = [".exe", ".sh", ".bat", ".cmd", ".com", ".scr"];
    for (let i = 1; i < parts.length - 1; i++) {
      if (suspiciousExtensions.includes("." + parts[i].toLowerCase())) {
        errors.push("File name contains suspicious double extension");
        break;
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Validate pagination parameters
export function validatePagination(page: any, limit: any): ValidationResult {
  const errors: string[] = [];
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    errors.push("Page must be a positive integer");
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    errors.push("Limit must be between 1 and 100");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? { page: pageNum, limit: limitNum } : undefined,
  };
}

// Validate UUID
export function validateUUID(uuid: string): ValidationResult {
  const errors: string[] = [];
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuid || !uuidPattern.test(uuid)) {
    errors.push("Invalid UUID format");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? uuid.toLowerCase() : undefined,
  };
}

// Validate URL
export function validateURL(url: string): ValidationResult {
  const errors: string[] = [];
  
  try {
    const parsedUrl = new URL(url);
    
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      errors.push("Only HTTP and HTTPS URLs are allowed");
    }
    
    // Check for localhost/private IPs in production
    if (Deno.env.get("DENO_ENV") === "production") {
      const hostname = parsedUrl.hostname;
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.")
      ) {
        errors.push("Local/private URLs are not allowed");
      }
    }
  } catch {
    errors.push("Invalid URL format");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? url : undefined,
  };
}

// Generic object validation using a schema
export interface ValidationSchema {
  [key: string]: {
    required?: boolean;
    type?: "string" | "number" | "boolean" | "array" | "object";
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
    custom?: (value: any) => ValidationResult;
  };
}

export function validateObject(data: any, schema: ValidationSchema): ValidationResult {
  const errors: string[] = [];
  const sanitized: any = {};
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    // Check required
    if (rules.required && (value === undefined || value === null || value === "")) {
      errors.push(`${field} is required`);
      continue;
    }
    
    // Skip if not required and not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }
    
    // Type check
    if (rules.type && typeof value !== rules.type) {
      errors.push(`${field} must be of type ${rules.type}`);
      continue;
    }
    
    // String validations
    if (rules.type === "string") {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must not exceed ${rules.maxLength} characters`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} has invalid format`);
      }
    }
    
    // Number validations
    if (rules.type === "number") {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must not exceed ${rules.max}`);
      }
    }
    
    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(", ")}`);
    }
    
    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(value);
      if (!customResult.isValid) {
        errors.push(...customResult.errors.map(e => `${field}: ${e}`));
      } else if (customResult.sanitized !== undefined) {
        sanitized[field] = customResult.sanitized;
        continue;
      }
    }
    
    // Add to sanitized if no errors
    if (value !== undefined) {
      sanitized[field] = value;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined,
  };
}