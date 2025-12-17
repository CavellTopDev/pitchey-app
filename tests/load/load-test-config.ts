/**
 * Load Testing Configuration and Utilities
 * Uses k6-compatible format for load testing
 */

export interface LoadTestScenario {
  name: string;
  executor: 'constant-vus' | 'ramping-vus' | 'constant-arrival-rate';
  vus?: number; // Virtual users
  duration?: string;
  rate?: number;
  timeUnit?: string;
  preAllocatedVUs?: number;
  stages?: Array<{
    duration: string;
    target: number;
  }>;
}

export interface LoadTestConfig {
  scenarios: Record<string, LoadTestScenario>;
  thresholds: Record<string, string[]>;
  options?: {
    setupTimeout?: string;
    teardownTimeout?: string;
    noConnectionReuse?: boolean;
    userAgent?: string;
  };
}

export const LOAD_TEST_CONFIGS = {
  // Smoke test - minimal load
  smoke: {
    scenarios: {
      smoke: {
        name: 'Smoke Test',
        executor: 'constant-vus',
        vus: 1,
        duration: '1m'
      }
    },
    thresholds: {
      'http_req_duration': ['p(95)<500'],
      'http_req_failed': ['rate<0.01']
    }
  },

  // Load test - normal expected load
  load: {
    scenarios: {
      load: {
        name: 'Load Test',
        executor: 'ramping-vus',
        stages: [
          { duration: '2m', target: 10 },
          { duration: '5m', target: 10 },
          { duration: '2m', target: 0 }
        ]
      }
    },
    thresholds: {
      'http_req_duration': ['p(95)<1000'],
      'http_req_failed': ['rate<0.05'],
      'http_reqs': ['rate>10']
    }
  },

  // Stress test - beyond normal load
  stress: {
    scenarios: {
      stress: {
        name: 'Stress Test',
        executor: 'ramping-vus',
        stages: [
          { duration: '2m', target: 10 },
          { duration: '5m', target: 20 },
          { duration: '2m', target: 50 },
          { duration: '5m', target: 50 },
          { duration: '2m', target: 0 }
        ]
      }
    },
    thresholds: {
      'http_req_duration': ['p(95)<2000'],
      'http_req_failed': ['rate<0.10']
    }
  },

  // Spike test - sudden load increase
  spike: {
    scenarios: {
      spike: {
        name: 'Spike Test',
        executor: 'ramping-vus',
        stages: [
          { duration: '10s', target: 5 },
          { duration: '10s', target: 100 },
          { duration: '20s', target: 100 },
          { duration: '10s', target: 5 },
          { duration: '10s', target: 0 }
        ]
      }
    },
    thresholds: {
      'http_req_duration': ['p(95)<3000'],
      'http_req_failed': ['rate<0.20']
    }
  },

  // Soak test - extended duration
  soak: {
    scenarios: {
      soak: {
        name: 'Soak Test',
        executor: 'constant-vus',
        vus: 10,
        duration: '60m'
      }
    },
    thresholds: {
      'http_req_duration': ['p(95)<1500'],
      'http_req_failed': ['rate<0.01'],
      'http_reqs': ['count>1000']
    }
  },

  // API endpoint specific tests
  endpoints: {
    scenarios: {
      browse: {
        name: 'Browse Endpoint Load',
        executor: 'constant-arrival-rate',
        rate: 10,
        timeUnit: '1s',
        duration: '5m',
        preAllocatedVUs: 20
      },
      search: {
        name: 'Search Endpoint Load',
        executor: 'constant-arrival-rate',
        rate: 5,
        timeUnit: '1s',
        duration: '5m',
        preAllocatedVUs: 10
      },
      pitchView: {
        name: 'Pitch View Load',
        executor: 'constant-arrival-rate',
        rate: 20,
        timeUnit: '1s',
        duration: '5m',
        preAllocatedVUs: 30
      }
    },
    thresholds: {
      'http_req_duration{scenario:browse}': ['p(95)<500'],
      'http_req_duration{scenario:search}': ['p(95)<1000'],
      'http_req_duration{scenario:pitchView}': ['p(95)<300'],
      'http_req_failed': ['rate<0.05']
    }
  }
} as const;

export class MetricsCollector {
  private metrics: Map<string, any[]> = new Map();
  private startTime: number = 0;

  start() {
    this.startTime = Date.now();
    this.metrics.clear();
  }

  record(metric: string, value: any) {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push({
      value,
      timestamp: Date.now() - this.startTime
    });
  }

  getMetrics(metric: string) {
    return this.metrics.get(metric) || [];
  }

  calculatePercentile(metric: string, percentile: number): number {
    const values = this.getMetrics(metric)
      .map(m => m.value)
      .sort((a, b) => a - b);
    
    if (values.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  calculateRate(metric: string): number {
    const values = this.getMetrics(metric);
    if (values.length === 0) return 0;
    
    const duration = (Date.now() - this.startTime) / 1000; // in seconds
    return values.length / duration;
  }

  getSummary() {
    const summary: Record<string, any> = {};
    
    for (const [metric, values] of this.metrics.entries()) {
      const numericValues = values
        .map(m => m.value)
        .filter(v => typeof v === 'number');
      
      if (numericValues.length > 0) {
        summary[metric] = {
          count: values.length,
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
          p50: this.calculatePercentile(metric, 50),
          p95: this.calculatePercentile(metric, 95),
          p99: this.calculatePercentile(metric, 99)
        };
      } else {
        summary[metric] = {
          count: values.length,
          rate: this.calculateRate(metric)
        };
      }
    }
    
    return summary;
  }
}

export class VirtualUser {
  private id: string;
  private baseUrl: string;
  private token?: string;
  private metrics: MetricsCollector;

  constructor(id: string, baseUrl: string, metrics: MetricsCollector) {
    this.id = id;
    this.baseUrl = baseUrl;
    this.metrics = metrics;
  }

  async request(
    method: string,
    endpoint: string,
    body?: any,
    options?: RequestInit
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const startTime = performance.now();
    let response: Response;
    let failed = false;

    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        ...options
      });

      failed = !response.ok;
    } catch (error) {
      failed = true;
      response = new Response(null, { status: 0 });
    }

    const duration = performance.now() - startTime;

    // Record metrics
    this.metrics.record('http_req_duration', duration);
    this.metrics.record('http_reqs', 1);
    if (failed) {
      this.metrics.record('http_req_failed', 1);
    }
    this.metrics.record(`http_req_duration{endpoint:${endpoint}}`, duration);

    return response;
  }

  async login(userType: 'creator' | 'investor' | 'production') {
    const credentials = {
      creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
      investor: { email: 'sarah.investor@demo.com', password: 'Demo123' },
      production: { email: 'stellar.production@demo.com', password: 'Demo123' }
    };

    const response = await this.request('POST', `/api/auth/${userType}/login`, credentials[userType]);
    
    if (response.ok) {
      const data = await response.json();
      this.token = data.data?.token;
    }

    return response;
  }

  setToken(token: string) {
    this.token = token;
  }

  getId(): string {
    return this.id;
  }
}