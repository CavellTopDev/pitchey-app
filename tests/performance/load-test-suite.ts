/**
 * Comprehensive Performance Testing Suite
 * Tests API endpoints, WebSocket connections, and database operations under load
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.210.0/assert/mod.ts";

interface LoadTestConfig {
  baseUrl: string;
  duration: number; // seconds
  virtualUsers: number;
  rampUpTime: number; // seconds
  thresholds: {
    responseTime: number; // ms
    errorRate: number; // percentage
    throughput: number; // requests per second
  };
}

interface TestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  passed: boolean;
}

export class LoadTestSuite {
  private results: TestResult[] = [];
  private responseTimes: Map<string, number[]> = new Map();

  constructor(private config: LoadTestConfig) {}

  /**
   * Run complete load test suite
   */
  async runFullSuite() {
    console.log('🚀 Starting Performance Test Suite');
    console.log(`Configuration: ${this.config.virtualUsers} users, ${this.config.duration}s duration`);
    
    // Test different scenarios
    await this.testHomepageLoad();
    await this.testAPIEndpoints();
    await this.testAuthentication();
    await this.testPitchOperations();
    await this.testWebSocketConnections();
    await this.testFileUploads();
    await this.testSearchAndFilter();
    await this.testConcurrentOperations();

    // Generate report
    this.generateReport();
  }

  /**
   * Test homepage and static content loading
   */
  async testHomepageLoad() {
    console.log('\n📊 Testing Homepage Load...');
    
    const endpoints = [
      '/',
      '/api/pitches/trending',
      '/api/pitches/featured',
      '/api/genres'
    ];

    for (const endpoint of endpoints) {
      await this.loadTest(endpoint, {
        virtualUsers: this.config.virtualUsers,
        duration: 30,
        rampUp: 5
      });
    }
  }

  /**
   * Test API endpoint performance
   */
  async testAPIEndpoints() {
    console.log('\n📊 Testing API Endpoints...');
    
    const endpoints = [
      { path: '/api/pitches', method: 'GET', params: 'page=1&limit=20' },
      { path: '/api/pitches/search', method: 'GET', params: 'q=action' },
      { path: '/api/users/profile', method: 'GET', auth: true },
      { path: '/api/notifications', method: 'GET', auth: true },
      { path: '/health', method: 'GET' }
    ];

    for (const endpoint of endpoints) {
      await this.loadTestEndpoint(endpoint);
    }
  }

  /**
   * Test authentication flow under load
   */
  async testAuthentication() {
    console.log('\n📊 Testing Authentication Flow...');
    
    const authFlows = [
      { portal: 'creator', email: 'test.creator@demo.com' },
      { portal: 'investor', email: 'test.investor@demo.com' },
      { portal: 'production', email: 'test.production@demo.com' }
    ];

    const promises = authFlows.map(flow => this.testAuthFlow(flow));
    await Promise.all(promises);
  }

  /**
   * Test pitch CRUD operations
   */
  async testPitchOperations() {
    console.log('\n📊 Testing Pitch Operations...');
    
    // Get auth token first
    const token = await this.getAuthToken();
    
    // Test pitch creation
    await this.loadTestEndpoint({
      path: '/api/pitches',
      method: 'POST',
      auth: true,
      body: {
        title: 'Load Test Pitch',
        logline: 'A pitch created during load testing',
        genre: 'Action',
        status: 'draft'
      }
    });

    // Test pitch updates
    await this.loadTestEndpoint({
      path: '/api/pitches/1',
      method: 'PUT',
      auth: true,
      body: {
        title: 'Updated Load Test Pitch'
      }
    });
  }

  /**
   * Test WebSocket connections and messaging
   */
  async testWebSocketConnections() {
    console.log('\n📊 Testing WebSocket Connections...');
    
    const connections: WebSocket[] = [];
    const targetConnections = Math.min(this.config.virtualUsers, 100);
    
    // Create concurrent WebSocket connections
    for (let i = 0; i < targetConnections; i++) {
      const ws = new WebSocket(`${this.config.baseUrl.replace('http', 'ws')}/ws`);
      connections.push(ws);
      
      ws.onopen = () => {
        // Send periodic messages
        setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ping',
              timestamp: Date.now()
            }));
          }
        }, 5000);
      };
    }

    // Keep connections open for test duration
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Close all connections
    connections.forEach(ws => ws.close());
    
    console.log(`✓ Tested ${targetConnections} concurrent WebSocket connections`);
  }

  /**
   * Test file upload performance
   */
  async testFileUploads() {
    console.log('\n📊 Testing File Uploads...');
    
    const token = await this.getAuthToken();
    const file = new Blob(['Test file content'.repeat(1000)], { type: 'application/pdf' });
    
    const formData = new FormData();
    formData.append('file', file, 'test.pdf');
    formData.append('type', 'pitch_deck');

    await this.loadTestEndpoint({
      path: '/api/upload',
      method: 'POST',
      auth: true,
      body: formData,
      contentType: 'multipart/form-data'
    });
  }

  /**
   * Test search and filtering operations
   */
  async testSearchAndFilter() {
    console.log('\n📊 Testing Search and Filter...');
    
    const searchQueries = [
      'action',
      'comedy',
      'thriller',
      'sci-fi',
      'romance'
    ];

    const promises = searchQueries.map(query => 
      this.loadTestEndpoint({
        path: '/api/pitches/search',
        method: 'GET',
        params: `q=${query}&genre=all&sort=relevance`
      })
    );

    await Promise.all(promises);
  }

  /**
   * Test concurrent mixed operations
   */
  async testConcurrentOperations() {
    console.log('\n📊 Testing Concurrent Operations...');
    
    const operations = [
      () => this.makeRequest('/api/pitches/trending'),
      () => this.makeRequest('/api/pitches/featured'),
      () => this.makeAuthenticatedRequest('/api/users/profile'),
      () => this.makeRequest('/api/genres'),
      () => this.makeRequest('/health')
    ];

    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    // Generate concurrent load
    while (Date.now() - startTime < 30000) {
      for (let i = 0; i < this.config.virtualUsers; i++) {
        const operation = operations[Math.floor(Math.random() * operations.length)];
        promises.push(operation().catch(() => {})); // Ignore individual failures
      }
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between batches
    }

    await Promise.all(promises);
    console.log(`✓ Completed concurrent operations test`);
  }

  /**
   * Generic load test for an endpoint
   */
  private async loadTest(endpoint: string, options: any) {
    const url = `${this.config.baseUrl}${endpoint}`;
    const times: number[] = [];
    let successful = 0;
    let failed = 0;

    const startTime = Date.now();
    const promises: Promise<void>[] = [];

    // Ramp up virtual users
    for (let i = 0; i < options.virtualUsers; i++) {
      await new Promise(resolve => setTimeout(resolve, (options.rampUp * 1000) / options.virtualUsers));
      
      promises.push(
        this.runUserSession(url, options.duration * 1000, times, () => successful++, () => failed++)
      );
    }

    await Promise.all(promises);

    // Calculate metrics
    const result = this.calculateMetrics(endpoint, times, successful, failed);
    this.results.push(result);
    
    // Store response times for analysis
    this.responseTimes.set(endpoint, times);

    return result;
  }

  /**
   * Load test a specific endpoint configuration
   */
  private async loadTestEndpoint(config: any) {
    const url = `${this.config.baseUrl}${config.path}${config.params ? '?' + config.params : ''}`;
    const times: number[] = [];
    let successful = 0;
    let failed = 0;

    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < this.config.virtualUsers; i++) {
      promises.push(
        this.makeRequestWithMetrics(url, config, times, () => successful++, () => failed++)
      );
    }

    await Promise.all(promises);

    const result = this.calculateMetrics(config.path, times, successful, failed);
    this.results.push(result);
    return result;
  }

  /**
   * Run a single user session
   */
  private async runUserSession(
    url: string,
    duration: number,
    times: number[],
    onSuccess: () => void,
    onFailure: () => void
  ) {
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      const start = Date.now();
      try {
        const response = await fetch(url);
        if (response.ok) {
          onSuccess();
        } else {
          onFailure();
        }
      } catch {
        onFailure();
      }
      times.push(Date.now() - start);
      
      // Random think time between requests (100-500ms)
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
    }
  }

  /**
   * Make request and track metrics
   */
  private async makeRequestWithMetrics(
    url: string,
    config: any,
    times: number[],
    onSuccess: () => void,
    onFailure: () => void
  ) {
    const start = Date.now();
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (config.auth) {
        headers['Authorization'] = `Bearer ${await this.getAuthToken()}`;
      }

      const response = await fetch(url, {
        method: config.method || 'GET',
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined
      });

      if (response.ok) {
        onSuccess();
      } else {
        onFailure();
      }
    } catch {
      onFailure();
    }
    times.push(Date.now() - start);
  }

  /**
   * Test authentication flow
   */
  private async testAuthFlow(flow: any) {
    const times: number[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      try {
        const response = await fetch(`${this.config.baseUrl}/api/auth/${flow.portal}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: flow.email,
            password: 'Demo123'
          })
        });

        if (response.ok) {
          successful++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      times.push(Date.now() - start);
    }

    const result = this.calculateMetrics(`auth/${flow.portal}`, times, successful, failed);
    this.results.push(result);
  }

  /**
   * Calculate metrics from response times
   */
  private calculateMetrics(
    endpoint: string,
    times: number[],
    successful: number,
    failed: number
  ): TestResult {
    times.sort((a, b) => a - b);
    
    const total = successful + failed;
    const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
    const p95ResponseTime = times[Math.floor(times.length * 0.95)] || 0;
    const p99ResponseTime = times[Math.floor(times.length * 0.99)] || 0;
    const errorRate = (failed / total) * 100;
    const throughput = total / (this.config.duration || 30);

    const passed = 
      avgResponseTime < this.config.thresholds.responseTime &&
      errorRate < this.config.thresholds.errorRate &&
      throughput > this.config.thresholds.throughput;

    return {
      endpoint,
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      throughput,
      errorRate,
      passed
    };
  }

  /**
   * Helper methods for making requests
   */
  private async makeRequest(url: string): Promise<Response> {
    return fetch(`${this.config.baseUrl}${url}`);
  }

  private async makeAuthenticatedRequest(url: string): Promise<Response> {
    const token = await this.getAuthToken();
    return fetch(`${this.config.baseUrl}${url}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }

  private async getAuthToken(): Promise<string> {
    // Login to get a token (cached)
    if (!this.authToken) {
      const response = await fetch(`${this.config.baseUrl}/api/auth/creator/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alex.creator@demo.com',
          password: 'Demo123'
        })
      });
      const data = await response.json();
      this.authToken = data.token || 'dummy-token';
    }
    return this.authToken;
  }
  private authToken?: string;

  /**
   * Generate performance test report
   */
  private generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE TEST RESULTS');
    console.log('='.repeat(80));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log(`\n✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('\nDetailed Results:');
    console.log('-'.repeat(80));

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`
${status} ${result.endpoint}
   Total Requests: ${result.totalRequests}
   Successful: ${result.successfulRequests} | Failed: ${result.failedRequests}
   Avg Response Time: ${result.avgResponseTime.toFixed(2)}ms
   P95 Response Time: ${result.p95ResponseTime.toFixed(2)}ms
   P99 Response Time: ${result.p99ResponseTime.toFixed(2)}ms
   Throughput: ${result.throughput.toFixed(2)} req/s
   Error Rate: ${result.errorRate.toFixed(2)}%
      `);
    });

    console.log('='.repeat(80));
    
    // Save results to file
    this.saveResults();
  }

  /**
   * Save test results to JSON file
   */
  private saveResults() {
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      summary: {
        totalTests: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        avgResponseTime: this.results.reduce((a, r) => a + r.avgResponseTime, 0) / this.results.length,
        avgThroughput: this.results.reduce((a, r) => a + r.throughput, 0) / this.results.length
      },
      results: this.results,
      responseTimes: Object.fromEntries(this.responseTimes)
    };

    Deno.writeTextFileSync(
      `performance-report-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );

    console.log('\n📄 Report saved to performance-report-*.json');
  }
}

// Run tests if executed directly
if (import.meta.main) {
  const config: LoadTestConfig = {
    baseUrl: Deno.env.get('LOAD_TEST_URL') || 'https://pitchey-production.cavelltheleaddev.workers.dev',
    duration: parseInt(Deno.env.get('TEST_DURATION') || '60'),
    virtualUsers: parseInt(Deno.env.get('VIRTUAL_USERS') || '50'),
    rampUpTime: parseInt(Deno.env.get('RAMP_UP_TIME') || '10'),
    thresholds: {
      responseTime: parseInt(Deno.env.get('THRESHOLD_RESPONSE_TIME') || '2000'),
      errorRate: parseFloat(Deno.env.get('THRESHOLD_ERROR_RATE') || '1'),
      throughput: parseFloat(Deno.env.get('THRESHOLD_THROUGHPUT') || '10')
    }
  };

  const suite = new LoadTestSuite(config);
  await suite.runFullSuite();
}