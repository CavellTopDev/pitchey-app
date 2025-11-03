/**
 * User Service for Cloudflare Workers
 * Migrated from Deno to Workers with Hyperdrive optimization
 */

import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import { users } from '../../db/schema';
import type { WorkerDatabase } from '../../db/worker-client';
import { QueryCache } from '../../db/worker-client';
import * as bcrypt from 'bcryptjs';

export interface UserFilters {
  userType?: string;
  location?: string;
  companyVerified?: boolean;
  isActive?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class WorkerUserService {
  private db: WorkerDatabase;
  private cache: QueryCache;

  constructor(db: WorkerDatabase, cache: KVNamespace | null = null) {
    this.db = db;
    this.cache = new QueryCache(cache, 300); // 5 minute TTL
  }

  /**
   * Find user by ID with caching
   */
  async findById(id: number) {
    const cacheKey = `user:${id}`;
    
    return this.cache.withCache(
      cacheKey,
      async () => {
        const result = await this.db
          .select()
          .from(users)
          .where(eq(users.id, id))
          .limit(1);
        
        return result[0] || null;
      },
      600 // 10 minute TTL for individual users
    );
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string) {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Get users with filters and pagination
   */
  async getUsers(filters: UserFilters = {}, options: PaginationOptions = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const offset = (page - 1) * limit;
    
    // Build cache key from filters and options
    const cacheKey = `users:list:${JSON.stringify({ filters, options })}`;
    
    return this.cache.withCache(cacheKey, async () => {
      // Build where conditions
      const conditions = [];
      
      if (filters.userType) {
        conditions.push(eq(users.userType, filters.userType));
      }
      
      if (filters.location) {
        conditions.push(like(users.location, `%${filters.location}%`));
      }
      
      if (filters.companyVerified !== undefined) {
        conditions.push(eq(users.companyVerified, filters.companyVerified));
      }
      
      if (filters.isActive !== undefined) {
        conditions.push(eq(users.isActive, filters.isActive));
      }
      
      if (filters.search) {
        conditions.push(
          or(
            like(users.username, `%${filters.search}%`),
            like(users.email, `%${filters.search}%`),
            like(users.firstName, `%${filters.search}%`),
            like(users.lastName, `%${filters.search}%`)
          )
        );
      }

      // Build query
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      // Get total count
      const countResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(whereClause);
      
      const total = Number(countResult[0]?.count || 0);
      
      // Get paginated results
      const query = this.db
        .select()
        .from(users)
        .where(whereClause)
        .limit(limit)
        .offset(offset);
      
      // Apply sorting
      const sortField = users[sortBy as keyof typeof users] || users.createdAt;
      if (sortOrder === 'asc') {
        query.orderBy(asc(sortField));
      } else {
        query.orderBy(desc(sortField));
      }
      
      const data = await query;
      
      // Remove sensitive data
      const sanitizedData = data.map(user => {
        const { passwordHash, emailVerificationToken, ...sanitized } = user;
        return sanitized;
      });
      
      return {
        data: sanitizedData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    });
  }

  /**
   * Create a new user
   */
  async createUser(userData: {
    email: string;
    username: string;
    password: string;
    userType: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
  }) {
    // Hash password using bcryptjs (Workers-compatible)
    const passwordHash = await bcrypt.hash(userData.password, 10);
    
    // Create user
    const newUser = await this.db
      .insert(users)
      .values({
        email: userData.email.toLowerCase(),
        username: userData.username.toLowerCase(),
        passwordHash,
        userType: userData.userType,
        firstName: userData.firstName,
        lastName: userData.lastName,
        companyName: userData.companyName,
        emailVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    // Invalidate relevant caches
    await this.cache.invalidate('users:list:');
    
    // Remove sensitive data before returning
    const { passwordHash: _, ...sanitizedUser } = newUser[0];
    return sanitizedUser;
  }

  /**
   * Update user
   */
  async updateUser(id: number, updates: Partial<typeof users.$inferInsert>) {
    // Don't allow updating certain fields
    delete updates.id;
    delete updates.passwordHash;
    delete updates.emailVerificationToken;
    
    const updated = await this.db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    
    if (updated.length === 0) {
      return null;
    }
    
    // Invalidate caches
    await Promise.all([
      this.cache.invalidate(`user:${id}`),
      this.cache.invalidate('users:list:')
    ]);
    
    const { passwordHash, ...sanitizedUser } = updated[0];
    return sanitizedUser;
  }

  /**
   * Update password
   */
  async updatePassword(id: number, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    await this.db
      .update(users)
      .set({
        passwordHash,
        lastPasswordChangeAt: new Date(),
        requirePasswordChange: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, id));
    
    // Invalidate user cache
    await this.cache.invalidate(`user:${id}`);
    
    return true;
  }

  /**
   * Verify password
   */
  async verifyPassword(user: any, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Record login
   */
  async recordLogin(id: number) {
    await this.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        accountLockedUntil: null
      })
      .where(eq(users.id, id));
    
    // Invalidate user cache
    await this.cache.invalidate(`user:${id}`);
  }

  /**
   * Record failed login
   */
  async recordFailedLogin(email: string) {
    const user = await this.findByEmail(email);
    if (!user) return;
    
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const updates: any = {
      failedLoginAttempts: attempts,
      lastFailedLogin: new Date()
    };
    
    // Lock account after 5 failed attempts
    if (attempts >= 5) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 30); // 30 minute lock
      
      updates.accountLockedUntil = lockUntil;
      updates.accountLockedAt = new Date();
      updates.accountLockReason = 'Too many failed login attempts';
    }
    
    await this.db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id));
    
    // Invalidate user cache
    await this.cache.invalidate(`user:${user.id}`);
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(id: number) {
    const deleted = await this.db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    
    if (deleted.length === 0) {
      return false;
    }
    
    // Invalidate caches
    await Promise.all([
      this.cache.invalidate(`user:${id}`),
      this.cache.invalidate('users:list:')
    ]);
    
    return true;
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    const cacheKey = 'users:stats';
    
    return this.cache.withCache(cacheKey, async () => {
      const stats = await this.db
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`count(*) filter (where is_active = true)`,
          verified: sql<number>`count(*) filter (where email_verified = true)`,
          creators: sql<number>`count(*) filter (where user_type = 'creator')`,
          investors: sql<number>`count(*) filter (where user_type = 'investor')`,
          production: sql<number>`count(*) filter (where user_type = 'production')`
        })
        .from(users);
      
      return stats[0] || {
        total: 0,
        active: 0,
        verified: 0,
        creators: 0,
        investors: 0,
        production: 0
      };
    }, 3600); // 1 hour TTL for stats
  }

  /**
   * Search users with full-text search
   */
  async searchUsers(query: string, limit = 10) {
    const cacheKey = `users:search:${query}:${limit}`;
    
    return this.cache.withCache(cacheKey, async () => {
      const searchPattern = `%${query}%`;
      
      const results = await this.db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          userType: users.userType,
          profileImageUrl: users.profileImageUrl
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            or(
              like(users.username, searchPattern),
              like(users.email, searchPattern),
              like(users.firstName, searchPattern),
              like(users.lastName, searchPattern),
              like(users.companyName, searchPattern)
            )
          )
        )
        .limit(limit);
      
      return results;
    }, 300); // 5 minute cache for search results
  }
}

/**
 * Factory function to create UserService with proper initialization
 */
export function createUserService(db: WorkerDatabase, cache?: KVNamespace): WorkerUserService {
  return new WorkerUserService(db, cache);
}

export default WorkerUserService;