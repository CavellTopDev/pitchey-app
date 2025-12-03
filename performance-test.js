#!/usr/bin/env node

/**
 * Performance Testing Script for Pitchey Platform
 * Tests response times, throughput, and cache effectiveness
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  // Production URLs
  PRODUCTION_URL: 'https://pitchey-production-secure.cavelltheleaddev.workers.dev',
  OPTIMIZED_URL: 'https://pitchey-production-optimized.cavelltheleaddev.workers.dev',
  
  // Test parameters
  CONCURRENT_REQUESTS: 10,
  TOTAL_REQUESTS: 100,
  TEST_DURATION: 30000, // 30 seconds
  
  // Endpoints to test
  ENDPOINTS: [
    { path: '/api/health', method: 'GET', name: 'Health Check' },
    { path: '/api/pitches/1', method: 'GET', name: 'Get Pitch' },
    { path: '/api/search?q=test', method: 'GET', name: 'Search' },
    { path: '/api/user/1', method: 'GET', name: 'Get User' },
    { path: '/static/logo.png', method: 'GET', name: 'Static Asset' }
  ]
};

// Performance metrics storage
class PerformanceMetrics {
  constructor() {
    this.metrics = {
      requests: 0,
      successful: 0,
      failed: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      durations: [],
      statusCodes: {},
      cacheHits: 0,
      cacheMisses: 0,
      errors: []
    };
  }

  recordRequest(duration, status, headers, error = null) {
    this.metrics.requests++;
    
    if (error) {
      this.metrics.failed++;
      this.metrics.errors.push(error.message);
      return;
    }
    
    this.metrics.successful++;
    this.metrics.totalDuration += duration;
    this.metrics.durations.push(duration);
    this.metrics.minDuration = Math.min(this.metrics.minDuration, duration);
    this.metrics.maxDuration = Math.max(this.metrics.maxDuration, duration);
    
    // Track status codes
    this.metrics.statusCodes[status] = (this.metrics.statusCodes[status] || 0) + 1;
    
    // Track cache hits
    const cacheStatus = headers['x-cache'] || headers['x-cache-status'];
    if (cacheStatus === 'HIT') {
      this.metrics.cacheHits++;
    } else if (cacheStatus === 'MISS' || cacheStatus === 'BYPASS') {
      this.metrics.cacheMisses++;
    }
  }

  getReport() {
    const sortedDurations = [...this.metrics.durations].sort((a, b) => a - b);
    const p50Index = Math.floor(sortedDurations.length * 0.5);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p99Index = Math.floor(sortedDurations.length * 0.99);
    
    return {
      totalRequests: this.metrics.requests,
      successful: this.metrics.successful,
      failed: this.metrics.failed,
      successRate: ((this.metrics.successful / this.metrics.requests) * 100).toFixed(2) + '%',
      
      timing: {
        average: (this.metrics.totalDuration / this.metrics.successful).toFixed(2) + 'ms',
        min: this.metrics.minDuration.toFixed(2) + 'ms',
        max: this.metrics.maxDuration.toFixed(2) + 'ms',
        p50: sortedDurations[p50Index]?.toFixed(2) + 'ms' || 'N/A',
        p95: sortedDurations[p95Index]?.toFixed(2) + 'ms' || 'N/A',
        p99: sortedDurations[p99Index]?.toFixed(2) + 'ms' || 'N/A'
      },
      
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: this.metrics.cacheHits > 0 
          ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(2) + '%'
          : '0%'
      },
      
      statusCodes: this.metrics.statusCodes,
      errors: this.metrics.errors.slice(0, 5) // First 5 errors
    };
  }
}

// HTTP request wrapper with timing
function makeRequest(url, endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const urlObj = new URL(url + endpoint.path);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: endpoint.method,
      headers: {
        'User-Agent': 'Pitchey-Performance-Test/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    };
    
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          duration,
          status: res.statusCode,
          headers: res.headers,
          error: null
        });
      });
    });
    
    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        duration,
        status: 0,
        headers: {},
        error
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      const duration = Date.now() - startTime;
      resolve({
        duration,
        status: 0,
        headers: {},
        error: new Error('Request timeout')
      });
    });
    
    req.end();
  });
}

// Run concurrent load test
async function runLoadTest(url, endpoint, concurrency, totalRequests) {
  const metrics = new PerformanceMetrics();
  const startTime = Date.now();
  
  console.log(`\nTesting: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
  console.log(`URL: ${url}`);
  console.log(`Concurrency: ${concurrency}, Total Requests: ${totalRequests}`);
  
  // Create request batches
  const batches = [];
  for (let i = 0; i < totalRequests; i += concurrency) {
    const batchSize = Math.min(concurrency, totalRequests - i);
    const batch = [];
    for (let j = 0; j < batchSize; j++) {
      batch.push(makeRequest(url, endpoint));
    }
    batches.push(batch);
  }
  
  // Execute batches sequentially
  for (const batch of batches) {
    const results = await Promise.all(batch);
    results.forEach(result => {
      metrics.recordRequest(result.duration, result.status, result.headers, result.error);
    });
    
    // Show progress
    process.stdout.write(`\rProgress: ${metrics.metrics.requests}/${totalRequests}`);
  }
  
  const totalDuration = Date.now() - startTime;
  const report = metrics.getReport();
  
  console.log('\n');
  console.log('=== Performance Report ===');
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Requests/sec: ${(totalRequests / (totalDuration / 1000)).toFixed(2)}`);
  console.log('\n--- Response Times ---');
  console.log(`Average: ${report.timing.average}`);
  console.log(`Min: ${report.timing.min}`);
  console.log(`Max: ${report.timing.max}`);
  console.log(`P50 (Median): ${report.timing.p50}`);
  console.log(`P95: ${report.timing.p95}`);
  console.log(`P99: ${report.timing.p99}`);
  console.log('\n--- Cache Performance ---');
  console.log(`Cache Hits: ${report.cache.hits}`);
  console.log(`Cache Misses: ${report.cache.misses}`);
  console.log(`Hit Rate: ${report.cache.hitRate}`);
  console.log('\n--- Reliability ---');
  console.log(`Success Rate: ${report.successRate}`);
  console.log(`Failed Requests: ${report.failed}`);
  if (report.errors.length > 0) {
    console.log('Errors:', report.errors);
  }
  console.log('\n--- Status Codes ---');
  Object.entries(report.statusCodes).forEach(([code, count]) => {
    console.log(`  ${code}: ${count}`);
  });
  
  return report;
}

// Compare production vs optimized performance
async function comparePerformance() {
  console.log('========================================');
  console.log('   Pitchey Platform Performance Test   ');
  console.log('========================================');
  
  const results = {
    production: {},
    optimized: {}
  };
  
  // Test each endpoint
  for (const endpoint of CONFIG.ENDPOINTS) {
    // Warm up caches first
    console.log(`\nWarming up caches for ${endpoint.name}...`);
    await Promise.all([
      makeRequest(CONFIG.PRODUCTION_URL, endpoint),
      makeRequest(CONFIG.OPTIMIZED_URL, endpoint)
    ]);
    
    // Test production
    console.log('\n### PRODUCTION ENVIRONMENT ###');
    try {
      results.production[endpoint.name] = await runLoadTest(
        CONFIG.PRODUCTION_URL,
        endpoint,
        CONFIG.CONCURRENT_REQUESTS,
        CONFIG.TOTAL_REQUESTS
      );
    } catch (error) {
      console.error('Production test failed:', error.message);
      results.production[endpoint.name] = { error: error.message };
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test optimized
    console.log('\n### OPTIMIZED ENVIRONMENT ###');
    try {
      results.optimized[endpoint.name] = await runLoadTest(
        CONFIG.OPTIMIZED_URL,
        endpoint,
        CONFIG.CONCURRENT_REQUESTS,
        CONFIG.TOTAL_REQUESTS
      );
    } catch (error) {
      console.error('Optimized test failed:', error.message);
      results.optimized[endpoint.name] = { error: error.message };
    }
    
    // Wait between different endpoints
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Generate comparison report
  console.log('\n\n========================================');
  console.log('        PERFORMANCE COMPARISON          ');
  console.log('========================================\n');
  
  for (const endpoint of CONFIG.ENDPOINTS) {
    console.log(`\n${endpoint.name}:`);
    console.log('------------------------');
    
    const prod = results.production[endpoint.name];
    const opt = results.optimized[endpoint.name];
    
    if (prod.error || opt.error) {
      console.log('Test failed for one or both environments');
      continue;
    }
    
    // Compare average response times
    const prodAvg = parseFloat(prod.timing.average);
    const optAvg = parseFloat(opt.timing.average);
    const improvement = ((prodAvg - optAvg) / prodAvg * 100).toFixed(2);
    
    console.log(`Production Avg: ${prod.timing.average}`);
    console.log(`Optimized Avg: ${opt.timing.average}`);
    console.log(`Improvement: ${improvement}% ${improvement > 0 ? '✅' : '❌'}`);
    
    // Compare P95
    const prodP95 = parseFloat(prod.timing.p95);
    const optP95 = parseFloat(opt.timing.p95);
    const p95Improvement = ((prodP95 - optP95) / prodP95 * 100).toFixed(2);
    
    console.log(`\nProduction P95: ${prod.timing.p95}`);
    console.log(`Optimized P95: ${opt.timing.p95}`);
    console.log(`P95 Improvement: ${p95Improvement}% ${p95Improvement > 0 ? '✅' : '❌'}`);
    
    // Compare cache hit rates
    console.log(`\nProduction Cache Hit Rate: ${prod.cache.hitRate}`);
    console.log(`Optimized Cache Hit Rate: ${opt.cache.hitRate}`);
  }
  
  // Overall summary
  console.log('\n\n========================================');
  console.log('           OVERALL SUMMARY              ');
  console.log('========================================\n');
  
  let totalProdAvg = 0, totalOptAvg = 0;
  let endpointCount = 0;
  
  for (const endpoint of CONFIG.ENDPOINTS) {
    const prod = results.production[endpoint.name];
    const opt = results.optimized[endpoint.name];
    
    if (!prod.error && !opt.error) {
      totalProdAvg += parseFloat(prod.timing.average);
      totalOptAvg += parseFloat(opt.timing.average);
      endpointCount++;
    }
  }
  
  if (endpointCount > 0) {
    const avgProd = totalProdAvg / endpointCount;
    const avgOpt = totalOptAvg / endpointCount;
    const overallImprovement = ((avgProd - avgOpt) / avgProd * 100).toFixed(2);
    
    console.log(`Average Response Time (Production): ${avgProd.toFixed(2)}ms`);
    console.log(`Average Response Time (Optimized): ${avgOpt.toFixed(2)}ms`);
    console.log(`Overall Performance Improvement: ${overallImprovement}%`);
    
    if (parseFloat(overallImprovement) > 20) {
      console.log('\n🎉 EXCELLENT: Achieved >20% performance improvement!');
    } else if (parseFloat(overallImprovement) > 10) {
      console.log('\n✅ GOOD: Achieved >10% performance improvement!');
    } else if (parseFloat(overallImprovement) > 0) {
      console.log('\n📊 OK: Some performance improvement achieved');
    } else {
      console.log('\n⚠️  WARNING: No performance improvement detected');
    }
  }
  
  console.log('\nTest completed at:', new Date().toISOString());
}

// Run the tests
if (require.main === module) {
  comparePerformance().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}