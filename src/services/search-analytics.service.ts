/**
 * Search Analytics Service
 * Comprehensive analytics tracking for search performance, user behavior, and system optimization
 */

import { db } from "../db/client.ts";

export interface SearchAnalyticsEvent {
  userId?: number;
  sessionId: string;
  searchQuery: string;
  searchType: 'basic' | 'advanced' | 'saved' | 'natural_language';
  filters?: any;
  resultsCount: number;
  clickedResultId?: number;
  clickedResultPosition?: number;
  timeToClick?: number; // milliseconds
  searchDuration?: number; // milliseconds
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface SearchPerformanceMetrics {
  avgResponseTime: number;
  avgResultsCount: number;
  noResultsRate: number;
  clickThroughRate: number;
  bounceRate: number;
  popularQueries: Array<{
    query: string;
    count: number;
    ctr: number;
  }>;
  slowQueries: Array<{
    query: string;
    avgTime: number;
    count: number;
  }>;
}

export interface UserBehaviorInsights {
  searchPatterns: {
    avgSessionLength: number;
    avgQueriesPerSession: number;
    mostCommonFilters: string[];
    searchTimes: Record<string, number>; // hour of day distribution
  };
  contentPreferences: {
    preferredGenres: string[];
    budgetRanges: Record<string, number>;
    formatPreferences: string[];
  };
  searchSuccessMetrics: {
    immediateExitRate: number;
    refinementRate: number;
    saveRate: number;
  };
}

export interface TrendingData {
  queries: Array<{
    query: string;
    totalSearches: number;
    uniqueUsers: number;
    growthRate: number;
    timeframe: string;
  }>;
  topics: Array<{
    topic: string;
    mentions: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    relatedTerms: string[];
  }>;
  seasonalTrends: Record<string, number>;
}

export class SearchAnalyticsService {

  /**
   * Track a search event
   */
  static async trackSearchEvent(event: SearchAnalyticsEvent): Promise<void> {
    try {
      await db.execute(`
        INSERT INTO search_analytics (
          user_id, session_id, search_query, search_type, filters, 
          results_count, clicked_result_id, clicked_result_position,
          time_to_click_ms, search_duration_ms, user_agent, ip_address,
          created_at
        ) VALUES (
          ${event.userId || 'NULL'},
          '${event.sessionId}',
          '${event.searchQuery.replace(/'/g, "''")}',
          '${event.searchType}',
          '${JSON.stringify(event.filters || {}).replace(/'/g, "''")}',
          ${event.resultsCount},
          ${event.clickedResultId || 'NULL'},
          ${event.clickedResultPosition || 'NULL'},
          ${event.timeToClick || 'NULL'},
          ${event.searchDuration || 'NULL'},
          '${(event.userAgent || '').replace(/'/g, "''")}',
          '${event.ipAddress || ''}'::inet,
          NOW()
        )
      `);

      // Update search trends
      await this.updateSearchTrends(event.searchQuery, event.resultsCount, event.clickedResultPosition);
      
      // Update suggestion popularity if search was successful
      if (event.resultsCount > 0) {
        await this.updateSuggestionPopularity(event.searchQuery);
      }

    } catch (error) {
      console.error('Failed to track search event:', error);
    }
  }

  /**
   * Track click-through event
   */
  static async trackClickThrough(
    sessionId: string,
    searchQuery: string,
    resultId: number,
    position: number,
    timeToClick: number
  ): Promise<void> {
    try {
      // Update the most recent search event with click data
      await db.execute(`
        UPDATE search_analytics 
        SET 
          clicked_result_id = ${resultId},
          clicked_result_position = ${position},
          time_to_click_ms = ${timeToClick}
        WHERE session_id = '${sessionId}' 
        AND search_query = '${searchQuery.replace(/'/g, "''")}'
        AND clicked_result_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `);

    } catch (error) {
      console.error('Failed to track click-through:', error);
    }
  }

  /**
   * Get search performance metrics
   */
  static async getPerformanceMetrics(
    timeRange: {
      start: Date;
      end: Date;
    }
  ): Promise<SearchPerformanceMetrics> {
    try {
      const startDate = timeRange.start.toISOString();
      const endDate = timeRange.end.toISOString();

      // Get basic performance metrics
      const basicMetrics = await db.execute(`
        SELECT 
          AVG(search_duration_ms) as avg_response_time,
          AVG(results_count) as avg_results_count,
          (COUNT(CASE WHEN results_count = 0 THEN 1 END)::FLOAT / COUNT(*)) * 100 as no_results_rate,
          (COUNT(CASE WHEN clicked_result_id IS NOT NULL THEN 1 END)::FLOAT / COUNT(*)) * 100 as click_through_rate,
          (COUNT(CASE WHEN time_to_click_ms > 30000 OR clicked_result_id IS NULL THEN 1 END)::FLOAT / COUNT(*)) * 100 as bounce_rate
        FROM search_analytics
        WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
      `);

      const metrics = basicMetrics.rows?.[0] || {};

      // Get popular queries
      const popularQueries = await db.execute(`
        SELECT 
          search_query,
          COUNT(*) as search_count,
          (COUNT(CASE WHEN clicked_result_id IS NOT NULL THEN 1 END)::FLOAT / COUNT(*)) * 100 as ctr
        FROM search_analytics
        WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
        AND results_count > 0
        GROUP BY search_query
        HAVING COUNT(*) >= 5
        ORDER BY search_count DESC
        LIMIT 10
      `);

      // Get slow queries
      const slowQueries = await db.execute(`
        SELECT 
          search_query,
          AVG(search_duration_ms) as avg_time,
          COUNT(*) as search_count
        FROM search_analytics
        WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
        AND search_duration_ms IS NOT NULL
        GROUP BY search_query
        HAVING AVG(search_duration_ms) > 2000
        ORDER BY avg_time DESC
        LIMIT 10
      `);

      return {
        avgResponseTime: Math.round(metrics.avg_response_time || 0),
        avgResultsCount: Math.round(metrics.avg_results_count || 0),
        noResultsRate: Math.round((metrics.no_results_rate || 0) * 100) / 100,
        clickThroughRate: Math.round((metrics.click_through_rate || 0) * 100) / 100,
        bounceRate: Math.round((metrics.bounce_rate || 0) * 100) / 100,
        popularQueries: popularQueries.rows?.map(row => ({
          query: row.search_query,
          count: row.search_count,
          ctr: Math.round(row.ctr * 100) / 100
        })) || [],
        slowQueries: slowQueries.rows?.map(row => ({
          query: row.search_query,
          avgTime: Math.round(row.avg_time),
          count: row.search_count
        })) || []
      };

    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return {
        avgResponseTime: 0,
        avgResultsCount: 0,
        noResultsRate: 0,
        clickThroughRate: 0,
        bounceRate: 0,
        popularQueries: [],
        slowQueries: []
      };
    }
  }

  /**
   * Get user behavior insights
   */
  static async getUserBehaviorInsights(
    userId?: number,
    timeRange?: { start: Date; end: Date }
  ): Promise<UserBehaviorInsights> {
    try {
      const startDate = timeRange?.start.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = timeRange?.end.toISOString() || new Date().toISOString();
      const userClause = userId ? `AND user_id = ${userId}` : '';

      // Search patterns
      const searchPatterns = await db.execute(`
        SELECT 
          session_id,
          COUNT(*) as queries_in_session,
          AVG(search_duration_ms) as avg_duration,
          EXTRACT(HOUR FROM created_at) as search_hour
        FROM search_analytics
        WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
        ${userClause}
        GROUP BY session_id, EXTRACT(HOUR FROM created_at)
      `);

      // Content preferences from filters
      const contentPrefs = await db.execute(`
        SELECT 
          filters,
          clicked_result_id
        FROM search_analytics
        WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
        ${userClause}
        AND filters IS NOT NULL
        AND filters != '{}'
      `);

      // Process search patterns
      const sessionData = searchPatterns.rows || [];
      const avgSessionLength = sessionData.length > 0 
        ? sessionData.reduce((sum, row) => sum + row.avg_duration, 0) / sessionData.length 
        : 0;
      
      const avgQueriesPerSession = sessionData.length > 0
        ? sessionData.reduce((sum, row) => sum + row.queries_in_session, 0) / sessionData.length
        : 0;

      // Process hourly distribution
      const searchTimes: Record<string, number> = {};
      for (let hour = 0; hour < 24; hour++) {
        searchTimes[hour.toString()] = 0;
      }
      
      sessionData.forEach(row => {
        if (row.search_hour !== null) {
          searchTimes[row.search_hour.toString()] = (searchTimes[row.search_hour.toString()] || 0) + 1;
        }
      });

      // Process content preferences
      const genreCount: Record<string, number> = {};
      const budgetRanges: Record<string, number> = {};
      const formatCount: Record<string, number> = {};

      (contentPrefs.rows || []).forEach(row => {
        try {
          const filters = typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters;
          
          if (filters.genres) {
            filters.genres.forEach((genre: string) => {
              genreCount[genre] = (genreCount[genre] || 0) + 1;
            });
          }
          
          if (filters.formats) {
            filters.formats.forEach((format: string) => {
              formatCount[format] = (formatCount[format] || 0) + 1;
            });
          }
          
          if (filters.budgetMin || filters.budgetMax) {
            const range = this.getBudgetRangeLabel(filters.budgetMin, filters.budgetMax);
            budgetRanges[range] = (budgetRanges[range] || 0) + 1;
          }
        } catch (e) {
          // Skip invalid filter JSON
        }
      });

      // Success metrics
      const successMetrics = await db.execute(`
        SELECT 
          COUNT(CASE WHEN clicked_result_id IS NULL THEN 1 END)::FLOAT / COUNT(*) * 100 as immediate_exit_rate,
          COUNT(CASE WHEN time_to_click_ms > 10000 THEN 1 END)::FLOAT / COUNT(*) * 100 as refinement_rate
        FROM search_analytics
        WHERE created_at BETWEEN '${startDate}' AND '${endDate}'
        ${userClause}
      `);

      const successData = successMetrics.rows?.[0] || {};

      return {
        searchPatterns: {
          avgSessionLength: Math.round(avgSessionLength || 0),
          avgQueriesPerSession: Math.round((avgQueriesPerSession || 0) * 100) / 100,
          mostCommonFilters: Object.keys(genreCount).slice(0, 5),
          searchTimes
        },
        contentPreferences: {
          preferredGenres: Object.entries(genreCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([genre]) => genre),
          budgetRanges,
          formatPreferences: Object.entries(formatCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([format]) => format)
        },
        searchSuccessMetrics: {
          immediateExitRate: Math.round((successData.immediate_exit_rate || 0) * 100) / 100,
          refinementRate: Math.round((successData.refinement_rate || 0) * 100) / 100,
          saveRate: 0 // Would need to track saved searches
        }
      };

    } catch (error) {
      console.error('Failed to get user behavior insights:', error);
      return {
        searchPatterns: {
          avgSessionLength: 0,
          avgQueriesPerSession: 0,
          mostCommonFilters: [],
          searchTimes: {}
        },
        contentPreferences: {
          preferredGenres: [],
          budgetRanges: {},
          formatPreferences: []
        },
        searchSuccessMetrics: {
          immediateExitRate: 0,
          refinementRate: 0,
          saveRate: 0
        }
      };
    }
  }

  /**
   * Get trending search data
   */
  static async getTrendingData(
    timeframe: '24h' | '7d' | '30d' = '7d'
  ): Promise<TrendingData> {
    try {
      const intervals = {
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
      };

      const interval = intervals[timeframe];

      // Get trending queries using search_trends table
      const trendingQueries = await db.execute(`
        SELECT 
          st.search_term as query,
          SUM(st.search_count) as total_searches,
          COUNT(DISTINCT st.time_bucket) as unique_periods,
          
          -- Calculate growth rate by comparing recent vs earlier periods
          CASE 
            WHEN SUM(CASE WHEN st.time_bucket >= NOW() - INTERVAL '${interval}'/2 THEN st.search_count ELSE 0 END) > 0
            AND SUM(CASE WHEN st.time_bucket < NOW() - INTERVAL '${interval}'/2 THEN st.search_count ELSE 0 END) > 0
            THEN 
              ((SUM(CASE WHEN st.time_bucket >= NOW() - INTERVAL '${interval}'/2 THEN st.search_count ELSE 0 END)::FLOAT / 
                SUM(CASE WHEN st.time_bucket < NOW() - INTERVAL '${interval}'/2 THEN st.search_count ELSE 0 END)) - 1) * 100
            ELSE 0
          END as growth_rate
          
        FROM search_trends st
        WHERE st.time_bucket >= NOW() - INTERVAL '${interval}'
        GROUP BY st.search_term
        HAVING SUM(st.search_count) >= 10
        ORDER BY total_searches DESC, growth_rate DESC
        LIMIT 20
      `);

      // Get unique user counts for trending queries
      const uniqueUserCounts = await db.execute(`
        SELECT 
          search_query,
          COUNT(DISTINCT COALESCE(user_id, session_id)) as unique_users
        FROM search_analytics
        WHERE created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY search_query
      `);

      const userCountMap = new Map(
        (uniqueUserCounts.rows || []).map(row => [row.search_query, row.unique_users])
      );

      const queries = (trendingQueries.rows || []).map(row => ({
        query: row.query,
        totalSearches: row.total_searches,
        uniqueUsers: userCountMap.get(row.query) || 0,
        growthRate: Math.round((row.growth_rate || 0) * 100) / 100,
        timeframe
      }));

      // Extract topics from trending queries
      const topics = await this.extractTopicsFromQueries(queries.map(q => q.query));

      // Get seasonal trends (simplified)
      const seasonalTrends = await this.getSeasonalTrends();

      return {
        queries,
        topics,
        seasonalTrends
      };

    } catch (error) {
      console.error('Failed to get trending data:', error);
      return {
        queries: [],
        topics: [],
        seasonalTrends: {}
      };
    }
  }

  /**
   * Generate search performance report
   */
  static async generatePerformanceReport(
    timeRange: { start: Date; end: Date }
  ): Promise<{
    summary: SearchPerformanceMetrics;
    insights: UserBehaviorInsights;
    trending: TrendingData;
    recommendations: string[];
  }> {
    try {
      const [summary, insights, trending] = await Promise.all([
        this.getPerformanceMetrics(timeRange),
        this.getUserBehaviorInsights(undefined, timeRange),
        this.getTrendingData('7d')
      ]);

      const recommendations = this.generateRecommendations(summary, insights, trending);

      return {
        summary,
        insights,
        trending,
        recommendations
      };

    } catch (error) {
      console.error('Failed to generate performance report:', error);
      return {
        summary: {
          avgResponseTime: 0,
          avgResultsCount: 0,
          noResultsRate: 0,
          clickThroughRate: 0,
          bounceRate: 0,
          popularQueries: [],
          slowQueries: []
        },
        insights: {
          searchPatterns: {
            avgSessionLength: 0,
            avgQueriesPerSession: 0,
            mostCommonFilters: [],
            searchTimes: {}
          },
          contentPreferences: {
            preferredGenres: [],
            budgetRanges: {},
            formatPreferences: []
          },
          searchSuccessMetrics: {
            immediateExitRate: 0,
            refinementRate: 0,
            saveRate: 0
          }
        },
        trending: {
          queries: [],
          topics: [],
          seasonalTrends: {}
        },
        recommendations: []
      };
    }
  }

  /**
   * Update search trends data
   */
  private static async updateSearchTrends(
    searchQuery: string,
    resultCount: number,
    clickPosition?: number
  ): Promise<void> {
    try {
      await db.execute(`
        SELECT update_search_trends('${searchQuery.replace(/'/g, "''")}', ${resultCount}, ${clickPosition || 'NULL'})
      `);
    } catch (error) {
      console.error('Failed to update search trends:', error);
    }
  }

  /**
   * Update suggestion popularity
   */
  private static async updateSuggestionPopularity(searchQuery: string): Promise<void> {
    try {
      await db.execute(`
        INSERT INTO search_suggestions (query_text, suggestion_type, popularity_score, last_suggested)
        VALUES ('${searchQuery.replace(/'/g, "''")}', 'autocomplete', 1, NOW())
        ON CONFLICT (query_text)
        DO UPDATE SET
          popularity_score = search_suggestions.popularity_score + 1,
          suggestion_count = search_suggestions.suggestion_count + 1,
          last_suggested = NOW()
      `);
    } catch (error) {
      console.error('Failed to update suggestion popularity:', error);
    }
  }

  /**
   * Extract topics from search queries using simple keyword analysis
   */
  private static async extractTopicsFromQueries(queries: string[]): Promise<Array<{
    topic: string;
    mentions: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    relatedTerms: string[];
  }>> {
    const topicMap: Record<string, { count: number; terms: Set<string> }> = {};
    
    // Simple topic extraction - in production, you'd use NLP libraries
    const topicKeywords: Record<string, string[]> = {
      'horror': ['horror', 'scary', 'frightening', 'supernatural', 'ghost'],
      'comedy': ['comedy', 'funny', 'humor', 'laugh', 'hilarious'],
      'action': ['action', 'adventure', 'explosive', 'thrilling'],
      'romance': ['romance', 'love', 'romantic', 'relationship'],
      'drama': ['drama', 'emotional', 'serious', 'character'],
      'sci-fi': ['sci-fi', 'science fiction', 'futuristic', 'space'],
      'budget': ['budget', 'cost', 'money', 'funding', 'investment'],
      'independent': ['indie', 'independent', 'low budget', 'micro'],
      'studio': ['studio', 'big budget', 'blockbuster', 'commercial']
    };

    queries.forEach(query => {
      const queryLower = query.toLowerCase();
      
      Object.entries(topicKeywords).forEach(([topic, keywords]) => {
        keywords.forEach(keyword => {
          if (queryLower.includes(keyword)) {
            if (!topicMap[topic]) {
              topicMap[topic] = { count: 0, terms: new Set() };
            }
            topicMap[topic].count++;
            topicMap[topic].terms.add(keyword);
          }
        });
      });
    });

    return Object.entries(topicMap)
      .map(([topic, data]) => ({
        topic,
        mentions: data.count,
        sentiment: 'neutral' as const, // Simplified - would use sentiment analysis
        relatedTerms: Array.from(data.terms)
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10);
  }

  /**
   * Get seasonal trends (simplified implementation)
   */
  private static async getSeasonalTrends(): Promise<Record<string, number>> {
    try {
      const result = await db.execute(`
        SELECT 
          EXTRACT(MONTH FROM created_at) as month,
          COUNT(*) as search_count
        FROM search_analytics
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY EXTRACT(MONTH FROM created_at)
        ORDER BY month
      `);

      const trends: Record<string, number> = {};
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];

      (result.rows || []).forEach(row => {
        const monthIndex = parseInt(row.month) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          trends[monthNames[monthIndex]] = row.search_count;
        }
      });

      return trends;
    } catch (error) {
      console.error('Failed to get seasonal trends:', error);
      return {};
    }
  }

  /**
   * Generate recommendations based on analytics data
   */
  private static generateRecommendations(
    metrics: SearchPerformanceMetrics,
    insights: UserBehaviorInsights,
    trending: TrendingData
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (metrics.avgResponseTime > 2000) {
      recommendations.push('Consider optimizing search query performance - average response time is above 2 seconds');
    }

    if (metrics.noResultsRate > 15) {
      recommendations.push('High no-results rate detected - consider improving search suggestions and query expansion');
    }

    if (metrics.clickThroughRate < 30) {
      recommendations.push('Low click-through rate - consider improving result relevance and presentation');
    }

    if (metrics.bounceRate > 60) {
      recommendations.push('High bounce rate indicates users are not finding what they need - review search result quality');
    }

    // Content recommendations
    if (insights.contentPreferences.preferredGenres.length > 0) {
      const topGenre = insights.contentPreferences.preferredGenres[0];
      recommendations.push(`Consider featuring more ${topGenre} content based on user preferences`);
    }

    // Trending recommendations
    if (trending.queries.length > 0) {
      const growingQueries = trending.queries.filter(q => q.growthRate > 50);
      if (growingQueries.length > 0) {
        recommendations.push(`Monitor fast-growing search terms: ${growingQueries.slice(0, 3).map(q => q.query).join(', ')}`);
      }
    }

    // Usage pattern recommendations
    if (insights.searchPatterns.avgQueriesPerSession > 5) {
      recommendations.push('Users are refining searches frequently - consider improving initial result quality');
    }

    return recommendations;
  }

  /**
   * Helper method to get budget range label
   */
  private static getBudgetRangeLabel(min?: number, max?: number): string {
    if (!min && !max) return 'Any Budget';
    if (!min) return `Under $${this.formatBudget(max!)}`;
    if (!max) return `$${this.formatBudget(min)}+`;
    return `$${this.formatBudget(min)} - $${this.formatBudget(max)}`;
  }

  /**
   * Format budget for display
   */
  private static formatBudget(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    return amount.toString();
  }
}

// SearchAnalyticsService is already exported as a class above