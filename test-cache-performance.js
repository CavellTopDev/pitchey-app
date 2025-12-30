#!/usr/bin/env node

/**
 * Cache Performance Testing Script
 * Tests cache hit rates and response times for the optimized worker
 */

import fetch from 'node-fetch';

const WORKER_URL = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
const TEST_ENDPOINTS = [
  '/api/pitches/browse/enhanced',
  '/api/pitches/trending?limit=10',
  '/api/dashboard/stats',
  '/api/config/app',
  '/api/content/homepage'
];

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class CachePerformanceTester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.testResults = [];
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheBypass: 0,
      errors: 0,
      totalResponseTime: 0
    };
  }

  /**
   * Make a test request and collect metrics
   */
  async testEndpoint(endpoint, iteration = 1) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'CachePerformanceTester/1.0',
          'Accept': 'application/json'
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const cacheStatus = response.headers.get('x-cache-status') || 'UNKNOWN';
      const workerResponseTime = response.headers.get('x-response-time') || '0ms';
      const isSuccess = response.ok;
      
      const result = {
        endpoint,
        iteration,
        success: isSuccess,
        status: response.status,
        cacheStatus,
        responseTime,
        workerResponseTime,
        contentLength: response.headers.get('content-length') || 0,
        timestamp: new Date().toISOString()
      };
      
      // Update statistics
      this.stats.totalRequests++;
      this.stats.totalResponseTime += responseTime;
      
      if (isSuccess) {
        switch (cacheStatus.toUpperCase()) {
          case 'HIT':
            this.stats.cacheHits++;
            break;
          case 'MISS':
            this.stats.cacheMisses++;
            break;
          case 'BYPASS':
            this.stats.cacheBypass++;
            break;
        }
      } else {
        this.stats.errors++;
      }
      
      this.testResults.push(result);
      return result;
      
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const result = {
        endpoint,
        iteration,
        success: false,
        error: error.message,
        responseTime,
        timestamp: new Date().toISOString()
      };
      
      this.stats.totalRequests++;
      this.stats.errors++;
      this.stats.totalResponseTime += responseTime;
      
      this.testResults.push(result);
      return result;
    }
  }

  /**
   * Test cache warming
   */
  async testCacheWarming() {
    console.log(`${colors.cyan}🔥 Testing cache warming...${colors.reset}`);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/cache/warm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        const summary = result.data.summary;
        console.log(`${colors.green}✅ Cache warming successful:${colors.reset}`);
        console.log(`   Total: ${summary.total}, Success: ${summary.successful}, Failed: ${summary.failed}`);
        console.log(`   Success Rate: ${summary.success_rate}`);
        return true;
      } else {
        console.log(`${colors.red}❌ Cache warming failed:${colors.reset} ${result.error || 'Unknown error'}`);
        return false;
      }
    } catch (error) {
      console.log(`${colors.red}❌ Cache warming error:${colors.reset} ${error.message}`);
      return false;
    }
  }

  /**
   * Get cache statistics from the worker
   */
  async getCacheStats() {
    try {
      const response = await fetch(`${this.baseUrl}/api/cache/stats`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        return result.data;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get cache stats:', error.message);
      return null;
    }
  }

  /**
   * Run comprehensive cache performance test
   */
  async runTest() {
    console.log(`${colors.bold}${colors.blue}🚀 Cache Performance Test Starting${colors.reset}`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Test Endpoints: ${TEST_ENDPOINTS.length}`);
    console.log('─'.repeat(80));
    
    // 1. Test initial cache warming
    await this.testCacheWarming();
    console.log();
    
    // 2. Wait a moment for cache warming to complete
    console.log(`${colors.yellow}⏳ Waiting 2 seconds for cache warming...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Run multiple iterations to test cache hit rates
    console.log(`${colors.cyan}🔄 Running cache hit rate tests (3 iterations per endpoint)...${colors.reset}`);
    
    for (const endpoint of TEST_ENDPOINTS) {
      console.log(`\n${colors.white}Testing: ${endpoint}${colors.reset}`);
      
      for (let i = 1; i <= 3; i++) {
        const result = await this.testEndpoint(endpoint, i);
        
        const statusColor = result.success ? colors.green : colors.red;
        const cacheColor = result.cacheStatus === 'HIT' ? colors.green : 
                          result.cacheStatus === 'MISS' ? colors.yellow : colors.red;
        
        console.log(`  ${i}. ${statusColor}${result.status || 'ERROR'}${colors.reset} | ` +
                   `${cacheColor}${result.cacheStatus || 'ERROR'}${colors.reset} | ` +
                   `${result.responseTime}ms | ${result.workerResponseTime || 'N/A'}`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('\n' + '─'.repeat(80));
    
    // 4. Calculate and display results
    this.displayResults();
    
    // 5. Get final cache statistics
    const cacheStats = await this.getCacheStats();
    if (cacheStats) {
      this.displayCacheStats(cacheStats);
    }
  }

  /**
   * Display test results
   */
  displayResults() {
    const { stats } = this;
    const hitRate = stats.totalRequests > 0 ? 
      ((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(1) : 0;
    const avgResponseTime = stats.totalRequests > 0 ? 
      (stats.totalResponseTime / stats.totalRequests).toFixed(0) : 0;
    
    console.log(`${colors.bold}📊 Test Results Summary${colors.reset}`);
    console.log(`Total Requests: ${stats.totalRequests}`);
    console.log(`Successful: ${stats.totalRequests - stats.errors} | Errors: ${stats.errors}`);
    console.log(`Cache Hits: ${colors.green}${stats.cacheHits}${colors.reset} | ` +
               `Cache Misses: ${colors.yellow}${stats.cacheMisses}${colors.reset} | ` +
               `Cache Bypass: ${colors.red}${stats.cacheBypass}${colors.reset}`);
    
    const hitRateColor = parseFloat(hitRate) >= 80 ? colors.green : 
                        parseFloat(hitRate) >= 60 ? colors.yellow : colors.red;
    
    console.log(`${colors.bold}Cache Hit Rate: ${hitRateColor}${hitRate}%${colors.reset}${colors.bold} (Target: 80%+)${colors.reset}`);
    console.log(`Average Response Time: ${avgResponseTime}ms`);
    
    if (parseFloat(hitRate) >= 80) {
      console.log(`\n${colors.green}🎉 SUCCESS: Cache hit rate target achieved!${colors.reset}`);
    } else if (parseFloat(hitRate) >= 60) {
      console.log(`\n${colors.yellow}⚠️  GOOD: Cache hit rate is acceptable but could be improved.${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ NEEDS IMPROVEMENT: Cache hit rate is below target.${colors.reset}`);
    }
  }

  /**
   * Display detailed cache statistics from worker
   */
  displayCacheStats(cacheStats) {
    console.log(`\n${colors.bold}🔍 Worker Cache Statistics${colors.reset}`);
    console.log(`Hit Rate: ${cacheStats.stats.hitRate}%`);
    console.log(`Total Requests: ${cacheStats.stats.totalRequests}`);
    console.log(`Cache Hits: ${cacheStats.stats.hits}`);
    console.log(`Cache Misses: ${cacheStats.stats.misses}`);
    console.log(`Cache Errors: ${cacheStats.stats.errors}`);
    console.log(`Health Status: ${cacheStats.health.status}`);
    console.log(`Performance Grade: ${cacheStats.health.performance_grade}`);
  }
}

/**
 * Main test execution
 */
async function main() {
  const tester = new CachePerformanceTester(WORKER_URL);
  
  try {
    await tester.runTest();
  } catch (error) {
    console.error(`${colors.red}Test execution failed:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CachePerformanceTester };