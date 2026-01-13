/**
 * Pitchey Platform Synthetic Monitoring Worker
 * 
 * Continuously tests critical platform functionality and reports results
 * to Analytics Engine for dashboards and alerting.
 * 
 * Deploy this Worker separately for synthetic monitoring:
 * wrangler deploy monitoring/synthetic-worker.ts --name pitchey-synthetic-monitor
 */

interface Env {
  // Analytics Engine binding for storing test results
  ANALYTICS: AnalyticsEngineDataset;
  
  // KV binding for storing test history
  MONITORING_KV: KVNamespace;
  
  // Alert webhook URL for failures
  ALERT_WEBHOOK?: string;
  
  // Platform configuration
  API_BASE_URL: string;
  ENVIRONMENT: string;
}

interface TestResult {
  test: string;
  success: boolean;
  response_time?: number;
  status_code?: number;
  error?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
  performance?: {
    latency_ms: number;
    connections_active: number;
    connections_max: number;
  };
  details?: Record<string, any>;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/run-tests') {
      return this.runAllTests(env, ctx);
    }
    
    if (url.pathname === '/test-results') {
      return this.getTestResults(env);
    }
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'synthetic-monitoring' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Pitchey Synthetic Monitoring Worker', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Running scheduled synthetic tests');
    await this.runAllTests(env, ctx);
  },

  async runAllTests(env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    const results: TestResult[] = [];
    
    // Run all test suites in parallel
    const [
      healthTests,
      authTests,
      apiTests,
      analyticsTests,
      performanceTests
    ] = await Promise.all([
      this.runHealthTests(env),
      this.runAuthTests(env),
      this.runAPITests(env),
      this.runAnalyticsTests(env),
      this.runPerformanceTests(env)
    ]);
    
    results.push(...healthTests, ...authTests, ...apiTests, ...analyticsTests, ...performanceTests);
    
    // Store results in Analytics Engine
    const dataPoints = results.map(result => ({
      blobs: [result.test, env.ENVIRONMENT],
      doubles: [
        result.success ? 1 : 0, // success metric
        result.response_time || 0, // response time
        result.status_code || 0 // HTTP status
      ],
      indexes: [result.test]
    }));
    
    if (dataPoints.length > 0) {
      env.ANALYTICS.writeDataPoint({
        blobs: ['synthetic-monitoring', 'batch'],
        doubles: [results.length, results.filter(r => r.success).length],
        indexes: ['synthetic-tests']
      });
      
      for (const dataPoint of dataPoints) {
        env.ANALYTICS.writeDataPoint(dataPoint);
      }
    }
    
    // Store detailed results in KV
    await env.MONITORING_KV.put(
      `synthetic-${Date.now()}`,
      JSON.stringify(results),
      { expirationTtl: 86400 * 7 } // Keep for 7 days
    );
    
    // Check for failures and send alerts
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      await this.sendFailureAlert(env, failures);
    }
    
    const duration = Date.now() - startTime;
    const summary = {
      total_tests: results.length,
      passed: results.filter(r => r.success).length,
      failed: failures.length,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
      results: results
    };
    
    return new Response(JSON.stringify(summary, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  },

  async runHealthTests(env: Env): Promise<TestResult[]> {
    const tests = [
      { name: 'database_health', endpoint: '/api/health/database' },
      { name: 'overall_health', endpoint: '/api/health' },
      { name: 'worker_health', endpoint: '/api/health/worker' }
    ];
    
    const results: TestResult[] = [];
    
    for (const test of tests) {
      try {
        const startTime = performance.now();
        const response = await fetch(`${env.API_BASE_URL}${test.endpoint}`, {
          method: 'GET',
          headers: { 'User-Agent': 'PitcheySyntheticMonitor/1.0' },
          cf: { cacheTtl: 0 } // Bypass cache for accurate testing
        });
        const endTime = performance.now();
        
        let healthData: HealthCheckResponse | null = null;
        try {
          healthData = await response.json() as HealthCheckResponse;
        } catch (e) {
          // Response might not be JSON
        }
        
        results.push({
          test: test.name,
          success: response.ok && (healthData?.status === 'healthy' || healthData?.status === undefined),
          response_time: endTime - startTime,
          status_code: response.status,
          timestamp: new Date().toISOString(),
          metadata: {
            health_status: healthData?.status,
            health_score: healthData?.score,
            latency: healthData?.performance?.latency_ms
          }
        });
        
      } catch (error) {
        results.push({
          test: test.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  },

  async runAuthTests(env: Env): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    // Test 1: Session endpoint availability
    try {
      const startTime = performance.now();
      const response = await fetch(`${env.API_BASE_URL}/api/auth/session`, {
        method: 'GET',
        headers: { 'User-Agent': 'PitcheySyntheticMonitor/1.0' }
      });
      const endTime = performance.now();
      
      results.push({
        test: 'auth_session_endpoint',
        success: response.status === 401 || response.status === 200, // Expect 401 for unauthenticated or 200 for authenticated
        response_time: endTime - startTime,
        status_code: response.status,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      results.push({
        test: 'auth_session_endpoint',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
    
    // Test 2: Login endpoint structure (don't actually login)
    try {
      const startTime = performance.now();
      const response = await fetch(`${env.API_BASE_URL}/api/auth/sign-in`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'PitcheySyntheticMonitor/1.0'
        },
        body: JSON.stringify({ email: '', password: '' }) // Empty credentials to test endpoint structure
      });
      const endTime = performance.now();
      
      results.push({
        test: 'auth_login_endpoint_structure',
        success: response.status === 400 || response.status === 422, // Expect validation error for empty credentials
        response_time: endTime - startTime,
        status_code: response.status,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      results.push({
        test: 'auth_login_endpoint_structure',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
    
    return results;
  },

  async runAPITests(env: Env): Promise<TestResult[]> {
    const endpoints = [
      { name: 'api_root', path: '/api' },
      { name: 'cors_preflight', path: '/api/health', method: 'OPTIONS' },
      { name: 'analytics_performance', path: '/api/analytics/system/performance' }
    ];
    
    const results: TestResult[] = [];
    
    for (const endpoint of endpoints) {
      try {
        const startTime = performance.now();
        const response = await fetch(`${env.API_BASE_URL}${endpoint.path}`, {
          method: endpoint.method || 'GET',
          headers: { 'User-Agent': 'PitcheySyntheticMonitor/1.0' }
        });
        const endTime = performance.now();
        
        results.push({
          test: endpoint.name,
          success: response.ok,
          response_time: endTime - startTime,
          status_code: response.status,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        results.push({
          test: endpoint.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  },

  async runAnalyticsTests(env: Env): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    // Test Analytics Engine data collection endpoint
    try {
      const startTime = performance.now();
      const response = await fetch(`${env.API_BASE_URL}/api/analytics/system/performance`, {
        method: 'GET',
        headers: { 'User-Agent': 'PitcheySyntheticMonitor/1.0' }
      });
      const endTime = performance.now();
      
      let analyticsData = null;
      try {
        analyticsData = await response.json();
      } catch (e) {
        // Response might not be JSON
      }
      
      results.push({
        test: 'analytics_system_performance',
        success: response.ok,
        response_time: endTime - startTime,
        status_code: response.status,
        timestamp: new Date().toISOString(),
        metadata: {
          has_data: analyticsData !== null
        }
      });
      
    } catch (error) {
      results.push({
        test: 'analytics_system_performance',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
    
    return results;
  },

  async runPerformanceTests(env: Env): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    // Test response time for critical endpoint
    try {
      const iterations = 3;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        const response = await fetch(`${env.API_BASE_URL}/api/health`, {
          headers: { 'User-Agent': 'PitcheySyntheticMonitor/1.0' }
        });
        const endTime = performance.now();
        
        if (response.ok) {
          times.push(endTime - startTime);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        
        results.push({
          test: 'performance_average_response_time',
          success: avgTime < 2000, // Success if average < 2 seconds
          response_time: avgTime,
          timestamp: new Date().toISOString(),
          metadata: {
            max_time: maxTime,
            min_time: Math.min(...times),
            iterations: iterations
          }
        });
      }
      
    } catch (error) {
      results.push({
        test: 'performance_average_response_time',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
    
    return results;
  },

  async sendFailureAlert(env: Env, failures: TestResult[]): Promise<void> {
    if (!env.ALERT_WEBHOOK) {
      return;
    }
    
    const alertPayload = {
      text: `🚨 Synthetic Test Failures in ${env.ENVIRONMENT}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${failures.length} synthetic test(s) failed:*`
          }
        },
        {
          type: 'section',
          fields: failures.slice(0, 5).map(failure => ({
            type: 'mrkdwn',
            text: `*${failure.test}*\n${failure.error || `Status: ${failure.status_code}`}`
          }))
        }
      ],
      timestamp: new Date().toISOString()
    };
    
    try {
      await fetch(env.ALERT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertPayload)
      });
    } catch (error) {
      console.error('Failed to send alert webhook:', error);
    }
  },

  async getTestResults(env: Env): Promise<Response> {
    // Get recent test results from KV
    const keys = await env.MONITORING_KV.list({ prefix: 'synthetic-', limit: 10 });
    const results = [];
    
    for (const key of keys.keys) {
      const data = await env.MONITORING_KV.get(key.name);
      if (data) {
        try {
          results.push(JSON.parse(data));
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
    
    return new Response(JSON.stringify({
      recent_results: results,
      count: results.length
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};