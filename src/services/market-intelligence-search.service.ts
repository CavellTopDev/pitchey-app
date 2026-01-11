/**
 * Market Intelligence Search Service
 * Integrates search functionality with AI-powered market analysis and intelligence
 */

import { redis } from '../lib/redis';
import { sql } from '../lib/db';

export interface MarketTrend {
  id: string;
  keyword: string;
  category: string;
  trendScore: number;
  growthRate: number;
  searchVolume: number;
  competitionLevel: 'low' | 'medium' | 'high';
  seasonality?: {
    peak_months: number[];
    low_months: number[];
  };
  related_keywords: string[];
  market_size_estimate: number;
  created_at: Date;
}

export interface MarketInsight {
  trend: string;
  relevance_score: number;
  market_opportunity: number;
  competition_analysis: {
    similar_pitches_count: number;
    funding_success_rate: number;
    avg_funding_amount: number;
  };
  recommendations: string[];
  risk_factors: string[];
  potential_investors: string[];
}

export interface SearchMarketContext {
  trending_genres: string[];
  emerging_themes: string[];
  market_gaps: string[];
  investor_interests: Record<string, number>;
  seasonal_factors: {
    current_season_boost: number;
    upcoming_trends: string[];
  };
}

export class MarketIntelligenceSearchService {
  private static instance: MarketIntelligenceSearchService;
  private cachePrefix = 'market_intelligence:';
  private cacheTTL = 3600; // 1 hour

  private constructor() {}

  public static getInstance(): MarketIntelligenceSearchService {
    if (!MarketIntelligenceSearchService.instance) {
      MarketIntelligenceSearchService.instance = new MarketIntelligenceSearchService();
    }
    return MarketIntelligenceSearchService.instance;
  }

  /**
   * Get current market trends relevant to search query
   */
  async getMarketTrends(query: string, limit: number = 10): Promise<MarketTrend[]> {
    const cacheKey = `${this.cachePrefix}trends:${query.toLowerCase()}`;
    
    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Redis cache miss for market trends:', error);
    }

    try {
      // Generate market trends based on search patterns and pitch data
      const trends = await sql`
        WITH search_patterns AS (
          SELECT 
            unnest(string_to_array(lower($1), ' ')) as keyword,
            COUNT(*) as frequency
          FROM search_analytics
          WHERE created_at > NOW() - INTERVAL '30 days'
          GROUP BY keyword
        ),
        pitch_analysis AS (
          SELECT 
            p.genre,
            p.budget_range,
            COUNT(*) as pitch_count,
            AVG(CASE WHEN i.status = 'funded' THEN i.amount ELSE 0 END) as avg_funding,
            COUNT(CASE WHEN i.status = 'funded' THEN 1 END)::float / COUNT(*)::float as success_rate
          FROM pitches p
          LEFT JOIN investments i ON i.pitch_id = p.id
          WHERE p.created_at > NOW() - INTERVAL '90 days'
          GROUP BY p.genre, p.budget_range
        )
        SELECT 
          gen_random_uuid() as id,
          sp.keyword,
          COALESCE(pa.genre, 'general') as category,
          LEAST(sp.frequency * 0.1 + COALESCE(pa.success_rate, 0) * 50, 100) as trend_score,
          CASE 
            WHEN sp.frequency > LAG(sp.frequency) OVER (ORDER BY sp.keyword) 
            THEN (sp.frequency::float / LAG(sp.frequency) OVER (ORDER BY sp.keyword) - 1) * 100
            ELSE 0 
          END as growth_rate,
          sp.frequency as search_volume,
          CASE 
            WHEN pa.pitch_count > 20 THEN 'high'
            WHEN pa.pitch_count > 5 THEN 'medium'
            ELSE 'low'
          END as competition_level,
          ARRAY[sp.keyword] as related_keywords,
          COALESCE(pa.avg_funding * pa.pitch_count, 1000000) as market_size_estimate,
          NOW() as created_at
        FROM search_patterns sp
        LEFT JOIN pitch_analysis pa ON LOWER(pa.genre) LIKE '%' || sp.keyword || '%'
        WHERE sp.frequency > 1
        ORDER BY trend_score DESC
        LIMIT $2
      ` as any[];

      const marketTrends: MarketTrend[] = trends.map(row => ({
        id: row.id,
        keyword: row.keyword,
        category: row.category,
        trendScore: parseFloat(row.trend_score) || 0,
        growthRate: parseFloat(row.growth_rate) || 0,
        searchVolume: parseInt(row.search_volume) || 0,
        competitionLevel: row.competition_level || 'medium',
        related_keywords: row.related_keywords || [],
        market_size_estimate: parseFloat(row.market_size_estimate) || 0,
        created_at: new Date(row.created_at)
      }));

      // Cache the results
      try {
        await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(marketTrends));
      } catch (error) {
        console.warn('Failed to cache market trends:', error);
      }

      return marketTrends;
    } catch (error) {
      console.error('Error fetching market trends:', error);
      return [];
    }
  }

  /**
   * Generate AI-powered market insights for a search query
   */
  async generateMarketInsights(query: string, searchResults: any[]): Promise<MarketInsight[]> {
    const cacheKey = `${this.cachePrefix}insights:${query.toLowerCase()}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Redis cache miss for market insights:', error);
    }

    try {
      // Analyze market data and generate insights
      const marketData = await sql`
        WITH query_analysis AS (
          SELECT 
            $1 as search_query,
            string_to_array(lower($1), ' ') as keywords
        ),
        competitive_analysis AS (
          SELECT 
            COUNT(*) as similar_pitches,
            AVG(CASE WHEN i.status = 'funded' THEN 1.0 ELSE 0.0 END) as funding_rate,
            AVG(CASE WHEN i.status = 'funded' THEN i.amount ELSE NULL END) as avg_funding
          FROM pitches p
          LEFT JOIN investments i ON i.pitch_id = p.id
          CROSS JOIN query_analysis qa
          WHERE p.search_vector @@ plainto_tsquery(qa.search_query)
        ),
        investor_interest AS (
          SELECT 
            u.id as investor_id,
            u.email,
            COUNT(sa.query) as search_count,
            MAX(sa.created_at) as last_search
          FROM search_analytics sa
          JOIN users u ON u.id = sa.user_id
          CROSS JOIN query_analysis qa
          WHERE u.role = 'investor' 
            AND EXISTS (
              SELECT 1 FROM unnest(qa.keywords) k 
              WHERE sa.query ILIKE '%' || k || '%'
            )
          GROUP BY u.id, u.email
          ORDER BY search_count DESC
          LIMIT 5
        )
        SELECT 
          qa.search_query as trend,
          LEAST((ca.similar_pitches::float / 100) * 50 + ca.funding_rate * 50, 100) as relevance_score,
          CASE 
            WHEN ca.similar_pitches < 5 THEN 85
            WHEN ca.similar_pitches < 20 THEN 60
            ELSE 30
          END as market_opportunity,
          ca.similar_pitches,
          COALESCE(ca.funding_rate, 0) as funding_success_rate,
          COALESCE(ca.avg_funding, 0) as avg_funding_amount,
          COALESCE(array_agg(ii.email), ARRAY[]::text[]) as potential_investors
        FROM query_analysis qa
        CROSS JOIN competitive_analysis ca
        LEFT JOIN investor_interest ii ON true
        GROUP BY qa.search_query, ca.similar_pitches, ca.funding_rate, ca.avg_funding
      `;

      const insights: MarketInsight[] = marketData.map(row => {
        const competitionLevel = row.similar_pitches > 20 ? 'high' : row.similar_pitches > 5 ? 'medium' : 'low';
        
        return {
          trend: row.trend,
          relevance_score: parseFloat(row.relevance_score) || 0,
          market_opportunity: parseFloat(row.market_opportunity) || 0,
          competition_analysis: {
            similar_pitches_count: parseInt(row.similar_pitches) || 0,
            funding_success_rate: parseFloat(row.funding_success_rate) || 0,
            avg_funding_amount: parseFloat(row.avg_funding_amount) || 0
          },
          recommendations: this.generateRecommendations(competitionLevel, row.funding_success_rate),
          risk_factors: this.generateRiskFactors(competitionLevel, row.similar_pitches),
          potential_investors: row.potential_investors || []
        };
      });

      // Cache the insights
      try {
        await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(insights));
      } catch (error) {
        console.warn('Failed to cache market insights:', error);
      }

      return insights;
    } catch (error) {
      console.error('Error generating market insights:', error);
      return [];
    }
  }

  /**
   * Get search context based on current market conditions
   */
  async getSearchMarketContext(): Promise<SearchMarketContext> {
    const cacheKey = `${this.cachePrefix}context:current`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Redis cache miss for search context:', error);
    }

    try {
      // Analyze current market conditions
      const contextData = await sql`
        WITH trending_analysis AS (
          SELECT 
            p.genre,
            COUNT(*) as pitch_count,
            AVG(CASE WHEN i.status = 'funded' THEN 1.0 ELSE 0.0 END) as success_rate,
            ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as popularity_rank
          FROM pitches p
          LEFT JOIN investments i ON i.pitch_id = p.id
          WHERE p.created_at > NOW() - INTERVAL '30 days'
          GROUP BY p.genre
        ),
        search_trends AS (
          SELECT 
            query,
            COUNT(*) as search_count,
            ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as search_rank
          FROM search_analytics
          WHERE created_at > NOW() - INTERVAL '7 days'
          GROUP BY query
        ),
        investor_activity AS (
          SELECT 
            p.genre,
            COUNT(DISTINCT i.investor_id) as active_investors,
            AVG(i.amount) as avg_interest
          FROM investments i
          JOIN pitches p ON p.id = i.pitch_id
          WHERE i.created_at > NOW() - INTERVAL '30 days'
          GROUP BY p.genre
        )
        SELECT 
          json_build_object(
            'trending_genres', COALESCE((
              SELECT array_agg(genre) 
              FROM trending_analysis 
              WHERE popularity_rank <= 5 AND success_rate > 0.1
            ), ARRAY[]::text[]),
            'emerging_themes', COALESCE((
              SELECT array_agg(query)
              FROM search_trends
              WHERE search_rank <= 10 AND query NOT IN (
                SELECT genre FROM trending_analysis WHERE popularity_rank <= 5
              )
            ), ARRAY[]::text[]),
            'market_gaps', COALESCE((
              SELECT array_agg(genre)
              FROM trending_analysis
              WHERE pitch_count < 3 AND success_rate > 0.5
            ), ARRAY[]::text[]),
            'investor_interests', COALESCE((
              SELECT json_object_agg(genre, active_investors)
              FROM investor_activity
              WHERE active_investors > 0
            ), '{}'::json),
            'seasonal_factors', json_build_object(
              'current_season_boost', 
              CASE EXTRACT(MONTH FROM NOW())
                WHEN 1 THEN 1.2  -- January: New Year projects
                WHEN 10 THEN 1.3 -- October: Holiday content prep
                WHEN 11 THEN 1.1 -- November: Awards season prep
                ELSE 1.0
              END,
              'upcoming_trends', ARRAY['holiday', 'awards-season', 'summer-blockbuster']
            )
          ) as context_data
      `;

      const context: SearchMarketContext = contextData[0]?.context_data || {
        trending_genres: [],
        emerging_themes: [],
        market_gaps: [],
        investor_interests: {},
        seasonal_factors: {
          current_season_boost: 1.0,
          upcoming_trends: []
        }
      };

      // Cache the context
      try {
        await redis.setex(cacheKey, 1800, JSON.stringify(context)); // 30 minute cache
      } catch (error) {
        console.warn('Failed to cache search context:', error);
      }

      return context;
    } catch (error) {
      console.error('Error getting search market context:', error);
      return {
        trending_genres: [],
        emerging_themes: [],
        market_gaps: [],
        investor_interests: {},
        seasonal_factors: {
          current_season_boost: 1.0,
          upcoming_trends: []
        }
      };
    }
  }

  /**
   * Enhance search results with market intelligence
   */
  async enhanceSearchResults(results: any[], query: string): Promise<any[]> {
    try {
      const [trends, insights, context] = await Promise.all([
        this.getMarketTrends(query, 5),
        this.generateMarketInsights(query, results),
        this.getSearchMarketContext()
      ]);

      return results.map(result => {
        // Find relevant trends for this result
        const relevantTrends = trends.filter(trend =>
          result.genre?.toLowerCase().includes(trend.keyword.toLowerCase()) ||
          result.title?.toLowerCase().includes(trend.keyword.toLowerCase()) ||
          result.description?.toLowerCase().includes(trend.keyword.toLowerCase())
        );

        // Calculate market boost based on trends
        const marketBoost = relevantTrends.reduce((boost, trend) => {
          return boost + (trend.trendScore / 100) * 0.1;
        }, 0);

        // Apply seasonal boost
        const seasonalBoost = context.seasonal_factors.current_season_boost - 1;

        return {
          ...result,
          market_intelligence: {
            trend_score: relevantTrends.length > 0 ? Math.max(...relevantTrends.map(t => t.trendScore)) : 0,
            market_opportunity: insights[0]?.market_opportunity || 0,
            competition_level: relevantTrends[0]?.competitionLevel || 'medium',
            relevant_trends: relevantTrends.map(t => t.keyword),
            seasonal_boost: seasonalBoost,
            investor_interest: context.investor_interests[result.genre] || 0,
            recommendations: insights[0]?.recommendations || []
          },
          // Boost relevance score with market intelligence
          relevance_score: (result.relevance_score || 0) + marketBoost + seasonalBoost
        };
      });
    } catch (error) {
      console.error('Error enhancing search results with market intelligence:', error);
      return results; // Return original results if enhancement fails
    }
  }

  /**
   * Generate personalized recommendations based on market data
   */
  private generateRecommendations(competitionLevel: string, successRate: number): string[] {
    const recommendations: string[] = [];

    if (competitionLevel === 'low') {
      recommendations.push('Consider this niche - low competition with good potential');
      recommendations.push('Early market entry opportunity identified');
    } else if (competitionLevel === 'high') {
      recommendations.push('High competition - differentiation strategy needed');
      recommendations.push('Consider unique angle or underserved sub-market');
    }

    if (successRate > 0.7) {
      recommendations.push('High success rate in this category - good investment potential');
    } else if (successRate < 0.3) {
      recommendations.push('Lower success rate - consider market validation first');
    }

    recommendations.push('Monitor trending keywords for timing optimization');
    recommendations.push('Consider seasonal factors for release planning');

    return recommendations;
  }

  /**
   * Generate risk factors based on market analysis
   */
  private generateRiskFactors(competitionLevel: string, similarPitches: number): string[] {
    const risks: string[] = [];

    if (competitionLevel === 'high') {
      risks.push('High market saturation');
      risks.push('Increased marketing costs due to competition');
    }

    if (similarPitches > 50) {
      risks.push('Oversaturated market segment');
    } else if (similarPitches < 2) {
      risks.push('Unproven market demand');
    }

    risks.push('Market trend volatility');
    risks.push('Seasonal demand fluctuations');

    return risks;
  }

  /**
   * Clear cache for testing or forced refresh
   */
  async clearCache(pattern?: string): Promise<void> {
    try {
      const searchPattern = pattern ? `${this.cachePrefix}${pattern}*` : `${this.cachePrefix}*`;
      const keys = await redis.keys(searchPattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.warn('Failed to clear market intelligence cache:', error);
    }
  }
}

export const marketIntelligenceSearchService = MarketIntelligenceSearchService.getInstance();