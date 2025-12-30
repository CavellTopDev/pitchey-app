/**
 * Database Connection Stress Test for Neon PostgreSQL + Cloudflare Workers
 * Tests connection pooling, query performance, and database limits
 */

import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for database performance
const dbConnectionErrors = new Rate('db_connection_errors');
const dbQueryLatency = new Trend('db_query_latency');
const dbSlowQueries = new Rate('db_slow_queries'); 
const dbTimeouts = new Rate('db_timeouts');
const dbConnectionPool = new Trend('db_connection_pool_usage');
const dbTransactionLatency = new Trend('db_transaction_latency');
const dbDeadlocks = new Counter('db_deadlocks');

// Environment configuration
const API_URL = __ENV.API_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
const SLOW_QUERY_THRESHOLD = 1000; // 1 second

// Database stress test scenarios
export const options = {
  scenarios: {
    // Connection Pool Stress Test
    connection_pool_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },   // Ramp to 20 concurrent connections
        { duration: '3m', target: 20 },   // Hold 20 connections
        { duration: '2m', target: 50 },   // Ramp to 50 connections  
        { duration: '5m', target: 50 },   // Hold 50 connections (test pool limits)
        { duration: '2m', target: 100 },  // Stress test: 100 connections
        { duration: '3m', target: 100 },  // Hold stress level
        { duration: '2m', target: 0 },    // Ramp down
      ],
      tags: { test_type: 'connection_pool' },
      env: { SCENARIO: 'connection_pool' },
    },

    // Heavy Query Load Test
    heavy_query_load: {
      executor: 'constant-vus',
      vus: 25,
      duration: '10m',
      tags: { test_type: 'heavy_queries' },
      env: { SCENARIO: 'heavy_queries' },
      startTime: '19m', // Start after connection pool test
    },

    // Transaction Concurrency Test
    transaction_concurrency: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 30 },   // Ramp to 30 concurrent transactions
        { duration: '5m', target: 30 },   // Hold concurrent transactions
        { duration: '1m', target: 0 },    // Ramp down
      ],
      tags: { test_type: 'transactions' },
      env: { SCENARIO: 'transactions' },
      startTime: '29m', // Start after heavy query test
    },

    // Database Soak Test (Long-running connections)
    database_soak: {
      executor: 'constant-vus', 
      vus: 15,
      duration: '30m',
      tags: { test_type: 'db_soak' },
      env: { SCENARIO: 'db_soak' },
      startTime: '36m', // Start after transaction test
    },
  },

  thresholds: {
    // Query performance thresholds
    'db_query_latency': ['p(95)<500'],        // 95% of queries under 500ms
    'db_slow_queries': ['rate<0.05'],         // <5% slow queries
    'db_connection_errors': ['rate<0.02'],    // <2% connection errors
    'db_timeouts': ['rate<0.01'],             // <1% timeout errors
    
    // Transaction performance
    'db_transaction_latency': ['p(95)<1000'], // 95% of transactions under 1s
    'db_deadlocks': ['count<5'],              // <5 deadlocks total

    // HTTP performance (database-backed endpoints)
    'http_req_duration{test_type:connection_pool}': ['p(95)<2000'],
    'http_req_duration{test_type:heavy_queries}': ['p(95)<3000'], 
    'http_req_duration{test_type:transactions}': ['p(95)<1500'],
    'http_req_failed{test_type:db_soak}': ['rate<0.01'],
  },
};

// Database-intensive API endpoints to test
const DATABASE_ENDPOINTS = {
  // Read-heavy operations
  reads: [
    {
      path: '/api/pitches/search',
      method: 'GET',
      params: '?q=drama&genre=Drama&sort=popularity&limit=20',
      name: 'pitch_search',
      complexity: 'medium',
    },
    {
      path: '/api/analytics/overview',
      method: 'GET', 
      params: '?range=30d&breakdown=daily',
      name: 'analytics_overview',
      complexity: 'high',
      requiresAuth: true,
      userType: 'creator',
    },
    {
      path: '/api/dashboard/stats',
      method: 'GET',
      name: 'dashboard_stats',
      complexity: 'medium',
      requiresAuth: true,
      userType: 'creator',
    },
    {
      path: '/api/portfolio/performance',
      method: 'GET',
      params: '?timeframe=1y&include_projections=true',
      name: 'portfolio_performance',
      complexity: 'high',
      requiresAuth: true,
      userType: 'investor',
    },
  ],

  // Write-heavy operations
  writes: [
    {
      path: '/api/pitches',
      method: 'POST',
      name: 'create_pitch',
      complexity: 'low',
      requiresAuth: true,
      userType: 'creator',
      body: {
        title: 'Performance Test Pitch',
        genre: 'Drama',
        logline: 'A pitch created during database stress testing',
        synopsis: 'This pitch tests database write performance under load',
        target_audience: '18-35',
        budget_range: '1M-5M',
      },
    },
    {
      path: '/api/analytics/events',
      method: 'POST',
      name: 'log_analytics_event',
      complexity: 'low',
      body: {
        event_type: 'page_view',
        page: '/dashboard',
        duration: 5000,
        user_agent: 'k6-stress-test',
        metadata: { test: true },
      },
    },
    {
      path: '/api/messages',
      method: 'POST',
      name: 'send_message',
      complexity: 'medium',
      requiresAuth: true,
      userType: 'investor',
      body: {
        recipient_id: 'creator-1',
        subject: 'Database Stress Test Message',
        content: 'Testing message sending under database stress',
        thread_id: 'stress-test-thread',
      },
    },
  ],

  // Transaction-heavy operations
  transactions: [
    {
      path: '/api/ndas/request',
      method: 'POST',
      name: 'request_nda',
      complexity: 'high',
      requiresAuth: true,
      userType: 'investor',
      body: {
        pitch_id: 'pitch-1',
        message: 'Stress testing NDA workflow with database transactions',
      },
    },
    {
      path: '/api/investments/track',
      method: 'POST',
      name: 'track_investment',
      complexity: 'high',
      requiresAuth: true,
      userType: 'investor',
      body: {
        pitch_id: 'pitch-1',
        amount: 100000,
        terms: { equity: 5, duration: '24 months' },
        status: 'pending',
      },
    },
    {
      path: '/api/reports/generate',
      method: 'POST',
      name: 'generate_report',
      complexity: 'very_high',
      requiresAuth: true,
      userType: 'production',
      body: {
        report_type: 'performance_analysis',
        date_range: { start: '2024-01-01', end: '2024-12-31' },
        filters: { include_projections: true },
      },
    },
  ],

  // Complex aggregation queries
  aggregations: [
    {
      path: '/api/analytics/aggregated',
      method: 'GET',
      params: '?metrics=views,likes,ndas&groupBy=genre,month&timeframe=6m',
      name: 'complex_aggregation',
      complexity: 'very_high',
      requiresAuth: true,
      userType: 'creator',
    },
    {
      path: '/api/search/advanced',
      method: 'POST',
      name: 'advanced_search',
      complexity: 'high',
      body: {
        query: 'action thriller',
        filters: {
          genre: ['Action', 'Thriller'],
          budget: { min: 500000, max: 5000000 },
          year: { min: 2020, max: 2024 },
          creator_verified: true,
        },
        sort: [
          { field: 'popularity', direction: 'desc' },
          { field: 'created_at', direction: 'desc' },
        ],
        facets: ['genre', 'budget_range', 'creator_location'],
        limit: 50,
        offset: 0,
      },
    },
  ],
};

// Demo user credentials
const DEMO_CREDENTIALS = {
  creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
  investor: { email: 'sarah.investor@demo.com', password: 'Demo123' },
  production: { email: 'stellar.production@demo.com', password: 'Demo123' },
};

// Authentication cache
let authTokens = {};

function authenticate(userType) {
  if (authTokens[userType]) {
    return authTokens[userType];
  }

  const credentials = DEMO_CREDENTIALS[userType];
  if (!credentials) {
    fail(`No credentials found for user type: ${userType}`);
  }

  const response = http.post(`${API_URL}/api/auth/${userType}/login`, {
    email: credentials.email,
    password: credentials.password,
  }, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'auth', user_type: userType },
  });

  check(response, {
    'authentication successful': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== undefined,
  });

  if (response.status !== 200) {
    fail(`Authentication failed for ${userType}: ${response.body}`);
  }

  const token = response.json('token');
  authTokens[userType] = token;
  return token;
}

function makeDbRequest(endpoint, authToken, scenario) {
  const url = `${API_URL}${endpoint.path}${endpoint.params || ''}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'K6-DB-Stress-Test/1.0',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    headers,
    tags: {
      endpoint: endpoint.name,
      complexity: endpoint.complexity,
      scenario,
      method: endpoint.method,
    },
    timeout: '30s', // Increased timeout for complex queries
  };

  let response;
  const startTime = Date.now();

  try {
    if (endpoint.method === 'POST' && endpoint.body) {
      response = http.post(url, JSON.stringify(endpoint.body), options);
    } else if (endpoint.method === 'PUT' && endpoint.body) {
      response = http.put(url, JSON.stringify(endpoint.body), options);
    } else {
      response = http.get(url, options);
    }
  } catch (error) {
    console.error(`Request failed for ${endpoint.name}:`, error);
    dbConnectionErrors.add(1);
    return { success: false, error: error.message };
  }

  const duration = Date.now() - startTime;
  
  // Record database metrics
  dbQueryLatency.add(duration);
  
  if (duration > SLOW_QUERY_THRESHOLD) {
    dbSlowQueries.add(1);
    console.warn(`Slow query detected: ${endpoint.name} took ${duration}ms`);
  } else {
    dbSlowQueries.add(0);
  }

  if (response.status === 408 || response.status === 504) {
    dbTimeouts.add(1);
  } else {
    dbTimeouts.add(0);
  }

  if (response.status >= 500) {
    dbConnectionErrors.add(1);
  } else {
    dbConnectionErrors.add(0);
  }

  // Parse database-specific headers if available
  const dbInfo = response.headers['x-db-info'];
  if (dbInfo) {
    try {
      const dbMetrics = JSON.parse(dbInfo);
      if (dbMetrics.pool_usage) {
        dbConnectionPool.add(dbMetrics.pool_usage);
      }
      if (dbMetrics.transaction_time) {
        dbTransactionLatency.add(dbMetrics.transaction_time);
      }
      if (dbMetrics.deadlocks) {
        dbDeadlocks.add(dbMetrics.deadlocks);
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }

  // Comprehensive checks
  const checks = {
    'status is success': (r) => r.status >= 200 && r.status < 400,
    'response time acceptable': (r) => r.timings.duration < 30000,
    'no database errors': (r) => !r.body.includes('database error') && !r.body.includes('connection failed'),
  };

  // Complexity-specific checks
  if (endpoint.complexity === 'low') {
    checks['fast response'] = (r) => r.timings.duration < 500;
  } else if (endpoint.complexity === 'medium') {
    checks['reasonable response'] = (r) => r.timings.duration < 1500;
  } else if (endpoint.complexity === 'high') {
    checks['acceptable response'] = (r) => r.timings.duration < 3000;
  }

  // Transaction-specific checks
  if (endpoint.name.includes('nda') || endpoint.name.includes('investment')) {
    checks['transaction completed'] = (r) => {
      try {
        const body = r.json();
        return body.success !== false && body.id !== undefined;
      } catch {
        return false;
      }
    };
  }

  const checkResult = check(response, checks);

  // Log performance warnings
  if (duration > 5000) {
    console.warn(`Very slow database operation: ${endpoint.name} took ${duration}ms`);
  }

  if (response.status >= 400) {
    console.error(`Database error for ${endpoint.name}: ${response.status} - ${response.body.substring(0, 200)}`);
  }

  return { 
    success: checkResult,
    response,
    duration,
  };
}

export default function() {
  const scenario = __ENV.SCENARIO || 'connection_pool';
  const vuId = __VU;
  const iterationId = __ITER;

  let authToken = null;

  // Test different scenarios
  switch (scenario) {
    case 'connection_pool':
      runConnectionPoolTest();
      break;
      
    case 'heavy_queries':
      runHeavyQueryTest();
      break;
      
    case 'transactions':
      runTransactionTest();
      break;
      
    case 'db_soak':
      runDatabaseSoakTest();
      break;
      
    default:
      runBasicDatabaseTest();
  }

  function runConnectionPoolTest() {
    // Test different read operations to stress connection pool
    const readEndpoints = DATABASE_ENDPOINTS.reads;
    
    for (let i = 0; i < 3; i++) {
      const endpoint = readEndpoints[Math.floor(Math.random() * readEndpoints.length)];
      
      if (endpoint.requiresAuth && !authToken) {
        authToken = authenticate(endpoint.userType);
      }
      
      makeDbRequest(endpoint, authToken, scenario);
      sleep(0.5 + Math.random()); // 0.5-1.5s between requests
    }
  }

  function runHeavyQueryTest() {
    // Focus on complex aggregation queries
    const complexEndpoints = [
      ...DATABASE_ENDPOINTS.aggregations,
      ...DATABASE_ENDPOINTS.reads.filter(e => e.complexity === 'high'),
    ];
    
    for (let i = 0; i < 5; i++) {
      const endpoint = complexEndpoints[Math.floor(Math.random() * complexEndpoints.length)];
      
      if (endpoint.requiresAuth && !authToken) {
        authToken = authenticate(endpoint.userType);
      }
      
      makeDbRequest(endpoint, authToken, scenario);
      sleep(1 + Math.random() * 2); // 1-3s between heavy queries
    }
  }

  function runTransactionTest() {
    // Test transaction-heavy operations
    const transactionEndpoints = DATABASE_ENDPOINTS.transactions;
    
    for (let i = 0; i < 2; i++) {
      const endpoint = transactionEndpoints[Math.floor(Math.random() * transactionEndpoints.length)];
      
      if (endpoint.requiresAuth) {
        authToken = authenticate(endpoint.userType);
      }
      
      const result = makeDbRequest(endpoint, authToken, scenario);
      
      // Simulate real user behavior - check result before proceeding
      if (result.success && result.response.status === 200) {
        // Successful transaction, might trigger follow-up action
        sleep(2 + Math.random() * 3);
      } else {
        // Failed transaction, user might retry
        sleep(5);
      }
    }
  }

  function runDatabaseSoakTest() {
    // Long-running test with mixed operations
    const testDuration = 25 * 60 * 1000; // 25 minutes
    const startTime = Date.now();
    
    while (Date.now() - startTime < testDuration) {
      // Mix of operations weighted by real usage patterns
      const operationType = Math.random();
      
      let endpoints;
      if (operationType < 0.6) {
        // 60% reads
        endpoints = DATABASE_ENDPOINTS.reads;
      } else if (operationType < 0.8) {
        // 20% writes
        endpoints = DATABASE_ENDPOINTS.writes;
      } else if (operationType < 0.95) {
        // 15% aggregations
        endpoints = DATABASE_ENDPOINTS.aggregations;
      } else {
        // 5% transactions
        endpoints = DATABASE_ENDPOINTS.transactions;
      }
      
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      
      if (endpoint.requiresAuth && !authToken) {
        authToken = authenticate(endpoint.userType);
      }
      
      makeDbRequest(endpoint, authToken, scenario);
      
      // Variable sleep to simulate real usage patterns
      const sleepTime = operationType < 0.6 ? 
        Math.random() * 3 :      // Fast reads
        5 + Math.random() * 10;  // Slower writes/complex operations
      
      sleep(sleepTime);
    }
  }

  function runBasicDatabaseTest() {
    // Basic mixed database test
    const allEndpoints = [
      ...DATABASE_ENDPOINTS.reads,
      ...DATABASE_ENDPOINTS.writes,
      ...DATABASE_ENDPOINTS.aggregations.slice(0, 1), // Only one aggregation for basic test
    ];
    
    for (let i = 0; i < 3; i++) {
      const endpoint = allEndpoints[Math.floor(Math.random() * allEndpoints.length)];
      
      if (endpoint.requiresAuth && !authToken) {
        authToken = authenticate(endpoint.userType);
      }
      
      makeDbRequest(endpoint, authToken, scenario);
      sleep(1 + Math.random() * 2);
    }
  }
}

export function setup() {
  console.log('Setting up database stress test...');
  
  // Verify API connectivity
  const healthResponse = http.get(`${API_URL}/api/health`);
  
  if (healthResponse.status !== 200) {
    throw new Error('API health check failed - cannot proceed with database stress test');
  }

  // Warm up database connections
  console.log('Warming up database connections...');
  const warmupResponse = http.get(`${API_URL}/api/pitches/browse`);
  
  if (warmupResponse.status !== 200) {
    console.warn('Database warmup failed, but proceeding with test');
  }

  return {
    startTime: new Date().toISOString(),
    apiUrl: API_URL,
  };
}

export function teardown(data) {
  console.log('Database stress test completed at:', new Date().toISOString());
  console.log('Test started at:', data.startTime);
  
  // Clean up any test data created during the test
  // Note: In a real scenario, you might want to clean up test pitches, messages, etc.
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    [`performance/reports/db-stress-${timestamp}.json`]: JSON.stringify(data, null, 2),
    [`performance/reports/db-stress-${timestamp}.html`]: generateDatabaseStressReport(data),
    stdout: generateDatabaseStressTextSummary(data),
  };
}

function generateDatabaseStressReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Database Stress Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .metric { background: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .good { border-left: 5px solid #4CAF50; }
        .warning { border-left: 5px solid #FF9800; }
        .error { border-left: 5px solid #F44336; }
        .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Pitchey Database Stress Test Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    
    <div class="grid">
        <div>
            <h2>Query Performance</h2>
            <div class="metric">
                <strong>Average Query Time:</strong> ${(data.metrics.db_query_latency?.avg || 0).toFixed(2)}ms<br>
                <strong>95th Percentile:</strong> ${(data.metrics.db_query_latency?.p95 || 0).toFixed(2)}ms<br>
                <strong>Max Query Time:</strong> ${(data.metrics.db_query_latency?.max || 0).toFixed(2)}ms<br>
                <strong>Slow Queries:</strong> ${((data.metrics.db_slow_queries?.rate || 0) * 100).toFixed(2)}%
            </div>
        </div>
        
        <div>
            <h2>Connection Performance</h2>
            <div class="metric">
                <strong>Connection Errors:</strong> ${((data.metrics.db_connection_errors?.rate || 0) * 100).toFixed(2)}%<br>
                <strong>Timeouts:</strong> ${((data.metrics.db_timeouts?.rate || 0) * 100).toFixed(2)}%<br>
                <strong>Avg Pool Usage:</strong> ${(data.metrics.db_connection_pool?.avg || 0).toFixed(1)}%<br>
                <strong>Max Pool Usage:</strong> ${(data.metrics.db_connection_pool?.max || 0).toFixed(1)}%
            </div>
        </div>
        
        <div>
            <h2>Transaction Performance</h2>
            <div class="metric">
                <strong>Avg Transaction Time:</strong> ${(data.metrics.db_transaction_latency?.avg || 0).toFixed(2)}ms<br>
                <strong>95th Percentile:</strong> ${(data.metrics.db_transaction_latency?.p95 || 0).toFixed(2)}ms<br>
                <strong>Deadlocks:</strong> ${data.metrics.db_deadlocks?.count || 0}<br>
                <strong>Success Rate:</strong> ${(100 - ((data.metrics.http_req_failed?.rate || 0) * 100)).toFixed(2)}%
            </div>
        </div>
    </div>
    
    <h2>Threshold Results</h2>
    ${Object.entries(data.thresholds || {}).map(([name, result]) => `
        <div class="metric ${result.ok ? 'good' : 'error'}">
            <strong>${name}:</strong> ${result.ok ? 'PASSED' : 'FAILED'}
        </div>
    `).join('')}
    
    <h2>Test Summary</h2>
    <div class="metric">
        <strong>Test Duration:</strong> ${Math.round((data.state?.testRunDurationMs || 0) / 1000)}s<br>
        <strong>Total Requests:</strong> ${data.metrics.http_reqs?.count || 0}<br>
        <strong>Request Rate:</strong> ${(data.metrics.http_reqs?.rate || 0).toFixed(2)} req/s<br>
        <strong>Data Transferred:</strong> ${((data.metrics.data_received?.count || 0) / 1024 / 1024).toFixed(2)} MB
    </div>
</body>
</html>`;
}

function generateDatabaseStressTextSummary(data) {
  return `
Database Stress Test Summary
===========================
Duration: ${Math.round((data.state?.testRunDurationMs || 0) / 1000)}s

Query Performance:
- Average: ${(data.metrics.db_query_latency?.avg || 0).toFixed(2)}ms
- 95th Percentile: ${(data.metrics.db_query_latency?.p95 || 0).toFixed(2)}ms  
- Slow Queries: ${((data.metrics.db_slow_queries?.rate || 0) * 100).toFixed(2)}%

Connection Performance:
- Connection Errors: ${((data.metrics.db_connection_errors?.rate || 0) * 100).toFixed(2)}%
- Timeouts: ${((data.metrics.db_timeouts?.rate || 0) * 100).toFixed(2)}%
- Avg Pool Usage: ${(data.metrics.db_connection_pool?.avg || 0).toFixed(1)}%

Transactions:
- Average Time: ${(data.metrics.db_transaction_latency?.avg || 0).toFixed(2)}ms
- Deadlocks: ${data.metrics.db_deadlocks?.count || 0}

Overall: ${data.metrics.http_reqs?.count || 0} requests, ${(data.metrics.http_reqs?.rate || 0).toFixed(2)} req/s
Thresholds: ${Object.values(data.thresholds || {}).filter(t => t.ok).length}/${Object.keys(data.thresholds || {}).length} passed
`;
}