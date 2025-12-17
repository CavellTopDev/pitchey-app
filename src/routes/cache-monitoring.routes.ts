/**
 * Cache Monitoring Routes - Endpoints to verify and monitor cache performance
 */

import { EdgeCacheV2 } from '../utils/edge-cache-optimized-v2';
import { CacheWarmingService } from '../services/cache-warming.service';

export interface CacheMonitoringEnv {
  KV: KVNamespace;
}

/**
 * Get comprehensive cache statistics and health
 */
export async function handleCacheStats(request: Request, env: CacheMonitoringEnv): Promise<Response> {
  try {
    const cache = new EdgeCacheV2(env.KV);
    const stats = cache.getStats();
    
    const health = {
      status: stats.hitRate > 50 ? 'healthy' : stats.hitRate > 20 ? 'warning' : 'critical',
      hit_rate_target: 80,
      current_hit_rate: stats.hitRate,
      performance_grade: stats.hitRate > 80 ? 'A' : stats.hitRate > 60 ? 'B' : stats.hitRate > 40 ? 'C' : stats.hitRate > 20 ? 'D' : 'F'
    };

    return new Response(JSON.stringify({
      success: true,
      data: {
        stats,
        health,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Cache stats error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get cache statistics'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Test cache functionality with a specific endpoint
 */
export async function handleCacheTest(request: Request, env: CacheMonitoringEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const testEndpoint = url.searchParams.get('endpoint') || 'test/cache-verification';
    const testData = {
      test: true,
      timestamp: Date.now(),
      random: Math.random(),
      message: 'Cache test data'
    };

    const cache = new EdgeCacheV2(env.KV);
    
    // Test Set operation
    const setStart = Date.now();
    const setSuccess = await cache.set(testEndpoint, testData, 60); // 1 minute TTL for test
    const setDuration = Date.now() - setStart;
    
    // Test Get operation
    const getStart = Date.now();
    const retrieved = await cache.get(testEndpoint);
    const getDuration = Date.now() - getStart;
    
    // Verify data integrity
    const dataMatches = retrieved && 
      retrieved.test === testData.test && 
      retrieved.timestamp === testData.timestamp &&
      retrieved.random === testData.random;

    const testResults = {
      endpoint: testEndpoint,
      set_operation: {
        success: setSuccess,
        duration_ms: setDuration
      },
      get_operation: {
        success: !!retrieved,
        duration_ms: getDuration,
        data_integrity: dataMatches
      },
      overall_success: setSuccess && !!retrieved && dataMatches,
      cache_stats: cache.getStats()
    };

    return new Response(JSON.stringify({
      success: true,
      data: testResults
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('Cache test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Cache test failed',
      details: error instanceof Error ? error.message : String(error)
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Trigger cache warming manually
 */
export async function handleCacheWarm(request: Request, env: CacheMonitoringEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'high'; // 'high' or 'full'
    
    const cache = new EdgeCacheV2(env.KV);
    const warmingService = new CacheWarmingService(cache, env);
    
    let results;
    if (mode === 'full') {
      results = await warmingService.warmFullCache();
    } else {
      results = await warmingService.warmHighPriorityCache();
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        warming_mode: mode,
        summary: {
          total: results.length,
          successful,
          failed,
          success_rate: results.length > 0 ? (successful / results.length * 100).toFixed(1) + '%' : '0%'
        },
        results,
        cache_stats: cache.getStats(),
        timestamp: new Date().toISOString()
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('Cache warming error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Cache warming failed',
      details: error instanceof Error ? error.message : String(error)
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get detailed cache performance report
 */
export async function handleCacheReport(request: Request, env: CacheMonitoringEnv): Promise<Response> {
  try {
    const cache = new EdgeCacheV2(env.KV);
    const stats = cache.getStats();
    
    // Performance analysis
    const performance = {
      hit_rate: stats.hitRate,
      hit_rate_grade: stats.hitRate > 80 ? 'Excellent' : 
                     stats.hitRate > 60 ? 'Good' : 
                     stats.hitRate > 40 ? 'Fair' : 
                     stats.hitRate > 20 ? 'Poor' : 'Critical',
      total_requests: stats.totalRequests,
      cache_hits: stats.hits,
      cache_misses: stats.misses,
      cache_errors: stats.errors,
      error_rate: stats.totalRequests > 0 ? (stats.errors / stats.totalRequests * 100).toFixed(2) + '%' : '0%'
    };
    
    // Recommendations based on performance
    const recommendations = [];
    
    if (stats.hitRate < 50) {
      recommendations.push('Cache hit rate is below 50%. Consider implementing cache warming.');
    }
    
    if (stats.errors > stats.hits * 0.1) {
      recommendations.push('High error rate detected. Check KV namespace configuration.');
    }
    
    if (stats.totalRequests < 10) {
      recommendations.push('Low request volume. Cache benefits may not be apparent yet.');
    }
    
    if (stats.hitRate > 80) {
      recommendations.push('Excellent cache performance! Consider expanding cache coverage.');
    }

    // Cache health indicators
    const health = {
      overall_health: stats.hitRate > 60 && stats.errors < stats.hits * 0.1 ? 'Healthy' : 'Needs Attention',
      kv_connectivity: 'Connected', // If we got this far, KV is working
      cache_efficiency: stats.hitRate > 70 ? 'High' : stats.hitRate > 40 ? 'Medium' : 'Low'
    };

    return new Response(JSON.stringify({
      success: true,
      data: {
        performance,
        health,
        recommendations,
        detailed_stats: stats,
        report_timestamp: new Date().toISOString(),
        target_metrics: {
          target_hit_rate: 80,
          acceptable_hit_rate: 60,
          maximum_error_rate: 5
        }
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('Cache report error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to generate cache report',
      details: error instanceof Error ? error.message : String(error)
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Reset cache statistics (for testing)
 */
export async function handleCacheReset(request: Request, env: CacheMonitoringEnv): Promise<Response> {
  try {
    const cache = new EdgeCacheV2(env.KV);
    const oldStats = cache.getStats();
    
    cache.resetStats();
    const newStats = cache.getStats();
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Cache statistics reset successfully',
        old_stats: oldStats,
        new_stats: newStats,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('Cache reset error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to reset cache statistics'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Route handler for all cache monitoring endpoints
 */
export async function handleCacheMonitoringRoutes(request: Request, env: CacheMonitoringEnv, path: string): Promise<Response | null> {
  // Only handle cache monitoring routes
  if (!path.startsWith('/api/cache/')) {
    return null;
  }

  const route = path.replace('/api/cache/', '');
  
  switch (route) {
    case 'stats':
      return handleCacheStats(request, env);
      
    case 'test':
      return handleCacheTest(request, env);
      
    case 'warm':
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      return handleCacheWarm(request, env);
      
    case 'report':
      return handleCacheReport(request, env);
      
    case 'reset':
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      return handleCacheReset(request, env);
      
    default:
      return new Response(JSON.stringify({
        success: false,
        error: 'Cache monitoring endpoint not found',
        available_endpoints: [
          'GET /api/cache/stats',
          'GET /api/cache/test',
          'POST /api/cache/warm',
          'GET /api/cache/report',
          'POST /api/cache/reset'
        ]
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}