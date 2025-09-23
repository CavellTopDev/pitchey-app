/**
 * Password Strength Validation Utilities
 * Implements OWASP password requirements and NIST SP 800-63B guidelines
 */

import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Common weak passwords list (top 10000)
const COMMON_PASSWORDS_URL = "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials/10000-most-common-passwords.txt";
let commonPasswords: Set<string> | null = null;

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0-100
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxConsecutiveChars: number;
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
  preventReuse: number; // Number of previous passwords to check
}

// Default password policy (OWASP compliant)
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxConsecutiveChars: 3,
  preventCommonPasswords: true,
  preventUserInfo: true,
  preventReuse: 5,
};

// Load common passwords list
async function loadCommonPasswords(): Promise<void> {
  if (commonPasswords) return;
  
  try {
    const response = await fetch(COMMON_PASSWORDS_URL);
    const text = await response.text();
    commonPasswords = new Set(text.split('\n').map(p => p.trim().toLowerCase()));
  } catch (error) {
    console.error('Failed to load common passwords list:', error);
    // Use a minimal fallback list
    commonPasswords = new Set([
      'password', '123456', '123456789', 'qwerty', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890',
      'password1', 'password123', 'abc123', '12345678', 'qwertyuiop',
      'admin123', 'root', 'toor', 'pass', 'test', 'guest'
    ]);
  }
}

/**
 * Calculate password entropy
 */
function calculateEntropy(password: string): number {
  const charset = {
    lowercase: 26,
    uppercase: 26,
    numbers: 10,
    special: 32,
  };
  
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += charset.lowercase;
  if (/[A-Z]/.test(password)) poolSize += charset.uppercase;
  if (/[0-9]/.test(password)) poolSize += charset.numbers;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += charset.special;
  
  const entropy = password.length * Math.log2(poolSize);
  return Math.round(entropy);
}

/**
 * Check for consecutive characters
 */
function hasConsecutiveChars(password: string, maxConsecutive: number): boolean {
  for (let i = 0; i <= password.length - maxConsecutive; i++) {
    const char = password[i];
    let isConsecutive = true;
    
    for (let j = 1; j < maxConsecutive; j++) {
      if (password[i + j] !== char) {
        isConsecutive = false;
        break;
      }
    }
    
    if (isConsecutive) return true;
  }
  
  return false;
}

/**
 * Check for keyboard patterns
 */
function hasKeyboardPattern(password: string): boolean {
  const patterns = [
    'qwerty', 'asdfgh', 'zxcvbn', 'qwertz', 'azerty',
    '12345', '67890', 'qweasd', '!@#$%',
  ];
  
  const lowerPassword = password.toLowerCase();
  return patterns.some(pattern => lowerPassword.includes(pattern));
}

/**
 * Check if password contains user information
 */
function containsUserInfo(
  password: string,
  userInfo: { email?: string; username?: string; firstName?: string; lastName?: string }
): boolean {
  const lowerPassword = password.toLowerCase();
  
  const infoToCheck = [
    userInfo.email?.split('@')[0],
    userInfo.username,
    userInfo.firstName,
    userInfo.lastName,
  ].filter(Boolean).map(info => info!.toLowerCase());
  
  return infoToCheck.some(info => {
    if (info.length < 3) return false;
    return lowerPassword.includes(info);
  });
}

/**
 * Validate password strength
 */
export async function validatePassword(
  password: string,
  options: {
    policy?: Partial<PasswordPolicy>;
    userInfo?: { email?: string; username?: string; firstName?: string; lastName?: string };
    previousPasswords?: string[];
  } = {}
): Promise<PasswordStrengthResult> {
  const policy = { ...DEFAULT_PASSWORD_POLICY, ...options.policy };
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Load common passwords if needed
  if (policy.preventCommonPasswords) {
    await loadCommonPasswords();
  }
  
  // Length validation
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }
  if (password.length > policy.maxLength) {
    errors.push(`Password must be no more than ${policy.maxLength} characters long`);
  }
  
  // Character requirements
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
    suggestions.push('Add uppercase letters (A-Z)');
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
    suggestions.push('Add lowercase letters (a-z)');
  }
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
    suggestions.push('Add numbers (0-9)');
  }
  if (policy.requireSpecialChars && !/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
    suggestions.push('Add special characters (!@#$%^&*)');
  }
  
  // Consecutive characters
  if (hasConsecutiveChars(password, policy.maxConsecutiveChars)) {
    errors.push(`Password cannot contain more than ${policy.maxConsecutiveChars - 1} consecutive identical characters`);
  }
  
  // Keyboard patterns
  if (hasKeyboardPattern(password)) {
    warnings.push('Password contains keyboard patterns');
    suggestions.push('Avoid keyboard patterns like "qwerty" or "12345"');
  }
  
  // Common passwords
  if (policy.preventCommonPasswords && commonPasswords?.has(password.toLowerCase())) {
    errors.push('This password is too common and easily guessable');
    suggestions.push('Choose a unique password that is not commonly used');
  }
  
  // User information check
  if (policy.preventUserInfo && options.userInfo && containsUserInfo(password, options.userInfo)) {
    errors.push('Password should not contain personal information');
    suggestions.push('Avoid using your name, username, or email in the password');
  }
  
  // Previous password check
  if (policy.preventReuse && options.previousPasswords?.length) {
    const matchesPrevious = await Promise.all(
      options.previousPasswords.slice(0, policy.preventReuse).map(
        hash => bcrypt.compare(password, hash)
      )
    );
    
    if (matchesPrevious.some(matches => matches)) {
      errors.push(`Password has been used recently. Please choose a different password`);
    }
  }
  
  // Calculate entropy and score
  const entropy = calculateEntropy(password);
  let score = Math.min(100, Math.round((entropy / 60) * 100));
  
  // Adjust score based on issues
  score -= errors.length * 15;
  score -= warnings.length * 5;
  score = Math.max(0, score);
  
  // Entropy-based suggestions
  if (entropy < 30) {
    warnings.push('Password is very weak');
    suggestions.push('Consider using a passphrase with multiple words');
  } else if (entropy < 45) {
    warnings.push('Password could be stronger');
    suggestions.push('Add more characters or use a mix of character types');
  } else if (entropy < 60) {
    // Good password
  } else {
    // Excellent password
  }
  
  return {
    isValid: errors.length === 0,
    score,
    errors,
    warnings,
    suggestions: [...new Set(suggestions)], // Remove duplicates
  };
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(options: {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSpecialChars?: boolean;
  excludeSimilar?: boolean; // Exclude similar looking characters (0, O, l, 1, etc.)
} = {}): string {
  const config = {
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSpecialChars: true,
    excludeSimilar: false,
    ...options,
  };
  
  let charset = '';
  
  if (config.includeLowercase) {
    charset += config.excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  if (config.includeUppercase) {
    charset += config.excludeSimilar ? 'ABCDEFGHJKMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  if (config.includeNumbers) {
    charset += config.excludeSimilar ? '23456789' : '0123456789';
  }
  if (config.includeSpecialChars) {
    charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }
  
  if (!charset) {
    throw new Error('At least one character type must be included');
  }
  
  const array = new Uint8Array(config.length);
  crypto.getRandomValues(array);
  
  let password = '';
  for (let i = 0; i < config.length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  // Ensure at least one character from each required type
  const requiredChars: string[] = [];
  if (config.includeLowercase) requiredChars.push('abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]);
  if (config.includeUppercase) requiredChars.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]);
  if (config.includeNumbers) requiredChars.push('0123456789'[Math.floor(Math.random() * 10)]);
  if (config.includeSpecialChars) requiredChars.push('!@#$%^&*'[Math.floor(Math.random() * 8)]);
  
  // Replace random positions with required characters
  const passwordArray = password.split('');
  requiredChars.forEach((char, index) => {
    const position = Math.floor(Math.random() * passwordArray.length);
    passwordArray[position] = char;
  });
  
  return passwordArray.join('');
}

/**
 * Hash password securely
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12); // 12 rounds for good security/performance balance
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Get password strength level
 */
export function getPasswordStrengthLevel(score: number): {
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  color: string;
  label: string;
} {
  if (score < 20) {
    return { level: 'very-weak', color: '#dc2626', label: 'Very Weak' };
  } else if (score < 40) {
    return { level: 'weak', color: '#f97316', label: 'Weak' };
  } else if (score < 60) {
    return { level: 'fair', color: '#eab308', label: 'Fair' };
  } else if (score < 80) {
    return { level: 'good', color: '#84cc16', label: 'Good' };
  } else {
    return { level: 'strong', color: '#22c55e', label: 'Strong' };
  }
}