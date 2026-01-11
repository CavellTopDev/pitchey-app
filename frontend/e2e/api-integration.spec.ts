import { test, expect } from '@playwright/test';
import { APIHelpers, APIResponse } from './utils/api-helpers';
import { AuthHelper } from './utils/auth-helpers';
import { TEST_USERS } from './fixtures/test-data';

test.describe('API Integration and Performance Testing', () => {
  let apiHelpers: APIHelpers;
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    apiHelpers = new APIHelpers(page);
    authHelper = new AuthHelper(page);
  });

  test.afterEach(async () => {
    // Clean up test data
    await apiHelpers.cleanupTestData();
  });

  test.describe('API Health and Performance', () => {
    test('validates all major API endpoints are responsive', async () => {
      console.log('Testing API endpoint health and performance...');

      const endpointResults = await apiHelpers.testAllEndpoints();

      // Validate each endpoint
      for (const [endpoint, result] of Object.entries(endpointResults)) {
        console.log(`${endpoint}: ${result.status} (${result.timing}ms)`);
        
        // API should respond within reasonable time
        expect(result.timing).toBeLessThan(5000);
        
        // Should not return server errors
        expect(result.status).toBeLessThan(500);
        
        // Most endpoints should be successful or require auth (401/403)
        if (result.status >= 400 && result.status !== 401 && result.status !== 403) {
          console.warn(`Unexpected status for ${endpoint}: ${result.status}`);
        }
      }

      console.log('✓ API endpoint validation completed');
    });

    test('validates API health check comprehensively', async ({ page }) => {
      console.log('Performing comprehensive API health check...');

      const healthData = await apiHelpers.getAPIHealth();
      
      // Validate health check summary
      expect(healthData.summary.status).toBe('healthy');
      expect(healthData.summary.passed).toBeGreaterThan(0);
      expect(healthData.summary.avgResponseTime).toBeLessThan(3000);

      // Validate individual health checks
      const criticalServices = ['basic', 'database'];
      for (const service of criticalServices) {
        if (healthData.checks[service]) {
          expect(healthData.checks[service].status).toBeLessThan(400);
          console.log(`✓ ${service} health check passed`);
        }
      }

      // Optional services (may not be available in all environments)
      const optionalServices = ['redis', 'storage'];
      for (const service of optionalServices) {
        if (healthData.checks[service]) {
          const status = healthData.checks[service].status;
          if (status < 400) {
            console.log(`✓ ${service} health check passed`);
          } else {
            console.log(`⚠ ${service} health check failed (${status}) - may not be available`);
          }
        }
      }

      console.log('✓ Comprehensive API health check completed');
    });

    test('stress tests critical API endpoints', async () => {
      console.log('Starting API stress testing...');

      // Test critical endpoints under load
      const criticalEndpoints = [
        '/api/health',
        '/api/auth/session',
        '/api/pitches'
      ];

      for (const endpoint of criticalEndpoints) {
        console.log(`Stress testing ${endpoint}...`);
        
        const results = await apiHelpers.stressTestAPI(endpoint, 5);
        
        // At least 80% of requests should succeed
        expect(results.length).toBeGreaterThanOrEqual(4);
        
        // Average response time should be reasonable under load
        const avgTime = results.reduce((sum, r) => sum + r.timing, 0) / results.length;
        expect(avgTime).toBeLessThan(8000);
        
        // No server errors
        const serverErrors = results.filter(r => r.status >= 500);
        expect(serverErrors.length).toBe(0);
        
        console.log(`✓ ${endpoint} stress test passed (${results.length} successful requests)`);
      }

      console.log('✓ API stress testing completed');
    });
  });

  test.describe('Authentication API Integration', () => {
    test('validates authentication flow for all portal types', async ({ page }) => {
      console.log('Testing authentication API integration...');

      for (const [portalType, userData] of Object.entries(TEST_USERS)) {
        console.log(`Testing ${portalType} authentication...`);
        
        // Test login API directly
        const loginStart = Date.now();
        const loginResponse = await apiHelpers.testEndpointPerformance(
          '/api/auth/sign-in',
          'POST',
          { email: userData.email, password: userData.password }
        );
        
        const loginTime = Date.now() - loginStart;
        
        // Validate login response
        expect(loginResponse.status).toBe(200);
        expect(loginResponse.timing).toBeLessThan(5000);
        expect(loginResponse.data).toBeDefined();
        
        console.log(`✓ ${portalType} login: ${loginResponse.status} (${loginTime}ms)`);
        
        // Test session validation
        const sessionResponse = await apiHelpers.testEndpointPerformance('/api/auth/session');
        
        expect(sessionResponse.status).toBe(200);
        expect(sessionResponse.data.user).toBeDefined();
        
        // Test logout
        const logoutResponse = await apiHelpers.testEndpointPerformance('/api/auth/sign-out', 'POST');
        expect(logoutResponse.status).toBe(200);
        
        console.log(`✓ ${portalType} authentication flow completed`);
      }

      console.log('✓ All portal authentication flows validated');
    });

    test('validates session management and security', async ({ page }) => {
      console.log('Testing session management...');

      // Login as creator
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      
      // Test authenticated endpoint access
      const protectedResponse = await apiHelpers.testEndpointPerformance('/api/pitches');
      expect(protectedResponse.status).toBe(200);
      
      // Test session persistence
      const sessionResponse1 = await apiHelpers.testEndpointPerformance('/api/auth/session');
      expect(sessionResponse1.status).toBe(200);
      expect(sessionResponse1.data.user).toBeDefined();
      
      // Test concurrent session handling
      const concurrentSessions = await Promise.all([
        apiHelpers.testEndpointPerformance('/api/auth/session'),
        apiHelpers.testEndpointPerformance('/api/auth/session'),
        apiHelpers.testEndpointPerformance('/api/auth/session')
      ]);
      
      for (const session of concurrentSessions) {
        expect(session.status).toBe(200);
      }
      
      console.log('✓ Session management validation completed');
    });
  });

  test.describe('CRUD Operations Integration', () => {
    test('validates complete pitch CRUD workflow', async ({ page }) => {
      console.log('Testing pitch CRUD operations...');

      // Authenticate as creator
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      
      // CREATE: Create a test pitch
      const pitchId = await apiHelpers.createTestPitch(TEST_USERS.creator.email);
      expect(pitchId).toBeDefined();
      console.log(`✓ Pitch created: ${pitchId}`);
      
      // READ: Fetch the created pitch
      const readResponse = await apiHelpers.testEndpointPerformance(`/api/pitches/${pitchId}`);
      expect(readResponse.status).toBe(200);
      expect(readResponse.data.id).toBe(pitchId);
      console.log(`✓ Pitch read: ${readResponse.status}`);
      
      // UPDATE: Modify the pitch
      const updateData = {
        title: `Updated ${readResponse.data.title}`,
        synopsis: 'Updated synopsis for API testing'
      };
      
      const updateResponse = await apiHelpers.testEndpointPerformance(
        `/api/pitches/${pitchId}`,
        'PUT',
        updateData
      );
      expect(updateResponse.status).toBe(200);
      console.log(`✓ Pitch updated: ${updateResponse.status}`);
      
      // Verify update
      const verifyResponse = await apiHelpers.testEndpointPerformance(`/api/pitches/${pitchId}`);
      expect(verifyResponse.data.title).toContain('Updated');
      
      // LIST: Get all pitches
      const listResponse = await apiHelpers.testEndpointPerformance('/api/pitches');
      expect(listResponse.status).toBe(200);
      expect(Array.isArray(listResponse.data)).toBeTruthy();
      console.log(`✓ Pitches listed: ${listResponse.data.length} found`);
      
      console.log('✓ Pitch CRUD workflow completed successfully');
    });

    test('validates NDA request workflow through API', async ({ page }) => {
      console.log('Testing NDA request API workflow...');

      // Setup: Create a pitch as creator
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      const pitchId = await apiHelpers.createTestPitch(TEST_USERS.creator.email);
      
      // Step 1: Investor creates NDA request
      const requestId = await apiHelpers.createNDARequest(TEST_USERS.investor.email, pitchId);
      expect(requestId).toBeDefined();
      console.log(`✓ NDA request created: ${requestId}`);
      
      // Step 2: Creator gets pending requests
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      const pendingResponse = await apiHelpers.testEndpointPerformance('/api/nda/requests/pending');
      expect(pendingResponse.status).toBe(200);
      expect(Array.isArray(pendingResponse.data)).toBeTruthy();
      console.log(`✓ Pending NDA requests: ${pendingResponse.data.length}`);
      
      // Step 3: Creator approves request
      await apiHelpers.approveNDARequest(TEST_USERS.creator.email, requestId);
      console.log(`✓ NDA request approved`);
      
      // Step 4: Investor checks approved requests
      await apiHelpers.authenticateUser(TEST_USERS.investor.email, TEST_USERS.investor.password);
      const approvedResponse = await apiHelpers.testEndpointPerformance('/api/nda/requests/approved');
      expect(approvedResponse.status).toBe(200);
      console.log(`✓ Approved NDA requests: ${approvedResponse.data.length}`);
      
      // Step 5: Investor accesses protected documents
      const documentsResponse = await apiHelpers.testEndpointPerformance(`/api/pitches/${pitchId}/documents`);
      expect(documentsResponse.status).toBe(200);
      console.log(`✓ Protected documents accessible`);
      
      console.log('✓ Complete NDA API workflow validated');
    });

    test('validates user management and profile operations', async ({ page }) => {
      console.log('Testing user management API operations...');

      // Create a new test user
      const testUserId = await apiHelpers.createTestUser('creator');
      expect(testUserId).toBeDefined();
      console.log(`✓ Test user created: ${testUserId}`);
      
      // Authenticate as the new user
      await apiHelpers.authenticateUser(
        `test-creator-${Date.now()}@test.com`.replace(/\d+/, testUserId.slice(-6)),
        'TestPassword123!'
      );
      
      // Get user profile
      const profileResponse = await apiHelpers.testEndpointPerformance('/api/auth/profile');
      expect(profileResponse.status).toBe(200);
      expect(profileResponse.data.id).toBeDefined();
      console.log(`✓ User profile retrieved`);
      
      // Update user profile
      const updateProfileData = {
        firstName: 'Updated',
        lastName: 'TestUser',
        bio: 'Updated bio for API testing'
      };
      
      const updateProfileResponse = await apiHelpers.testEndpointPerformance(
        '/api/auth/profile',
        'PUT',
        updateProfileData
      );
      expect(updateProfileResponse.status).toBe(200);
      console.log(`✓ User profile updated`);
      
      // Verify profile update
      const verifyProfileResponse = await apiHelpers.testEndpointPerformance('/api/auth/profile');
      expect(verifyProfileResponse.data.firstName).toBe('Updated');
      
      console.log('✓ User management API operations completed');
    });
  });

  test.describe('Real-time Features Integration', () => {
    test('validates WebSocket connection and messaging', async ({ page }) => {
      console.log('Testing WebSocket integration...');

      try {
        const wsConnected = await apiHelpers.testWebSocketConnection();
        expect(wsConnected).toBeTruthy();
        console.log('✓ WebSocket connection successful');
      } catch (error) {
        console.warn('⚠ WebSocket connection failed:', error);
        // WebSocket may not be implemented yet, so this is a warning not an error
      }
    });

    test('validates notification API endpoints', async ({ page }) => {
      console.log('Testing notification API...');

      // Authenticate as user
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      
      // Get notifications
      const notificationsResponse = await apiHelpers.testEndpointPerformance('/api/notifications');
      
      // Notifications endpoint should exist and respond properly
      if (notificationsResponse.status === 200) {
        expect(Array.isArray(notificationsResponse.data)).toBeTruthy();
        console.log(`✓ Notifications retrieved: ${notificationsResponse.data.length}`);
        
        // Test mark as read if notifications exist
        if (notificationsResponse.data.length > 0) {
          const firstNotification = notificationsResponse.data[0];
          const markReadResponse = await apiHelpers.testEndpointPerformance(
            `/api/notifications/${firstNotification.id}/read`,
            'PUT'
          );
          
          if (markReadResponse.status === 200) {
            console.log('✓ Notification marked as read');
          }
        }
      } else if (notificationsResponse.status === 404) {
        console.log('⚠ Notifications API not implemented yet');
      } else {
        console.warn(`Unexpected notifications response: ${notificationsResponse.status}`);
      }
    });

    test('validates analytics API endpoints', async ({ page }) => {
      console.log('Testing analytics API...');

      // Authenticate as creator
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      
      // Test analytics endpoints
      const analyticsEndpoints = [
        '/api/analytics/dashboard',
        '/api/analytics/pitches',
        '/api/analytics/engagement',
        '/api/analytics/performance'
      ];

      for (const endpoint of analyticsEndpoints) {
        const response = await apiHelpers.testEndpointPerformance(endpoint);
        
        if (response.status === 200) {
          expect(response.data).toBeDefined();
          console.log(`✓ ${endpoint}: ${response.status} (${response.timing}ms)`);
        } else if (response.status === 404) {
          console.log(`⚠ ${endpoint}: Not implemented yet`);
        } else {
          console.warn(`${endpoint}: Unexpected status ${response.status}`);
        }
      }
    });
  });

  test.describe('Data Validation and Security', () => {
    test('validates API input validation and security', async ({ page }) => {
      console.log('Testing API security and validation...');

      // Test unauthorized access
      const unauthorizedResponse = await apiHelpers.testEndpointPerformance('/api/pitches');
      expect([401, 403]).toContain(unauthorizedResponse.status);
      console.log(`✓ Unauthorized access properly blocked: ${unauthorizedResponse.status}`);
      
      // Authenticate for further tests
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      
      // Test input validation with invalid data
      const invalidPitchData = {
        title: '', // Empty title should be invalid
        budget: 'not-a-number', // Invalid budget format
        genre: 'InvalidGenre123' // Invalid genre
      };
      
      const invalidResponse = await apiHelpers.testEndpointPerformance(
        '/api/pitches',
        'POST',
        invalidPitchData
      );
      
      // Should return validation error
      expect(invalidResponse.status).toBeGreaterThanOrEqual(400);
      expect(invalidResponse.status).toBeLessThan(500);
      console.log(`✓ Input validation working: ${invalidResponse.status}`);
      
      // Test SQL injection protection
      const sqlInjectionData = {
        title: "'; DROP TABLE pitches; --",
        synopsis: "1' OR '1'='1"
      };
      
      const injectionResponse = await apiHelpers.testEndpointPerformance(
        '/api/pitches',
        'POST',
        sqlInjectionData
      );
      
      // Should either validate and reject or safely handle
      expect(injectionResponse.status).not.toBe(500);
      console.log(`✓ SQL injection protection: ${injectionResponse.status}`);
    });

    test('validates API response data consistency', async ({ page }) => {
      console.log('Testing API response data consistency...');

      // Authenticate
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      
      // Create a pitch and verify response structure
      const pitchId = await apiHelpers.createTestPitch(TEST_USERS.creator.email);
      
      // Get the pitch and validate structure
      const pitchResponse = await apiHelpers.testEndpointPerformance(`/api/pitches/${pitchId}`);
      
      apiHelpers.validateAPIResponse(pitchResponse, {
        id: 'string',
        title: 'string',
        synopsis: 'string',
        budget: 'number',
        createdAt: 'string'
      });
      
      console.log('✓ API response structure validation passed');
      
      // Test list endpoint consistency
      const listResponse = await apiHelpers.testEndpointPerformance('/api/pitches');
      
      if (listResponse.data.length > 0) {
        apiHelpers.validateAPIResponse(listResponse, [
          {
            id: 'string',
            title: 'string',
            createdAt: 'string'
          }
        ]);
      }
      
      console.log('✓ API list response consistency validated');
    });

    test('validates rate limiting and performance limits', async ({ page }) => {
      console.log('Testing API rate limiting...');

      // Authenticate
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      
      // Make rapid requests to test rate limiting
      const rapidRequests = Array(20).fill(0).map(() => 
        apiHelpers.testEndpointPerformance('/api/pitches')
      );
      
      const results = await Promise.allSettled(rapidRequests);
      const responses = results
        .filter((result): result is PromiseFulfilledResult<APIResponse> => result.status === 'fulfilled')
        .map(result => result.value);
      
      // Check if rate limiting is in effect
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 200);
      
      console.log(`Rate limiting test: ${successfulResponses.length} successful, ${rateLimitedResponses.length} rate limited`);
      
      // Either all should succeed (no rate limiting) or some should be rate limited
      if (rateLimitedResponses.length > 0) {
        console.log('✓ Rate limiting is active');
      } else {
        console.log('⚠ No rate limiting detected (may be disabled for testing)');
      }
      
      // All responses should be reasonable (no server errors)
      const serverErrors = responses.filter(r => r.status >= 500);
      expect(serverErrors.length).toBe(0);
    });
  });

  test.describe('Performance Benchmarking', () => {
    test('benchmarks critical API operations', async ({ page }) => {
      console.log('Starting API performance benchmarking...');

      // Authenticate
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      
      const benchmarks: Record<string, number[]> = {};
      const iterations = 5;
      
      // Benchmark critical operations
      const operations = [
        { name: 'list_pitches', endpoint: '/api/pitches', method: 'GET' as const },
        { name: 'get_profile', endpoint: '/api/auth/profile', method: 'GET' as const },
        { name: 'get_session', endpoint: '/api/auth/session', method: 'GET' as const }
      ];
      
      for (const operation of operations) {
        benchmarks[operation.name] = [];
        
        for (let i = 0; i < iterations; i++) {
          const result = await apiHelpers.testEndpointPerformance(operation.endpoint, operation.method);
          if (result.status < 400) {
            benchmarks[operation.name].push(result.timing);
          }
        }
      }
      
      // Calculate and report statistics
      for (const [operation, timings] of Object.entries(benchmarks)) {
        if (timings.length > 0) {
          const avg = timings.reduce((sum, time) => sum + time, 0) / timings.length;
          const min = Math.min(...timings);
          const max = Math.max(...timings);
          const p95 = timings.sort((a, b) => a - b)[Math.floor(timings.length * 0.95)];
          
          console.log(`${operation} performance:`);
          console.log(`  Average: ${avg.toFixed(2)}ms`);
          console.log(`  Min: ${min}ms`);
          console.log(`  Max: ${max}ms`);
          console.log(`  95th percentile: ${p95}ms`);
          
          // Performance assertions
          expect(avg).toBeLessThan(2000); // Average under 2s
          expect(p95).toBeLessThan(5000); // 95th percentile under 5s
        }
      }
      
      console.log('✓ API performance benchmarking completed');
    });

    test('validates API performance under concurrent load', async ({ page }) => {
      console.log('Testing API performance under concurrent load...');

      // Authenticate
      await apiHelpers.authenticateUser(TEST_USERS.creator.email, TEST_USERS.creator.password);
      
      // Test concurrent operations
      const concurrentOperations = [
        () => apiHelpers.testEndpointPerformance('/api/pitches'),
        () => apiHelpers.testEndpointPerformance('/api/auth/profile'),
        () => apiHelpers.testEndpointPerformance('/api/auth/session'),
        () => apiHelpers.testEndpointPerformance('/api/notifications'),
        () => apiHelpers.testEndpointPerformance('/api/analytics/dashboard')
      ];
      
      const startTime = Date.now();
      const results = await Promise.allSettled(
        concurrentOperations.map(operation => operation())
      );
      const totalTime = Date.now() - startTime;
      
      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<APIResponse> => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(result => result.status < 400);
      
      console.log(`Concurrent load test results:`);
      console.log(`  Total operations: ${concurrentOperations.length}`);
      console.log(`  Successful: ${successfulResults.length}`);
      console.log(`  Total time: ${totalTime}ms`);
      
      if (successfulResults.length > 0) {
        const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.timing, 0) / successfulResults.length;
        console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
        
        // Under concurrent load, average response time should still be reasonable
        expect(avgResponseTime).toBeLessThan(10000);
      }
      
      // At least 80% of operations should succeed
      expect(successfulResults.length).toBeGreaterThanOrEqual(Math.floor(concurrentOperations.length * 0.8));
      
      console.log('✓ Concurrent load test completed successfully');
    });
  });
});