import { Page, APIRequestContext, expect } from '@playwright/test';
import { TEST_USERS, TEST_PITCHES, generateTestEmail, generateTestPitch } from '../fixtures/test-data';

export interface APIResponse {
  status: number;
  data: any;
  headers: Record<string, string>;
  timing: number;
}

export interface TestDataCleanupItem {
  type: 'user' | 'pitch' | 'nda' | 'message' | 'investment';
  id: string;
  endpoint: string;
}

export class APIHelpers {
  private page: Page;
  private request: APIRequestContext;
  private baseURL: string;
  private cleanupItems: TestDataCleanupItem[] = [];

  constructor(page: Page) {
    this.page = page;
    this.request = page.request;
    this.baseURL = process.env.VITE_API_URL || 'http://localhost:8001';
  }

  /**
   * Seed test data for comprehensive testing
   */
  async seedTestData(): Promise<void> {
    console.log('Seeding test data...');

    try {
      // Seed test users if they don't exist
      for (const [portalType, userData] of Object.entries(TEST_USERS)) {
        await this.ensureTestUserExists(portalType, userData);
      }

      // Seed test pitches
      await this.seedTestPitches();

      console.log('✓ Test data seeding completed');
    } catch (error) {
      console.error('Test data seeding failed:', error);
      throw error;
    }
  }

  /**
   * Clean up all test data created during testing
   */
  async cleanupTestData(): Promise<void> {
    console.log('Cleaning up test data...');

    for (const item of this.cleanupItems.reverse()) {
      try {
        await this.deleteTestData(item);
      } catch (error) {
        console.warn(`Failed to cleanup ${item.type} ${item.id}:`, error);
      }
    }

    this.cleanupItems = [];
    console.log('✓ Test data cleanup completed');
  }

  /**
   * Create a test pitch and track for cleanup
   */
  async createTestPitch(creatorEmail: string, pitchData?: any): Promise<string> {
    const startTime = Date.now();
    
    // Login as creator first
    await this.authenticateUser(creatorEmail, 'Demo123');
    
    const pitch = pitchData || generateTestPitch();
    
    const response = await this.request.post(`${this.baseURL}/api/pitches`, {
      data: pitch,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const timing = Date.now() - startTime;
    const responseData = await response.json();

    if (response.ok()) {
      const pitchId = responseData.id || responseData.pitchId || 'unknown';
      
      // Track for cleanup
      this.cleanupItems.push({
        type: 'pitch',
        id: pitchId,
        endpoint: `/api/pitches/${pitchId}`
      });

      console.log(`✓ Test pitch created: ${pitch.title} (${timing}ms)`);
      return pitchId;
    } else {
      throw new Error(`Failed to create test pitch: ${response.status()} - ${responseData.message}`);
    }
  }

  /**
   * Create a test user and track for cleanup
   */
  async createTestUser(portalType: string, customData?: any): Promise<string> {
    const startTime = Date.now();
    
    const userData = customData || {
      email: generateTestEmail(`test-${portalType}`),
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      company: 'Test Company',
      portalType
    };

    const response = await this.request.post(`${this.baseURL}/api/auth/sign-up`, {
      data: userData,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const timing = Date.now() - startTime;
    const responseData = await response.json();

    if (response.ok()) {
      const userId = responseData.id || responseData.userId || userData.email;
      
      // Track for cleanup
      this.cleanupItems.push({
        type: 'user',
        id: userId,
        endpoint: `/api/users/${userId}`
      });

      console.log(`✓ Test user created: ${userData.email} (${timing}ms)`);
      return userId;
    } else {
      throw new Error(`Failed to create test user: ${response.status()} - ${responseData.message}`);
    }
  }

  /**
   * Create an NDA request between investor and creator
   */
  async createNDARequest(investorEmail: string, pitchId: string, requestData?: any): Promise<string> {
    const startTime = Date.now();
    
    // Login as investor
    await this.authenticateUser(investorEmail, 'Demo123');
    
    const ndaRequest = requestData || {
      pitchId,
      investmentIntent: 'Interested in potential investment opportunity',
      investmentRange: '$1M - $5M',
      timeline: '6-12 months',
      backgroundInfo: 'Experienced investor with track record in film financing'
    };

    const response = await this.request.post(`${this.baseURL}/api/nda/requests`, {
      data: ndaRequest,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const timing = Date.now() - startTime;
    const responseData = await response.json();

    if (response.ok()) {
      const requestId = responseData.id || responseData.requestId;
      
      // Track for cleanup
      this.cleanupItems.push({
        type: 'nda',
        id: requestId,
        endpoint: `/api/nda/requests/${requestId}`
      });

      console.log(`✓ NDA request created: ${requestId} (${timing}ms)`);
      return requestId;
    } else {
      throw new Error(`Failed to create NDA request: ${response.status()} - ${responseData.message}`);
    }
  }

  /**
   * Approve an NDA request as creator
   */
  async approveNDARequest(creatorEmail: string, requestId: string, approvalData?: any): Promise<void> {
    const startTime = Date.now();
    
    // Login as creator
    await this.authenticateUser(creatorEmail, 'Demo123');
    
    const approval = approvalData || {
      accessLevel: 'full',
      notes: 'Request approved for full document access',
      documentsIncluded: ['script', 'budget', 'treatment']
    };

    const response = await this.request.put(`${this.baseURL}/api/nda/requests/${requestId}/approve`, {
      data: approval,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const timing = Date.now() - startTime;

    if (response.ok()) {
      console.log(`✓ NDA request approved: ${requestId} (${timing}ms)`);
    } else {
      const errorData = await response.json();
      throw new Error(`Failed to approve NDA request: ${response.status()} - ${errorData.message}`);
    }
  }

  /**
   * Send a message between users
   */
  async sendMessage(senderEmail: string, recipientId: string, messageData: any): Promise<string> {
    const startTime = Date.now();
    
    // Login as sender
    await this.authenticateUser(senderEmail, 'Demo123');
    
    const message = {
      recipientId,
      subject: messageData.subject || 'Test Message',
      content: messageData.content || 'This is a test message',
      type: messageData.type || 'direct'
    };

    const response = await this.request.post(`${this.baseURL}/api/messages`, {
      data: message,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const timing = Date.now() - startTime;
    const responseData = await response.json();

    if (response.ok()) {
      const messageId = responseData.id || responseData.messageId;
      
      // Track for cleanup
      this.cleanupItems.push({
        type: 'message',
        id: messageId,
        endpoint: `/api/messages/${messageId}`
      });

      console.log(`✓ Message sent: ${messageId} (${timing}ms)`);
      return messageId;
    } else {
      throw new Error(`Failed to send message: ${response.status()} - ${responseData.message}`);
    }
  }

  /**
   * Authenticate user and get session
   */
  async authenticateUser(email: string, password: string): Promise<void> {
    const response = await this.request.post(`${this.baseURL}/api/auth/sign-in`, {
      data: { email, password },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok()) {
      const errorData = await response.json();
      throw new Error(`Authentication failed for ${email}: ${response.status()} - ${errorData.message}`);
    }
  }

  /**
   * Test API endpoint performance and reliability
   */
  async testEndpointPerformance(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any): Promise<APIResponse> {
    const startTime = Date.now();
    
    const requestOptions: any = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      requestOptions.data = data;
    }

    let response;
    switch (method) {
      case 'POST':
        response = await this.request.post(`${this.baseURL}${endpoint}`, requestOptions);
        break;
      case 'PUT':
        response = await this.request.put(`${this.baseURL}${endpoint}`, requestOptions);
        break;
      case 'DELETE':
        response = await this.request.delete(`${this.baseURL}${endpoint}`, requestOptions);
        break;
      default:
        response = await this.request.get(`${this.baseURL}${endpoint}`, requestOptions);
    }

    const timing = Date.now() - startTime;
    const responseData = await response.json().catch(() => ({}));
    const headers = response.headers();

    return {
      status: response.status(),
      data: responseData,
      headers,
      timing
    };
  }

  /**
   * Validate API response structure and data
   */
  validateAPIResponse(response: APIResponse, expectedStructure: any): void {
    // Validate status code
    expect(response.status).toBeLessThan(400);
    
    // Validate response time (should be under 3 seconds)
    expect(response.timing).toBeLessThan(3000);
    
    // Validate required headers
    expect(response.headers['content-type']).toContain('application/json');
    
    // Validate response structure
    if (expectedStructure) {
      this.validateObjectStructure(response.data, expectedStructure);
    }
  }

  /**
   * Test all major API endpoints
   */
  async testAllEndpoints(): Promise<Record<string, APIResponse>> {
    console.log('Testing all major API endpoints...');
    
    const results: Record<string, APIResponse> = {};
    
    // Authentication endpoints
    const authEndpoints = [
      { name: 'health', endpoint: '/api/health', method: 'GET' as const },
      { name: 'session', endpoint: '/api/auth/session', method: 'GET' as const }
    ];

    for (const test of authEndpoints) {
      try {
        results[test.name] = await this.testEndpointPerformance(test.endpoint, test.method);
        console.log(`✓ ${test.name}: ${results[test.name].status} (${results[test.name].timing}ms)`);
      } catch (error) {
        console.error(`✗ ${test.name}: ${error}`);
      }
    }

    // Login first for protected endpoints
    await this.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);

    // Protected endpoints
    const protectedEndpoints = [
      { name: 'pitches', endpoint: '/api/pitches', method: 'GET' as const },
      { name: 'analytics', endpoint: '/api/analytics/dashboard', method: 'GET' as const },
      { name: 'notifications', endpoint: '/api/notifications', method: 'GET' as const },
      { name: 'profile', endpoint: '/api/auth/profile', method: 'GET' as const }
    ];

    for (const test of protectedEndpoints) {
      try {
        results[test.name] = await this.testEndpointPerformance(test.endpoint, test.method);
        console.log(`✓ ${test.name}: ${results[test.name].status} (${results[test.name].timing}ms)`);
      } catch (error) {
        console.error(`✗ ${test.name}: ${error}`);
      }
    }

    return results;
  }

  /**
   * Stress test API with concurrent requests
   */
  async stressTestAPI(endpoint: string, concurrentRequests: number = 10): Promise<APIResponse[]> {
    console.log(`Stress testing ${endpoint} with ${concurrentRequests} concurrent requests...`);
    
    const requests = Array(concurrentRequests).fill(0).map(() => 
      this.testEndpointPerformance(endpoint)
    );

    const results = await Promise.allSettled(requests);
    const successfulResults = results
      .filter((result): result is PromiseFulfilledResult<APIResponse> => result.status === 'fulfilled')
      .map(result => result.value);

    const failedCount = results.length - successfulResults.length;
    
    console.log(`Stress test results: ${successfulResults.length} successful, ${failedCount} failed`);
    
    if (successfulResults.length > 0) {
      const avgTime = successfulResults.reduce((sum, r) => sum + r.timing, 0) / successfulResults.length;
      const maxTime = Math.max(...successfulResults.map(r => r.timing));
      const minTime = Math.min(...successfulResults.map(r => r.timing));
      
      console.log(`  Average response time: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min response time: ${minTime}ms`);
      console.log(`  Max response time: ${maxTime}ms`);
    }

    return successfulResults;
  }

  /**
   * Test WebSocket connection and messaging
   */
  async testWebSocketConnection(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      console.log('Testing WebSocket connection...');
      
      const wsUrl = this.baseURL.replace('http', 'ws') + '/ws';
      
      try {
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        ws.onopen = () => {
          console.log('✓ WebSocket connection established');
          clearTimeout(timeout);
          
          // Test message sending
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') {
            console.log('✓ WebSocket message roundtrip successful');
            ws.close();
            resolve(true);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          clearTimeout(timeout);
          reject(error);
        };

        ws.onclose = () => {
          console.log('WebSocket connection closed');
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Private helper methods
   */
  private async ensureTestUserExists(portalType: string, userData: any): Promise<void> {
    try {
      // Try to authenticate - if successful, user exists
      await this.authenticateUser(userData.email, userData.password);
      console.log(`✓ Test user ${userData.email} already exists`);
    } catch (error) {
      // User doesn't exist, create them
      console.log(`Creating test user: ${userData.email}`);
      await this.createTestUser(portalType, userData);
    }
  }

  private async seedTestPitches(): Promise<void> {
    try {
      await this.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      
      // Check if test pitches already exist
      const existingPitches = await this.testEndpointPerformance('/api/pitches');
      
      if (existingPitches.data && existingPitches.data.length < 3) {
        // Create a few test pitches
        for (const [pitchKey, pitchData] of Object.entries(TEST_PITCHES)) {
          if (Object.keys(TEST_PITCHES).indexOf(pitchKey) < 2) { // Only create 2 test pitches
            await this.createTestPitch(TEST_USERS.creator.email, pitchData);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to seed test pitches:', error);
    }
  }

  private async deleteTestData(item: TestDataCleanupItem): Promise<void> {
    const response = await this.request.delete(`${this.baseURL}${item.endpoint}`);
    
    if (response.ok()) {
      console.log(`✓ Cleaned up ${item.type}: ${item.id}`);
    } else {
      console.warn(`Failed to cleanup ${item.type} ${item.id}: ${response.status()}`);
    }
  }

  private validateObjectStructure(obj: any, structure: any): void {
    for (const [key, expectedType] of Object.entries(structure)) {
      if (typeof expectedType === 'string') {
        expect(typeof obj[key]).toBe(expectedType);
      } else if (Array.isArray(expectedType) && expectedType.length > 0) {
        expect(Array.isArray(obj[key])).toBeTruthy();
        if (obj[key].length > 0) {
          this.validateObjectStructure(obj[key][0], expectedType[0]);
        }
      } else if (typeof expectedType === 'object') {
        expect(typeof obj[key]).toBe('object');
        this.validateObjectStructure(obj[key], expectedType);
      }
    }
  }

  /**
   * Generate test pitch with realistic data
   */
  static generateRealisticPitch(overrides: any = {}): any {
    const basePitch = generateTestPitch();
    return {
      ...basePitch,
      ...overrides,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate test user with realistic data
   */
  static generateRealisticUser(portalType: string, overrides: any = {}): any {
    const baseUser = {
      email: generateTestEmail(`realistic-${portalType}`),
      password: 'RealisticPassword123!',
      firstName: 'Realistic',
      lastName: 'TestUser',
      company: `Realistic ${portalType} Company`,
      bio: `Experienced ${portalType} with expertise in film industry`,
      portalType,
      verified: true,
      createdAt: new Date().toISOString()
    };

    if (portalType === 'investor') {
      Object.assign(baseUser, {
        investmentRange: { min: 1000000, max: 50000000 },
        riskTolerance: 'moderate',
        preferredGenres: ['Action', 'Drama', 'Thriller']
      });
    } else if (portalType === 'production') {
      Object.assign(baseUser, {
        specializesIn: ['Action', 'Thriller', 'Drama'],
        budgetRange: { min: 5000000, max: 100000000 },
        experience: 'Senior level with 20+ films produced'
      });
    }

    return { ...baseUser, ...overrides };
  }

  /**
   * Wait for async operations to complete
   */
  async waitForAsyncOperation(operation: () => Promise<boolean>, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await operation()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Async operation timeout after ${timeout}ms`);
  }

  /**
   * Get comprehensive API health check
   */
  async getAPIHealth(): Promise<Record<string, any>> {
    const healthChecks = {
      basic: await this.testEndpointPerformance('/api/health'),
      database: await this.testEndpointPerformance('/api/health/db'),
      redis: await this.testEndpointPerformance('/api/health/redis'),
      storage: await this.testEndpointPerformance('/api/health/storage')
    };

    const summary = {
      status: 'healthy',
      checks: Object.keys(healthChecks).length,
      passed: 0,
      failed: 0,
      avgResponseTime: 0
    };

    let totalTime = 0;
    for (const [check, result] of Object.entries(healthChecks)) {
      if (result.status < 400) {
        summary.passed++;
      } else {
        summary.failed++;
      }
      totalTime += result.timing;
    }

    summary.avgResponseTime = totalTime / summary.checks;
    summary.status = summary.failed === 0 ? 'healthy' : 'degraded';

    console.log(`API Health Summary: ${summary.status} (${summary.passed}/${summary.checks} passed, avg ${summary.avgResponseTime.toFixed(2)}ms)`);

    return { summary, checks: healthChecks };
  }
}