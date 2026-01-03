#!/usr/bin/env node

/**
 * Performance Monitoring Script for Pitchey Platform
 * Tracks real-time metrics and generates alerts
 */

import axios from 'axios';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface PerformanceMetrics {
  timestamp: string;
  endpoint: string;
  responseTime: number;
  statusCode: number;
  cacheHit: boolean;
  errorMessage?: string;
  size?: number;
}

interface AggregatedMetrics {
  endpoint: string;
  avgResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  minResponseTime: number;
  maxResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  totalRequests: number;
  avgSize: number;
}

class PerformanceMonitor {
  private apiUrl: string;
  private metrics: PerformanceMetrics[] = [];
  private outputDir = join(process.cwd(), 'monitoring', 'performance');
  private alerts: string[] = [];
  
  // Thresholds for alerts
  private readonly thresholds = {
    maxResponseTime: 100, // ms
    maxP95: 200, // ms
    minCacheHitRate: 70, // %
    maxErrorRate: 5, // %
    maxBundleSize: 1048576, // 1MB in bytes
  };
  
  // Endpoints to monitor
  private readonly endpoints = [
    // Health checks
    { path: '/api/health', method: 'GET' },
    { path: '/api/health/detailed', method: 'GET' },
    
    // Browse endpoints
    { path: '/api/pitches/browse/enhanced', method: 'GET' },
    { path: '/api/pitches/browse/enhanced?limit=10&sort=trending', method: 'GET' },
    { path: '/api/pitches/browse/enhanced?genre=Action', method: 'GET' },
    
    // Search
    { path: '/api/pitches/search?q=test', method: 'GET' },
    
    // Dashboard stats (requires auth)
    { path: '/api/creator/dashboard/stats', method: 'GET', auth: true },
    { path: '/api/investor/dashboard/stats', method: 'GET', auth: true },
    
    // Profile
    { path: '/api/user/profile', method: 'GET', auth: true },
    
    // Pitches
    { path: '/api/pitches?limit=10', method: 'GET' },
    { path: '/api/pitches/stats', method: 'GET' },
  ];
  
  constructor(apiUrl: string = 'https://pitchey-api-prod.ndlovucavelle.workers.dev') {
    this.apiUrl = apiUrl;
    this.ensureOutputDir();
  }
  
  private ensureOutputDir(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }
  
  /**
   * Run performance test for a single endpoint
   */
  private async testEndpoint(
    endpoint: { path: string; method: string; auth?: boolean },
    iterations: number = 3
  ): Promise<void> {
    console.log(`Testing: ${endpoint.method} ${endpoint.path}`);
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        const headers: any = {
          'User-Agent': 'Pitchey-Performance-Monitor/1.0',
        };
        
        // Add auth header if required (using demo token)
        if (endpoint.auth) {
          headers['Authorization'] = 'Bearer demo-token-for-testing';
        }
        
        const response = await axios({
          method: endpoint.method,
          url: `${this.apiUrl}${endpoint.path}`,
          headers,
          timeout: 10000,
          validateStatus: () => true, // Don't throw on error status codes
        });
        
        const responseTime = Date.now() - startTime;
        const cacheHit = response.headers['x-cache'] === 'HIT';
        const contentLength = response.headers['content-length'];
        
        this.metrics.push({
          timestamp: new Date().toISOString(),
          endpoint: endpoint.path,
          responseTime,
          statusCode: response.status,
          cacheHit,
          size: contentLength ? parseInt(contentLength) : undefined,
          errorMessage: response.status >= 400 ? response.data?.error : undefined,
        });
        
        // Log result
        console.log(`  Iteration ${i + 1}: ${responseTime}ms, Status: ${response.status}, Cache: ${cacheHit ? 'HIT' : 'MISS'}`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        
        this.metrics.push({
          timestamp: new Date().toISOString(),
          endpoint: endpoint.path,
          responseTime,
          statusCode: error.response?.status || 0,
          cacheHit: false,
          errorMessage: error.message,
        });
        
        console.error(`  Iteration ${i + 1}: ERROR - ${error.message}`);
      }
    }
  }
  
  /**
   * Calculate aggregated metrics for each endpoint
   */
  private calculateAggregates(): Map<string, AggregatedMetrics> {
    const grouped = new Map<string, PerformanceMetrics[]>();
    
    // Group by endpoint
    this.metrics.forEach(metric => {
      if (!grouped.has(metric.endpoint)) {
        grouped.set(metric.endpoint, []);
      }
      grouped.get(metric.endpoint)!.push(metric);
    });
    
    const aggregates = new Map<string, AggregatedMetrics>();
    
    // Calculate aggregates for each endpoint
    grouped.forEach((metrics, endpoint) => {
      const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
      const successfulRequests = metrics.filter(m => m.statusCode < 400);
      const cacheHits = metrics.filter(m => m.cacheHit);
      const errors = metrics.filter(m => m.statusCode >= 400);
      const sizes = metrics.filter(m => m.size).map(m => m.size!);
      
      aggregates.set(endpoint, {
        endpoint,
        avgResponseTime: this.average(responseTimes),
        p50: this.percentile(responseTimes, 50),
        p95: this.percentile(responseTimes, 95),
        p99: this.percentile(responseTimes, 99),
        minResponseTime: Math.min(...responseTimes),
        maxResponseTime: Math.max(...responseTimes),
        cacheHitRate: (cacheHits.length / metrics.length) * 100,
        errorRate: (errors.length / metrics.length) * 100,
        totalRequests: metrics.length,
        avgSize: sizes.length > 0 ? this.average(sizes) : 0,
      });
    });
    
    return aggregates;
  }
  
  /**
   * Check metrics against thresholds and generate alerts
   */
  private checkThresholds(aggregates: Map<string, AggregatedMetrics>): void {
    aggregates.forEach((metrics, endpoint) => {
      // Check response time
      if (metrics.p95 > this.thresholds.maxP95) {
        this.alerts.push(
          `⚠️ HIGH P95 RESPONSE TIME: ${endpoint} - ${metrics.p95.toFixed(2)}ms (threshold: ${this.thresholds.maxP95}ms)`
        );
      }
      
      if (metrics.maxResponseTime > this.thresholds.maxResponseTime * 3) {
        this.alerts.push(
          `🔴 CRITICAL RESPONSE TIME: ${endpoint} - Max: ${metrics.maxResponseTime.toFixed(2)}ms`
        );
      }
      
      // Check cache hit rate
      if (metrics.cacheHitRate < this.thresholds.minCacheHitRate && !endpoint.includes('health')) {
        this.alerts.push(
          `⚠️ LOW CACHE HIT RATE: ${endpoint} - ${metrics.cacheHitRate.toFixed(1)}% (threshold: ${this.thresholds.minCacheHitRate}%)`
        );
      }
      
      // Check error rate
      if (metrics.errorRate > this.thresholds.maxErrorRate) {
        this.alerts.push(
          `🔴 HIGH ERROR RATE: ${endpoint} - ${metrics.errorRate.toFixed(1)}% (threshold: ${this.thresholds.maxErrorRate}%)`
        );
      }
      
      // Check response size
      if (metrics.avgSize > this.thresholds.maxBundleSize) {
        this.alerts.push(
          `⚠️ LARGE RESPONSE SIZE: ${endpoint} - ${(metrics.avgSize / 1024).toFixed(2)}KB`
        );
      }
    });
  }
  
  /**
   * Generate performance report
   */
  private generateReport(aggregates: Map<string, AggregatedMetrics>): void {
    const timestamp = new Date().toISOString();
    const reportPath = join(this.outputDir, `report-${timestamp.replace(/:/g, '-')}.json`);
    
    // Calculate overall metrics
    const allMetrics = Array.from(aggregates.values());
    const overallMetrics = {
      timestamp,
      overall: {
        avgResponseTime: this.average(allMetrics.map(m => m.avgResponseTime)),
        avgP95: this.average(allMetrics.map(m => m.p95)),
        avgCacheHitRate: this.average(allMetrics.map(m => m.cacheHitRate)),
        avgErrorRate: this.average(allMetrics.map(m => m.errorRate)),
        totalEndpoints: allMetrics.length,
        totalRequests: allMetrics.reduce((sum, m) => sum + m.totalRequests, 0),
      },
      endpoints: allMetrics,
      alerts: this.alerts,
      thresholds: this.thresholds,
    };
    
    // Write report
    writeFileSync(reportPath, JSON.stringify(overallMetrics, null, 2));
    console.log(`\n📊 Report saved to: ${reportPath}`);
    
    // Print summary
    console.log('\n=== Performance Summary ===');
    console.log(`Overall Avg Response Time: ${overallMetrics.overall.avgResponseTime.toFixed(2)}ms`);
    console.log(`Overall Avg P95: ${overallMetrics.overall.avgP95.toFixed(2)}ms`);
    console.log(`Overall Cache Hit Rate: ${overallMetrics.overall.avgCacheHitRate.toFixed(1)}%`);
    console.log(`Overall Error Rate: ${overallMetrics.overall.avgErrorRate.toFixed(1)}%`);
    
    // Print top 3 slowest endpoints
    console.log('\n🐌 Slowest Endpoints (P95):');
    const slowest = allMetrics.sort((a, b) => b.p95 - a.p95).slice(0, 3);
    slowest.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.endpoint}: ${m.p95.toFixed(2)}ms`);
    });
    
    // Print alerts
    if (this.alerts.length > 0) {
      console.log('\n🚨 Alerts:');
      this.alerts.forEach(alert => console.log(`  ${alert}`));
    } else {
      console.log('\n✅ No performance alerts!');
    }
  }
  
  /**
   * Test frontend bundle size
   */
  private async testBundleSize(): Promise<void> {
    console.log('\nTesting frontend bundle size...');
    
    try {
      const response = await axios.head('https://pitchey-5o8.pages.dev');
      const headers = response.headers;
      
      // Try to get bundle info from headers or make additional requests
      const mainJs = await axios.head('https://pitchey-5o8.pages.dev/assets/index.js');
      const mainCss = await axios.head('https://pitchey-5o8.pages.dev/assets/index.css');
      
      const jsSize = parseInt(mainJs.headers['content-length'] || '0');
      const cssSize = parseInt(mainCss.headers['content-length'] || '0');
      const totalSize = jsSize + cssSize;
      
      console.log(`  JS Bundle: ${(jsSize / 1024).toFixed(2)}KB`);
      console.log(`  CSS Bundle: ${(cssSize / 1024).toFixed(2)}KB`);
      console.log(`  Total: ${(totalSize / 1024).toFixed(2)}KB`);
      
      if (totalSize > this.thresholds.maxBundleSize) {
        this.alerts.push(
          `⚠️ LARGE BUNDLE SIZE: ${(totalSize / 1024).toFixed(2)}KB (threshold: ${(this.thresholds.maxBundleSize / 1024).toFixed(2)}KB)`
        );
      }
    } catch (error) {
      console.log('  Could not measure bundle size');
    }
  }
  
  /**
   * Run complete performance test
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Performance Monitor');
    console.log(`API URL: ${this.apiUrl}`);
    console.log(`Testing ${this.endpoints.length} endpoints...\n`);
    
    // Test each endpoint
    for (const endpoint of this.endpoints) {
      await this.testEndpoint(endpoint);
    }
    
    // Test bundle size
    await this.testBundleSize();
    
    // Calculate aggregates
    const aggregates = this.calculateAggregates();
    
    // Check thresholds
    this.checkThresholds(aggregates);
    
    // Generate report
    this.generateReport(aggregates);
  }
  
  /**
   * Continuous monitoring mode
   */
  async monitor(intervalMinutes: number = 5): Promise<void> {
    console.log(`📡 Starting continuous monitoring (every ${intervalMinutes} minutes)`);
    
    // Run initial test
    await this.run();
    
    // Schedule periodic tests
    setInterval(async () => {
      console.log(`\n⏰ Running scheduled test at ${new Date().toISOString()}`);
      this.metrics = []; // Clear previous metrics
      this.alerts = []; // Clear previous alerts
      await this.run();
    }, intervalMinutes * 60 * 1000);
  }
  
  // Utility functions
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }
  
  private percentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

// CLI execution
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'monitor') {
    const interval = parseInt(args[1]) || 5;
    monitor.monitor(interval);
  } else {
    monitor.run().then(() => {
      console.log('\n✨ Performance test complete!');
      process.exit(0);
    }).catch(error => {
      console.error('❌ Error during performance test:', error);
      process.exit(1);
    });
  }
}

export { PerformanceMonitor };