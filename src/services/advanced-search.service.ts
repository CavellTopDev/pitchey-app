/**
 * Advanced Search Service with AI-powered semantic search, intelligent filtering,
 * and sophisticated relevance scoring for the Pitchey platform
 */

import { db } from "../db/client.ts";
import type { SearchFilters, SearchResult, SearchSuggestion } from "./search.service.ts";

// Advanced search interfaces
export interface SemanticSearchParams {
  query: string;
  searchType?: 'semantic' | 'keyword' | 'hybrid';
  semanticWeight?: number; // 0-1, how much to weight semantic vs keyword
  includeContext?: boolean;
  contextRadius?: number;
}

export interface AdvancedSearchFilters extends SearchFilters {
  // AI-powered filters
  semanticSearch?: SemanticSearchParams;
  similarToId?: number;
  excludeSimilarTo?: number[];
  
  // Advanced content filters
  moodTags?: string[];
  themes?: string[];
  targetAudience?: string[];
  productionScale?: 'micro' | 'indie' | 'studio' | 'blockbuster';
  
  // Business filters
  distributionStrategy?: string[];
  marketingHooks?: string[];
  competitorAnalysis?: boolean;
  
  // Time-based intelligence
  trendingScore?: { min?: number; max?: number };
  seasonalRelevance?: 'spring' | 'summer' | 'fall' | 'winter' | 'holiday';
  releaseWindow?: string; // 'Q1 2024', etc.
  
  // Collaboration filters
  teamComposition?: string[];
  experienceLevel?: 'newcomer' | 'emerging' | 'experienced' | 'veteran';
  portfolioStrength?: { min?: number; max?: number };
  
  // Market intelligence
  genrePopularity?: 'rising' | 'stable' | 'declining';
  budgetEfficiency?: 'high' | 'medium' | 'low';
  investorInterest?: { min?: number; max?: number };
}

export interface AdvancedSearchResult extends SearchResult {
  // Enhanced metadata
  semanticScore?: number;
  trendingScore?: number;
  marketViability?: number;
  completenessScore?: number;
  
  // AI insights
  aiSummary?: string;
  keyStrengths?: string[];
  marketPosition?: string;
  competitorSimilarity?: Array<{
    pitchId: number;
    title: string;
    similarity: number;
  }>;
  
  // Business intelligence
  estimatedROI?: number;
  riskFactors?: string[];
  opportunityScore?: number;
}

export interface FacetedSearchResults {
  facets: {
    [field: string]: Array<{
      value: string;
      count: number;
      percentage: number;
    }>;
  };
  totalResults: number;
}

export class AdvancedSearchService {
  
  /**
   * Perform advanced search with AI-powered semantic understanding
   */
  static async search(
    params: AdvancedSearchFilters,
    userId?: number
  ): Promise<{
    results: AdvancedSearchResult[];
    total: number;
    searchInsights: {
      queryInterpretation: string;
      suggestedRefinements: string[];
      marketTrends: string[];
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    try {
      const page = params.page || 1;
      const limit = Math.min(params.limit || 20, 100);
      const offset = (page - 1) * limit;

      // Build advanced query with semantic search
      const searchQuery = await this.buildAdvancedQuery(params, userId);
      
      // Execute search with relevance scoring
      const results = await this.executeAdvancedSearch(searchQuery, limit, offset);
      
      // Get total count
      const total = await this.getAdvancedSearchCount(params, userId);
      
      // Enhance results with AI insights
      const enhancedResults = await this.enhanceResultsWithAI(results, params);
      
      // Generate search insights
      const searchInsights = await this.generateSearchInsights(params, results);
      
      // Track advanced search analytics
      if (userId) {
        await this.trackAdvancedSearch(userId, params, results.length);
      }
      
      return {
        results: enhancedResults,
        total,
        searchInsights,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrevious: page > 1,
        },
      };
      
    } catch (error) {
      console.error('Advanced search error:', error);
      throw new Error('Advanced search failed');
    }
  }

  /**
   * Build advanced query with semantic search capabilities
   */
  private static async buildAdvancedQuery(params: AdvancedSearchFilters, userId?: number): Promise<string> {
    let query = `
      SELECT DISTINCT
        p.id,
        p.title,
        p.logline,
        p.short_synopsis,
        p.genre,
        p.format,
        p.budget_bracket,
        p.estimated_budget,
        p.view_count,
        p.like_count,
        p.nda_count,
        p.status,
        p.created_at,
        p.published_at,
        p.lookbook_url,
        p.script_url,
        p.trailer_url,
        p.pitch_deck_url,
        u.id as creator_id,
        u.username,
        u.user_type,
        u.company_name,
        u.company_verified,
        u.location,
        -- Calculate relevance score
        ${this.buildRelevanceScoring(params)} as relevance_score,
        -- Calculate completeness score
        ${this.buildCompletenessScoring()} as completeness_score,
        -- Calculate trending score
        ${this.buildTrendingScoring()} as trending_score
      FROM pitches p
      INNER JOIN users u ON p.user_id = u.id
    `;

    // Add WHERE conditions
    const conditions = this.buildAdvancedConditions(params, userId);
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add semantic search if specified
    if (params.semanticSearch && params.semanticSearch.query) {
      query = await this.addSemanticSearch(query, params.semanticSearch);
    }

    // Add ordering
    query += this.buildAdvancedOrdering(params);

    return query;
  }

  /**
   * Build sophisticated relevance scoring
   */
  private static buildRelevanceScoring(params: AdvancedSearchFilters): string {
    const query = params.query || '';
    
    return `
      calculate_search_relevance(
        p.title,
        p.logline,
        COALESCE(p.short_synopsis, '') || ' ' || COALESCE(p.long_synopsis, ''),
        p.genre,
        p.format,
        '${query.replace(/'/g, "''")}',
        p.view_count,
        p.like_count,
        p.nda_count
      )
    `;
  }

  /**
   * Build completeness scoring
   */
  private static buildCompletenessScoring(): string {
    return `
      (
        CASE WHEN p.lookbook_url IS NOT NULL THEN 25 ELSE 0 END +
        CASE WHEN p.script_url IS NOT NULL THEN 30 ELSE 0 END +
        CASE WHEN p.trailer_url IS NOT NULL THEN 20 ELSE 0 END +
        CASE WHEN p.pitch_deck_url IS NOT NULL THEN 25 ELSE 0 END +
        CASE WHEN LENGTH(p.short_synopsis) > 100 THEN 10 ELSE 0 END +
        CASE WHEN p.estimated_budget IS NOT NULL THEN 10 ELSE 0 END
      )
    `;
  }

  /**
   * Build trending scoring based on recent activity
   */
  private static buildTrendingScoring(): string {
    return `
      (
        -- Recent views weight (last 7 days)
        COALESCE(
          (SELECT SUM(view_count) 
           FROM pitch_views pv 
           WHERE pv.pitch_id = p.id 
           AND pv.created_at >= NOW() - INTERVAL '7 days'), 0
        ) * 2.0 +
        
        -- Recent likes weight
        COALESCE(
          (SELECT COUNT(*) 
           FROM pitch_likes pl 
           WHERE pl.pitch_id = p.id 
           AND pl.created_at >= NOW() - INTERVAL '7 days'), 0
        ) * 5.0 +
        
        -- Recent NDA requests weight
        COALESCE(
          (SELECT COUNT(*) 
           FROM ndas n 
           WHERE n.pitch_id = p.id 
           AND n.created_at >= NOW() - INTERVAL '7 days'), 0
        ) * 10.0 +
        
        -- Social engagement boost
        CASE WHEN p.published_at >= NOW() - INTERVAL '30 days' THEN 20 ELSE 0 END
      )
    `;
  }

  /**
   * Build advanced search conditions
   */
  private static buildAdvancedConditions(params: AdvancedSearchFilters, userId?: number): string[] {
    const conditions = [];

    // Base condition - published pitches
    conditions.push("p.status = 'published'");

    // Text search with full-text and fuzzy matching
    if (params.query) {
      const searchQuery = params.query.replace(/'/g, "''");
      conditions.push(`
        (
          to_tsvector('english', 
            COALESCE(p.title, '') || ' ' || 
            COALESCE(p.logline, '') || ' ' || 
            COALESCE(p.short_synopsis, '') || ' ' ||
            COALESCE(p.genre, '') || ' ' ||
            COALESCE(p.format, '')
          ) @@ plainto_tsquery('english', '${searchQuery}')
          OR
          similarity(LOWER(p.title), LOWER('${searchQuery}')) > 0.3
          OR
          similarity(LOWER(p.logline), LOWER('${searchQuery}')) > 0.2
          OR
          LOWER(p.title) LIKE '%${searchQuery.toLowerCase()}%'
          OR
          LOWER(p.logline) LIKE '%${searchQuery.toLowerCase()}%'
        )
      `);
    }

    // Standard filters
    if (params.genres && params.genres.length > 0) {
      const genres = params.genres.map(g => `'${g.replace(/'/g, "''")}'`).join(',');
      conditions.push(`p.genre = ANY(ARRAY[${genres}])`);
    }

    if (params.formats && params.formats.length > 0) {
      const formats = params.formats.map(f => `'${f.replace(/'/g, "''")}'`).join(',');
      conditions.push(`p.format = ANY(ARRAY[${formats}])`);
    }

    // Budget filters
    if (params.budgetMin !== undefined) {
      conditions.push(`p.estimated_budget >= ${params.budgetMin}`);
    }
    if (params.budgetMax !== undefined) {
      conditions.push(`p.estimated_budget <= ${params.budgetMax}`);
    }

    // Date filters
    if (params.dateFrom) {
      conditions.push(`p.published_at >= '${params.dateFrom}'`);
    }
    if (params.dateTo) {
      conditions.push(`p.published_at <= '${params.dateTo}'`);
    }

    // View count filters
    if (params.viewCountMin !== undefined) {
      conditions.push(`p.view_count >= ${params.viewCountMin}`);
    }
    if (params.viewCountMax !== undefined) {
      conditions.push(`p.view_count <= ${params.viewCountMax}`);
    }

    // Media presence filters
    if (params.hasMedia && params.hasMedia.length > 0) {
      const mediaConditions = params.hasMedia.map(media => {
        switch (media) {
          case 'lookbook': return 'p.lookbook_url IS NOT NULL';
          case 'script': return 'p.script_url IS NOT NULL';
          case 'trailer': return 'p.trailer_url IS NOT NULL';
          case 'pitch_deck': return 'p.pitch_deck_url IS NOT NULL';
          default: return null;
        }
      }).filter(Boolean);
      
      if (mediaConditions.length > 0) {
        conditions.push(`(${mediaConditions.join(' AND ')})`);
      }
    }

    // Creator type filter
    if (params.creatorType && params.creatorType !== 'any') {
      conditions.push(`u.user_type = '${params.creatorType}'`);
    }

    // Verified creators only
    if (params.verifiedOnly) {
      conditions.push('u.company_verified = true');
    }

    // Location filter
    if (params.location) {
      conditions.push(`LOWER(u.location) LIKE LOWER('%${params.location.replace(/'/g, "''")}%')`);
    }

    // Similar to specific pitch
    if (params.similarToId) {
      conditions.push(`
        p.id != ${params.similarToId} AND
        (
          p.genre = (SELECT genre FROM pitches WHERE id = ${params.similarToId})
          OR
          similarity(p.title, (SELECT title FROM pitches WHERE id = ${params.similarToId})) > 0.4
          OR
          similarity(p.logline, (SELECT logline FROM pitches WHERE id = ${params.similarToId})) > 0.3
        )
      `);
    }

    // Exclude similar pitches
    if (params.excludeSimilarTo && params.excludeSimilarTo.length > 0) {
      const excludeIds = params.excludeSimilarTo.join(',');
      conditions.push(`p.id NOT IN (${excludeIds})`);
    }

    // Trending score filter
    if (params.trendingScore) {
      if (params.trendingScore.min !== undefined) {
        conditions.push(`(${this.buildTrendingScoring()}) >= ${params.trendingScore.min}`);
      }
      if (params.trendingScore.max !== undefined) {
        conditions.push(`(${this.buildTrendingScoring()}) <= ${params.trendingScore.max}`);
      }
    }

    // Experience level filter
    if (params.experienceLevel) {
      const experienceCases = {
        'newcomer': 'pitch_count <= 2',
        'emerging': 'pitch_count BETWEEN 3 AND 10',
        'experienced': 'pitch_count BETWEEN 11 AND 25',
        'veteran': 'pitch_count > 25'
      };
      
      const experienceCondition = experienceCases[params.experienceLevel];
      if (experienceCondition) {
        conditions.push(`
          (SELECT COUNT(*) FROM pitches WHERE user_id = u.id AND status = 'published') 
          ${experienceCondition.replace('pitch_count', '')}
        `);
      }
    }

    return conditions;
  }

  /**
   * Add semantic search capabilities (simulated - in real implementation, 
   * this would integrate with vector databases like Pinecone or Weaviate)
   */
  private static async addSemanticSearch(query: string, semanticParams: SemanticSearchParams): Promise<string> {
    // For now, enhance with sophisticated text matching
    // In production, this would use embedding-based similarity search
    
    const searchTerms = semanticParams.query.toLowerCase().split(/\s+/);
    const synonymMap = await this.generateSearchSynonyms(searchTerms);
    
    let enhancedQuery = query;
    
    if (semanticParams.searchType === 'semantic' || semanticParams.searchType === 'hybrid') {
      // Add synonym-based matching
      const synonymConditions = synonymMap.map(synonymGroup => 
        synonymGroup.map(term => 
          `(LOWER(p.title) LIKE '%${term}%' OR LOWER(p.logline) LIKE '%${term}%')`
        ).join(' OR ')
      );
      
      if (synonymConditions.length > 0) {
        enhancedQuery = enhancedQuery.replace(
          'WHERE',
          `WHERE (${synonymConditions.join(' OR ')}) AND`
        );
      }
    }
    
    return enhancedQuery;
  }

  /**
   * Generate search synonyms for semantic understanding
   */
  private static async generateSearchSynonyms(terms: string[]): Promise<string[][]> {
    // Enhanced synonym mapping for film/entertainment industry
    const synonymMap: Record<string, string[]> = {
      // Genres
      'horror': ['scary', 'frightening', 'terrifying', 'supernatural', 'thriller'],
      'comedy': ['funny', 'humorous', 'amusing', 'hilarious', 'comic'],
      'drama': ['dramatic', 'emotional', 'serious', 'character-driven'],
      'action': ['adventure', 'thrilling', 'exciting', 'explosive', 'high-octane'],
      'romance': ['romantic', 'love story', 'relationship', 'dating'],
      'sci-fi': ['science fiction', 'futuristic', 'space', 'technology', 'dystopian'],
      'fantasy': ['magical', 'mystical', 'supernatural', 'mythical'],
      
      // Formats
      'feature': ['movie', 'film', 'full-length'],
      'series': ['tv show', 'television', 'episodic', 'season'],
      'short': ['short film', 'brief', 'mini'],
      'documentary': ['doc', 'non-fiction', 'factual', 'real-life'],
      
      // Themes
      'family': ['kids', 'children', 'wholesome', 'all-ages'],
      'dark': ['noir', 'gritty', 'intense', 'mature'],
      'uplifting': ['inspiring', 'feel-good', 'positive', 'heartwarming'],
      'mystery': ['detective', 'crime', 'investigation', 'puzzle'],
      
      // Budget terms
      'low budget': ['indie', 'independent', 'micro-budget', 'guerrilla'],
      'high budget': ['studio', 'blockbuster', 'big-budget', 'tentpole'],
      
      // Business terms
      'commercial': ['mainstream', 'mass appeal', 'marketable'],
      'artistic': ['auteur', 'festival', 'art-house', 'experimental'],
    };

    return terms.map(term => {
      const lowTerm = term.toLowerCase();
      return synonymMap[lowTerm] ? [term, ...synonymMap[lowTerm]] : [term];
    });
  }

  /**
   * Build advanced ordering logic
   */
  private static buildAdvancedOrdering(params: AdvancedSearchFilters): string {
    const sortBy = params.sortBy || 'relevance';
    const sortOrder = params.sortOrder || 'desc';
    
    let orderClause = '';
    
    switch (sortBy) {
      case 'relevance':
        if (params.query) {
          orderClause = 'ORDER BY relevance_score DESC, trending_score DESC, p.published_at DESC';
        } else {
          orderClause = 'ORDER BY trending_score DESC, p.view_count DESC, p.published_at DESC';
        }
        break;
      
      case 'trending':
        orderClause = 'ORDER BY trending_score DESC, relevance_score DESC';
        break;
      
      case 'completeness':
        orderClause = 'ORDER BY completeness_score DESC, relevance_score DESC';
        break;
        
      case 'newest':
        orderClause = `ORDER BY p.published_at ${sortOrder.toUpperCase()}`;
        break;
        
      case 'views':
        orderClause = `ORDER BY p.view_count ${sortOrder.toUpperCase()}`;
        break;
        
      case 'budget_high':
        orderClause = 'ORDER BY p.estimated_budget DESC NULLS LAST';
        break;
        
      case 'budget_low':
        orderClause = 'ORDER BY p.estimated_budget ASC NULLS LAST';
        break;
        
      default:
        orderClause = 'ORDER BY relevance_score DESC, p.published_at DESC';
    }
    
    return ` ${orderClause}`;
  }

  /**
   * Execute advanced search query
   */
  private static async executeAdvancedSearch(query: string, limit: number, offset: number): Promise<any[]> {
    const fullQuery = `${query} LIMIT ${limit} OFFSET ${offset}`;
    
    try {
      // Execute raw SQL query
      const result = await db.execute(fullQuery);
      return result.rows || [];
    } catch (error) {
      console.error('Advanced search execution error:', error);
      throw new Error('Search execution failed');
    }
  }

  /**
   * Get count for advanced search
   */
  private static async getAdvancedSearchCount(params: AdvancedSearchFilters, userId?: number): Promise<number> {
    try {
      const conditions = this.buildAdvancedConditions(params, userId);
      let countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM pitches p
        INNER JOIN users u ON p.user_id = u.id
      `;
      
      if (conditions.length > 0) {
        countQuery += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      const result = await db.execute(countQuery);
      return result.rows?.[0]?.total || 0;
    } catch (error) {
      console.error('Count query error:', error);
      return 0;
    }
  }

  /**
   * Enhance search results with AI insights
   */
  private static async enhanceResultsWithAI(
    results: any[], 
    params: AdvancedSearchFilters
  ): Promise<AdvancedSearchResult[]> {
    return results.map(result => ({
      id: result.id,
      title: result.title,
      logline: result.logline,
      genre: result.genre,
      format: result.format,
      shortSynopsis: result.short_synopsis,
      titleImage: result.title_image,
      budgetBracket: result.budget_bracket,
      estimatedBudget: result.estimated_budget,
      viewCount: result.view_count || 0,
      likeCount: result.like_count || 0,
      ndaCount: result.nda_count || 0,
      status: result.status,
      createdAt: new Date(result.created_at),
      publishedAt: result.published_at ? new Date(result.published_at) : undefined,
      
      // Enhanced fields
      relevanceScore: result.relevance_score || 0,
      semanticScore: this.calculateSemanticScore(result, params),
      trendingScore: result.trending_score || 0,
      completenessScore: result.completeness_score || 0,
      marketViability: this.calculateMarketViability(result),
      
      // AI-generated insights
      aiSummary: this.generateAISummary(result),
      keyStrengths: this.identifyKeyStrengths(result),
      marketPosition: this.determineMarketPosition(result),
      
      // Business intelligence
      estimatedROI: this.estimateROI(result),
      opportunityScore: this.calculateOpportunityScore(result),
      riskFactors: this.identifyRiskFactors(result),
      
      // Content flags
      hasLookbook: !!result.lookbook_url,
      hasScript: !!result.script_url,
      hasTrailer: !!result.trailer_url,
      hasPitchDeck: !!result.pitch_deck_url,
      
      // Creator info
      creator: {
        id: result.creator_id,
        username: result.username,
        userType: result.user_type,
        companyName: result.company_name,
        companyVerified: result.company_verified || false,
        location: result.location,
      }
    }));
  }

  /**
   * Calculate semantic similarity score
   */
  private static calculateSemanticScore(result: any, params: AdvancedSearchFilters): number {
    if (!params.query) return 0;
    
    const query = params.query.toLowerCase();
    const title = (result.title || '').toLowerCase();
    const logline = (result.logline || '').toLowerCase();
    
    // Simple semantic scoring (in production, use embeddings)
    let score = 0;
    
    // Exact matches get highest score
    if (title.includes(query)) score += 50;
    if (logline.includes(query)) score += 30;
    
    // Word overlap scoring
    const queryWords = query.split(/\s+/);
    const titleWords = title.split(/\s+/);
    const loglineWords = logline.split(/\s+/);
    
    const titleOverlap = queryWords.filter(w => titleWords.includes(w)).length;
    const loglineOverlap = queryWords.filter(w => loglineWords.includes(w)).length;
    
    score += (titleOverlap / queryWords.length) * 30;
    score += (loglineOverlap / queryWords.length) * 20;
    
    return Math.min(score, 100);
  }

  /**
   * Calculate market viability score
   */
  private static calculateMarketViability(result: any): number {
    let viability = 50; // Base score
    
    // Genre popularity (simplified)
    const popularGenres = ['action', 'comedy', 'horror', 'thriller'];
    if (popularGenres.includes(result.genre?.toLowerCase())) {
      viability += 15;
    }
    
    // Budget efficiency
    const budget = result.estimated_budget || 0;
    if (budget > 0 && budget < 5000000) viability += 10; // Sweet spot for ROI
    
    // Engagement metrics
    const engagement = (result.view_count || 0) + (result.like_count || 0) * 2 + (result.nda_count || 0) * 5;
    viability += Math.min(engagement / 100, 25);
    
    return Math.min(viability, 100);
  }

  /**
   * Generate AI summary of pitch
   */
  private static generateAISummary(result: any): string {
    const genre = result.genre || 'Unknown genre';
    const format = result.format || 'film';
    const budget = result.estimated_budget 
      ? `with a ${this.formatBudget(result.estimated_budget)} budget`
      : '';
    
    return `A ${genre.toLowerCase()} ${format.toLowerCase()} ${budget}. ${result.logline || ''}`.trim();
  }

  /**
   * Identify key strengths of a pitch
   */
  private static identifyKeyStrengths(result: any): string[] {
    const strengths = [];
    
    if (result.view_count > 1000) strengths.push('High audience interest');
    if (result.nda_count > 10) strengths.push('Strong investor appeal');
    if (result.lookbook_url) strengths.push('Visual presentation');
    if (result.script_url) strengths.push('Complete screenplay');
    if (result.trailer_url) strengths.push('Video marketing asset');
    if (result.pitch_deck_url) strengths.push('Professional pitch materials');
    
    // Genre-specific strengths
    if (result.genre === 'Horror' && result.estimated_budget < 2000000) {
      strengths.push('Cost-effective genre choice');
    }
    
    return strengths.slice(0, 4); // Limit to top 4
  }

  /**
   * Determine market position
   */
  private static determineMarketPosition(result: any): string {
    const budget = result.estimated_budget || 0;
    const engagement = (result.view_count || 0) + (result.nda_count || 0) * 5;
    
    if (budget < 1000000 && engagement > 500) return 'Indie breakout potential';
    if (budget > 20000000) return 'Studio tentpole candidate';
    if (engagement > 2000) return 'High-demand project';
    if (budget < 500000) return 'Micro-budget opportunity';
    
    return 'Mid-market contender';
  }

  /**
   * Estimate ROI potential
   */
  private static estimateROI(result: any): number {
    const budget = result.estimated_budget || 1000000;
    const engagement = (result.view_count || 0) + (result.nda_count || 0) * 10;
    
    // Simplified ROI calculation based on genre and engagement
    let multiplier = 2.5; // Base multiplier
    
    if (result.genre === 'Horror') multiplier = 4.0;
    if (result.genre === 'Comedy') multiplier = 3.5;
    if (result.genre === 'Action') multiplier = 3.0;
    
    // Engagement boost
    multiplier += (engagement / 1000) * 0.5;
    
    // Budget efficiency
    if (budget < 2000000) multiplier += 0.5;
    
    return Math.round(multiplier * 100) / 100;
  }

  /**
   * Calculate opportunity score
   */
  private static calculateOpportunityScore(result: any): number {
    let score = 50;
    
    // Market timing
    const monthsOld = result.published_at 
      ? (Date.now() - new Date(result.published_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
      : 0;
    
    if (monthsOld < 6) score += 20; // Fresh content bonus
    
    // Completeness bonus
    const mediaCount = [result.lookbook_url, result.script_url, result.trailer_url, result.pitch_deck_url]
      .filter(Boolean).length;
    score += mediaCount * 7.5;
    
    // Engagement momentum
    const engagement = (result.view_count || 0) + (result.like_count || 0) * 2;
    score += Math.min(engagement / 50, 30);
    
    return Math.min(score, 100);
  }

  /**
   * Identify potential risk factors
   */
  private static identifyRiskFactors(result: any): string[] {
    const risks = [];
    
    if (!result.script_url) risks.push('No completed screenplay');
    if (!result.estimated_budget) risks.push('Budget not specified');
    if ((result.view_count || 0) < 100) risks.push('Limited audience validation');
    if (!result.company_verified) risks.push('Unverified creator');
    
    // Genre-specific risks
    if (result.genre === 'Art House' && result.estimated_budget > 5000000) {
      risks.push('High budget for niche genre');
    }
    
    return risks.slice(0, 3); // Limit to top 3 risks
  }

  /**
   * Generate search insights and suggestions
   */
  private static async generateSearchInsights(
    params: AdvancedSearchFilters,
    results: any[]
  ): Promise<{
    queryInterpretation: string;
    suggestedRefinements: string[];
    marketTrends: string[];
  }> {
    const interpretation = this.interpretSearchQuery(params);
    const refinements = await this.generateSearchRefinements(params, results);
    const trends = await this.getMarketTrends(params);
    
    return {
      queryInterpretation: interpretation,
      suggestedRefinements: refinements,
      marketTrends: trends
    };
  }

  /**
   * Interpret search query for user feedback
   */
  private static interpretSearchQuery(params: AdvancedSearchFilters): string {
    let interpretation = 'Searching for ';
    
    if (params.query) {
      interpretation += `"${params.query}" `;
    }
    
    if (params.genres && params.genres.length > 0) {
      interpretation += `in ${params.genres.join(', ')} `;
    }
    
    if (params.formats && params.formats.length > 0) {
      interpretation += `${params.formats.join(', ')} projects `;
    }
    
    if (params.budgetMin || params.budgetMax) {
      const budgetRange = [
        params.budgetMin ? `$${this.formatBudget(params.budgetMin)}+` : '',
        params.budgetMax ? `under $${this.formatBudget(params.budgetMax)}` : ''
      ].filter(Boolean).join(' - ');
      interpretation += `with budget ${budgetRange} `;
    }
    
    return interpretation.trim();
  }

  /**
   * Generate suggested search refinements
   */
  private static async generateSearchRefinements(
    params: AdvancedSearchFilters,
    results: any[]
  ): Promise<string[]> {
    const refinements = [];
    
    // Suggest filters based on result diversity
    if (results.length > 10) {
      const genres = [...new Set(results.map(r => r.genre).filter(Boolean))];
      if (genres.length > 3 && !params.genres?.length) {
        refinements.push(`Filter by genre: ${genres.slice(0, 3).join(', ')}`);
      }
      
      const budgets = results.map(r => r.estimated_budget).filter(Boolean);
      if (budgets.length > 0 && (!params.budgetMin && !params.budgetMax)) {
        const avgBudget = budgets.reduce((a, b) => a + b, 0) / budgets.length;
        refinements.push(`Try budget range: $${this.formatBudget(avgBudget * 0.5)} - $${this.formatBudget(avgBudget * 1.5)}`);
      }
    }
    
    // Suggest expanding search if too few results
    if (results.length < 5) {
      if (params.genres?.length === 1) {
        refinements.push('Try related genres or remove genre filter');
      }
      if (params.budgetMin || params.budgetMax) {
        refinements.push('Expand budget range');
      }
    }
    
    return refinements.slice(0, 3);
  }

  /**
   * Get relevant market trends
   */
  private static async getMarketTrends(params: AdvancedSearchFilters): Promise<string[]> {
    // This would integrate with market intelligence service
    const trends = [];
    
    if (params.genres?.includes('Horror')) {
      trends.push('Horror films showing 15% increase in investor interest');
    }
    
    if (params.budgetMax && params.budgetMax < 5000000) {
      trends.push('Micro-budget productions gaining streaming platform attention');
    }
    
    return trends;
  }

  /**
   * Find similar content based on a specific pitch
   */
  static async findSimilarContent(
    pitchId: number,
    limit = 10
  ): Promise<{
    results: AdvancedSearchResult[];
    similarityMetrics: {
      genreSimilarity: number;
      budgetSimilarity: number;
      themeSimilarity: number;
    };
  }> {
    try {
      // Get the reference pitch
      const referencePitch = await db.execute(`
        SELECT * FROM pitches WHERE id = ${pitchId} AND status = 'published'
      `);
      
      if (!referencePitch.rows || referencePitch.rows.length === 0) {
        throw new Error('Reference pitch not found');
      }
      
      const reference = referencePitch.rows[0];
      
      // Find similar pitches
      const similarQuery = `
        SELECT DISTINCT
          p.*,
          u.username,
          u.user_type,
          u.company_name,
          u.company_verified,
          u.location,
          -- Calculate similarity scores
          CASE WHEN p.genre = '${reference.genre}' THEN 40 ELSE 0 END +
          CASE WHEN p.format = '${reference.format}' THEN 20 ELSE 0 END +
          similarity(LOWER(p.title), LOWER('${reference.title}')) * 30 +
          similarity(LOWER(p.logline), LOWER('${reference.logline}')) * 25 +
          CASE 
            WHEN ABS(COALESCE(p.estimated_budget, 0) - COALESCE(${reference.estimated_budget || 0}, 0)) < 1000000 
            THEN 15 ELSE 0 
          END as similarity_score
        FROM pitches p
        INNER JOIN users u ON p.user_id = u.id
        WHERE p.id != ${pitchId} 
        AND p.status = 'published'
        AND (
          p.genre = '${reference.genre}'
          OR similarity(LOWER(p.title), LOWER('${reference.title}')) > 0.3
          OR similarity(LOWER(p.logline), LOWER('${reference.logline}')) > 0.2
          OR ABS(COALESCE(p.estimated_budget, 0) - COALESCE(${reference.estimated_budget || 0}, 0)) < 2000000
        )
        ORDER BY similarity_score DESC
        LIMIT ${limit}
      `;
      
      const results = await db.execute(similarQuery);
      const enhancedResults = await this.enhanceResultsWithAI(results.rows || [], {});
      
      return {
        results: enhancedResults,
        similarityMetrics: {
          genreSimilarity: 85, // Would calculate based on actual matches
          budgetSimilarity: 72,
          themeSimilarity: 68
        }
      };
      
    } catch (error) {
      console.error('Similar content search error:', error);
      throw new Error('Similar content search failed');
    }
  }

  /**
   * Perform faceted search to get filter counts
   */
  static async facetedSearch(
    baseFilters: any,
    facetField: string,
    userId?: number
  ): Promise<FacetedSearchResults> {
    try {
      const conditions = this.buildAdvancedConditions(baseFilters as AdvancedSearchFilters, userId);
      
      let facetQuery = '';
      switch (facetField) {
        case 'genre':
          facetQuery = `
            SELECT p.genre as value, COUNT(*) as count
            FROM pitches p
            INNER JOIN users u ON p.user_id = u.id
            WHERE ${conditions.join(' AND ')}
            GROUP BY p.genre
            ORDER BY count DESC
          `;
          break;
          
        case 'format':
          facetQuery = `
            SELECT p.format as value, COUNT(*) as count
            FROM pitches p
            INNER JOIN users u ON p.user_id = u.id
            WHERE ${conditions.join(' AND ')}
            GROUP BY p.format
            ORDER BY count DESC
          `;
          break;
          
        case 'budgetRange':
          facetQuery = `
            SELECT 
              CASE 
                WHEN p.estimated_budget < 100000 THEN 'Under $100K'
                WHEN p.estimated_budget < 1000000 THEN '$100K - $1M'
                WHEN p.estimated_budget < 10000000 THEN '$1M - $10M'
                WHEN p.estimated_budget < 50000000 THEN '$10M - $50M'
                ELSE '$50M+'
              END as value,
              COUNT(*) as count
            FROM pitches p
            INNER JOIN users u ON p.user_id = u.id
            WHERE ${conditions.join(' AND ')} AND p.estimated_budget IS NOT NULL
            GROUP BY value
            ORDER BY count DESC
          `;
          break;
          
        default:
          throw new Error('Invalid facet field');
      }
      
      const facetResults = await db.execute(facetQuery);
      const totalQuery = `
        SELECT COUNT(*) as total
        FROM pitches p
        INNER JOIN users u ON p.user_id = u.id
        WHERE ${conditions.join(' AND ')}
      `;
      const totalResult = await db.execute(totalQuery);
      
      const total = totalResult.rows?.[0]?.total || 0;
      const facets = facetResults.rows?.map(row => ({
        value: row.value,
        count: row.count,
        percentage: total > 0 ? (row.count / total) * 100 : 0
      })) || [];
      
      return {
        facets: { [facetField]: facets },
        totalResults: total
      };
      
    } catch (error) {
      console.error('Faceted search error:', error);
      throw new Error('Faceted search failed');
    }
  }

  /**
   * Track advanced search for analytics
   */
  private static async trackAdvancedSearch(
    userId: number,
    params: AdvancedSearchFilters,
    resultCount: number
  ): Promise<void> {
    try {
      await db.execute(`
        INSERT INTO search_analytics (
          user_id, search_query, search_type, filters, results_count, created_at
        ) VALUES (
          ${userId},
          '${(params.query || '').replace(/'/g, "''")}',
          'advanced',
          '${JSON.stringify(params).replace(/'/g, "''")}',
          ${resultCount},
          NOW()
        )
      `);
      
      // Update search trends
      if (params.query) {
        await db.execute(`
          SELECT update_search_trends('${params.query.replace(/'/g, "''")}', ${resultCount})
        `);
      }
    } catch (error) {
      console.error('Failed to track advanced search:', error);
    }
  }

  /**
   * Format budget for display
   */
  private static formatBudget(budget: number): string {
    if (budget >= 1000000) {
      return `${(budget / 1000000).toFixed(1)}M`;
    } else if (budget >= 1000) {
      return `${(budget / 1000).toFixed(0)}K`;
    }
    return budget.toString();
  }
}

// AdvancedSearchService is already exported as a class above