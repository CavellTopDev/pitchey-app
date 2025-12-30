/**
 * K6 Load Testing Script for Pitchey API Endpoints
 * Tests Cloudflare Worker API with progressive load patterns
 */

import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics for detailed performance tracking
const errorRate = new Rate('errors');
const cacheMissRate = new Rate('cache_misses');
const dbQueryTime = new Trend('database_query_duration');
const redisHits = new Counter('redis_cache_hits');
const cloudflareEdgeLatency = new Trend('cloudflare_edge_latency');

// Test data - shared across all VUs
const testUsers = new SharedArray('test_users', function () {
  return JSON.parse(open('./test-data/users.json'));
});

const testPitches = new SharedArray('test_pitches', function () {
  return JSON.parse(open('./test-data/pitches.json'));
});

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
const API_PREFIX = '/api';

// Test scenarios with progressive load patterns
export const options = {
  scenarios: {
    // Scenario 1: Gradual Ramp-up (Warm-up)
    warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },  // Gentle ramp to 10 users
        { duration: '3m', target: 10 },  // Stay at 10 users
        { duration: '1m', target: 0 },   // Ramp down
      ],
      tags: { test_type: 'warmup' },
      env: { SCENARIO: 'warmup' },
    },

    // Scenario 2: Normal Load (Baseline)
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 50 },  // Ramp to 50 users
        { duration: '10m', target: 50 }, // Maintain 50 users
        { duration: '2m', target: 0 },   // Ramp down
      ],
      tags: { test_type: 'normal_load' },
      env: { SCENARIO: 'normal_load' },
      startTime: '8m', // Start after warmup
    },

    // Scenario 3: Spike Test (Sudden traffic increase)
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 }, // Spike to 200 users
        { duration: '2m', target: 200 },  // Hold spike
        { duration: '30s', target: 50 },  // Drop to normal
        { duration: '2m', target: 50 },   // Hold normal
        { duration: '30s', target: 0 },   // Ramp down
      ],
      tags: { test_type: 'spike' },
      env: { SCENARIO: 'spike' },
      startTime: '21m', // Start after normal load
    },

    // Scenario 4: Stress Test (Find breaking point)
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },  // Ramp to 100
        { duration: '2m', target: 200 },  // Ramp to 200
        { duration: '2m', target: 300 },  // Ramp to 300
        { duration: '2m', target: 400 },  // Ramp to 400
        { duration: '5m', target: 400 },  // Hold at 400
        { duration: '2m', target: 0 },    // Ramp down
      ],
      tags: { test_type: 'stress' },
      env: { SCENARIO: 'stress' },
      startTime: '26m', // Start after spike
    },

    // Scenario 5: Soak Test (Extended duration)
    soak_test: {
      executor: 'constant-vus',
      vus: 30,
      duration: '30m',
      tags: { test_type: 'soak' },
      env: { SCENARIO: 'soak' },
      startTime: '41m', // Start after stress
    },
  },

  // Performance thresholds
  thresholds: {
    // HTTP metrics
    'http_req_duration{test_type:warmup}': ['p(95)<500'],
    'http_req_duration{test_type:normal_load}': ['p(95)<800'],
    'http_req_duration{test_type:spike}': ['p(95)<1500'],
    'http_req_duration{test_type:stress}': ['p(95)<2000'],
    'http_req_duration{test_type:soak}': ['p(95)<1000'],

    // Error rates
    'http_req_failed{test_type:normal_load}': ['rate<0.01'], // <1% errors
    'http_req_failed{test_type:spike}': ['rate<0.05'],       // <5% errors  
    'http_req_failed{test_type:stress}': ['rate<0.1'],       // <10% errors
    'http_req_failed{test_type:soak}': ['rate<0.02'],        // <2% errors

    // Database performance
    'database_query_duration': ['p(95)<200'],

    // Cache performance
    'cache_misses': ['rate<0.3'], // <30% cache miss rate

    // Cloudflare edge latency
    'cloudflare_edge_latency': ['p(95)<100'],
  },
};

// Authentication helper
function authenticate(userType = 'creator') {
  const users = {
    creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
    investor: { email: 'sarah.investor@demo.com', password: 'Demo123' },
    production: { email: 'stellar.production@demo.com', password: 'Demo123' },
  };

  const user = users[userType];
  if (!user) {
    fail(`Unknown user type: ${userType}`);
  }

  const response = http.post(`${BASE_URL}${API_PREFIX}/auth/${userType}/login`, {
    email: user.email,
    password: user.password,
  }, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'auth', user_type: userType },
  });

  check(response, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== undefined,
  });

  if (response.status !== 200) {
    console.error(`Login failed for ${userType}:`, response.body);
    fail(`Authentication failed for ${userType}`);
  }

  return response.json('token');
}

// Test endpoint groups
const API_ENDPOINTS = {
  // Public endpoints (no auth required)
  public: [
    { path: '/health', method: 'GET', name: 'health_check' },
    { path: '/pitches/browse', method: 'GET', name: 'browse_pitches' },
    { path: '/search', method: 'GET', name: 'search', params: '?q=drama&type=pitch' },
  ],

  // Creator endpoints
  creator: [
    { path: '/dashboard/stats', method: 'GET', name: 'creator_stats' },
    { path: '/pitches/my-pitches', method: 'GET', name: 'my_pitches' },
    { path: '/analytics/overview', method: 'GET', name: 'analytics' },
    { path: '/notifications', method: 'GET', name: 'notifications' },
  ],

  // Investor endpoints
  investor: [
    { path: '/dashboard/portfolio', method: 'GET', name: 'portfolio' },
    { path: '/investments/opportunities', method: 'GET', name: 'opportunities' },
    { path: '/ndas/pending', method: 'GET', name: 'pending_ndas' },
  ],

  // Production company endpoints
  production: [
    { path: '/dashboard/projects', method: 'GET', name: 'projects' },
    { path: '/talent/search', method: 'GET', name: 'talent_search' },
    { path: '/reports/performance', method: 'GET', name: 'performance_reports' },
  ],

  // Database-heavy endpoints
  database_intensive: [
    { path: '/analytics/detailed', method: 'GET', name: 'detailed_analytics', params: '?range=30d' },
    { path: '/search/advanced', method: 'POST', name: 'advanced_search', body: {
        filters: { genre: ['Drama', 'Action'], budget: { min: 100000, max: 1000000 } }
      }
    },
    { path: '/reports/aggregated', method: 'GET', name: 'aggregated_reports' },
  ],
};

// Main test function
export default function () {
  const scenario = __ENV.SCENARIO || 'normal_load';
  
  // Test user types distribution
  const userTypes = ['creator', 'investor', 'production'];
  const userType = userTypes[Math.floor(Math.random() * userTypes.length)];
  
  let authToken = null;

  // Test public endpoints (no authentication)
  for (const endpoint of API_ENDPOINTS.public) {
    testEndpoint(endpoint, null, scenario);
    sleep(0.5);
  }

  // Authenticate for protected endpoints
  try {
    authToken = authenticate(userType);
  } catch (error) {
    console.error(`Authentication failed for ${userType}:`, error);
    return;
  }

  // Test user-specific endpoints
  if (API_ENDPOINTS[userType]) {
    for (const endpoint of API_ENDPOINTS[userType]) {
      testEndpoint(endpoint, authToken, scenario);
      sleep(1);
    }
  }

  // Test database-intensive endpoints (10% of users)
  if (Math.random() < 0.1) {
    for (const endpoint of API_ENDPOINTS.database_intensive) {
      testEndpoint(endpoint, authToken, scenario);
      sleep(2);
    }
  }

  // Random endpoint selection for additional variety
  if (Math.random() < 0.3) {
    const randomEndpointGroup = Object.values(API_ENDPOINTS).flat();
    const randomEndpoint = randomEndpointGroup[Math.floor(Math.random() * randomEndpointGroup.length)];
    testEndpoint(randomEndpoint, authToken, scenario);
  }

  sleep(Math.random() * 3 + 1); // Random sleep between 1-4 seconds
}

// Test individual endpoint
function testEndpoint(endpoint, authToken, scenario) {
  const url = `${BASE_URL}${API_PREFIX}${endpoint.path}${endpoint.params || ''}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'K6-Performance-Test/1.0',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    headers,
    tags: { 
      endpoint: endpoint.name, 
      scenario,
      method: endpoint.method 
    },
  };

  let response;
  const startTime = Date.now();

  if (endpoint.method === 'POST' && endpoint.body) {
    response = http.post(url, JSON.stringify(endpoint.body), options);
  } else if (endpoint.method === 'PUT' && endpoint.body) {
    response = http.put(url, JSON.stringify(endpoint.body), options);
  } else {
    response = http.get(url, options);
  }

  const duration = Date.now() - startTime;

  // Record metrics
  errorRate.add(response.status >= 400);
  
  // Parse Cloudflare headers
  const cfCacheStatus = response.headers['cf-cache-status'] || 'MISS';
  const cfRay = response.headers['cf-ray'] || '';
  const serverTiming = response.headers['server-timing'] || '';

  // Track cache performance
  cacheMissRate.add(cfCacheStatus === 'MISS');
  
  // Track database timing if available
  const dbMatch = serverTiming.match(/db;dur=(\d+\.?\d*)/);
  if (dbMatch) {
    dbQueryTime.add(parseFloat(dbMatch[1]));
  }

  // Track Redis cache hits
  if (response.headers['x-cache-status'] === 'HIT') {
    redisHits.add(1);
  }

  // Track Cloudflare edge latency
  cloudflareEdgeLatency.add(duration);

  // Comprehensive checks
  const checks = {
    'status is 2xx or 3xx': (r) => r.status >= 200 && r.status < 400,
    'response time under 5s': (r) => r.timings.duration < 5000,
    'has content-type header': (r) => r.headers['Content-Type'] !== undefined,
  };

  // Endpoint-specific checks
  if (endpoint.name === 'health_check') {
    checks['health status is ok'] = (r) => {
      try {
        const body = r.json();
        return body.status === 'ok';
      } catch {
        return false;
      }
    };
  }

  if (endpoint.name.includes('dashboard') || endpoint.name.includes('analytics')) {
    checks['has data'] = (r) => {
      try {
        const body = r.json();
        return body.data !== undefined || body.results !== undefined;
      } catch {
        return false;
      }
    };
  }

  const checkResult = check(response, checks);

  // Log performance warnings
  if (response.timings.duration > 2000) {
    console.warn(`Slow response for ${endpoint.name}: ${response.timings.duration}ms`);
  }

  if (response.status >= 400) {
    console.error(`Error for ${endpoint.name}: ${response.status} - ${response.body.substring(0, 100)}`);
  }

  return checkResult;
}

// Setup function (runs once per VU)
export function setup() {
  console.log('Setting up performance test...');
  
  // Warm up the system
  const warmupResponse = http.get(`${BASE_URL}${API_PREFIX}/health`);
  
  if (warmupResponse.status !== 200) {
    console.error('System warmup failed:', warmupResponse.body);
  }

  return {
    startTime: new Date().toISOString(),
    baseUrl: BASE_URL,
  };
}

// Teardown function (runs once after all VUs finish)
export function teardown(data) {
  console.log('Performance test completed at:', new Date().toISOString());
  console.log('Started at:', data.startTime);
  
  // Could send results to monitoring system here
  // e.g., send summary to Grafana, DataDog, etc.
}

// Handle summary for custom reporting
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    [`performance/reports/k6-summary-${timestamp}.json`]: JSON.stringify(data, null, 2),
    [`performance/reports/k6-summary-${timestamp}.html`]: generateHTMLReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function generateHTMLReport(data) {
  const scenarios = Object.keys(data.metrics.http_req_duration?.values || {})
    .filter(key => key.includes('test_type'))
    .map(key => key.match(/test_type:(\w+)/)?.[1])
    .filter(Boolean);

  return `
<!DOCTYPE html>
<html>
<head>
    <title>K6 Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .good { border-left: 5px solid #4CAF50; }
        .warning { border-left: 5px solid #FF9800; }
        .error { border-left: 5px solid #F44336; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Pitchey Performance Test Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    
    <h2>Test Summary</h2>
    <div class="metric">
        <strong>Total Requests:</strong> ${data.metrics.http_reqs?.count || 0}<br>
        <strong>Request Rate:</strong> ${(data.metrics.http_reqs?.rate || 0).toFixed(2)} req/s<br>
        <strong>Error Rate:</strong> ${((data.metrics.http_req_failed?.rate || 0) * 100).toFixed(2)}%<br>
        <strong>Average Response Time:</strong> ${(data.metrics.http_req_duration?.avg || 0).toFixed(2)}ms<br>
        <strong>95th Percentile:</strong> ${(data.metrics.http_req_duration?.p95 || 0).toFixed(2)}ms
    </div>

    <h2>Scenario Results</h2>
    ${scenarios.map(scenario => `
        <h3>${scenario.charAt(0).toUpperCase() + scenario.slice(1)}</h3>
        <div class="metric">
            Performance metrics for ${scenario} scenario
        </div>
    `).join('')}
    
    <h2>Threshold Results</h2>
    ${Object.entries(data.thresholds || {}).map(([name, result]) => `
        <div class="metric ${result.ok ? 'good' : 'error'}">
            <strong>${name}:</strong> ${result.ok ? 'PASSED' : 'FAILED'}
        </div>
    `).join('')}
</body>
</html>`;
}

function textSummary(data, options = {}) {
  // Custom text summary formatting
  return `
K6 Performance Test Summary
==========================
Total Duration: ${(data.state?.testRunDurationMs || 0) / 1000}s
Total Requests: ${data.metrics.http_reqs?.count || 0}
Request Rate: ${(data.metrics.http_reqs?.rate || 0).toFixed(2)} req/s
Error Rate: ${((data.metrics.http_req_failed?.rate || 0) * 100).toFixed(2)}%

Response Times:
- Average: ${(data.metrics.http_req_duration?.avg || 0).toFixed(2)}ms
- Min: ${(data.metrics.http_req_duration?.min || 0).toFixed(2)}ms  
- Max: ${(data.metrics.http_req_duration?.max || 0).toFixed(2)}ms
- P95: ${(data.metrics.http_req_duration?.p95 || 0).toFixed(2)}ms
- P99: ${(data.metrics.http_req_duration?.p99 || 0).toFixed(2)}ms

Thresholds: ${Object.values(data.thresholds || {}).filter(t => t.ok).length}/${Object.keys(data.thresholds || {}).length} passed
`;
}