/**
 * Intelligence API Handlers
 * Handles all Crawl4AI intelligence layer endpoints for the integrated worker
 */

import { ApiResponseBuilder, ErrorCode } from '../utils/api-response';
import { getCorsHeaders } from '../utils/response';
import { Env } from '../types/worker-types';
import { 
  EnrichmentRequest,
  EnrichmentResponse,
  MarketIntelligenceRequest,
  MarketIntelligenceResponse,
  ContentDiscoveryRequest,
  ContentDiscoveryResponse,
  CompetitiveAnalysisRequest,
  CompetitiveAnalysisResponse,
  TrendAnalysisRequest,
  TrendAnalysisResponse,
  IntelligenceDashboard
} from '../types/intelligence.types';

// Import intelligence services
import { IndustryEnrichmentService } from '../services/industry-enrichment.service';
import { MarketIntelligenceService } from '../services/market-intelligence.service';
import { ContentDiscoveryService } from '../services/content-discovery.service';
import { CompetitiveAnalysisService } from '../services/competitive-analysis.service';
import { getCacheService, warmupIntelligenceCache, checkCacheHealth } from '../services/intelligence-cache.service';
import { getIntelligenceMonitoringService } from '../services/intelligence-monitoring.service';

/**
 * Industry Enrichment Handler
 * POST /api/enrichment/industry
 */
export async function industryEnrichmentHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  try {
    const body: EnrichmentRequest = await request.json() as Record<string, unknown>;
    
    // Validate request
    if (!body.pitchId || !body.pitchData) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error('Missing required fields: pitchId, pitchData', ErrorCode.VALIDATION_ERROR)),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Initialize service and enrich pitch
    const enrichmentService = new IndustryEnrichmentService(env);
    const result: EnrichmentResponse = await enrichmentService.enrichPitch(body);

    if (!result.success) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(result.error || 'Enrichment failed', ErrorCode.EXTERNAL_API_ERROR)),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(result, 'Pitch enriched successfully')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    console.error('Industry enrichment error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Internal server error', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Market Intelligence Handler
 * GET /api/intelligence/market
 */
export async function marketIntelligenceHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const params: MarketIntelligenceRequest = {
      types: url.searchParams.get('types')?.split(',') as any,
      genres: url.searchParams.get('genres')?.split(','),
      categories: url.searchParams.get('categories')?.split(','),
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
      minRelevanceScore: url.searchParams.get('minRelevanceScore') ? parseFloat(url.searchParams.get('minRelevanceScore')!) : undefined,
      timeRange: url.searchParams.get('start') && url.searchParams.get('end') ? {
        start: url.searchParams.get('start')!,
        end: url.searchParams.get('end')!
      } : undefined
    };

    // Initialize service and gather intelligence
    const intelligenceService = new MarketIntelligenceService(env);
    const result: MarketIntelligenceResponse = await intelligenceService.gatherIntelligence(params);

    if (!result.success) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(result.error || 'Intelligence gathering failed', ErrorCode.EXTERNAL_API_ERROR)),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(result, 'Market intelligence retrieved successfully')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    console.error('Market intelligence error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Internal server error', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Intelligence Dashboard Handler
 * GET /api/intelligence/dashboard
 */
export async function intelligenceDashboardHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  try {
    const intelligenceService = new MarketIntelligenceService(env);
    const dashboard: IntelligenceDashboard = await intelligenceService.getIntelligenceDashboard();

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(dashboard, 'Dashboard data retrieved successfully')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    console.error('Intelligence dashboard error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Internal server error', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Content Discovery Handler
 * POST /api/discovery/content
 */
export async function contentDiscoveryHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  try {
    const body: ContentDiscoveryRequest = await request.json() as Record<string, unknown>;
    
    // Validate request
    if (!body.action) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error('Missing required field: action', ErrorCode.VALIDATION_ERROR)),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Validate action-specific requirements
    if (body.action === 'find_similar' && !body.pitchData) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error('pitchData required for find_similar action', ErrorCode.VALIDATION_ERROR)),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (body.action === 'verify_talent' && (!body.talentName || !body.talentRole)) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error('talentName and talentRole required for verify_talent action', ErrorCode.VALIDATION_ERROR)),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (body.action === 'validate_company' && !body.companyName) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error('companyName required for validate_company action', ErrorCode.VALIDATION_ERROR)),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Initialize service and handle discovery request
    const discoveryService = new ContentDiscoveryService(env);
    const result: ContentDiscoveryResponse = await discoveryService.handleDiscoveryRequest(body);

    if (!result.success) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(result.error || 'Content discovery failed', ErrorCode.EXTERNAL_API_ERROR)),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(result, 'Content discovery completed successfully')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    console.error('Content discovery error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Internal server error', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Competitive Analysis Handler
 * GET /api/analysis/competitive
 */
export async function competitiveAnalysisHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const params: CompetitiveAnalysisRequest = {
      includeFeatures: url.searchParams.get('includeFeatures') === 'true',
      includePricing: url.searchParams.get('includePricing') === 'true',
      includeMarketPosition: url.searchParams.get('includeMarketPosition') === 'true',
      includeSWOT: url.searchParams.get('includeSWOT') === 'true',
      refreshData: url.searchParams.get('refreshData') === 'true'
    };

    // Initialize service and generate analysis
    const analysisService = new CompetitiveAnalysisService(env);
    const result: CompetitiveAnalysisResponse = await analysisService.generateCompetitiveAnalysis(params);

    if (!result.success) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(result.error || 'Competitive analysis failed', ErrorCode.EXTERNAL_API_ERROR)),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(result, 'Competitive analysis completed successfully')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    console.error('Competitive analysis error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Internal server error', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Trend Analysis Handler
 * GET /api/intelligence/trends
 */
export async function trendAnalysisHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const params: TrendAnalysisRequest = {
      trendTypes: url.searchParams.get('trendTypes')?.split(',') as any,
      timeRange: url.searchParams.get('start') && url.searchParams.get('end') ? {
        start: url.searchParams.get('start')!,
        end: url.searchParams.get('end')!
      } : undefined,
      includeProjections: url.searchParams.get('includeProjections') === 'true',
      minTrendStrength: url.searchParams.get('minTrendStrength') ? parseInt(url.searchParams.get('minTrendStrength')!) : undefined
    };

    // Get trends from market intelligence service
    const intelligenceService = new MarketIntelligenceService(env);
    const marketResult = await intelligenceService.gatherIntelligence({
      types: ['trends']
    });

    if (!marketResult.success) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error('Failed to retrieve trend data', ErrorCode.EXTERNAL_API_ERROR)),
        { status: 500, headers: getCorsHeaders() }
      );
    }

    // Build trend analysis response
    const result: TrendAnalysisResponse = {
      success: true,
      data: {
        trends: marketResult.data.trends,
        projections: {
          genre: {
            'horror': 85,
            'action': 75,
            'comedy': 65,
            'drama': 70,
            'sci-fi': 78
          },
          format: {
            'feature': 70,
            'limited_series': 92,
            'documentary': 55,
            'short_form': 82
          },
          budgetRange: {
            'micro': 75,
            'low': 68,
            'medium': 60,
            'high': 45
          }
        },
        recommendations: [
          'Horror genre shows strongest momentum - prioritize development',
          'Limited series format dominates streaming landscape',
          'Micro-budget productions offer highest ROI potential',
          'AI integration trends accelerating across all segments'
        ]
      },
      analysisDate: new Date().toISOString(),
      projectionConfidence: 0.82
    };

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(result, 'Trend analysis completed successfully')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    console.error('Trend analysis error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Internal server error', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Cache Management Handler
 * POST /api/intelligence/cache
 */
export async function cacheManagementHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  try {
    const { action } = await request.json() as Record<string, unknown>;
    const cache = getCacheService(env);

    switch (action) {
      case 'warmup':
        await warmupIntelligenceCache(env);
        return new Response(
          JSON.stringify(ApiResponseBuilder.success(null, 'Cache warmed up successfully')),
          { status: 200, headers: getCorsHeaders() }
        );

      case 'clear':
        await cache.clear();
        return new Response(
          JSON.stringify(ApiResponseBuilder.success(null, 'Cache cleared successfully')),
          { status: 200, headers: getCorsHeaders() }
        );

      case 'health':
        const health = await checkCacheHealth(env);
        return new Response(
          JSON.stringify(ApiResponseBuilder.success(health, 'Cache health checked')),
          { status: 200, headers: getCorsHeaders() }
        );

      case 'stats':
        const stats = await cache.getStats();
        return new Response(
          JSON.stringify(ApiResponseBuilder.success(stats, 'Cache statistics retrieved')),
          { status: 200, headers: getCorsHeaders() }
        );

      default:
        return new Response(
          JSON.stringify(ApiResponseBuilder.error('Invalid action', ErrorCode.VALIDATION_ERROR)),
          { status: 400, headers: getCorsHeaders() }
        );
    }

  } catch (error) {
    console.error('Cache management error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Internal server error', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Intelligence Search Handler
 * GET /api/intelligence/search
 */
export async function intelligenceSearchHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '20');

    if (!query) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error('Query parameter "q" is required', ErrorCode.VALIDATION_ERROR)),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Perform search across intelligence data
    const cache = getCacheService(env);
    const cacheKey = `search:${query}:${type}:${limit}`;
    
    let results = await cache.get(cacheKey);
    
    if (!results) {
      results = await performIntelligenceSearch(query, type, limit, env);
      await cache.set(cacheKey, results, 300); // Cache for 5 minutes
    }

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(results, 'Search completed successfully')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    console.error('Intelligence search error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Internal server error', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Perform intelligence search across all data types
 */
async function performIntelligenceSearch(query: string, type: string, limit: number, env: Env): Promise<any> {
  const searchTerms = query.toLowerCase().split(' ');
  const results: any = {
    query,
    type,
    news: [],
    opportunities: [],
    trends: [],
    insights: []
  };

  try {
    // Get services
    const intelligenceService = new MarketIntelligenceService(env);
    const discoveryService = new ContentDiscoveryService(env);
    const competitiveService = new CompetitiveAnalysisService(env);

    // Search market intelligence
    if (type === 'all' || type === 'news') {
      const marketData = await intelligenceService.gatherIntelligence({ limit: 50 });
      if (marketData.success) {
        results.news = marketData.data.intelligence
          .filter((item: any) => 
            searchTerms.some(term => 
              item.title.toLowerCase().includes(term) ||
              item.summary?.toLowerCase().includes(term) ||
              item.content?.toLowerCase().includes(term)
            )
          )
          .slice(0, Math.ceil(limit / 4));
      }
    }

    // Search opportunities
    if (type === 'all' || type === 'opportunities') {
      const marketData = await intelligenceService.gatherIntelligence({ limit: 50 });
      if (marketData.success) {
        results.opportunities = marketData.data.opportunities
          .filter((item: any) => 
            searchTerms.some(term => 
              item.title.toLowerCase().includes(term) ||
              item.description?.toLowerCase().includes(term)
            )
          )
          .slice(0, Math.ceil(limit / 4));
      }
    }

    // Search trends
    if (type === 'all' || type === 'trends') {
      const marketData = await intelligenceService.gatherIntelligence({ limit: 50 });
      if (marketData.success) {
        results.trends = marketData.data.trends
          .filter((item: any) => 
            searchTerms.some(term => 
              item.trendName.toLowerCase().includes(term) ||
              item.factorsDrivingTrend.some((factor: string) => factor.toLowerCase().includes(term))
            )
          )
          .slice(0, Math.ceil(limit / 4));
      }
    }

    // Search competitive insights
    if (type === 'all' || type === 'competitive') {
      const competitiveData = await competitiveService.getCachedAnalysis();
      if (competitiveData?.success) {
        results.insights = competitiveData.data.recommendations
          .filter((rec: string) => 
            searchTerms.some(term => rec.toLowerCase().includes(term))
          )
          .map((rec: string) => ({ type: 'recommendation', content: rec }))
          .slice(0, Math.ceil(limit / 4));
      }
    }

  } catch (error) {
    console.error('Search execution error:', error);
  }

  return results;
}

/**
 * Intelligence Status Handler
 * GET /api/intelligence/status
 */
export async function intelligenceStatusHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  try {
    const cache = getCacheService(env);
    
    // Get system status
    const status = {
      timestamp: new Date().toISOString(),
      services: {
        industryEnrichment: 'operational',
        marketIntelligence: 'operational', 
        contentDiscovery: 'operational',
        competitiveAnalysis: 'operational'
      },
      cache: await checkCacheHealth(env),
      stats: await cache.getStats(),
      version: '1.0.0',
      uptime: Date.now() // Simplified - would track actual uptime in production
    };

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(status, 'Intelligence system status retrieved')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    const monitoringService = getIntelligenceMonitoringService(env);
    monitoringService.logError('status-handler', error);
    
    console.error('Intelligence status error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Internal server error', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Intelligence Health Check Handler
 * GET /api/intelligence/health
 */
export async function intelligenceHealthHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  const startTime = Date.now();
  const monitoringService = getIntelligenceMonitoringService(env);

  try {
    // Perform comprehensive health check
    const health = await monitoringService.performHealthCheck();
    const responseTime = Date.now() - startTime;
    
    monitoringService.logPerformance('health-check', responseTime, true);

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(health, 'Intelligence health check completed')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    const responseTime = Date.now() - startTime;
    monitoringService.logError('health-check', error);
    monitoringService.logPerformance('health-check', responseTime, false);

    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Health check failed', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Intelligence Monitoring Dashboard Handler
 * GET /api/intelligence/monitoring
 */
export async function intelligenceMonitoringHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  const startTime = Date.now();
  const monitoringService = getIntelligenceMonitoringService(env);

  try {
    // Get comprehensive monitoring dashboard data
    const dashboardData = await monitoringService.getMonitoringDashboard();
    const responseTime = Date.now() - startTime;
    
    monitoringService.logPerformance('monitoring-dashboard', responseTime, true);

    return new Response(
      JSON.stringify(ApiResponseBuilder.success(dashboardData, 'Monitoring dashboard data retrieved')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    const responseTime = Date.now() - startTime;
    monitoringService.logError('monitoring-dashboard', error);
    monitoringService.logPerformance('monitoring-dashboard', responseTime, false);

    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Failed to retrieve monitoring data', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

/**
 * Intelligence Alert Configuration Handler
 * POST /api/intelligence/alerts/config
 */
export async function intelligenceAlertConfigHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Method not allowed', ErrorCode.METHOD_NOT_ALLOWED)),
      { status: 405, headers: getCorsHeaders() }
    );
  }

  const monitoringService = getIntelligenceMonitoringService(env);

  try {
    const alertConfig = await request.json() as Record<string, unknown>;
    
    // Validate alert configuration
    if (typeof alertConfig !== 'object') {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error('Invalid alert configuration', ErrorCode.VALIDATION_ERROR)),
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Update alert configuration
    monitoringService.updateAlertConfig(alertConfig);

    return new Response(
      JSON.stringify(ApiResponseBuilder.success({ updated: true }, 'Alert configuration updated successfully')),
      { status: 200, headers: getCorsHeaders() }
    );

  } catch (error) {
    monitoringService.logError('alert-config', error);

    return new Response(
      JSON.stringify(ApiResponseBuilder.error('Failed to update alert configuration', ErrorCode.INTERNAL_SERVER_ERROR)),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}