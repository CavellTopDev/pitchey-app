/**
 * K6 Load Testing Scenarios for Pitchey Platform
 * Comprehensive testing from baseline to 1M+ DAU scenarios
 */

export const loadTestScenarios = {
  // Smoke test - verify basic functionality
  smoke: `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '2m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.01'], // Error rate must be below 1%
  },
};

const BASE_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';

export default function() {
  // Test homepage
  let res = http.get(\`\${BASE_URL}/\`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(res.status !== 200);

  sleep(1);

  // Test API endpoint
  res = http.get(\`\${BASE_URL}/api/public/trending\`);
  check(res, {
    'API status is 200': (r) => r.status === 200,
    'API response has data': (r) => JSON.parse(r.body).data !== undefined,
  });
  errorRate.add(res.status !== 200);

  sleep(1);
}
`,

  // Load test - normal traffic simulation
  load: `
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');

export const options = {
  stages: [
    { duration: '5m', target: 100 },  // Ramp up to 100 users
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 200 },  // Ramp up to 200 users
    { duration: '10m', target: 200 }, // Stay at 200 users
    { duration: '5m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    errors: ['rate<0.05'],
    login_duration: ['p(95)<1500'],
    dashboard_duration: ['p(95)<2000'],
  },
};

const BASE_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';

// User profiles
const USER_TYPES = [
  { email: 'creator@test.com', password: 'Test123!', type: 'creator' },
  { email: 'investor@test.com', password: 'Test123!', type: 'investor' },
  { email: 'production@test.com', password: 'Test123!', type: 'production' },
];

export default function() {
  const userType = USER_TYPES[Math.floor(Math.random() * USER_TYPES.length)];
  
  group('User Login', () => {
    const loginStart = new Date();
    const loginRes = http.post(
      \`\${BASE_URL}/api/auth/\${userType.type}/login\`,
      JSON.stringify({
        email: userType.email,
        password: userType.password,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    
    loginDuration.add(new Date() - loginStart);
    
    check(loginRes, {
      'login successful': (r) => r.status === 200,
      'received token': (r) => JSON.parse(r.body).token !== undefined,
    });
    
    if (loginRes.status === 200) {
      const token = JSON.parse(loginRes.body).token;
      
      group('Dashboard Access', () => {
        const dashStart = new Date();
        const dashRes = http.get(
          \`\${BASE_URL}/api/dashboard/\${userType.type}\`,
          {
            headers: {
              'Authorization': \`Bearer \${token}\`,
            },
          }
        );
        
        dashboardDuration.add(new Date() - dashStart);
        
        check(dashRes, {
          'dashboard loaded': (r) => r.status === 200,
          'has metrics data': (r) => JSON.parse(r.body).metrics !== undefined,
        });
      });
    }
  });

  sleep(Math.random() * 3 + 1); // Random sleep between 1-4 seconds
}
`,

  // Stress test - find breaking point
  stress: `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Below normal load
    { duration: '5m', target: 100 },   
    { duration: '2m', target: 200 },   // Normal load
    { duration: '5m', target: 200 },   
    { duration: '2m', target: 300 },   // Around breaking point
    { duration: '5m', target: 300 },   
    { duration: '2m', target: 400 },   // Beyond breaking point
    { duration: '5m', target: 400 },   
    { duration: '10m', target: 0 },    // Scale down (recovery)
  ],
  thresholds: {
    http_req_duration: ['p(99)<5000'], // Even under stress, 99% should be under 5s
    errors: ['rate<0.10'], // Error rate should stay below 10%
  },
};

const BASE_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';

export default function() {
  const endpoints = [
    '/api/public/trending',
    '/api/public/featured',
    '/api/public/categories',
    '/api/pitches/browse',
    '/api/search?q=action',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const res = http.get(\`\${BASE_URL}\${endpoint}\`);
  
  const checkResult = check(res, {
    'status is 200': (r) => r.status === 200,
  });
  
  errorRate.add(!checkResult);
  
  sleep(0.1); // Very short sleep to increase pressure
}
`,

  // Spike test - sudden traffic surge
  spike: `
import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '10s', target: 100 },  // Normal load
    { duration: '1m', target: 100 },   
    { duration: '10s', target: 1000 }, // Spike to 10x users
    { duration: '3m', target: 1000 },  // Stay at spike
    { duration: '10s', target: 100 },  // Scale down
    { duration: '3m', target: 100 },   
    { duration: '10s', target: 0 },    
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // Relaxed for spike
    errors: ['rate<0.20'], // Higher error tolerance during spike
  },
};

const BASE_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';

export default function() {
  const res = http.get(\`\${BASE_URL}/api/public/trending\`);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  
  errorRate.add(res.status >= 400);
}
`,

  // Soak test - extended duration
  soak: `
import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const memoryUsage = new Trend('memory_usage');

export const options = {
  stages: [
    { duration: '5m', target: 400 },  // Ramp up to 400 users
    { duration: '3h', target: 400 },  // Stay at 400 for 3 hours
    { duration: '5m', target: 0 },    // Scale down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.02'],
  },
};

const BASE_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';

export default function() {
  // Simulate realistic user behavior
  group('Browse Pitches', () => {
    const res = http.get(\`\${BASE_URL}/api/pitches/browse?page=\${Math.floor(Math.random() * 10)}\`);
    check(res, {
      'browse successful': (r) => r.status === 200,
    });
  });

  // Check for memory leaks
  const metricsRes = http.get(\`\${BASE_URL}/api/metrics/health\`);
  if (metricsRes.status === 200) {
    const metrics = JSON.parse(metricsRes.body);
    if (metrics.memory) {
      memoryUsage.add(metrics.memory.used);
    }
  }
}
`,

  // Realistic user journey
  userJourney: `
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Load test data
const testUsers = new SharedArray('users', function() {
  return JSON.parse(open('./test-users.json'));
});

export const options = {
  scenarios: {
    creators: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 60 },  // 60% are creators
        { duration: '20m', target: 60 },
        { duration: '5m', target: 0 },
      ],
      exec: 'creatorJourney',
    },
    investors: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 30 },  // 30% are investors
        { duration: '20m', target: 30 },
        { duration: '5m', target: 0 },
      ],
      exec: 'investorJourney',
    },
    productions: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 10 },  // 10% are productions
        { duration: '20m', target: 10 },
        { duration: '5m', target: 0 },
      ],
      exec: 'productionJourney',
    },
  },
  thresholds: {
    'http_req_duration{scenario:creators}': ['p(95)<1500'],
    'http_req_duration{scenario:investors}': ['p(95)<1000'],
    'http_req_duration{scenario:productions}': ['p(95)<1200'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';

export function creatorJourney() {
  const user = testUsers[Math.floor(Math.random() * testUsers.length)];
  
  group('Creator Login', () => {
    const res = http.post(\`\${BASE_URL}/api/auth/creator/login\`, JSON.stringify({
      email: user.email,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (check(res, { 'login successful': (r) => r.status === 200 })) {
      const token = JSON.parse(res.body).token;
      const authHeaders = { 'Authorization': \`Bearer \${token}\` };
      
      sleep(2);
      
      group('Create Pitch', () => {
        const pitchRes = http.post(\`\${BASE_URL}/api/pitches\`, JSON.stringify({
          title: \`Test Pitch \${Date.now()}\`,
          logline: 'A test pitch for load testing',
          genre: 'Drama',
          targetAudience: 'Adults',
        }), {
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
        });
        
        check(pitchRes, { 'pitch created': (r) => r.status === 201 });
      });
      
      sleep(3);
      
      group('Check Dashboard', () => {
        const dashRes = http.get(\`\${BASE_URL}/api/dashboard/creator\`, {
          headers: authHeaders,
        });
        
        check(dashRes, { 'dashboard loaded': (r) => r.status === 200 });
      });
    }
  });
  
  sleep(Math.random() * 5 + 5); // 5-10 seconds between actions
}

export function investorJourney() {
  group('Browse Public Pitches', () => {
    const res = http.get(\`\${BASE_URL}/api/public/trending\`);
    check(res, { 'trending loaded': (r) => r.status === 200 });
  });
  
  sleep(2);
  
  group('Search Pitches', () => {
    const searchRes = http.get(\`\${BASE_URL}/api/search?q=action&genre=thriller\`);
    check(searchRes, { 'search successful': (r) => r.status === 200 });
  });
  
  sleep(Math.random() * 3 + 2);
}

export function productionJourney() {
  group('View Featured', () => {
    const res = http.get(\`\${BASE_URL}/api/public/featured\`);
    check(res, { 'featured loaded': (r) => r.status === 200 });
  });
  
  sleep(Math.random() * 5 + 3);
}
`,

  // 1M DAU simulation
  millionUsers: `
import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';
import exec from 'k6/execution';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    // Simulate 1M daily active users with realistic patterns
    morning_peak: {
      executor: 'ramping-arrival-rate',
      startRate: 1000,
      timeUnit: '1s',
      preAllocatedVUs: 2000,
      maxVUs: 10000,
      stages: [
        { target: 5000, duration: '30m' },  // Morning ramp up
        { target: 5000, duration: '2h' },   // Morning sustained
        { target: 3000, duration: '30m' },  // Mid-day decline
      ],
      exec: 'userActivity',
      startTime: '0s',
    },
    afternoon_peak: {
      executor: 'ramping-arrival-rate',
      startRate: 3000,
      timeUnit: '1s',
      preAllocatedVUs: 2000,
      maxVUs: 10000,
      stages: [
        { target: 4000, duration: '30m' },  // Afternoon ramp up
        { target: 4000, duration: '2h' },   // Afternoon sustained
        { target: 2000, duration: '30m' },  // Evening decline
      ],
      exec: 'userActivity',
      startTime: '3h',
    },
    evening_peak: {
      executor: 'ramping-arrival-rate',
      startRate: 2000,
      timeUnit: '1s',
      preAllocatedVUs: 3000,
      maxVUs: 15000,
      stages: [
        { target: 8000, duration: '1h' },   // Evening ramp up
        { target: 8000, duration: '3h' },   // Prime time sustained
        { target: 1000, duration: '1h' },   // Night decline
      ],
      exec: 'userActivity',
      startTime: '6h',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';

// Weighted endpoint distribution based on real usage patterns
const ENDPOINTS = [
  { path: '/api/public/trending', weight: 0.25 },
  { path: '/api/public/featured', weight: 0.15 },
  { path: '/api/pitches/browse', weight: 0.20 },
  { path: '/api/search', weight: 0.15 },
  { path: '/api/dashboard/creator', weight: 0.10 },
  { path: '/api/dashboard/investor', weight: 0.10 },
  { path: '/api/messages', weight: 0.05 },
];

function selectEndpoint() {
  const random = Math.random();
  let cumulative = 0;
  
  for (const endpoint of ENDPOINTS) {
    cumulative += endpoint.weight;
    if (random <= cumulative) {
      return endpoint.path;
    }
  }
  
  return ENDPOINTS[0].path;
}

export function userActivity() {
  const endpoint = selectEndpoint();
  const params = {
    headers: {
      'User-Agent': \`K6/\${exec.scenario.name}\`,
    },
    tags: {
      endpoint: endpoint,
      scenario: exec.scenario.name,
    },
  };

  const res = http.get(\`\${BASE_URL}\${endpoint}\`, params);
  
  const success = check(res, {
    'status < 400': (r) => r.status < 400,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  
  errorRate.add(!success);
}
`
};

// Export K6 test configuration generator
export function generateK6Config(scenario: keyof typeof loadTestScenarios): string {
  return loadTestScenarios[scenario];
}

// Export test data generator
export function generateTestData(numUsers: number): string {
  const users = [];
  const types = ['creator', 'investor', 'production'];
  
  for (let i = 0; i < numUsers; i++) {
    const type = types[i % types.length];
    users.push({
      email: `test-${type}-${i}@loadtest.com`,
      password: 'LoadTest123!',
      type: type
    });
  }
  
  return JSON.stringify(users, null, 2);
}

// Export performance baseline metrics
export const performanceBaselines = {
  smoke: {
    p50: 100,
    p95: 500,
    p99: 1000,
    errorRate: 0.01
  },
  load: {
    p50: 200,
    p95: 1000,
    p99: 2000,
    errorRate: 0.05
  },
  stress: {
    p50: 500,
    p95: 3000,
    p99: 5000,
    errorRate: 0.10
  },
  spike: {
    p50: 300,
    p95: 3000,
    p99: 5000,
    errorRate: 0.20
  },
  soak: {
    p50: 200,
    p95: 2000,
    p99: 3000,
    errorRate: 0.02
  },
  millionUsers: {
    p50: 300,
    p95: 2000,
    p99: 5000,
    errorRate: 0.05
  }
};