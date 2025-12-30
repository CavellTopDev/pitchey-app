/**
 * K6 Load Testing Suite for Pitchey Platform
 * Validates database optimizations and performance improvements
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Test configuration
const BASE_URL = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';

// Test scenarios configuration
export const options = {
  scenarios: {
    // Health check stress test
    health_check_stress: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      exec: 'healthCheckTest',
      tags: { test_type: 'health_check' },
    },
    
    // Browse endpoint performance test
    browse_performance: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '60s', target: 20 },
        { duration: '30s', target: 0 },
      ],
      exec: 'browsePerformanceTest',
      tags: { test_type: 'browse_performance' },
    },
    
    // Authentication load test
    auth_load_test: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 5,
      maxVUs: 20,
      exec: 'authenticationTest',
      tags: { test_type: 'authentication' },
    },
    
    // Search functionality test
    search_performance: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 100,
      exec: 'searchPerformanceTest',
      tags: { test_type: 'search' },
    },
    
    // Cache efficiency test
    cache_efficiency: {
      executor: 'constant-vus',
      vus: 15,
      duration: '45s',
      exec: 'cacheEfficiencyTest',
      tags: { test_type: 'cache' },
    },
    
    // Spike test for sudden load
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 1 },
        { duration: '10s', target: 50 },  // Spike
        { duration: '20s', target: 50 },
        { duration: '10s', target: 1 },
      ],
      exec: 'spikeTest',
      tags: { test_type: 'spike' },
    },
  },
  
  thresholds: {
    // Performance thresholds based on optimization targets
    'http_req_duration': ['p(95)<200', 'p(99)<500'],
    'http_req_duration{test_type:health_check}': ['p(95)<100', 'p(99)<150'],
    'http_req_duration{test_type:browse_performance}': ['p(95)<50', 'p(99)<100'],
    'http_req_duration{test_type:authentication}': ['p(95)<100', 'p(99)<200'],
    'http_req_duration{test_type:search}': ['p(95)<100', 'p(99)<200'],
    'error_rate': ['rate<0.05'], // Less than 5% error rate
    'http_req_failed': ['rate<0.02'], // Less than 2% failed requests
  },
};

// Test data
const testUsers = [
  { email: 'alex.creator@demo.com', password: 'Demo123' },
  { email: 'sarah.investor@demo.com', password: 'Demo123' },
  { email: 'stellar.production@demo.com', password: 'Demo123' },
];

const searchQueries = [
  'action', 'comedy', 'drama', 'thriller', 'sci-fi',
  'indie', 'documentary', 'horror', 'romance', 'adventure'
];

// Test functions
export function healthCheckTest() {
  const startTime = Date.now();
  
  const response = http.get(`${BASE_URL}/api/health`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const duration = Date.now() - startTime;
  responseTime.add(duration);
  
  const success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': () => duration < 100,
    'health check returns healthy status': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy';
      } catch {
        return false;
      }
    },
    'health check includes version': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !!body.version;
      } catch {
        return false;
      }
    },
  });
  
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }
  
  sleep(1);
}

export function browsePerformanceTest() {
  const startTime = Date.now();
  
  const response = http.get(`${BASE_URL}/api/pitches/browse/enhanced`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const duration = Date.now() - startTime;
  responseTime.add(duration);
  
  const success = check(response, {
    'browse endpoint status is 200': (r) => r.status === 200,
    'browse response time < 50ms': () => duration < 50,
    'browse returns pitches array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.pitches);
      } catch {
        return false;
      }
    },
    'browse includes performance headers': (r) => {
      return r.headers['X-Cache-Status'] || r.headers['X-Query-Time'];
    },
  });
  
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }
  
  sleep(1);
}

export function authenticationTest() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  const startTime = Date.now();
  
  const response = http.post(`${BASE_URL}/api/auth/creator/login`, 
    JSON.stringify({
      email: user.email,
      password: user.password
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  
  const duration = Date.now() - startTime;
  responseTime.add(duration);
  
  const success = check(response, {
    'auth status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'auth response time < 100ms': () => duration < 100,
    'auth returns JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });
  
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }
  
  sleep(0.5);
}

export function searchPerformanceTest() {
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  const startTime = Date.now();
  
  const response = http.get(`${BASE_URL}/api/pitches/search?q=${query}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const duration = Date.now() - startTime;
  responseTime.add(duration);
  
  const success = check(response, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 100ms': () => duration < 100,
    'search returns results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.pitches !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }
  
  sleep(0.3);
}

export function cacheEfficiencyTest() {
  // Test cache efficiency by making repeated requests
  const endpoints = [
    '/api/health',
    '/api/pitches/browse/enhanced',
    '/api/pitches/search?q=action',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const startTime = Date.now();
  
  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const duration = Date.now() - startTime;
  responseTime.add(duration);
  
  const cacheStatus = response.headers['X-Cache-Status'] || 'UNKNOWN';
  
  const success = check(response, {
    'cache test status is 200': (r) => r.status === 200,
    'cache response time improved': () => duration < 200,
    'cache headers present': (r) => !!r.headers['X-Cache-Status'] || !!r.headers['X-Query-Time'],
  });
  
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }
  
  sleep(0.1);
}

export function spikeTest() {
  // Combination test for spike scenarios
  const tests = [
    () => healthCheckTest(),
    () => browsePerformanceTest(),
    () => authenticationTest(),
    () => searchPerformanceTest(),
  ];
  
  const testFunction = tests[Math.floor(Math.random() * tests.length)];
  testFunction();
}

// Setup and teardown
export function setup() {
  console.log('🚀 Starting K6 performance tests for Pitchey platform');
  console.log(`📊 Testing endpoint: ${BASE_URL}`);
  console.log('🎯 Performance targets:');
  console.log('  - Health checks: <100ms');
  console.log('  - Browse queries: <50ms');
  console.log('  - Authentication: <100ms');
  console.log('  - Search queries: <100ms');
  console.log('  - Error rate: <5%');
  return {};
}

export function teardown(data) {
  console.log('✅ K6 performance tests completed');
  console.log('📈 Check the results above for performance metrics');
  console.log('🔍 Key metrics to review:');
  console.log('  - http_req_duration percentiles');
  console.log('  - error_rate and success rates');
  console.log('  - Custom metrics for each test type');
}

// Default test function
export default function() {
  // This runs if no specific scenario is called
  healthCheckTest();
}