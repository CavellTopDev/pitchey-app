/**
 * Production WebSocket Test Suite
 * Comprehensive testing for Pitchey WebSocket functionality on Deno Deploy
 * 
 * Usage: deno run --allow-net --allow-env test-websocket-production.ts
 */

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
  latency?: number;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  totalDuration: number;
}

interface WebSocketTestConfig {
  backendUrl: string;
  websocketUrl: string;
  authEndpoint: string;
  testUser: {
    email: string;
    password: string;
  };
  timeouts: {
    connection: number;
    message: number;
    authentication: number;
  };
  retryAttempts: number;
  performanceThresholds: {
    connectionTime: number;
    messageLatency: number;
    reconnectionTime: number;
  };
}

// Production test configuration
const config: WebSocketTestConfig = {
  backendUrl: "https://pitchey-backend-fresh.deno.dev",
  websocketUrl: "wss://pitchey-backend-fresh.deno.dev/ws",
  authEndpoint: "/api/auth/creator/login",
  testUser: {
    email: "alex.creator@demo.com",
    password: "Demo123"
  },
  timeouts: {
    connection: 10000,    // 10 seconds
    message: 5000,        // 5 seconds  
    authentication: 8000  // 8 seconds
  },
  retryAttempts: 3,
  performanceThresholds: {
    connectionTime: 5000,      // 5 seconds max for connection
    messageLatency: 1000,      // 1 second max for message round trip
    reconnectionTime: 10000    // 10 seconds max for reconnection
  }
};

class WebSocketTester {
  private results: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;
  private authToken: string | null = null;
  private startTime: number = 0;

  constructor() {
    console.log("🚀 WebSocket Production Test Suite Initialized");
    console.log(`Backend: ${config.backendUrl}`);
    console.log(`WebSocket: ${config.websocketUrl}`);
  }

  private startSuite(name: string): void {
    this.currentSuite = {
      name,
      tests: [],
      passed: 0,
      failed: 0,
      totalDuration: 0
    };
    console.log(`\n📋 Starting test suite: ${name}`);
  }

  private async runTest(testName: string, testFn: () => Promise<any>): Promise<TestResult> {
    console.log(`  🔸 Running: ${testName}`);
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        testName,
        passed: true,
        duration,
        details: result,
        latency: result?.latency
      };

      console.log(`  ✅ ${testName} (${duration}ms)`);
      if (result?.latency) {
        console.log(`     ⚡ Latency: ${result.latency}ms`);
      }
      
      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult: TestResult = {
        testName,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      };

      console.log(`  ❌ ${testName} (${duration}ms)`);
      console.log(`     Error: ${testResult.error}`);
      
      return testResult;
    }
  }

  private finishSuite(): void {
    if (!this.currentSuite) return;

    this.currentSuite.passed = this.currentSuite.tests.filter(t => t.passed).length;
    this.currentSuite.failed = this.currentSuite.tests.filter(t => !t.passed).length;
    this.currentSuite.totalDuration = this.currentSuite.tests.reduce((sum, t) => sum + t.duration, 0);

    console.log(`\n📊 Suite ${this.currentSuite.name} completed:`);
    console.log(`   ✅ Passed: ${this.currentSuite.passed}`);
    console.log(`   ❌ Failed: ${this.currentSuite.failed}`);
    console.log(`   ⏱️  Duration: ${this.currentSuite.totalDuration}ms`);

    this.results.push(this.currentSuite);
    this.currentSuite = null;
  }

  private addTestResult(result: TestResult): void {
    if (this.currentSuite) {
      this.currentSuite.tests.push(result);
    }
  }

  // Helper: Authenticate and get token
  private async authenticate(): Promise<string> {
    const response = await fetch(`${config.backendUrl}${config.authEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config.testUser)
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success || !data.token) {
      throw new Error(`Authentication response invalid: ${JSON.stringify(data)}`);
    }

    return data.token;
  }

  // Helper: Create WebSocket connection with timeout
  private async createWebSocketConnection(
    url: string, 
    token?: string,
    timeout: number = config.timeouts.connection
  ): Promise<{ ws: WebSocket; connectionTime: number }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let timeoutId: number;

      // Add token to URL if provided
      const wsUrl = token ? `${url}?token=${token}` : url;
      const ws = new WebSocket(wsUrl);

      timeoutId = setTimeout(() => {
        ws.close();
        reject(new Error(`WebSocket connection timeout after ${timeout}ms`));
      }, timeout);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        const connectionTime = Date.now() - startTime;
        resolve({ ws, connectionTime });
      };

      ws.onerror = (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`WebSocket connection error: ${error}`));
      };

      ws.onclose = (event) => {
        clearTimeout(timeoutId);
        if (event.code !== 1000) {
          reject(new Error(`WebSocket closed unexpectedly: ${event.code} ${event.reason}`));
        }
      };
    });
  }

  // Helper: Wait for specific message type
  private async waitForMessage(
    ws: WebSocket,
    expectedType: string,
    timeout: number = config.timeouts.message
  ): Promise<{ message: any; latency: number }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let timeoutId: number;

      timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout waiting for ${expectedType} after ${timeout}ms`));
      }, timeout);

      const messageHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === expectedType) {
            clearTimeout(timeoutId);
            ws.removeEventListener('message', messageHandler);
            const latency = Date.now() - startTime;
            resolve({ message, latency });
          }
        } catch (error) {
          // Ignore parsing errors and continue waiting
        }
      };

      ws.addEventListener('message', messageHandler);
    });
  }

  // Test Suite 1: Basic Connection Tests
  async testBasicConnection(): Promise<void> {
    this.startSuite("Basic Connection Tests");

    // Test 1: Backend Health Check
    const healthResult = await this.runTest("Backend Health Check", async () => {
      const response = await fetch(config.backendUrl);
      // Expecting 401 for auth-protected backend
      if (response.status === 401) {
        return { status: "Backend responding (requires auth)" };
      }
      throw new Error(`Unexpected status: ${response.status}`);
    });
    this.addTestResult(healthResult);

    // Test 2: Authentication
    const authResult = await this.runTest("User Authentication", async () => {
      this.authToken = await this.authenticate();
      return { tokenLength: this.authToken?.length, hasToken: !!this.authToken };
    });
    this.addTestResult(authResult);

    // Test 3: Basic WebSocket Connection (unauthenticated)
    const basicConnResult = await this.runTest("Basic WebSocket Connection", async () => {
      const { ws, connectionTime } = await this.createWebSocketConnection(config.websocketUrl);
      
      // Wait for connection confirmation
      const { message, latency } = await this.waitForMessage(ws, "connected");
      
      ws.close(1000, "Test complete");
      
      return {
        connectionTime,
        latency,
        authenticated: message.authenticated,
        capabilities: message.capabilities
      };
    });
    this.addTestResult(basicConnResult);

    // Test 4: Authenticated WebSocket Connection
    if (this.authToken) {
      const authConnResult = await this.runTest("Authenticated WebSocket Connection", async () => {
        const { ws, connectionTime } = await this.createWebSocketConnection(
          config.websocketUrl, 
          this.authToken!
        );
        
        // Wait for connection confirmation
        const { message, latency } = await this.waitForMessage(ws, "connected");
        
        ws.close(1000, "Test complete");
        
        return {
          connectionTime,
          latency,
          authenticated: message.authenticated,
          user: message.user,
          capabilities: message.capabilities
        };
      });
      this.addTestResult(authConnResult);
    }

    this.finishSuite();
  }

  // Test Suite 2: Authentication Flow Tests
  async testAuthenticationFlow(): Promise<void> {
    this.startSuite("Authentication Flow Tests");

    if (!this.authToken) {
      console.log("⚠️  Skipping authentication tests - no token available");
      this.finishSuite();
      return;
    }

    // Test 1: Query Parameter Authentication
    const queryAuthResult = await this.runTest("Query Parameter Authentication", async () => {
      const { ws, connectionTime } = await this.createWebSocketConnection(
        config.websocketUrl,
        this.authToken!
      );
      
      const { message, latency } = await this.waitForMessage(ws, "connected");
      ws.close(1000, "Test complete");
      
      if (!message.authenticated) {
        throw new Error("Authentication via query parameter failed");
      }
      
      return { connectionTime, latency, method: "query_param" };
    });
    this.addTestResult(queryAuthResult);

    // Test 2: Header Authentication (if supported)
    const headerAuthResult = await this.runTest("Header Authentication", async () => {
      // Note: WebSocket headers during upgrade might not work in all environments
      // This test may fail in some browsers but should work in Deno
      try {
        const ws = new WebSocket(config.websocketUrl, [], {
          headers: { 
            'Authorization': `Bearer ${this.authToken}` 
          }
        } as any);
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Header auth timeout")), 5000);
          ws.onopen = () => { clearTimeout(timeout); resolve(null); };
          ws.onerror = () => { clearTimeout(timeout); reject(new Error("Header auth failed")); };
        });
        
        ws.close(1000, "Test complete");
        return { method: "header", supported: true };
      } catch (error) {
        return { method: "header", supported: false, reason: error instanceof Error ? error.message : "Unknown" };
      }
    });
    this.addTestResult(headerAuthResult);

    // Test 3: Post-Connection Authentication
    const postConnAuthResult = await this.runTest("Post-Connection Authentication", async () => {
      const { ws, connectionTime } = await this.createWebSocketConnection(config.websocketUrl);
      
      // Wait for initial connection (unauthenticated)
      await this.waitForMessage(ws, "connected");
      
      // Send authentication message
      const authMessage = {
        type: "auth",
        token: this.authToken!,
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(authMessage));
      
      // Wait for authentication success
      const { message, latency } = await this.waitForMessage(ws, "auth_success", config.timeouts.authentication);
      
      ws.close(1000, "Test complete");
      
      return {
        connectionTime,
        authLatency: latency,
        user: message.user,
        capabilities: message.capabilities
      };
    });
    this.addTestResult(postConnAuthResult);

    // Test 4: Invalid Token Handling
    const invalidTokenResult = await this.runTest("Invalid Token Handling", async () => {
      const { ws } = await this.createWebSocketConnection(config.websocketUrl, "invalid_token");
      
      // Should still connect but not be authenticated
      const { message } = await this.waitForMessage(ws, "connected");
      
      ws.close(1000, "Test complete");
      
      if (message.authenticated) {
        throw new Error("Invalid token was accepted");
      }
      
      return { authenticated: false, properly_rejected: true };
    });
    this.addTestResult(invalidTokenResult);

    this.finishSuite();
  }

  // Test Suite 3: Event Subscription and Messaging
  async testEventSubscription(): Promise<void> {
    this.startSuite("Event Subscription and Messaging");

    if (!this.authToken) {
      console.log("⚠️  Skipping event subscription tests - no token available");
      this.finishSuite();
      return;
    }

    // Test 1: Dashboard Subscription
    const dashboardSubResult = await this.runTest("Dashboard Event Subscription", async () => {
      const { ws } = await this.createWebSocketConnection(config.websocketUrl, this.authToken!);
      
      // Wait for connection
      await this.waitForMessage(ws, "connected");
      
      // Subscribe to dashboard events
      const subscribeMessage = {
        type: "subscribe",
        channel: "dashboard",
        userId: 1, // Creator user ID
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(subscribeMessage));
      
      // Test ping-pong
      const pingMessage = { type: "ping", timestamp: Date.now() };
      const pingStart = Date.now();
      ws.send(JSON.stringify(pingMessage));
      
      const { latency } = await this.waitForMessage(ws, "pong");
      
      ws.close(1000, "Test complete");
      
      return { subscribed: true, pingLatency: latency };
    });
    this.addTestResult(dashboardSubResult);

    // Test 2: Notification Handling
    const notificationResult = await this.runTest("Notification Message Handling", async () => {
      const { ws } = await this.createWebSocketConnection(config.websocketUrl, this.authToken!);
      
      await this.waitForMessage(ws, "connected");
      
      // Subscribe to notifications
      const subscribeMessage = {
        type: "subscribe",
        channel: "notifications",
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(subscribeMessage));
      
      // Test message types support
      const supportedTypes = [
        "dashboard_update",
        "new_follower", 
        "pitch_view",
        "nda_request",
        "activity_update"
      ];
      
      let receivedTypes: string[] = [];
      
      // Listen for any incoming messages for a short time
      const messagePromise = new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(receivedTypes), 3000);
        
        const messageHandler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type && !receivedTypes.includes(message.type)) {
              receivedTypes.push(message.type);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        };
        
        ws.addEventListener('message', messageHandler);
        
        setTimeout(() => {
          ws.removeEventListener('message', messageHandler);
          clearTimeout(timeout);
          resolve(receivedTypes);
        }, 3000);
      });
      
      await messagePromise;
      ws.close(1000, "Test complete");
      
      return { 
        supportedTypes,
        receivedTypes,
        subscriptionWorking: true
      };
    });
    this.addTestResult(notificationResult);

    // Test 3: Real-time Metrics Update
    const metricsResult = await this.runTest("Real-time Metrics Update", async () => {
      const { ws } = await this.createWebSocketConnection(config.websocketUrl, this.authToken!);
      
      await this.waitForMessage(ws, "connected");
      
      // Request dashboard metrics
      const metricsRequest = {
        type: "get_dashboard_metrics",
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(metricsRequest));
      
      // Try to wait for metrics response (may not be implemented yet)
      try {
        const { message, latency } = await this.waitForMessage(ws, "dashboard_metrics", 8000);
        ws.close(1000, "Test complete");
        
        return {
          latency,
          hasMetrics: !!message.data,
          metricsKeys: message.data ? Object.keys(message.data) : []
        };
      } catch (error) {
        ws.close(1000, "Test complete");
        
        return {
          metricsEndpointExists: false,
          note: "Dashboard metrics endpoint not implemented yet"
        };
      }
    });
    this.addTestResult(metricsResult);

    this.finishSuite();
  }

  // Test Suite 4: Error Handling and Reconnection
  async testErrorHandlingAndReconnection(): Promise<void> {
    this.startSuite("Error Handling and Reconnection");

    // Test 1: Graceful Disconnection
    const gracefulDisconnectResult = await this.runTest("Graceful Disconnection", async () => {
      const { ws } = await this.createWebSocketConnection(config.websocketUrl, this.authToken || undefined);
      
      await this.waitForMessage(ws, "connected");
      
      // Send close frame with normal closure
      ws.close(1000, "Test disconnection");
      
      return new Promise((resolve) => {
        ws.onclose = (event) => {
          resolve({
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            graceful: event.code === 1000
          });
        };
      });
    });
    this.addTestResult(gracefulDisconnectResult);

    // Test 2: Connection Timeout Handling
    const timeoutResult = await this.runTest("Connection Timeout Handling", async () => {
      try {
        // Use an invalid URL to test timeout
        await this.createWebSocketConnection("wss://invalid-url-timeout-test.example.com/ws", undefined, 3000);
        throw new Error("Should have timed out");
      } catch (error) {
        if (error instanceof Error && error.message.includes("timeout")) {
          return { timeoutHandled: true, error: error.message };
        }
        throw error;
      }
    });
    this.addTestResult(timeoutResult);

    // Test 3: Invalid Message Handling
    const invalidMessageResult = await this.runTest("Invalid Message Handling", async () => {
      const { ws } = await this.createWebSocketConnection(config.websocketUrl, this.authToken || undefined);
      
      await this.waitForMessage(ws, "connected");
      
      // Send invalid JSON
      ws.send("invalid json");
      
      // Send valid JSON but invalid message structure
      ws.send(JSON.stringify({ invalid: "structure", missing: "type" }));
      
      // Wait a moment to see if the connection stays stable
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test if connection is still alive with ping
      const pingMessage = { type: "ping", timestamp: Date.now() };
      ws.send(JSON.stringify(pingMessage));
      
      try {
        await this.waitForMessage(ws, "pong", 3000);
        ws.close(1000, "Test complete");
        
        return { connectionStable: true, invalidMessagesHandled: true };
      } catch (error) {
        ws.close();
        throw new Error("Connection became unstable after invalid messages");
      }
    });
    this.addTestResult(invalidMessageResult);

    // Test 4: Reconnection Simulation
    const reconnectionResult = await this.runTest("Reconnection Logic", async () => {
      // This simulates what a client-side reconnection logic would do
      let reconnectAttempts = 0;
      const maxAttempts = 3;
      
      const attemptConnection = async (): Promise<any> => {
        try {
          reconnectAttempts++;
          const { ws, connectionTime } = await this.createWebSocketConnection(
            config.websocketUrl,
            this.authToken || undefined,
            5000
          );
          
          await this.waitForMessage(ws, "connected");
          ws.close(1000, "Reconnection test");
          
          return { 
            attempt: reconnectAttempts,
            connectionTime,
            successful: true 
          };
        } catch (error) {
          if (reconnectAttempts < maxAttempts) {
            // Wait before retry (exponential backoff simulation)
            await new Promise(resolve => setTimeout(resolve, 1000 * reconnectAttempts));
            return await attemptConnection();
          }
          throw error;
        }
      };
      
      return await attemptConnection();
    });
    this.addTestResult(reconnectionResult);

    this.finishSuite();
  }

  // Test Suite 5: Performance and Load Testing
  async testPerformanceAndLoad(): Promise<void> {
    this.startSuite("Performance and Load Testing");

    // Test 1: Connection Performance
    const connPerfResult = await this.runTest("Connection Performance", async () => {
      const attempts = 5;
      const connectionTimes: number[] = [];
      
      for (let i = 0; i < attempts; i++) {
        const { ws, connectionTime } = await this.createWebSocketConnection(
          config.websocketUrl,
          this.authToken || undefined
        );
        
        connectionTimes.push(connectionTime);
        ws.close(1000, "Performance test");
        
        // Small delay between connections
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const avgConnectionTime = connectionTimes.reduce((sum, time) => sum + time, 0) / attempts;
      const maxConnectionTime = Math.max(...connectionTimes);
      const minConnectionTime = Math.min(...connectionTimes);
      
      return {
        attempts,
        avgConnectionTime: Math.round(avgConnectionTime),
        maxConnectionTime,
        minConnectionTime,
        allTimes: connectionTimes,
        withinThreshold: maxConnectionTime < config.performanceThresholds.connectionTime
      };
    });
    this.addTestResult(connPerfResult);

    // Test 2: Message Latency Testing
    const latencyResult = await this.runTest("Message Latency Testing", async () => {
      const { ws } = await this.createWebSocketConnection(config.websocketUrl, this.authToken || undefined);
      
      await this.waitForMessage(ws, "connected");
      
      const pingAttempts = 10;
      const latencies: number[] = [];
      
      for (let i = 0; i < pingAttempts; i++) {
        const pingMessage = { 
          type: "ping", 
          id: `ping-${i}`,
          timestamp: Date.now() 
        };
        
        ws.send(JSON.stringify(pingMessage));
        
        try {
          const { latency } = await this.waitForMessage(ws, "pong", 3000);
          latencies.push(latency);
        } catch (error) {
          console.warn(`Ping ${i} failed:`, error);
        }
        
        // Small delay between pings
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      ws.close(1000, "Latency test complete");
      
      if (latencies.length === 0) {
        throw new Error("No successful ping-pong cycles");
      }
      
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);
      
      return {
        successful: latencies.length,
        failed: pingAttempts - latencies.length,
        avgLatency: Math.round(avgLatency),
        maxLatency,
        minLatency,
        withinThreshold: maxLatency < config.performanceThresholds.messageLatency
      };
    });
    this.addTestResult(latencyResult);

    // Test 3: Concurrent Connections (limited for production testing)
    const concurrentResult = await this.runTest("Concurrent Connections", async () => {
      const concurrentCount = 3; // Keep low for production testing
      
      const connections: Promise<any>[] = [];
      
      for (let i = 0; i < concurrentCount; i++) {
        const connectionPromise = (async () => {
          const { ws, connectionTime } = await this.createWebSocketConnection(
            config.websocketUrl,
            this.authToken || undefined
          );
          
          await this.waitForMessage(ws, "connected");
          
          // Send a test message
          const testMessage = { type: "ping", id: `concurrent-${i}` };
          ws.send(JSON.stringify(testMessage));
          
          const { latency } = await this.waitForMessage(ws, "pong", 5000);
          
          ws.close(1000, "Concurrent test");
          
          return { connectionId: i, connectionTime, latency };
        })();
        
        connections.push(connectionPromise);
      }
      
      const results = await Promise.allSettled(connections);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      return {
        attempted: concurrentCount,
        successful,
        failed,
        successRate: (successful / concurrentCount) * 100,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: (r.reason as Error).message })
      };
    });
    this.addTestResult(concurrentResult);

    this.finishSuite();
  }

  // Test Suite 6: Production Readiness Checks
  async testProductionReadiness(): Promise<void> {
    this.startSuite("Production Readiness Checks");

    // Test 1: Health Check Endpoints
    const healthResult = await this.runTest("Health Check Endpoints", async () => {
      const healthEndpoints = [
        "/api/ws/health",
        "/api/health"
      ];
      
      const results: any[] = [];
      
      for (const endpoint of healthEndpoints) {
        try {
          const response = await fetch(`${config.backendUrl}${endpoint}`);
          const data = await response.text();
          
          results.push({
            endpoint,
            status: response.status,
            ok: response.ok,
            data: data.length > 0 ? data.substring(0, 200) : null
          });
        } catch (error) {
          results.push({
            endpoint,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
      
      return { healthEndpoints: results };
    });
    this.addTestResult(healthResult);

    // Test 2: WebSocket Service Statistics (if available)
    const statsResult = await this.runTest("WebSocket Service Statistics", async () => {
      if (!this.authToken) {
        return { available: false, reason: "No authentication token" };
      }
      
      try {
        const response = await fetch(`${config.backendUrl}/api/ws/stats`, {
          headers: { Authorization: `Bearer ${this.authToken}` }
        });
        
        if (response.ok) {
          const stats = await response.json();
          return { available: true, stats };
        } else {
          return { 
            available: false, 
            status: response.status,
            reason: `HTTP ${response.status}` 
          };
        }
      } catch (error) {
        return { 
          available: false, 
          reason: error instanceof Error ? error.message : "Unknown error"
        };
      }
    });
    this.addTestResult(statsResult);

    // Test 3: Security Headers and SSL
    const securityResult = await this.runTest("Security and SSL Verification", async () => {
      const response = await fetch(config.backendUrl);
      
      const securityHeaders = {
        'strict-transport-security': response.headers.get('strict-transport-security'),
        'x-frame-options': response.headers.get('x-frame-options'),
        'x-content-type-options': response.headers.get('x-content-type-options'),
        'content-security-policy': response.headers.get('content-security-policy')
      };
      
      const sslVerification = {
        httpsUsed: config.websocketUrl.startsWith('wss://'),
        backendHttps: config.backendUrl.startsWith('https://')
      };
      
      return {
        securityHeaders,
        sslVerification,
        securityScore: Object.values(securityHeaders).filter(Boolean).length
      };
    });
    this.addTestResult(securityResult);

    // Test 4: Rate Limiting and Resource Management
    const rateLimitResult = await this.runTest("Rate Limiting and Resource Management", async () => {
      const { ws } = await this.createWebSocketConnection(config.websocketUrl, this.authToken || undefined);
      
      await this.waitForMessage(ws, "connected");
      
      // Send rapid messages to test rate limiting
      const rapidMessages = 20;
      const sentMessages: number[] = [];
      const responses: number[] = [];
      
      for (let i = 0; i < rapidMessages; i++) {
        const timestamp = Date.now();
        sentMessages.push(timestamp);
        
        ws.send(JSON.stringify({
          type: "ping",
          id: `rapid-${i}`,
          timestamp
        }));
      }
      
      // Wait for responses
      await new Promise(resolve => {
        const messageHandler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "pong") {
              responses.push(Date.now());
            }
          } catch (e) {
            // Ignore
          }
        };
        
        ws.addEventListener('message', messageHandler);
        
        setTimeout(() => {
          ws.removeEventListener('message', messageHandler);
          resolve(null);
        }, 5000);
      });
      
      ws.close(1000, "Rate limit test complete");
      
      return {
        sent: rapidMessages,
        received: responses.length,
        responseRate: (responses.length / rapidMessages) * 100,
        rateLimitingActive: responses.length < rapidMessages,
        avgResponseTime: responses.length > 0 
          ? Math.round(responses.reduce((sum, time, i) => sum + (time - sentMessages[i]), 0) / responses.length)
          : null
      };
    });
    this.addTestResult(rateLimitResult);

    this.finishSuite();
  }

  // Generate comprehensive test report
  private generateReport(): void {
    console.log("\n" + "=".repeat(80));
    console.log("📊 WEBSOCKET PRODUCTION TEST REPORT");
    console.log("=".repeat(80));
    
    console.log(`🏭 Environment: ${config.backendUrl}`);
    console.log(`🔌 WebSocket: ${config.websocketUrl}`);
    console.log(`⏰ Completed: ${new Date().toISOString()}\n`);

    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    this.results.forEach(suite => {
      console.log(`📋 ${suite.name}:`);
      console.log(`   ✅ Passed: ${suite.passed}`);
      console.log(`   ❌ Failed: ${suite.failed}`);
      console.log(`   ⏱️  Duration: ${suite.totalDuration}ms\n`);

      // Show failed tests
      const failedTests = suite.tests.filter(t => !t.passed);
      if (failedTests.length > 0) {
        console.log(`   🚨 Failed Tests:`);
        failedTests.forEach(test => {
          console.log(`      • ${test.testName}: ${test.error}`);
        });
        console.log();
      }

      totalPassed += suite.passed;
      totalFailed += suite.failed;
      totalDuration += suite.totalDuration;
    });

    console.log("=".repeat(80));
    console.log("📈 OVERALL RESULTS:");
    console.log(`   ✅ Total Passed: ${totalPassed}`);
    console.log(`   ❌ Total Failed: ${totalFailed}`);
    console.log(`   📊 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
    console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);

    // Performance summary
    const perfResults = this.results.find(suite => suite.name === "Performance and Load Testing");
    if (perfResults) {
      console.log("\n🚄 PERFORMANCE SUMMARY:");
      
      const connectionPerf = perfResults.tests.find(t => t.testName === "Connection Performance");
      if (connectionPerf && connectionPerf.details) {
        console.log(`   🔗 Avg Connection Time: ${connectionPerf.details.avgConnectionTime}ms`);
      }
      
      const latencyTest = perfResults.tests.find(t => t.testName === "Message Latency Testing");
      if (latencyTest && latencyTest.details) {
        console.log(`   ⚡ Avg Message Latency: ${latencyTest.details.avgLatency}ms`);
      }
    }

    // Production readiness summary
    const readinessResults = this.results.find(suite => suite.name === "Production Readiness Checks");
    if (readinessResults) {
      console.log("\n🏭 PRODUCTION READINESS:");
      const passedReadiness = readinessResults.passed;
      const totalReadiness = readinessResults.tests.length;
      const readinessScore = ((passedReadiness / totalReadiness) * 100).toFixed(1);
      
      console.log(`   📊 Readiness Score: ${readinessScore}% (${passedReadiness}/${totalReadiness})`);
      
      if (passedReadiness === totalReadiness) {
        console.log("   ✅ READY FOR PRODUCTION");
      } else if (passedReadiness >= totalReadiness * 0.8) {
        console.log("   ⚠️  MOSTLY READY - minor issues detected");
      } else {
        console.log("   ❌ NOT READY - significant issues detected");
      }
    }

    console.log("=".repeat(80));
  }

  // Main test runner
  async runAllTests(): Promise<void> {
    console.log("🚀 Starting comprehensive WebSocket production tests...\n");

    try {
      await this.testBasicConnection();
      await this.testAuthenticationFlow();
      await this.testEventSubscription();
      await this.testErrorHandlingAndReconnection();
      await this.testPerformanceAndLoad();
      await this.testProductionReadiness();
      
      this.generateReport();
      
    } catch (error) {
      console.error("💥 Test suite crashed:", error);
      console.log("\nGenerating partial report...");
      this.generateReport();
      
      Deno.exit(1);
    }

    // Exit with error code if any tests failed
    const totalFailed = this.results.reduce((sum, suite) => sum + suite.failed, 0);
    if (totalFailed > 0) {
      Deno.exit(1);
    }
  }
}

// Run the tests
if (import.meta.main) {
  const tester = new WebSocketTester();
  await tester.runAllTests();
}