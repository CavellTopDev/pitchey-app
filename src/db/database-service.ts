/**
 * Database Service Layer
 * 
 * Provides high-level database operations with:
 * - Transaction support with automatic rollback
 * - Comprehensive error handling using the error serializer
 * - Query timeout management
 * - Connection pool management
 * - Automatic retry for transient failures
 * - Performance monitoring and logging
 */

import { eq, and, or, gte, lte, desc, asc, like, sql, count, inArray } from 'drizzle-orm';
import { withDatabase, getDatabaseInstance, checkDatabaseHealth, getDatabaseStats } from './connection-manager.ts';
import { logError, getErrorMessage, errorToResponse } from '../utils/error-serializer.ts';
import * as schema from './schema.ts';

export interface DatabaseOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  duration?: number;
}

export interface TransactionOptions {
  timeoutMs?: number;
  maxRetries?: number;
  rollbackOnError?: boolean;
}

export interface QueryOptions {
  timeoutMs?: number;
  cacheTtl?: number;
  skipCache?: boolean;
}

/**
 * Database Service Class
 * Wraps all database operations with error handling and performance monitoring
 */
export class DatabaseService {
  constructor(private env: any) {}

  /**
   * Execute a simple database query with error handling
   */
  async query<T>(
    operation: (db: any) => Promise<T>,
    operationName = 'database query',
    options: QueryOptions = {}
  ): Promise<DatabaseOperationResult<T>> {
    const startTime = Date.now();
    
    try {
      const result = await withDatabase(
        this.env,
        operation,
        operationName
      );

      const duration = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logError(error, `Database query failed: ${operationName}`, {
        duration,
        options,
      });

      return {
        success: false,
        error: getErrorMessage(error),
        errorCode: (error as any)?.code,
        duration,
      };
    }
  }

  /**
   * Execute multiple operations in a transaction
   */
  async transaction<T>(
    operations: (db: any, tx: any) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<DatabaseOperationResult<T>> {
    const startTime = Date.now();
    const rollbackOnError = options.rollbackOnError !== false;
    
    try {
      const result = await withDatabase(
        this.env,
        async (db) => {
          // Use Drizzle's transaction method
          return await db.transaction(async (tx) => {
            try {
              const result = await operations(db, tx);
              return result;
            } catch (error) {
              if (rollbackOnError) {
                console.log('Transaction error, rolling back...');
                throw error; // This will trigger Drizzle's automatic rollback
              }
              throw error;
            }
          });
        },
        'database transaction'
      );

      const duration = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logError(error, 'Database transaction failed', {
        duration,
        options,
        rollbackOnError,
      });

      return {
        success: false,
        error: getErrorMessage(error),
        errorCode: (error as any)?.code,
        duration,
      };
    }
  }

  /**
   * Health check for the database connection
   */
  async healthCheck(): Promise<DatabaseOperationResult<{
    status: string;
    connectionStats: any;
    latency: number;
  }>> {
    const startTime = Date.now();
    
    try {
      const healthResult = await checkDatabaseHealth(this.env);
      const stats = getDatabaseStats();
      const latency = Date.now() - startTime;
      
      const status = healthResult.isHealthy ? 'healthy' : 'unhealthy';
      
      return {
        success: true,
        data: {
          status,
          connectionStats: stats,
          latency,
        },
        duration: latency,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logError(error, 'Database health check failed', { duration });
      
      return {
        success: false,
        error: getErrorMessage(error),
        errorCode: (error as any)?.code,
        duration,
      };
    }
  }

  /**
   * Common database operations with built-in error handling
   */

  // User operations
  async getUser(userId: number): Promise<DatabaseOperationResult<any>> {
    return this.query(
      async (db) => {
        const user = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);
        
        return user[0] || null;
      },
      `get user ${userId}`
    );
  }

  async getUserByEmail(email: string): Promise<DatabaseOperationResult<any>> {
    return this.query(
      async (db) => {
        const user = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);
        
        return user[0] || null;
      },
      `get user by email ${email}`
    );
  }

  async createUser(userData: any): Promise<DatabaseOperationResult<any>> {
    return this.query(
      async (db) => {
        const result = await db
          .insert(schema.users)
          .values(userData)
          .returning();
        
        return result[0];
      },
      'create user'
    );
  }

  async updateUser(userId: number, updateData: any): Promise<DatabaseOperationResult<any>> {
    return this.query(
      async (db) => {
        const result = await db
          .update(schema.users)
          .set(updateData)
          .where(eq(schema.users.id, userId))
          .returning();
        
        return result[0] || null;
      },
      `update user ${userId}`
    );
  }

  // Pitch operations
  async getPitch(pitchId: number): Promise<DatabaseOperationResult<any>> {
    return this.query(
      async (db) => {
        const pitch = await db
          .select()
          .from(schema.pitches)
          .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id))
          .where(eq(schema.pitches.id, pitchId))
          .limit(1);
        
        return pitch[0] || null;
      },
      `get pitch ${pitchId}`
    );
  }

  async getUserPitches(userId: number, status?: string): Promise<DatabaseOperationResult<any[]>> {
    return this.query(
      async (db) => {
        let query = db
          .select()
          .from(schema.pitches)
          .where(eq(schema.pitches.userId, userId));
        
        if (status) {
          query = query.where(and(
            eq(schema.pitches.userId, userId),
            eq(schema.pitches.status, status)
          ));
        }
        
        return await query.orderBy(desc(schema.pitches.createdAt));
      },
      `get user pitches for user ${userId}`
    );
  }

  async createPitch(pitchData: any): Promise<DatabaseOperationResult<any>> {
    return this.query(
      async (db) => {
        const result = await db
          .insert(schema.pitches)
          .values(pitchData)
          .returning();
        
        return result[0];
      },
      'create pitch'
    );
  }

  async updatePitch(pitchId: number, updateData: any): Promise<DatabaseOperationResult<any>> {
    return this.query(
      async (db) => {
        const result = await db
          .update(schema.pitches)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(schema.pitches.id, pitchId))
          .returning();
        
        return result[0] || null;
      },
      `update pitch ${pitchId}`
    );
  }

  async deletePitch(pitchId: number): Promise<DatabaseOperationResult<boolean>> {
    return this.query(
      async (db) => {
        const result = await db
          .delete(schema.pitches)
          .where(eq(schema.pitches.id, pitchId))
          .returning();
        
        return result.length > 0;
      },
      `delete pitch ${pitchId}`
    );
  }

  // Search operations
  async searchPitches(searchTerm: string, filters: any = {}): Promise<DatabaseOperationResult<any[]>> {
    return this.query(
      async (db) => {
        let query = db
          .select()
          .from(schema.pitches)
          .leftJoin(schema.users, eq(schema.pitches.userId, schema.users.id));

        // Add search condition
        if (searchTerm) {
          query = query.where(
            or(
              like(schema.pitches.title, `%${searchTerm}%`),
              like(schema.pitches.logline, `%${searchTerm}%`),
              like(schema.pitches.description, `%${searchTerm}%`)
            )
          );
        }

        // Add filters
        if (filters.genre) {
          query = query.where(like(schema.pitches.genre, `%${filters.genre}%`));
        }

        if (filters.status) {
          query = query.where(eq(schema.pitches.status, filters.status));
        }

        if (filters.minBudget || filters.maxBudget) {
          if (filters.minBudget) {
            query = query.where(gte(schema.pitches.estimatedBudget, filters.minBudget));
          }
          if (filters.maxBudget) {
            query = query.where(lte(schema.pitches.estimatedBudget, filters.maxBudget));
          }
        }

        return await query
          .orderBy(desc(schema.pitches.createdAt))
          .limit(filters.limit || 50);
      },
      `search pitches: "${searchTerm}"`
    );
  }

  // Analytics operations
  async recordAnalyticsEvent(eventData: any): Promise<DatabaseOperationResult<any>> {
    return this.query(
      async (db) => {
        const result = await db
          .insert(schema.analyticsEvents)
          .values({
            ...eventData,
            timestamp: new Date(),
          })
          .returning();
        
        return result[0];
      },
      'record analytics event'
    );
  }

  async getDashboardStats(userId?: number): Promise<DatabaseOperationResult<any>> {
    return this.query(
      async (db) => {
        const baseQuery = db.select({
          total: count(),
        });

        if (userId) {
          const userStats = await baseQuery
            .from(schema.pitches)
            .where(eq(schema.pitches.userId, userId));
          
          const totalPitches = userStats[0]?.total || 0;
          
          return {
            totalPitches,
            userStats: true,
          };
        }

        // Global stats
        const pitchStats = await baseQuery.from(schema.pitches);
        const userStats = await baseQuery.from(schema.users);
        
        return {
          totalPitches: pitchStats[0]?.total || 0,
          totalUsers: userStats[0]?.total || 0,
          userStats: false,
        };
      },
      'get dashboard stats'
    );
  }

  /**
   * Batch operations for better performance
   */
  async batchInsert<T>(
    table: any,
    records: T[],
    batchSize = 100
  ): Promise<DatabaseOperationResult<any[]>> {
    if (records.length === 0) {
      return { success: true, data: [] };
    }

    return this.transaction(
      async (db, tx) => {
        const results = [];
        
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          const batchResult = await tx
            .insert(table)
            .values(batch)
            .returning();
          
          results.push(...batchResult);
        }
        
        return results;
      },
      { rollbackOnError: true }
    );
  }

  /**
   * Cache integration (for future implementation with KV)
   */
  async getCached<T>(
    cacheKey: string,
    operation: (db: any) => Promise<T>,
    cacheTtlSeconds = 300
  ): Promise<DatabaseOperationResult<T>> {
    // For now, just execute the operation
    // In the future, integrate with Cloudflare KV for caching
    return this.query(operation, `cached operation: ${cacheKey}`);
  }

  /**
   * Error response helper for API endpoints
   */
  toApiResponse(result: DatabaseOperationResult<any>): {
    success: boolean;
    data?: any;
    message?: string;
    error?: any;
  } {
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: false,
      message: result.error || 'Database operation failed',
      error: errorToResponse({
        message: result.error,
        code: result.errorCode,
      }),
    };
  }
}

/**
 * Factory function to create a database service instance
 */
export function createDatabaseService(env: any): DatabaseService {
  return new DatabaseService(env);
}

/**
 * Helper function for quick database operations
 */
export async function withDatabaseService<T>(
  env: any,
  operation: (db: DatabaseService) => Promise<T>
): Promise<T> {
  const dbService = createDatabaseService(env);
  return operation(dbService);
}