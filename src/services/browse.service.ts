/**
 * Browse Service for Tab-based Content Discovery
 * Handles Trending, New, Popular, and Featured content
 */

import { db } from "../db/client.ts";
import { pitches, users, pitchViews, analyticsEvents, pitchLikes } from "../db/schema.ts";
import { 
  eq, sql, desc, asc, and, or, gte, lte, inArray, count, avg, sum
} from "npm:drizzle-orm@0.35.3";
import { redisService } from "./redis.service.ts";

export interface BrowseFilters {
  tab?: 'trending' | 'new' | 'popular' | 'featured' | 'all';
  genres?: string[];
  formats?: string[];
  budgetRanges?: string[];
  stages?: string[];
  timeframe?: '24h' | '7d' | '30d' | 'all';
  sortBy?: 'trending' | 'newest' | 'views' | 'likes' | 'alphabetical' | 'random';
  page?: number;
  limit?: number;
}

export interface BrowseResult {
  items: Array<{
    id: number;
    title: string;
    logline: string;
    genre: string;
    format: string;
    budgetRange?: string;
    stage?: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    createdAt: string;
    updatedAt: string;
    posterUrl?: string;
    videoUrl?: string;
    creator: {
      id: number;
      username: string;
      userType: string;
      companyName?: string;
      verified: boolean;
    };
    trending?: {
      score: number;
      reason: string[];
    };
  }>;
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  hasMore: boolean;
  filters: {
    available: {
      genres: Array<{ value: string; count: number }>;
      formats: Array<{ value: string; count: number }>;
      budgetRanges: Array<{ value: string; count: number }>;
      stages: Array<{ value: string; count: number }>;
    };
    applied: BrowseFilters;
  };
  metadata: {
    tab: string;
    timeframe: string;
    refreshedAt: string;
    cacheHit: boolean;
  };
}

export class BrowseService {

  /**
   * Browse content with tab-based filtering
   */
  static async browse(filters: BrowseFilters, userId?: number): Promise<BrowseResult> {
    const tab = filters.tab || 'trending';
    const timeframe = filters.timeframe || '7d';
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 24, 100);
    const offset = (page - 1) * limit;

    // Build cache key
    const cacheKey = this.buildCacheKey(filters, userId);
    
    const result = await redisService.cached(
      cacheKey,
      async () => {
        let query;
        let conditions = this.buildBaseConditions(filters);
        let orderBy;
        let trendingScores: Map<number, any> = new Map();

        // Tab-specific logic
        switch (tab) {
          case 'trending':
            ({ query, orderBy, trendingScores } = await this.buildTrendingQuery(conditions, timeframe));
            break;
          case 'new':
            ({ query, orderBy } = await this.buildNewQuery(conditions, timeframe));
            break;
          case 'popular':
            ({ query, orderBy } = await this.buildPopularQuery(conditions, timeframe));
            break;
          case 'featured':
            ({ query, orderBy } = await this.buildFeaturedQuery(conditions));
            break;
          case 'all':
          default:
            ({ query, orderBy } = await this.buildAllQuery(conditions));
            break;
        }

        // Apply additional sorting if specified
        if (filters.sortBy && filters.sortBy !== 'trending') {
          orderBy = this.applySorting(filters.sortBy);
        }

        // Build final query
        const finalQuery = query.orderBy(...orderBy);

        // Get total count
        const totalCountResult = await db.select({ count: count() })
          .from(pitches)
          .innerJoin(users, eq(pitches.userId, users.id))
          .where(and(...conditions));

        const total = totalCountResult[0]?.count || 0;
        const totalPages = Math.ceil(total / limit);

        // Execute paginated query
        const rawResults = await finalQuery.limit(limit).offset(offset);

        // Transform and enrich results
        const items = await this.transformResults(rawResults, trendingScores, userId);

        // Get available filters for sidebar
        const availableFilters = await this.getAvailableFilters(conditions);

        return {
          items,
          total,
          page,
          totalPages,
          limit,
          hasMore: page < totalPages,
          filters: {
            available: availableFilters,
            applied: filters
          },
          metadata: {
            tab,
            timeframe,
            refreshedAt: new Date().toISOString(),
            cacheHit: false
          }
        };
      },
      this.getCacheTime(tab) // Dynamic cache time based on tab
    );

    return {
      ...result,
      metadata: {
        ...result.metadata,
        cacheHit: await redisService.exists(cacheKey)
      }
    };
  }

  /**
   * Get trending score calculation explanation
   */
  static async getTrendingExplanation(pitchId: number): Promise<{
    score: number;
    breakdown: Array<{ factor: string; value: number; weight: number; contribution: number }>;
  }> {
    const pitch = await db.select()
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

    if (pitch.length === 0) {
      throw new Error('Pitch not found');
    }

    const p = pitch[0];
    const now = Date.now();
    const createdTime = new Date(p.createdAt).getTime();
    const ageInDays = (now - createdTime) / (1000 * 60 * 60 * 24);

    // Calculate individual factors
    const factors = [
      {
        factor: 'Recent Views',
        value: p.viewCount || 0,
        weight: 0.3,
        contribution: ((p.viewCount || 0) * 0.3)
      },
      {
        factor: 'Recent Likes',
        value: p.likeCount || 0,
        weight: 0.25,
        contribution: ((p.likeCount || 0) * 0.25)
      },
      {
        factor: 'Engagement Rate',
        value: p.viewCount > 0 ? ((p.likeCount || 0) / p.viewCount * 100) : 0,
        weight: 0.2,
        contribution: (p.viewCount > 0 ? ((p.likeCount || 0) / p.viewCount) * 0.2 : 0)
      },
      {
        factor: 'Recency Bonus',
        value: Math.max(0, 30 - ageInDays),
        weight: 0.15,
        contribution: (Math.max(0, (30 - ageInDays) / 30) * 0.15)
      },
      {
        factor: 'NDA Interest',
        value: p.ndaCount || 0,
        weight: 0.1,
        contribution: ((p.ndaCount || 0) * 0.1)
      }
    ];

    const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);

    return {
      score: Math.round(totalScore * 100) / 100,
      breakdown: factors
    };
  }

  // Private helper methods

  private static buildBaseConditions(filters: BrowseFilters) {
    const conditions = [];

    // Base conditions
    conditions.push(eq(pitches.status, 'active'));
    conditions.push(eq(pitches.visibility, 'public'));
    conditions.push(eq(users.isActive, true));

    // Apply filters
    if (filters.genres?.length) {
      conditions.push(inArray(pitches.genre, filters.genres));
    }

    if (filters.formats?.length) {
      conditions.push(inArray(pitches.format, filters.formats));
    }

    if (filters.budgetRanges?.length) {
      conditions.push(inArray(pitches.budgetRange, filters.budgetRanges));
    }

    if (filters.stages?.length) {
      conditions.push(inArray(pitches.productionStage, filters.stages));
    }

    return conditions;
  }

  private static async buildTrendingQuery(conditions: any[], timeframe: string) {
    const hoursBack = this.getHoursFromTimeframe(timeframe);
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Trending score: recent activity + engagement + recency
    const trendingScore = sql<number>`
      (
        -- Recent views weight
        COALESCE((
          SELECT COUNT(*)::float FROM ${pitchViews} 
          WHERE ${pitchViews.pitchId} = ${pitches.id} 
          AND ${pitchViews.viewedAt} >= ${cutoffDate}
        ), 0) * 0.3 +
        
        -- Recent likes weight
        COALESCE((
          SELECT COUNT(*)::float FROM ${pitchLikes}
          WHERE ${pitchLikes.pitchId} = ${pitches.id}
          AND ${pitchLikes.createdAt} >= ${cutoffDate}
        ), 0) * 0.4 +
        
        -- Overall engagement rate
        CASE 
          WHEN ${pitches.viewCount} > 0 THEN 
            (${pitches.likeCount}::float / ${pitches.viewCount}::float) * 0.2
          ELSE 0 
        END +
        
        -- Recency bonus (newer = higher score)
        CASE 
          WHEN ${pitches.createdAt} >= ${cutoffDate} THEN 
            (1 - EXTRACT(days FROM NOW() - ${pitches.createdAt})::float / ${hoursBack / 24}::float) * 0.1
          ELSE 0
        END
      )
    `;

    const query = db.select({
      id: pitches.id,
      title: pitches.title,
      logline: pitches.logline,
      genre: pitches.genre,
      format: pitches.format,
      budgetRange: pitches.budgetRange,
      stage: pitches.productionStage,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount,
      commentCount: pitches.commentCount,
      createdAt: pitches.createdAt,
      updatedAt: pitches.updatedAt,
      posterUrl: pitches.posterUrl,
      videoUrl: pitches.videoUrl,
      userId: pitches.userId,
      
      // Creator info
      creatorUsername: users.username,
      creatorUserType: users.userType,
      creatorCompanyName: users.companyName,
      creatorVerified: users.emailVerified,
      
      // Trending score
      trendingScore
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(and(...conditions));

    // Store trending scores for later use
    const trendingScores = new Map();
    const results = await query;
    results.forEach(r => {
      trendingScores.set(r.id, {
        score: r.trendingScore,
        reasons: this.calculateTrendingReasons(r, cutoffDate)
      });
    });

    return {
      query,
      orderBy: [desc(trendingScore)],
      trendingScores
    };
  }

  private static async buildNewQuery(conditions: any[], timeframe: string) {
    const hoursBack = this.getHoursFromTimeframe(timeframe);
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    // Only include pitches from the specified timeframe
    conditions.push(gte(pitches.createdAt, cutoffDate));

    const query = db.select({
      id: pitches.id,
      title: pitches.title,
      logline: pitches.logline,
      genre: pitches.genre,
      format: pitches.format,
      budgetRange: pitches.budgetRange,
      stage: pitches.productionStage,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount,
      commentCount: pitches.commentCount,
      createdAt: pitches.createdAt,
      updatedAt: pitches.updatedAt,
      posterUrl: pitches.posterUrl,
      videoUrl: pitches.videoUrl,
      userId: pitches.userId,
      
      // Creator info
      creatorUsername: users.username,
      creatorUserType: users.userType,
      creatorCompanyName: users.companyName,
      creatorVerified: users.emailVerified
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(and(...conditions));

    return {
      query,
      orderBy: [desc(pitches.createdAt)]
    };
  }

  private static async buildPopularQuery(conditions: any[], timeframe: string) {
    const hoursBack = this.getHoursFromTimeframe(timeframe);
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Popularity score: total views + likes with higher weight for recent activity
    const popularityScore = sql<number>`
      (
        ${pitches.viewCount} * 0.4 +
        ${pitches.likeCount} * 0.6 +
        COALESCE((
          SELECT COUNT(*)::float FROM ${pitchViews} 
          WHERE ${pitchViews.pitchId} = ${pitches.id} 
          AND ${pitchViews.viewedAt} >= ${cutoffDate}
        ), 0) * 0.3
      )
    `;

    const query = db.select({
      id: pitches.id,
      title: pitches.title,
      logline: pitches.logline,
      genre: pitches.genre,
      format: pitches.format,
      budgetRange: pitches.budgetRange,
      stage: pitches.productionStage,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount,
      commentCount: pitches.commentCount,
      createdAt: pitches.createdAt,
      updatedAt: pitches.updatedAt,
      posterUrl: pitches.posterUrl,
      videoUrl: pitches.videoUrl,
      userId: pitches.userId,
      
      // Creator info
      creatorUsername: users.username,
      creatorUserType: users.userType,
      creatorCompanyName: users.companyName,
      creatorVerified: users.emailVerified,
      
      // Popularity score
      popularityScore
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(and(...conditions));

    return {
      query,
      orderBy: [desc(popularityScore)]
    };
  }

  private static async buildFeaturedQuery(conditions: any[]) {
    // Featured content: high-quality pitches with good metrics
    const featuredConditions = [
      ...conditions,
      gte(pitches.viewCount, 50), // Minimum view threshold
      gte(pitches.likeCount, 5),  // Minimum like threshold
    ];

    const query = db.select({
      id: pitches.id,
      title: pitches.title,
      logline: pitches.logline,
      genre: pitches.genre,
      format: pitches.format,
      budgetRange: pitches.budgetRange,
      stage: pitches.productionStage,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount,
      commentCount: pitches.commentCount,
      createdAt: pitches.createdAt,
      updatedAt: pitches.updatedAt,
      posterUrl: pitches.posterUrl,
      videoUrl: pitches.videoUrl,
      userId: pitches.userId,
      
      // Creator info
      creatorUsername: users.username,
      creatorUserType: users.userType,
      creatorCompanyName: users.companyName,
      creatorVerified: users.emailVerified
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(and(...featuredConditions));

    return {
      query,
      orderBy: [desc(sql`${pitches.viewCount} * 0.3 + ${pitches.likeCount} * 0.7`)]
    };
  }

  private static async buildAllQuery(conditions: any[]) {
    const query = db.select({
      id: pitches.id,
      title: pitches.title,
      logline: pitches.logline,
      genre: pitches.genre,
      format: pitches.format,
      budgetRange: pitches.budgetRange,
      stage: pitches.productionStage,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount,
      commentCount: pitches.commentCount,
      createdAt: pitches.createdAt,
      updatedAt: pitches.updatedAt,
      posterUrl: pitches.posterUrl,
      videoUrl: pitches.videoUrl,
      userId: pitches.userId,
      
      // Creator info
      creatorUsername: users.username,
      creatorUserType: users.userType,
      creatorCompanyName: users.companyName,
      creatorVerified: users.emailVerified
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(and(...conditions));

    return {
      query,
      orderBy: [desc(pitches.updatedAt)]
    };
  }

  private static applySorting(sortBy: string) {
    switch (sortBy) {
      case 'newest':
        return [desc(pitches.createdAt)];
      case 'views':
        return [desc(pitches.viewCount)];
      case 'likes':
        return [desc(pitches.likeCount)];
      case 'alphabetical':
        return [asc(pitches.title)];
      case 'random':
        return [sql`RANDOM()`];
      default:
        return [desc(pitches.createdAt)];
    }
  }

  private static async transformResults(rawResults: any[], trendingScores: Map<number, any>, userId?: number) {
    return rawResults.map(result => {
      const trending = trendingScores.get(result.id);

      return {
        id: result.id,
        title: result.title,
        logline: result.logline,
        genre: result.genre,
        format: result.format,
        budgetRange: result.budgetRange,
        stage: result.stage,
        viewCount: result.viewCount || 0,
        likeCount: result.likeCount || 0,
        commentCount: result.commentCount || 0,
        createdAt: result.createdAt?.toISOString(),
        updatedAt: result.updatedAt?.toISOString(),
        posterUrl: result.posterUrl,
        videoUrl: result.videoUrl,
        creator: {
          id: result.userId,
          username: result.creatorUsername,
          userType: result.creatorUserType,
          companyName: result.creatorCompanyName,
          verified: result.creatorVerified || false
        },
        trending: trending ? {
          score: Math.round(trending.score * 100) / 100,
          reason: trending.reasons
        } : undefined
      };
    });
  }

  private static async getAvailableFilters(conditions: any[]) {
    // Get available filter values from current result set
    const [genreCounts, formatCounts, budgetCounts, stageCounts] = await Promise.all([
      this.getFilterCounts('genre', conditions),
      this.getFilterCounts('format', conditions),
      this.getFilterCounts('budgetRange', conditions),
      this.getFilterCounts('productionStage', conditions)
    ]);

    return {
      genres: genreCounts,
      formats: formatCounts,
      budgetRanges: budgetCounts,
      stages: stageCounts
    };
  }

  private static async getFilterCounts(field: string, conditions: any[]) {
    const results = await db.select({
      value: sql<string>`${pitches[field as keyof typeof pitches]}`,
      count: count()
    })
      .from(pitches)
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`${pitches[field as keyof typeof pitches]}`)
      .orderBy(desc(count()));

    return results.map(r => ({
      value: r.value || 'Unknown',
      count: r.count
    })).slice(0, 20); // Limit to top 20 options
  }

  private static calculateTrendingReasons(pitch: any, cutoffDate: Date): string[] {
    const reasons = [];
    
    if (pitch.trendingScore > 0.5) {
      reasons.push('High engagement');
    }
    if (new Date(pitch.createdAt) >= cutoffDate) {
      reasons.push('Recently posted');
    }
    if (pitch.viewCount > 100) {
      reasons.push('Popular content');
    }
    if (pitch.likeCount > pitch.viewCount * 0.1) {
      reasons.push('High like ratio');
    }
    if (pitch.creatorVerified) {
      reasons.push('Verified creator');
    }

    return reasons.length > 0 ? reasons : ['Active content'];
  }

  private static getHoursFromTimeframe(timeframe: string): number {
    switch (timeframe) {
      case '24h': return 24;
      case '7d': return 168;
      case '30d': return 720;
      case 'all': return 8760; // 1 year
      default: return 168; // Default to 7 days
    }
  }

  private static getCacheTime(tab: string): number {
    switch (tab) {
      case 'trending': return 300; // 5 minutes
      case 'new': return 60; // 1 minute
      case 'popular': return 600; // 10 minutes
      case 'featured': return 1800; // 30 minutes
      default: return 300; // 5 minutes
    }
  }

  private static buildCacheKey(filters: BrowseFilters, userId?: number): string {
    const keyParts = [
      'browse',
      `tab:${filters.tab || 'trending'}`,
      `genres:${filters.genres?.join(',') || ''}`,
      `formats:${filters.formats?.join(',') || ''}`,
      `timeframe:${filters.timeframe || '7d'}`,
      `sort:${filters.sortBy || 'default'}`,
      `page:${filters.page || 1}`,
      `limit:${filters.limit || 24}`,
      userId ? `user:${userId}` : ''
    ].filter(Boolean);

    return redisService.generateKey(keyParts.join(':'));
  }
}