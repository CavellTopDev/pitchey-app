/**
 * WebSocket Client Example for Pitchey Production
 * Demonstrates how to integrate with the production WebSocket API
 * 
 * Usage: deno run --allow-net --allow-env websocket-client-example.ts
 */

export interface PitcheyWebSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(channel: string, callback: (data: any) => void): void;
  send(message: any): void;
  onConnectionChange(callback: (connected: boolean) => void): void;
}

export class PitcheyWebSocketManager implements PitcheyWebSocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions = new Map<string, (data: any) => void>();
  private connectionCallbacks: ((connected: boolean) => void)[] = [];
  private isConnecting = false;

  constructor(
    private baseUrl: string = "wss://pitchey-backend-fresh.deno.dev/ws",
    private authUrl: string = "https://pitchey-backend-fresh.deno.dev/api/auth/creator/login"
  ) {}

  async authenticate(email: string, password: string): Promise<string> {
    const response = await fetch(this.authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.token) {
      throw new Error(`Authentication failed: ${data.message || 'No token received'}`);
    }

    this.token = data.token;
    return data.token;
  }

  async connect(email?: string, password?: string): Promise<void> {
    if (this.isConnecting) {
      console.log("Connection already in progress...");
      return;
    }

    if (email && password && !this.token) {
      console.log("🔐 Authenticating...");
      await this.authenticate(email, password);
      console.log("✅ Authentication successful");
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.token 
          ? `${this.baseUrl}?token=${this.token}`
          : this.baseUrl;

        console.log("🔌 Connecting to WebSocket...");
        this.ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
          }
          this.isConnecting = false;
          reject(new Error("Connection timeout"));
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          console.log("✅ WebSocket connected");
          this.notifyConnectionChange(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.warn("Failed to parse message:", event.data);
          }
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          console.log(`🔌 WebSocket closed: ${event.code} ${event.reason}`);
          this.notifyConnectionChange(false);
          
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          this.isConnecting = false;
          if (timeout) clearTimeout(timeout);
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
  }

  subscribe(channel: string, callback: (data: any) => void): void {
    this.subscriptions.set(channel, callback);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: "subscribe",
        channel: channel,
        timestamp: Date.now()
      });
    }
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("Cannot send message - WebSocket not connected");
    }
  }

  onConnectionChange(callback: (connected: boolean) => void): void {
    this.connectionCallbacks.push(callback);
  }

  private handleMessage(message: any): void {
    console.log("📥 Received:", message.type);

    switch (message.type) {
      case "connected":
        console.log("🎉 Connection confirmed:", {
          authenticated: message.authenticated,
          capabilities: message.capabilities
        });
        
        // Re-subscribe to all channels
        for (const [channel] of this.subscriptions) {
          this.send({
            type: "subscribe",
            channel: channel,
            timestamp: Date.now()
          });
        }
        break;

      case "pong":
        console.log("🏓 Pong received");
        break;

      case "dashboard_update":
        const dashboardCallback = this.subscriptions.get("dashboard");
        if (dashboardCallback) {
          dashboardCallback(message.data);
        }
        break;

      case "notification":
        const notificationCallback = this.subscriptions.get("notifications");
        if (notificationCallback) {
          notificationCallback(message.data);
        }
        break;

      case "error":
        console.error("🚨 Server error:", message.message);
        break;

      default:
        console.log("📋 Unhandled message type:", message.type);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error("Connection callback error:", error);
      }
    });
  }

  // Utility methods for common operations

  ping(): void {
    this.send({
      type: "ping",
      timestamp: Date.now()
    });
  }

  subscribeToDashboard(): void {
    this.subscribe("dashboard", (data) => {
      console.log("📊 Dashboard update:", data);
    });
  }

  subscribeToNotifications(): void {
    this.subscribe("notifications", (data) => {
      console.log("🔔 Notification:", data);
    });
  }

  requestDashboardMetrics(): void {
    this.send({
      type: "get_dashboard_metrics",
      timestamp: Date.now()
    });
  }

  updatePresence(status: "online" | "away" | "busy"): void {
    this.send({
      type: "presence_update",
      status: status,
      timestamp: Date.now()
    });
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Example usage and demo
async function demonstrateWebSocketClient(): Promise<void> {
  console.log("🚀 Pitchey WebSocket Client Demo");
  console.log("================================\n");

  const client = new PitcheyWebSocketManager();

  // Set up connection monitoring
  client.onConnectionChange((connected) => {
    console.log(`🔗 Connection status: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
  });

  try {
    // Connect with demo credentials
    await client.connect("alex.creator@demo.com", "Demo123");

    // Set up subscriptions
    console.log("📡 Setting up subscriptions...");
    client.subscribeToDashboard();
    client.subscribeToNotifications();

    // Test ping
    console.log("🏓 Testing ping...");
    client.ping();

    // Request dashboard metrics
    console.log("📊 Requesting dashboard metrics...");
    client.requestDashboardMetrics();

    // Update presence
    console.log("👤 Updating presence...");
    client.updatePresence("online");

    // Keep connection alive for demo
    console.log("\n⏰ Keeping connection alive for 30 seconds...");
    console.log("   (Watch for real-time updates)");
    
    // Send periodic pings to test the connection
    const pingInterval = setInterval(() => {
      if (client.isConnected()) {
        client.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 10000); // Ping every 10 seconds

    // Demo duration
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Clean up
    clearInterval(pingInterval);
    client.disconnect();
    console.log("\n✅ Demo completed successfully!");

  } catch (error) {
    console.error("💥 Demo failed:", error);
  }
}

// Run demo if this script is executed directly
if (import.meta.main) {
  await demonstrateWebSocketClient();
}

// Export for use in other modules
export { PitcheyWebSocketManager as default };