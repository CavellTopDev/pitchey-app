/**
 * Enhanced Health Monitoring Handler
 * Provides comprehensive health checks for all services
 */

import { createDatabase } from '../db/raw-sql-connection';
import { ApiResponseBuilder } from '../utils/api-response';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  checks: {
    database: 'healthy' | 'unhealthy' | 'unknown';
    cache: 'healthy' | 'unhealthy' | 'unknown';
    storage: 'healthy' | 'unhealthy' | 'unknown';
    email: 'healthy' | 'unhealthy' | 'unknown';
    auth: 'healthy' | 'unhealthy' | 'unknown';
  };
  metrics: {
    responseTime: number;
    activeConnections: number;
    memoryUsage: number;
    uptime: number;
  };
  errors: string[];
}

/**
 * Enhanced health check handler with comprehensive service monitoring
 */
export async function enhancedHealthHandler(
  request: Request,
  env: any,
  ctx: ExecutionContext
): Promise<Response> {
  const startTime = Date.now();
  const errors: string[] = [];
  
  const healthStatus: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'production',
    version: env.VERSION || '1.0.0',
    checks: {
      database: 'unknown',
      cache: 'unknown',
      storage: 'unknown',
      email: 'unknown',
      auth: 'unknown'
    },
    metrics: {
      responseTime: 0,
      activeConnections: 0,
      memoryUsage: 0,
      uptime: Date.now() - (env.START_TIME || Date.now())
    },
    errors: []
  };

  // 1. Database health check
  try {
    const db = createDatabase(env.DATABASE_URL);
    const result = await Promise.race([
      db.query('SELECT 1 as health, COUNT(*) as connections FROM pg_stat_activity'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 5000))
    ]) as any;
    
    if (result.rows && result.rows.length > 0) {
      healthStatus.checks.database = 'healthy';
      healthStatus.metrics.activeConnections = parseInt(result.rows[0].connections) || 0;
    } else {
      healthStatus.checks.database = 'unhealthy';
      errors.push('Database query returned no results');
    }
  } catch (error: any) {
    healthStatus.checks.database = 'unhealthy';
    healthStatus.status = 'degraded';
    errors.push(`Database error: ${error.message}`);
  }

  // 2. KV Cache health check (Cloudflare KV)
  try {
    if (env.KV_CACHE) {
      const testKey = `health-check-${Date.now()}`;
      await Promise.race([
        env.KV_CACHE.put(testKey, Date.now().toString(), { expirationTtl: 60 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('KV timeout')), 3000))
      ]);
      
      const value = await env.KV_CACHE.get(testKey);
      if (value) {
        healthStatus.checks.cache = 'healthy';
        await env.KV_CACHE.delete(testKey);
      } else {
        healthStatus.checks.cache = 'unhealthy';
        errors.push('KV Cache write/read test failed');
      }
    } else {
      healthStatus.checks.cache = 'unhealthy';
      errors.push('KV_CACHE not configured');
    }
  } catch (error: any) {
    healthStatus.checks.cache = 'unhealthy';
    errors.push(`Cache error: ${error.message}`);
  }

  // 3. R2 Storage health check
  try {
    if (env.R2_BUCKET) {
      const testKey = `health-check/${Date.now()}.txt`;
      await Promise.race([
        env.R2_BUCKET.put(testKey, 'health check'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('R2 timeout')), 3000))
      ]);
      
      const object = await env.R2_BUCKET.get(testKey);
      if (object) {
        healthStatus.checks.storage = 'healthy';
        await env.R2_BUCKET.delete(testKey);
      } else {
        healthStatus.checks.storage = 'unhealthy';
        errors.push('R2 Storage write/read test failed');
      }
    } else {
      healthStatus.checks.storage = 'unhealthy';
      errors.push('R2_BUCKET not configured');
    }
  } catch (error: any) {
    healthStatus.checks.storage = 'unhealthy';
    errors.push(`Storage error: ${error.message}`);
  }

  // 4. Email service health check (basic check)
  try {
    if (env.RESEND_API_KEY || env.SENDGRID_API_KEY) {
      // Just verify the API key exists and is formatted correctly
      const hasValidEmailConfig = (env.RESEND_API_KEY && env.RESEND_API_KEY.startsWith('re_')) ||
                                 (env.SENDGRID_API_KEY && env.SENDGRID_API_KEY.startsWith('SG.'));
      healthStatus.checks.email = hasValidEmailConfig ? 'healthy' : 'unhealthy';
      if (!hasValidEmailConfig) {
        errors.push('Email service API key appears invalid');
      }
    } else {
      healthStatus.checks.email = 'unhealthy';
      errors.push('Email service not configured');
    }
  } catch (error: any) {
    healthStatus.checks.email = 'unhealthy';
    errors.push(`Email service error: ${error.message}`);
  }

  // 5. Auth service health check
  try {
    // Check if Better Auth tables exist
    const db = createDatabase(env.DATABASE_URL);
    const authCheck = await db.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'sessions', 'accounts')
    `);
    
    if (authCheck.rows[0].table_count >= 3) {
      healthStatus.checks.auth = 'healthy';
    } else {
      healthStatus.checks.auth = 'unhealthy';
      errors.push('Auth tables missing or incomplete');
    }
  } catch (error: any) {
    healthStatus.checks.auth = 'unhealthy';
    errors.push(`Auth check error: ${error.message}`);
  }

  // Calculate overall status
  const unhealthyChecks = Object.values(healthStatus.checks).filter(status => status === 'unhealthy').length;
  if (unhealthyChecks >= 3) {
    healthStatus.status = 'unhealthy';
  } else if (unhealthyChecks >= 1) {
    healthStatus.status = 'degraded';
  }

  // Calculate response time
  healthStatus.metrics.responseTime = Date.now() - startTime;

  // Add errors to response
  healthStatus.errors = errors;

  // Log health check results
  if (healthStatus.status !== 'healthy') {
    console.warn('Health check issues detected:', {
      status: healthStatus.status,
      checks: healthStatus.checks,
      errors: healthStatus.errors
    });
  }

  return new Response(JSON.stringify(healthStatus, null, 2), {
    status: healthStatus.status === 'healthy' ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

/**
 * Get error metrics for monitoring dashboard
 */
export async function getErrorMetricsHandler(
  request: Request,
  env: any,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const db = createDatabase(env.DATABASE_URL);
    
    // Get error metrics from the last 24 hours
    const errorMetrics = await db.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        error_type,
        COUNT(*) as error_count,
        COUNT(DISTINCT user_id) as affected_users
      FROM error_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY hour, error_type
      ORDER BY hour DESC
      LIMIT 100
    `);
    
    // Get performance metrics from the last hour
    const performanceMetrics = await db.query(`
      SELECT 
        endpoint,
        AVG(response_time) as avg_response_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_response_time,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99_response_time,
        COUNT(*) as request_count,
        COUNT(CASE WHEN status_code >= 500 THEN 1 END) as error_count
      FROM request_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY endpoint
      ORDER BY request_count DESC
      LIMIT 20
    `);
    
    // Get current active sessions
    const activeSessions = await db.query(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as recent_sessions
      FROM sessions
      WHERE expires_at > NOW()
    `);
    
    // Get recent critical errors
    const criticalErrors = await db.query(`
      SELECT 
        error_type,
        error_message,
        endpoint,
        COUNT(*) as occurrence_count,
        MAX(created_at) as last_occurrence
      FROM error_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
      AND status_code >= 500
      GROUP BY error_type, error_message, endpoint
      ORDER BY occurrence_count DESC
      LIMIT 10
    `);
    
    return ApiResponseBuilder.success({
      timestamp: new Date().toISOString(),
      errors: {
        timeline: errorMetrics.rows,
        critical: criticalErrors.rows
      },
      performance: performanceMetrics.rows,
      sessions: activeSessions.rows[0],
      summary: {
        totalErrors24h: errorMetrics.rows.reduce((sum: number, row: any) => 
          sum + parseInt(row.error_count), 0),
        avgResponseTime: performanceMetrics.rows.reduce((sum: number, row: any) => 
          sum + parseFloat(row.avg_response_time), 0) / (performanceMetrics.rows.length || 1),
        activeSessions: activeSessions.rows[0]?.total_sessions || 0
      }
    });
    
  } catch (error) {
    console.error('Metrics retrieval error:', error);
    return ApiResponseBuilder.error(
      'INTERNAL_ERROR' as any,
      'Failed to retrieve metrics'
    );
  }
}

/**
 * Log a request for performance monitoring
 */
export async function logRequestMetrics(
  request: Request,
  response: Response,
  responseTime: number,
  env: any,
  userId?: string
): Promise<void> {
  try {
    const db = createDatabase(env.DATABASE_URL);
    const url = new URL(request.url);
    
    await db.query(
      `INSERT INTO request_logs (user_id, endpoint, method, response_time, status_code, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId || null,
        url.pathname,
        request.method,
        responseTime,
        response.status,
        request.headers.get('CF-Connecting-IP') || null
      ]
    );
  } catch (error) {
    // Don't throw - logging shouldn't break the request
    console.error('Failed to log request metrics:', error);
  }
}

/**
 * Log an error for monitoring
 */
export async function logError(
  error: any,
  request: Request,
  env: any,
  userId?: string
): Promise<void> {
  try {
    const db = createDatabase(env.DATABASE_URL);
    const url = new URL(request.url);
    
    await db.query(
      `INSERT INTO error_logs (user_id, error_type, error_message, error_stack, endpoint, method, status_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId || null,
        error.name || 'Error',
        error.message || 'Unknown error',
        error.stack || null,
        url.pathname,
        request.method,
        error.statusCode || 500
      ]
    );
  } catch (logError) {
    // Don't throw - logging shouldn't break the request
    console.error('Failed to log error:', logError);
  }
}