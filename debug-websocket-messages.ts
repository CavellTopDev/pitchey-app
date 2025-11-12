/**
 * WebSocket Message Debug Script
 * Focused testing to investigate message handling and routing issues
 * 
 * Usage: deno run --allow-net --allow-env debug-websocket-messages.ts
 */

interface MessageLog {
  timestamp: number;
  direction: 'sent' | 'received';
  type: string;
  data: any;
  latency?: number;
}

class WebSocketDebugger {
  private logs: MessageLog[] = [];
  private authToken: string | null = null;

  async authenticate(): Promise<string> {
    console.log("🔐 Authenticating...");
    const response = await fetch("https://pitchey-backend-fresh.deno.dev/api/auth/creator/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alex.creator@demo.com",
        password: "Demo123"
      })
    });

    const data = await response.json();
    if (!data.success || !data.token) {
      throw new Error(`Authentication failed: ${JSON.stringify(data)}`);
    }

    console.log("✅ Authentication successful");
    return data.token;
  }

  logMessage(direction: 'sent' | 'received', type: string, data: any, latency?: number): void {
    const log: MessageLog = {
      timestamp: Date.now(),
      direction,
      type,
      data,
      latency
    };
    
    this.logs.push(log);
    
    const emoji = direction === 'sent' ? '📤' : '📥';
    const latencyText = latency ? ` (${latency}ms)` : '';
    console.log(`${emoji} ${direction.toUpperCase()}: ${type}${latencyText}`);
    
    if (data && Object.keys(data).length > 0) {
      console.log(`   Data:`, JSON.stringify(data, null, 2).split('\n').map(line => `   ${line}`).join('\n'));
    }
  }

  async createWebSocketWithLogging(url: string, token?: string): Promise<WebSocket> {
    const wsUrl = token ? `${url}?token=${token}` : url;
    console.log(`🔌 Connecting to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Connection timeout"));
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log("✅ WebSocket connected successfully");
        resolve(ws);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error("❌ WebSocket connection error:", error);
        reject(new Error("Connection failed"));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.logMessage('received', message.type || 'unknown', message);
        } catch (error) {
          console.log("📥 Raw message (non-JSON):", event.data);
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed: ${event.code} ${event.reason}`);
      };
    });
  }

  sendMessage(ws: WebSocket, type: string, payload: any = {}): void {
    const message = {
      type,
      timestamp: Date.now(),
      ...payload
    };
    
    this.logMessage('sent', type, message);
    ws.send(JSON.stringify(message));
  }

  async waitForMessage(expectedType: string, timeout: number = 5000): Promise<MessageLog | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const found = this.logs
        .slice()
        .reverse()
        .find(log => 
          log.direction === 'received' && 
          log.type === expectedType &&
          log.timestamp > startTime
        );
      
      if (found) {
        return found;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return null;
  }

  printLogs(): void {
    console.log("\n📜 MESSAGE LOG SUMMARY:");
    console.log("=".repeat(60));
    
    this.logs.forEach((log, index) => {
      const emoji = log.direction === 'sent' ? '📤' : '📥';
      const time = new Date(log.timestamp).toLocaleTimeString();
      console.log(`${index + 1}. ${emoji} ${time} - ${log.type}`);
      
      if (log.data && typeof log.data === 'object') {
        const keys = Object.keys(log.data);
        if (keys.length > 0) {
          console.log(`   Fields: ${keys.join(', ')}`);
        }
      }
    });
    
    console.log("=".repeat(60));
  }

  async debugBasicConnection(): Promise<void> {
    console.log("\n🔍 DEBUG: Basic Connection Flow");
    console.log("=".repeat(50));
    
    try {
      const ws = await this.createWebSocketWithLogging("wss://pitchey-backend-fresh.deno.dev/ws");
      
      // Wait for initial connection message
      console.log("⏳ Waiting for connection confirmation...");
      const connected = await this.waitForMessage('connected', 8000);
      
      if (connected) {
        console.log("✅ Received connection confirmation");
      } else {
        console.log("❌ No connection confirmation received");
      }
      
      // Test ping
      console.log("\n📡 Testing ping...");
      this.sendMessage(ws, 'ping', { id: 'test-ping-1' });
      
      const pong = await this.waitForMessage('pong', 5000);
      if (pong) {
        console.log("✅ Ping-pong successful");
      } else {
        console.log("❌ No pong response received");
      }
      
      ws.close(1000, "Debug complete");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error("💥 Basic connection debug failed:", error);
    }
  }

  async debugAuthenticatedConnection(): Promise<void> {
    console.log("\n🔍 DEBUG: Authenticated Connection Flow");
    console.log("=".repeat(50));
    
    try {
      if (!this.authToken) {
        this.authToken = await this.authenticate();
      }
      
      const ws = await this.createWebSocketWithLogging(
        "wss://pitchey-backend-fresh.deno.dev/ws",
        this.authToken
      );
      
      // Wait for authenticated connection message
      console.log("⏳ Waiting for authenticated connection confirmation...");
      const connected = await this.waitForMessage('connected', 8000);
      
      if (connected) {
        console.log("✅ Received connection confirmation");
        console.log("   Authenticated:", connected.data?.authenticated);
        console.log("   User:", connected.data?.user);
        console.log("   Capabilities:", connected.data?.capabilities);
      } else {
        console.log("❌ No connection confirmation received");
      }
      
      // Test subscription
      console.log("\n📡 Testing dashboard subscription...");
      this.sendMessage(ws, 'subscribe', { 
        channel: 'dashboard',
        userId: 1 
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test notification request
      console.log("\n📡 Testing notification subscription...");
      this.sendMessage(ws, 'subscribe', { 
        channel: 'notifications'
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      ws.close(1000, "Debug complete");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error("💥 Authenticated connection debug failed:", error);
    }
  }

  async debugPostConnectionAuth(): Promise<void> {
    console.log("\n🔍 DEBUG: Post-Connection Authentication");
    console.log("=".repeat(50));
    
    try {
      if (!this.authToken) {
        this.authToken = await this.authenticate();
      }
      
      // Connect without token first
      const ws = await this.createWebSocketWithLogging("wss://pitchey-backend-fresh.deno.dev/ws");
      
      // Wait for initial connection
      console.log("⏳ Waiting for unauthenticated connection...");
      const connected = await this.waitForMessage('connected', 8000);
      
      if (connected) {
        console.log("✅ Unauthenticated connection established");
        console.log("   Authenticated:", connected.data?.authenticated);
      } else {
        console.log("❌ No initial connection confirmation");
      }
      
      // Now send authentication
      console.log("\n🔐 Sending post-connection authentication...");
      this.sendMessage(ws, 'auth', { token: this.authToken });
      
      // Wait for auth response
      console.log("⏳ Waiting for authentication response...");
      
      // Check for both possible responses
      const authSuccess = await this.waitForMessage('auth_success', 8000);
      const authError = await this.waitForMessage('auth_error', 1000);
      
      if (authSuccess) {
        console.log("✅ Post-connection authentication successful");
        console.log("   User:", authSuccess.data?.user);
        console.log("   Capabilities:", authSuccess.data?.capabilities);
      } else if (authError) {
        console.log("❌ Authentication failed:", authError.data);
      } else {
        console.log("❌ No authentication response received");
        
        // Let's see what messages we did receive
        const recentMessages = this.logs
          .filter(log => log.direction === 'received')
          .slice(-5);
        
        console.log("📋 Recent received messages:");
        recentMessages.forEach(msg => {
          console.log(`   ${msg.type}: ${JSON.stringify(msg.data)}`);
        });
      }
      
      ws.close(1000, "Debug complete");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error("💥 Post-connection auth debug failed:", error);
    }
  }

  async debugMessageTypes(): Promise<void> {
    console.log("\n🔍 DEBUG: Supported Message Types");
    console.log("=".repeat(50));
    
    try {
      if (!this.authToken) {
        this.authToken = await this.authenticate();
      }
      
      const ws = await this.createWebSocketWithLogging(
        "wss://pitchey-backend-fresh.deno.dev/ws",
        this.authToken
      );
      
      await this.waitForMessage('connected', 5000);
      
      // Test various message types
      const messageTypes = [
        'ping',
        'subscribe',
        'get_dashboard_metrics',
        'get_notifications',
        'presence_update',
        'typing_start',
        'unknown_type'
      ];
      
      console.log("\n📡 Testing message types...");
      
      for (const type of messageTypes) {
        console.log(`\n🔸 Testing: ${type}`);
        this.sendMessage(ws, type, { test: true });
        
        // Wait for any response
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      ws.close(1000, "Message type debug complete");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error("💥 Message type debug failed:", error);
    }
  }

  async runDebugSuite(): Promise<void> {
    console.log("🚀 WebSocket Message Debug Suite");
    console.log("=".repeat(50));
    
    await this.debugBasicConnection();
    await this.debugAuthenticatedConnection();
    await this.debugPostConnectionAuth();
    await this.debugMessageTypes();
    
    this.printLogs();
    
    console.log("\n✅ Debug suite completed");
  }
}

// Run debug suite
if (import.meta.main) {
  const wsDebugger = new WebSocketDebugger();
  await wsDebugger.runDebugSuite();
}