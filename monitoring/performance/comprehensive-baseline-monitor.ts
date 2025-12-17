#!/usr/bin/env deno run --allow-net --allow-read --allow-write
/**
 * Comprehensive Performance Baseline Monitor for Pitchey Cloudflare Worker
 * Captures detailed performance metrics across all critical endpoints
 */

interface PerformanceMetric {
  timestamp: string;
  endpoint: string;
  httpStatus: number;
  responseTime: number;
  dnsTime: number;
  connectTime: number;
  sslTime: number;
  transferTime: number;
  totalSize: number;
  cacheStatus: string;
  cfCacheStatus: string;
  cfRay: string;
  serverProcessingTime: number;
  errorCount: number;
}

interface EndpointTest {
  endpoint: string;
  method: 'GET' | 'POST';
  expectedStatus: number;
  cacheExpected: boolean;
  headers?: Record<string, string>;
  body?: string;
}

class PerformanceMonitor {
  private apiUrl: string;
  private outputDir: string;
  private alertThresholds: {
    maxResponseTime: number;
    maxErrorRate: number;
    minCacheHitRate: number;
  };

  constructor(apiUrl = 'https://pitchey-production.cavelltheleaddev.workers.dev') {
    this.apiUrl = apiUrl;
    this.outputDir = './baseline-data';
    this.alertThresholds = {
      maxResponseTime: 1000, // 1 second
      maxErrorRate: 5, // 5%
      minCacheHitRate: 50, // 50%
    };
  }

  private async ensureOutputDir() {
    try {
      await Deno.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }
  }

  private getEndpointsToTest(): EndpointTest[] {
    return [
      // Health endpoints
      { endpoint: '/api/health', method: 'GET', expectedStatus: 200, cacheExpected: true },
      { endpoint: '/api/health/detailed', method: 'GET', expectedStatus: 200, cacheExpected: true },
      
      // Browse endpoints (public, cache-friendly)
      { endpoint: '/api/pitches/browse/enhanced', method: 'GET', expectedStatus: 200, cacheExpected: true },
      { endpoint: '/api/pitches/browse/enhanced?limit=5', method: 'GET', expectedStatus: 200, cacheExpected: true },
      { endpoint: '/api/pitches/browse/enhanced?limit=10&sort=newest', method: 'GET', expectedStatus: 200, cacheExpected: true },
      { endpoint: '/api/pitches/browse/enhanced?limit=5&genre=Action', method: 'GET', expectedStatus: 200, cacheExpected: true },
      { endpoint: '/api/pitches/browse/enhanced?limit=5&genre=Drama', method: 'GET', expectedStatus: 200, cacheExpected: true },
      
      // Pitch listing endpoints
      { endpoint: '/api/pitches?limit=10', method: 'GET', expectedStatus: 200, cacheExpected: true },
      { endpoint: '/api/pitches?limit=10&offset=10', method: 'GET', expectedStatus: 200, cacheExpected: true },
      { endpoint: '/api/pitches?limit=5&sort=newest', method: 'GET', expectedStatus: 200, cacheExpected: true },
      
      // Auth check (should not cache)
      { endpoint: '/api/auth/check', method: 'GET', expectedStatus: 401, cacheExpected: false },
      
      // Database performance test
      { endpoint: '/api/pitches/stats', method: 'GET', expectedStatus: 200, cacheExpected: true },
      
      // Cache performance test
      { endpoint: '/api/admin/cache-status', method: 'GET', expectedStatus: 200, cacheExpected: false },
    ];
  }

  private async performRequest(test: EndpointTest): Promise<PerformanceMetric> {
    const startTime = performance.now();
    const url = `${this.apiUrl}${test.endpoint}`;
    
    try {
      const requestStart = performance.now();
      const response = await fetch(url, {
        method: test.method,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PitcheyPerformanceMonitor/1.0',
          ...test.headers
        },
        body: test.body
      });

      const responseEnd = performance.now();
      const responseTime = responseEnd - requestStart;

      // Extract cache headers
      const cacheStatus = response.headers.get('x-cache-status') || 'NONE';
      const cfCacheStatus = response.headers.get('cf-cache-status') || 'NONE';
      const cfRay = response.headers.get('cf-ray') || 'N/A';
      const serverTime = parseFloat(response.headers.get('x-response-time') || '0');

      // Get content length
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      
      // Calculate derived metrics
      const transferTime = responseTime - serverTime;
      
      return {
        timestamp: new Date().toISOString(),
        endpoint: test.endpoint,
        httpStatus: response.status,
        responseTime: Math.round(responseTime * 100) / 100, // Round to 2 decimal places
        dnsTime: 0, // Not available in Fetch API
        connectTime: 0, // Not available in Fetch API
        sslTime: 0, // Not available in Fetch API
        transferTime: Math.max(0, Math.round(transferTime * 100) / 100),
        totalSize: contentLength,
        cacheStatus,
        cfCacheStatus,
        cfRay,
        serverProcessingTime: serverTime,
        errorCount: response.status >= 400 ? 1 : 0,
      };
    } catch (error) {
      const errorTime = performance.now() - startTime;
      
      return {
        timestamp: new Date().toISOString(),
        endpoint: test.endpoint,
        httpStatus: 0,
        responseTime: errorTime,
        dnsTime: 0,
        connectTime: 0,
        sslTime: 0,
        transferTime: 0,
        totalSize: 0,
        cacheStatus: 'ERROR',
        cfCacheStatus: 'ERROR',
        cfRay: 'N/A',
        serverProcessingTime: 0,
        errorCount: 1,
      };
    }
  }

  async runBaselineTest(): Promise<PerformanceMetric[]> {
    await this.ensureOutputDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    console.log(`📊 Starting Performance Baseline Test - ${timestamp}`);
    console.log(`🎯 API URL: ${this.apiUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const tests = this.getEndpointsToTest();
    const results: PerformanceMetric[] = [];

    // Warm-up phase
    console.log('🔥 Warming up endpoints...');
    for (const test of tests) {
      try {
        await fetch(`${this.apiUrl}${test.endpoint}`, { method: test.method });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch {
        // Ignore warm-up errors
      }
    }

    // Run baseline tests (3 iterations)
    const iterations = ['Cold Start', 'Warm Cache', 'Hot Cache'];
    
    for (let i = 0; i < 3; i++) {
      console.log(`\n🔄 ${iterations[i]} (Iteration ${i + 1}/3)`);
      console.log('─────────────────────────────────────────');

      for (const test of tests) {
        process.stdout.write(`Testing ${test.endpoint}... `);
        
        const metric = await this.performRequest(test);
        results.push(metric);

        // Color-coded status
        const statusColor = metric.httpStatus >= 200 && metric.httpStatus < 300 ? '✅' : 
                           metric.httpStatus >= 400 ? '❌' : '⚠️';
        const cacheIcon = metric.cacheStatus === 'HIT' ? '💾' : 
                         metric.cacheStatus === 'MISS' ? '🚫' : '❓';
        
        console.log(`${statusColor} ${metric.httpStatus} ${cacheIcon} ${metric.responseTime}ms`);
        
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    // Save detailed results
    const outputFile = `${this.outputDir}/baseline-${timestamp}.json`;
    const summaryFile = `${this.outputDir}/baseline-summary-${timestamp}.json`;
    
    await this.saveResults(results, outputFile);
    const summary = await this.generateSummary(results);
    await Deno.writeTextFile(summaryFile, JSON.stringify(summary, null, 2));

    console.log(`\n✅ Baseline test complete!`);
    console.log(`📁 Detailed results: ${outputFile}`);
    console.log(`📊 Summary report: ${summaryFile}`);

    this.printSummary(summary);
    this.checkAlerts(summary);

    return results;
  }

  private async saveResults(results: PerformanceMetric[], filename: string) {
    const data = {
      timestamp: new Date().toISOString(),
      apiUrl: this.apiUrl,
      totalTests: results.length,
      results
    };
    await Deno.writeTextFile(filename, JSON.stringify(data, null, 2));
  }

  private async generateSummary(results: PerformanceMetric[]) {
    const endpointStats = new Map<string, PerformanceMetric[]>();
    
    // Group by endpoint
    for (const result of results) {
      if (!endpointStats.has(result.endpoint)) {
        endpointStats.set(result.endpoint, []);
      }
      endpointStats.get(result.endpoint)!.push(result);
    }

    const endpointSummaries = Array.from(endpointStats.entries()).map(([endpoint, metrics]) => {
      const responseTimes = metrics.map(m => m.responseTime);
      const cacheHits = metrics.filter(m => m.cacheStatus === 'HIT').length;
      const errors = metrics.filter(m => m.errorCount > 0).length;
      
      return {
        endpoint,
        avgResponseTime: Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100) / 100,
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
        p95ResponseTime: this.calculatePercentile(responseTimes, 95),
        cacheHitRate: Math.round((cacheHits / metrics.length) * 100 * 100) / 100,
        errorRate: Math.round((errors / metrics.length) * 100 * 100) / 100,
        totalRequests: metrics.length,
      };
    });

    const overallStats = {
      totalRequests: results.length,
      avgResponseTime: Math.round((results.reduce((sum, r) => sum + r.responseTime, 0) / results.length) * 100) / 100,
      overallCacheHitRate: Math.round((results.filter(r => r.cacheStatus === 'HIT').length / results.length) * 100 * 100) / 100,
      overallErrorRate: Math.round((results.filter(r => r.errorCount > 0).length / results.length) * 100 * 100) / 100,
      responseTimes: {
        min: Math.min(...results.map(r => r.responseTime)),
        max: Math.max(...results.map(r => r.responseTime)),
        p95: this.calculatePercentile(results.map(r => r.responseTime), 95),
      }
    };

    return {
      timestamp: new Date().toISOString(),
      overall: overallStats,
      endpoints: endpointSummaries,
      alertThresholds: this.alertThresholds,
    };
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Math.round(sorted[index] * 100) / 100;
  }

  private printSummary(summary: any) {
    console.log('\n📊 Performance Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📈 Overall Avg Response Time: ${summary.overall.avgResponseTime}ms`);
    console.log(`🎯 P95 Response Time: ${summary.overall.responseTimes.p95}ms`);
    console.log(`💾 Cache Hit Rate: ${summary.overall.overallCacheHitRate}%`);
    console.log(`❌ Error Rate: ${summary.overall.overallErrorRate}%`);
    
    console.log('\n🔍 Top 5 Slowest Endpoints:');
    const slowest = summary.endpoints
      .sort((a: any, b: any) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 5);
    
    slowest.forEach((ep: any, i: number) => {
      console.log(`  ${i + 1}. ${ep.endpoint}: ${ep.avgResponseTime}ms (cache: ${ep.cacheHitRate}%)`);
    });
  }

  private checkAlerts(summary: any) {
    const alerts: string[] = [];

    if (summary.overall.avgResponseTime > this.alertThresholds.maxResponseTime) {
      alerts.push(`⚠️  High response time: ${summary.overall.avgResponseTime}ms > ${this.alertThresholds.maxResponseTime}ms`);
    }

    if (summary.overall.overallErrorRate > this.alertThresholds.maxErrorRate) {
      alerts.push(`🚨 High error rate: ${summary.overall.overallErrorRate}% > ${this.alertThresholds.maxErrorRate}%`);
    }

    if (summary.overall.overallCacheHitRate < this.alertThresholds.minCacheHitRate) {
      alerts.push(`💾 Low cache hit rate: ${summary.overall.overallCacheHitRate}% < ${this.alertThresholds.minCacheHitRate}%`);
    }

    if (alerts.length > 0) {
      console.log('\n🚨 Performance Alerts:');
      alerts.forEach(alert => console.log(alert));
    } else {
      console.log('\n✅ All performance metrics within acceptable thresholds');
    }
  }
}

// Main execution
if (import.meta.main) {
  const apiUrl = Deno.env.get('API_URL') || 'https://pitchey-production.cavelltheleaddev.workers.dev';
  const monitor = new PerformanceMonitor(apiUrl);
  
  try {
    await monitor.runBaselineTest();
  } catch (error) {
    console.error('❌ Performance baseline test failed:', error.message);
    Deno.exit(1);
  }
}