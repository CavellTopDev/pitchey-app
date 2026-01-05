#!/usr/bin/env deno run --allow-net --allow-env

/**
 * Container Endpoints Test Suite
 * Tests the integration of container services with production API
 */

const API_URL = "https://pitchey-api-prod.ndlovucavelle.workers.dev";

interface TestResult {
  endpoint: string;
  method: string;
  status: 'pass' | 'fail' | 'skip';
  responseTime: number;
  statusCode?: number;
  error?: string;
  note?: string;
}

class ContainerEndpointTester {
  private results: TestResult[] = [];

  private async testEndpoint(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: any,
    headers?: Record<string, string>
  ): Promise<TestResult> {
    const fullUrl = `${API_URL}${endpoint}`;
    const startTime = performance.now();

    try {
      const requestInit: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        requestInit.body = JSON.stringify(body);
      }

      console.log(`Testing ${method} ${endpoint}...`);
      const response = await fetch(fullUrl, requestInit);
      const responseTime = Math.round(performance.now() - startTime);

      const result: TestResult = {
        endpoint,
        method,
        status: response.ok ? 'pass' : 'fail',
        responseTime,
        statusCode: response.status,
      };

      if (!response.ok) {
        const errorText = await response.text();
        result.error = `${response.status} ${response.statusText} - ${errorText.substring(0, 100)}`;
      } else {
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          result.note = `Response size: ${contentLength} bytes`;
        }
      }

      return result;
    } catch (error) {
      const responseTime = Math.round(performance.now() - startTime);
      return {
        endpoint,
        method,
        status: 'fail',
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async runTests(): Promise<void> {
    console.log('🧪 Container Endpoints Test Suite');
    console.log(`Testing API: ${API_URL}`);
    console.log('=' + '='.repeat(60));

    // Test 1: Health checks
    console.log('\n📊 Health Check Endpoints');
    this.results.push(await this.testEndpoint('/api/health'));
    this.results.push(await this.testEndpoint('/api/containers/metrics/health'));
    this.results.push(await this.testEndpoint('/api/containers/metrics/dashboard'));
    this.results.push(await this.testEndpoint('/api/containers/metrics/performance'));

    // Test 2: Job management endpoints
    console.log('\n⚙️ Job Management Endpoints');
    this.results.push(await this.testEndpoint('/api/containers/jobs'));
    
    // Create a test job to get a job ID for further tests
    const testJobResult = await this.testEndpoint('/api/containers/jobs', 'POST', {
      type: 'test',
      description: 'Container endpoint test job',
      metadata: { test: true }
    });
    this.results.push(testJobResult);

    // Test 3: Processing endpoints (POST requests)
    console.log('\n🎬 Processing Endpoints');
    this.results.push(await this.testEndpoint('/api/containers/process/video', 'POST', {
      test: true,
      videoFile: 'test_video_url',
      quality: '720p'
    }));

    this.results.push(await this.testEndpoint('/api/containers/process/document', 'POST', {
      test: true,
      documentFile: 'test_document_url',
      outputFormat: 'pdf'
    }));

    this.results.push(await this.testEndpoint('/api/containers/process/ai', 'POST', {
      test: true,
      type: 'sentiment-analysis',
      inputText: 'This is a test sentence for AI processing.'
    }));

    this.results.push(await this.testEndpoint('/api/containers/process/media', 'POST', {
      test: true,
      mediaFile: 'test_media_url',
      outputFormat: 'mp4'
    }));

    this.results.push(await this.testEndpoint('/api/containers/process/code', 'POST', {
      test: true,
      language: 'javascript',
      code: 'console.log("Hello, World!");'
    }));

    // Test 4: Container management (likely require production portal access)
    console.log('\n🐳 Container Management Endpoints');
    this.results.push(await this.testEndpoint('/api/containers/instances'));
    this.results.push(await this.testEndpoint('/api/containers/config'));

    // Test 5: Cost optimization endpoints
    console.log('\n💰 Cost Optimization Endpoints');
    this.results.push(await this.testEndpoint('/api/containers/optimization/recommendations'));
    this.results.push(await this.testEndpoint('/api/containers/budgets'));

    // Test 6: WebSocket endpoint (connection test only)
    console.log('\n🔌 WebSocket Endpoint');
    await this.testWebSocket();

    this.printReport();
  }

  private async testWebSocket(): Promise<void> {
    const wsUrl = `${API_URL.replace('https://', 'wss://')}/api/containers/ws`;
    const startTime = performance.now();

    try {
      console.log(`Testing WebSocket ${wsUrl}...`);
      
      const ws = new WebSocket(wsUrl);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(void 0);
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });

      const responseTime = Math.round(performance.now() - startTime);
      this.results.push({
        endpoint: '/api/containers/ws',
        method: 'WS',
        status: 'pass',
        responseTime,
        note: 'WebSocket connection successful'
      });
    } catch (error) {
      const responseTime = Math.round(performance.now() - startTime);
      this.results.push({
        endpoint: '/api/containers/ws',
        method: 'WS',
        status: 'fail',
        responseTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private printReport(): void {
    console.log('\n' + '='.repeat(70));
    console.log('📋 TEST REPORT');
    console.log('='.repeat(70));

    const passed = this.results.filter(r => r.status === 'pass');
    const failed = this.results.filter(r => r.status === 'fail');
    const skipped = this.results.filter(r => r.status === 'skip');

    console.log(`\n📊 Summary:`);
    console.log(`✅ Passed: ${passed.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`⏸️  Skipped: ${skipped.length}`);
    console.log(`📈 Total: ${this.results.length}`);

    if (passed.length > 0) {
      console.log(`\n✅ PASSED TESTS:`);
      passed.forEach(result => {
        console.log(
          `  ${result.method.padEnd(6)} ${result.endpoint.padEnd(40)} ` +
          `${result.responseTime}ms ${result.statusCode ? `(${result.statusCode})` : ''}`
        );
        if (result.note) {
          console.log(`         ${result.note}`);
        }
      });
    }

    if (failed.length > 0) {
      console.log(`\n❌ FAILED TESTS:`);
      failed.forEach(result => {
        console.log(
          `  ${result.method.padEnd(6)} ${result.endpoint.padEnd(40)} ` +
          `${result.responseTime}ms ${result.statusCode ? `(${result.statusCode})` : ''}`
        );
        if (result.error) {
          console.log(`         Error: ${result.error}`);
        }
      });
    }

    console.log('\n🔍 Analysis:');
    
    if (passed.length === 0) {
      console.log('❗ No container endpoints are responding. This may indicate:');
      console.log('   - Container services are not yet deployed');
      console.log('   - Worker is not deployed with container integration');
      console.log('   - API URL is incorrect');
    } else if (failed.length === 0) {
      console.log('🎉 All container endpoints are working perfectly!');
    } else {
      console.log('⚠️  Some container endpoints are not working. This is expected for:');
      console.log('   - Endpoints requiring authentication (production portal access)');
      console.log('   - Container instances that may not be deployed yet');
      console.log('   - Processing endpoints that require actual container backends');
    }

    const avgResponseTime = this.results.reduce((acc, r) => acc + r.responseTime, 0) / this.results.length;
    console.log(`\n⏱️  Average response time: ${Math.round(avgResponseTime)}ms`);

    if (failed.length > passed.length) {
      console.log('\n🚨 Recommendation: Deploy container services using deploy-production-containers.sh');
    } else {
      console.log('\n✨ Container service integration looks good!');
    }

    console.log('\n🚀 Next Steps:');
    console.log('   1. Run deploy-production-containers.sh to deploy container services');
    console.log('   2. Test with actual file uploads and processing requests');
    console.log('   3. Monitor job processing and WebSocket updates');
    console.log('   4. Set up container instances for video/document processing');
  }
}

// Run tests
if (import.meta.main) {
  const tester = new ContainerEndpointTester();
  await tester.runTests();
}