// Optimized User Service - Fixes N+1 queries and implements smart caching
// Replaces multiple database calls with efficient joins and Redis caching

import { db } from "../db/client.ts";
import { users, pitches, follows, ndas, messages, notifications } from "../db/schema.ts";
import { eq, and, desc, sql, count, isNull } from "npm:drizzle-orm@0.35.3";
import { databaseCacheService, CacheConfigs, CacheHelpers } from "./database-cache.service.ts";
import { AuthService } from "./auth.service.ts";

export interface UserWithStats {
  id: number;
  email: string;
  username: string;
  userType: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  bio?: string;
  profileImage?: string;
  emailVerified: boolean;
  stats?: {
    // Creator stats
    totalPitches?: number;
    publishedPitches?: number;
    totalViews?: number;
    totalLikes?: number;
    totalNDAs?: number;
    
    // Investor/User stats
    totalFollows?: number;
    unreadMessages?: number;
    unreadNotifications?: number;
    activeNDAs?: number;
  };
}

export class OptimizedUserService {
  // Re-export auth methods for convenience
  static register = AuthService.register;
  static login = AuthService.login;
  static verifySession = AuthService.verifySession;
  static logout = AuthService.logout;
  static verifyToken = AuthService.verifyToken;

  /**
   * Get user by ID with caching and optional stats
   * Replaces: Multiple queries for user + stats
   * With: Single query + cache
   */
  static async getUserById(
    userId: number, 
    includeStats = false
  ): Promise<UserWithStats | null> {
    const cacheKey = CacheHelpers.userKey(userId);
    
    return databaseCacheService.withCache(
      "profile", 
      `${cacheKey}:${includeStats ? 'with-stats' : 'basic'}`,
      async () => {
        console.log(`👤 Executing optimized user query for ID: ${userId}`);
        
        // Get user basic data
        const userResult = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: {
            id: true,
            email: true,
            username: true,
            userType: true,
            firstName: true,
            lastName: true,
            phone: true,
            location: true,
            bio: true,
            profileImageUrl: true,
            companyName: true,
            companyWebsite: true,
            companyAddress: true,
            emailVerified: true,
            companyVerified: true,
            subscriptionTier: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            // Exclude sensitive fields
            passwordHash: false,
            emailVerificationToken: false,
          },
        });

        if (!userResult) return null;

        if (!includeStats) {
          return userResult as UserWithStats;
        }

        // Get stats in parallel based on user type
        let stats = {};
        
        if (userResult.userType === "creator") {
          // Creator stats - single optimized query
          const creatorStats = await db
            .select({
              totalPitches: count(pitches.id),
              publishedPitches: count(sql`CASE WHEN ${pitches.status} = 'published' THEN 1 END`),
              totalViews: sql<number>`COALESCE(SUM(${pitches.viewCount}), 0)`,
              totalLikes: sql<number>`COALESCE(SUM(${pitches.likeCount}), 0)`,
              totalNDAs: sql<number>`COALESCE(SUM(${pitches.ndaCount}), 0)`,
            })
            .from(pitches)
            .where(eq(pitches.userId, userId));

          stats = creatorStats[0] || {
            totalPitches: 0,
            publishedPitches: 0,
            totalViews: 0,
            totalLikes: 0,
            totalNDAs: 0
          };
          
        } else {
          // Investor/Production stats - parallel queries
          const [followStats, messageStats, notificationStats, ndaStats] = await Promise.all([
            // Follow count
            db.select({ count: count() })
              .from(follows)
              .where(eq(follows.followerId, userId)),
            
            // Unread messages
            db.select({ count: count() })
              .from(messages)
              .where(and(
                eq(messages.receiverId, userId),
                eq(messages.isRead, false)
              )),
            
            // Unread notifications
            db.select({ count: count() })
              .from(notifications)
              .where(and(
                eq(notifications.userId, userId),
                eq(notifications.isRead, false)
              )),
            
            // Active NDAs
            db.select({ count: count() })
              .from(ndas)
              .where(and(
                eq(ndas.signerId, userId),
                eq(ndas.status, "signed")
              ))
          ]);

          stats = {
            totalFollows: followStats[0]?.count || 0,
            unreadMessages: messageStats[0]?.count || 0,
            unreadNotifications: notificationStats[0]?.count || 0,
            activeNDAs: ndaStats[0]?.count || 0
          };
        }

        return {
          ...userResult,
          stats
        } as UserWithStats;
      },
      CacheConfigs.USER_PROFILE
    );
  }

  /**
   * Optimized user profile update with cache invalidation
   */
  static async updateProfile(userId: number, data: any) {
    console.log(`✏️ Updating profile for user: ${userId}`);
    
    const [updatedUser] = await db.update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        userType: users.userType,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        location: users.location,
        bio: users.bio,
        profileImageUrl: users.profileImageUrl,
        companyName: users.companyName,
        companyWebsite: users.companyWebsite,
        companyAddress: users.companyAddress,
        emailVerified: users.emailVerified,
        companyVerified: users.companyVerified,
        subscriptionTier: users.subscriptionTier,
        updatedAt: users.updatedAt,
      });

    // Invalidate user caches
    await databaseCacheService.batchInvalidate(
      CacheHelpers.invalidateUserData(userId)
    );
    
    return updatedUser;
  }

  /**
   * Get user dashboard data with optimized queries
   * Replaces: 5-10 separate queries per dashboard load
   * With: 2-3 parallel optimized queries + caching
   */
  static async getUserDashboardData(userId: number, userType: string) {
    const cacheKey = CacheHelpers.dashboardKey(userId, userType);
    
    return databaseCacheService.withCache(
      "dashboard",
      cacheKey,
      async () => {
        console.log(`📊 Executing optimized user dashboard query: ${userType}:${userId}`);
        
        // Get basic user info
        const user = await this.getUserById(userId, true);
        if (!user) throw new Error("User not found");

        const dashboardData: any = { user };

        if (userType === "creator") {
          // Creator-specific dashboard data
          const [recentPitches, recentActivity] = await Promise.all([
            // Recent pitches with stats
            db
              .select({
                id: pitches.id,
                title: pitches.title,
                status: pitches.status,
                viewCount: pitches.viewCount,
                likeCount: pitches.likeCount,
                ndaCount: pitches.ndaCount,
                updatedAt: pitches.updatedAt,
                publishedAt: pitches.publishedAt
              })
              .from(pitches)
              .where(eq(pitches.userId, userId))
              .orderBy(desc(pitches.updatedAt))
              .limit(5),
            
            // Recent activity (views, NDAs, messages)
            this.getUserRecentActivity(userId, 10)
          ]);

          dashboardData.recentPitches = recentPitches;
          dashboardData.recentActivity = recentActivity;
          
        } else {
          // Investor/Production dashboard data
          const [followedPitches, recentMessages] = await Promise.all([
            // Recently updated followed pitches
            db
              .select({
                follow: follows,
                pitch: {
                  id: pitches.id,
                  title: pitches.title,
                  status: pitches.status,
                  updatedAt: pitches.updatedAt,
                  viewCount: pitches.viewCount,
                  likeCount: pitches.likeCount
                },
                creator: {
                  username: users.username,
                  companyName: users.companyName,
                  userType: users.userType
                }
              })
              .from(follows)
              .leftJoin(pitches, eq(follows.pitchId, pitches.id))
              .leftJoin(users, eq(pitches.userId, users.id))
              .where(eq(follows.followerId, userId))
              .orderBy(desc(pitches.updatedAt))
              .limit(10),
            
            // Recent messages
            db
              .select({
                id: messages.id,
                subject: messages.subject,
                content: messages.content,
                isRead: messages.isRead,
                sentAt: messages.sentAt,
                sender: {
                  username: users.username,
                  userType: users.userType
                }
              })
              .from(messages)
              .leftJoin(users, eq(messages.senderId, users.id))
              .where(eq(messages.receiverId, userId))
              .orderBy(desc(messages.sentAt))
              .limit(5)
          ]);

          dashboardData.followedPitches = followedPitches;
          dashboardData.recentMessages = recentMessages;
        }

        return dashboardData;
      },
      CacheConfigs.DASHBOARD
    );
  }

  /**
   * Get user's recent activity efficiently
   * Combines multiple activity types in parallel queries
   */
  private static async getUserRecentActivity(userId: number, limit = 10) {
    const [pitchViews, ndaRequests, messageActivity] = await Promise.all([
      // Recent views on user's pitches
      db
        .select({
          type: sql<string>`'view'`,
          message: sql<string>`'Your pitch "' || ${pitches.title} || '" was viewed'`,
          timestamp: sql<Date>`${sql`pitch_views.viewed_at`}`,
          relatedId: pitches.id
        })
        .from(sql`pitch_views`)
        .leftJoin(pitches, sql`pitch_views.pitch_id = ${pitches.id}`)
        .where(eq(pitches.userId, userId))
        .orderBy(desc(sql`pitch_views.viewed_at`))
        .limit(5),
      
      // Recent NDA requests on user's pitches
      db
        .select({
          type: sql<string>`'nda'`,
          message: sql<string>`'NDA request for "' || ${pitches.title} || '"'`,
          timestamp: ndas.createdAt,
          relatedId: pitches.id
        })
        .from(ndas)
        .leftJoin(pitches, eq(ndas.pitchId, pitches.id))
        .where(eq(pitches.userId, userId))
        .orderBy(desc(ndas.createdAt))
        .limit(5),
      
      // Recent messages received
      db
        .select({
          type: sql<string>`'message'`,
          message: sql<string>`'New message: "' || COALESCE(${messages.subject}, 'No subject') || '"'`,
          timestamp: messages.sentAt,
          relatedId: messages.id
        })
        .from(messages)
        .where(eq(messages.receiverId, userId))
        .orderBy(desc(messages.sentAt))
        .limit(3)
    ]);

    // Combine and sort all activities
    const allActivity = [
      ...pitchViews.map(v => ({ ...v, timestamp: new Date(v.timestamp) })),
      ...ndaRequests.map(n => ({ ...n, timestamp: new Date(n.timestamp) })),
      ...messageActivity.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
    ];

    return allActivity
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Batch get multiple users efficiently
   * Replaces: N separate getUserById calls
   * With: Single query with caching
   */
  static async getUsersByIds(userIds: number[]): Promise<UserWithStats[]> {
    if (userIds.length === 0) return [];
    
    // Check cache for each user first
    const cachePromises = userIds.map(id => 
      databaseCacheService.getCachedQuery<UserWithStats>("profile", CacheHelpers.userKey(id))
    );
    
    const cachedUsers = await Promise.all(cachePromises);
    
    // Find missing users
    const missingIds = userIds.filter((id, index) => cachedUsers[index] === null);
    
    if (missingIds.length === 0) {
      return cachedUsers.filter(Boolean) as UserWithStats[];
    }

    // Fetch missing users in batch
    console.log(`👥 Batch fetching ${missingIds.length} users`);
    
    const fetchedUsers = await db.query.users.findMany({
      where: inArray(users.id, missingIds),
      columns: {
        passwordHash: false,
        emailVerificationToken: false,
      }
    });

    // Cache fetched users
    const cachePromises2 = fetchedUsers.map(user =>
      databaseCacheService.cacheQuery(
        "profile", 
        CacheHelpers.userKey(user.id), 
        user, 
        CacheConfigs.USER_PROFILE
      )
    );
    await Promise.allSettled(cachePromises2);

    // Combine cached and fetched users
    const result: UserWithStats[] = [];
    userIds.forEach((id, index) => {
      if (cachedUsers[index]) {
        result.push(cachedUsers[index] as UserWithStats);
      } else {
        const fetchedUser = fetchedUsers.find(u => u.id === id);
        if (fetchedUser) {
          result.push(fetchedUser as UserWithStats);
        }
      }
    });

    return result;
  }

  /**
   * Optimized follow operations with cache invalidation
   */
  static async followPitch(userId: number, pitchId: number) {
    const [follow] = await db.insert(follows)
      .values({
        followerId: userId,
        pitchId,
      })
      .onConflictDoNothing()
      .returning();

    // Invalidate relevant caches
    await Promise.all([
      databaseCacheService.invalidateQuery("profile", CacheHelpers.userKey(userId)),
      databaseCacheService.invalidatePattern(`dashboard:*:${userId}`),
      databaseCacheService.invalidatePattern(`pitches:*:${pitchId}*`)
    ]);
    
    return follow;
  }

  static async unfollowPitch(userId: number, pitchId: number) {
    await db.delete(follows)
      .where(and(
        eq(follows.followerId, userId),
        eq(follows.pitchId, pitchId)
      ));

    // Invalidate relevant caches
    await Promise.all([
      databaseCacheService.invalidateQuery("profile", CacheHelpers.userKey(userId)),
      databaseCacheService.invalidatePattern(`dashboard:*:${userId}`),
      databaseCacheService.invalidatePattern(`pitches:*:${pitchId}*`)
    ]);
  }

  /**
   * Get followed pitches with efficient pagination
   */
  static async getFollowedPitches(userId: number, limit = 20, offset = 0) {
    const cacheKey = `followed-pitches:${userId}:${limit}:${offset}`;
    
    return databaseCacheService.withCache(
      "pitches",
      cacheKey,
      async () => {
        console.log(`🔗 Getting followed pitches for user: ${userId}`);
        
        const results = await db
          .select({
            follow: follows,
            pitch: {
              id: pitches.id,
              title: pitches.title,
              logline: pitches.logline,
              genre: pitches.genre,
              format: pitches.format,
              status: pitches.status,
              viewCount: pitches.viewCount,
              likeCount: pitches.likeCount,
              ndaCount: pitches.ndaCount,
              publishedAt: pitches.publishedAt,
              titleImage: pitches.titleImage
            },
            creator: {
              id: users.id,
              username: users.username,
              companyName: users.companyName,
              userType: users.userType,
              profileImageUrl: users.profileImageUrl,
            },
          })
          .from(follows)
          .leftJoin(pitches, eq(follows.pitchId, pitches.id))
          .leftJoin(users, eq(pitches.userId, users.id))
          .where(eq(follows.followerId, userId))
          .orderBy(desc(follows.followedAt))
          .limit(limit)
          .offset(offset);

        return results.map(row => ({
          ...row.follow,
          pitch: {
            ...row.pitch,
            creator: row.creator,
          },
        }));
      },
      CacheConfigs.PITCHES
    );
  }

  /**
   * Account management with cache cleanup
   */
  static async deactivateAccount(userId: number) {
    const [deactivatedUser] = await db.update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        isActive: users.isActive,
      });

    // Set pitches to hidden
    await db.update(pitches)
      .set({
        status: "hidden",
        updatedAt: new Date(),
      })
      .where(eq(pitches.userId, userId));

    // Clear all user-related caches
    await databaseCacheService.batchInvalidate(
      CacheHelpers.invalidateUserData(userId)
    );
    
    return deactivatedUser;
  }

  /**
   * User search with caching
   */
  static async searchUsers(params: {
    query?: string;
    userType?: string;
    limit?: number;
    offset?: number;
  }) {
    const cacheKey = `user-search:${JSON.stringify(params)}`;
    
    return databaseCacheService.withCache(
      "search",
      cacheKey,
      async () => {
        console.log("🔍 Executing user search query");
        
        const conditions = [eq(users.isActive, true)];
        
        if (params.userType) {
          conditions.push(eq(users.userType, params.userType as any));
        }

        if (params.query?.trim()) {
          conditions.push(
            or(
              sql`LOWER(${users.username}) LIKE ${`%${params.query.toLowerCase()}%`}`,
              sql`LOWER(${users.companyName}) LIKE ${`%${params.query.toLowerCase()}%`}`,
              sql`LOWER(${users.firstName} || ' ' || ${users.lastName}) LIKE ${`%${params.query.toLowerCase()}%`}`
            )
          );
        }

        return await db.query.users.findMany({
          where: and(...conditions),
          limit: params.limit || 20,
          offset: params.offset || 0,
          orderBy: [desc(users.createdAt)],
          columns: {
            passwordHash: false,
            emailVerificationToken: false,
          },
        });
      },
      CacheConfigs.SEARCH
    );
  }
}