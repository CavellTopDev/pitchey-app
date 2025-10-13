import { db } from "../db/client.ts";
import { 
  pitches, 
  users, 
  ndas, 
  follows, 
  analyticsEvents,
  userSessions 
} from "../db/schema.ts";
import { 
  eq, 
  and, 
  or, 
  gte, 
  lte, 
  like, 
  ilike,
  sql, 
  desc, 
  asc, 
  inArray,
  isNull,
  isNotNull,
  count,
  exists
} from "drizzle-orm";
import { searchCache, SearchCacheService } from "./search-cache.service.ts";

// Define search interfaces
export interface SearchFilters {
  query?: string;
  genres?: string[];
  formats?: string[];
  budgetMin?: number;
  budgetMax?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string[];
  hasNDA?: boolean;
  isFollowing?: boolean;
  hasMedia?: string[];
  viewCountMin?: number;
  viewCountMax?: number;
  likeCountMin?: number;
  likeCountMax?: number;
  ndaCountMin?: number;
  ndaCountMax?: number;
  creatorType?: 'creator' | 'production' | 'any';
  verifiedOnly?: boolean;
  location?: string;
  fundingProgress?: {
    min?: number;
    max?: number;
  };
  ndaRequirement?: 'none' | 'basic' | 'enhanced' | 'any';
  sortBy?: 'relevance' | 'newest' | 'oldest' | 'views' | 'likes' | 'ndas' | 'budget_high' | 'budget_low' | 'alpha';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis?: string;
  titleImage?: string;
  budgetBracket?: string;
  estimatedBudget?: string;
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  status: string;
  createdAt: Date;
  publishedAt?: Date;
  relevanceScore?: number;
  hasNDA?: boolean;
  ndaType?: string;
  isFollowing?: boolean;
  hasLookbook: boolean;
  hasScript: boolean;
  hasTrailer: boolean;
  hasPitchDeck: boolean;
  creator: {
    id: number;
    username: string;
    userType: string;
    companyName?: string;
    companyVerified: boolean;
    location?: string;
  };
}

export interface SearchSuggestion {
  query: string;
  type: 'search' | 'genre' | 'format' | 'creator' | 'title';
  count?: number;
  relevance?: number;
}

export interface PopularSearch {
  query: string;
  searchCount: number;
  clickThroughRate: number;
  lastSearched: Date;
}

export interface SavedSearch {
  id: number;
  userId: number;
  name: string;
  filters: SearchFilters;
  createdAt: Date;
  lastUsed?: Date;
  useCount: number;
}

export class SearchService {
  // Full-text search with weighted scoring
  static buildSearchQuery(query: string) {
    const searchTerm = query.toLowerCase().trim();
    const words = searchTerm.split(/\s+/).filter(word => word.length > 0);
    
    // Build weighted search conditions
    const titleMatch = words.map(word => 
      sql`LOWER(${pitches.title}) LIKE '%${word}%'`
    );
    
    const loglineMatch = words.map(word => 
      sql`LOWER(${pitches.logline}) LIKE '%${word}%'`
    );
    
    const synopsisMatch = words.map(word => 
      sql`(LOWER(${pitches.shortSynopsis}) LIKE '%${word}%' OR LOWER(${pitches.longSynopsis}) LIKE '%${word}%')`
    );
    
    // Fuzzy matching using PostgreSQL similarity
    const fuzzyTitleMatch = sql`similarity(LOWER(${pitches.title}), LOWER(${searchTerm})) > 0.3`;
    const fuzzyLoglineMatch = sql`similarity(LOWER(${pitches.logline}), LOWER(${searchTerm})) > 0.2`;
    
    return {
      searchCondition: or(
        and(...titleMatch),
        and(...loglineMatch),
        and(...synopsisMatch),
        fuzzyTitleMatch,
        fuzzyLoglineMatch
      ),
      relevanceScore: sql`
        (
          CASE 
            WHEN LOWER(${pitches.title}) = LOWER(${searchTerm}) THEN 100
            WHEN LOWER(${pitches.title}) LIKE LOWER('%${searchTerm}%') THEN 80
            WHEN ${and(...titleMatch)} THEN 70
            WHEN LOWER(${pitches.logline}) LIKE LOWER('%${searchTerm}%') THEN 60
            WHEN ${and(...loglineMatch)} THEN 50
            WHEN ${and(...synopsisMatch)} THEN 30
            WHEN similarity(LOWER(${pitches.title}), LOWER(${searchTerm})) > 0.3 THEN 40
            WHEN similarity(LOWER(${pitches.logline}), LOWER(${searchTerm})) > 0.2 THEN 25
            ELSE 10
          END +
          CASE WHEN ${pitches.genre} = ANY(${words}) THEN 20 ELSE 0 END +
          CASE WHEN ${pitches.format} = ANY(${words}) THEN 15 ELSE 0 END +
          (${pitches.viewCount} * 0.01) +
          (${pitches.likeCount} * 0.05) +
          (${pitches.ndaCount} * 0.1)
        ) as relevance_score
      `
    };
  }

  // Advanced search with comprehensive filtering
  static async advancedSearch(filters: SearchFilters, userId?: number): Promise<{
    results: SearchResult[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
    aggregations: {
      genreCounts: Record<string, number>;
      formatCounts: Record<string, number>;
      budgetRanges: Record<string, number>;
    };
    cached?: boolean;
  }> {
    // Generate cache key for this search
    const cacheFilters = { ...filters };
    // Remove user-specific filters from cache key to allow sharing
    delete cacheFilters.hasNDA;
    delete cacheFilters.isFollowing;
    
    const cacheKey = SearchCacheService.generateCacheKey(cacheFilters);
    const cacheTTL = 5 * 60 * 1000; // 5 minutes for search results
    
    // Try to get from cache first
    const cachedResult = await searchCache.get(cacheKey);
    if (cachedResult) {
      // For cached results, we still need to enrich with user-specific data
      if (userId) {
        const enrichedResults = await this.enrichResults(cachedResult.results, userId, filters);
        return {
          ...cachedResult,
          results: enrichedResults,
          cached: true
        };
      }
      return { ...cachedResult, cached: true };
    }
    // Build base query
    let query = db.select({
      id: pitches.id,
      title: pitches.title,
      logline: pitches.logline,
      genre: pitches.genre,
      format: pitches.format,
      shortSynopsis: pitches.shortSynopsis,
      titleImage: pitches.titleImage,
      budgetBracket: pitches.budgetBracket,
      estimatedBudget: pitches.estimatedBudget,
      viewCount: pitches.viewCount,
      likeCount: pitches.likeCount,
      ndaCount: pitches.ndaCount,
      status: pitches.status,
      createdAt: pitches.createdAt,
      publishedAt: pitches.publishedAt,
      hasLookbook: sql<boolean>`${pitches.lookbookUrl} IS NOT NULL`,
      hasScript: sql<boolean>`${pitches.scriptUrl} IS NOT NULL`,
      hasTrailer: sql<boolean>`${pitches.trailerUrl} IS NOT NULL`,
      hasPitchDeck: sql<boolean>`${pitches.pitchDeckUrl} IS NOT NULL`,
      creator: {
        id: users.id,
        username: users.username,
        userType: users.userType,
        companyName: users.companyName,
        companyVerified: users.companyVerified,
        location: users.location,
      },
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id));

    // Build WHERE conditions
    const conditions = [];
    
    // Default to published pitches only unless status is specified
    if (!filters.status || filters.status.length === 0) {
      conditions.push(eq(pitches.status, 'published'));
    } else {
      conditions.push(inArray(pitches.status, filters.status));
    }

    // Text search with weighted scoring
    let relevanceScore = null;
    if (filters.query) {
      const searchQuery = this.buildSearchQuery(filters.query);
      conditions.push(searchQuery.searchCondition);
      relevanceScore = searchQuery.relevanceScore;
    }

    // Apply all filters
    this.applyFilters(conditions, filters);

    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Add relevance score to query if searching
    if (relevanceScore) {
      query = query.addFields({ relevanceScore });
    }

    // Apply sorting
    this.applySorting(query, filters, !!relevanceScore);

    // Pagination
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;
    
    query = query.limit(limit).offset(offset);

    // Execute query
    const results = await query;

    // Get total count
    const total = await this.getTotalCount(conditions);

    // Enrich results with user-specific data
    const enrichedResults = await this.enrichResults(results, userId, filters);

    // Get aggregations
    const aggregations = await this.getAggregations(conditions);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);

    // Track search analytics
    if (userId && filters.query) {
      await this.trackSearchEvent(userId, filters, results.length);
    }

    const searchResult = {
      results: enrichedResults,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
      aggregations,
      cached: false
    };

    // Cache the results (without user-specific data for sharing)
    const cacheableResult = {
      ...searchResult,
      results: results // Use original results without user enrichment
    };
    
    // Only cache if results are not empty and not user-specific
    if (results.length > 0 && !filters.hasNDA && !filters.isFollowing) {
      await searchCache.set(cacheKey, cacheableResult, cacheTTL);
    }

    return searchResult;
  }

  // Apply various filters to the query conditions
  private static applyFilters(conditions: any[], filters: SearchFilters) {
    // Genre filter
    if (filters.genres && filters.genres.length > 0) {
      conditions.push(inArray(pitches.genre, filters.genres));
    }

    // Format filter
    if (filters.formats && filters.formats.length > 0) {
      conditions.push(inArray(pitches.format, filters.formats));
    }

    // Budget range
    if (filters.budgetMin !== undefined) {
      conditions.push(gte(pitches.estimatedBudget, filters.budgetMin));
    }
    if (filters.budgetMax !== undefined) {
      conditions.push(lte(pitches.estimatedBudget, filters.budgetMax));
    }

    // Date range
    if (filters.dateFrom) {
      conditions.push(gte(pitches.publishedAt, new Date(filters.dateFrom).toISOString()));
    }
    if (filters.dateTo) {
      conditions.push(lte(pitches.publishedAt, new Date(filters.dateTo).toISOString()));
    }

    // View count range
    if (filters.viewCountMin !== undefined) {
      conditions.push(gte(pitches.viewCount, filters.viewCountMin));
    }
    if (filters.viewCountMax !== undefined) {
      conditions.push(lte(pitches.viewCount, filters.viewCountMax));
    }

    // Like count range
    if (filters.likeCountMin !== undefined) {
      conditions.push(gte(pitches.likeCount, filters.likeCountMin));
    }
    if (filters.likeCountMax !== undefined) {
      conditions.push(lte(pitches.likeCount, filters.likeCountMax));
    }

    // NDA count range
    if (filters.ndaCountMin !== undefined) {
      conditions.push(gte(pitches.ndaCount, filters.ndaCountMin));
    }
    if (filters.ndaCountMax !== undefined) {
      conditions.push(lte(pitches.ndaCount, filters.ndaCountMax));
    }

    // Creator type filter
    if (filters.creatorType && filters.creatorType !== 'any') {
      conditions.push(eq(users.userType, filters.creatorType));
    }

    // Verified creators only
    if (filters.verifiedOnly) {
      conditions.push(eq(users.companyVerified, true));
    }

    // Location filter
    if (filters.location) {
      conditions.push(ilike(users.location, `%${filters.location}%`));
    }

    // Media filters
    if (filters.hasMedia && filters.hasMedia.length > 0) {
      for (const mediaType of filters.hasMedia) {
        switch (mediaType) {
          case 'lookbook':
            conditions.push(isNotNull(pitches.lookbookUrl));
            break;
          case 'script':
            conditions.push(isNotNull(pitches.scriptUrl));
            break;
          case 'trailer':
            conditions.push(isNotNull(pitches.trailerUrl));
            break;
          case 'pitch_deck':
            conditions.push(isNotNull(pitches.pitchDeckUrl));
            break;
        }
      }
    }
  }

  // Apply sorting to the query
  private static applySorting(query: any, filters: SearchFilters, hasRelevanceScore: boolean) {
    const sortBy = filters.sortBy || 'relevance';
    const sortOrder = filters.sortOrder || 'desc';
    
    switch (sortBy) {
      case 'relevance':
        if (hasRelevanceScore) {
          query = query.orderBy(desc(sql`relevance_score`));
        } else {
          query = query.orderBy(desc(pitches.viewCount)); // Fallback to popularity
        }
        break;
      case 'newest':
        query = query.orderBy(desc(pitches.publishedAt));
        break;
      case 'oldest':
        query = query.orderBy(asc(pitches.publishedAt));
        break;
      case 'views':
        query = query.orderBy(sortOrder === 'desc' ? desc(pitches.viewCount) : asc(pitches.viewCount));
        break;
      case 'likes':
        query = query.orderBy(sortOrder === 'desc' ? desc(pitches.likeCount) : asc(pitches.likeCount));
        break;
      case 'ndas':
        query = query.orderBy(sortOrder === 'desc' ? desc(pitches.ndaCount) : asc(pitches.ndaCount));
        break;
      case 'budget_high':
        query = query.orderBy(desc(pitches.estimatedBudget));
        break;
      case 'budget_low':
        query = query.orderBy(asc(pitches.estimatedBudget));
        break;
      case 'alpha':
        query = query.orderBy(asc(pitches.title));
        break;
      default:
        query = query.orderBy(desc(pitches.publishedAt));
    }

    return query;
  }

  // Get total count for pagination
  private static async getTotalCount(conditions: any[]): Promise<number> {
    const countQuery = db.select({
      count: sql<number>`COUNT(*)`,
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id));

    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }

    const result = await countQuery;
    return result[0]?.count || 0;
  }

  // Enrich results with user-specific data
  private static async enrichResults(
    results: any[], 
    userId?: number, 
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    if (!userId) {
      return results.map(result => ({
        ...result,
        hasNDA: false,
        isFollowing: false,
      }));
    }

    // Get user's NDAs
    const userNDAs = await db.select({
      pitchId: ndas.pitchId,
      ndaType: ndas.ndaType,
    })
    .from(ndas)
    .where(and(
      eq(ndas.signerId, userId),
      eq(ndas.accessGranted, true)
    ));

    const ndaMap = new Map(userNDAs.map(n => [n.pitchId, n.ndaType]));

    // Get user's follows
    const userFollows = await db.select({
      pitchId: follows.pitchId,
    })
    .from(follows)
    .where(eq(follows.followerId, userId));

    const followSet = new Set(userFollows.map(f => f.pitchId));

    // Enrich results
    let enrichedResults = results.map(pitch => ({
      ...pitch,
      hasNDA: ndaMap.has(pitch.id),
      ndaType: ndaMap.get(pitch.id) || null,
      isFollowing: followSet.has(pitch.id),
    }));

    // Apply post-query filters that require user data
    if (filters?.hasNDA === true) {
      enrichedResults = enrichedResults.filter(p => p.hasNDA);
    } else if (filters?.hasNDA === false) {
      enrichedResults = enrichedResults.filter(p => !p.hasNDA);
    }

    if (filters?.isFollowing === true) {
      enrichedResults = enrichedResults.filter(p => p.isFollowing);
    } else if (filters?.isFollowing === false) {
      enrichedResults = enrichedResults.filter(p => !p.isFollowing);
    }

    return enrichedResults;
  }

  // Get search result aggregations
  private static async getAggregations(conditions: any[]) {
    const baseQuery = db.select()
      .from(pitches)
      .innerJoin(users, eq(pitches.userId, users.id));

    if (conditions.length > 0) {
      baseQuery.where(and(...conditions));
    }

    // Genre counts
    const genreCounts = await db.select({
      genre: pitches.genre,
      count: sql<number>`COUNT(*)`,
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(pitches.genre);

    // Format counts
    const formatCounts = await db.select({
      format: pitches.format,
      count: sql<number>`COUNT(*)`,
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(pitches.format);

    // Budget ranges
    const budgetRanges = await db.select({
      range: sql<string>`
        CASE 
          WHEN estimated_budget < 100000 THEN 'Under $100K'
          WHEN estimated_budget < 1000000 THEN '$100K - $1M'
          WHEN estimated_budget < 10000000 THEN '$1M - $10M'
          WHEN estimated_budget < 50000000 THEN '$10M - $50M'
          ELSE '$50M+'
        END
      `,
      count: sql<number>`COUNT(*)`,
    })
    .from(pitches)
    .innerJoin(users, eq(pitches.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(sql`
      CASE 
        WHEN estimated_budget < 100000 THEN 'Under $100K'
        WHEN estimated_budget < 1000000 THEN '$100K - $1M'
        WHEN estimated_budget < 10000000 THEN '$1M - $10M'
        WHEN estimated_budget < 50000000 THEN '$10M - $50M'
        ELSE '$50M+'
      END
    `);

    return {
      genreCounts: Object.fromEntries(genreCounts.map(g => [g.genre, g.count])),
      formatCounts: Object.fromEntries(formatCounts.map(f => [f.format, f.count])),
      budgetRanges: Object.fromEntries(budgetRanges.map(b => [b.range, b.count])),
    };
  }

  // Get search suggestions based on query
  static async getSearchSuggestions(query: string, limit = 10): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    const searchTerm = query.toLowerCase().trim();

    if (searchTerm.length < 2) {
      return suggestions;
    }

    // Get title suggestions
    const titleSuggestions = await db.select({
      title: pitches.title,
      count: sql<number>`COUNT(*)`,
    })
    .from(pitches)
    .where(and(
      eq(pitches.status, 'published'),
      ilike(pitches.title, `%${searchTerm}%`)
    ))
    .groupBy(pitches.title)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(5);

    suggestions.push(...titleSuggestions.map(t => ({
      query: t.title,
      type: 'title' as const,
      count: t.count,
      relevance: 100
    })));

    // Get genre suggestions
    const genreSuggestions = await db.select({
      genre: pitches.genre,
      count: sql<number>`COUNT(*)`,
    })
    .from(pitches)
    .where(and(
      eq(pitches.status, 'published'),
      ilike(pitches.genre, `%${searchTerm}%`)
    ))
    .groupBy(pitches.genre)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(3);

    suggestions.push(...genreSuggestions.map(g => ({
      query: g.genre,
      type: 'genre' as const,
      count: g.count,
      relevance: 80
    })));

    // Get creator suggestions
    const creatorSuggestions = await db.select({
      username: users.username,
      count: sql<number>`COUNT(DISTINCT ${pitches.id})`,
    })
    .from(users)
    .innerJoin(pitches, eq(users.id, pitches.userId))
    .where(and(
      eq(pitches.status, 'published'),
      ilike(users.username, `%${searchTerm}%`)
    ))
    .groupBy(users.username)
    .orderBy(desc(sql`COUNT(DISTINCT ${pitches.id})`))
    .limit(3);

    suggestions.push(...creatorSuggestions.map(c => ({
      query: c.username,
      type: 'creator' as const,
      count: c.count,
      relevance: 70
    })));

    // Get popular search terms from analytics
    const popularSearches = await db.select({
      query: sql<string>`event_data->>'query'`,
      count: sql<number>`COUNT(*)`,
    })
    .from(analyticsEvents)
    .where(and(
      eq(analyticsEvents.eventType, 'search'),
      sql`event_data->>'query' ILIKE '%${searchTerm}%'`,
      gte(analyticsEvents.createdAt, sql`NOW() - INTERVAL '30 days'`)
    ))
    .groupBy(sql`event_data->>'query'`)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(3);

    suggestions.push(...popularSearches.map(s => ({
      query: s.query,
      type: 'search' as const,
      count: s.count,
      relevance: 60
    })));

    // Sort by relevance and limit
    return suggestions
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
      .slice(0, limit);
  }

  // Get popular searches
  static async getPopularSearches(limit = 10): Promise<PopularSearch[]> {
    const results = await db.select({
      query: sql<string>`event_data->>'query'`,
      searchCount: sql<number>`COUNT(*)`,
      lastSearched: sql<Date>`MAX(timestamp)`,
      uniqueUsers: sql<number>`COUNT(DISTINCT user_id)`,
    })
    .from(analyticsEvents)
    .where(and(
      eq(analyticsEvents.eventType, 'search'),
      isNotNull(sql`event_data->>'query'`),
      gte(analyticsEvents.createdAt, sql`NOW() - INTERVAL '30 days'`)
    ))
    .groupBy(sql`event_data->>'query'`)
    .having(sql`COUNT(*) >= 5`) // Minimum search count
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);

    return results.map(r => ({
      query: r.query,
      searchCount: r.searchCount,
      clickThroughRate: 0.75, // TODO: Calculate actual CTR from analytics
      lastSearched: r.lastSearched,
    }));
  }

  // Track search analytics
  private static async trackSearchEvent(
    userId: number, 
    filters: SearchFilters, 
    resultCount: number
  ) {
    try {
      await db.insert(analyticsEvents).values({
        eventType: 'search',
        eventCategory: 'search',
        userId,
        eventData: {
          query: filters.query,
          filters: filters,
          resultsCount: resultCount,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to track search event:', error);
    }
  }

  // Save search for user
  static async saveSearch(
    userId: number, 
    name: string, 
    filters: SearchFilters,
    options: {
      description?: string;
      isPublic?: boolean;
      notifyOnResults?: boolean;
    } = {}
  ): Promise<SavedSearch> {
    try {
      const { savedSearches } = await import("../db/schema.ts");
      
      const savedSearch = await db.insert(savedSearches).values({
        userId,
        name,
        description: options.description,
        filters: filters as any,
        isPublic: options.isPublic || false,
        notifyOnResults: options.notifyOnResults || false,
      }).returning();

      return {
        id: savedSearch[0].id,
        userId: savedSearch[0].userId,
        name: savedSearch[0].name,
        description: savedSearch[0].description || undefined,
        filters: savedSearch[0].filters,
        useCount: savedSearch[0].useCount,
        lastUsed: savedSearch[0].lastUsed || undefined,
        isPublic: savedSearch[0].isPublic,
        notifyOnResults: savedSearch[0].notifyOnResults,
        createdAt: savedSearch[0].createdAt,
        updatedAt: savedSearch[0].updatedAt,
      };
    } catch (error) {
      console.error('Failed to save search:', error);
      throw new Error('Failed to save search');
    }
  }

  // Get user's saved searches
  static async getSavedSearches(userId: number): Promise<SavedSearch[]> {
    try {
      const { savedSearches } = await import("../db/schema.ts");
      
      const searches = await db.select()
        .from(savedSearches)
        .where(eq(savedSearches.userId, userId))
        .orderBy(desc(savedSearches.lastUsed), desc(savedSearches.createdAt));

      return searches.map(search => ({
        id: search.id,
        userId: search.userId,
        name: search.name,
        description: search.description || undefined,
        filters: search.filters,
        useCount: search.useCount,
        lastUsed: search.lastUsed || undefined,
        isPublic: search.isPublic,
        notifyOnResults: search.notifyOnResults,
        createdAt: search.createdAt,
        updatedAt: search.updatedAt,
      }));
    } catch (error) {
      console.error('Failed to get saved searches:', error);
      return [];
    }
  }

  // Update saved search
  static async updateSavedSearch(
    userId: number,
    searchId: number,
    updates: Partial<{
      name: string;
      description: string;
      filters: SearchFilters;
      isPublic: boolean;
      notifyOnResults: boolean;
    }>
  ): Promise<SavedSearch | null> {
    try {
      const { savedSearches } = await import("../db/schema.ts");
      
      const updatedSearch = await db.update(savedSearches)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(and(
          eq(savedSearches.id, searchId),
          eq(savedSearches.userId, userId)
        ))
        .returning();

      if (updatedSearch.length === 0) {
        return null;
      }

      const search = updatedSearch[0];
      return {
        id: search.id,
        userId: search.userId,
        name: search.name,
        description: search.description || undefined,
        filters: search.filters,
        useCount: search.useCount,
        lastUsed: search.lastUsed || undefined,
        isPublic: search.isPublic,
        notifyOnResults: search.notifyOnResults,
        createdAt: search.createdAt,
        updatedAt: search.updatedAt,
      };
    } catch (error) {
      console.error('Failed to update saved search:', error);
      return null;
    }
  }

  // Delete saved search
  static async deleteSavedSearch(userId: number, searchId: number): Promise<boolean> {
    try {
      const { savedSearches } = await import("../db/schema.ts");
      
      const deleted = await db.delete(savedSearches)
        .where(and(
          eq(savedSearches.id, searchId),
          eq(savedSearches.userId, userId)
        ))
        .returning();

      return deleted.length > 0;
    } catch (error) {
      console.error('Failed to delete saved search:', error);
      return false;
    }
  }

  // Use saved search (increment usage stats)
  static async useSavedSearch(userId: number, searchId: number): Promise<SearchFilters | null> {
    try {
      const { savedSearches } = await import("../db/schema.ts");
      
      // Get the search first
      const search = await db.select()
        .from(savedSearches)
        .where(and(
          eq(savedSearches.id, searchId),
          eq(savedSearches.userId, userId)
        ))
        .limit(1);

      if (search.length === 0) {
        return null;
      }

      // Update usage stats
      await db.update(savedSearches)
        .set({
          useCount: search[0].useCount + 1,
          lastUsed: new Date(),
        })
        .where(eq(savedSearches.id, searchId));

      return search[0].filters;
    } catch (error) {
      console.error('Failed to use saved search:', error);
      return null;
    }
  }

  // Get user's search history
  static async getSearchHistory(userId: number, limit = 20): Promise<string[]> {
    const results = await db.select({
      query: sql<string>`event_data->>'query'`,
      timestamp: analyticsEvents.timestamp,
    })
    .from(analyticsEvents)
    .where(and(
      eq(analyticsEvents.eventType, 'search'),
      eq(analyticsEvents.userId, userId),
      isNotNull(sql`event_data->>'query'`)
    ))
    .orderBy(desc(analyticsEvents.timestamp))
    .limit(limit);

    return results.map(r => r.query).filter(Boolean);
  }

  // Cache invalidation methods
  static async invalidateSearchCache(pattern?: string): Promise<void> {
    if (pattern) {
      await searchCache.invalidatePattern(pattern);
    } else {
      await searchCache.clear();
    }
  }

  // Invalidate cache when pitch is updated
  static async invalidatePitchCache(pitchId: number): Promise<void> {
    // For now, we'll do a simple cache clear
    // In a more sophisticated system, we'd track which cache entries
    // contain this pitch and invalidate only those
    await searchCache.clear();
  }

  // Precompute popular searches for better performance
  static async precomputePopularSearches(): Promise<void> {
    await searchCache.precomputePopularSearches();
  }

  // Warm up cache with common searches
  static async warmUpCache(): Promise<void> {
    await searchCache.warmUpCache();
  }

  // Get cache statistics
  static getCacheStats() {
    return searchCache.getCacheStats();
  }
}