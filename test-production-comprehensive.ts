// Comprehensive Production Testing Suite
// Tests the live production site for WebSocket issues, infinite loops, and functionality

interface TestResult {
  name: string;
  success: boolean;
  details: string;
  timing: number;
  errors?: string[];
}

interface ProductionTestSuite {
  siteUrl: string;
  apiUrl: string;
  wsUrl: string;
  results: TestResult[];
  overallStatus: 'PASS' | 'FAIL' | 'PARTIAL';
  totalErrors: number;
  criticalIssues: string[];
}

class ProductionTester {
  private results: TestResult[] = [];
  private errors: string[] = [];
  private criticalIssues: string[] = [];

  private log(message: string, level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL' = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = {
      'INFO': '📋',
      'SUCCESS': '✅', 
      'WARNING': '⚠️',
      'ERROR': '❌',
      'CRITICAL': '🚨'
    }[level];
    
    console.log(`${emoji} [${timestamp.slice(11, 19)}] ${message}`);
    
    if (level === 'ERROR' || level === 'CRITICAL') {
      this.errors.push(message);
      if (level === 'CRITICAL') {
        this.criticalIssues.push(message);
      }
    }
  }

  private async timeTest<T>(testName: string, fn: () => Promise<T>): Promise<TestResult> {
    const startTime = Date.now();
    this.log(`Starting: ${testName}`, 'INFO');
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        name: testName,
        success: true,
        details: `Completed successfully`,
        timing: duration
      };
      
      this.results.push(testResult);
      this.log(`✅ ${testName} completed in ${duration}ms`, 'SUCCESS');
      return testResult;
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        name: testName,
        success: false,
        details: error.message || 'Unknown error',
        timing: duration,
        errors: [error.toString()]
      };
      
      this.results.push(testResult);
      this.log(`❌ ${testName} failed: ${error.message}`, 'ERROR');
      return testResult;
    }
  }

  // Test 1: Backend Health and Connectivity
  private async testBackendHealth(): Promise<any> {
    const response = await fetch('https://pitchey-backend-fresh.deno.dev/api/health');
    
    if (!response.ok) {
      throw new Error(`Backend health check failed: HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    this.log(`Backend version: ${data.data.version}`, 'INFO');
    this.log(`Coverage: ${data.data.coverage}`, 'INFO');
    this.log(`Deployed at: ${data.data.deployedAt}`, 'INFO');
    
    // Check if deployment is recent (within last hour)
    const deployTime = new Date(data.data.deployedAt).getTime();
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    if (deployTime > hourAgo) {
      this.log(`✅ Recent deployment detected (${Math.floor((now - deployTime) / (60 * 1000))} minutes ago)`, 'SUCCESS');
    }
    
    return data;
  }

  // Test 2: Authentication System
  private async testAuthentication(): Promise<string> {
    const authResponse = await fetch('https://pitchey-backend-fresh.deno.dev/api/auth/creator/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.creator@demo.com',
        password: 'Demo123'
      })
    });
    
    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      throw new Error(`Authentication failed: ${authResponse.status} - ${errorText}`);
    }
    
    const authData = await authResponse.json();
    const token = authData.token;
    
    // Verify token structure
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    
    if (!decodedPayload.userId) {
      throw new Error('JWT token missing userId field');
    }
    
    if (!decodedPayload.exp) {
      throw new Error('JWT token missing expiration');
    }
    
    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp < now) {
      throw new Error('JWT token is expired');
    }
    
    this.log(`Authenticated as user ${decodedPayload.userId}`, 'SUCCESS');
    this.log(`Token expires in ${Math.floor((decodedPayload.exp - now) / 3600)} hours`, 'INFO');
    
    return token;
  }

  // Test 3: WebSocket Connection (The Critical Test)
  private async testWebSocketConnection(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://pitchey-backend-fresh.deno.dev/ws?token=${token}`;
      let messagesReceived = 0;
      let connectionEstablished = false;
      
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        if (!connectionEstablished) {
          ws.close();
          reject(new Error('WebSocket connection timeout after 10 seconds'));
        }
      }, 10000);
      
      ws.onopen = () => {
        connectionEstablished = true;
        clearTimeout(timeout);
        this.log('🎉 WebSocket connection established', 'SUCCESS');
        
        // Send test ping
        ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
        
        // Close connection after receiving responses
        setTimeout(() => {
          ws.close(1000, 'Test completed');
        }, 2000);
      };
      
      ws.onmessage = (event) => {
        messagesReceived++;
        this.log(`📨 WebSocket message ${messagesReceived}: ${event.data.substring(0, 100)}${event.data.length > 100 ? '...' : ''}`, 'INFO');
        
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'connected') {
            this.log(`✅ Connection acknowledged with session ${message.payload.sessionId}`, 'SUCCESS');
          }
          if (message.type === 'pong') {
            this.log(`✅ Ping-pong successful`, 'SUCCESS');
          }
        } catch (e) {
          this.log(`⚠️ Non-JSON message received`, 'WARNING');
        }
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        
        const result = {
          connected: connectionEstablished,
          messagesReceived,
          closeCode: event.code,
          closeReason: event.reason,
          wasClean: event.wasClean
        };
        
        this.log(`🔒 WebSocket closed: Code ${event.code}, Clean: ${event.wasClean}`, 
          event.wasClean ? 'SUCCESS' : 'WARNING');
        
        if (connectionEstablished && messagesReceived > 0) {
          resolve(result);
        } else if (!connectionEstablished) {
          reject(new Error(`WebSocket failed to connect: Code ${event.code}, Reason: ${event.reason}`));
        } else {
          reject(new Error('WebSocket connected but no messages received'));
        }
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        this.log(`❌ WebSocket error occurred`, 'ERROR');
        
        if (error instanceof ErrorEvent) {
          reject(new Error(`WebSocket error: ${error.message}`));
        } else {
          reject(new Error('WebSocket connection failed'));
        }
      };
    });
  }

  // Test 4: Multiple Connection Stress Test (Check for infinite loops)
  private async testMultipleConnections(token: string): Promise<any> {
    this.log('🔄 Testing multiple WebSocket connections (infinite loop detection)', 'INFO');
    
    const connections: WebSocket[] = [];
    const results: any[] = [];
    let errorCount = 0;
    
    // Create 5 connections rapidly
    for (let i = 1; i <= 5; i++) {
      const ws = new WebSocket(`wss://pitchey-backend-fresh.deno.dev/ws?token=${token}`);
      connections.push(ws);
      
      const connectionResult = {
        id: i,
        opened: false,
        closed: false,
        errors: 0,
        messages: 0
      };
      
      ws.onopen = () => {
        connectionResult.opened = true;
        this.log(`Connection ${i}: Opened`, 'INFO');
      };
      
      ws.onmessage = () => {
        connectionResult.messages++;
      };
      
      ws.onclose = (event) => {
        connectionResult.closed = true;
        this.log(`Connection ${i}: Closed (${event.code})`, 'INFO');
      };
      
      ws.onerror = () => {
        connectionResult.errors++;
        errorCount++;
      };
      
      results.push(connectionResult);
      
      // Small delay between connections
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Wait for connections to settle
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Close all connections
    connections.forEach((ws, index) => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    });
    
    // Wait for all to close
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const summary = {
      totalConnections: connections.length,
      totalErrors: errorCount,
      results
    };
    
    if (errorCount > connections.length) {
      throw new Error(`Possible infinite loop detected: ${errorCount} errors for ${connections.length} connections`);
    }
    
    this.log(`✅ Multiple connection test passed: ${errorCount} errors total`, 'SUCCESS');
    return summary;
  }

  // Test 5: API Endpoints Sampling
  private async testAPIEndpoints(token: string): Promise<any> {
    const endpoints = [
      { url: '/api/users/profile', method: 'GET', requiresAuth: true },
      { url: '/api/pitches', method: 'GET', requiresAuth: false },
      { url: '/api/ws/health', method: 'GET', requiresAuth: false },
    ];
    
    const results: any[] = [];
    
    for (const endpoint of endpoints) {
      try {
        const headers: any = { 'Content-Type': 'application/json' };
        if (endpoint.requiresAuth) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`https://pitchey-backend-fresh.deno.dev${endpoint.url}`, {
          method: endpoint.method,
          headers
        });
        
        results.push({
          endpoint: endpoint.url,
          status: response.status,
          success: response.ok
        });
        
        this.log(`API ${endpoint.url}: HTTP ${response.status}`, response.ok ? 'SUCCESS' : 'WARNING');
        
      } catch (error) {
        results.push({
          endpoint: endpoint.url,
          status: 0,
          success: false,
          error: error.message
        });
        
        this.log(`API ${endpoint.url}: Failed - ${error.message}`, 'ERROR');
      }
    }
    
    return results;
  }

  // Test 6: Frontend Static Assets
  private async testFrontendAssets(): Promise<any> {
    const response = await fetch('https://pitchey-5o8.pages.dev/');
    
    if (!response.ok) {
      throw new Error(`Frontend not accessible: HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Basic checks
    const checks = {
      hasTitle: html.includes('<title>'),
      hasScript: html.includes('<script'),
      hasCSS: html.includes('stylesheet'),
      hasReactApp: html.includes('react') || html.includes('React'),
      hasAPI_URL: html.includes('pitchey-backend-fresh.deno.dev'),
      size: html.length
    };
    
    this.log(`Frontend HTML size: ${checks.size} bytes`, 'INFO');
    
    if (checks.size < 1000) {
      throw new Error('Frontend HTML too small - possible deployment issue');
    }
    
    return checks;
  }

  // Main test runner
  async runComprehensiveTest(): Promise<ProductionTestSuite> {
    this.log('🚀 STARTING COMPREHENSIVE PRODUCTION TEST SUITE', 'INFO');
    this.log('🎯 Testing: https://pitchey-5o8.pages.dev/', 'INFO');
    
    let token: string = '';
    
    // Run all tests
    await this.timeTest('Backend Health Check', () => this.testBackendHealth());
    
    const authResult = await this.timeTest('Authentication System', async () => {
      token = await this.testAuthentication();
      return token;
    });
    
    if (authResult.success && token) {
      await this.timeTest('WebSocket Connection', () => this.testWebSocketConnection(token));
      await this.timeTest('Multiple Connection Stress Test', () => this.testMultipleConnections(token));
      await this.timeTest('API Endpoints', () => this.testAPIEndpoints(token));
    }
    
    await this.timeTest('Frontend Assets', () => this.testFrontendAssets());
    
    // Generate summary
    const suite: ProductionTestSuite = {
      siteUrl: 'https://pitchey-5o8.pages.dev/',
      apiUrl: 'https://pitchey-backend-fresh.deno.dev/',
      wsUrl: 'wss://pitchey-backend-fresh.deno.dev/ws',
      results: this.results,
      overallStatus: this.criticalIssues.length > 0 ? 'FAIL' : 
                    this.errors.length > 0 ? 'PARTIAL' : 'PASS',
      totalErrors: this.errors.length,
      criticalIssues: this.criticalIssues
    };
    
    this.printSummary(suite);
    return suite;
  }

  private printSummary(suite: ProductionTestSuite) {
    console.log('\n🔍 COMPREHENSIVE PRODUCTION TEST SUMMARY');
    console.log('═════════════════════════════════════════');
    console.log(`🌐 Site: ${suite.siteUrl}`);
    console.log(`🔗 API: ${suite.apiUrl}`);
    console.log(`🔌 WebSocket: ${suite.wsUrl}`);
    console.log(`📊 Overall Status: ${suite.overallStatus}`);
    console.log(`❌ Total Errors: ${suite.totalErrors}`);
    console.log(`🚨 Critical Issues: ${suite.criticalIssues.length}`);
    
    console.log('\n📋 TEST RESULTS:');
    suite.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.details} (${result.timing}ms)`);
      
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          console.log(`   └─ Error: ${error}`);
        });
      }
    });
    
    if (suite.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      suite.criticalIssues.forEach(issue => {
        console.log(`   🔴 ${issue}`);
      });
    }
    
    console.log('\n📈 PERFORMANCE METRICS:');
    const totalTime = suite.results.reduce((sum, r) => sum + r.timing, 0);
    const successRate = (suite.results.filter(r => r.success).length / suite.results.length) * 100;
    console.log(`   ⏱️ Total test time: ${totalTime}ms`);
    console.log(`   📊 Success rate: ${successRate.toFixed(1)}%`);
    
    console.log('\n═════════════════════════════════════════');
    
    if (suite.overallStatus === 'PASS') {
      console.log('✅ ALL TESTS PASSED - Production site is working correctly!');
    } else if (suite.overallStatus === 'PARTIAL') {
      console.log('⚠️ SOME ISSUES FOUND - Production site has minor problems');
    } else {
      console.log('❌ CRITICAL FAILURES - Production site has major issues');
    }
  }
}

// Run the comprehensive test
async function main() {
  try {
    const tester = new ProductionTester();
    await tester.runComprehensiveTest();
  } catch (error) {
    console.error('🚨 Test suite failed to complete:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}