/**
 * Environment Configuration for Database Connections
 * 
 * Handles different environments:
 * - Production (Cloudflare Workers + Neon)
 * - Local Development (Deno + Local PostgreSQL)
 * - Edge Runtime (Optimized for Cloudflare Workers)
 */

export interface DatabaseEnvironment {
  name: string;
  isProduction: boolean;
  isLocal: boolean;
  isEdge: boolean;
  connectionString: string;
  poolConfig: {
    maxConnections: number;
    connectionTimeoutMs: number;
    queryTimeoutMs: number;
    idleTimeoutMs: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  features: {
    hyperdrive: boolean;
    multiplexing: boolean;
    pooling: boolean;
    ssl: boolean;
  };
}

/**
 * Environment Detection Utilities
 */
export function detectEnvironment(): {
  isCloudflareWorkers: boolean;
  isDeno: boolean;
  isNode: boolean;
  isLocal: boolean;
} {
  // Check for Cloudflare Workers environment
  const isCloudflareWorkers = typeof globalThis.caches !== 'undefined' &&
                             typeof globalThis.Response !== 'undefined' &&
                             typeof globalThis.fetch !== 'undefined' &&
                             typeof Deno === 'undefined';

  // Check for Deno environment
  const isDeno = typeof Deno !== 'undefined';

  // Check for Node.js environment
  const isNode = typeof process !== 'undefined' && 
                 typeof process.versions?.node !== 'undefined';

  // Determine if running locally (development)
  const isLocal = isDeno || isNode;

  return {
    isCloudflareWorkers,
    isDeno,
    isNode,
    isLocal,
  };
}

/**
 * Production Environment Configuration (Cloudflare Workers + Neon)
 */
export function getProductionConfig(env: any): DatabaseEnvironment {
  const hyperdrive = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  
  return {
    name: 'production',
    isProduction: true,
    isLocal: false,
    isEdge: true,
    connectionString: hyperdrive,
    poolConfig: {
      maxConnections: 50, // Neon Starter plan limit
      connectionTimeoutMs: 10000,
      queryTimeoutMs: 30000,
      idleTimeoutMs: 300000, // 5 minutes
      maxRetries: 3,
      retryDelayMs: 1000,
    },
    features: {
      hyperdrive: !!env.HYPERDRIVE,
      multiplexing: true,
      pooling: true,
      ssl: true,
    },
  };
}

/**
 * Local Development Configuration (Deno + Local PostgreSQL)
 */
export function getLocalConfig(env: any): DatabaseEnvironment {
  const localConnectionString = env.DATABASE_URL || 
    'postgresql://postgres:password@localhost:5432/pitchey_dev';
  
  return {
    name: 'local',
    isProduction: false,
    isLocal: true,
    isEdge: false,
    connectionString: localConnectionString,
    poolConfig: {
      maxConnections: 10, // Lower for local development
      connectionTimeoutMs: 5000,
      queryTimeoutMs: 60000, // More generous for development
      idleTimeoutMs: 600000, // 10 minutes
      maxRetries: 2, // Fewer retries locally
      retryDelayMs: 500,
    },
    features: {
      hyperdrive: false,
      multiplexing: false,
      pooling: true,
      ssl: env.DB_SSL !== 'false', // Allow disabling SSL locally
    },
  };
}

/**
 * Edge-Optimized Configuration (Cloudflare Workers with Hyperdrive)
 */
export function getEdgeConfig(env: any): DatabaseEnvironment {
  return {
    name: 'edge',
    isProduction: true,
    isLocal: false,
    isEdge: true,
    connectionString: env.HYPERDRIVE?.connectionString || env.DATABASE_URL,
    poolConfig: {
      maxConnections: 100, // Higher with Hyperdrive
      connectionTimeoutMs: 5000, // Faster with edge pooling
      queryTimeoutMs: 15000, // Shorter for edge responsiveness
      idleTimeoutMs: 180000, // 3 minutes for edge
      maxRetries: 5, // More retries for edge reliability
      retryDelayMs: 200, // Faster retry cycle
    },
    features: {
      hyperdrive: true,
      multiplexing: true,
      pooling: true,
      ssl: true,
    },
  };
}

/**
 * Main Configuration Factory
 */
export function getDatabaseEnvironmentConfig(env: any): DatabaseEnvironment {
  const runtime = detectEnvironment();
  
  // Force production mode if explicitly set
  if (env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production') {
    return env.HYPERDRIVE ? getEdgeConfig(env) : getProductionConfig(env);
  }

  // Auto-detect based on runtime environment
  if (runtime.isCloudflareWorkers) {
    return env.HYPERDRIVE ? getEdgeConfig(env) : getProductionConfig(env);
  }

  if (runtime.isDeno || runtime.isNode) {
    return getLocalConfig(env);
  }

  // Fallback to production config
  console.warn('Unable to detect environment, defaulting to production config');
  return getProductionConfig(env);
}

/**
 * Connection String Validators
 */
export function validateConnectionString(connectionString: string): {
  isValid: boolean;
  errors: string[];
  info: {
    protocol: string;
    host: string;
    port: number;
    database: string;
    ssl: boolean;
  };
} {
  const errors: string[] = [];
  let info = {
    protocol: '',
    host: '',
    port: 5432,
    database: '',
    ssl: false,
  };

  try {
    const url = new URL(connectionString);
    
    info = {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.replace('/', ''),
      ssl: url.searchParams.get('sslmode') === 'require',
    };

    // Validate protocol
    if (!['postgres', 'postgresql'].includes(info.protocol)) {
      errors.push(`Invalid protocol: ${info.protocol}. Expected 'postgres' or 'postgresql'.`);
    }

    // Validate host
    if (!info.host) {
      errors.push('Missing hostname in connection string.');
    }

    // Validate database name
    if (!info.database) {
      errors.push('Missing database name in connection string.');
    }

    // Check for credentials
    if (!url.username || !url.password) {
      errors.push('Missing username or password in connection string.');
    }

    // Production SSL check
    if (info.host.includes('neon.tech') && !info.ssl) {
      errors.push('SSL is required for Neon database connections.');
    }

  } catch (error) {
    errors.push(`Invalid connection string format: ${(error as Error).message}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    info,
  };
}

/**
 * Environment Health Check
 */
export async function checkEnvironmentHealth(env: any): Promise<{
  environment: DatabaseEnvironment;
  validation: ReturnType<typeof validateConnectionString>;
  runtime: ReturnType<typeof detectEnvironment>;
  recommendations: string[];
}> {
  const environment = getDatabaseEnvironmentConfig(env);
  const validation = validateConnectionString(environment.connectionString);
  const runtime = detectEnvironment();
  const recommendations: string[] = [];

  // Generate recommendations
  if (!validation.isValid) {
    recommendations.push('Fix connection string validation errors before deploying.');
  }

  if (environment.isProduction && !environment.features.ssl) {
    recommendations.push('Enable SSL for production database connections.');
  }

  if (runtime.isCloudflareWorkers && !environment.features.hyperdrive) {
    recommendations.push('Consider enabling Hyperdrive for better edge performance.');
  }

  if (environment.poolConfig.maxConnections > 50 && !environment.features.hyperdrive) {
    recommendations.push('High connection limit without Hyperdrive may cause connection exhaustion.');
  }

  if (environment.poolConfig.queryTimeoutMs > 30000 && environment.isEdge) {
    recommendations.push('Long query timeouts may cause edge function timeouts.');
  }

  return {
    environment,
    validation,
    runtime,
    recommendations,
  };
}

/**
 * Connection String Builder for Different Environments
 */
export class ConnectionStringBuilder {
  private params: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    pooling?: boolean;
    maxConnections?: number;
  } = {};

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.parseConnectionString(baseUrl);
    }
  }

  host(host: string): this {
    this.params.host = host;
    return this;
  }

  port(port: number): this {
    this.params.port = port;
    return this;
  }

  database(database: string): this {
    this.params.database = database;
    return this;
  }

  credentials(username: string, password: string): this {
    this.params.username = username;
    this.params.password = password;
    return this;
  }

  ssl(enabled = true): this {
    this.params.ssl = enabled;
    return this;
  }

  pooling(enabled = true, maxConnections = 10): this {
    this.params.pooling = enabled;
    this.params.maxConnections = maxConnections;
    return this;
  }

  build(): string {
    if (!this.params.host || !this.params.database || !this.params.username || !this.params.password) {
      throw new Error('Missing required connection parameters');
    }

    const url = new URL(`postgresql://${this.params.username}:${this.params.password}@${this.params.host}:${this.params.port || 5432}/${this.params.database}`);

    if (this.params.ssl) {
      url.searchParams.set('sslmode', 'require');
    }

    if (this.params.pooling) {
      url.searchParams.set('pooling', 'true');
      if (this.params.maxConnections) {
        url.searchParams.set('max_connections', this.params.maxConnections.toString());
      }
    }

    return url.toString();
  }

  private parseConnectionString(connectionString: string): void {
    try {
      const url = new URL(connectionString);
      this.params = {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.replace('/', ''),
        username: url.username,
        password: url.password,
        ssl: url.searchParams.get('sslmode') === 'require',
        pooling: url.searchParams.get('pooling') === 'true',
        maxConnections: parseInt(url.searchParams.get('max_connections') || '10'),
      };
    } catch (error) {
      throw new Error(`Failed to parse connection string: ${(error as Error).message}`);
    }
  }
}

/**
 * Utility Functions
 */

// Get optimized connection string for current environment
export function getOptimizedConnectionString(env: any): string {
  const config = getDatabaseEnvironmentConfig(env);
  
  if (config.features.hyperdrive && env.HYPERDRIVE?.connectionString) {
    return env.HYPERDRIVE.connectionString;
  }
  
  return config.connectionString;
}

// Check if running in Cloudflare Workers
export function isCloudflareWorkers(): boolean {
  return detectEnvironment().isCloudflareWorkers;
}

// Check if Hyperdrive is available and configured
export function isHyperdriveEnabled(env: any): boolean {
  return !!(env.HYPERDRIVE?.connectionString || env.HYPERDRIVE);
}

// Get environment-specific database configuration
export function createDatabaseConfigFromEnv(env: any) {
  const envConfig = getDatabaseEnvironmentConfig(env);
  
  return {
    connectionString: envConfig.connectionString,
    maxRetries: envConfig.poolConfig.maxRetries,
    retryDelayMs: envConfig.poolConfig.retryDelayMs,
    connectionTimeoutMs: envConfig.poolConfig.connectionTimeoutMs,
    queryTimeoutMs: envConfig.poolConfig.queryTimeoutMs,
    healthCheckIntervalMs: 300000, // 5 minutes default
  };
}