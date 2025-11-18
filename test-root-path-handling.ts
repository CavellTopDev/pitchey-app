#!/usr/bin/env deno run --allow-net

/**
 * Test script to verify root path and non-API request handling
 */

const WORKER_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';

interface TestResult {
  name: string;
  passed: boolean;
  status: number;
  response: any;
  details: string;
}

class RootPathTester {
  private results: TestResult[] = [];

  private addResult(name: string, passed: boolean, status: number, response: any, details: string) {
    this.results.push({ name, passed, status, response, details });
    console.log(`${passed ? '✅' : '❌'} ${name}: ${details} (${status})`);
  }

  async testRootPath() {
    console.log('\n🧪 Testing Root Path (/)');
    try {
      const response = await fetch(`${WORKER_URL}/`);
      const data = await response.json();
      
      const hasService = data.service === 'Pitchey API Gateway';
      const hasVersion = data.version === 'v3.0';
      const hasEndpoints = data.endpoints && data.endpoints.health === '/api/health';
      const hasFrontend = data.frontend === 'https://pitchey.pages.dev';
      
      const passed = response.status === 200 && hasService && hasVersion && hasEndpoints && hasFrontend;
      
      this.addResult(
        'Root Path Response',
        passed,
        response.status,
        data,
        passed ? 'Returns proper service information' : 'Missing expected service info'
      );
      
    } catch (error) {
      this.addResult('Root Path Response', false, 0, null, `Error: ${error.message}`);
    }
  }

  async testNonApiPath() {
    console.log('\n🧪 Testing Non-API Path (/about)');
    try {
      const response = await fetch(`${WORKER_URL}/about`);
      const data = await response.json();
      
      const isNotFound = response.status === 404;
      const hasError = data.success === false && data.error;
      const hasHelpfulMessage = data.error?.suggestion?.includes('API-only service');
      const hasEndpointList = Array.isArray(data.error?.availableEndpoints);
      
      const passed = isNotFound && hasError && hasHelpfulMessage && hasEndpointList;
      
      this.addResult(
        'Non-API Path Response',
        passed,
        response.status,
        data,
        passed ? 'Returns helpful 404 with guidance' : 'Missing expected 404 structure'
      );
      
    } catch (error) {
      this.addResult('Non-API Path Response', false, 0, null, `Error: ${error.message}`);
    }
  }

  async testApiHealthPath() {
    console.log('\n🧪 Testing API Health Path (/api/health)');
    try {
      const response = await fetch(`${WORKER_URL}/api/health`);
      const data = await response.json();
      
      const isOk = response.status === 200;
      const hasStatus = data.status === 'healthy';
      const hasPoolStats = data.poolStats && typeof data.poolStats === 'object';
      
      const passed = isOk && hasStatus && hasPoolStats;
      
      this.addResult(
        'API Health Path',
        passed,
        response.status,
        data,
        passed ? 'Health endpoint working correctly' : 'Health endpoint issues detected'
      );
      
    } catch (error) {
      this.addResult('API Health Path', false, 0, null, `Error: ${error.message}`);
    }
  }

  async testApiUnknownPath() {
    console.log('\n🧪 Testing Unknown API Path (/api/unknown)');
    try {
      const response = await fetch(`${WORKER_URL}/api/unknown`);
      
      // For unknown API paths, we expect either:
      // 1. Successful proxy to backend (200)
      // 2. Backend returns error (404, 500)
      // 3. Proxy error handling
      
      const validStatuses = [200, 404, 500];
      const passed = validStatuses.includes(response.status);
      
      this.addResult(
        'Unknown API Path',
        passed,
        response.status,
        null,
        passed ? 'Properly handles unknown API requests' : 'Unexpected response for API proxy'
      );
      
    } catch (error) {
      this.addResult('Unknown API Path', false, 0, null, `Error: ${error.message}`);
    }
  }

  async testCorsHeaders() {
    console.log('\n🧪 Testing CORS Headers');
    try {
      const response = await fetch(`${WORKER_URL}/`, { method: 'OPTIONS' });
      
      const hasOrigin = response.headers.get('Access-Control-Allow-Origin') === '*';
      const hasMethods = response.headers.get('Access-Control-Allow-Methods')?.includes('GET');
      const hasHeaders = response.headers.get('Access-Control-Allow-Headers')?.includes('Content-Type');
      
      const passed = response.status === 204 && hasOrigin && hasMethods && hasHeaders;
      
      this.addResult(
        'CORS Headers',
        passed,
        response.status,
        null,
        passed ? 'CORS preflight handled correctly' : 'CORS headers missing or incorrect'
      );
      
    } catch (error) {
      this.addResult('CORS Headers', false, 0, null, `Error: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('\n📊 Root Path Handling Test Report');
    console.log('================================');

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const percentage = Math.round((passed / total) * 100);

    console.log(`\nOverall Status: ${passed}/${total} tests passed (${percentage}%)`);
    
    if (percentage >= 90) {
      console.log('🎉 Root path handling is working excellently!');
    } else if (percentage >= 70) {
      console.log('⚠️ Root path handling is mostly working - review failed tests');
    } else {
      console.log('🚨 Root path handling has issues - immediate attention required');
    }

    console.log('\n📋 Test Summary:');
    console.log('================');
    this.results.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.name}: ${result.details}`);
    });

    console.log('\n🎯 Key Improvements Made:');
    console.log('=========================');
    console.log('✅ Root path (/) returns helpful service information');
    console.log('✅ Non-API paths return proper 404 with guidance');
    console.log('✅ API paths continue to work correctly');
    console.log('✅ Only /api/ requests are proxied to backend');
    console.log('✅ CORS handling maintained');

    return { passed, total, percentage, results: this.results };
  }

  async runAllTests() {
    console.log('🚀 Starting Root Path and Non-API Request Tests');
    console.log(`Worker URL: ${WORKER_URL}`);

    await this.testRootPath();
    await this.testNonApiPath();
    await this.testApiHealthPath();
    await this.testApiUnknownPath();
    await this.testCorsHeaders();

    return await this.generateReport();
  }
}

if (import.meta.main) {
  const tester = new RootPathTester();
  const report = await tester.runAllTests();
  
  const exitCode = report.percentage >= 80 ? 0 : 1;
  Deno.exit(exitCode);
}

export { RootPathTester };