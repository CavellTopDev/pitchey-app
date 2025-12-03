/**
 * Cache Performance Testing Suite
 * Simulates high load and measures cache effectiveness
 */

import autocannon from 'autocannon';
import { performance } from 'perf_hooks';

// Test configuration
const CONFIG = {
  BASE_URL: process.env.TEST_URL || 'http://localhost:8001',
  DURATION: 60, // seconds
  CONNECTIONS: 100,
  PIPELINING: 10,
  WORKERS: 4,
};

// Test scenarios
const SCENARIOS = {
  // Static content caching
  staticAssets: {
    name: 'Static Assets Caching',
    requests: [
      { path: '/assets/css/main.css', method: 'GET' },
      { path: '/assets/js/app.js', method: 'GET' },
      { path: '/assets/fonts/main.woff2', method: 'GET' },
      { path: '/favicon.ico', method: 'GET' },
    ],
    expectedHitRate: 0.95,
    maxLatency: 50,
  },
  
  // API endpoint caching
  apiEndpoints: {
    name: 'API Endpoint Caching',
    requests: [
      { path: '/api/config', method: 'GET' },
      { path: '/api/pitches?page=1', method: 'GET' },
      { path: '/api/browse?category=action', method: 'GET' },
      { path: '/api/search?q=test', method: 'GET' },
    ],
    expectedHitRate: 0.80,
    maxLatency: 100,
  },
  
  // Dynamic content with cache invalidation
  dynamicContent: {
    name: 'Dynamic Content Caching',
    requests: [
      { path: '/api/user/dashboard', method: 'GET', headers: { 'Authorization': 'Bearer token' } },
      { path: '/api/notifications', method: 'GET', headers: { 'Authorization': 'Bearer token' } },
      { path: '/api/pitches/1', method: 'GET' },
      { path: '/api/pitches/1', method: 'PUT', body: { title: 'Updated' }, invalidates: ['/api/pitches/1'] },
    ],
    expectedHitRate: 0.60,
    maxLatency: 200,
  },
  
  // Cache warming effectiveness
  cacheWarming: {
    name: 'Cache Warming Test',
    warmupKeys: [
      '/api/pitches/trending',
      '/api/config',
      '/api/categories',
    ],
    requests: [
      { path: '/api/pitches/trending', method: 'GET' },
      { path: '/api/config', method: 'GET' },
      { path: '/api/categories', method: 'GET' },
    ],
    expectedHitRate: 0.90,
    maxLatency: 50,
  },
  
  // Predictive prefetching
  predictivePrefetch: {
    name: 'Predictive Prefetch Test',
    sequence: [
      { path: '/api/pitches/1', method: 'GET' },
      { path: '/api/pitches/1/related', method: 'GET', expectedPrefetched: true },
      { path: '/api/pitches/1/characters', method: 'GET', expectedPrefetched: true },
    ],
    expectedHitRate: 0.75,
    maxLatency: 75,
  },
  
  // Cache sharding distribution
  cacheSharding: {
    name: 'Cache Sharding Test',
    requests: Array.from({ length: 1000 }, (_, i) => ({
      path: `/api/test/item-${i}`,
      method: 'GET',
    })),
    checkDistribution: true,
    maxSkew: 0.15, // Max 15% skew in shard distribution
  },
  
  // Concurrent access patterns
  concurrentAccess: {
    name: 'Concurrent Access Test',
    concurrent: true,
    requests: [
      { path: '/api/pitches/popular', method: 'GET', weight: 5 },
      { path: '/api/browse', method: 'GET', weight: 3 },
      { path: '/api/search?q=action', method: 'GET', weight: 2 },
      { path: '/api/user/profile', method: 'GET', weight: 1 },
    ],
    expectedHitRate: 0.70,
    maxLatency: 150,
  },
};

// Cache metrics collector
class CacheMetricsCollector {
  constructor() {
    this.metrics = {
      hits: 0,
      misses: 0,
      writes: 0,
      evictions: 0,
      latencies: [],
      errors: 0,
    };
  }
  
  recordHit(latency) {
    this.metrics.hits++;
    this.metrics.latencies.push(latency);
  }
  
  recordMiss(latency) {
    this.metrics.misses++;
    this.metrics.latencies.push(latency);
  }
  
  recordError() {
    this.metrics.errors++;
  }
  
  getStatistics() {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? this.metrics.hits / total : 0;
    
    const latencies = this.metrics.latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    
    return {
      hitRate,
      totalRequests: total,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      errors: this.metrics.errors,
      latency: {
        p50,
        p95,
        p99,
        avg: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0,
      },
    };
  }
}

// Test runner
async function runScenario(scenario) {
  console.log(`\n🧪 Running: ${scenario.name}`);
  console.log('━'.repeat(50));
  
  const collector = new CacheMetricsCollector();
  
  // Warm cache if specified
  if (scenario.warmupKeys) {
    console.log('📦 Warming cache...');
    for (const key of scenario.warmupKeys) {
      await fetch(`${CONFIG.BASE_URL}${key}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Run load test
  const startTime = performance.now();
  
  const instance = autocannon({
    url: CONFIG.BASE_URL,
    duration: CONFIG.DURATION,
    connections: CONFIG.CONNECTIONS,
    pipelining: CONFIG.PIPELINING,
    workers: CONFIG.WORKERS,
    requests: scenario.requests?.map(req => ({
      method: req.method,
      path: req.path,
      headers: req.headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
    })),
  });
  
  // Track responses
  instance.on('response', (client, statusCode, resBytes, responseTime) => {
    const headers = client.parser.headers;
    const cacheStatus = headers['x-cache-status'] || headers['cf-cache-status'];
    
    if (cacheStatus === 'HIT') {
      collector.recordHit(responseTime);
    } else {
      collector.recordMiss(responseTime);
    }
    
    if (statusCode >= 400) {
      collector.recordError();
    }
  });
  
  // Wait for completion
  await new Promise((resolve) => {
    instance.on('done', resolve);
  });
  
  const duration = (performance.now() - startTime) / 1000;
  
  // Get statistics
  const stats = collector.getStatistics();
  const result = instance.results();
  
  // Display results
  console.log('\n📊 Results:');
  console.log(`  Duration: ${duration.toFixed(2)}s`);
  console.log(`  Total Requests: ${stats.totalRequests}`);
  console.log(`  Requests/sec: ${result.requests.mean.toFixed(2)}`);
  console.log(`  Cache Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
  console.log(`  Cache Hits: ${stats.hits}`);
  console.log(`  Cache Misses: ${stats.misses}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log('\n⏱️  Latency:');
  console.log(`  P50: ${stats.latency.p50.toFixed(2)}ms`);
  console.log(`  P95: ${stats.latency.p95.toFixed(2)}ms`);
  console.log(`  P99: ${stats.latency.p99.toFixed(2)}ms`);
  console.log(`  Average: ${stats.latency.avg.toFixed(2)}ms`);
  console.log('\n📈 Throughput:');
  console.log(`  Bytes/sec: ${result.throughput.mean.toFixed(2)}`);
  
  // Check expectations
  console.log('\n✅ Validation:');
  const passed = [];
  const failed = [];
  
  if (scenario.expectedHitRate) {
    if (stats.hitRate >= scenario.expectedHitRate) {
      passed.push(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}% >= ${(scenario.expectedHitRate * 100)}%`);
    } else {
      failed.push(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}% < ${(scenario.expectedHitRate * 100)}%`);
    }
  }
  
  if (scenario.maxLatency) {
    if (stats.latency.p95 <= scenario.maxLatency) {
      passed.push(`P95 latency: ${stats.latency.p95.toFixed(2)}ms <= ${scenario.maxLatency}ms`);
    } else {
      failed.push(`P95 latency: ${stats.latency.p95.toFixed(2)}ms > ${scenario.maxLatency}ms`);
    }
  }
  
  passed.forEach(p => console.log(`  ✅ ${p}`));
  failed.forEach(f => console.log(`  ❌ ${f}`));
  
  return {
    scenario: scenario.name,
    stats,
    passed: passed.length,
    failed: failed.length,
    success: failed.length === 0,
  };
}

// Shard distribution test
async function testShardDistribution() {
  console.log('\n🧪 Testing Cache Shard Distribution');
  console.log('━'.repeat(50));
  
  const shardCounts = new Map();
  const totalKeys = 10000;
  
  // Generate and hash keys
  for (let i = 0; i < totalKeys; i++) {
    const key = `test-key-${i}`;
    const shard = getShardNumber(key, 10); // 10 shards
    shardCounts.set(shard, (shardCounts.get(shard) || 0) + 1);
  }
  
  // Calculate distribution statistics
  const counts = Array.from(shardCounts.values());
  const expectedPerShard = totalKeys / 10;
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  const skew = (maxCount - minCount) / expectedPerShard;
  
  console.log('\n📊 Shard Distribution:');
  for (const [shard, count] of shardCounts) {
    const percentage = ((count / totalKeys) * 100).toFixed(2);
    const bar = '█'.repeat(Math.floor(count / 100));
    console.log(`  Shard ${shard}: ${count} (${percentage}%) ${bar}`);
  }
  
  console.log(`\n  Max skew: ${(skew * 100).toFixed(2)}%`);
  console.log(`  ${skew < 0.15 ? '✅' : '❌'} Distribution is ${skew < 0.15 ? 'balanced' : 'skewed'}`);
  
  return skew < 0.15;
}

// Helper function to calculate shard
function getShardNumber(key, shardCount) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % shardCount;
}

// Memory pressure test
async function testMemoryPressure() {
  console.log('\n🧪 Testing Cache Under Memory Pressure');
  console.log('━'.repeat(50));
  
  const results = {
    evictions: 0,
    memoryUsage: [],
  };
  
  // Generate large payloads
  const largePayloads = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    data: 'x'.repeat(10240), // 10KB per item
  }));
  
  console.log('📦 Filling cache with large items...');
  
  for (const payload of largePayloads) {
    const response = await fetch(`${CONFIG.BASE_URL}/api/cache-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const headers = response.headers;
    if (headers.get('x-cache-evicted')) {
      results.evictions++;
    }
    
    // Track memory usage periodically
    if (payload.id % 100 === 0) {
      const memUsage = process.memoryUsage();
      results.memoryUsage.push({
        items: payload.id,
        heapUsed: Math.round(memUsage.heapUsed / 1048576), // MB
        external: Math.round(memUsage.external / 1048576), // MB
      });
    }
  }
  
  console.log('\n📊 Memory Pressure Results:');
  console.log(`  Total evictions: ${results.evictions}`);
  console.log('  Memory usage:');
  results.memoryUsage.forEach(m => {
    console.log(`    ${m.items} items: ${m.heapUsed}MB heap, ${m.external}MB external`);
  });
  
  return results;
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Cache Performance Tests');
  console.log('=' .repeat(50));
  
  const results = [];
  
  // Run each scenario
  for (const [key, scenario] of Object.entries(SCENARIOS)) {
    try {
      const result = await runScenario(scenario);
      results.push(result);
      
      // Cool down between tests
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`❌ Test failed: ${scenario.name}`, error);
      results.push({
        scenario: scenario.name,
        success: false,
        error: error.message,
      });
    }
  }
  
  // Run specialized tests
  await testShardDistribution();
  await testMemoryPressure();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 Test Summary');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`  ✅ Passed: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Success Rate: ${((successful / results.length) * 100).toFixed(2)}%`);
  
  // Overall cache effectiveness score
  const avgHitRate = results
    .filter(r => r.stats?.hitRate)
    .reduce((sum, r) => sum + r.stats.hitRate, 0) / results.length;
  
  const avgLatency = results
    .filter(r => r.stats?.latency?.avg)
    .reduce((sum, r) => sum + r.stats.latency.avg, 0) / results.length;
  
  const effectivenessScore = (avgHitRate * 50) + Math.max(0, 50 - (avgLatency / 10));
  
  console.log('\n🏆 Cache Effectiveness Score: ' + effectivenessScore.toFixed(2) + '/100');
  
  if (effectivenessScore >= 80) {
    console.log('  🌟 Excellent cache performance!');
  } else if (effectivenessScore >= 60) {
    console.log('  ✅ Good cache performance');
  } else {
    console.log('  ⚠️  Cache performance needs improvement');
  }
  
  return results;
}

// Export for use in CI/CD
export { runAllTests, runScenario, testShardDistribution, testMemoryPressure };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}