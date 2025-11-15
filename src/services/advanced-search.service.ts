/**
 * Advanced Search Service
 * Provides sophisticated search, filtering, and content discovery capabilities
 */

import { db } from "../db/client.ts";
import { pitches, users, analyticsEvents, watchlist, ndaRequests, searchFacets, 
  searchPatterns, trendingTopics } from "../db/schema.ts";
import { 
  eq, sql, desc, and, or, gte, lte, like, inArray, ne, count, avg, sum, 
  asc, ilike, between 
} from "npm:drizzle-orm@0.35.3";

export interface AdvancedSearchParams {
  // Text search
  query?: string;
  titleSearch?: string;
  loglineSearch?: string;
  descriptionSearch?: string;
  
  // Filters
  genres?: string[];
  formats?: string[];
  budgetRanges?: string[];
  stages?: string[];
  
  // User filters
  creatorTypes?: string[];
  experienceLevels?: string[];
  locations?: string[];
  
  // Metrics filters
  minViews?: number;
  maxViews?: number;
  minLikes?: number;
  maxLikes?: number;
  
  // Date filters
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  
  // Advanced filters
  hasNDA?: boolean;
  requiresInvestment?: boolean;
  availableForLicensing?: boolean;
  featuredOnly?: boolean;
  
  // Sorting
  sortBy?: 'relevance' | 'date' | 'popularity' | 'views' | 'likes' | 'alphabetical' | 'budget';
  sortOrder?: 'asc' | 'desc';
  
  // Pagination
  page?: number;
  limit?: number;
  
  // Search scope
  includePrivate?: boolean;
  excludeViewed?: boolean;
  similarTo?: number; // Pitch ID for similar content search
}

export interface SearchResult {
  pitches: Array<{
    id: number;
    title: string;
    logline: string;
    genre: string;
    format: string;
    budgetRange: string;
    stage: string;
    viewCount: number;
    likeCount: number;
    createdAt: Date;
    creator: {
      id: number;
      username: string;
      userType: string;
      experience?: string;
    };
    relevanceScore: number;
    matchReasons: string[];
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalResults: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  facets: {
    genres: Array<{ value: string; count: number }>;
    formats: Array<{ value: string; count: number }>;
    budgetRanges: Array<{ value: string; count: number }>;
    stages: Array<{ value: string; count: number }>;
  };
  suggestions: string[];
  searchTime: number;
}

export interface SimilarContentResult {
  similarPitches: Array<{
    id: number;
    title: string;
    similarityScore: number;
    similarityReasons: string[];
    pitch: any;
  }>;
  relatedUsers: Array<{
    id: number;
    username: string;
    relationshipType: 'similar_creator' | 'collaborator' | 'same_genre';
    score: number;
  }>;
}

export class AdvancedSearchService {

  /**
   * Perform advanced search with multiple criteria and intelligent ranking
   */
  static async search(params: AdvancedSearchParams, userId?: number): Promise<SearchResult> {
    const startTime = Date.now();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    // Build dynamic WHERE conditions
    const conditions = this.buildSearchConditions(params, userId);
    
    // Build base query
    let query = db.select({
      id: pitches.id,
      title: pitches.title,
      logline: pitches.logline,
      description: pitches.description,
      genre: pitches.genre,
      format: pitches.format,
      budgetRange: pitches.budgetRange,
      stage: pitches.stage,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount,
      createdAt: pitches.createdAt,
      updatedAt: pitches.updatedAt,
      userId: pitches.userId,
      visibility: pitches.visibility,
      status: pitches.status,
      // Creator info
      creatorUsername: users.username,
      creatorUserType: users.userType,
      creatorExperience: users.experience
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(and(...conditions));

    // Apply sorting
    query = this.applySorting(query, params);

    // Execute search query with pagination
    const results = await query.limit(limit).offset(offset);

    // Get total count for pagination
    const totalCountResult = await db.select({ count: count() })
      .from(pitches)
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(and(...conditions));

    const totalResults = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalResults / limit);

    // Calculate relevance scores
    const scoredResults = await this.calculateRelevanceScores(results, params);

    // Generate facets for filtering
    const facets = await this.generateFacets(conditions);

    // Generate search suggestions
    const suggestions = this.generateSearchSuggestions(params.query);

    const searchTime = Date.now() - startTime;

    return {
      pitches: scoredResults,
      pagination: {
        currentPage: page,
        totalPages,
        totalResults,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      facets,
      suggestions,
      searchTime
    };
  }

  /**
   * Find similar content to a given pitch
   */
  static async findSimilarContent(pitchId: number, limit: number = 10): Promise<SimilarContentResult> {
    // Get the reference pitch
    const referencePitch = await db.select()
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

    if (referencePitch.length === 0) {
      throw new Error('Reference pitch not found');
    }

    const refPitch = referencePitch[0];

    // Find similar pitches based on multiple criteria
    const similarPitches = await db.select({
      id: pitches.id,
      title: pitches.title,
      logline: pitches.logline,
      genre: pitches.genre,
      format: pitches.format,
      budgetRange: pitches.budgetRange,
      stage: pitches.stage,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount,
      createdAt: pitches.createdAt,
      userId: pitches.userId
    })
    .from(pitches)
    .where(and(
      ne(pitches.id, pitchId),
      eq(pitches.status, 'active'),
      eq(pitches.visibility, 'public')
    ))
    .limit(50); // Get more for scoring

    // Score similarity
    const scoredSimilar = similarPitches.map(pitch => ({
      ...pitch,
      similarityScore: this.calculateSimilarityScore(refPitch, pitch),
      similarityReasons: this.getSimilarityReasons(refPitch, pitch)
    }))
    .filter(p => p.similarityScore > 0.3)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);

    // Find related users (creators in same genre, collaborators, etc.)
    const relatedUsers = await this.findRelatedUsers(refPitch, 10);

    return {
      similarPitches: scoredSimilar.map(p => ({
        id: p.id,
        title: p.title,
        similarityScore: p.similarityScore,
        similarityReasons: p.similarityReasons,
        pitch: p
      })),
      relatedUsers
    };
  }

  /**
   * Get trending searches and popular queries
   */
  static async getTrendingSearches(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<{
    trendingQueries: Array<{ query: string; count: number; trend: 'up' | 'down' | 'stable' }>;
    popularFilters: Array<{ filter: string; value: string; usage: number }>;
    emergingTopics: Array<{ topic: string; growth: number }>;
  }> {
    // This would typically analyze search logs, but for now return mock data
    return {
      trendingQueries: [
        { query: 'sci-fi thriller', count: 156, trend: 'up' },
        { query: 'documentary climate', count: 89, trend: 'up' },
        { query: 'short film comedy', count: 67, trend: 'stable' },
        { query: 'horror micro budget', count: 45, trend: 'down' }
      ],
      popularFilters: [
        { filter: 'genre', value: 'Sci-Fi', usage: 234 },
        { filter: 'budgetRange', value: 'Micro Budget', usage: 189 },
        { filter: 'format', value: 'Feature Film', usage: 167 },
        { filter: 'stage', value: 'Development', usage: 145 }
      ],
      emergingTopics: [
        { topic: 'AI Documentary', growth: 45.2 },
        { topic: 'Climate Fiction', growth: 38.7 },
        { topic: 'VR Experience', growth: 29.1 }
      ]
    };
  }

  /**
   * Advanced faceted search with dynamic filtering
   */
  static async facetedSearch(
    baseParams: AdvancedSearchParams,
    facetField: 'genre' | 'format' | 'budgetRange' | 'stage',
    userId?: number
  ): Promise<Array<{ value: string; count: number; avgRating?: number }>> {
    
    const conditions = this.buildSearchConditions(baseParams, userId);
    
    const facetResults = await db.select({
      value: sql`${pitches[facetField]}`,
      count: count(),
      avgViews: avg(pitches.viewCount),
      avgLikes: avg(pitches.likeCount)
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(and(...conditions))
    .groupBy(sql`${pitches[facetField]}`)
    .orderBy(desc(count()));

    return facetResults.map(f => ({
      value: f.value as string,
      count: f.count,
      avgRating: (Number(f.avgViews) + Number(f.avgLikes) * 2) / 10 // Simplified rating
    }));
  }

  // Private Helper Methods

  private static buildSearchConditions(params: AdvancedSearchParams, userId?: number) {
    const conditions = [];

    // Base status condition
    conditions.push(eq(pitches.status, 'active'));

    // Visibility condition
    if (!params.includePrivate) {
      conditions.push(eq(pitches.visibility, 'public'));
    }

    // Text search conditions
    if (params.query) {
      const searchTerms = params.query.toLowerCase().split(' ').filter(term => term.length > 0);
      const textConditions = searchTerms.map(term => 
        or(
          ilike(pitches.title, `%${term}%`),
          ilike(pitches.logline, `%${term}%`),
          ilike(pitches.description, `%${term}%`)
        )
      );
      conditions.push(and(...textConditions));
    }

    if (params.titleSearch) {
      conditions.push(ilike(pitches.title, `%${params.titleSearch}%`));
    }

    if (params.loglineSearch) {
      conditions.push(ilike(pitches.logline, `%${params.loglineSearch}%`));
    }

    // Filter conditions
    if (params.genres?.length) {
      conditions.push(inArray(pitches.genre, params.genres));
    }

    if (params.formats?.length) {
      conditions.push(inArray(pitches.format, params.formats));
    }

    if (params.budgetRanges?.length) {
      conditions.push(inArray(pitches.budgetRange, params.budgetRanges));
    }

    if (params.stages?.length) {
      conditions.push(inArray(pitches.stage, params.stages));
    }

    // Metrics filters
    if (params.minViews !== undefined) {
      conditions.push(gte(pitches.viewCount, params.minViews));
    }

    if (params.maxViews !== undefined) {
      conditions.push(lte(pitches.viewCount, params.maxViews));
    }

    if (params.minLikes !== undefined) {
      conditions.push(gte(pitches.likeCount, params.minLikes));
    }

    if (params.maxLikes !== undefined) {
      conditions.push(lte(pitches.likeCount, params.maxLikes));
    }

    // Date filters
    if (params.createdAfter) {
      conditions.push(gte(pitches.createdAt, new Date(params.createdAfter)));
    }

    if (params.createdBefore) {
      conditions.push(lte(pitches.createdAt, new Date(params.createdBefore)));
    }

    if (params.updatedAfter) {
      conditions.push(gte(pitches.updatedAt, new Date(params.updatedAfter)));
    }

    // User type filters
    if (params.creatorTypes?.length) {
      conditions.push(inArray(users.userType, params.creatorTypes));
    }

    if (params.experienceLevels?.length) {
      conditions.push(inArray(users.experience, params.experienceLevels));
    }

    // Exclude viewed pitches for current user
    if (params.excludeViewed && userId) {
      // This would require a subquery - simplified for now
      // conditions.push(sql`${pitches.id} NOT IN (SELECT pitch_id FROM analytics_events WHERE user_id = ${userId} AND event_type = 'view')`);
    }

    return conditions;
  }

  private static applySorting(query: any, params: AdvancedSearchParams) {
    const sortBy = params.sortBy || 'relevance';
    const sortOrder = params.sortOrder || 'desc';
    const orderFn = sortOrder === 'asc' ? asc : desc;

    switch (sortBy) {
      case 'date':
        return query.orderBy(orderFn(pitches.createdAt));
      case 'popularity':
        return query.orderBy(orderFn(sql`${pitches.viewCount} + ${pitches.likeCount} * 2`));
      case 'views':
        return query.orderBy(orderFn(pitches.viewCount));
      case 'likes':
        return query.orderBy(orderFn(pitches.likeCount));
      case 'alphabetical':
        return query.orderBy(orderFn(pitches.title));
      case 'budget':
        return query.orderBy(orderFn(pitches.budgetRange)); // Would need custom ordering
      case 'relevance':
      default:
        // For relevance, we'll sort by a combination of factors
        return query.orderBy(desc(sql`${pitches.viewCount} * 0.3 + ${pitches.likeCount} * 0.7`));
    }
  }

  private static async calculateRelevanceScores(results: any[], params: AdvancedSearchParams) {
    return results.map(result => {
      let relevanceScore = 0;
      const matchReasons: string[] = [];

      // Text match scoring
      if (params.query) {
        const queryLower = params.query.toLowerCase();
        if (result.title.toLowerCase().includes(queryLower)) {
          relevanceScore += 0.4;
          matchReasons.push('Title matches search query');
        }
        if (result.logline.toLowerCase().includes(queryLower)) {
          relevanceScore += 0.3;
          matchReasons.push('Logline matches search query');
        }
        if (result.description?.toLowerCase().includes(queryLower)) {
          relevanceScore += 0.2;
          matchReasons.push('Description matches search query');
        }
      }

      // Filter match scoring
      if (params.genres?.includes(result.genre)) {
        relevanceScore += 0.2;
        matchReasons.push(`Matches ${result.genre} genre filter`);
      }

      if (params.formats?.includes(result.format)) {
        relevanceScore += 0.15;
        matchReasons.push(`Matches ${result.format} format filter`);
      }

      // Popularity scoring
      const popularityScore = Math.min((result.viewCount + result.likeCount * 2) / 1000, 0.3);
      relevanceScore += popularityScore;

      if (popularityScore > 0.1) {
        matchReasons.push('Popular content');
      }

      // Recency scoring
      const daysOld = (Date.now() - new Date(result.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld < 30) {
        const recencyScore = 0.1 * (1 - daysOld / 30);
        relevanceScore += recencyScore;
        if (recencyScore > 0.05) {
          matchReasons.push('Recently created');
        }
      }

      return {
        id: result.id,
        title: result.title,
        logline: result.logline,
        genre: result.genre,
        format: result.format,
        budgetRange: result.budgetRange,
        stage: result.stage,
        viewCount: result.viewCount,
        likeCount: result.likeCount,
        createdAt: result.createdAt,
        creator: {
          id: result.userId,
          username: result.creatorUsername,
          userType: result.creatorUserType,
          experience: result.creatorExperience
        },
        relevanceScore: Math.min(relevanceScore, 1),
        matchReasons
      };
    });
  }

  private static async generateFacets(conditions: any[]) {
    // Generate facet counts for each filterable field
    const [genreFacets, formatFacets, budgetFacets, stageFacets] = await Promise.all([
      this.getFacetCounts('genre', conditions),
      this.getFacetCounts('format', conditions),
      this.getFacetCounts('budgetRange', conditions),
      this.getFacetCounts('stage', conditions)
    ]);

    return {
      genres: genreFacets,
      formats: formatFacets,
      budgetRanges: budgetFacets,
      stages: stageFacets
    };
  }

  private static async getFacetCounts(field: string, conditions: any[]) {
    const results = await db.select({
      value: sql`${pitches[field as keyof typeof pitches]}`,
      count: count()
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(and(...conditions))
    .groupBy(sql`${pitches[field as keyof typeof pitches]}`)
    .orderBy(desc(count()));

    return results.map(r => ({
      value: r.value as string,
      count: r.count
    }));
  }

  private static generateSearchSuggestions(query?: string): string[] {
    if (!query) return [];
    
    // Simple suggestion generation - in reality this would be more sophisticated
    const suggestions = [
      `${query} documentary`,
      `${query} feature film`,
      `${query} short film`,
      `micro budget ${query}`,
      `${query} thriller`,
      `${query} drama`
    ];

    return suggestions.slice(0, 4);
  }

  private static calculateSimilarityScore(refPitch: any, comparePitch: any): number {
    let score = 0;

    // Genre match (40% weight)
    if (refPitch.genre === comparePitch.genre) {
      score += 0.4;
    }

    // Format match (20% weight)
    if (refPitch.format === comparePitch.format) {
      score += 0.2;
    }

    // Budget range match (15% weight)
    if (refPitch.budgetRange === comparePitch.budgetRange) {
      score += 0.15;
    }

    // Stage match (10% weight)
    if (refPitch.stage === comparePitch.stage) {
      score += 0.1;
    }

    // Popularity similarity (15% weight)
    const refPop = refPitch.viewCount + refPitch.likeCount * 2;
    const compPop = comparePitch.viewCount + comparePitch.likeCount * 2;
    const popSimilarity = 1 - Math.abs(refPop - compPop) / Math.max(refPop, compPop, 1);
    score += popSimilarity * 0.15;

    return score;
  }

  private static getSimilarityReasons(refPitch: any, comparePitch: any): string[] {
    const reasons = [];

    if (refPitch.genre === comparePitch.genre) {
      reasons.push(`Same genre: ${refPitch.genre}`);
    }

    if (refPitch.format === comparePitch.format) {
      reasons.push(`Same format: ${refPitch.format}`);
    }

    if (refPitch.budgetRange === comparePitch.budgetRange) {
      reasons.push(`Similar budget range: ${refPitch.budgetRange}`);
    }

    if (refPitch.stage === comparePitch.stage) {
      reasons.push(`Same development stage: ${refPitch.stage}`);
    }

    return reasons;
  }

  private static async findRelatedUsers(refPitch: any, limit: number) {
    // Find creators in the same genre
    const sameGenreCreators = await db.select({
      id: users.id,
      username: users.username,
      pitchCount: count(pitches.id)
    })
    .from(users)
    .innerJoin(pitches, eq(users.id, pitches.userId))
    .where(and(
      eq(pitches.genre, refPitch.genre),
      ne(users.id, refPitch.userId)
    ))
    .groupBy(users.id, users.username)
    .orderBy(desc(count(pitches.id)))
    .limit(limit);

    return sameGenreCreators.map(creator => ({
      id: creator.id,
      username: creator.username,
      relationshipType: 'same_genre' as const,
      score: Math.min(creator.pitchCount / 10, 1)
    }));
  }
}