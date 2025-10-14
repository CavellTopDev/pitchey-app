// Automated WebSocket Analysis for Production Issue
// This script systematically tests the WebSocket connection to identify the infinite loop root cause

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
  duration: number;
}

interface AnalysisReport {
  timestamp: string;
  totalDuration: number;
  errorCount: number;
  connectionAttempts: number;
  results: TestResult[];
  rootCauseAnalysis: string;
  recommendations: string[];
}

class WebSocketAnalyzer {
  private results: TestResult[] = [];
  private startTime: number = Date.now();
  private errorCount: number = 0;
  private connectionAttempts: number = 0;
  private authToken: string | null = null;

  private log(message: string, level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = {
      'INFO': '📋',
      'SUCCESS': '✅', 
      'WARNING': '⚠️',
      'ERROR': '❌'
    }[level];
    
    console.log(`${emoji} [${timestamp.slice(11, 19)}] ${message}`);
    
    if (level === 'ERROR') {
      this.errorCount++;
    }
  }

  private async timeStep<T>(stepName: string, fn: () => Promise<T>): Promise<TestResult> {
    const stepStart = Date.now();
    this.log(`Starting: ${stepName}`, 'INFO');
    
    try {
      const result = await fn();
      const duration = Date.now() - stepStart;
      
      const testResult: TestResult = {
        step: stepName,
        success: true,
        message: `Completed successfully`,
        details: result,
        duration
      };
      
      this.results.push(testResult);
      this.log(`✅ ${stepName} completed in ${duration}ms`, 'SUCCESS');
      return testResult;
      
    } catch (error: any) {
      const duration = Date.now() - stepStart;
      
      const testResult: TestResult = {
        step: stepName,
        success: false,
        message: error.message || 'Unknown error',
        details: { error: error.toString() },
        duration
      };
      
      this.results.push(testResult);
      this.log(`❌ ${stepName} failed: ${error.message}`, 'ERROR');
      return testResult;
    }
  }

  // Step 1: Backend Health Check
  private async checkBackendHealth(): Promise<any> {
    const response = await fetch('https://pitchey-backend-fresh.deno.dev/api/health');
    
    if (!response.ok) {
      throw new Error(`Backend health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    this.log(`Backend status: ${data.data.status} (${data.data.version})`, 'SUCCESS');
    this.log(`Coverage: ${data.data.coverage}`, 'INFO');
    this.log(`Redis: ${data.data.redis.status}`, data.data.redis.enabled ? 'SUCCESS' : 'WARNING');
    
    return data;
  }

  // Step 2: Authentication
  private async authenticateUser(): Promise<any> {
    const response = await fetch('https://pitchey-backend-fresh.deno.dev/api/auth/creator/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.creator@demo.com',
        password: 'Demo123'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
    }
    
    const authData = await response.json();
    this.authToken = authData.token;
    
    this.log(`Authenticated as: ${authData.user.firstName} ${authData.user.lastName}`, 'SUCCESS');
    this.log(`Token: ${authData.token.substring(0, 30)}...`, 'INFO');
    
    return authData;
  }

  // Step 3: WebSocket Connection Test
  private async testWebSocketConnection(): Promise<any> {
    if (!this.authToken) {
      throw new Error('No auth token available for WebSocket test');
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `wss://pitchey-backend-fresh.deno.dev/ws?token=${this.authToken}`;
      const ws = new WebSocket(wsUrl);
      this.connectionAttempts++;
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout after 10 seconds'));
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        this.log('WebSocket connected successfully', 'SUCCESS');
        
        // Send test message
        ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
        
        resolve({ status: 'connected', message: 'WebSocket connection successful' });
      };
      
      ws.onmessage = (event) => {
        this.log(`Received message: ${event.data}`, 'SUCCESS');
      };
      
      ws.onclose = (event) => {
        clearTimeout(timeout);
        this.log(`WebSocket closed: ${event.code} - ${event.reason || 'No reason'}`, 
          event.code === 1000 ? 'INFO' : 'WARNING');
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${error}`));
      };
    });
  }

  // Step 4: Invalid Token Test (should recreate the issue)
  private async testInvalidTokenBehavior(): Promise<any> {
    this.log('Testing with invalid token to recreate issue...', 'WARNING');
    
    const results: any[] = [];
    
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => {
        const ws = new WebSocket('wss://pitchey-backend-fresh.deno.dev/ws?token=invalid_token_test');
        this.connectionAttempts++;
        
        const connectionResult = {
          attempt: i,
          connected: false,
          errorCode: null,
          errorReason: '',
          duration: Date.now()
        };
        
        const timeout = setTimeout(() => {
          ws.close();
          connectionResult.errorReason = 'Timeout';
          results.push(connectionResult);
          resolve(null);
        }, 3000);
        
        ws.onopen = () => {
          clearTimeout(timeout);
          connectionResult.connected = true;
          this.log(`⚠️ Attempt ${i}: Connected with invalid token!`, 'WARNING');
          ws.close();
          results.push(connectionResult);
          resolve(null);
        };
        
        ws.onclose = (event) => {
          clearTimeout(timeout);
          connectionResult.errorCode = event.code;
          connectionResult.errorReason = event.reason || 'Connection closed';
          connectionResult.duration = Date.now() - connectionResult.duration;
          results.push(connectionResult);
          resolve(null);
        };
        
        ws.onerror = () => {
          clearTimeout(timeout);
          connectionResult.errorReason = 'Connection error';
          results.push(connectionResult);
          resolve(null);
        };
      });
      
      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { attempts: results, summary: `${results.length} attempts completed` };
  }

  // Step 5: Rapid Connection Test (recreate potential infinite loop)
  private async testRapidConnections(): Promise<any> {
    this.log('Testing rapid connections (potential infinite loop scenario)...', 'WARNING');
    
    const connections: WebSocket[] = [];
    const results: any[] = [];
    
    // Create multiple connections rapidly (like a frontend bug might do)
    for (let i = 1; i <= 10; i++) {
      const ws = new WebSocket('wss://pitchey-backend-fresh.deno.dev/ws?token=rapid_test');
      connections.push(ws);
      this.connectionAttempts++;
      
      results.push({
        connectionId: i,
        created: Date.now(),
        status: 'created'
      });
    }
    
    // Wait 2 seconds then close all
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    connections.forEach((ws, index) => {
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.close();
        results[index].status = 'closed';
      }
    });
    
    return { totalConnections: connections.length, results };
  }

  // Main analysis runner
  async runFullAnalysis(): Promise<AnalysisReport> {
    this.log('🚀 STARTING COMPREHENSIVE WEBSOCKET ANALYSIS', 'INFO');
    this.log('🎯 Target: Identify production infinite loop root cause', 'INFO');
    
    // Run all test steps
    await this.timeStep('Backend Health Check', () => this.checkBackendHealth());
    await this.timeStep('User Authentication', () => this.authenticateUser());
    await this.timeStep('Valid WebSocket Connection', () => this.testWebSocketConnection());
    await this.timeStep('Invalid Token Behavior', () => this.testInvalidTokenBehavior());
    await this.timeStep('Rapid Connection Test', () => this.testRapidConnections());
    
    // Generate analysis report
    const report: AnalysisReport = {
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - this.startTime,
      errorCount: this.errorCount,
      connectionAttempts: this.connectionAttempts,
      results: this.results,
      rootCauseAnalysis: this.generateRootCauseAnalysis(),
      recommendations: this.generateRecommendations()
    };
    
    this.log('✅ ANALYSIS COMPLETE', 'SUCCESS');
    this.printReport(report);
    
    return report;
  }

  private generateRootCauseAnalysis(): string {
    const failedSteps = this.results.filter(r => !r.success);
    const successfulConnections = this.results.filter(r => 
      r.step === 'Valid WebSocket Connection' && r.success
    ).length;
    
    if (failedSteps.length === 0 && successfulConnections > 0) {
      return "Backend WebSocket is functioning correctly. Issue likely in frontend implementation - possibly missing/invalid auth tokens, rapid reconnection attempts, or client-side infinite retry logic.";
    }
    
    if (failedSteps.some(r => r.step === 'Backend Health Check')) {
      return "Backend is not healthy - this is the primary issue causing WebSocket failures.";
    }
    
    if (failedSteps.some(r => r.step === 'User Authentication')) {
      return "Authentication system is failing - WebSocket connections cannot be established without valid tokens.";
    }
    
    return "Mixed results - further investigation needed to determine exact root cause.";
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    const hasValidConnection = this.results.some(r => 
      r.step === 'Valid WebSocket Connection' && r.success
    );
    
    if (hasValidConnection) {
      recommendations.push("✅ Backend WebSocket is working - focus on frontend token handling");
      recommendations.push("🔍 Check frontend auth token availability during WebSocket connection attempts");
      recommendations.push("🛡️ Implement circuit breaker pattern in frontend to prevent infinite retries");
      recommendations.push("⏱️ Add exponential backoff with maximum retry limits");
      recommendations.push("🔄 Ensure WebSocket connection is only attempted after successful authentication");
    } else {
      recommendations.push("❌ Backend WebSocket has issues - investigate server configuration");
      recommendations.push("🔧 Check Deno Deploy WebSocket upgrade handling");
      recommendations.push("🔑 Verify JWT token validation in WebSocket endpoint");
    }
    
    recommendations.push("📊 Monitor connection attempt frequency in production");
    recommendations.push("🔇 Add console.warn for repeated connection failures");
    
    return recommendations;
  }

  private printReport(report: AnalysisReport) {
    console.log('\n🔴 WEBSOCKET ANALYSIS REPORT');
    console.log('═══════════════════════════════════════');
    console.log(`📅 Timestamp: ${report.timestamp}`);
    console.log(`⏱️ Total Duration: ${report.totalDuration}ms`);
    console.log(`❌ Error Count: ${report.errorCount}`);
    console.log(`🔌 Connection Attempts: ${report.connectionAttempts}`);
    console.log('\n📋 STEP RESULTS:');
    
    report.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.step}: ${result.message} (${result.duration}ms)`);
    });
    
    console.log('\n🔍 ROOT CAUSE ANALYSIS:');
    console.log(report.rootCauseAnalysis);
    
    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach(rec => console.log(`   ${rec}`));
    
    console.log('\n═══════════════════════════════════════');
  }
}

// Run the analysis
async function main() {
  try {
    const analyzer = new WebSocketAnalyzer();
    await analyzer.runFullAnalysis();
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

if (import.meta.main) {
  main();
}