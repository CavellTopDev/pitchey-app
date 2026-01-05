#!/usr/bin/env -S deno run --allow-all

/**
 * Complete End-to-End Workflow Validation for Pitchey Platform
 * 
 * This comprehensive test suite validates all critical user workflows
 * from start to finish in a production-like environment.
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { delay } from "https://deno.land/std@0.208.0/async/delay.ts";

// Configuration
const CONFIG = {
  API_BASE: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  WS_BASE: 'wss://pitchey-api-prod.ndlovucavelle.workers.dev',
  FRONTEND_BASE: 'https://pitchey-5o8-66n.pages.dev',
  TEST_TIMEOUT: 120000, // 2 minutes per test
  DEMO_ACCOUNTS: {
    creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
    investor: { email: 'sarah.investor@demo.com', password: 'Demo123' },
    production: { email: 'stellar.production@demo.com', password: 'Demo123' }
  }
};

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  details?: Record<string, any>;
}

interface WorkflowContext {
  sessions: Map<string, string>;
  pitchId?: string;
  documentId?: string;
  analysisId?: string;
  mediaId?: string;
  ndaId?: string;
}

class WorkflowValidator {
  private results: TestResult[] = [];
  private context: WorkflowContext;
  
  constructor() {
    this.context = {
      sessions: new Map()
    };
  }

  async runAllValidations(): Promise<TestResult[]> {
    console.log('🚀 Starting Complete Workflow Validation Suite');
    console.log('=====================================');
    
    // Authentication Setup
    await this.runTest('Setup Demo User Sessions', () => this.setupDemoSessions());
    
    // Core Workflow Tests
    await this.runTest('Complete Pitch Submission Workflow', () => this.validatePitchSubmission());
    await this.runTest('Document Generation & NDA Workflow', () => this.validateDocumentWorkflow());
    await this.runTest('AI Analysis Pipeline', () => this.validateAIAnalysisPipeline());
    await this.runTest('Media Processing & Publishing', () => this.validateMediaProcessing());
    await this.runTest('Multi-User Collaboration', () => this.validateCollaboration());
    
    // Advanced Workflow Tests
    await this.runTest('Investment Decision Workflow', () => this.validateInvestmentFlow());
    await this.runTest('Production Partnership Flow', () => this.validateProductionFlow());
    await this.runTest('Real-time Notification System', () => this.validateNotifications());
    
    // Error Handling & Recovery
    await this.runTest('Error Recovery Scenarios', () => this.validateErrorRecovery());
    await this.runTest('Concurrent User Processing', () => this.validateConcurrentProcessing());
    
    // Performance & Load Tests
    await this.runTest('High Load Video Processing', () => this.validateHighLoadProcessing());
    await this.runTest('WebSocket Connection Management', () => this.validateWebSocketManagement());
    
    this.printSummary();
    return this.results;
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    console.log(`\n🧪 Running: ${name}`);
    
    try {
      await Promise.race([
        testFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), CONFIG.TEST_TIMEOUT)
        )
      ]);
      
      const duration = Date.now() - startTime;
      this.results.push({ name, status: 'PASS', duration });
      console.log(`✅ PASSED (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.push({ 
        name, 
        status: 'FAIL', 
        duration, 
        error: error.message 
      });
      console.log(`❌ FAILED (${duration}ms): ${error.message}`);
    }
  }

  // Authentication & Session Management
  private async setupDemoSessions(): Promise<void> {
    console.log('  Setting up demo user sessions...');
    
    for (const [role, credentials] of Object.entries(CONFIG.DEMO_ACCOUNTS)) {
      const response = await fetch(`${CONFIG.API_BASE}/api/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to authenticate ${role}: ${response.status}`);
      }
      
      const sessionCookie = response.headers.get('set-cookie');
      if (sessionCookie) {
        this.context.sessions.set(role, sessionCookie);
        console.log(`    ✓ ${role} session established`);
      }
    }
    
    assertEquals(this.context.sessions.size, 3, 'All demo sessions should be established');
  }

  // Complete Pitch Submission Workflow
  private async validatePitchSubmission(): Promise<void> {
    console.log('  Testing complete pitch submission workflow...');
    
    const creatorSession = this.context.sessions.get('creator');
    assertExists(creatorSession, 'Creator session required');

    // Step 1: Create new pitch draft
    console.log('    Creating pitch draft...');
    const draftResponse = await this.apiCall('POST', '/api/pitches', {
      title: 'E2E Test Movie Pitch',
      genre: 'Action',
      logline: 'A comprehensive test of the pitch submission system',
      synopsis: 'This is a detailed test pitch created during end-to-end validation...',
      budget: 5000000,
      target_audience: 'General audiences',
      status: 'draft'
    }, creatorSession);

    this.context.pitchId = draftResponse.data.id;
    console.log(`    ✓ Draft created with ID: ${this.context.pitchId}`);

    // Step 2: Upload pitch deck document
    console.log('    Uploading pitch deck...');
    const mockPDF = await this.createMockDocument('pitch-deck.pdf');
    const uploadResponse = await this.uploadFile('/api/pitches/' + this.context.pitchId + '/documents', 
      mockPDF, 'pitch_deck', creatorSession);
    console.log('    ✓ Pitch deck uploaded');

    // Step 3: Add video pitch
    console.log('    Adding video pitch...');
    const mockVideo = await this.createMockVideo('pitch-video.mp4');
    const videoResponse = await this.uploadFile('/api/pitches/' + this.context.pitchId + '/media',
      mockVideo, 'pitch_video', creatorSession);
    this.context.mediaId = videoResponse.data.id;
    console.log('    ✓ Video pitch uploaded');

    // Step 4: Submit for review
    console.log('    Submitting pitch for review...');
    await this.apiCall('POST', `/api/pitches/${this.context.pitchId}/submit`, {}, creatorSession);
    console.log('    ✓ Pitch submitted for review');

    // Step 5: Verify submission status
    const statusResponse = await this.apiCall('GET', `/api/pitches/${this.context.pitchId}`, {}, creatorSession);
    assertEquals(statusResponse.data.status, 'under_review', 'Pitch should be under review');
    console.log('    ✓ Pitch status verified');
  }

  // Document Generation & NDA Workflow
  private async validateDocumentWorkflow(): Promise<void> {
    console.log('  Testing document generation and NDA workflow...');
    
    const investorSession = this.context.sessions.get('investor');
    assertExists(investorSession, 'Investor session required');
    assertExists(this.context.pitchId, 'Pitch ID required from previous test');

    // Step 1: Investor requests access to pitch
    console.log('    Requesting pitch access as investor...');
    const accessResponse = await this.apiCall('POST', `/api/pitches/${this.context.pitchId}/request-access`, {
      message: 'Interested in reviewing this project for potential investment'
    }, investorSession);
    console.log('    ✓ Access request submitted');

    // Step 2: System generates NDA
    console.log('    Generating NDA document...');
    await delay(2000); // Allow time for document generation
    
    const ndaResponse = await this.apiCall('GET', `/api/pitches/${this.context.pitchId}/nda`, {}, investorSession);
    this.context.ndaId = ndaResponse.data.id;
    assertExists(ndaResponse.data.document_url, 'NDA document URL should exist');
    console.log('    ✓ NDA generated and available');

    // Step 3: Sign NDA
    console.log('    Signing NDA...');
    await this.apiCall('POST', `/api/ndas/${this.context.ndaId}/sign`, {
      signature: 'Sarah Investor',
      timestamp: new Date().toISOString()
    }, investorSession);
    console.log('    ✓ NDA signed');

    // Step 4: Verify access granted
    const pitchResponse = await this.apiCall('GET', `/api/pitches/${this.context.pitchId}/full`, {}, investorSession);
    assertExists(pitchResponse.data.synopsis, 'Full pitch details should be accessible after NDA');
    console.log('    ✓ Full pitch access granted after NDA signing');
  }

  // AI Analysis Pipeline
  private async validateAIAnalysisPipeline(): Promise<void> {
    console.log('  Testing AI analysis pipeline...');
    
    const creatorSession = this.context.sessions.get('creator');
    assertExists(creatorSession, 'Creator session required');
    assertExists(this.context.pitchId, 'Pitch ID required');

    // Step 1: Request AI analysis
    console.log('    Requesting AI analysis...');
    const analysisResponse = await this.apiCall('POST', `/api/pitches/${this.context.pitchId}/analyze`, {
      analysis_type: 'market_viability',
      include_comparables: true,
      include_risk_assessment: true
    }, creatorSession);
    
    this.context.analysisId = analysisResponse.data.analysis_id;
    console.log(`    ✓ Analysis request submitted: ${this.context.analysisId}`);

    // Step 2: Monitor analysis progress
    console.log('    Monitoring analysis progress...');
    let analysisComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait
    
    while (!analysisComplete && attempts < maxAttempts) {
      await delay(1000);
      attempts++;
      
      const progressResponse = await this.apiCall('GET', 
        `/api/analysis/${this.context.analysisId}/status`, {}, creatorSession);
      
      if (progressResponse.data.status === 'completed') {
        analysisComplete = true;
        console.log(`    ✓ Analysis completed after ${attempts} seconds`);
      } else if (progressResponse.data.status === 'failed') {
        throw new Error('AI analysis failed');
      }
    }

    if (!analysisComplete) {
      throw new Error('AI analysis timed out');
    }

    // Step 3: Retrieve and validate analysis results
    console.log('    Retrieving analysis results...');
    const resultsResponse = await this.apiCall('GET', 
      `/api/analysis/${this.context.analysisId}/results`, {}, creatorSession);
    
    assertExists(resultsResponse.data.market_score, 'Market score should exist');
    assertExists(resultsResponse.data.risk_factors, 'Risk factors should exist');
    assertExists(resultsResponse.data.comparable_projects, 'Comparable projects should exist');
    console.log('    ✓ Analysis results validated');
  }

  // Media Processing & Publishing
  private async validateMediaProcessing(): Promise<void> {
    console.log('  Testing media processing and publishing...');
    
    const creatorSession = this.context.sessions.get('creator');
    assertExists(creatorSession, 'Creator session required');
    assertExists(this.context.mediaId, 'Media ID required');

    // Step 1: Check video processing status
    console.log('    Checking video processing status...');
    const processResponse = await this.apiCall('GET', 
      `/api/media/${this.context.mediaId}/status`, {}, creatorSession);
    
    // Wait for processing if still in progress
    if (processResponse.data.status === 'processing') {
      console.log('    Waiting for video processing to complete...');
      let processed = false;
      let attempts = 0;
      
      while (!processed && attempts < 60) { // Max 60 seconds
        await delay(1000);
        attempts++;
        
        const statusResponse = await this.apiCall('GET', 
          `/api/media/${this.context.mediaId}/status`, {}, creatorSession);
        
        if (statusResponse.data.status === 'completed') {
          processed = true;
          console.log(`    ✓ Video processing completed after ${attempts} seconds`);
        }
      }
      
      if (!processed) {
        throw new Error('Video processing timed out');
      }
    }

    // Step 2: Validate streaming formats
    console.log('    Validating streaming formats...');
    const streamingResponse = await this.apiCall('GET', 
      `/api/media/${this.context.mediaId}/streaming`, {}, creatorSession);
    
    assertExists(streamingResponse.data.hls_url, 'HLS streaming URL should exist');
    assertExists(streamingResponse.data.dash_url, 'DASH streaming URL should exist');
    console.log('    ✓ Streaming formats available');

    // Step 3: Test streaming endpoints
    console.log('    Testing streaming endpoints...');
    const hlsResponse = await fetch(streamingResponse.data.hls_url);
    assertEquals(hlsResponse.status, 200, 'HLS stream should be accessible');
    
    const dashResponse = await fetch(streamingResponse.data.dash_url);
    assertEquals(dashResponse.status, 200, 'DASH stream should be accessible');
    console.log('    ✓ Streaming endpoints validated');
  }

  // Multi-User Collaboration
  private async validateCollaboration(): Promise<void> {
    console.log('  Testing multi-user collaboration features...');
    
    const creatorSession = this.context.sessions.get('creator');
    const investorSession = this.context.sessions.get('investor');
    assertExists(creatorSession, 'Creator session required');
    assertExists(investorSession, 'Investor session required');
    assertExists(this.context.pitchId, 'Pitch ID required');

    // Step 1: Creator shares pitch for collaboration
    console.log('    Sharing pitch for collaboration...');
    await this.apiCall('POST', `/api/pitches/${this.context.pitchId}/share`, {
      collaborator_email: 'sarah.investor@demo.com',
      permissions: ['view', 'comment']
    }, creatorSession);
    console.log('    ✓ Pitch shared with collaborator');

    // Step 2: Test real-time comments
    console.log('    Testing real-time comments...');
    const commentResponse = await this.apiCall('POST', 
      `/api/pitches/${this.context.pitchId}/comments`, {
      content: 'This looks promising! I have some questions about the market size.',
      section: 'market_analysis'
    }, investorSession);
    
    assertExists(commentResponse.data.id, 'Comment should be created');
    console.log('    ✓ Comment added successfully');

    // Step 3: Verify comment appears for creator
    await delay(500); // Brief delay for real-time sync
    const commentsResponse = await this.apiCall('GET', 
      `/api/pitches/${this.context.pitchId}/comments`, {}, creatorSession);
    
    assert(commentsResponse.data.length > 0, 'Comments should be visible to creator');
    console.log('    ✓ Comments synchronized between users');
  }

  // Investment Decision Workflow
  private async validateInvestmentFlow(): Promise<void> {
    console.log('  Testing investment decision workflow...');
    
    const investorSession = this.context.sessions.get('investor');
    assertExists(investorSession, 'Investor session required');
    assertExists(this.context.pitchId, 'Pitch ID required');

    // Step 1: Express investment interest
    console.log('    Expressing investment interest...');
    const interestResponse = await this.apiCall('POST', 
      `/api/pitches/${this.context.pitchId}/invest`, {
      amount: 500000,
      terms: 'Seed round participation with board seat',
      message: 'We are interested in leading this round'
    }, investorSession);
    
    assertExists(interestResponse.data.investment_id, 'Investment interest should be recorded');
    console.log('    ✓ Investment interest recorded');

    // Step 2: Schedule meeting
    console.log('    Scheduling investment meeting...');
    await this.apiCall('POST', `/api/meetings/schedule`, {
      pitch_id: this.context.pitchId,
      meeting_type: 'investment_discussion',
      proposed_times: [
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Next week
      ]
    }, investorSession);
    console.log('    ✓ Meeting scheduled');

    // Step 3: Generate investment summary
    console.log('    Generating investment summary...');
    const summaryResponse = await this.apiCall('GET', 
      `/api/investments/${interestResponse.data.investment_id}/summary`, {}, investorSession);
    
    assertExists(summaryResponse.data.risk_assessment, 'Risk assessment should exist');
    assertExists(summaryResponse.data.financial_projections, 'Financial projections should exist');
    console.log('    ✓ Investment summary generated');
  }

  // Production Partnership Flow
  private async validateProductionFlow(): Promise<void> {
    console.log('  Testing production partnership workflow...');
    
    const productionSession = this.context.sessions.get('production');
    assertExists(productionSession, 'Production session required');
    assertExists(this.context.pitchId, 'Pitch ID required');

    // Step 1: Production company evaluates project
    console.log('    Evaluating project for production...');
    const evalResponse = await this.apiCall('POST', 
      `/api/pitches/${this.context.pitchId}/evaluate`, {
      evaluation_type: 'production_feasibility',
      budget_range: { min: 4000000, max: 6000000 },
      timeline_months: 18
    }, productionSession);
    
    assertExists(evalResponse.data.evaluation_id, 'Production evaluation should be created');
    console.log('    ✓ Production evaluation initiated');

    // Step 2: Request script and additional materials
    console.log('    Requesting additional materials...');
    await this.apiCall('POST', `/api/pitches/${this.context.pitchId}/request-materials`, {
      materials: ['full_script', 'character_breakdowns', 'location_requirements'],
      message: 'We are interested in moving forward with development'
    }, productionSession);
    console.log('    ✓ Additional materials requested');

    // Step 3: Generate production budget estimate
    console.log('    Generating production budget estimate...');
    const budgetResponse = await this.apiCall('POST', 
      `/api/production/budget-estimate`, {
      pitch_id: this.context.pitchId,
      production_scale: 'medium',
      locations: ['studio', 'on_location'],
      cast_tier: 'emerging'
    }, productionSession);
    
    assertExists(budgetResponse.data.estimated_budget, 'Budget estimate should be generated');
    console.log('    ✓ Production budget estimated');
  }

  // Real-time Notification System
  private async validateNotifications(): Promise<void> {
    console.log('  Testing real-time notification system...');
    
    // Step 1: Establish WebSocket connections
    console.log('    Establishing WebSocket connections...');
    const creatorWS = await this.connectWebSocket('creator');
    const investorWS = await this.connectWebSocket('investor');
    
    let notificationReceived = false;
    
    // Step 2: Set up notification listener
    creatorWS.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'notification' && message.data.type === 'new_comment') {
        notificationReceived = true;
        console.log('    ✓ Real-time notification received');
      }
    };
    
    // Step 3: Trigger notification event
    console.log('    Triggering notification event...');
    await this.apiCall('POST', `/api/pitches/${this.context.pitchId}/comments`, {
      content: 'Testing real-time notifications',
      section: 'general'
    }, this.context.sessions.get('investor')!);
    
    // Step 4: Wait for notification
    await delay(2000);
    assert(notificationReceived, 'Real-time notification should be received');
    
    // Cleanup
    creatorWS.close();
    investorWS.close();
    console.log('    ✓ WebSocket connections cleaned up');
  }

  // Error Recovery Scenarios
  private async validateErrorRecovery(): Promise<void> {
    console.log('  Testing error recovery scenarios...');
    
    const creatorSession = this.context.sessions.get('creator');
    assertExists(creatorSession, 'Creator session required');

    // Step 1: Test invalid pitch submission
    console.log('    Testing invalid pitch handling...');
    try {
      await this.apiCall('POST', '/api/pitches', {
        title: '', // Invalid empty title
        genre: 'InvalidGenre'
      }, creatorSession);
      throw new Error('Invalid pitch should be rejected');
    } catch (error) {
      if (error.message.includes('validation')) {
        console.log('    ✓ Invalid pitch properly rejected');
      } else {
        throw error;
      }
    }

    // Step 2: Test file upload failure recovery
    console.log('    Testing file upload recovery...');
    const oversizedFile = new Uint8Array(100 * 1024 * 1024); // 100MB - should be rejected
    try {
      await this.uploadFile('/api/pitches/' + this.context.pitchId + '/documents',
        oversizedFile, 'oversized_doc', creatorSession);
      throw new Error('Oversized file should be rejected');
    } catch (error) {
      if (error.message.includes('size') || error.message.includes('413')) {
        console.log('    ✓ Oversized file properly rejected');
      } else {
        throw error;
      }
    }

    // Step 3: Test session expiry handling
    console.log('    Testing session expiry handling...');
    try {
      await this.apiCall('GET', '/api/user/profile', {}, 'invalid-session');
      throw new Error('Invalid session should be rejected');
    } catch (error) {
      if (error.message.includes('unauthorized') || error.message.includes('401')) {
        console.log('    ✓ Invalid session properly handled');
      } else {
        throw error;
      }
    }
  }

  // Concurrent User Processing
  private async validateConcurrentProcessing(): Promise<void> {
    console.log('  Testing concurrent user processing...');
    
    const sessions = Array.from(this.context.sessions.values());
    
    // Step 1: Simulate concurrent API calls
    console.log('    Simulating concurrent API requests...');
    const concurrentCalls = sessions.map(session => 
      this.apiCall('GET', '/api/pitches', {}, session)
    );
    
    const results = await Promise.all(concurrentCalls);
    assertEquals(results.length, 3, 'All concurrent calls should succeed');
    console.log('    ✓ Concurrent API calls handled successfully');

    // Step 2: Test concurrent file uploads
    console.log('    Testing concurrent file uploads...');
    const creatorSession = this.context.sessions.get('creator')!;
    const mockFiles = [
      this.createMockDocument('doc1.pdf'),
      this.createMockDocument('doc2.pdf'),
      this.createMockDocument('doc3.pdf')
    ];
    
    const uploadPromises = (await Promise.all(mockFiles)).map(file =>
      this.uploadFile(`/api/pitches/${this.context.pitchId}/documents`, 
        file, 'concurrent_test', creatorSession)
    );
    
    const uploadResults = await Promise.all(uploadPromises);
    assertEquals(uploadResults.length, 3, 'All concurrent uploads should succeed');
    console.log('    ✓ Concurrent file uploads handled successfully');
  }

  // High Load Video Processing
  private async validateHighLoadProcessing(): Promise<void> {
    console.log('  Testing high load video processing...');
    
    const creatorSession = this.context.sessions.get('creator')!;
    
    // Step 1: Queue multiple video processing jobs
    console.log('    Queueing multiple video processing jobs...');
    const videoJobs = [];
    
    for (let i = 0; i < 3; i++) {
      const mockVideo = await this.createMockVideo(`test-video-${i}.mp4`);
      const uploadResponse = await this.uploadFile(
        `/api/pitches/${this.context.pitchId}/media`,
        mockVideo,
        `load_test_video_${i}`,
        creatorSession
      );
      videoJobs.push(uploadResponse.data.id);
    }
    
    console.log(`    ✓ Queued ${videoJobs.length} video processing jobs`);

    // Step 2: Monitor processing completion
    console.log('    Monitoring batch processing...');
    let completedJobs = 0;
    const maxWait = 180; // 3 minutes max
    let waited = 0;
    
    while (completedJobs < videoJobs.length && waited < maxWait) {
      await delay(5000); // Check every 5 seconds
      waited += 5;
      
      for (const jobId of videoJobs) {
        const statusResponse = await this.apiCall('GET', 
          `/api/media/${jobId}/status`, {}, creatorSession);
        
        if (statusResponse.data.status === 'completed') {
          completedJobs++;
        }
      }
      
      console.log(`    Progress: ${completedJobs}/${videoJobs.length} jobs completed`);
    }
    
    assert(completedJobs === videoJobs.length, 'All video processing jobs should complete');
    console.log('    ✓ High load video processing validated');
  }

  // WebSocket Connection Management
  private async validateWebSocketManagement(): Promise<void> {
    console.log('  Testing WebSocket connection management...');
    
    // Step 1: Test multiple concurrent connections
    console.log('    Testing multiple concurrent WebSocket connections...');
    const connections = await Promise.all([
      this.connectWebSocket('creator'),
      this.connectWebSocket('investor'),
      this.connectWebSocket('production')
    ]);
    
    assertEquals(connections.length, 3, 'All WebSocket connections should establish');
    console.log('    ✓ Multiple concurrent connections established');

    // Step 2: Test connection recovery
    console.log('    Testing connection recovery...');
    const testConnection = connections[0];
    
    let reconnected = false;
    testConnection.onopen = () => {
      if (reconnected) {
        console.log('    ✓ Connection recovery successful');
      }
    };
    
    // Simulate connection drop and recovery
    testConnection.close();
    await delay(1000);
    
    const newConnection = await this.connectWebSocket('creator');
    assert(newConnection.readyState === WebSocket.OPEN, 'New connection should be established');
    connections.push(newConnection);
    console.log('    ✓ Connection recovery validated');

    // Step 3: Test message broadcasting
    console.log('    Testing message broadcasting...');
    let messagesReceived = 0;
    
    connections.forEach(ws => {
      ws.onmessage = () => {
        messagesReceived++;
      };
    });
    
    // Send a broadcast message (simulate by triggering a notification)
    await this.apiCall('POST', `/api/notifications/broadcast`, {
      type: 'system_announcement',
      message: 'WebSocket test broadcast',
      recipients: 'all'
    }, this.context.sessions.get('creator')!);
    
    await delay(2000);
    assert(messagesReceived > 0, 'Broadcast messages should be received');
    console.log(`    ✓ Message broadcasting validated (${messagesReceived} messages received)`);

    // Cleanup
    connections.forEach(ws => ws.close());
  }

  // Utility Methods
  private async apiCall(method: string, endpoint: string, data: any, session: string): Promise<any> {
    const url = `${CONFIG.API_BASE}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': session
      }
    };
    
    if (method !== 'GET' && data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  private async uploadFile(endpoint: string, file: Uint8Array, filename: string, session: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', new Blob([file]), filename);
    
    const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Cookie': session
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`File upload failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  private async createMockDocument(filename: string): Promise<Uint8Array> {
    // Create a simple mock PDF-like document
    const content = `Mock PDF Document: ${filename}\nGenerated for testing purposes\nTimestamp: ${new Date().toISOString()}`;
    return new TextEncoder().encode(content);
  }

  private async createMockVideo(filename: string): Promise<Uint8Array> {
    // Create a mock video file (very simple binary data)
    const size = 1024 * 1024; // 1MB
    const mockVideo = new Uint8Array(size);
    
    // Add some pattern to make it look like video data
    for (let i = 0; i < size; i++) {
      mockVideo[i] = (i % 256);
    }
    
    return mockVideo;
  }

  private async connectWebSocket(userRole: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const session = this.context.sessions.get(userRole);
      if (!session) {
        reject(new Error(`No session for ${userRole}`));
        return;
      }
      
      const ws = new WebSocket(`${CONFIG.WS_BASE}/ws`);
      
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        resolve(ws);
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${error}`));
      };
    });
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('\n🎯 Workflow Validation Summary');
    console.log('=====================================');
    console.log(`📊 Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   • ${r.name}: ${r.error}`));
    }
    
    // Production readiness assessment
    const successRate = (passed / total) * 100;
    let readinessLevel = '';
    
    if (successRate >= 95) {
      readinessLevel = '🎉 PRODUCTION READY';
    } else if (successRate >= 85) {
      readinessLevel = '✅ MOSTLY READY - Minor fixes needed';
    } else if (successRate >= 70) {
      readinessLevel = '⚠️  NEEDS ATTENTION - Significant issues detected';
    } else {
      readinessLevel = '❌ NOT READY - Critical issues must be resolved';
    }
    
    console.log(`\n🎯 Production Readiness: ${readinessLevel}`);
    console.log('=====================================\n');
  }
}

// Export for use in other test files
export { WorkflowValidator, type TestResult };

// Run if called directly
if (import.meta.main) {
  const validator = new WorkflowValidator();
  const results = await validator.runAllValidations();
  
  // Exit with error code if tests failed
  const failed = results.filter(r => r.status === 'FAIL').length;
  Deno.exit(failed > 0 ? 1 : 0);
}