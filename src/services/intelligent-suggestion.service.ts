/**
 * Intelligent Suggestion Service
 * AI-powered search suggestions with natural language understanding and contextual recommendations
 */

import { db } from "../db/client.ts";

export interface IntelligentSuggestion {
  query: string;
  type: 'title' | 'genre' | 'creator' | 'theme' | 'autocomplete' | 'natural_language';
  confidence: number;
  context?: string;
  relatedTerms?: string[];
  popularity?: number;
  clickThroughRate?: number;
  metadata?: {
    resultCount?: number;
    avgBudget?: number;
    popularGenres?: string[];
    timeframe?: string;
  };
}

export interface QuickFilter {
  id: string;
  label: string;
  value: any;
  count: number;
  trending: boolean;
  priority: number;
  icon?: string;
  color?: string;
}

export interface SearchContext {
  userId?: number;
  recentSearches?: string[];
  viewedPitches?: number[];
  preferredGenres?: string[];
  budgetRange?: { min: number; max: number };
  userType?: 'creator' | 'investor' | 'production';
}

export class IntelligentSuggestionService {

  /**
   * Generate intelligent search suggestions based on query and context
   */
  static async generateSuggestions(
    query: string, 
    context?: SearchContext,
    options: {
      limit?: number;
      includeNaturalLanguage?: boolean;
      includeContextual?: boolean;
    } = {}
  ): Promise<IntelligentSuggestion[]> {
    
    const { limit = 10, includeNaturalLanguage = true, includeContextual = true } = options;
    const suggestions: IntelligentSuggestion[] = [];
    
    try {
      // 1. Exact and partial matches from existing content
      const exactMatches = await this.getExactMatches(query, limit);
      suggestions.push(...exactMatches);
      
      // 2. Fuzzy matches with typo tolerance
      const fuzzyMatches = await this.getFuzzyMatches(query, limit);
      suggestions.push(...fuzzyMatches);
      
      // 3. Natural language suggestions
      if (includeNaturalLanguage) {
        const nlSuggestions = await this.getNaturalLanguageSuggestions(query, context);
        suggestions.push(...nlSuggestions);
      }
      
      // 4. Contextual recommendations based on user behavior
      if (includeContextual && context) {
        const contextualSuggestions = await this.getContextualSuggestions(query, context);
        suggestions.push(...contextualSuggestions);
      }
      
      // 5. Trending and popular suggestions
      const trendingSuggestions = await this.getTrendingSuggestions(query);
      suggestions.push(...trendingSuggestions);
      
      // 6. Semantic similarity suggestions
      const semanticSuggestions = await this.getSemanticSuggestions(query);
      suggestions.push(...semanticSuggestions);
      
      // Sort by confidence and relevance
      const rankedSuggestions = this.rankSuggestions(suggestions, query, context);
      
      // Remove duplicates and limit results
      const uniqueSuggestions = this.removeDuplicates(rankedSuggestions);
      
      return uniqueSuggestions.slice(0, limit);
      
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return [];
    }
  }

  /**
   * Get exact matches from database content
   */
  private static async getExactMatches(query: string, limit: number): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    const searchTerm = query.toLowerCase().trim();
    
    try {
      // Title matches
      const titleMatches = await db.execute(`
        SELECT DISTINCT title, COUNT(*) as result_count
        FROM pitches 
        WHERE status = 'published' 
        AND LOWER(title) LIKE '%${searchTerm}%'
        GROUP BY title
        ORDER BY result_count DESC, LENGTH(title) ASC
        LIMIT ${Math.ceil(limit * 0.3)}
      `);

      for (const match of titleMatches.rows || []) {
        suggestions.push({
          query: match.title,
          type: 'title',
          confidence: this.calculateTitleConfidence(match.title, query),
          metadata: { resultCount: match.result_count }
        });
      }

      // Genre matches
      const genreMatches = await db.execute(`
        SELECT DISTINCT genre, COUNT(*) as result_count
        FROM pitches 
        WHERE status = 'published' 
        AND LOWER(genre) LIKE '%${searchTerm}%'
        GROUP BY genre
        ORDER BY result_count DESC
        LIMIT ${Math.ceil(limit * 0.2)}
      `);

      for (const match of genreMatches.rows || []) {
        suggestions.push({
          query: match.genre,
          type: 'genre',
          confidence: this.calculateGenreConfidence(match.genre, query),
          metadata: { resultCount: match.result_count }
        });
      }

      // Creator matches
      const creatorMatches = await db.execute(`
        SELECT DISTINCT u.username, u.company_name, COUNT(p.id) as pitch_count
        FROM users u
        INNER JOIN pitches p ON u.id = p.user_id
        WHERE p.status = 'published' 
        AND (LOWER(u.username) LIKE '%${searchTerm}%' OR LOWER(u.company_name) LIKE '%${searchTerm}%')
        GROUP BY u.username, u.company_name
        ORDER BY pitch_count DESC
        LIMIT ${Math.ceil(limit * 0.2)}
      `);

      for (const match of creatorMatches.rows || []) {
        const displayName = match.company_name || match.username;
        suggestions.push({
          query: displayName,
          type: 'creator',
          confidence: this.calculateCreatorConfidence(displayName, query),
          metadata: { resultCount: match.pitch_count }
        });
      }

    } catch (error) {
      console.error('Error getting exact matches:', error);
    }

    return suggestions;
  }

  /**
   * Get fuzzy matches with typo tolerance
   */
  private static async getFuzzyMatches(query: string, limit: number): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    try {
      // Use PostgreSQL's similarity function for fuzzy matching
      const fuzzyMatches = await db.execute(`
        SELECT DISTINCT title, similarity(LOWER(title), LOWER('${query}')) as similarity_score
        FROM pitches 
        WHERE status = 'published' 
        AND similarity(LOWER(title), LOWER('${query}')) > 0.3
        ORDER BY similarity_score DESC
        LIMIT ${Math.ceil(limit * 0.3)}
      `);

      for (const match of fuzzyMatches.rows || []) {
        suggestions.push({
          query: match.title,
          type: 'title',
          confidence: match.similarity_score * 100,
          context: 'fuzzy_match'
        });
      }

    } catch (error) {
      console.error('Error getting fuzzy matches:', error);
    }

    return suggestions;
  }

  /**
   * Generate natural language suggestions
   */
  private static async getNaturalLanguageSuggestions(
    query: string, 
    context?: SearchContext
  ): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    try {
      // Analyze query for natural language patterns
      const nlPatterns = this.analyzeNaturalLanguage(query);
      
      for (const pattern of nlPatterns) {
        suggestions.push({
          query: pattern.suggestion,
          type: 'natural_language',
          confidence: pattern.confidence,
          context: pattern.reasoning,
          relatedTerms: pattern.keywords
        });
      }
      
    } catch (error) {
      console.error('Error generating NL suggestions:', error);
    }

    return suggestions;
  }

  /**
   * Get contextual suggestions based on user behavior
   */
  private static async getContextualSuggestions(
    query: string,
    context: SearchContext
  ): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    try {
      if (context.userId) {
        // Get user's search history patterns
        const searchHistory = await this.getUserSearchHistory(context.userId);
        
        // Suggest related searches
        for (const historicalQuery of searchHistory) {
          if (this.areQueriesRelated(query, historicalQuery)) {
            suggestions.push({
              query: historicalQuery,
              type: 'autocomplete',
              confidence: 70,
              context: 'based_on_your_searches'
            });
          }
        }

        // Suggest based on viewed pitches
        if (context.viewedPitches && context.viewedPitches.length > 0) {
          const relatedSuggestions = await this.getSuggestionsFromViewedPitches(
            context.viewedPitches, 
            query
          );
          suggestions.push(...relatedSuggestions);
        }
      }

      // Suggest based on user type preferences
      if (context.userType) {
        const typeSuggestions = await this.getUserTypeSuggestions(query, context.userType);
        suggestions.push(...typeSuggestions);
      }

    } catch (error) {
      console.error('Error getting contextual suggestions:', error);
    }

    return suggestions;
  }

  /**
   * Get trending suggestions
   */
  private static async getTrendingSuggestions(query: string): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    try {
      // Get trending searches from analytics
      const trendingQueries = await db.execute(`
        SELECT 
          search_term,
          SUM(search_count) as total_searches,
          AVG(avg_results) as avg_results
        FROM search_trends 
        WHERE time_bucket >= NOW() - INTERVAL '7 days'
        AND search_term ILIKE '%${query}%'
        GROUP BY search_term
        ORDER BY total_searches DESC
        LIMIT 5
      `);

      for (const trending of trendingQueries.rows || []) {
        suggestions.push({
          query: trending.search_term,
          type: 'autocomplete',
          confidence: 80,
          context: 'trending',
          popularity: trending.total_searches,
          metadata: { resultCount: Math.round(trending.avg_results) }
        });
      }

    } catch (error) {
      console.error('Error getting trending suggestions:', error);
    }

    return suggestions;
  }

  /**
   * Get semantic similarity suggestions
   */
  private static async getSemanticSuggestions(query: string): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    try {
      // Enhanced semantic mapping for film/entertainment industry
      const semanticMap = this.getSemanticMapping();
      const queryWords = query.toLowerCase().split(/\s+/);
      
      for (const word of queryWords) {
        if (semanticMap[word]) {
          for (const relatedTerm of semanticMap[word]) {
            suggestions.push({
              query: relatedTerm,
              type: 'theme',
              confidence: 60,
              context: 'semantic_similarity',
              relatedTerms: [word]
            });
          }
        }
      }

    } catch (error) {
      console.error('Error getting semantic suggestions:', error);
    }

    return suggestions;
  }

  /**
   * Generate quick filters based on current search context
   */
  static async generateQuickFilters(
    query?: string,
    context?: SearchContext
  ): Promise<QuickFilter[]> {
    const filters: QuickFilter[] = [];
    
    try {
      // Genre-based quick filters
      const popularGenres = await this.getPopularGenres();
      for (const genre of popularGenres) {
        filters.push({
          id: `genre_${genre.genre.toLowerCase()}`,
          label: genre.genre,
          value: { genres: [genre.genre] },
          count: genre.count,
          trending: genre.growth_rate > 20,
          priority: this.calculateGenrePriority(genre.genre, context),
          icon: this.getGenreIcon(genre.genre),
          color: this.getGenreColor(genre.genre)
        });
      }

      // Budget-based quick filters
      const budgetFilters = [
        { range: { max: 1000000 }, label: 'Under $1M', priority: 8 },
        { range: { min: 1000000, max: 10000000 }, label: '$1M - $10M', priority: 7 },
        { range: { min: 10000000, max: 50000000 }, label: '$10M - $50M', priority: 6 },
        { range: { min: 50000000 }, label: '$50M+', priority: 5 }
      ];

      for (const budgetFilter of budgetFilters) {
        const count = await this.getBudgetRangeCount(budgetFilter.range);
        filters.push({
          id: `budget_${budgetFilter.label.replace(/\s+/g, '_').toLowerCase()}`,
          label: budgetFilter.label,
          value: budgetFilter.range,
          count,
          trending: false,
          priority: budgetFilter.priority,
          icon: 'dollar-sign',
          color: 'green'
        });
      }

      // Format-based quick filters
      const popularFormats = ['Feature Film', 'Series', 'Documentary', 'Short Film'];
      for (const format of popularFormats) {
        const count = await this.getFormatCount(format);
        filters.push({
          id: `format_${format.replace(/\s+/g, '_').toLowerCase()}`,
          label: format,
          value: { formats: [format] },
          count,
          trending: false,
          priority: 4,
          icon: 'video',
          color: 'blue'
        });
      }

      // Time-based quick filters
      const timeFilters = [
        { label: 'This Week', value: { dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }, priority: 3 },
        { label: 'This Month', value: { dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }, priority: 2 },
        { label: 'This Year', value: { dateFrom: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() }, priority: 1 }
      ];

      for (const timeFilter of timeFilters) {
        const count = await this.getTimeRangeCount(timeFilter.value.dateFrom);
        filters.push({
          id: `time_${timeFilter.label.replace(/\s+/g, '_').toLowerCase()}`,
          label: timeFilter.label,
          value: timeFilter.value,
          count,
          trending: timeFilter.label === 'This Week',
          priority: timeFilter.priority,
          icon: 'calendar',
          color: 'purple'
        });
      }

      // Sort by priority and trending status
      return filters
        .filter(f => f.count > 0)
        .sort((a, b) => {
          if (a.trending && !b.trending) return -1;
          if (!a.trending && b.trending) return 1;
          return b.priority - a.priority;
        })
        .slice(0, 12); // Limit to 12 quick filters

    } catch (error) {
      console.error('Error generating quick filters:', error);
      return [];
    }
  }

  // Helper methods

  private static calculateTitleConfidence(title: string, query: string): number {
    const titleLower = title.toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (titleLower === queryLower) return 100;
    if (titleLower.startsWith(queryLower)) return 90;
    if (titleLower.includes(queryLower)) return 80;
    
    return 60;
  }

  private static calculateGenreConfidence(genre: string, query: string): number {
    const genreLower = genre.toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (genreLower === queryLower) return 95;
    if (genreLower.includes(queryLower)) return 85;
    
    return 70;
  }

  private static calculateCreatorConfidence(creator: string, query: string): number {
    const creatorLower = creator.toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (creatorLower === queryLower) return 100;
    if (creatorLower.includes(queryLower)) return 85;
    
    return 70;
  }

  private static analyzeNaturalLanguage(query: string): Array<{
    suggestion: string;
    confidence: number;
    reasoning: string;
    keywords: string[];
  }> {
    const patterns = [];
    const queryLower = query.toLowerCase();
    
    // Pattern: "show me X"
    if (queryLower.startsWith('show me ') || queryLower.startsWith('find ')) {
      const cleanQuery = queryLower.replace(/^(show me |find )/, '');
      patterns.push({
        suggestion: cleanQuery,
        confidence: 85,
        reasoning: 'Converted natural language request',
        keywords: cleanQuery.split(/\s+/)
      });
    }
    
    // Pattern: "I want X" or "I need X"
    if (queryLower.includes('i want ') || queryLower.includes('i need ')) {
      const cleanQuery = queryLower.replace(/.*(i want |i need )/, '');
      patterns.push({
        suggestion: cleanQuery,
        confidence: 80,
        reasoning: 'Converted personal request',
        keywords: cleanQuery.split(/\s+/)
      });
    }
    
    // Pattern: "looking for X"
    if (queryLower.includes('looking for ')) {
      const cleanQuery = queryLower.replace(/.*looking for /, '');
      patterns.push({
        suggestion: cleanQuery,
        confidence: 85,
        reasoning: 'Converted search intent',
        keywords: cleanQuery.split(/\s+/)
      });
    }
    
    // Pattern: Questions
    if (queryLower.includes('?') || queryLower.startsWith('what ') || queryLower.startsWith('where ')) {
      // Extract meaningful parts from questions
      const keywords = queryLower
        .replace(/\?/g, '')
        .split(/\s+/)
        .filter(word => !['what', 'where', 'how', 'when', 'why', 'is', 'are', 'the', 'a', 'an'].includes(word));
      
      patterns.push({
        suggestion: keywords.join(' '),
        confidence: 75,
        reasoning: 'Extracted keywords from question',
        keywords
      });
    }

    return patterns;
  }

  private static areQueriesRelated(query1: string, query2: string): boolean {
    const words1 = new Set(query1.toLowerCase().split(/\s+/));
    const words2 = new Set(query2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    const similarity = intersection.size / union.size;
    return similarity > 0.3;
  }

  private static async getUserSearchHistory(userId: number): Promise<string[]> {
    try {
      const result = await db.execute(`
        SELECT DISTINCT search_query
        FROM search_analytics 
        WHERE user_id = ${userId}
        AND created_at >= NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      return result.rows?.map(row => row.search_query) || [];
    } catch (error) {
      console.error('Error getting user search history:', error);
      return [];
    }
  }

  private static async getSuggestionsFromViewedPitches(
    viewedPitches: number[],
    query: string
  ): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    try {
      if (viewedPitches.length === 0) return suggestions;
      
      const pitchIds = viewedPitches.slice(0, 10).join(','); // Limit for performance
      
      const relatedPitches = await db.execute(`
        SELECT DISTINCT genre, COUNT(*) as count
        FROM pitches 
        WHERE id IN (${pitchIds})
        GROUP BY genre
        ORDER BY count DESC
        LIMIT 3
      `);
      
      for (const pitch of relatedPitches.rows || []) {
        suggestions.push({
          query: pitch.genre,
          type: 'genre',
          confidence: 70,
          context: 'based_on_viewed_content',
          metadata: { resultCount: pitch.count }
        });
      }

    } catch (error) {
      console.error('Error getting suggestions from viewed pitches:', error);
    }

    return suggestions;
  }

  private static async getUserTypeSuggestions(
    query: string,
    userType: string
  ): Promise<IntelligentSuggestion[]> {
    const suggestions: IntelligentSuggestion[] = [];
    
    // User type specific suggestions
    const userTypeMappings: Record<string, string[]> = {
      'investor': ['ROI', 'budget efficiency', 'market potential', 'proven creators'],
      'creator': ['collaboration', 'networking', 'similar projects', 'inspiration'],
      'production': ['market trends', 'commercial viability', 'distribution ready']
    };
    
    const typeTerms = userTypeMappings[userType] || [];
    for (const term of typeTerms) {
      if (term.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().includes(term.toLowerCase())) {
        suggestions.push({
          query: term,
          type: 'theme',
          confidence: 60,
          context: `relevant_for_${userType}`
        });
      }
    }

    return suggestions;
  }

  private static getSemanticMapping(): Record<string, string[]> {
    return {
      'scary': ['horror', 'thriller', 'supernatural', 'suspense'],
      'funny': ['comedy', 'humor', 'satire', 'parody'],
      'romantic': ['romance', 'love story', 'relationship'],
      'action': ['adventure', 'thriller', 'explosive', 'high-octane'],
      'space': ['sci-fi', 'science fiction', 'futuristic'],
      'magic': ['fantasy', 'supernatural', 'mystical'],
      'real': ['documentary', 'based on true story', 'non-fiction'],
      'kids': ['family', 'children', 'animation'],
      'dark': ['noir', 'gritty', 'mature'],
      'uplifting': ['inspiring', 'feel-good', 'heartwarming'],
      'mystery': ['detective', 'crime', 'investigation'],
      'war': ['military', 'historical', 'conflict'],
      'western': ['cowboy', 'frontier', 'old west']
    };
  }

  private static async getPopularGenres(): Promise<Array<{ genre: string; count: number; growth_rate: number }>> {
    try {
      const result = await db.execute(`
        SELECT 
          genre,
          COUNT(*) as count,
          CASE 
            WHEN COUNT(*) > 50 THEN 25
            WHEN COUNT(*) > 20 THEN 15
            ELSE 5
          END as growth_rate
        FROM pitches 
        WHERE status = 'published'
        GROUP BY genre
        ORDER BY count DESC
        LIMIT 8
      `);
      
      return result.rows || [];
    } catch (error) {
      console.error('Error getting popular genres:', error);
      return [];
    }
  }

  private static calculateGenrePriority(genre: string, context?: SearchContext): number {
    // Higher priority for user's preferred genres
    if (context?.preferredGenres?.includes(genre)) {
      return 10;
    }
    
    // Default priority based on general popularity
    const popularityMap: Record<string, number> = {
      'Action': 9, 'Comedy': 8, 'Drama': 7, 'Horror': 6,
      'Thriller': 5, 'Romance': 4, 'Sci-Fi': 3, 'Fantasy': 2
    };
    
    return popularityMap[genre] || 1;
  }

  private static getGenreIcon(genre: string): string {
    const iconMap: Record<string, string> = {
      'Action': 'zap', 'Comedy': 'smile', 'Horror': 'skull',
      'Romance': 'heart', 'Sci-Fi': 'star', 'Drama': 'theater'
    };
    return iconMap[genre] || 'film';
  }

  private static getGenreColor(genre: string): string {
    const colorMap: Record<string, string> = {
      'Action': 'red', 'Comedy': 'yellow', 'Horror': 'purple',
      'Romance': 'pink', 'Sci-Fi': 'blue', 'Drama': 'green'
    };
    return colorMap[genre] || 'gray';
  }

  private static async getBudgetRangeCount(range: { min?: number; max?: number }): Promise<number> {
    try {
      let query = "SELECT COUNT(*) as count FROM pitches WHERE status = 'published' AND estimated_budget IS NOT NULL";
      
      if (range.min) query += ` AND estimated_budget >= ${range.min}`;
      if (range.max) query += ` AND estimated_budget <= ${range.max}`;
      
      const result = await db.execute(query);
      return result.rows?.[0]?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  private static async getFormatCount(format: string): Promise<number> {
    try {
      const result = await db.execute(`
        SELECT COUNT(*) as count 
        FROM pitches 
        WHERE status = 'published' AND format = '${format}'
      `);
      return result.rows?.[0]?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  private static async getTimeRangeCount(dateFrom: string): Promise<number> {
    try {
      const result = await db.execute(`
        SELECT COUNT(*) as count 
        FROM pitches 
        WHERE status = 'published' AND published_at >= '${dateFrom}'
      `);
      return result.rows?.[0]?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  private static rankSuggestions(
    suggestions: IntelligentSuggestion[],
    originalQuery: string,
    context?: SearchContext
  ): IntelligentSuggestion[] {
    return suggestions.sort((a, b) => {
      // Boost confidence based on context
      let aScore = a.confidence || 0;
      let bScore = b.confidence || 0;
      
      // Boost exact matches
      if (a.query.toLowerCase() === originalQuery.toLowerCase()) aScore += 20;
      if (b.query.toLowerCase() === originalQuery.toLowerCase()) bScore += 20;
      
      // Boost trending suggestions
      if (a.context === 'trending') aScore += 15;
      if (b.context === 'trending') bScore += 15;
      
      // Boost user context matches
      if (context?.preferredGenres?.includes(a.query)) aScore += 10;
      if (context?.preferredGenres?.includes(b.query)) bScore += 10;
      
      return bScore - aScore;
    });
  }

  private static removeDuplicates(suggestions: IntelligentSuggestion[]): IntelligentSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = suggestion.query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// IntelligentSuggestionService is already exported as a class above