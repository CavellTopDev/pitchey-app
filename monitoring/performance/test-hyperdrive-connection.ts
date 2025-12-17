/**
 * Hyperdrive Connection Test Script
 * Tests both direct connection and Hyperdrive connectivity
 * Run with: wrangler dev --test-scheduled
 */

import { neon } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL: string;
  HYPERDRIVE?: Hyperdrive;
}

interface Hyperdrive {
  prepare(sql: string): {
    bind(...params: any[]): {
      run(): Promise<any>;
      all(): Promise<any>;
      first(): Promise<any>;
    };
  };
}

interface TestResult {
  method: string;
  success: boolean;
  responseTime: number;
  error?: string;
  connectionInfo?: any;
}

/**
 * Test direct Neon connection (current approach)
 */
async function testDirectConnection(env: Env): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('🔗 Testing direct Neon connection...');
    
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL not available');
    }
    
    const sql = neon(env.DATABASE_URL, {
      fullResults: true,
      arrayMode: false,
    });
    
    // Simple health check query
    const result = await sql`SELECT 
      1 as health_check, 
      current_timestamp as server_time,
      version() as pg_version
    `;
    
    const responseTime = Date.now() - startTime;
    
    return {
      method: 'direct_neon',
      success: true,
      responseTime,
      connectionInfo: {
        rows: result.length,
        serverTime: result[0]?.server_time,
        pgVersion: result[0]?.pg_version?.substring(0, 50) + '...'
      }
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('❌ Direct connection failed:', error);
    
    return {
      method: 'direct_neon',
      success: false,
      responseTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test Hyperdrive connection (target approach)
 */
async function testHyperdriveConnection(env: Env): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('⚡ Testing Hyperdrive connection...');
    
    if (!env.HYPERDRIVE) {
      throw new Error('HYPERDRIVE binding not available');
    }
    
    // Test basic connectivity
    const stmt = env.HYPERDRIVE.prepare(`
      SELECT 
        1 as health_check, 
        current_timestamp as server_time,
        version() as pg_version
    `);
    
    const result = await stmt.all();
    const responseTime = Date.now() - startTime;
    
    return {
      method: 'hyperdrive',
      success: true,
      responseTime,
      connectionInfo: {
        rows: result.results?.length || 0,
        serverTime: result.results?.[0]?.server_time,
        pgVersion: result.results?.[0]?.pg_version?.substring(0, 50) + '...',
        meta: result.meta
      }
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('❌ Hyperdrive connection failed:', error);
    
    return {
      method: 'hyperdrive',
      success: false,
      responseTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test complex query performance
 */
async function testComplexQuery(env: Env, useHyperdrive: boolean): Promise<TestResult> {
  const startTime = Date.now();
  const method = useHyperdrive ? 'hyperdrive_complex' : 'direct_complex';
  
  try {
    console.log(`🧪 Testing complex query with ${useHyperdrive ? 'Hyperdrive' : 'direct connection'}...`);
    
    const complexQuery = `
      WITH user_stats AS (
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_users
        FROM users
      ),
      pitch_stats AS (
        SELECT 
          COUNT(*) as total_pitches,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_pitches
        FROM pitches
      )
      SELECT 
        u.total_users,
        u.recent_users,
        p.total_pitches,
        p.active_pitches,
        CURRENT_TIMESTAMP as query_time
      FROM user_stats u
      CROSS JOIN pitch_stats p
    `;
    
    let result: any;
    
    if (useHyperdrive && env.HYPERDRIVE) {
      const stmt = env.HYPERDRIVE.prepare(complexQuery);
      result = await stmt.all();
    } else if (!useHyperdrive && env.DATABASE_URL) {
      const sql = neon(env.DATABASE_URL);
      result = await sql(complexQuery);
    } else {
      throw new Error('Required connection method not available');
    }
    
    const responseTime = Date.now() - startTime;
    
    return {
      method,
      success: true,
      responseTime,
      connectionInfo: {
        resultType: useHyperdrive ? 'hyperdrive_result' : 'neon_result',
        dataLength: Array.isArray(result) ? result.length : (result.results?.length || 0)
      }
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ ${method} failed:`, error);
    
    return {
      method,
      success: false,
      responseTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test concurrent connections
 */
async function testConcurrentConnections(env: Env, useHyperdrive: boolean, concurrency: number = 10): Promise<TestResult> {
  const startTime = Date.now();
  const method = `${useHyperdrive ? 'hyperdrive' : 'direct'}_concurrent_${concurrency}`;
  
  try {
    console.log(`🔀 Testing ${concurrency} concurrent connections with ${useHyperdrive ? 'Hyperdrive' : 'direct'}...`);
    
    const promises = Array.from({ length: concurrency }, async (_, i) => {
      const query = `SELECT ${i + 1} as query_id, pg_backend_pid() as backend_pid, current_timestamp as query_time`;
      
      if (useHyperdrive && env.HYPERDRIVE) {
        const stmt = env.HYPERDRIVE.prepare(query);
        return await stmt.first();
      } else if (!useHyperdrive && env.DATABASE_URL) {
        const sql = neon(env.DATABASE_URL);
        const result = await sql(query);
        return result[0];
      }
      throw new Error('Connection method not available');
    });
    
    const results = await Promise.all(promises);
    const responseTime = Date.now() - startTime;
    
    // Analyze results
    const uniqueBackendPids = new Set(results.map(r => r.backend_pid)).size;
    
    return {
      method,
      success: true,
      responseTime,
      connectionInfo: {
        totalQueries: concurrency,
        successfulQueries: results.length,
        uniqueBackends: uniqueBackendPids,
        avgTimePerQuery: responseTime / concurrency,
        connectionSharing: uniqueBackendPids < concurrency
      }
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ ${method} failed:`, error);
    
    return {
      method,
      success: false,
      responseTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Main test function
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log('🚀 Starting Hyperdrive connectivity tests...');
    
    const results: TestResult[] = [];
    
    try {
      // Test 1: Direct connection
      results.push(await testDirectConnection(env));
      
      // Test 2: Hyperdrive connection
      results.push(await testHyperdriveConnection(env));
      
      // Test 3: Complex queries (both methods)
      results.push(await testComplexQuery(env, false)); // Direct
      results.push(await testComplexQuery(env, true));  // Hyperdrive
      
      // Test 4: Concurrent connections (both methods)
      results.push(await testConcurrentConnections(env, false, 5)); // Direct
      results.push(await testConcurrentConnections(env, true, 5));  // Hyperdrive
      
      // Test 5: Higher concurrency for Hyperdrive
      results.push(await testConcurrentConnections(env, true, 20)); // Hyperdrive high concurrency
      
    } catch (error) {
      console.error('Test suite failed:', error);
      results.push({
        method: 'test_suite',
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Generate summary
    const summary = {
      totalTests: results.length,
      successfulTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length,
      averageResponseTime: results.reduce((sum, r) => sum + r.responseTime, 0) / results.length,
      results: results,
      recommendations: generateRecommendations(results),
      timestamp: new Date().toISOString()
    };
    
    console.log('📊 Test Summary:', JSON.stringify(summary, null, 2));
    
    return new Response(JSON.stringify(summary, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
};

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(results: TestResult[]): string[] {
  const recommendations: string[] = [];
  
  const directResult = results.find(r => r.method === 'direct_neon');
  const hyperdriveResult = results.find(r => r.method === 'hyperdrive');
  
  // Connection availability
  if (!directResult?.success && !hyperdriveResult?.success) {
    recommendations.push('❌ CRITICAL: Both direct and Hyperdrive connections failed. Check network connectivity and credentials.');
  } else if (!hyperdriveResult?.success) {
    recommendations.push('⚠️  Hyperdrive connection failed. Verify binding configuration in wrangler.toml and ensure Hyperdrive ID is correct.');
  } else if (!directResult?.success) {
    recommendations.push('⚠️  Direct connection failed but Hyperdrive works. DATABASE_URL may be misconfigured.');
  }
  
  // Performance comparison
  if (directResult?.success && hyperdriveResult?.success) {
    if (hyperdriveResult.responseTime < directResult.responseTime) {
      recommendations.push('✅ Hyperdrive is faster than direct connection. Recommend migration to Hyperdrive.');
    } else {
      recommendations.push('⚠️  Direct connection is faster. Investigate Hyperdrive configuration or network routing.');
    }
  }
  
  // Complex query performance
  const directComplex = results.find(r => r.method === 'direct_complex');
  const hyperdriveComplex = results.find(r => r.method === 'hyperdrive_complex');
  
  if (directComplex?.success && hyperdriveComplex?.success) {
    const improvement = ((directComplex.responseTime - hyperdriveComplex.responseTime) / directComplex.responseTime) * 100;
    if (improvement > 20) {
      recommendations.push(`🚀 Hyperdrive provides ${improvement.toFixed(1)}% improvement on complex queries.`);
    } else if (improvement < -20) {
      recommendations.push(`⚠️  Direct connection is ${Math.abs(improvement).toFixed(1)}% faster for complex queries.`);
    }
  }
  
  // Concurrency analysis
  const concurrentResults = results.filter(r => r.method.includes('concurrent'));
  for (const result of concurrentResults) {
    if (result.success && result.connectionInfo?.connectionSharing) {
      recommendations.push(`✅ ${result.method}: Connection pooling is working (${result.connectionInfo.uniqueBackends} backends for ${result.connectionInfo.totalQueries} queries).`);
    } else if (result.success) {
      recommendations.push(`⚠️  ${result.method}: No connection pooling detected. Each query uses separate backend.`);
    }
  }
  
  // Overall recommendation
  const hyperdriveHealthy = results.filter(r => r.method.includes('hyperdrive') && r.success).length;
  const directHealthy = results.filter(r => r.method.includes('direct') && r.success).length;
  
  if (hyperdriveHealthy > directHealthy) {
    recommendations.push('🎯 RECOMMENDATION: Migrate to Hyperdrive for better performance and connection pooling.');
  } else if (directHealthy > hyperdriveHealthy) {
    recommendations.push('🔧 RECOMMENDATION: Fix Hyperdrive configuration before migration.');
  } else {
    recommendations.push('⚖️  Both connection methods show similar results. Choose based on deployment strategy.');
  }
  
  return recommendations;
}