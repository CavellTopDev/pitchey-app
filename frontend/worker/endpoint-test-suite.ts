/**
 * Comprehensive Endpoint Testing Suite
 * Tests all previously failing endpoints with proper authentication
 */

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  statusCode?: number;
  responseTime?: number;
  errorMessage?: string;
  sampleData?: any;
  headers?: Record<string, string>;
}

interface AuthTokens {
  creator: string;
  investor: string;
}

class EndpointTester {
  private baseUrl: string;
  private authTokens: AuthTokens = { creator: '', investor: '' };
  private results: TestResult[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    headers: Record<string, string> = {},
    body?: any
  ): Promise<TestResult> {
    const startTime = Date.now();
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const requestConfig: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers
        }
      };

      if (body && method === 'POST') {
        requestConfig.body = JSON.stringify(body);
      }

      console.log(`🔍 Testing: ${method} ${url}`);
      const response = await fetch(url, requestConfig);
      const responseTime = Date.now() - startTime;

      let responseData;
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }

      const result: TestResult = {
        endpoint,
        method,
        status: response.ok ? 'PASS' : 'FAIL',
        statusCode: response.status,
        responseTime,
        sampleData: responseData,
        headers: Object.fromEntries(response.headers.entries())
      };

      if (!response.ok) {
        result.errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }

      console.log(`${result.status === 'PASS' ? '✅' : '❌'} ${method} ${endpoint} - ${response.status} (${responseTime}ms)`);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.log(`🚫 ERROR ${method} ${endpoint} - ${error.message} (${responseTime}ms)`);
      
      return {
        endpoint,
        method,
        status: 'ERROR',
        responseTime,
        errorMessage: error.message
      };
    }
  }

  async authenticate(): Promise<void> {
    console.log('\n🔐 Authenticating demo users...\n');

    // Authenticate Creator
    const creatorResult = await this.makeRequest('/api/auth/creator/login', 'POST', {}, {
      email: 'alex.creator@demo.com',
      password: 'Demo123'
    });

    if (creatorResult.status === 'PASS' && creatorResult.sampleData?.token) {
      this.authTokens.creator = creatorResult.sampleData.token;
      console.log('✅ Creator authentication successful');
    } else {
      console.log('❌ Creator authentication failed:', creatorResult.errorMessage);
    }

    // Authenticate Investor
    const investorResult = await this.makeRequest('/api/auth/investor/login', 'POST', {}, {
      email: 'sarah.investor@demo.com',
      password: 'Demo123'
    });

    if (investorResult.status === 'PASS' && investorResult.sampleData?.token) {
      this.authTokens.investor = investorResult.sampleData.token;
      console.log('✅ Investor authentication successful');
    } else {
      console.log('❌ Investor authentication failed:', investorResult.errorMessage);
    }

    this.results.push(creatorResult, investorResult);
  }

  async testPublicEndpoints(): Promise<void> {
    console.log('\n🌐 Testing Public Endpoints...\n');

    // Test browse pitches
    const browseResult = await this.makeRequest('/api/pitches/browse');
    this.results.push(browseResult);

    // Test search users
    const searchResult = await this.makeRequest('/api/search/users?q=demo');
    this.results.push(searchResult);
  }

  async testAuthenticatedEndpoints(): Promise<void> {
    console.log('\n🔒 Testing Authenticated Endpoints...\n');

    const authHeaders = {
      creator: { 'Authorization': `Bearer ${this.authTokens.creator}` },
      investor: { 'Authorization': `Bearer ${this.authTokens.investor}` }
    };

    // Test with creator token
    if (this.authTokens.creator) {
      console.log('📝 Testing with Creator token...');
      
      const creatorTests = [
        { endpoint: '/api/creator/portfolio', description: 'Creator portfolio' },
        { endpoint: '/api/follows/followers', description: 'User followers' },
        { endpoint: '/api/follows/following', description: 'Following list' },
        { endpoint: '/api/user/preferences', description: 'User preferences' },
        { endpoint: '/api/user/notifications', description: 'User notifications' },
        { endpoint: '/api/upload/quota', description: 'Upload quota' }
      ];

      for (const test of creatorTests) {
        const result = await this.makeRequest(test.endpoint, 'GET', authHeaders.creator);
        this.results.push(result);
      }
    }

    // Test with investor token
    if (this.authTokens.investor) {
      console.log('\n💰 Testing with Investor token...');
      
      const investorTests = [
        { endpoint: '/api/follows/followers', description: 'Investor followers' },
        { endpoint: '/api/follows/following', description: 'Investor following' },
        { endpoint: '/api/user/preferences', description: 'Investor preferences' },
        { endpoint: '/api/user/notifications', description: 'Investor notifications' },
        { endpoint: '/api/upload/quota', description: 'Investor upload quota' }
      ];

      for (const test of investorTests) {
        const result = await this.makeRequest(test.endpoint, 'GET', authHeaders.investor);
        this.results.push(result);
      }
    }
  }

  generateReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE ENDPOINT TEST REPORT');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    const total = this.results.length;

    console.log(`\n📈 SUMMARY:`);
    console.log(`✅ PASSED: ${passed}/${total}`);
    console.log(`❌ FAILED: ${failed}/${total}`);
    console.log(`🚫 ERRORS: ${errors}/${total}`);
    console.log(`📊 SUCCESS RATE: ${((passed / total) * 100).toFixed(1)}%`);

    console.log(`\n🕐 PERFORMANCE:`);
    const responseTimes = this.results.filter(r => r.responseTime).map(r => r.responseTime!);
    if (responseTimes.length > 0) {
      console.log(`⚡ Avg Response Time: ${(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(0)}ms`);
      console.log(`🏃 Fastest: ${Math.min(...responseTimes)}ms`);
      console.log(`🐌 Slowest: ${Math.max(...responseTimes)}ms`);
    }

    console.log('\n📋 DETAILED RESULTS:');
    console.log('-'.repeat(80));

    this.results.forEach((result, index) => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '🚫';
      console.log(`${statusIcon} ${result.method} ${result.endpoint}`);
      console.log(`   Status: ${result.statusCode || 'N/A'} | Time: ${result.responseTime || 0}ms`);
      
      if (result.errorMessage) {
        console.log(`   Error: ${result.errorMessage}`);
      }
      
      if (result.status === 'PASS' && result.sampleData) {
        if (typeof result.sampleData === 'object') {
          const keys = Object.keys(result.sampleData);
          if (keys.length > 0) {
            console.log(`   Sample: {${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`);
          }
        }
      }
      console.log('');
    });

    console.log('\n🎯 CRITICAL ENDPOINT STATUS:');
    console.log('-'.repeat(80));
    
    const criticalEndpoints = [
      '/api/pitches/browse',
      '/api/creator/portfolio',
      '/api/follows/followers',
      '/api/user/notifications',
      '/api/search/users'
    ];

    criticalEndpoints.forEach(endpoint => {
      const result = this.results.find(r => r.endpoint === endpoint);
      if (result) {
        const icon = result.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${endpoint} - ${result.status}`);
      } else {
        console.log(`⚪ ${endpoint} - NOT TESTED`);
      }
    });

    console.log('\n' + '='.repeat(80));
  }

  getResults(): TestResult[] {
    return this.results;
  }
}

// Main execution function
async function runTestSuite() {
  const tester = new EndpointTester('https://pitchey-api-prod.ndlovucavelle.workers.dev');
  
  console.log('🚀 Starting Comprehensive Endpoint Test Suite');
  console.log(`🎯 Testing against: ${tester['baseUrl']}`);
  console.log(`📅 Test run: ${new Date().toISOString()}`);

  try {
    await tester.authenticate();
    await tester.testPublicEndpoints();
    await tester.testAuthenticatedEndpoints();
    tester.generateReport();
    
    return tester.getResults();
  } catch (error) {
    console.error('🚫 Test suite failed:', error);
    throw error;
  }
}

// Export for use in other contexts
export { EndpointTester, runTestSuite };

// Run if executed directly
if (import.meta.main) {
  runTestSuite().catch(console.error);
}