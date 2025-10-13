import { db } from "../db/client.ts";
import { 
  searchHistory, 
  searchClickTracking, 
  searchAnalytics,
  searchSuggestions,
  analyticsEvents 
} from "../db/schema.ts";
import { 
  eq, 
  and, 
  gte, 
  lte, 
  sql, 
  desc, 
  count,
  isNotNull 
} from "drizzle-orm";

export interface SearchAnalyticsData {
  totalSearches: number;
  uniqueUsers: number;
  uniqueQueries: number;
  averageResultCount: number;
  zeroResultSearches: number;
  totalClicks: number;
  clickThroughRate: number;
  averagePosition: number;
  topQueries: Array<{
    query: string;
    count: number;
    ctr: number;
  }>;
  topZeroResultQueries: Array<{
    query: string;
    count: number;
  }>;
  searchTrends: Array<{
    date: string;
    searches: number;
    clicks: number;
    ctr: number;
  }>;
}

export interface QueryPerformance {
  query: string;
  totalSearches: number;
  totalClicks: number;
  clickThroughRate: number;
  averagePosition: number;
  averageResultCount: number;
  lastSearched: Date;
}

export class SearchAnalyticsService {
  // Calculate search analytics for a date range
  static async getSearchAnalytics(
    startDate: Date, 
    endDate: Date, 
    userId?: number
  ): Promise<SearchAnalyticsData> {
    const baseConditions = [
      gte(searchHistory.searchedAt, startDate.toISOString()),
      lte(searchHistory.searchedAt, endDate.toISOString())
    ];

    if (userId) {
      baseConditions.push(eq(searchHistory.userId, userId));
    }

    // Total searches and basic metrics
    const searchMetrics = await db.select({
      totalSearches: count(),
      uniqueUsers: sql<number>`COUNT(DISTINCT user_id)`,
      uniqueQueries: sql<number>`COUNT(DISTINCT query)`,
      averageResultCount: sql<number>`AVG(result_count)`,
      zeroResultSearches: sql<number>`COUNT(*) FILTER (WHERE result_count = 0)`,
    })
    .from(searchHistory)
    .where(and(...baseConditions));

    const metrics = searchMetrics[0];

    // Click metrics
    const clickMetrics = await db.select({
      totalClicks: count(),
      averagePosition: sql<number>`AVG(result_position)`,
    })
    .from(searchClickTracking)
    .innerJoin(searchHistory, eq(searchClickTracking.searchHistoryId, searchHistory.id))
    .where(and(...baseConditions));

    const clicks = clickMetrics[0];

    // Calculate CTR
    const clickThroughRate = metrics.totalSearches > 0 
      ? (clicks.totalClicks / metrics.totalSearches) * 100 
      : 0;

    // Top queries with CTR
    const topQueries = await db.select({
      query: searchHistory.query,
      count: count(searchHistory.id),
      clicks: sql<number>`COUNT(${searchClickTracking.id})`,
    })
    .from(searchHistory)
    .leftJoin(searchClickTracking, eq(searchClickTracking.searchHistoryId, searchHistory.id))
    .where(and(...baseConditions))
    .groupBy(searchHistory.query)
    .orderBy(desc(count(searchHistory.id)))
    .limit(20);

    const topQueriesWithCTR = topQueries.map(q => ({
      query: q.query,
      count: q.count,
      ctr: q.count > 0 ? (q.clicks / q.count) * 100 : 0
    }));

    // Top zero-result queries
    const topZeroResultQueries = await db.select({
      query: searchHistory.query,
      count: count(),
    })
    .from(searchHistory)
    .where(and(
      ...baseConditions,
      eq(searchHistory.resultCount, 0)
    ))
    .groupBy(searchHistory.query)
    .orderBy(desc(count()))
    .limit(10);

    // Search trends by day
    const searchTrends = await db.select({
      date: sql<string>`DATE(searched_at)`,
      searches: count(searchHistory.id),
      clicks: sql<number>`COUNT(${searchClickTracking.id})`,
    })
    .from(searchHistory)
    .leftJoin(searchClickTracking, eq(searchClickTracking.searchHistoryId, searchHistory.id))
    .where(and(...baseConditions))
    .groupBy(sql`DATE(searched_at)`)
    .orderBy(sql`DATE(searched_at)`);

    const trendsWithCTR = searchTrends.map(t => ({
      date: t.date,
      searches: t.searches,
      clicks: t.clicks,
      ctr: t.searches > 0 ? (t.clicks / t.searches) * 100 : 0
    }));

    return {
      totalSearches: metrics.totalSearches,
      uniqueUsers: metrics.uniqueUsers,
      uniqueQueries: metrics.uniqueQueries,
      averageResultCount: Number(metrics.averageResultCount) || 0,
      zeroResultSearches: metrics.zeroResultSearches,
      totalClicks: clicks.totalClicks,
      clickThroughRate,
      averagePosition: Number(clicks.averagePosition) || 0,
      topQueries: topQueriesWithCTR,
      topZeroResultQueries: topZeroResultQueries.map(q => ({
        query: q.query,
        count: q.count
      })),
      searchTrends: trendsWithCTR
    };
  }

  // Get performance metrics for specific queries
  static async getQueryPerformance(
    queries: string[], 
    startDate: Date, 
    endDate: Date
  ): Promise<QueryPerformance[]> {
    const results = await db.select({
      query: searchHistory.query,
      totalSearches: count(searchHistory.id),
      totalClicks: sql<number>`COUNT(${searchClickTracking.id})`,
      averagePosition: sql<number>`AVG(${searchClickTracking.resultPosition})`,
      averageResultCount: sql<number>`AVG(${searchHistory.resultCount})`,
      lastSearched: sql<Date>`MAX(${searchHistory.searchedAt})`,
    })
    .from(searchHistory)
    .leftJoin(searchClickTracking, eq(searchClickTracking.searchHistoryId, searchHistory.id))
    .where(and(
      gte(searchHistory.searchedAt, startDate.toISOString()),
      lte(searchHistory.searchedAt, endDate),
      sql`${searchHistory.query} = ANY(${queries})`
    ))
    .groupBy(searchHistory.query);

    return results.map(r => ({
      query: r.query,
      totalSearches: r.totalSearches,
      totalClicks: r.totalClicks,
      clickThroughRate: r.totalSearches > 0 ? (r.totalClicks / r.totalSearches) * 100 : 0,
      averagePosition: Number(r.averagePosition) || 0,
      averageResultCount: Number(r.averageResultCount) || 0,
      lastSearched: r.lastSearched
    }));
  }

  // Update search suggestions based on analytics
  static async updateSearchSuggestions(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get query performance for the last 30 days
    const queryStats = await db.select({
      query: searchHistory.query,
      searchCount: count(searchHistory.id),
      clickCount: sql<number>`COUNT(${searchClickTracking.id})`,
      resultCount: sql<number>`AVG(${searchHistory.resultCount})`,
      lastSearched: sql<Date>`MAX(${searchHistory.searchedAt})`,
    })
    .from(searchHistory)
    .leftJoin(searchClickTracking, eq(searchClickTracking.searchHistoryId, searchHistory.id))
    .where(gte(searchHistory.searchedAt, thirtyDaysAgo))
    .groupBy(searchHistory.query)
    .having(sql`COUNT(${searchHistory.id}) >= 5`) // Minimum 5 searches
    .orderBy(desc(count(searchHistory.id)));

    // Update or insert search suggestions
    for (const stat of queryStats) {
      const ctr = stat.searchCount > 0 ? stat.clickCount / stat.searchCount : 0;

      await db.insert(searchSuggestions).values({
        query: stat.query,
        type: 'search',
        searchCount: stat.searchCount,
        clickCount: stat.clickCount,
        resultCount: Math.round(Number(stat.resultCount) || 0),
        averageClickThroughRate: ctr,
        lastSearched: stat.lastSearched,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: searchSuggestions.query,
        set: {
          searchCount: stat.searchCount,
          clickCount: stat.clickCount,
          resultCount: Math.round(Number(stat.resultCount) || 0),
          averageClickThroughRate: ctr,
          lastSearched: stat.lastSearched,
          updatedAt: new Date(),
        }
      });
    }
  }

  // Generate daily search analytics aggregates
  static async generateDailyAggregates(date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const analytics = await this.getSearchAnalytics(startOfDay, endOfDay);

    // Insert daily aggregate
    await db.insert(searchAnalytics).values({
      date: startOfDay.toISOString().split('T')[0],
      totalSearches: analytics.totalSearches,
      uniqueUsers: analytics.uniqueUsers,
      uniqueQueries: analytics.uniqueQueries,
      averageResultCount: analytics.averageResultCount,
      zeroResultSearches: analytics.zeroResultSearches,
      totalClicks: analytics.totalClicks,
      clickThroughRate: analytics.clickThroughRate,
      averagePosition: analytics.averagePosition,
      topQueries: analytics.topQueries,
      topFilters: {}, // TODO: Extract filter usage statistics
    })
    .onConflictDoUpdate({
      target: [searchAnalytics.date, searchAnalytics.hour],
      set: {
        totalSearches: analytics.totalSearches,
        uniqueUsers: analytics.uniqueUsers,
        uniqueQueries: analytics.uniqueQueries,
        averageResultCount: analytics.averageResultCount,
        zeroResultSearches: analytics.zeroResultSearches,
        totalClicks: analytics.totalClicks,
        clickThroughRate: analytics.clickThroughRate,
        averagePosition: analytics.averagePosition,
        topQueries: analytics.topQueries,
        calculatedAt: new Date(),
      }
    });
  }

  // Identify content gaps based on zero-result searches
  static async identifyContentGaps(
    startDate: Date, 
    endDate: Date,
    minSearchCount = 5
  ): Promise<Array<{
    query: string;
    searchCount: number;
    suggestedContent: string[];
  }>> {
    const zeroResultQueries = await db.select({
      query: searchHistory.query,
      searchCount: count(),
    })
    .from(searchHistory)
    .where(and(
      gte(searchHistory.searchedAt, startDate.toISOString()),
      lte(searchHistory.searchedAt, endDate),
      eq(searchHistory.resultCount, 0)
    ))
    .groupBy(searchHistory.query)
    .having(sql`COUNT(*) >= ${minSearchCount}`)
    .orderBy(desc(count()));

    // Analyze queries to suggest content types
    return zeroResultQueries.map(q => ({
      query: q.query,
      searchCount: q.searchCount,
      suggestedContent: this.analyzeMissingContent(q.query)
    }));
  }

  // Analyze what type of content might be missing
  private static analyzeMissingContent(query: string): string[] {
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Genre suggestions
    const genres = ['drama', 'comedy', 'thriller', 'horror', 'sci-fi', 'fantasy', 'documentary', 'animation', 'action', 'romance'];
    if (genres.some(genre => lowerQuery.includes(genre))) {
      suggestions.push(`More ${lowerQuery} content`);
    }

    // Format suggestions
    if (lowerQuery.includes('series') || lowerQuery.includes('tv')) {
      suggestions.push('TV series content');
    }
    if (lowerQuery.includes('short')) {
      suggestions.push('Short film content');
    }
    if (lowerQuery.includes('feature')) {
      suggestions.push('Feature film content');
    }

    // Budget-related
    if (lowerQuery.includes('low budget') || lowerQuery.includes('micro budget')) {
      suggestions.push('Low budget productions');
    }
    if (lowerQuery.includes('high budget') || lowerQuery.includes('big budget')) {
      suggestions.push('High budget productions');
    }

    // Geographic
    if (lowerQuery.includes('international') || lowerQuery.includes('foreign')) {
      suggestions.push('International content');
    }

    // Default suggestion
    if (suggestions.length === 0) {
      suggestions.push('General content matching this search term');
    }

    return suggestions;
  }

  // Get search performance over time
  static async getSearchPerformanceOverTime(
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Array<{
    period: string;
    searches: number;
    clicks: number;
    ctr: number;
    avgResultCount: number;
    uniqueUsers: number;
  }>> {
    let dateFormat: string;
    switch (granularity) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD HH24:00:00';
        break;
      case 'week':
        dateFormat = 'IYYY-"W"IW';
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
    }

    const results = await db.select({
      period: sql<string>`TO_CHAR(${searchHistory.searchedAt}, '${dateFormat}')`,
      searches: count(searchHistory.id),
      clicks: sql<number>`COUNT(${searchClickTracking.id})`,
      avgResultCount: sql<number>`AVG(${searchHistory.resultCount})`,
      uniqueUsers: sql<number>`COUNT(DISTINCT ${searchHistory.userId})`,
    })
    .from(searchHistory)
    .leftJoin(searchClickTracking, eq(searchClickTracking.searchHistoryId, searchHistory.id))
    .where(and(
      gte(searchHistory.searchedAt, startDate.toISOString()),
      lte(searchHistory.searchedAt, endDate)
    ))
    .groupBy(sql`TO_CHAR(${searchHistory.searchedAt}, '${dateFormat}')`)
    .orderBy(sql`TO_CHAR(${searchHistory.searchedAt}, '${dateFormat}')`);

    return results.map(r => ({
      period: r.period,
      searches: r.searches,
      clicks: r.clicks,
      ctr: r.searches > 0 ? (r.clicks / r.searches) * 100 : 0,
      avgResultCount: Number(r.avgResultCount) || 0,
      uniqueUsers: r.uniqueUsers
    }));
  }

  // Track search abandonment (searches without clicks)
  static async getSearchAbandonmentRate(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSearches: number;
    searchesWithClicks: number;
    searchesWithoutClicks: number;
    abandonmentRate: number;
    topAbandonedQueries: Array<{
      query: string;
      searches: number;
      abandonmentRate: number;
    }>;
  }> {
    const results = await db.select({
      totalSearches: count(searchHistory.id),
      searchesWithClicks: sql<number>`COUNT(${searchClickTracking.id})`,
    })
    .from(searchHistory)
    .leftJoin(searchClickTracking, eq(searchClickTracking.searchHistoryId, searchHistory.id))
    .where(and(
      gte(searchHistory.searchedAt, startDate.toISOString()),
      lte(searchHistory.searchedAt, endDate)
    ));

    const stats = results[0];
    const searchesWithoutClicks = stats.totalSearches - stats.searchesWithClicks;
    const abandonmentRate = stats.totalSearches > 0 
      ? (searchesWithoutClicks / stats.totalSearches) * 100 
      : 0;

    // Get top abandoned queries
    const abandonedQueries = await db.select({
      query: searchHistory.query,
      totalSearches: count(searchHistory.id),
      clickedSearches: sql<number>`COUNT(${searchClickTracking.id})`,
    })
    .from(searchHistory)
    .leftJoin(searchClickTracking, eq(searchClickTracking.searchHistoryId, searchHistory.id))
    .where(and(
      gte(searchHistory.searchedAt, startDate.toISOString()),
      lte(searchHistory.searchedAt, endDate)
    ))
    .groupBy(searchHistory.query)
    .having(sql`COUNT(${searchHistory.id}) >= 10`) // At least 10 searches
    .orderBy(sql`(COUNT(${searchHistory.id}) - COUNT(${searchClickTracking.id})) DESC`)
    .limit(20);

    const topAbandonedQueries = abandonedQueries.map(q => ({
      query: q.query,
      searches: q.totalSearches,
      abandonmentRate: q.totalSearches > 0 
        ? ((q.totalSearches - q.clickedSearches) / q.totalSearches) * 100 
        : 0
    }));

    return {
      totalSearches: stats.totalSearches,
      searchesWithClicks: stats.searchesWithClicks,
      searchesWithoutClicks,
      abandonmentRate,
      topAbandonedQueries
    };
  }
}