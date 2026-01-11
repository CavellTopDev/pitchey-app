#!/usr/bin/env node

/**
 * Performance Testing Script for Phase 1 Endpoints
 * Measures response times, error rates, and establishes baselines
 */

const API_URL = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
const TEST_EMAIL = 'alex.creator@demo.com';
const TEST_PASSWORD = 'Demo123';

// Performance metrics collector
class PerformanceCollector {
  constructor() {
    this.metrics = {
      endpoints: {},
      summary: {
        totalRequests: 0,
        totalErrors: 0,
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
      }
    };
  }

  recordRequest(endpoint, method, responseTime, status, error = null) {
    if (!this.metrics.endpoints[endpoint]) {
      this.metrics.endpoints[endpoint] = {
        method,
        requests: [],
        errors: [],
        successCount: 0,
        errorCount: 0,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const endpointMetrics = this.metrics.endpoints[endpoint];
    endpointMetrics.requests.push(responseTime);
    
    if (error || status >= 400) {
      endpointMetrics.errorCount++;
      endpointMetrics.errors.push({ status, error, responseTime });
    } else {
      endpointMetrics.successCount++;
    }

    // Update min/max
    endpointMetrics.minResponseTime = Math.min(endpointMetrics.minResponseTime, responseTime);
    endpointMetrics.maxResponseTime = Math.max(endpointMetrics.maxResponseTime, responseTime);
    
    this.metrics.summary.totalRequests++;
    if (error || status >= 400) {
      this.metrics.summary.totalErrors++;
    }
  }

  calculatePercentiles(values, percentile) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  finalize() {
    // Calculate per-endpoint stats
    for (const [endpoint, data] of Object.entries(this.metrics.endpoints)) {
      if (data.requests.length > 0) {
        data.avgResponseTime = data.requests.reduce((a, b) => a + b, 0) / data.requests.length;
        data.p50 = this.calculatePercentiles(data.requests, 50);
        data.p95 = this.calculatePercentiles(data.requests, 95);
        data.p99 = this.calculatePercentiles(data.requests, 99);
        data.errorRate = (data.errorCount / (data.successCount + data.errorCount)) * 100;
      }
    }

    // Calculate overall summary
    const allRequests = Object.values(this.metrics.endpoints).flatMap(e => e.requests);
    if (allRequests.length > 0) {
      this.metrics.summary.avgResponseTime = allRequests.reduce((a, b) => a + b, 0) / allRequests.length;
      this.metrics.summary.p50ResponseTime = this.calculatePercentiles(allRequests, 50);
      this.metrics.summary.p95ResponseTime = this.calculatePercentiles(allRequests, 95);
      this.metrics.summary.p99ResponseTime = this.calculatePercentiles(allRequests, 99);
      this.metrics.summary.errorRate = (this.metrics.summary.totalErrors / this.metrics.summary.totalRequests) * 100;
    }

    return this.metrics;
  }
}

// Test harness
class PerformanceTest {
  constructor() {
    this.collector = new PerformanceCollector();
    this.sessionCookie = null;
  }

  async measureRequest(endpoint, method = 'GET', body = null) {
    const startTime = performance.now();
    let status = 0;
    let error = null;

    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.sessionCookie && { 'Cookie': this.sessionCookie })
        },
        credentials: 'include',
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_URL}${endpoint}`, options);
      status = response.status;

      // Capture session cookie
      const setCookie = response.headers.get('set-cookie');
      if (setCookie && setCookie.includes('better-auth.session')) {
        this.sessionCookie = setCookie.split(';')[0];
      }

      if (!response.ok && status !== 404) {
        const text = await response.text();
        error = `HTTP ${status}: ${text.substring(0, 100)}`;
      }

      return { 
        status, 
        data: status === 200 ? await response.json().catch(() => null) : null,
        responseTime: performance.now() - startTime 
      };
    } catch (e) {
      error = e.message;
      return { 
        status: 0, 
        data: null, 
        responseTime: performance.now() - startTime,
        error 
      };
    } finally {
      this.collector.recordRequest(endpoint, method, performance.now() - startTime, status, error);
    }
  }

  async authenticate() {
    console.log('🔐 Authenticating...');
    const result = await this.measureRequest('/api/auth/sign-in', 'POST', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (result.status === 200) {
      console.log('✅ Authentication successful');
      return true;
    } else {
      console.error('❌ Authentication failed:', result.error || `Status ${result.status}`);
      return false;
    }
  }

  async testEndpoint(name, endpoint, method = 'GET', iterations = 10, body = null) {
    console.log(`\n📊 Testing ${name} (${iterations} iterations)...`);
    
    for (let i = 0; i < iterations; i++) {
      const result = await this.measureRequest(endpoint, method, body);
      
      if (i === 0) {
        console.log(`   First request: ${result.responseTime.toFixed(2)}ms (Status: ${result.status})`);
      }
      
      // Add small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const metrics = this.collector.metrics.endpoints[endpoint];
    if (metrics) {
      console.log(`   ✅ Avg: ${metrics.avgResponseTime.toFixed(2)}ms | P95: ${metrics.p95.toFixed(2)}ms | Errors: ${metrics.errorCount}`);
    }
  }

  async runTests() {
    console.log('🚀 Starting Phase 1 Endpoint Performance Tests');
    console.log('================================================\n');

    // Authenticate first
    if (!await this.authenticate()) {
      console.error('Failed to authenticate. Exiting.');
      return;
    }

    // Test each Phase 1 endpoint
    await this.testEndpoint('Active NDAs', '/api/ndas/active', 'GET', 10);
    await this.testEndpoint('Signed NDAs', '/api/ndas/signed', 'GET', 10);
    await this.testEndpoint('Incoming NDA Requests', '/api/ndas/incoming-requests', 'GET', 10);
    await this.testEndpoint('Outgoing NDA Requests', '/api/ndas/outgoing-requests', 'GET', 10);
    await this.testEndpoint('Saved Pitches', '/api/saved-pitches', 'GET', 10);
    await this.testEndpoint('Unread Notifications', '/api/notifications/unread', 'GET', 10);

    // Test save pitch endpoint (POST)
    await this.testEndpoint('Save Pitch', '/api/saved-pitches', 'POST', 5, {
      pitch_id: 'test-pitch-001',
      notes: 'Performance test'
    });

    // Test WebSocket connection establishment
    await this.testWebSocketConnection();

    // Generate final report
    const finalMetrics = this.collector.finalize();
    this.generateReport(finalMetrics);
  }

  async testWebSocketConnection() {
    console.log('\n🔌 Testing WebSocket Connection...');
    const startTime = performance.now();
    
    return new Promise((resolve) => {
      const ws = new WebSocket('wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws');
      
      ws.onopen = () => {
        const connectionTime = performance.now() - startTime;
        console.log(`   ✅ WebSocket connected in ${connectionTime.toFixed(2)}ms`);
        
        // Send auth message
        ws.send(JSON.stringify({
          type: 'auth',
          data: { sessionCookie: this.sessionCookie }
        }));
        
        // Test ping/pong
        const pingStart = performance.now();
        ws.send(JSON.stringify({ type: 'ping' }));
        
        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'pong') {
            const pingTime = performance.now() - pingStart;
            console.log(`   ✅ WebSocket ping/pong: ${pingTime.toFixed(2)}ms`);
          }
          ws.close();
          resolve();
        };
      };
      
      ws.onerror = (error) => {
        console.error('   ❌ WebSocket error:', error);
        resolve();
      };
      
      setTimeout(() => {
        ws.close();
        resolve();
      }, 5000);
    });
  }

  generateReport(metrics) {
    console.log('\n');
    console.log('=======================================================');
    console.log('              PERFORMANCE BASELINE REPORT               ');
    console.log('=======================================================\n');

    console.log('📊 OVERALL SUMMARY');
    console.log('------------------');
    console.log(`Total Requests: ${metrics.summary.totalRequests}`);
    console.log(`Total Errors: ${metrics.summary.totalErrors}`);
    console.log(`Error Rate: ${metrics.summary.errorRate?.toFixed(2) || 0}%`);
    console.log(`Average Response Time: ${metrics.summary.avgResponseTime?.toFixed(2) || 0}ms`);
    console.log(`P50 Response Time: ${metrics.summary.p50ResponseTime?.toFixed(2) || 0}ms`);
    console.log(`P95 Response Time: ${metrics.summary.p95ResponseTime?.toFixed(2) || 0}ms`);
    console.log(`P99 Response Time: ${metrics.summary.p99ResponseTime?.toFixed(2) || 0}ms`);

    console.log('\n📈 ENDPOINT PERFORMANCE');
    console.log('------------------------');
    
    // Sort endpoints by average response time
    const sortedEndpoints = Object.entries(metrics.endpoints)
      .sort(([, a], [, b]) => b.avgResponseTime - a.avgResponseTime);

    for (const [endpoint, data] of sortedEndpoints) {
      console.log(`\n${endpoint} (${data.method})`);
      console.log(`  Success: ${data.successCount} | Errors: ${data.errorCount} | Error Rate: ${data.errorRate?.toFixed(2) || 0}%`);
      console.log(`  Avg: ${data.avgResponseTime?.toFixed(2)}ms | Min: ${data.minResponseTime?.toFixed(2)}ms | Max: ${data.maxResponseTime?.toFixed(2)}ms`);
      console.log(`  P50: ${data.p50?.toFixed(2)}ms | P95: ${data.p95?.toFixed(2)}ms | P99: ${data.p99?.toFixed(2)}ms`);
      
      if (data.errors.length > 0) {
        console.log(`  ⚠️  Errors: ${data.errors.map(e => e.status || e.error).join(', ')}`);
      }
    }

    console.log('\n🎯 PERFORMANCE TARGETS');
    console.log('----------------------');
    const p95Target = 200;
    const errorRateTarget = 1;
    
    const meetsP95 = metrics.summary.p95ResponseTime <= p95Target;
    const meetsErrorRate = metrics.summary.errorRate <= errorRateTarget;
    
    console.log(`P95 < ${p95Target}ms: ${meetsP95 ? '✅ PASS' : '❌ FAIL'} (${metrics.summary.p95ResponseTime?.toFixed(2)}ms)`);
    console.log(`Error Rate < ${errorRateTarget}%: ${meetsErrorRate ? '✅ PASS' : '❌ FAIL'} (${metrics.summary.errorRate?.toFixed(2)}%)`);

    console.log('\n💡 OPTIMIZATION RECOMMENDATIONS');
    console.log('--------------------------------');
    
    // Find slow endpoints
    const slowEndpoints = Object.entries(metrics.endpoints)
      .filter(([, data]) => data.p95 > p95Target)
      .map(([endpoint]) => endpoint);
    
    if (slowEndpoints.length > 0) {
      console.log(`⚠️  Slow endpoints (P95 > ${p95Target}ms):`);
      slowEndpoints.forEach(endpoint => {
        console.log(`   - ${endpoint}`);
      });
    }
    
    // Recommend caching
    const cacheCandidates = Object.entries(metrics.endpoints)
      .filter(([endpoint]) => endpoint.includes('/api/ndas/') || endpoint.includes('/api/saved-pitches'))
      .map(([endpoint]) => endpoint);
    
    if (cacheCandidates.length > 0) {
      console.log('\n📦 Recommended for caching:');
      cacheCandidates.forEach(endpoint => {
        console.log(`   - ${endpoint} (TTL: 5 minutes)`);
      });
    }

    // Save metrics to JSON file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-baseline-${timestamp}.json`;
    require('fs').writeFileSync(filename, JSON.stringify(metrics, null, 2));
    console.log(`\n📁 Full metrics saved to: ${filename}`);
  }
}

// Run tests
const test = new PerformanceTest();
test.runTests().catch(console.error);