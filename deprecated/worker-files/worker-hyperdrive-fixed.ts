/**
 * Cloudflare Worker with Proper Hyperdrive Integration
 * 
 * This worker demonstrates the correct way to use Hyperdrive with Neon PostgreSQL:
 * - Direct Hyperdrive binding usage (not via connectionString)
 * - Proper error handling and fallback
 * - Connection health monitoring
 * - Performance optimization
 */

import { neon } from '@neondatabase/serverless';

// Correct Hyperdrive interface
interface Hyperdrive {
  prepare(sql: string): {
    bind(...params: any[]): {
      run(): Promise<any>;
      all(): Promise<any>;
      first(): Promise<any>;
    };
  };
}

interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  HYPERDRIVE?: Hyperdrive;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  FRONTEND_URL: string;
}

interface DatabaseInterface {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryFirst<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ rowsAffected: number; lastInsertId?: any }>;
  healthCheck(): Promise<boolean>;
}

/**
 * Database service with Hyperdrive support and fallback
 */
class HyperdriveDatabaseService implements DatabaseInterface {
  private useHyperdrive: boolean;
  private hyperdriveConnection?: Hyperdrive;
  private directConnection?: any;
  private healthStatus: { healthy: boolean; lastCheck: number; errorCount: number } = {
    healthy: true,
    lastCheck: Date.now(),
    errorCount: 0
  };

  constructor(env: Env) {
    this.useHyperdrive = !!env.HYPERDRIVE;
    
    if (this.useHyperdrive) {
      console.log('🚀 Initializing with Hyperdrive connection');
      this.hyperdriveConnection = env.HYPERDRIVE;
    } else {
      console.log('⚠️  Hyperdrive not available, falling back to direct connection');
      if (!env.DATABASE_URL) {
        throw new Error('Neither HYPERDRIVE nor DATABASE_URL is available');
      }
      this.directConnection = neon(env.DATABASE_URL, {
        fullResults: true,
        arrayMode: false
      });
    }
  }

  /**
   * Execute a query and return all results
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      if (this.useHyperdrive && this.hyperdriveConnection) {
        return await this.executeHyperdriveQuery(sql, params, 'all');
      } else if (this.directConnection) {
        return await this.executeDirectQuery(sql, params);
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      await this.handleError(error, sql);
      throw error;
    }
  }

  /**
   * Execute a query and return the first result
   */
  async queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    try {
      if (this.useHyperdrive && this.hyperdriveConnection) {
        return await this.executeHyperdriveQuery(sql, params, 'first');
      } else if (this.directConnection) {
        const results = await this.executeDirectQuery(sql, params);
        return results[0] || null;
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      await this.handleError(error, sql);
      throw error;
    }
  }

  /**
   * Execute a query that modifies data
   */
  async execute(sql: string, params: any[] = []): Promise<{ rowsAffected: number; lastInsertId?: any }> {
    try {
      if (this.useHyperdrive && this.hyperdriveConnection) {
        const result = await this.executeHyperdriveQuery(sql, params, 'run');
        return {
          rowsAffected: result.changes || 0,
          lastInsertId: result.meta?.last_row_id
        };
      } else if (this.directConnection) {
        const result = await this.directConnection(sql, params);
        return {
          rowsAffected: result.rowCount || 0,
          lastInsertId: result.insertId
        };
      } else {
        throw new Error('No database connection available');
      }
    } catch (error) {
      await this.handleError(error, sql);
      throw error;
    }
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.query('SELECT 1 as health_check');
      const duration = Date.now() - startTime;
      
      this.healthStatus = {
        healthy: true,
        lastCheck: Date.now(),
        errorCount: 0
      };
      
      console.log(`✅ Health check passed in ${duration}ms using ${this.useHyperdrive ? 'Hyperdrive' : 'direct'}`);
      return true;
    } catch (error) {
      this.healthStatus = {
        healthy: false,
        lastCheck: Date.now(),
        errorCount: this.healthStatus.errorCount + 1
      };
      
      console.error('❌ Health check failed:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      type: this.useHyperdrive ? 'hyperdrive' : 'direct',
      healthy: this.healthStatus.healthy,
      lastCheck: new Date(this.healthStatus.lastCheck).toISOString(),
      errorCount: this.healthStatus.errorCount
    };
  }

  // Private methods

  private async executeHyperdriveQuery(sql: string, params: any[], method: 'all' | 'first' | 'run'): Promise<any> {
    if (!this.hyperdriveConnection) {
      throw new Error('Hyperdrive connection not available');
    }

    const stmt = this.hyperdriveConnection.prepare(sql);
    
    if (params.length > 0) {
      const boundStmt = stmt.bind(...params);
      return await boundStmt[method]();
    } else {
      return await stmt[method]();
    }
  }

  private async executeDirectQuery(sql: string, params: any[]): Promise<any> {
    if (!this.directConnection) {
      throw new Error('Direct connection not available');
    }

    if (params.length > 0) {
      return await this.directConnection(sql, params);
    } else {
      return await this.directConnection(sql);
    }
  }

  private async handleError(error: any, sql: string): Promise<void> {
    this.healthStatus.errorCount++;
    
    console.error('Database operation failed:', {
      error: error.message,
      sql: sql.substring(0, 100) + '...',
      connectionType: this.useHyperdrive ? 'hyperdrive' : 'direct',
      errorCount: this.healthStatus.errorCount
    });

    // If Hyperdrive fails multiple times, consider fallback
    if (this.useHyperdrive && this.healthStatus.errorCount >= 3) {
      console.warn('🔄 Hyperdrive experiencing issues, consider implementing fallback logic');
    }
  }
}

/**
 * Enhanced user authentication with proper Hyperdrive integration
 */
class AuthService {
  constructor(private db: DatabaseInterface, private jwtSecret: string) {}

  async authenticateUser(email: string, password: string, userType: 'creator' | 'investor' | 'production') {
    try {
      console.log(`🔐 Authenticating ${userType}: ${email}`);

      // Query using the database interface (works with both Hyperdrive and direct)
      const user = await this.db.queryFirst(`
        SELECT 
          id, 
          email, 
          password_hash, 
          first_name,
          last_name,
          company_name,
          created_at
        FROM users 
        WHERE email = $1 AND user_type = $2 AND deleted_at IS NULL
      `, [email, userType]);

      if (!user) {
        console.log('❌ User not found');
        return { success: false, error: 'Invalid credentials' };
      }

      // Verify password (implement bcrypt comparison here)
      const passwordValid = await this.verifyPassword(password, user.password_hash);
      if (!passwordValid) {
        console.log('❌ Invalid password');
        return { success: false, error: 'Invalid credentials' };
      }

      // Generate JWT token (implement JWT generation here)
      const token = await this.generateJWT(user);

      console.log('✅ Authentication successful');
      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          companyName: user.company_name,
          userType
        }
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    // Implement bcrypt.compare here
    // For now, basic comparison (NEVER use in production)
    return password === hash;
  }

  private async generateJWT(user: any): Promise<string> {
    // Implement JWT signing here
    return `jwt_token_for_${user.id}`;
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Initialize database service
      const db = new HyperdriveDatabaseService(env);

      // Health check endpoint
      if (path === '/api/health') {
        const isHealthy = await db.healthCheck();
        const status = db.getConnectionStatus();
        
        return new Response(JSON.stringify({
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          connection: status,
          hyperdrive: {
            enabled: !!env.HYPERDRIVE,
            available: status.type === 'hyperdrive'
          }
        }), {
          status: isHealthy ? 200 : 503,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      // Database connection test endpoint
      if (path === '/api/test/connection') {
        const startTime = Date.now();
        
        try {
          const testResult = await db.query(`
            SELECT 
              1 as test_value,
              current_timestamp as server_time,
              pg_backend_pid() as backend_pid,
              version() as pg_version
          `);
          
          const responseTime = Date.now() - startTime;
          const connectionStatus = db.getConnectionStatus();
          
          return new Response(JSON.stringify({
            success: true,
            responseTime,
            connection: connectionStatus,
            testResult: testResult[0],
            recommendations: this.generatePerformanceRecommendations(responseTime, connectionStatus)
          }), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          const responseTime = Date.now() - startTime;
          
          return new Response(JSON.stringify({
            success: false,
            responseTime,
            error: error instanceof Error ? error.message : String(error),
            connection: db.getConnectionStatus()
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Authentication endpoints
      if (path.startsWith('/api/auth/') && request.method === 'POST') {
        const userType = path.split('/')[3] as 'creator' | 'investor' | 'production';
        
        if (['creator', 'investor', 'production'].includes(userType) && path.endsWith('/login')) {
          const authService = new AuthService(db, env.JWT_SECRET);
          const body = await request.json() as { email: string; password: string };
          
          const result = await authService.authenticateUser(body.email, body.password, userType);
          
          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }

      // Default 404 response
      return new Response('Not Found', { 
        status: 404, 
        headers: corsHeaders 
      });

    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  },

  generatePerformanceRecommendations(responseTime: number, connectionStatus: any): string[] {
    const recommendations: string[] = [];
    
    if (responseTime > 1000) {
      recommendations.push('⚠️ High response time detected. Consider optimizing queries or checking network connectivity.');
    }
    
    if (connectionStatus.type === 'direct') {
      recommendations.push('🚀 Consider enabling Hyperdrive for better connection pooling and performance.');
    } else {
      recommendations.push('✅ Using Hyperdrive for optimized connection pooling.');
    }
    
    if (connectionStatus.errorCount > 0) {
      recommendations.push(`⚠️ ${connectionStatus.errorCount} errors detected. Monitor connection stability.`);
    }
    
    if (responseTime < 100) {
      recommendations.push('🎯 Excellent response time! Your database configuration is optimized.');
    }
    
    return recommendations;
  }
};