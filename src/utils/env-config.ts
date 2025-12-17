/**
 * Environment Configuration Helper
 * Secure handling of environment variables with validation
 */

export interface EnvConfig {
  // Database
  DATABASE_URL: string;
  READ_REPLICA_URLS?: string;
  
  // Authentication
  JWT_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  SESSION_COOKIE_NAME?: string;
  
  // Cache
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  
  // Storage
  R2_BUCKET_NAME?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  
  // Email
  SENDGRID_API_KEY?: string;
  POSTMARK_API_KEY?: string;
  EMAIL_FROM?: string;
  
  // OAuth
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  
  // Monitoring
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  
  // Stripe
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  
  // Environment
  ENVIRONMENT: 'development' | 'staging' | 'production';
  FRONTEND_URL: string;
  API_URL?: string;
}

/**
 * Validates and returns environment configuration
 */
export function getEnvConfig(env: any): EnvConfig {
  // Required variables
  const requiredVars = ['DATABASE_URL', 'FRONTEND_URL'];
  const missingVars = requiredVars.filter(key => !env[key]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      `Please set them in your environment or Cloudflare dashboard.`
    );
  }

  // Validate DATABASE_URL format
  if (!isValidDatabaseUrl(env.DATABASE_URL)) {
    throw new Error(
      'Invalid DATABASE_URL format. Expected: postgresql://[user]:[password]@[host]/[database]'
    );
  }

  // Detect environment
  const environment = detectEnvironment(env);

  // Build config with defaults
  const config: EnvConfig = {
    // Database
    DATABASE_URL: env.DATABASE_URL,
    READ_REPLICA_URLS: env.READ_REPLICA_URLS,
    
    // Authentication
    JWT_SECRET: env.JWT_SECRET || env.BETTER_AUTH_SECRET,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET || env.JWT_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL || env.API_URL,
    SESSION_COOKIE_NAME: env.SESSION_COOKIE_NAME || 'pitchey-auth',
    
    // Cache
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
    
    // Storage
    R2_BUCKET_NAME: env.R2_BUCKET_NAME || 'pitchey-uploads',
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    
    // Email
    SENDGRID_API_KEY: env.SENDGRID_API_KEY,
    POSTMARK_API_KEY: env.POSTMARK_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM || 'noreply@pitchey.com',
    
    // OAuth
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
    
    // Monitoring
    SENTRY_DSN: env.SENTRY_DSN,
    SENTRY_ENVIRONMENT: env.SENTRY_ENVIRONMENT || environment,
    
    // Stripe
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    
    // Environment
    ENVIRONMENT: environment,
    FRONTEND_URL: env.FRONTEND_URL,
    API_URL: env.API_URL || env.BETTER_AUTH_URL
  };

  // Validate production requirements
  if (environment === 'production') {
    validateProductionConfig(config);
  }

  return config;
}

/**
 * Validates database URL format
 */
function isValidDatabaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:';
  } catch {
    return false;
  }
}

/**
 * Detects environment based on various signals
 */
function detectEnvironment(env: any): 'development' | 'staging' | 'production' {
  // Explicit environment variable
  if (env.ENVIRONMENT) {
    return env.ENVIRONMENT as 'development' | 'staging' | 'production';
  }
  
  // Node/Deno environment
  if (env.NODE_ENV === 'production' || env.DENO_ENV === 'production') {
    return 'production';
  }
  
  // Cloudflare Pages/Workers detection
  if (env.CF_PAGES || env.CF_WORKERS) {
    return 'production';
  }
  
  // URL-based detection
  if (env.FRONTEND_URL?.includes('localhost') || env.API_URL?.includes('localhost')) {
    return 'development';
  }
  
  if (env.FRONTEND_URL?.includes('.pages.dev') || env.API_URL?.includes('.workers.dev')) {
    return 'production';
  }
  
  return 'development';
}

/**
 * Validates production configuration
 */
function validateProductionConfig(config: EnvConfig): void {
  const warnings: string[] = [];
  
  // Security checks
  if (!config.BETTER_AUTH_SECRET || config.BETTER_AUTH_SECRET.length < 32) {
    warnings.push('BETTER_AUTH_SECRET should be at least 32 characters for production');
  }
  
  // SSL check for database
  if (!config.DATABASE_URL.includes('sslmode=require')) {
    warnings.push('DATABASE_URL should include sslmode=require for production');
  }
  
  // Cache configuration
  if (!config.UPSTASH_REDIS_REST_URL) {
    warnings.push('Redis cache not configured for production');
  }
  
  // Monitoring
  if (!config.SENTRY_DSN) {
    warnings.push('Sentry monitoring not configured for production');
  }
  
  // Email configuration
  if (!config.SENDGRID_API_KEY && !config.POSTMARK_API_KEY) {
    warnings.push('Email service not configured for production');
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Production configuration warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }
}

/**
 * Helper to safely get environment variable
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  // Try multiple sources
  const value = 
    (typeof process !== 'undefined' && process.env?.[key]) ||
    (typeof Deno !== 'undefined' && Deno.env.get(key)) ||
    defaultValue;
    
  return value;
}

/**
 * Helper to check if running in production
 */
export function isProduction(): boolean {
  const env = getEnv('ENVIRONMENT') || getEnv('NODE_ENV') || getEnv('DENO_ENV');
  return env === 'production';
}

/**
 * Helper to check if running in development
 */
export function isDevelopment(): boolean {
  return !isProduction();
}

/**
 * Export configuration validation
 */
export function validateConfig(env: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    getEnvConfig(env);
    return { valid: true, errors: [] };
  } catch (error) {
    errors.push(error.message);
    return { valid: false, errors };
  }
}