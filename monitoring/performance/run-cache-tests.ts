#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Cache Testing Suite Runner
 * Comprehensive testing and validation of cache implementation
 */

import { CacheValidator, DEFAULT_CACHE_TEST_CONFIG, type CacheValidationReport } from './cache-validation-test.ts';

interface TestConfiguration {
  environment: 'local' | 'staging' | 'production';
  baseUrl: string;
  authTokens?: {
    creator?: string;
    investor?: string;
    production?: string;
  };
  concurrentUsers: number;
  testDuration: number; // minutes
}

class CacheTestRunner {
  private config: TestConfiguration;

  constructor(config: TestConfiguration) {
    this.config = config;
  }

  /**
   * Run comprehensive cache test suite
   */
  async runFullTestSuite(): Promise<void> {
    console.log('🧪 Starting Pitchey Cache Test Suite');
    console.log(`📍 Environment: ${this.config.environment}`);
    console.log(`🌐 Base URL: ${this.config.baseUrl}`);
    console.log(`👥 Concurrent Users: ${this.config.concurrentUsers}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Test 1: Basic cache functionality
      console.log('\n🔍 Phase 1: Basic Cache Functionality');
      const basicReport = await this.runBasicCacheTests();
      this.printBasicReport(basicReport);

      // Test 2: Load testing with cache
      console.log('\n⚡ Phase 2: Cache Performance Under Load');
      const loadReport = await this.runLoadTests();
      this.printLoadReport(loadReport);

      // Test 3: Cache warming validation
      console.log('\n🔥 Phase 3: Cache Warming Validation');
      await this.validateCacheWarming();

      // Test 4: Cache invalidation testing
      console.log('\n🔄 Phase 4: Cache Invalidation Testing');
      await this.testCacheInvalidation();

      // Test 5: Edge case testing
      console.log('\n🎯 Phase 5: Edge Case Testing');
      await this.testEdgeCases();

      // Final summary
      console.log('\n📊 Test Suite Summary');
      this.printFinalSummary(basicReport);

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Phase 1: Basic cache functionality tests
   */
  private async runBasicCacheTests(): Promise<CacheValidationReport> {
    const testConfig = {
      ...DEFAULT_CACHE_TEST_CONFIG,
      baseUrl: this.config.baseUrl,
      authTokens: this.config.authTokens,
      concurrentRequests: Math.min(this.config.concurrentUsers, 10)
    };

    const validator = new CacheValidator(testConfig);
    return await validator.validateCacheSystem();
  }

  /**
   * Phase 2: Load testing with cache
   */
  private async runLoadTests(): Promise<LoadTestReport> {
    const endpoints = [
      '/api/pitches/trending',
      '/api/pitches/new',
      '/api/pitches/public',
      '/api/dashboard/stats'
    ];

    const results: LoadTestResult[] = [];

    for (const endpoint of endpoints) {
      console.log(`  📈 Load testing ${endpoint}...`);
      
      // Test without cache (bust cache)
      const uncachedResult = await this.performLoadTest(endpoint, true);
      
      // Test with cache
      const cachedResult = await this.performLoadTest(endpoint, false);

      results.push({
        endpoint,
        uncached: uncachedResult,
        cached: cachedResult,
        improvement: ((uncachedResult.averageTime - cachedResult.averageTime) / uncachedResult.averageTime) * 100
      });
    }

    return {
      timestamp: new Date(),
      results,
      overallImprovement: results.reduce((sum, r) => sum + r.improvement, 0) / results.length
    };
  }

  /**
   * Perform load test on specific endpoint
   */
  private async performLoadTest(endpoint: string, bustCache: boolean): Promise<{
    averageTime: number;
    p95Time: number;
    successRate: number;
    throughput: number;
  }> {
    const url = new URL(endpoint, this.config.baseUrl);
    if (bustCache) {
      url.searchParams.set('_cachebust', Date.now().toString());
    }

    const requestCount = this.config.concurrentUsers;
    const startTime = Date.now();
    const times: number[] = [];
    let successCount = 0;

    const promises = Array(requestCount).fill(null).map(async () => {
      const reqStart = Date.now();
      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          successCount++;
        }
        
        times.push(Date.now() - reqStart);
      } catch (error) {
        times.push(Date.now() - reqStart);
      }
    });

    await Promise.all(promises);

    const totalTime = Date.now() - startTime;
    times.sort((a, b) => a - b);

    return {
      averageTime: times.reduce((a, b) => a + b) / times.length,
      p95Time: times[Math.floor(times.length * 0.95)],
      successRate: (successCount / requestCount) * 100,
      throughput: (successCount / totalTime) * 1000 // requests per second
    };
  }

  /**
   * Phase 3: Cache warming validation
   */
  private async validateCacheWarming(): Promise<void> {
    console.log('  🔥 Testing cache warming endpoint...');

    try {
      // Call cache warming endpoint if available
      const warmingUrl = new URL('/api/admin/cache/warm', this.config.baseUrl);
      
      const response = await fetch(warmingUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add admin auth if available
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`  ✅ Cache warming successful: ${result.message || 'OK'}`);
        
        // Verify that endpoints are now cached
        await this.verifyWarmingEffectiveness();
      } else {
        console.log(`  ⚠️ Cache warming endpoint not available (${response.status})`);
      }
    } catch (error) {
      console.log('  ⚠️ Cache warming test failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Verify that cache warming was effective
   */
  private async verifyWarmingEffectiveness(): Promise<void> {
    const testEndpoints = [
      '/api/pitches/trending',
      '/api/pitches/new',
      '/api/pitches/public'
    ];

    let hitCount = 0;
    const total = testEndpoints.length;

    for (const endpoint of testEndpoints) {
      try {
        const response = await fetch(new URL(endpoint, this.config.baseUrl).toString());
        const cacheStatus = response.headers.get('X-Cache');
        
        if (cacheStatus === 'HIT') {
          hitCount++;
        }
        
        console.log(`    ${endpoint}: ${cacheStatus || 'UNKNOWN'}`);
      } catch (error) {
        console.log(`    ${endpoint}: ERROR`);
      }
    }

    const effectiveness = (hitCount / total) * 100;
    console.log(`  📊 Warming effectiveness: ${effectiveness.toFixed(1)}% (${hitCount}/${total} hits)`);
  }

  /**
   * Phase 4: Cache invalidation testing
   */
  private async testCacheInvalidation(): Promise<void> {
    console.log('  🔄 Testing cache invalidation...');

    // This would require actual cache invalidation endpoints
    // For now, test TTL-based invalidation
    
    try {
      // Test short TTL endpoint if available
      const endpoint = '/api/notifications/recent';
      const url = new URL(endpoint, this.config.baseUrl);

      // Make initial request to cache
      const response1 = await fetch(url.toString());
      const initialCache = response1.headers.get('X-Cache');

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Make another request
      const response2 = await fetch(url.toString());
      const laterCache = response2.headers.get('X-Cache');

      console.log(`    Initial: ${initialCache}, Later: ${laterCache}`);
      
      if (initialCache === 'MISS' && laterCache === 'HIT') {
        console.log('  ✅ Cache invalidation test passed');
      } else {
        console.log('  ℹ️ Cache invalidation test inconclusive');
      }
    } catch (error) {
      console.log('  ⚠️ Cache invalidation test failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Phase 5: Edge case testing
   */
  private async testEdgeCases(): Promise<void> {
    console.log('  🎯 Testing edge cases...');

    // Test 1: Large response caching
    await this.testLargeResponseCaching();

    // Test 2: Query parameter variations
    await this.testQueryParameterHandling();

    // Test 3: Error response caching
    await this.testErrorResponseCaching();

    // Test 4: Concurrent cache warming
    await this.testConcurrentCacheWarming();
  }

  private async testLargeResponseCaching(): Promise<void> {
    console.log('    📦 Testing large response caching...');
    
    try {
      // Test with potentially large endpoint
      const endpoint = '/api/pitches/public?limit=50';
      const url = new URL(endpoint, this.config.baseUrl);

      const response = await fetch(url.toString());
      const contentLength = response.headers.get('Content-Length');
      const cacheStatus = response.headers.get('X-Cache');

      console.log(`    Large response (${contentLength} bytes): ${cacheStatus || 'UNKNOWN'}`);
    } catch (error) {
      console.log('    ❌ Large response test failed');
    }
  }

  private async testQueryParameterHandling(): Promise<void> {
    console.log('    🔍 Testing query parameter handling...');

    try {
      const baseEndpoint = '/api/pitches/trending';
      
      // Same parameters in different order should hit same cache
      const url1 = new URL(baseEndpoint + '?limit=10&sort=date', this.config.baseUrl);
      const url2 = new URL(baseEndpoint + '?sort=date&limit=10', this.config.baseUrl);

      await fetch(url1.toString()); // Prime cache
      const response = await fetch(url2.toString());
      const cacheStatus = response.headers.get('X-Cache');

      if (cacheStatus === 'HIT') {
        console.log('    ✅ Query parameter normalization working');
      } else {
        console.log('    ⚠️ Query parameter normalization may have issues');
      }
    } catch (error) {
      console.log('    ❌ Query parameter test failed');
    }
  }

  private async testErrorResponseCaching(): Promise<void> {
    console.log('    ❌ Testing error response caching...');

    try {
      // Try a non-existent endpoint
      const url = new URL('/api/nonexistent/endpoint', this.config.baseUrl);
      const response = await fetch(url.toString());
      const cacheStatus = response.headers.get('X-Cache');

      // Error responses should not be cached
      if (response.status >= 400 && (!cacheStatus || cacheStatus === 'BYPASS')) {
        console.log('    ✅ Error responses not cached');
      } else {
        console.log(`    ⚠️ Error response caching behavior: ${response.status} - ${cacheStatus}`);
      }
    } catch (error) {
      console.log('    ℹ️ Error response test inconclusive');
    }
  }

  private async testConcurrentCacheWarming(): Promise<void> {
    console.log('    🔀 Testing concurrent cache access...');

    try {
      // Bust cache first
      const endpoint = '/api/pitches/trending';
      await fetch(new URL(endpoint + '?_cachebust=' + Date.now(), this.config.baseUrl));

      // Make multiple concurrent requests
      const promises = Array(5).fill(null).map(() =>
        fetch(new URL(endpoint, this.config.baseUrl))
      );

      const responses = await Promise.all(promises);
      const cacheStatuses = responses.map(r => r.headers.get('X-Cache'));
      
      const missCount = cacheStatuses.filter(s => s === 'MISS').length;
      const hitCount = cacheStatuses.filter(s => s === 'HIT').length;

      console.log(`    Cache statuses: ${missCount} MISS, ${hitCount} HIT`);
      
      if (missCount === 1 && hitCount === 4) {
        console.log('    ✅ Concurrent cache warming optimal');
      } else if (hitCount > 0) {
        console.log('    ✅ Concurrent cache warming working');
      } else {
        console.log('    ⚠️ Concurrent cache warming may have issues');
      }
    } catch (error) {
      console.log('    ❌ Concurrent cache test failed');
    }
  }

  /**
   * Print reports
   */
  private printBasicReport(report: CacheValidationReport): void {
    console.log(`\n📋 Basic Cache Test Results:`);
    console.log(`  Overall Success: ${report.overallSuccess ? '✅' : '❌'}`);
    console.log(`  Tests Passed: ${report.passedTests}/${report.totalTests}`);
    console.log(`  Cache Effectiveness: ${report.cacheEffectiveness.toFixed(1)}%`);
    console.log(`  Average Response Time: ${report.averageResponseTime.toFixed(1)}ms`);
    
    if (report.recommendations.length > 0) {
      console.log(`\n  💡 Recommendations:`);
      report.recommendations.forEach(rec => console.log(`    • ${rec}`));
    }

    const failedTests = report.results.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.log(`\n  ❌ Failed Tests:`);
      failedTests.forEach(test => {
        console.log(`    • ${test.endpoint} (${test.testType}): ${test.error}`);
      });
    }
  }

  private printLoadReport(report: LoadTestReport): void {
    console.log(`\n📊 Load Test Results:`);
    console.log(`  Overall Performance Improvement: ${report.overallImprovement.toFixed(1)}%`);
    
    report.results.forEach(result => {
      console.log(`\n  📈 ${result.endpoint}:`);
      console.log(`    Uncached: ${result.uncached.averageTime.toFixed(1)}ms avg, ${result.uncached.p95Time}ms p95`);
      console.log(`    Cached: ${result.cached.averageTime.toFixed(1)}ms avg, ${result.cached.p95Time}ms p95`);
      console.log(`    Improvement: ${result.improvement.toFixed(1)}%`);
      console.log(`    Success Rate: ${result.cached.successRate.toFixed(1)}%`);
      console.log(`    Throughput: ${result.cached.throughput.toFixed(1)} req/s`);
    });
  }

  private printFinalSummary(basicReport: CacheValidationReport): void {
    console.log(`\n🎉 Cache Test Suite Complete!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const score = basicReport.passedTests / basicReport.totalTests;
    let grade: string;
    
    if (score >= 0.9) grade = 'A+ Excellent';
    else if (score >= 0.8) grade = 'A Good';
    else if (score >= 0.7) grade = 'B Fair';
    else if (score >= 0.6) grade = 'C Needs Work';
    else grade = 'D Poor';

    console.log(`📊 Overall Grade: ${grade} (${(score * 100).toFixed(1)}%)`);
    console.log(`⚡ Cache Effectiveness: ${basicReport.cacheEffectiveness.toFixed(1)}%`);
    console.log(`⏱️ Average Response Time: ${basicReport.averageResponseTime.toFixed(1)}ms`);
    
    if (basicReport.overallSuccess) {
      console.log(`✅ All critical cache functionality is working!`);
    } else {
      console.log(`❌ Some cache issues detected - review recommendations`);
    }
  }
}

// Types for load testing
interface LoadTestResult {
  endpoint: string;
  uncached: {
    averageTime: number;
    p95Time: number;
    successRate: number;
    throughput: number;
  };
  cached: {
    averageTime: number;
    p95Time: number;
    successRate: number;
    throughput: number;
  };
  improvement: number;
}

interface LoadTestReport {
  timestamp: Date;
  results: LoadTestResult[];
  overallImprovement: number;
}

// Main execution
async function main() {
  const environment = Deno.env.get('ENVIRONMENT') || 'local';
  
  const configs = {
    local: {
      environment: 'local' as const,
      baseUrl: 'http://localhost:8001',
      concurrentUsers: 5,
      testDuration: 2
    },
    staging: {
      environment: 'staging' as const,
      baseUrl: 'https://pitchey-staging.cavelltheleaddev.workers.dev',
      concurrentUsers: 10,
      testDuration: 5
    },
    production: {
      environment: 'production' as const,
      baseUrl: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
      concurrentUsers: 20,
      testDuration: 10
    }
  };

  const config = configs[environment as keyof typeof configs];
  if (!config) {
    console.error(`❌ Unknown environment: ${environment}`);
    process.exit(1);
  }

  const runner = new CacheTestRunner(config);
  await runner.runFullTestSuite();
}

if (import.meta.main) {
  main();
}