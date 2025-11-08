// Optimized Pitch Service - Fixes N+1 queries and implements caching
// Replaces multiple separate queries with efficient joins and Redis caching

import { db } from "../db/client.ts";
import { pitches, ndas, pitchViews, follows, users, pitchLikes } from "../db/schema.ts";
import { eq, and, desc, sql, or, inArray, gte, count } from "npm:drizzle-orm@0.35.3";
import { databaseCacheService, CacheConfigs, CacheHelpers } from "./database-cache.service.ts";

export interface OptimizedPitchQuery {
  withCreator?: boolean;
  withStats?: boolean;
  withNdaStatus?: boolean;
  withUserInteractions?: boolean;
  userId?: number;
}

export interface PitchWithRelations {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  status: string;
  // ... other pitch fields
  creator?: {
    id: number;
    username: string;
    userType: string;
    companyName?: string;
  };
  stats?: {
    viewCount: number;
    likeCount: number;
    ndaCount: number;
    isLiked?: boolean;
    isFollowed?: boolean;
    hasNda?: boolean;
  };
}

export class OptimizedPitchService {
  /**
   * Get trending pitches with optimized single query + caching
   * Replaces: Multiple separate queries for each pitch
   * With: Single join query + 15-minute cache
   */
  static async getTrendingPitches(
    limit = 10, 
    timeframe = '24h',
    userId?: number
  ): Promise<PitchWithRelations[]> {
    const cacheKey = CacheHelpers.trendingKey(timeframe);
    
    return databaseCacheService.withCache(
      "trending",
      `${cacheKey}:${limit}:${userId || 'anonymous'}`,
      async () => {
        console.log("🔥 Executing optimized trending pitches query");
        
        // Calculate trending score based on recency and engagement
        const hoursAgo = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 720;
        const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
        
        const query = db
          .select({
            // Pitch fields
            id: pitches.id,
            title: pitches.title,
            logline: pitches.logline,
            genre: pitches.genre,
            format: pitches.format,
            formatCategory: pitches.formatCategory,
            formatSubtype: pitches.formatSubtype,
            shortSynopsis: pitches.shortSynopsis,
            status: pitches.status,
            viewCount: pitches.viewCount,
            likeCount: pitches.likeCount,
            ndaCount: pitches.ndaCount,
            publishedAt: pitches.publishedAt,
            titleImage: pitches.titleImage,
            seekingInvestment: pitches.seekingInvestment,
            requireNda: pitches.requireNda,
            
            // Creator fields (single join)
            creatorId: users.id,
            creatorUsername: users.username,
            creatorUserType: users.userType,
            creatorCompanyName: users.companyName,
            
            // Calculated trending score
            trendingScore: sql<number>`
              (${pitches.likeCount} * 3 + ${pitches.viewCount} * 1 + ${pitches.ndaCount} * 5) 
              * (1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - ${pitches.publishedAt})) / 3600.0))
            `.as('trending_score')
          })
          .from(pitches)
          .leftJoin(users, eq(pitches.userId, users.id))
          .where(
            and(
              eq(pitches.status, "published"),
              gte(pitches.publishedAt, since)
            )
          )
          .orderBy(desc(sql`trending_score`))
          .limit(limit);

        const results = await query;
        
        // Transform to expected format
        return results.map(row => ({
          id: row.id,
          title: row.title,
          logline: row.logline,
          genre: row.genre,
          format: row.format,
          formatCategory: row.formatCategory,
          formatSubtype: row.formatSubtype,
          shortSynopsis: row.shortSynopsis,
          status: row.status,
          publishedAt: row.publishedAt,
          titleImage: row.titleImage,
          seekingInvestment: row.seekingInvestment,
          requireNDA: row.requireNda,
          creator: {
            id: row.creatorId,
            username: row.creatorUsername,
            userType: row.creatorUserType,
            companyName: row.creatorCompanyName
          },
          stats: {
            viewCount: row.viewCount || 0,
            likeCount: row.likeCount || 0,
            ndaCount: row.ndaCount || 0,
            trendingScore: row.trendingScore
          }
        }));
      },
      CacheConfigs.TRENDING
    );
  }

  /**
   * Get pitch with all relations in single query
   * Replaces: 3-4 separate queries (pitch + creator + NDAs + stats)
   * With: Single optimized join query
   */
  static async getPitchWithRelations(
    pitchId: number,
    viewerId?: number
  ): Promise<PitchWithRelations | null> {
    const cacheKey = `pitch:${pitchId}:${viewerId || 'anonymous'}`;
    
    return databaseCacheService.withCache(
      "pitches",
      cacheKey,
      async () => {
        console.log(`🎯 Executing optimized pitch query for ID: ${pitchId}`);
        
        // Single complex query with all relations
        const pitchQuery = db
          .select({
            // Pitch fields
            pitch: pitches,
            
            // Creator fields
            creator: {
              id: users.id,
              username: users.username,
              userType: users.userType,
              companyName: users.companyName,
              firstName: users.firstName,
              lastName: users.lastName,
              profileImageUrl: users.profileImageUrl
            }
          })
          .from(pitches)
          .leftJoin(users, eq(pitches.userId, users.id))
          .where(eq(pitches.id, pitchId))
          .limit(1);

        const pitchResult = await pitchQuery;
        
        if (!pitchResult.length) return null;
        
        const pitchData = pitchResult[0];
        
        // If viewerId provided, get user-specific data in parallel
        let userInteractions = null;
        if (viewerId) {
          const [ndaStatus, likeStatus, followStatus] = await Promise.all([
            // Check NDA status
            db.select({ count: count() })
              .from(ndas)
              .where(
                and(
                  eq(ndas.pitchId, pitchId),
                  eq(ndas.signerId, viewerId)
                )
              ),
            
            // Check like status  
            db.select({ count: count() })
              .from(pitchLikes)
              .where(
                and(
                  eq(pitchLikes.pitchId, pitchId),
                  eq(pitchLikes.userId, viewerId)
                )
              ),
            
            // Check follow status
            db.select({ count: count() })
              .from(follows)
              .where(
                and(
                  eq(follows.pitchId, pitchId),
                  eq(follows.followerId, viewerId)
                )
              )
          ]);
          
          userInteractions = {
            hasNda: (ndaStatus[0]?.count || 0) > 0,
            isLiked: (likeStatus[0]?.count || 0) > 0,
            isFollowed: (followStatus[0]?.count || 0) > 0
          };
        }

        // Parse JSON fields
        const pitch = this.parsePitchJsonFields(pitchData.pitch);
        
        return {
          ...pitch,
          creator: pitchData.creator,
          stats: {
            viewCount: pitch.viewCount || 0,
            likeCount: pitch.likeCount || 0,
            ndaCount: pitch.ndaCount || 0,
            ...userInteractions
          }
        };
      },
      CacheConfigs.PITCHES
    );
  }

  /**
   * Batch get user pitches with single query
   * Replaces: N queries for N pitches
   * With: Single query + optional caching
   */
  static async getUserPitches(
    userId: number,
    options: {
      includeStats?: boolean;
      limit?: number;
      offset?: number;
      status?: string;
    } = {}
  ) {
    const cacheKey = CacheHelpers.pitchesKey(userId, options);
    
    return databaseCacheService.withCache(
      "pitches",
      cacheKey,
      async () => {
        console.log(`👤 Executing optimized user pitches query for user: ${userId}`);
        
        const conditions = [eq(pitches.userId, userId)];
        if (options.status) {
          conditions.push(eq(pitches.status, options.status));
        }

        const userPitches = await db
          .select()
          .from(pitches)
          .where(and(...conditions))
          .orderBy(desc(pitches.updatedAt))
          .limit(options.limit || 50)
          .offset(options.offset || 0);

        const parsedPitches = userPitches.map(this.parsePitchJsonFields);
        
        if (!options.includeStats) {
          return parsedPitches;
        }

        // Calculate stats in a single pass
        const stats = parsedPitches.reduce((acc, pitch) => ({
          totalPitches: acc.totalPitches + 1,
          publishedPitches: acc.publishedPitches + (pitch.status === "published" ? 1 : 0),
          totalViews: acc.totalViews + (pitch.viewCount || 0),
          totalLikes: acc.totalLikes + (pitch.likeCount || 0),
          totalNDAs: acc.totalNDAs + (pitch.ndaCount || 0)
        }), {
          totalPitches: 0,
          publishedPitches: 0,
          totalViews: 0,
          totalLikes: 0,
          totalNDAs: 0
        });

        return { pitches: parsedPitches, stats };
      },
      CacheConfigs.PITCHES
    );
  }

  /**
   * Optimized search with intelligent caching and indexes
   * Uses full-text search indexes and result caching
   */
  static async searchPitches(params: {
    query?: string;
    genre?: string;
    format?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'date' | 'popularity';
  }) {
    const cacheKey = CacheHelpers.searchKey(params.query || '', params);
    
    return databaseCacheService.withCache(
      "search",
      cacheKey,
      async () => {
        console.log("🔍 Executing optimized search query");
        
        const conditions = [eq(pitches.status, "published")];
        
        if (params.genre) {
          conditions.push(eq(pitches.genre, params.genre as any));
        }
        
        if (params.format) {
          conditions.push(eq(pitches.format, params.format as any));
        }

        // Build sort order
        let orderBy;
        switch (params.sortBy) {
          case 'popularity':
            orderBy = [desc(pitches.likeCount), desc(pitches.viewCount)];
            break;
          case 'date':
            orderBy = [desc(pitches.publishedAt)];
            break;
          default: // relevance
            orderBy = [desc(pitches.publishedAt)];
        }
        
        // Use text search if query provided
        if (params.query?.trim()) {
          conditions.push(
            or(
              sql`to_tsvector('english', ${pitches.title} || ' ' || ${pitches.logline} || ' ' || COALESCE(${pitches.shortSynopsis}, '')) @@ plainto_tsquery('english', ${params.query})`,
              sql`LOWER(${pitches.title}) LIKE ${`%${params.query.toLowerCase()}%`}`,
              sql`LOWER(${pitches.logline}) LIKE ${`%${params.query.toLowerCase()}%`}`
            )
          );
          
          // For text search, order by relevance score
          if (params.sortBy === 'relevance') {
            orderBy = [
              desc(sql`ts_rank(to_tsvector('english', ${pitches.title} || ' ' || ${pitches.logline}), plainto_tsquery('english', ${params.query}))`),
              desc(pitches.publishedAt)
            ];
          }
        }

        const [searchResults, totalCount] = await Promise.all([
          // Main search query with creator join
          db
            .select({
              pitch: pitches,
              creator: {
                id: users.id,
                username: users.username,
                companyName: users.companyName,
                userType: users.userType,
              },
            })
            .from(pitches)
            .leftJoin(users, eq(pitches.userId, users.id))
            .where(and(...conditions))
            .limit(params.limit || 20)
            .offset(params.offset || 0)
            .orderBy(...orderBy),
          
          // Count query
          db.select({ count: count() })
            .from(pitches)
            .where(and(...conditions))
            .then(result => result[0]?.count || 0)
        ]);

        const formattedResults = searchResults.map(row => ({
          ...this.parsePitchJsonFields(row.pitch),
          creator: row.creator,
        }));

        return {
          pitches: formattedResults,
          totalCount,
          query: params.query,
          filters: {
            genre: params.genre,
            format: params.format,
            sortBy: params.sortBy || 'relevance'
          }
        };
      },
      CacheConfigs.SEARCH
    );
  }

  /**
   * Optimized dashboard data with single query per data type
   * Replaces: Multiple queries for each dashboard widget
   * With: Parallel optimized queries + caching
   */
  static async getDashboardData(userId: number, userType: string) {
    const cacheKey = CacheHelpers.dashboardKey(userId, userType);
    
    return databaseCacheService.withCache(
      "dashboard",
      cacheKey,
      async () => {
        console.log(`📊 Executing optimized dashboard query for ${userType}:${userId}`);
        
        if (userType === "creator") {
          const [userPitchesData, recentViews, recentInteractions] = await Promise.all([
            // User's pitches with stats
            this.getUserPitches(userId, { includeStats: true }),
            
            // Recent views on user's pitches (single query)
            db
              .select({
                pitchTitle: pitches.title,
                viewerUsername: users.username,
                viewedAt: pitchViews.viewedAt
              })
              .from(pitchViews)
              .leftJoin(pitches, eq(pitchViews.pitchId, pitches.id))
              .leftJoin(users, eq(pitchViews.viewerId, users.id))
              .where(eq(pitches.userId, userId))
              .orderBy(desc(pitchViews.viewedAt))
              .limit(10),
            
            // Recent NDAs/follows (single query)  
            db
              .select({
                type: sql<string>`'nda'`,
                pitchTitle: pitches.title,
                username: users.username,
                createdAt: ndas.createdAt
              })
              .from(ndas)
              .leftJoin(pitches, eq(ndas.pitchId, pitches.id))
              .leftJoin(users, eq(ndas.signerId, users.id))
              .where(eq(pitches.userId, userId))
              .orderBy(desc(ndas.createdAt))
              .limit(5)
          ]);

          return {
            stats: userPitchesData.stats,
            pitches: userPitchesData.pitches,
            recentActivity: [
              ...recentViews.map(v => ({
                type: 'view',
                message: `${v.viewerUsername || 'Someone'} viewed "${v.pitchTitle}"`,
                timestamp: v.viewedAt
              })),
              ...recentInteractions.map(i => ({
                type: i.type,
                message: `${i.username} signed NDA for "${i.pitchTitle}"`,
                timestamp: i.createdAt
              }))
            ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10)
          };
        }

        // For investors/production companies
        const [followedPitches, investmentData] = await Promise.all([
          // Followed pitches with updates
          db
            .select({
              follow: follows,
              pitch: pitches,
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
            .orderBy(desc(follows.followedAt))
            .limit(10),
          
          // Investment/engagement stats (mock for now)
          Promise.resolve({
            totalInvestments: 0,
            portfolioValue: 0,
            activeNDAs: 0
          })
        ]);

        return {
          followedPitches: followedPitches.map(row => ({
            ...row.follow,
            pitch: {
              ...this.parsePitchJsonFields(row.pitch),
              creator: row.creator
            }
          })),
          stats: investmentData
        };
      },
      CacheConfigs.DASHBOARD
    );
  }

  /**
   * Batch invalidation for cache efficiency
   */
  static async invalidatePitchCaches(pitchId: number, userId?: number) {
    const patterns = [
      ...CacheHelpers.invalidatePitchData(pitchId),
      ...(userId ? CacheHelpers.invalidateUserData(userId) : [])
    ];
    
    await databaseCacheService.batchInvalidate(patterns);
    console.log(`🗑️ Invalidated caches for pitch ${pitchId}`);
  }

  // Helper method to parse JSON fields
  private static parsePitchJsonFields(pitch: any) {
    if (!pitch) return pitch;
    
    try {
      if (pitch.characters && typeof pitch.characters === 'string') {
        pitch.characters = JSON.parse(pitch.characters);
      }
      
      if (pitch.additionalMedia && typeof pitch.additionalMedia === 'string') {
        pitch.additionalMedia = JSON.parse(pitch.additionalMedia);
      }
      
      if (pitch.visibilitySettings && typeof pitch.visibilitySettings === 'string') {
        pitch.visibilitySettings = JSON.parse(pitch.visibilitySettings);
      }
    } catch (e) {
      console.warn("Failed to parse JSON fields:", e.message);
    }
    
    return pitch;
  }

  /**
   * Optimized view recording with batching
   */
  static async recordView(pitchId: number, viewerId: number) {
    try {
      // Update view count efficiently
      await Promise.all([
        // Increment view count
        db.update(pitches)
          .set({
            viewCount: sql`${pitches.viewCount} + 1`,
          })
          .where(eq(pitches.id, pitchId)),
        
        // Record detailed view
        db.insert(pitchViews)
          .values({
            pitchId,
            viewerId,
            viewType: "full",
            viewedAt: new Date()
          })
          .onConflictDoNothing() // Prevent duplicate views
      ]);

      // Invalidate relevant caches
      await this.invalidatePitchCaches(pitchId);
      
    } catch (error) {
      console.error("Failed to record view:", error);
      // Don't throw - view recording shouldn't break the main flow
    }
  }
}