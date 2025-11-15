/**
 * Environment Variable Validation for Deno Deploy Compatibility
 * 
 * Validates required environment variables at startup and provides
 * fallback behavior for development vs production environments.
 */

export interface EnvConfig {
  JWT_SECRET: string;
  DATABASE_URL: string;
  DENO_ENV?: string;
  NODE_ENV?: string;
  PORT?: string;
  FRONTEND_URL?: string;
  SENTRY_DSN?: string;
  CACHE_ENABLED?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

export class EnvironmentValidationError extends Error {
  constructor(message: string, public missingVars: string[]) {
    super(message);
    this.name = "EnvironmentValidationError";
  }
}

/**
 * Validates environment variables and returns typed configuration
 */
export function validateEnvironment(): EnvConfig {
  const env = Deno.env.toObject();
  const isProduction = env.DENO_ENV === "production" || 
                       env.NODE_ENV === "production" ||
                       env.DENO_DEPLOY === "1";
  
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required in all environments
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    if (isProduction) {
      missing.push("JWT_SECRET");
    } else {
      warnings.push("JWT_SECRET not set, using development default");
    }
  } else if (jwtSecret === "your-secret-key-change-this-in-production" || 
             jwtSecret === "test-secret-key-for-development") {
    if (isProduction) {
      warnings.push("JWT_SECRET appears to be a development value, consider using a production secret");
    } else {
      warnings.push("JWT_SECRET is using development/insecure value");
    }
  } else if (jwtSecret.length < 32) {
    if (isProduction) {
      warnings.push("JWT_SECRET is shorter than recommended 32 characters");
    } else {
      warnings.push("JWT_SECRET is using development/insecure value");
    }
  }

  // Database URL is required
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    missing.push("DATABASE_URL");
  }

  // Production-specific validations
  if (isProduction) {
    // Sentry DSN recommended for production
    if (!env.SENTRY_DSN) {
      warnings.push("SENTRY_DSN not set - error tracking disabled");
    }

    // Cache configuration
    if (env.CACHE_ENABLED === "true" && !env.UPSTASH_REDIS_REST_URL) {
      warnings.push("CACHE_ENABLED but UPSTASH_REDIS_REST_URL not set");
    }
  }

  // Report missing required variables
  if (missing.length > 0) {
    const error = new EnvironmentValidationError(
      `Missing required environment variables: ${missing.join(", ")}`,
      missing
    );
    console.error("❌ Environment validation failed:");
    missing.forEach(varName => {
      console.error(`   - ${varName} is required`);
    });
    throw error;
  }

  // Report warnings
  if (warnings.length > 0) {
    console.warn("⚠️  Environment warnings:");
    warnings.forEach(warning => {
      console.warn(`   - ${warning}`);
    });
  }

  // Return validated configuration
  const config: EnvConfig = {
    JWT_SECRET: jwtSecret || "test-secret-key-for-development-only",
    DATABASE_URL: databaseUrl!,
    DENO_ENV: env.DENO_ENV,
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT || "8001",
    FRONTEND_URL: env.FRONTEND_URL,
    SENTRY_DSN: env.SENTRY_DSN,
    CACHE_ENABLED: env.CACHE_ENABLED,
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
  };

  // Log successful validation
  console.log("✅ Environment validation passed");
  console.log(`   Environment: ${isProduction ? "production" : "development"}`);
  console.log(`   Database: ${config.DATABASE_URL.includes("localhost") ? "local" : "remote"}`);
  console.log(`   Cache: ${config.CACHE_ENABLED === "true" ? "enabled" : "disabled"}`);
  console.log(`   Monitoring: ${config.SENTRY_DSN ? "enabled" : "disabled"}`);

  return config;
}

/**
 * Health check endpoint data for environment status
 */
export function getEnvironmentHealth(): {
  status: "ok" | "warning" | "error";
  environment: string;
  variables: Array<{ name: string; isSet: boolean; isSecure?: boolean }>;
  warnings: string[];
} {
  const env = Deno.env.toObject();
  const isProduction = env.DENO_ENV === "production" || 
                       env.NODE_ENV === "production" ||
                       env.DENO_DEPLOY === "1";
  
  const requiredVars = ["JWT_SECRET", "DATABASE_URL"];
  const optionalVars = ["SENTRY_DSN", "FRONTEND_URL", "CACHE_ENABLED"];
  const warnings: string[] = [];
  let status: "ok" | "warning" | "error" = "ok";

  const variables = [...requiredVars, ...optionalVars].map(name => {
    const value = env[name];
    const isSet = !!value;
    let isSecure = true;

    if (name === "JWT_SECRET" && value) {
      isSecure = value.length >= 32 && 
                !value.includes("test-secret") && 
                !value.includes("development") &&
                !value.includes("change-this");
      
      if (!isSecure && isProduction) {
        warnings.push(`${name} is not secure for production`);
        status = "error";
      } else if (!isSecure) {
        warnings.push(`${name} is using development value`);
        if (status === "ok") status = "warning";
      }
    }

    if (requiredVars.includes(name) && !isSet) {
      warnings.push(`${name} is required but not set`);
      status = "error";
    }

    return { name, isSet, isSecure: name === "JWT_SECRET" ? isSecure : undefined };
  });

  return {
    status,
    environment: isProduction ? "production" : "development",
    variables,
    warnings
  };
}

/**
 * Generate a secure JWT secret for production use
 */
export function generateSecureJWTSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}