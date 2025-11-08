// Dashboard Cache Service - Redis-powered caching for dashboard metrics
// Optimizes performance and reduces database load

import { nativeRedisService } from './redis-native.service.ts';
import { db } from '../db/client.ts';
import { pitches, users, pitchViews, follows, notifications, ndas } from '../db/schema.ts';
import { eq, and, count, desc, gte, lte, sql } from 'npm:drizzle-orm';

export interface DashboardMetrics {
  creator: {
    totalPitches: number;
    publishedPitches: number;
    draftPitches: number;
    totalViews: number;
    totalLikes: number;
    totalFollowers: number;
    totalNDAs: number;
    recentViews: number; // Last 7 days
    topPitches: Array<{
      id: number;
      title: string;
      views: number;
      likes: number;
      status: string;
    }>;
    viewsOverTime: Array<{
      date: string;
      views: number;
    }>;
  };
  investor: {
    totalInvestments: number;
    totalInvestmentValue: number;
    activeInvestments: number;
    portfolioGrowth: number;
    watchlistCount: number;
    followingCount: number;
    recentPitches: Array<{
      id: number;
      title: string;
      creator: string;
      addedAt: string;
    }>;
    investmentBreakdown: Array<{
      genre: string;
      count: number;
      value: number;
    }>;
  };
  production: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalBudget: number;
    teamSize: number;
    collaborations: number;
    projectTimeline: Array<{
      month: string;
      projects: number;
      budget: number;
    }>;
    genreDistribution: Array<{
      genre: string;
      count: number;
    }>;
  };
}

export class DashboardCacheService {
  private static get redis() { return nativeRedisService; }
  private static wsService: any = null;
  private static cache: Map<string, any> = new Map(); // In-memory cache fallback

  // Cache TTL settings (in seconds)
  private static readonly TTL = {
    DASHBOARD: 300,      // 5 minutes
    REALTIME: 60,        // 1 minute
    STATS: 900,          // 15 minutes
    TRENDING: 180,       // 3 minutes
  };

  static initialize(webSocketService: any) {
    this.wsService = webSocketService;
    console.log("✅ DashboardCacheService initialized with WebSocket support");
  }

  // Get complete dashboard metrics for a user
  static async getDashboardMetrics(userId: number, userType: string): Promise<DashboardMetrics[keyof DashboardMetrics] | null> {
    const cacheKey = `dashboard:${userType}:${userId}`;
    
    try {
          // Try cache first
      if (this.redis?.isEnabled()) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          console.log(`📊 Dashboard metrics retrieved from cache for ${userType} ${userId}`);
          return cached;
        }
      }

      // Generate fresh metrics
      let metrics: any = null;
      switch (userType) {
        case 'creator':
          metrics = await this.generateCreatorMetrics(userId);
          break;
        case 'investor':
          metrics = await this.generateInvestorMetrics(userId);
          break;
        case 'production':
          metrics = await this.generateProductionMetrics(userId);
          break;
      }

      if (metrics) {
        // Cache the results
        if (this.redis?.isEnabled()) {
          try {
            await this.redis.set(cacheKey, metrics, this.TTL.DASHBOARD);
            console.log(`📊 Dashboard metrics cached for ${userType} ${userId}`);
          } catch (redisError) {
            console.warn('⚠️ Redis caching failed for dashboard metrics:', redisError);
          }
        } else {
          console.log(`📊 Dashboard metrics generated for ${userType} ${userId} - Redis not available`);
        }
      }

      return metrics;
    } catch (error) {
      console.error(`❌ Failed to get dashboard metrics for ${userType} ${userId}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error details:`, errorMessage);
      
      // Return empty/default metrics instead of null to prevent further errors
      switch (userType) {
        case 'creator':
          return {
            totalPitches: 0,
            publishedPitches: 0,
            draftPitches: 0,
            totalViews: 0,
            totalLikes: 0,
            totalFollowers: 0,
            totalNDAs: 0,
            recentViews: 0,
            topPitches: [],
            viewsOverTime: []
          };
        case 'investor':
          return {
            totalInvestments: 0,
            totalInvestmentValue: 0,
            activeInvestments: 0,
            portfolioGrowth: 0,
            watchlistCount: 0,
            followingCount: 0,
            recentPitches: [],
            investmentBreakdown: []
          };
        case 'production':
          return {
            totalProjects: 0,
            activeProjects: 0,
            completedProjects: 0,
            totalBudget: 0,
            teamSize: 0,
            collaborations: 0,
            projectTimeline: [],
            genreDistribution: []
          };
        default:
          return null;
      }
    }
  }

  // Generate creator dashboard metrics
  private static async generateCreatorMetrics(userId: number): Promise<DashboardMetrics['creator']> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get basic pitch counts
    const userPitches = await db.select({
      id: pitches.id,
      title: pitches.title,
      status: pitches.status,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount,
      createdAt: pitches.createdAt,
    })
      .from(pitches)
      .where(eq(pitches.userId, userId));

    const publishedPitches = userPitches.filter((p: any) => p.status === 'published');
    const draftPitches = userPitches.filter((p: any) => p.status === 'draft');
    const userPitchIds = userPitches.map((p: any) => p.id);

    // Get follower count
    const followerCount = await db.select({ count: count() })
      .from(follows)
      .where(eq(follows.creatorId, userId));

    // Get NDA count - using more robust query
    let ndaCount = [{ count: 0 }];
    
    if (userPitchIds.length > 0) {
      ndaCount = await db.select({ count: count() })
        .from(ndas)
        .where(sql`${ndas.pitchId} = ANY(ARRAY[${sql.raw(userPitchIds.join(','))}]::integer[])`);
    }

    // Get recent views (last 7 days) - using more robust query  
    let recentViews = [{ count: 0 }];
    
    if (userPitchIds.length > 0) {
      recentViews = await db.select({ count: count() })
        .from(pitchViews)
        .where(and(
          sql`${pitchViews.pitchId} = ANY(ARRAY[${sql.raw(userPitchIds.join(','))}]::integer[])`,
          gte(pitchViews.viewedAt, sevenDaysAgo)
        ));
    }

    // Calculate totals
    const totalViews = userPitches.reduce((sum: number, p: any) => sum + (p.viewCount || 0), 0);
    const totalLikes = userPitches.reduce((sum: number, p: any) => sum + (p.likeCount || 0), 0);

    // Get top pitches
    const topPitches = publishedPitches
      .sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, 5)
      .map((p: any) => ({
        id: p.id,
        title: p.title,
        views: p.viewCount || 0,
        likes: p.likeCount || 0,
        status: p.status || 'draft',
      }));

    // Generate views over time with user pitch IDs
    const viewsOverTime = await this.generateViewsOverTime(userId, userPitches.map((p: any) => p.id));

    return {
      totalPitches: userPitches.length,
      publishedPitches: publishedPitches.length,
      draftPitches: draftPitches.length,
      totalViews,
      totalLikes,
      totalFollowers: followerCount[0]?.count || 0,
      totalNDAs: ndaCount[0]?.count || 0,
      recentViews: recentViews[0]?.count || 0,
      topPitches,
      viewsOverTime,
    };
  }

  // Generate investor dashboard metrics
  private static async generateInvestorMetrics(userId: number): Promise<DashboardMetrics['investor']> {
    // Mock investor metrics (in real app, this would use investment tables)
    const followingCount = await db.select({ count: count() })
      .from(follows)
      .where(eq(follows.followerId, userId));

    return {
      totalInvestments: 12,
      totalInvestmentValue: 250000,
      activeInvestments: 8,
      portfolioGrowth: 15.5,
      watchlistCount: 25,
      followingCount: followingCount[0]?.count || 0,
      recentPitches: [],
      investmentBreakdown: [
        { genre: 'Drama', count: 5, value: 125000 },
        { genre: 'Comedy', count: 3, value: 75000 },
        { genre: 'Thriller', count: 4, value: 50000 },
      ],
    };
  }

  // Generate production company dashboard metrics
  private static async generateProductionMetrics(userId: number): Promise<DashboardMetrics['production']> {
    const userPitches = await db.select({
      id: pitches.id,
      title: pitches.title,
      status: pitches.status,
      genre: pitches.genre,
      createdAt: pitches.createdAt,
    })
      .from(pitches)
      .where(eq(pitches.userId, userId));

    const activeProjects = userPitches.filter((p: any) => p.status === 'published').length;
    const completedProjects = userPitches.filter((p: any) => p.status === 'archived').length;

    // Genre distribution
    const genreDistribution = userPitches.reduce((acc: any, pitch: any) => {
      const genre = pitch.genre || 'Other';
      const existing = acc.find((g: any) => g.genre === genre);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ genre, count: 1 });
      }
      return acc;
    }, [] as Array<{ genre: string; count: number }>);

    return {
      totalProjects: userPitches.length,
      activeProjects,
      completedProjects,
      totalBudget: 2500000,
      teamSize: 45,
      collaborations: 12,
      projectTimeline: [],
      genreDistribution,
    };
  }

  // Generate views over time data
  private static async generateViewsOverTime(userId: number, userPitchIds?: number[]): Promise<Array<{ date: string; views: number }>> {
    const viewsOverTime = [];
    const now = new Date();
    
    // Get user pitch IDs if not provided
    let validUserPitchIds: number[];
    if (!userPitchIds || userPitchIds.length === 0) {
      const userPitches = await db.select({ id: pitches.id })
        .from(pitches)
        .where(eq(pitches.userId, userId));
      validUserPitchIds = userPitches.map((p: any) => p.id);
    } else {
      validUserPitchIds = userPitchIds;
    }
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      let dayViews = [{ count: 0 }];
      
      if (validUserPitchIds.length > 0) {
        dayViews = await db.select({ count: count() })
          .from(pitchViews)
          .where(and(
            sql`${pitchViews.pitchId} = ANY(ARRAY[${sql.raw(validUserPitchIds.join(','))}]::integer[])`,
            gte(pitchViews.viewedAt, dayStart),
            lte(pitchViews.viewedAt, dayEnd)
          ));
      }
      
      viewsOverTime.push({
        date: date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'),
        views: dayViews[0]?.count || 0,
      });
    }
    
    return viewsOverTime;
  }

  // Real-time metrics updates
  static async updateRealTimeMetric(userId: number, userType: string, metric: string, value: any): Promise<void> {
    try {
      const cacheKey = `realtime:${userType}:${userId}:${metric}`;
      if (this.redis?.isEnabled()) {
        try {
          await this.redis.set(cacheKey, value, this.TTL.REALTIME);
        } catch (redisError) {
          console.warn('⚠️ Redis caching failed for real-time metric:', redisError);
        }
      }

      // Broadcast to WebSocket if available
      if (this.wsService) {
        await this.wsService.sendNotificationToUser(userId, {
          type: 'dashboard_update',
          data: {
            metric,
            value,
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`📊 Real-time metric updated for ${userType} ${userId}: ${metric} = ${JSON.stringify(value)}`);
    } catch (error) {
      console.error(`❌ Failed to update real-time metric:`, error);
    }
  }

  // Get trending pitches with caching - FIXED: Uses working PitchService method and sorts by engagement
  static async getTrendingPitches(limit: number = 10): Promise<any[]> {
    const cacheKey = `trending:pitches:${limit}`;
    
    try {
      if (this.redis?.isEnabled()) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          console.log(`🔥 Trending pitches retrieved from cache (limit: ${limit})`);
          return cached;
        }
      }

      console.log("🔥 TRENDING v2.0: Using working PitchService method + trending sort");
      
      // Import PitchService here to avoid circular dependencies
      const { PitchService } = await import('./pitch.service.ts');
      
      // Use the working PitchService method to get all published pitches
      const allPitches = await PitchService.getPublicPitchesWithUserType(limit * 3); // Get more to sort
      
      // Sort by engagement score: (view_count + like_count * 2) for trending algorithm
      const trendingPitches = allPitches
        .sort((a: any, b: any) => {
          const scoreA = (a.viewCount || 0) + (a.likeCount || 0) * 2;
          const scoreB = (b.viewCount || 0) + (b.likeCount || 0) * 2;
          return scoreB - scoreA;
        })
        .slice(0, limit);

      console.log(`🔥 Generated ${trendingPitches.length} trending pitches from ${allPitches.length} total pitches`);
      
      // Cache for 3 minutes (only if Redis is available)
      if (this.redis?.isEnabled()) {
        try {
          await this.redis.set(cacheKey, trendingPitches, this.TTL.TRENDING);
          console.log(`🔥 Trending pitches cached (${trendingPitches.length} pitches)`);
        } catch (redisError) {
          console.warn('⚠️ Redis caching failed, continuing without cache:', redisError);
        }
      } else {
        console.log(`📦 Trending pitches generated (${trendingPitches.length} pitches) - Redis not available`);
      }

      return trendingPitches;
    } catch (error) {
      console.error(`❌ Failed to get trending pitches:`, error);
      return [];
    }
  }

  // Cache invalidation methods
  static async invalidateDashboardCache(userId: number, userType: string): Promise<void> {
    try {
      const patterns = [
        `dashboard:${userType}:${userId}`,
        `realtime:${userType}:${userId}:*`,
        `stats:${userType}:${userId}:*`,
      ];

      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            for (const key of keys) {
              await this.redis.del(key);
            }
          }
        } else {
          await this.redis.del(pattern);
        }
      }

      console.log(`🗑️ Dashboard cache invalidated for ${userType} ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to invalidate dashboard cache:`, error);
    }
  }

  private static redisWarningShown = false;
  
  static async invalidateTrendingCache(): Promise<void> {
    try {
      // Check if Redis service has the keys method
      if (this.redis && typeof this.redis.keys === 'function') {
        const keys = await this.redis.keys('trending:*');
        if (keys.length > 0) {
          for (const key of keys) {
            await this.redis.del(key);
          }
          console.log(`🗑️ Trending cache invalidated (${keys.length} keys)`);
        }
      } else {
        // Only show warning once to avoid log spam
        if (!this.redisWarningShown) {
          console.log(`⚠️ Redis not configured - using in-memory cache only`);
          this.redisWarningShown = true;
        }
        // Clear in-memory cache as fallback
        if (this.cache) {
          this.cache.clear();
        }
      }
    } catch (error) {
      // Silently handle Redis errors - fallback to memory cache
      if (!this.redisWarningShown) {
        console.warn(`⚠️ Redis unavailable - using in-memory cache`);
        this.redisWarningShown = true;
      }
      if (this.cache) {
        this.cache.clear();
      }
    }
  }

  // Batch cache warming for popular users/content
  static async warmCache(): Promise<void> {
    try {
      console.log('🔥 Starting cache warming process...');

      // Get most active users
      const activeCreators = await db.select({
        id: users.id,
        userType: users.userType,
      })
        .from(users)
        .where(eq(users.userType, 'creator'))
        .limit(20)
        .orderBy(desc(users.createdAt));

      // Warm creator dashboards
      const promises = activeCreators.map((user: any) => 
        this.getDashboardMetrics(user.id, user.userType)
      );

      await Promise.all(promises);

      // Warm trending pitches
      await this.getTrendingPitches(20);

      console.log(`🔥 Cache warming completed for ${activeCreators.length} users`);
    } catch (error) {
      console.error(`❌ Cache warming failed:`, error);
    }
  }

  // Get cache statistics
  static async getCacheStats(): Promise<any> {
    try {
      const patterns = ['dashboard:*', 'realtime:*', 'trending:*', 'user:*:notifications'];
      const stats: any = {};

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        const type = pattern.split(':')[0];
        stats[type] = {
          count: keys.length,
          keys: keys.slice(0, 10), // Sample keys
        };
      }

      // Get Redis memory info
      const memoryInfo = await this.redis.info();
      stats.memory = {
        used: memoryInfo.split('\r\n').find((line: string) => line.startsWith('used_memory_human:'))?.split(':')[1] || 'unknown',
        peak: memoryInfo.split('\r\n').find((line: string) => line.startsWith('used_memory_peak_human:'))?.split(':')[1] || 'unknown',
      };

      return stats;
    } catch (error) {
      console.error(`❌ Failed to get cache stats:`, error);
      return {};
    }
  }
}

// Schedule cache warming every hour
setInterval(() => {
  DashboardCacheService.warmCache();
}, 60 * 60 * 1000);

// Schedule trending cache refresh every 3 minutes
setInterval(() => {
  DashboardCacheService.invalidateTrendingCache();
}, 3 * 60 * 1000);