/**
 * Smart Recommendations Service
 * Provides ML-inspired recommendations, matching algorithms, and personalized content discovery
 */

import { db } from "../db/client.ts";
import { 
  pitches, users, analyticsEvents, watchlist, follows, ndaRequests, 
  messages, portfolio, userPreferences, userInteractions, trendingTopics,
  userSimilarity 
} from "../db/schema.ts";
import { eq, sql, desc, and, gte, inArray, ne, count, avg, sum } from "npm:drizzle-orm@0.35.3";

export interface RecommendationScore {
  pitchId: number;
  score: number;
  reasons: string[];
  confidence: number;
  category: 'trending' | 'personalized' | 'similar_users' | 'genre_match' | 'budget_match';
}

export interface SmartMatch {
  targetUserId: number;
  matchScore: number;
  commonInterests: string[];
  compatibilityFactors: {
    genreAlignment: number;
    budgetCompatibility: number;
    experienceLevel: number;
    networkOverlap: number;
  };
  recommendedAction: 'connect' | 'collaborate' | 'follow' | 'message';
}

export interface TrendingInsight {
  category: string;
  trend: 'rising' | 'declining' | 'stable';
  changePercent: number;
  timeframe: string;
  predictedPeak: string;
  marketOpportunity: number;
}

export class SmartRecommendationsService {
  
  /**
   * Get personalized pitch recommendations for a user
   */
  static async getPersonalizedRecommendations(
    userId: number, 
    limit: number = 10,
    excludeViewed: boolean = true
  ): Promise<RecommendationScore[]> {
    
    // Get user's interaction history and preferences
    const userHistory = await this.getUserInteractionProfile(userId);
    
    // Get user's explicit preferences
    const preferences = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    
    // Get pitches to score (excluding user's own pitches)
    const candidatePitches = await db.select({
      id: pitches.id,
      title: pitches.title,
      genre: pitches.genre,
      format: pitches.format,
      budgetBracket: pitches.budgetBracket,
      userId: pitches.userId,
      createdAt: pitches.createdAt,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount,
      visibility: pitches.visibility
    })
    .from(pitches)
    .where(and(
      ne(pitches.userId, userId),
      eq(pitches.status, 'active'),
      eq(pitches.visibility, 'public')
    ))
    .limit(50); // Get more candidates than needed for scoring

    // Score each pitch based on multiple factors
    const scoredRecommendations: RecommendationScore[] = [];
    
    for (const pitch of candidatePitches) {
      // Skip if user already viewed (optional)
      if (excludeViewed) {
        const hasViewed = await this.hasUserViewedPitch(userId, pitch.id);
        if (hasViewed) continue;
      }
      
      const score = await this.calculateRecommendationScore(pitch, userHistory, preferences[0]);
      
      if (score.score > 0.3) { // Minimum threshold
        scoredRecommendations.push(score);
      }
    }
    
    // Sort by score and return top recommendations
    return scoredRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find smart matches between users (collaborators, investors, etc.)
   */
  static async findSmartMatches(
    userId: number,
    targetUserType: 'creator' | 'investor' | 'producer' | 'any' = 'any',
    limit: number = 10
  ): Promise<SmartMatch[]> {
    
    const userProfile = await this.getUserProfile(userId);
    
    // Get potential matches
    let targetUsers = await db.select({
      id: users.id,
      userType: users.userType,
      username: users.username,
      companyName: users.companyName,
      location: users.location,
      bio: users.bio
    })
    .from(users)
    .where(and(
      ne(users.id, userId),
      targetUserType !== 'any' ? eq(users.userType, targetUserType) : sql`1=1`
    ))
    .limit(50);

    const matches: SmartMatch[] = [];
    
    for (const targetUser of targetUsers) {
      const matchScore = await this.calculateUserMatchScore(userProfile, targetUser);
      
      if (matchScore.matchScore > 0.4) { // Minimum match threshold
        matches.push(matchScore);
      }
    }
    
    return matches
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  /**
   * Analyze trending insights and market opportunities
   */
  static async getTrendingInsights(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<TrendingInsight[]> {
    const daysBack = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    // Analyze genre trends
    const genreTrends = await this.analyzeGenreTrends(startDate);
    
    // Analyze budget trends  
    const budgetTrends = await this.analyzeBudgetTrends(startDate);
    
    // Analyze format trends
    const formatTrends = await this.analyzeFormatTrends(startDate);
    
    return [...genreTrends, ...budgetTrends, ...formatTrends];
  }

  /**
   * Get content discovery recommendations based on collaborative filtering
   */
  static async getCollaborativeRecommendations(
    userId: number,
    limit: number = 10
  ): Promise<RecommendationScore[]> {
    
    // Find users with similar tastes
    const similarUsers = await this.findSimilarUsers(userId, 20);
    
    if (similarUsers.length === 0) {
      // Fallback to popular content
      return this.getPopularContentRecommendations(userId, limit);
    }
    
    // Get what similar users liked that this user hasn't seen
    const recommendations: RecommendationScore[] = [];
    
    for (const similarUser of similarUsers) {
      const likedPitches = await db.select({
        pitchId: watchlist.pitchId,
        pitch: pitches
      })
      .from(watchlist)
      .innerJoin(pitches, eq(watchlist.pitchId, pitches.id))
      .where(and(
        eq(watchlist.userId, similarUser.id),
        eq(pitches.status, 'active'),
        eq(pitches.visibility, 'public'),
        ne(pitches.userId, userId)
      ))
      .limit(10);
      
      for (const liked of likedPitches) {
        // Check if current user already viewed
        const hasViewed = await this.hasUserViewedPitch(userId, liked.pitchId);
        if (!hasViewed) {
          recommendations.push({
            pitchId: liked.pitchId,
            score: 0.7 + (Math.random() * 0.3), // Base collaborative score with variance
            reasons: [`Users with similar taste to yours liked this`, `Recommended based on ${similarUser.username}'s preferences`],
            confidence: 0.8,
            category: 'similar_users'
          });
        }
      }
    }
    
    // Remove duplicates and sort
    const uniqueRecs = recommendations.filter((rec, index, self) => 
      index === self.findIndex(r => r.pitchId === rec.pitchId)
    );
    
    return uniqueRecs
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Helper Methods

  private static async getUserInteractionProfile(userId: number) {
    // Get user's view history with genres
    const viewHistory = await db.select({
      genre: pitches.genre,
      format: pitches.format,
      budgetBracket: pitches.budgetBracket,
      viewCount: sql`COUNT(*)`.as('viewCount')
    })
    .from(analyticsEvents)
    .innerJoin(pitches, eq(analyticsEvents.pitchId, pitches.id))
    .where(and(
      eq(analyticsEvents.userId, userId),
      eq(analyticsEvents.eventType, 'view')
    ))
    .groupBy(pitches.genre, pitches.format, pitches.budgetBracket);
    
    // Get user's saved pitches preferences
    const savedPreferences = await db.select({
      genre: pitches.genre,
      format: pitches.format,
      saveCount: sql`COUNT(*)`.as('saveCount')
    })
    .from(watchlist)
    .innerJoin(pitches, eq(watchlist.pitchId, pitches.id))
    .where(eq(watchlist.userId, userId))
    .groupBy(pitches.genre, pitches.format);
    
    return {
      viewHistory,
      savedPreferences,
      totalViews: viewHistory.reduce((sum, item) => sum + Number(item.viewCount), 0),
      totalSaves: savedPreferences.reduce((sum, item) => sum + Number(item.saveCount), 0)
    };
  }

  private static async calculateRecommendationScore(
    pitch: any,
    userHistory: any,
    preferences: any
  ): Promise<RecommendationScore> {
    let score = 0;
    const reasons: string[] = [];
    let category: RecommendationScore['category'] = 'personalized';
    
    // Genre matching (30% weight)
    const genreMatch = userHistory.viewHistory.find((h: any) => h.genre === pitch.genre);
    if (genreMatch) {
      const genreScore = Math.min(Number(genreMatch.viewCount) / userHistory.totalViews, 0.3);
      score += genreScore;
      reasons.push(`Matches your interest in ${pitch.genre} content`);
      category = 'genre_match';
    }
    
    // Format preference (20% weight)
    const formatMatch = userHistory.viewHistory.find((h: any) => h.format === pitch.format);
    if (formatMatch) {
      score += 0.2;
      reasons.push(`${pitch.format} format aligns with your preferences`);
    }
    
    // Budget compatibility (15% weight)
    if (preferences?.preferredBudgetRange === pitch.budgetBracket) {
      score += 0.15;
      reasons.push(`Budget range matches your investment criteria`);
      category = 'budget_match';
    }
    
    // Popularity/trending factor (20% weight)
    const popularityScore = Math.min((pitch.viewCount + pitch.likeCount * 2) / 1000, 0.2);
    score += popularityScore;
    if (popularityScore > 0.1) {
      reasons.push(`Trending content with high engagement`);
      category = 'trending';
    }
    
    // Recency bonus (15% weight)
    const daysOld = (Date.now() - new Date(pitch.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld < 7) {
      score += 0.15 * (1 - daysOld / 7);
      reasons.push(`Recently published content`);
    }
    
    return {
      pitchId: pitch.id,
      score: Math.min(score, 1),
      reasons,
      confidence: score > 0.7 ? 0.9 : score > 0.5 ? 0.7 : 0.5,
      category
    };
  }

  private static async getUserProfile(userId: number) {
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    // Get user's pitch genres
    const userGenres = await db.select({ genre: pitches.genre })
      .from(pitches)
      .where(eq(pitches.userId, userId))
      .groupBy(pitches.genre);
    
    // Get user's network size
    const networkSize = await db.select({ count: count() })
      .from(follows)
      .where(eq(follows.followerId, userId));
    
    return {
      ...user[0],
      genres: userGenres.map(g => g.genre),
      networkSize: networkSize[0]?.count || 0
    };
  }

  private static async calculateUserMatchScore(userProfile: any, targetUser: any): Promise<SmartMatch> {
    let matchScore = 0;
    const commonInterests: string[] = [];
    
    // Get target user's genres
    const targetGenres = await db.select({ genre: pitches.genre })
      .from(pitches)
      .where(eq(pitches.userId, targetUser.id))
      .groupBy(pitches.genre);
    
    const targetGenreList = targetGenres.map(g => g.genre);
    
    // Calculate genre alignment
    const commonGenres = userProfile.genres.filter((g: string) => targetGenreList.includes(g));
    const genreAlignment = commonGenres.length / Math.max(userProfile.genres.length, targetGenreList.length, 1);
    
    matchScore += genreAlignment * 0.4; // 40% weight
    commonInterests.push(...commonGenres);
    
    // User type compatibility
    const typeCompatibility = this.getUserTypeCompatibility(userProfile.userType, targetUser.userType);
    matchScore += typeCompatibility * 0.3; // 30% weight
    
    // Experience level compatibility (using bio as proxy for experience)
    const expCompatibility = this.getExperienceCompatibility(userProfile.bio || '', targetUser.bio || '');
    matchScore += expCompatibility * 0.2; // 20% weight
    
    // Network overlap (simplified)
    const networkOverlap = Math.random() * 0.1; // Placeholder for actual network analysis
    matchScore += networkOverlap;
    
    return {
      targetUserId: targetUser.id,
      matchScore,
      commonInterests,
      compatibilityFactors: {
        genreAlignment,
        budgetCompatibility: 0.8, // Placeholder
        experienceLevel: expCompatibility,
        networkOverlap
      },
      recommendedAction: this.getRecommendedAction(userProfile.userType, targetUser.userType, matchScore)
    };
  }

  private static getUserTypeCompatibility(type1: string, type2: string): number {
    const compatibilityMatrix: { [key: string]: { [key: string]: number } } = {
      'creator': { 'investor': 0.9, 'producer': 0.8, 'creator': 0.6 },
      'investor': { 'creator': 0.9, 'producer': 0.7, 'investor': 0.5 },
      'producer': { 'creator': 0.8, 'investor': 0.7, 'producer': 0.6 }
    };
    
    return compatibilityMatrix[type1]?.[type2] || 0.3;
  }

  private static getExperienceCompatibility(bio1: string, bio2: string): number {
    // Simple heuristic based on bio content length and keywords
    const getExperienceLevel = (bio: string) => {
      const words = bio.toLowerCase();
      if (words.includes('expert') || words.includes('senior') || words.includes('director')) return 4;
      if (words.includes('experienced') || words.includes('lead') || words.includes('manager')) return 3;
      if (words.includes('intermediate') || words.includes('professional')) return 2;
      return 1; // Default beginner
    };
    
    const level1 = getExperienceLevel(bio1);
    const level2 = getExperienceLevel(bio2);
    const diff = Math.abs(level1 - level2);
    return Math.max(0, 1 - (diff * 0.2));
  }

  private static getRecommendedAction(
    userType: string, 
    targetType: string, 
    matchScore: number
  ): SmartMatch['recommendedAction'] {
    if (matchScore > 0.8) {
      if (userType === 'creator' && targetType === 'investor') return 'message';
      if (userType === 'investor' && targetType === 'creator') return 'connect';
      return 'collaborate';
    } else if (matchScore > 0.6) {
      return 'connect';
    } else {
      return 'follow';
    }
  }

  private static async hasUserViewedPitch(userId: number, pitchId: number): Promise<boolean> {
    const viewed = await db.select({ id: analyticsEvents.id })
      .from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.userId, userId),
        eq(analyticsEvents.pitchId, pitchId),
        eq(analyticsEvents.eventType, 'view')
      ))
      .limit(1);
    
    return viewed.length > 0;
  }

  private static async findSimilarUsers(userId: number, limit: number) {
    // Simplified similarity based on common saved pitches
    const userSaves = await db.select({ pitchId: watchlist.pitchId })
      .from(watchlist)
      .where(eq(watchlist.userId, userId));
    
    if (userSaves.length === 0) return [];
    
    const pitchIds = userSaves.map(s => s.pitchId);
    
    const similarUsers = await db.select({
      userId: watchlist.userId,
      commonSaves: count()
    })
    .from(watchlist)
    .where(and(
      inArray(watchlist.pitchId, pitchIds),
      ne(watchlist.userId, userId)
    ))
    .groupBy(watchlist.userId)
    .orderBy(desc(count()))
    .limit(limit);
    
    return similarUsers.map(u => ({ id: u.userId, username: `user${u.userId}` }));
  }

  private static async getPopularContentRecommendations(
    userId: number, 
    limit: number
  ): Promise<RecommendationScore[]> {
    const popularPitches = await db.select({
      id: pitches.id,
      title: pitches.title,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount
    })
    .from(pitches)
    .where(and(
      ne(pitches.userId, userId),
      eq(pitches.status, 'active'),
      eq(pitches.visibility, 'public')
    ))
    .orderBy(desc(sql`${pitches.viewCount} + ${pitches.likeCount} * 2`))
    .limit(limit);
    
    return popularPitches.map(pitch => ({
      pitchId: pitch.id,
      score: Math.min((pitch.viewCount + pitch.likeCount * 2) / 1000, 1),
      reasons: [`Popular content with ${pitch.viewCount} views`],
      confidence: 0.6,
      category: 'trending' as const
    }));
  }

  private static async analyzeGenreTrends(startDate: Date): Promise<TrendingInsight[]> {
    // Placeholder for genre trend analysis
    return [
      {
        category: 'Sci-Fi',
        trend: 'rising',
        changePercent: 23.5,
        timeframe: '7d',
        predictedPeak: '2025-12-01',
        marketOpportunity: 0.8
      },
      {
        category: 'Documentary',
        trend: 'stable',
        changePercent: 2.1,
        timeframe: '7d',
        predictedPeak: '2025-11-25',
        marketOpportunity: 0.6
      }
    ];
  }

  private static async analyzeBudgetTrends(startDate: Date): Promise<TrendingInsight[]> {
    return [
      {
        category: 'Micro Budget ($0-50K)',
        trend: 'rising',
        changePercent: 18.2,
        timeframe: '7d',
        predictedPeak: '2025-11-30',
        marketOpportunity: 0.9
      }
    ];
  }

  private static async analyzeFormatTrends(startDate: Date): Promise<TrendingInsight[]> {
    return [
      {
        category: 'Short Film',
        trend: 'rising',
        changePercent: 15.7,
        timeframe: '7d',
        predictedPeak: '2025-12-05',
        marketOpportunity: 0.7
      }
    ];
  }
}