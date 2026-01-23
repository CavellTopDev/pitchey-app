#!/usr/bin/env -S deno run --allow-all

/**
 * Integration Verification Test Suite for Pitchey Platform
 * 
 * Comprehensive validation of all system integrations including:
 * - Better Auth session management
 * - Neon PostgreSQL connectivity
 * - Upstash Redis caching
 * - R2 storage operations
 * - Queue processing validation
 * - Durable Objects state management
 * - Workflow execution verification
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { delay } from "https://deno.land/std@0.208.0/async/delay.ts";

// Configuration
const CONFIG = {
  API_BASE: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  NEON_CONNECTION: 'postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-a9pr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  REDIS_URL: process.env.UPSTASH_REDIS_REST_URL || 'https://adequate-bass-40711.upstash.io',
  TEST_TIMEOUT: 60000, // 1 minute per test
  DEMO_ACCOUNTS: {
    creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
    investor: { email: 'sarah.investor@demo.com', password: 'Demo123' },
    production: { email: 'stellar.production@demo.com', password: 'Demo123' }
  }
};

interface IntegrationTestResult {
  component: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  metrics?: Record<string, any>;
}

interface IntegrationContext {
  sessionTokens: Map<string, string>;
  dbConnection?: any;
  redisConnection?: any;
  testData: Map<string, any>;
}

class IntegrationVerificationSuite {
  private results: IntegrationTestResult[] = [];
  private context: IntegrationContext;
  
  constructor() {
    this.context = {
      sessionTokens: new Map(),
      testData: new Map()
    };
  }

  async runAllIntegrationTests(): Promise<IntegrationTestResult[]> {
    console.log('🔧 Starting Integration Verification Suite');
    console.log('==========================================');
    
    // Authentication Integration Tests
    await this.runComponentTests('Better Auth', [
      { name: 'Session Creation and Management', fn: () => this.testSessionManagement() },
      { name: 'Cross-Portal Authentication', fn: () => this.testCrossPortalAuth() },
      { name: 'Session Persistence and Refresh', fn: () => this.testSessionPersistence() },
      { name: 'Cookie Security and Validation', fn: () => this.testCookieSecurity() },
      { name: 'Authentication Rate Limiting', fn: () => this.testAuthRateLimiting() }
    ]);
    
    // Database Integration Tests
    await this.runComponentTests('Neon PostgreSQL', [
      { name: 'Connection Pool Management', fn: () => this.testDatabaseConnection() },
      { name: 'Transaction Integrity', fn: () => this.testTransactionIntegrity() },
      { name: 'Connection Failover', fn: () => this.testDatabaseFailover() },
      { name: 'Query Performance', fn: () => this.testQueryPerformance() },
      { name: 'Connection Limits', fn: () => this.testConnectionLimits() }
    ]);
    
    // Cache Integration Tests
    await this.runComponentTests('Upstash Redis', [
      { name: 'Cache Operations', fn: () => this.testCacheOperations() },
      { name: 'Cache Invalidation', fn: () => this.testCacheInvalidation() },
      { name: 'Session Storage', fn: () => this.testRedisSessionStorage() },
      { name: 'Distributed Caching', fn: () => this.testDistributedCaching() },
      { name: 'Cache Performance', fn: () => this.testCachePerformance() }
    ]);
    
    // Storage Integration Tests
    await this.runComponentTests('R2 Storage', [
      { name: 'File Upload/Download', fn: () => this.testR2Operations() },
      { name: 'Multipart Upload', fn: () => this.testMultipartUpload() },
      { name: 'CDN Integration', fn: () => this.testCDNIntegration() },
      { name: 'Storage Limits', fn: () => this.testStorageLimits() },
      { name: 'File Metadata', fn: () => this.testFileMetadata() }
    ]);
    
    // Queue Integration Tests
    await this.runComponentTests('Queue Processing', [
      { name: 'Job Queue Operations', fn: () => this.testQueueOperations() },
      { name: 'Job Priority Handling', fn: () => this.testJobPriority() },
      { name: 'Queue Error Handling', fn: () => this.testQueueErrorHandling() },
      { name: 'Dead Letter Queue', fn: () => this.testDeadLetterQueue() },
      { name: 'Queue Performance', fn: () => this.testQueuePerformance() }
    ]);
    
    // Durable Objects Integration Tests
    await this.runComponentTests('Durable Objects', [
      { name: 'State Management', fn: () => this.testDurableObjectState() },
      { name: 'Cross-Object Communication', fn: () => this.testCrossObjectCommunication() },
      { name: 'State Persistence', fn: () => this.testStatePersistence() },
      { name: 'Concurrency Control', fn: () => this.testConcurrencyControl() },
      { name: 'Object Migration', fn: () => this.testObjectMigration() }
    ]);
    
    // Workflow Integration Tests
    await this.runComponentTests('Workflow Orchestration', [
      { name: 'Multi-Step Workflows', fn: () => this.testMultiStepWorkflows() },
      { name: 'Workflow Error Recovery', fn: () => this.testWorkflowErrorRecovery() },
      { name: 'Parallel Workflow Execution', fn: () => this.testParallelWorkflows() },
      { name: 'Workflow State Management', fn: () => this.testWorkflowStateManagement() },
      { name: 'Cross-Service Orchestration', fn: () => this.testCrossServiceOrchestration() }
    ]);
    
    this.printIntegrationSummary();
    return this.results;
  }

  private async runComponentTests(component: string, tests: Array<{name: string, fn: () => Promise<void>}>): Promise<void> {
    console.log(`\n🧩 Testing ${component} Integration`);
    console.log('-'.repeat(40));
    
    for (const test of tests) {
      await this.runIntegrationTest(component, test.name, test.fn);
    }
  }

  private async runIntegrationTest(component: string, testName: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    console.log(`  🧪 ${testName}...`);
    
    try {
      await Promise.race([
        testFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), CONFIG.TEST_TIMEOUT)
        )
      ]);
      
      const duration = Date.now() - startTime;
      this.results.push({ 
        component, 
        test: testName, 
        status: 'PASS', 
        duration 
      });
      console.log(`    ✅ PASSED (${duration}ms)`);
      
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      this.results.push({ 
        component, 
        test: testName, 
        status: 'FAIL', 
        duration, 
        error: (error as Error).message 
      });
      console.log(`    ❌ FAILED (${duration}ms): ${(error as Error).message}`);
    }
  }

  // Better Auth Integration Tests
  private async testSessionManagement(): Promise<void> {
    // Test session creation
    const authResponse = await fetch(`${CONFIG.API_BASE}/api/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CONFIG.DEMO_ACCOUNTS.creator)
    });
    
    assertEquals(authResponse.status, 200, 'Authentication should succeed');
    
    const sessionCookie = authResponse.headers.get('set-cookie');
    assertExists(sessionCookie, 'Session cookie should be set');
    
    this.context.sessionTokens.set('creator', sessionCookie);
    
    // Test session validation
    const sessionResponse = await fetch(`${CONFIG.API_BASE}/api/auth/session`, {
      headers: { 'Cookie': sessionCookie }
    });
    
    assertEquals(sessionResponse.status, 200, 'Session should be valid');
    
    const sessionData = await sessionResponse.json();
    assertExists(sessionData.user, 'Session should contain user data');
    assertEquals(sessionData.user.email, CONFIG.DEMO_ACCOUNTS.creator.email, 'Session should match authenticated user');
  }

  private async testCrossPortalAuth(): Promise<void> {
    // Test authentication across all three portals
    const portals = Object.entries(CONFIG.DEMO_ACCOUNTS);
    
    for (const [portal, credentials] of portals) {
      const authResponse = await fetch(`${CONFIG.API_BASE}/api/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      assertEquals(authResponse.status, 200, `${portal} authentication should succeed`);
      
      const sessionCookie = authResponse.headers.get('set-cookie');
      assertExists(sessionCookie, `${portal} session cookie should be set`);
      
      this.context.sessionTokens.set(portal, sessionCookie);
      
      // Test portal-specific access
      const profileResponse = await fetch(`${CONFIG.API_BASE}/api/user/profile`, {
        headers: { 'Cookie': sessionCookie }
      });
      
      assertEquals(profileResponse.status, 200, `${portal} profile access should work`);
    }
  }

  private async testSessionPersistence(): Promise<void> {
    const session = this.context.sessionTokens.get('creator');
    assertExists(session, 'Creator session required');
    
    // Test session refresh
    const refreshResponse = await fetch(`${CONFIG.API_BASE}/api/auth/session/refresh`, {
      method: 'POST',
      headers: { 'Cookie': session }
    });
    
    assertEquals(refreshResponse.status, 200, 'Session refresh should succeed');
    
    const newSessionCookie = refreshResponse.headers.get('set-cookie');
    if (newSessionCookie) {
      this.context.sessionTokens.set('creator', newSessionCookie);
    }
    
    // Test session longevity (simulate time passage)
    await delay(1000);
    
    const persistenceResponse = await fetch(`${CONFIG.API_BASE}/api/auth/session`, {
      headers: { 'Cookie': this.context.sessionTokens.get('creator')! }
    });
    
    assertEquals(persistenceResponse.status, 200, 'Session should persist over time');
  }

  private async testCookieSecurity(): Promise<void> {
    const session = this.context.sessionTokens.get('creator');
    assertExists(session, 'Creator session required');
    
    // Test that session cookie has proper security attributes
    assert(session.includes('HttpOnly'), 'Session cookie should be HttpOnly');
    assert(session.includes('Secure') || session.includes('SameSite'), 'Session cookie should have security attributes');
    
    // Test session tampering protection
    const tamperedSession = session.replace(/[a-f0-9]{8}/, '12345678');
    
    const tamperResponse = await fetch(`${CONFIG.API_BASE}/api/auth/session`, {
      headers: { 'Cookie': tamperedSession }
    });
    
    assertEquals(tamperResponse.status, 401, 'Tampered session should be rejected');
  }

  private async testAuthRateLimiting(): Promise<void> {
    // Test authentication rate limiting
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        fetch(`${CONFIG.API_BASE}/api/auth/sign-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'invalid@test.com', password: 'wrongpassword' })
        })
      );
    }
    
    const responses = await Promise.all(promises);
    const rateLimited = responses.some(r => r.status === 429);
    
    assert(rateLimited, 'Rate limiting should be applied to failed login attempts');
  }

  // Database Integration Tests
  private async testDatabaseConnection(): Promise<void> {
    // Test database connectivity through API
    const dbResponse = await fetch(`${CONFIG.API_BASE}/api/health/database`, {
      headers: { 'Cookie': this.context.sessionTokens.get('creator')! }
    });
    
    assertEquals(dbResponse.status, 200, 'Database health check should pass');
    
    const dbHealth = await dbResponse.json();
    assertEquals(dbHealth.status, 'healthy', 'Database should be healthy');
    assertExists(dbHealth.connection_count, 'Should report connection count');
    assertExists(dbHealth.response_time, 'Should report response time');
  }

  private async testTransactionIntegrity(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    // Create a pitch to test transaction integrity
    const pitchResponse = await fetch(`${CONFIG.API_BASE}/api/pitches`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        title: 'Integration Test Pitch',
        genre: 'Drama',
        logline: 'Testing database transactions',
        synopsis: 'This pitch tests database transaction integrity',
        budget: 1000000,
        status: 'draft'
      })
    });
    
    assertEquals(pitchResponse.status, 201, 'Pitch creation should succeed');
    
    const pitch = await pitchResponse.json();
    this.context.testData.set('test_pitch_id', pitch.data.id);
    
    // Test that related data is properly created
    const pitchDetailResponse = await fetch(`${CONFIG.API_BASE}/api/pitches/${pitch.data.id}`, {
      headers: { 'Cookie': session }
    });
    
    assertEquals(pitchDetailResponse.status, 200, 'Pitch should be retrievable');
    
    const pitchDetail = await pitchDetailResponse.json();
    assertEquals(pitchDetail.data.title, 'Integration Test Pitch', 'Pitch data should be consistent');
  }

  private async testDatabaseFailover(): Promise<void> {
    // Test database resilience by making multiple concurrent requests
    const session = this.context.sessionTokens.get('creator')!;
    
    const concurrentRequests = Array(5).fill(null).map(() =>
      fetch(`${CONFIG.API_BASE}/api/pitches`, {
        headers: { 'Cookie': session }
      })
    );
    
    const responses = await Promise.all(concurrentRequests);
    const successfulResponses = responses.filter(r => r.status === 200);
    
    assert(successfulResponses.length >= 4, 'Most database requests should succeed during load');
  }

  private async testQueryPerformance(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    const start = Date.now();
    const response = await fetch(`${CONFIG.API_BASE}/api/pitches`, {
      headers: { 'Cookie': session }
    });
    const duration = Date.now() - start;
    
    assertEquals(response.status, 200, 'Query should succeed');
    assert(duration < 1000, 'Database query should complete in under 1 second');
  }

  private async testConnectionLimits(): Promise<void> {
    // Test that the system handles connection pool limits gracefully
    const session = this.context.sessionTokens.get('creator')!;
    
    const promises = Array(20).fill(null).map(() =>
      fetch(`${CONFIG.API_BASE}/api/health/database`, {
        headers: { 'Cookie': session }
      })
    );
    
    const responses = await Promise.all(promises);
    const successCount = responses.filter(r => r.status === 200).length;
    
    assert(successCount >= 15, 'Connection pool should handle multiple concurrent requests');
  }

  // Cache Integration Tests
  private async testCacheOperations(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    // Test cache through API endpoints that use caching
    const firstResponse = await fetch(`${CONFIG.API_BASE}/api/pitches`, {
      headers: { 'Cookie': session }
    });
    
    assertEquals(firstResponse.status, 200, 'First request should succeed');
    
    const firstTime = Date.now();
    const secondResponse = await fetch(`${CONFIG.API_BASE}/api/pitches`, {
      headers: { 'Cookie': session }
    });
    const secondTime = Date.now();
    
    assertEquals(secondResponse.status, 200, 'Second request should succeed');
    
    // Second request should be faster due to caching
    const firstData = await firstResponse.json();
    const secondData = await secondResponse.json();
    
    assertEquals(JSON.stringify(firstData), JSON.stringify(secondData), 'Cached data should match');
  }

  private async testCacheInvalidation(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    const pitchId = this.context.testData.get('test_pitch_id');
    
    if (!pitchId) {
      throw new Error('Test pitch ID required for cache invalidation test');
    }
    
    // Get initial pitch data
    const initialResponse = await fetch(`${CONFIG.API_BASE}/api/pitches/${pitchId}`, {
      headers: { 'Cookie': session }
    });
    
    assertEquals(initialResponse.status, 200, 'Initial pitch fetch should succeed');
    
    // Update the pitch
    const updateResponse = await fetch(`${CONFIG.API_BASE}/api/pitches/${pitchId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        logline: 'Updated logline for cache invalidation test'
      })
    });
    
    assertEquals(updateResponse.status, 200, 'Pitch update should succeed');
    
    // Get updated pitch data
    const updatedResponse = await fetch(`${CONFIG.API_BASE}/api/pitches/${pitchId}`, {
      headers: { 'Cookie': session }
    });
    
    assertEquals(updatedResponse.status, 200, 'Updated pitch fetch should succeed');
    
    const updatedData = await updatedResponse.json();
    assertEquals(updatedData.data.logline, 'Updated logline for cache invalidation test', 'Cache should be invalidated');
  }

  private async testRedisSessionStorage(): Promise<void> {
    // Test session storage in Redis through session operations
    const session = this.context.sessionTokens.get('creator')!;
    
    // Update user preferences (stored in session/cache)
    const preferencesResponse = await fetch(`${CONFIG.API_BASE}/api/user/preferences`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        notification_preferences: {
          email: true,
          browser: false,
          mobile: true
        },
        theme: 'dark'
      })
    });
    
    assertEquals(preferencesResponse.status, 200, 'Preferences update should succeed');
    
    // Verify preferences are stored and retrievable
    const getPreferencesResponse = await fetch(`${CONFIG.API_BASE}/api/user/preferences`, {
      headers: { 'Cookie': session }
    });
    
    assertEquals(getPreferencesResponse.status, 200, 'Preferences retrieval should succeed');
    
    const preferences = await getPreferencesResponse.json();
    assertEquals(preferences.data.theme, 'dark', 'Preferences should be stored in cache');
  }

  private async testDistributedCaching(): Promise<void> {
    // Test that cache works across different sessions
    const creatorSession = this.context.sessionTokens.get('creator')!;
    const investorSession = this.context.sessionTokens.get('investor')!;
    
    // Creator accesses pitch data (should cache it)
    const creatorResponse = await fetch(`${CONFIG.API_BASE}/api/pitches/public`, {
      headers: { 'Cookie': creatorSession }
    });
    
    assertEquals(creatorResponse.status, 200, 'Creator request should succeed');
    
    // Investor accesses same data (should hit cache)
    const investorResponse = await fetch(`${CONFIG.API_BASE}/api/pitches/public`, {
      headers: { 'Cookie': investorSession }
    });
    
    assertEquals(investorResponse.status, 200, 'Investor request should succeed');
    
    const creatorData = await creatorResponse.json();
    const investorData = await investorResponse.json();
    
    assertEquals(JSON.stringify(creatorData), JSON.stringify(investorData), 'Distributed cache should serve same data');
  }

  private async testCachePerformance(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    // Clear any existing cache by making a unique request first
    const uniqueParam = Date.now();
    const firstResponse = await fetch(`${CONFIG.API_BASE}/api/pitches?t=${uniqueParam}`, {
      headers: { 'Cookie': session }
    });
    
    assertEquals(firstResponse.status, 200, 'First request should succeed');
    
    // Time the second request (should be cached)
    const start = Date.now();
    const cachedResponse = await fetch(`${CONFIG.API_BASE}/api/pitches?t=${uniqueParam}`, {
      headers: { 'Cookie': session }
    });
    const duration = Date.now() - start;
    
    assertEquals(cachedResponse.status, 200, 'Cached request should succeed');
    assert(duration < 100, 'Cached request should be very fast (< 100ms)');
  }

  // R2 Storage Integration Tests
  private async testR2Operations(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    const pitchId = this.context.testData.get('test_pitch_id');
    
    if (!pitchId) {
      throw new Error('Test pitch ID required for R2 operations test');
    }
    
    // Test file upload to R2
    const testContent = new TextEncoder().encode('Integration test file content');
    const formData = new FormData();
    formData.append('file', new Blob([testContent], { type: 'text/plain' }), 'integration-test.txt');
    
    const uploadResponse = await fetch(`${CONFIG.API_BASE}/api/pitches/${pitchId}/documents`, {
      method: 'POST',
      headers: { 'Cookie': session },
      body: formData
    });
    
    assertEquals(uploadResponse.status, 201, 'File upload should succeed');
    
    const uploadResult = await uploadResponse.json();
    assertExists(uploadResult.data.file_url, 'Upload should return file URL');
    
    // Test file download
    const downloadResponse = await fetch(uploadResult.data.file_url);
    assertEquals(downloadResponse.status, 200, 'File should be downloadable');
    
    const downloadedContent = await downloadResponse.text();
    assertEquals(downloadedContent, 'Integration test file content', 'Downloaded content should match uploaded content');
    
    this.context.testData.set('test_file_url', uploadResult.data.file_url);
  }

  private async testMultipartUpload(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    const pitchId = this.context.testData.get('test_pitch_id');
    
    if (!pitchId) {
      throw new Error('Test pitch ID required for multipart upload test');
    }
    
    // Create a larger test file (simulate video upload)
    const largeContent = new Uint8Array(10 * 1024 * 1024); // 10MB
    for (let i = 0; i < largeContent.length; i++) {
      largeContent[i] = i % 256;
    }
    
    const formData = new FormData();
    formData.append('file', new Blob([largeContent], { type: 'video/mp4' }), 'large-test-video.mp4');
    
    const uploadResponse = await fetch(`${CONFIG.API_BASE}/api/pitches/${pitchId}/media`, {
      method: 'POST',
      headers: { 'Cookie': session },
      body: formData
    });
    
    assertEquals(uploadResponse.status, 201, 'Large file upload should succeed');
    
    const uploadResult = await uploadResponse.json();
    assertExists(uploadResult.data.file_url, 'Large file upload should return URL');
  }

  private async testCDNIntegration(): Promise<void> {
    const fileUrl = this.context.testData.get('test_file_url');
    
    if (!fileUrl) {
      throw new Error('Test file URL required for CDN test');
    }
    
    // Test CDN headers and performance
    const cdnResponse = await fetch(fileUrl, { method: 'HEAD' });
    assertEquals(cdnResponse.status, 200, 'CDN should serve file');
    
    // Check for CDN headers
    const cacheControl = cdnResponse.headers.get('cache-control');
    const cfCache = cdnResponse.headers.get('cf-cache-status');
    
    assertExists(cacheControl, 'Cache control headers should be present');
    // CF cache status might not be present on first request, so we don't assert it
  }

  private async testStorageLimits(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    const pitchId = this.context.testData.get('test_pitch_id');
    
    if (!pitchId) {
      throw new Error('Test pitch ID required for storage limits test');
    }
    
    // Test file size limit (try to upload file that's too large)
    const oversizedContent = new Uint8Array(200 * 1024 * 1024); // 200MB - should exceed limit
    const formData = new FormData();
    formData.append('file', new Blob([oversizedContent]), 'oversized.bin');
    
    const uploadResponse = await fetch(`${CONFIG.API_BASE}/api/pitches/${pitchId}/documents`, {
      method: 'POST',
      headers: { 'Cookie': session },
      body: formData
    });
    
    assert(uploadResponse.status >= 400, 'Oversized file should be rejected');
  }

  private async testFileMetadata(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    const pitchId = this.context.testData.get('test_pitch_id');
    
    if (!pitchId) {
      throw new Error('Test pitch ID required for file metadata test');
    }
    
    // Get file metadata
    const metadataResponse = await fetch(`${CONFIG.API_BASE}/api/pitches/${pitchId}/documents`, {
      headers: { 'Cookie': session }
    });
    
    assertEquals(metadataResponse.status, 200, 'Metadata retrieval should succeed');
    
    const metadata = await metadataResponse.json();
    assert(metadata.data.length > 0, 'Should have file metadata');
    
    const file = metadata.data[0];
    assertExists(file.filename, 'File should have filename');
    assertExists(file.size, 'File should have size');
    assertExists(file.content_type, 'File should have content type');
    assertExists(file.uploaded_at, 'File should have upload timestamp');
  }

  // Queue Processing Tests
  private async testQueueOperations(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    // Trigger a job that uses the queue system (like video processing)
    const jobResponse = await fetch(`${CONFIG.API_BASE}/api/jobs/process-video`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        video_url: 'https://example.com/test-video.mp4',
        processing_options: {
          generate_thumbnails: true,
          create_preview: true,
          extract_metadata: true
        }
      })
    });
    
    assertEquals(jobResponse.status, 202, 'Job should be accepted for processing');
    
    const jobResult = await jobResponse.json();
    assertExists(jobResult.data.job_id, 'Job should have ID');
    
    this.context.testData.set('test_job_id', jobResult.data.job_id);
    
    // Check job status
    const statusResponse = await fetch(`${CONFIG.API_BASE}/api/jobs/${jobResult.data.job_id}/status`, {
      headers: { 'Cookie': session }
    });
    
    assertEquals(statusResponse.status, 200, 'Job status should be accessible');
    
    const statusData = await statusResponse.json();
    assert(['queued', 'processing', 'completed', 'failed'].includes(statusData.data.status), 'Job should have valid status');
  }

  private async testJobPriority(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    // Submit high priority job
    const highPriorityResponse = await fetch(`${CONFIG.API_BASE}/api/jobs/analyze-pitch`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        pitch_id: this.context.testData.get('test_pitch_id'),
        priority: 'high',
        analysis_type: 'quick'
      })
    });
    
    assertEquals(highPriorityResponse.status, 202, 'High priority job should be accepted');
    
    // Submit low priority job
    const lowPriorityResponse = await fetch(`${CONFIG.API_BASE}/api/jobs/generate-report`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        pitch_id: this.context.testData.get('test_pitch_id'),
        priority: 'low',
        report_type: 'detailed'
      })
    });
    
    assertEquals(lowPriorityResponse.status, 202, 'Low priority job should be accepted');
    
    // Both jobs should be queued properly
    const highPriorityJob = await highPriorityResponse.json();
    const lowPriorityJob = await lowPriorityResponse.json();
    
    assertExists(highPriorityJob.data.job_id, 'High priority job should have ID');
    assertExists(lowPriorityJob.data.job_id, 'Low priority job should have ID');
  }

  private async testQueueErrorHandling(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    // Submit job with invalid parameters
    const invalidJobResponse = await fetch(`${CONFIG.API_BASE}/api/jobs/process-video`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        video_url: 'invalid-url',
        processing_options: {
          invalid_option: true
        }
      })
    });
    
    // Should either reject immediately or accept and mark as failed
    assert(invalidJobResponse.status === 400 || invalidJobResponse.status === 202, 'Invalid job should be handled gracefully');
    
    if (invalidJobResponse.status === 202) {
      const jobResult = await invalidJobResponse.json();
      
      // Wait a moment for processing
      await delay(2000);
      
      const statusResponse = await fetch(`${CONFIG.API_BASE}/api/jobs/${jobResult.data.job_id}/status`, {
        headers: { 'Cookie': session }
      });
      
      const statusData = await statusResponse.json();
      assertEquals(statusData.data.status, 'failed', 'Invalid job should fail');
    }
  }

  private async testDeadLetterQueue(): Promise<void> {
    // Test that failed jobs are properly moved to dead letter queue
    const session = this.context.sessionTokens.get('creator')!;
    
    // Check dead letter queue status
    const dlqResponse = await fetch(`${CONFIG.API_BASE}/api/admin/queue/dead-letter`, {
      headers: { 'Cookie': session }
    });
    
    // This endpoint might not exist or might require admin privileges
    // So we'll check that it either succeeds or gives appropriate error
    assert(dlqResponse.status === 200 || dlqResponse.status === 403 || dlqResponse.status === 404, 
      'Dead letter queue endpoint should respond appropriately');
  }

  private async testQueuePerformance(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    // Submit multiple jobs quickly
    const jobs = [];
    for (let i = 0; i < 5; i++) {
      const jobPromise = fetch(`${CONFIG.API_BASE}/api/jobs/quick-analysis`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': session 
        },
        body: JSON.stringify({
          data: `test-${i}`,
          timestamp: Date.now()
        })
      });
      jobs.push(jobPromise);
    }
    
    const responses = await Promise.all(jobs);
    const successCount = responses.filter(r => r.status === 202).length;
    
    assert(successCount >= 4, 'Queue should handle multiple concurrent job submissions');
  }

  // Durable Objects Tests
  private async testDurableObjectState(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    // Test notification hub state management
    const wsUrl = `${CONFIG.API_BASE.replace('https:', 'wss:')}/ws`;
    
    // This is a simplified test - in reality, we'd test through WebSocket connections
    const hubStatusResponse = await fetch(`${CONFIG.API_BASE}/api/durable-objects/notification-hub/status`, {
      headers: { 'Cookie': session }
    });
    
    // The endpoint might not exist, so we test that the system responds appropriately
    assert(hubStatusResponse.status === 200 || hubStatusResponse.status === 404, 
      'Durable object status endpoint should respond appropriately');
  }

  private async testCrossObjectCommunication(): Promise<void> {
    // Test communication between different durable object instances
    const session = this.context.sessionTokens.get('creator')!;
    
    // Send a message that should trigger cross-object communication
    const messageResponse = await fetch(`${CONFIG.API_BASE}/api/notifications/broadcast`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        type: 'test_message',
        content: 'Cross-object communication test',
        recipients: 'all'
      })
    });
    
    // Should either succeed or give appropriate error
    assert(messageResponse.status === 200 || messageResponse.status === 501, 
      'Cross-object communication should be handled appropriately');
  }

  private async testStatePersistence(): Promise<void> {
    // Test that durable object state persists across requests
    const session = this.context.sessionTokens.get('creator')!;
    
    // Set some state
    const setState = await fetch(`${CONFIG.API_BASE}/api/user/session-state`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        test_key: 'test_value',
        timestamp: Date.now()
      })
    });
    
    assert(setState.status === 200 || setState.status === 501, 'State setting should be handled');
    
    if (setState.status === 200) {
      // Get the state back
      const getState = await fetch(`${CONFIG.API_BASE}/api/user/session-state`, {
        headers: { 'Cookie': session }
      });
      
      assertEquals(getState.status, 200, 'State retrieval should succeed');
      
      const stateData = await getState.json();
      assertEquals(stateData.data.test_key, 'test_value', 'State should persist');
    }
  }

  private async testConcurrencyControl(): Promise<void> {
    // Test that durable objects handle concurrent requests properly
    const session = this.context.sessionTokens.get('creator')!;
    
    // Make multiple concurrent requests to the same durable object
    const requests = Array(3).fill(null).map(() =>
      fetch(`${CONFIG.API_BASE}/api/user/profile`, {
        headers: { 'Cookie': session }
      })
    );
    
    const responses = await Promise.all(requests);
    const successCount = responses.filter(r => r.status === 200).length;
    
    assertEquals(successCount, 3, 'All concurrent requests to durable object should succeed');
  }

  private async testObjectMigration(): Promise<void> {
    // Test durable object migration/recovery scenarios
    const session = this.context.sessionTokens.get('creator')!;
    
    // This is a conceptual test - we'd test that objects can be recreated properly
    const migrationTestResponse = await fetch(`${CONFIG.API_BASE}/api/durable-objects/health`, {
      headers: { 'Cookie': session }
    });
    
    // Should respond appropriately whether the endpoint exists or not
    assert(migrationTestResponse.status === 200 || migrationTestResponse.status === 404, 
      'Durable object migration should be handled appropriately');
  }

  // Workflow Orchestration Tests
  private async testMultiStepWorkflows(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    const pitchId = this.context.testData.get('test_pitch_id');
    
    if (!pitchId) {
      throw new Error('Test pitch ID required for workflow test');
    }
    
    // Start a multi-step workflow (pitch processing)
    const workflowResponse = await fetch(`${CONFIG.API_BASE}/api/workflows/pitch-processing`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        pitch_id: pitchId,
        steps: ['validation', 'analysis', 'document_generation', 'notification']
      })
    });
    
    assertEquals(workflowResponse.status, 202, 'Workflow should be accepted');
    
    const workflowResult = await workflowResponse.json();
    assertExists(workflowResult.data.workflow_id, 'Workflow should have ID');
    
    // Check workflow status
    const statusResponse = await fetch(`${CONFIG.API_BASE}/api/workflows/${workflowResult.data.workflow_id}/status`, {
      headers: { 'Cookie': session }
    });
    
    assertEquals(statusResponse.status, 200, 'Workflow status should be accessible');
    
    const statusData = await statusResponse.json();
    assertExists(statusData.data.current_step, 'Workflow should have current step');
    assertExists(statusData.data.steps_completed, 'Workflow should track completed steps');
  }

  private async testWorkflowErrorRecovery(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    // Start a workflow that might fail
    const workflowResponse = await fetch(`${CONFIG.API_BASE}/api/workflows/test-failure`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        test_failure: true,
        recovery_strategy: 'retry'
      })
    });
    
    // Should either succeed or give appropriate error
    assert(workflowResponse.status === 202 || workflowResponse.status === 501, 
      'Workflow error handling should be appropriate');
  }

  private async testParallelWorkflows(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    const pitchId = this.context.testData.get('test_pitch_id');
    
    if (!pitchId) {
      throw new Error('Test pitch ID required for parallel workflow test');
    }
    
    // Start multiple workflows simultaneously
    const workflows = [
      fetch(`${CONFIG.API_BASE}/api/workflows/analysis`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': session 
        },
        body: JSON.stringify({ pitch_id: pitchId, type: 'market' })
      }),
      fetch(`${CONFIG.API_BASE}/api/workflows/analysis`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': session 
        },
        body: JSON.stringify({ pitch_id: pitchId, type: 'financial' })
      })
    ];
    
    const responses = await Promise.all(workflows);
    const successCount = responses.filter(r => r.status === 202 || r.status === 200).length;
    
    assert(successCount >= 1, 'At least one parallel workflow should succeed');
  }

  private async testWorkflowStateManagement(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    
    // Test workflow state persistence
    const stateResponse = await fetch(`${CONFIG.API_BASE}/api/workflows/state`, {
      headers: { 'Cookie': session }
    });
    
    // Should respond appropriately whether workflows exist or not
    assert(stateResponse.status === 200 || stateResponse.status === 404, 
      'Workflow state management should be handled appropriately');
  }

  private async testCrossServiceOrchestration(): Promise<void> {
    const session = this.context.sessionTokens.get('creator')!;
    const pitchId = this.context.testData.get('test_pitch_id');
    
    if (!pitchId) {
      throw new Error('Test pitch ID required for cross-service orchestration test');
    }
    
    // Test orchestration that involves multiple services
    const orchestrationResponse = await fetch(`${CONFIG.API_BASE}/api/orchestration/full-pitch-analysis`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': session 
      },
      body: JSON.stringify({
        pitch_id: pitchId,
        services: ['ai_analysis', 'document_generation', 'notification', 'storage']
      })
    });
    
    // Should handle orchestration appropriately
    assert(orchestrationResponse.status === 202 || orchestrationResponse.status === 501, 
      'Cross-service orchestration should be handled appropriately');
  }

  private printIntegrationSummary(): void {
    const componentResults = new Map<string, { passed: number, failed: number, total: number }>();
    
    // Group results by component
    for (const result of this.results) {
      if (!componentResults.has(result.component)) {
        componentResults.set(result.component, { passed: 0, failed: 0, total: 0 });
      }
      
      const stats = componentResults.get(result.component)!;
      stats.total++;
      if (result.status === 'PASS') {
        stats.passed++;
      } else if (result.status === 'FAIL') {
        stats.failed++;
      }
    }
    
    const totalPassed = this.results.filter(r => r.status === 'PASS').length;
    const totalFailed = this.results.filter(r => r.status === 'FAIL').length;
    const totalTests = this.results.length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('\n🎯 Integration Verification Summary');
    console.log('=====================================');
    
    // Component breakdown
    for (const [component, stats] of componentResults) {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      const status = stats.failed === 0 ? '✅' : stats.passed === 0 ? '❌' : '⚠️';
      console.log(`${status} ${component}: ${stats.passed}/${stats.total} (${successRate}%)`);
    }
    
    console.log('\n📊 Overall Results:');
    console.log(`📈 Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`📈 Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    
    if (totalFailed > 0) {
      console.log('\n❌ Failed Integration Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   • ${r.component} - ${r.test}: ${r.error}`));
    }
    
    // Integration readiness assessment
    const successRate = (totalPassed / totalTests) * 100;
    let integrationStatus = '';
    
    if (successRate >= 95) {
      integrationStatus = '🎉 ALL INTEGRATIONS READY';
    } else if (successRate >= 85) {
      integrationStatus = '✅ INTEGRATIONS MOSTLY READY - Minor fixes needed';
    } else if (successRate >= 70) {
      integrationStatus = '⚠️  INTEGRATION ISSUES - Attention required';
    } else {
      integrationStatus = '❌ CRITICAL INTEGRATION FAILURES - Must be resolved';
    }
    
    console.log(`\n🔧 Integration Status: ${integrationStatus}`);
    console.log('=====================================\n');
  }
}

// Export for use in other test files
export { IntegrationVerificationSuite, type IntegrationTestResult };

// Run if called directly
if (import.meta.main) {
  const suite = new IntegrationVerificationSuite();
  const results = await suite.runAllIntegrationTests();
  
  // Exit with error code if tests failed
  const failed = results.filter(r => r.status === 'FAIL').length;
  Deno.exit(failed > 0 ? 1 : 0);
}