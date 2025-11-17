#!/usr/bin/env node

interface TestResult {
  endpoint: string;
  method: string;
  status: 'success' | 'error' | '404' | 'auth_required' | 'unauthorized';
  statusCode?: number;
  message?: string;
  responseTime?: number;
  userType?: string;
}

interface UserCredentials {
  email: string;
  password: string;
  type: 'creator' | 'investor' | 'production';
}

class APIEndpointTester {
  private baseUrl = 'https://pitchey-browse-api-production.cavelltheleaddev.workers.dev';
  private tokens: Map<string, string> = new Map();
  private results: TestResult[] = [];

  private users: UserCredentials[] = [
    { email: 'alex.creator@demo.com', password: 'Demo123', type: 'creator' },
    { email: 'sarah.investor@demo.com', password: 'Demo123', type: 'investor' },
    { email: 'stellar.production@demo.com', password: 'Demo123', type: 'production' }
  ];

  private endpoints = {
    // Authentication endpoints
    auth: [
      { path: '/api/auth/creator/login', method: 'POST', requiresAuth: false, userType: 'creator' },
      { path: '/api/auth/investor/login', method: 'POST', requiresAuth: false, userType: 'investor' },
      { path: '/api/auth/production/login', method: 'POST', requiresAuth: false, userType: 'production' },
    ],
    
    // Dashboard endpoints
    dashboards: [
      { path: '/api/creator/dashboard', method: 'GET', requiresAuth: true, userType: 'creator' },
      { path: '/api/investor/dashboard', method: 'GET', requiresAuth: true, userType: 'investor' },
      { path: '/api/production/dashboard', method: 'GET', requiresAuth: true, userType: 'production' },
    ],
    
    // Core functionality endpoints
    core: [
      { path: '/api/pitches/browse', method: 'GET', requiresAuth: true, userType: 'all' },
      { path: '/api/profile', method: 'GET', requiresAuth: true, userType: 'all' },
      { path: '/api/notifications', method: 'GET', requiresAuth: true, userType: 'all' },
      { path: '/api/messages', method: 'GET', requiresAuth: true, userType: 'all' },
      { path: '/api/ndas/stats', method: 'GET', requiresAuth: true, userType: 'all' },
      { path: '/api/analytics/dashboard', method: 'GET', requiresAuth: true, userType: 'all' },
    ],
    
    // Portfolio endpoints
    portfolio: [
      { path: '/api/creator/portfolio', method: 'GET', requiresAuth: true, userType: 'creator' },
      { path: '/api/investor/portfolio/summary', method: 'GET', requiresAuth: true, userType: 'investor' },
    ],
    
    // Social endpoints
    social: [
      { path: '/api/follows/followers', method: 'GET', requiresAuth: true, userType: 'all' },
      { path: '/api/follows/following', method: 'GET', requiresAuth: true, userType: 'all' },
    ],
    
    // User endpoints
    user: [
      { path: '/api/user/preferences', method: 'GET', requiresAuth: true, userType: 'all' },
      { path: '/api/user/notifications', method: 'GET', requiresAuth: true, userType: 'all' },
    ],
    
    // Config endpoints
    config: [
      { path: '/api/config/genres', method: 'GET', requiresAuth: false, userType: 'all' },
      { path: '/api/config/formats', method: 'GET', requiresAuth: false, userType: 'all' },
    ],
    
    // Search endpoints
    search: [
      { path: '/api/search/pitches', method: 'GET', requiresAuth: true, userType: 'all' },
      { path: '/api/search/users', method: 'GET', requiresAuth: true, userType: 'all' },
    ],
    
    // Content endpoints
    content: [
      { path: '/api/content/stats', method: 'GET', requiresAuth: true, userType: 'all' },
      { path: '/api/upload/quota', method: 'GET', requiresAuth: true, userType: 'all' },
    ]
  };

  private async makeRequest(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    token?: string,
    userType?: string
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      if (response.status === 404) {
        return {
          endpoint,
          method,
          status: '404',
          statusCode: response.status,
          message: '404 Not Found',
          responseTime,
          userType
        };
      }

      if (response.status === 401) {
        return {
          endpoint,
          method,
          status: response.status === 401 ? 'unauthorized' : 'auth_required',
          statusCode: response.status,
          message: responseData?.message || 'Authentication required',
          responseTime,
          userType
        };
      }

      if (response.status >= 400) {
        return {
          endpoint,
          method,
          status: 'error',
          statusCode: response.status,
          message: responseData?.message || `HTTP ${response.status}`,
          responseTime,
          userType
        };
      }

      return {
        endpoint,
        method,
        status: 'success',
        statusCode: response.status,
        message: 'OK',
        responseTime,
        userType
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        endpoint,
        method,
        status: 'error',
        statusCode: 0,
        message: error instanceof Error ? error.message : 'Network error',
        responseTime,
        userType
      };
    }
  }

  private async login(user: UserCredentials): Promise<string | null> {
    console.log(`🔐 Logging in as ${user.type}: ${user.email}`);
    
    const loginEndpoint = `/api/auth/${user.type}/login`;
    const result = await this.makeRequest(
      loginEndpoint,
      'POST',
      { email: user.email, password: user.password },
      undefined,
      user.type
    );

    this.results.push(result);

    if (result.status === 'success') {
      // Try to extract token from response
      try {
        const response = await fetch(`${this.baseUrl}${loginEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, password: user.password })
        });
        
        const data = await response.json();
        const token = data.token || data.access_token || data.accessToken;
        
        if (token) {
          this.tokens.set(user.type, token);
          console.log(`✅ Login successful for ${user.type}`);
          return token;
        }
      } catch (error) {
        console.log(`⚠️ Login succeeded but no token extracted for ${user.type}`);
      }
    } else {
      console.log(`❌ Login failed for ${user.type}: ${result.message}`);
    }
    
    return null;
  }

  private async testEndpointGroup(
    groupName: string,
    endpoints: Array<{ path: string; method: string; requiresAuth: boolean; userType: string }>
  ): Promise<void> {
    console.log(`\n📋 Testing ${groupName} endpoints...`);
    
    for (const endpoint of endpoints) {
      if (endpoint.userType === 'all') {
        // Test with all user types
        for (const userType of ['creator', 'investor', 'production']) {
          await this.testSingleEndpoint(endpoint, userType);
        }
      } else {
        // Test with specific user type
        await this.testSingleEndpoint(endpoint, endpoint.userType);
      }
    }
  }

  private async testSingleEndpoint(
    endpoint: { path: string; method: string; requiresAuth: boolean; userType: string },
    userType: string
  ): Promise<void> {
    const token = endpoint.requiresAuth ? this.tokens.get(userType) : undefined;
    const result = await this.makeRequest(
      endpoint.path,
      endpoint.method,
      undefined,
      token,
      userType
    );
    
    this.results.push(result);
    
    const statusIcon = {
      'success': '✅',
      'error': '⚠️',
      '404': '❌',
      'auth_required': '🔐',
      'unauthorized': '🚫'
    }[result.status];
    
    console.log(`${statusIcon} ${result.method} ${result.endpoint} (${userType}) - ${result.statusCode} (${result.responseTime}ms)`);
    if (result.message && result.status !== 'success') {
      console.log(`   └─ ${result.message}`);
    }
  }

  public async runTests(): Promise<void> {
    console.log('🚀 Starting API Endpoint Testing');
    console.log(`📡 Base URL: ${this.baseUrl}\n`);

    // Step 1: Test login for all user types
    console.log('='.repeat(60));
    console.log('STEP 1: Authentication Testing');
    console.log('='.repeat(60));

    for (const user of this.users) {
      await this.login(user);
    }

    // Step 2: Test all endpoint groups
    console.log('\n' + '='.repeat(60));
    console.log('STEP 2: Endpoint Testing');
    console.log('='.repeat(60));

    for (const [groupName, endpoints] of Object.entries(this.endpoints)) {
      if (groupName !== 'auth') { // Skip auth since we already tested it
        await this.testEndpointGroup(groupName, endpoints);
      }
    }

    // Step 3: Generate report
    this.generateReport();
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));

    const summary = {
      total: this.results.length,
      success: this.results.filter(r => r.status === 'success').length,
      errors: this.results.filter(r => r.status === 'error').length,
      notFound: this.results.filter(r => r.status === '404').length,
      authRequired: this.results.filter(r => r.status === 'auth_required').length,
      unauthorized: this.results.filter(r => r.status === 'unauthorized').length
    };

    console.log('\n📈 Summary:');
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Working: ${summary.success} (${Math.round(summary.success/summary.total*100)}%)`);
    console.log(`❌ Not Found (404): ${summary.notFound}`);
    console.log(`⚠️ Errors: ${summary.errors}`);
    console.log(`🔐 Auth Required: ${summary.authRequired}`);
    console.log(`🚫 Unauthorized: ${summary.unauthorized}`);

    // Group results by status for detailed reporting
    console.log('\n🔍 Detailed Results by Status:');

    const groupedResults = {
      'Working Correctly ✅': this.results.filter(r => r.status === 'success'),
      'Not Found (404) ❌': this.results.filter(r => r.status === '404'),
      'Errors ⚠️': this.results.filter(r => r.status === 'error'),
      'Unauthorized 🚫': this.results.filter(r => r.status === 'unauthorized'),
      'Auth Required 🔐': this.results.filter(r => r.status === 'auth_required')
    };

    for (const [category, results] of Object.entries(groupedResults)) {
      if (results.length > 0) {
        console.log(`\n${category} (${results.length}):`);
        results.forEach(result => {
          const userInfo = result.userType ? ` (${result.userType})` : '';
          const timing = result.responseTime ? ` [${result.responseTime}ms]` : '';
          console.log(`  - ${result.method} ${result.endpoint}${userInfo}${timing}`);
          if (result.message && result.status !== 'success') {
            console.log(`    └─ ${result.message}`);
          }
        });
      }
    }

    // Performance analysis
    const successfulRequests = this.results.filter(r => r.status === 'success' && r.responseTime);
    if (successfulRequests.length > 0) {
      const avgResponseTime = successfulRequests.reduce((sum, r) => sum + (r.responseTime || 0), 0) / successfulRequests.length;
      const slowestRequest = successfulRequests.reduce((max, r) => (r.responseTime || 0) > (max.responseTime || 0) ? r : max);
      
      console.log('\n⚡ Performance Analysis:');
      console.log(`Average Response Time: ${Math.round(avgResponseTime)}ms`);
      console.log(`Slowest Request: ${slowestRequest.method} ${slowestRequest.endpoint} (${slowestRequest.responseTime}ms)`);
    }

    // Authentication status
    console.log('\n🔑 Authentication Status:');
    this.users.forEach(user => {
      const hasToken = this.tokens.has(user.type);
      console.log(`${hasToken ? '✅' : '❌'} ${user.type}: ${hasToken ? 'Authenticated' : 'Failed to authenticate'}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('🏁 Test execution completed!');
    console.log('='.repeat(80));
  }
}

// Run the tests
async function main() {
  const tester = new APIEndpointTester();
  await tester.runTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { APIEndpointTester };