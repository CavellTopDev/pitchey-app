import { Page, expect } from '@playwright/test';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface WebSocketTestOptions {
  timeout?: number;
  expectedMessageCount?: number;
  messageFilter?: (message: WebSocketMessage) => boolean;
}

export class WebSocketTestHelper {
  private page: Page;
  private messages: WebSocketMessage[] = [];
  private isMonitoring: boolean = false;
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> = new Map();

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Start monitoring WebSocket messages
   */
  async startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.messages = [];

    // Inject WebSocket monitoring script
    await this.page.addInitScript(() => {
      // Store original WebSocket
      const OriginalWebSocket = window.WebSocket;
      
      // Create monitoring array
      (window as any).__websocketMessages = [];
      
      // Override WebSocket constructor
      (window as any).WebSocket = class extends OriginalWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          
          this.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              (window as any).__websocketMessages.push({
                type: data.type || 'unknown',
                payload: data,
                timestamp: Date.now(),
                direction: 'incoming'
              });
            } catch (e) {
              // Handle non-JSON messages
              (window as any).__websocketMessages.push({
                type: 'raw',
                payload: event.data,
                timestamp: Date.now(),
                direction: 'incoming'
              });
            }
          });

          // Monitor outgoing messages
          const originalSend = this.send;
          this.send = function(data: string | ArrayBuffer | Blob | ArrayBufferView) {
            try {
              const parsed = typeof data === 'string' ? JSON.parse(data) : data;
              (window as any).__websocketMessages.push({
                type: parsed.type || 'unknown',
                payload: parsed,
                timestamp: Date.now(),
                direction: 'outgoing'
              });
            } catch (e) {
              (window as any).__websocketMessages.push({
                type: 'raw',
                payload: data,
                timestamp: Date.now(),
                direction: 'outgoing'
              });
            }
            
            return originalSend.call(this, data);
          };
        }
      };
    });
  }

  /**
   * Stop monitoring WebSocket messages
   */
  async stopMonitoring() {
    this.isMonitoring = false;
    
    // Restore original WebSocket
    await this.page.evaluate(() => {
      // This would restore the original WebSocket if needed
      // For testing purposes, we'll leave the override in place
    });
  }

  /**
   * Get all captured WebSocket messages
   */
  async getMessages(): Promise<WebSocketMessage[]> {
    const messages = await this.page.evaluate(() => {
      return (window as any).__websocketMessages || [];
    });
    
    return messages.map((msg: any) => ({
      type: msg.type,
      payload: msg.payload,
      timestamp: msg.timestamp,
      direction: msg.direction
    }));
  }

  /**
   * Wait for a specific WebSocket message
   */
  async waitForMessage(
    expectedType: string, 
    options: WebSocketTestOptions = {}
  ): Promise<WebSocketMessage> {
    const { timeout = 10000, messageFilter } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const messages = await this.getMessages();
      
      for (const message of messages) {
        if (message.type === expectedType) {
          if (!messageFilter || messageFilter(message)) {
            return message;
          }
        }
      }
      
      // Wait a bit before checking again
      await this.page.waitForTimeout(100);
    }
    
    throw new Error(`WebSocket message of type "${expectedType}" not received within ${timeout}ms`);
  }

  /**
   * Wait for multiple WebSocket messages
   */
  async waitForMessages(
    expectedTypes: string[], 
    options: WebSocketTestOptions = {}
  ): Promise<WebSocketMessage[]> {
    const { timeout = 15000 } = options;
    const startTime = Date.now();
    const foundMessages: WebSocketMessage[] = [];

    while (Date.now() - startTime < timeout && foundMessages.length < expectedTypes.length) {
      const messages = await this.getMessages();
      
      for (const message of messages) {
        if (expectedTypes.includes(message.type) && 
            !foundMessages.find(m => m.type === message.type && m.timestamp === message.timestamp)) {
          foundMessages.push(message);
        }
      }
      
      await this.page.waitForTimeout(100);
    }
    
    if (foundMessages.length < expectedTypes.length) {
      const missing = expectedTypes.filter(type => 
        !foundMessages.find(m => m.type === type)
      );
      throw new Error(`Did not receive all expected WebSocket messages. Missing: ${missing.join(', ')}`);
    }
    
    return foundMessages;
  }

  /**
   * Verify WebSocket connection is established
   */
  async verifyConnection(timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const isConnected = await this.page.evaluate(() => {
        // Check for WebSocket connection indicators
        const wsStatus = document.querySelector('[data-testid="websocket-status"]');
        const wsIndicator = document.querySelector('.ws-connected, .websocket-connected');
        
        return wsStatus?.textContent?.includes('Connected') || 
               wsIndicator !== null ||
               (window as any).__websocketConnected === true;
      });
      
      if (isConnected) {
        return true;
      }
      
      await this.page.waitForTimeout(100);
    }
    
    return false;
  }

  /**
   * Simulate WebSocket disconnection
   */
  async simulateDisconnection() {
    await this.page.evaluate(() => {
      // Find and close WebSocket connections
      if ((window as any).__websocketConnections) {
        (window as any).__websocketConnections.forEach((ws: WebSocket) => {
          ws.close();
        });
      }
    });
  }

  /**
   * Test WebSocket message handling for notifications
   */
  async testNotificationMessage(notificationData: any): Promise<void> {
    await this.startMonitoring();
    
    // Inject a test notification message
    await this.page.evaluate((data) => {
      const event = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'notification',
          payload: data
        })
      });
      
      // Simulate receiving the message
      if ((window as any).__websocketInstance) {
        (window as any).__websocketInstance.dispatchEvent(event);
      }
    }, notificationData);
    
    // Wait for the notification to be processed
    await this.page.waitForTimeout(500);
    
    // Verify notification appears in UI
    const notificationBell = this.page.locator('[data-testid="notification-bell"]');
    await expect(notificationBell).toHaveClass(/.*has-notifications.*/);
  }

  /**
   * Test real-time draft sync
   */
  async testDraftSync(pitchId: string, draftData: any): Promise<void> {
    await this.startMonitoring();
    
    // Simulate draft update message
    await this.page.evaluate((id, data) => {
      const event = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'draft_sync',
          payload: {
            pitchId: id,
            draftData: data,
            timestamp: Date.now()
          }
        })
      });
      
      if ((window as any).__websocketInstance) {
        (window as any).__websocketInstance.dispatchEvent(event);
      }
    }, pitchId, draftData);
    
    // Verify draft sync indicator appears
    const syncStatus = this.page.locator('[data-testid="draft-sync-status"]');
    await expect(syncStatus).toContainText('Synced');
  }

  /**
   * Test presence/typing indicators
   */
  async testPresenceIndicators(userId: string, status: 'online' | 'typing' | 'away'): Promise<void> {
    await this.startMonitoring();
    
    await this.page.evaluate((id, presenceStatus) => {
      const event = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'presence_update',
          payload: {
            userId: id,
            status: presenceStatus,
            timestamp: Date.now()
          }
        })
      });
      
      if ((window as any).__websocketInstance) {
        (window as any).__websocketInstance.dispatchEvent(event);
      }
    }, userId, status);
    
    // Verify presence indicator updates
    if (status === 'typing') {
      const typingIndicator = this.page.locator('[data-testid="typing-indicator"]');
      await expect(typingIndicator).toBeVisible();
    }
  }

  /**
   * Test WebSocket reconnection behavior
   */
  async testReconnection(): Promise<void> {
    await this.verifyConnection();
    
    // Simulate disconnection
    await this.simulateDisconnection();
    
    // Check for reconnection attempt
    const reconnectingStatus = this.page.locator('[data-testid="websocket-status"]');
    await expect(reconnectingStatus).toContainText(/Reconnecting|Connecting/);
    
    // Wait for reconnection
    await this.page.waitForTimeout(2000);
    
    // Verify connection is restored
    const isReconnected = await this.verifyConnection(10000);
    expect(isReconnected).toBeTruthy();
  }

  /**
   * Measure WebSocket message latency
   */
  async measureLatency(): Promise<number> {
    const sendTime = Date.now();
    
    // Send ping message
    await this.page.evaluate((timestamp) => {
      if ((window as any).__websocketInstance) {
        (window as any).__websocketInstance.send(JSON.stringify({
          type: 'ping',
          timestamp: timestamp
        }));
      }
    }, sendTime);
    
    // Wait for pong response
    try {
      const pongMessage = await this.waitForMessage('pong', { timeout: 5000 });
      return pongMessage.timestamp - sendTime;
    } catch (error) {
      throw new Error('Failed to measure WebSocket latency - no pong response received');
    }
  }

  /**
   * Test WebSocket message ordering
   */
  async testMessageOrdering(messageCount: number = 5): Promise<boolean> {
    await this.startMonitoring();
    
    const sentMessages: number[] = [];
    
    // Send multiple messages rapidly
    for (let i = 0; i < messageCount; i++) {
      const timestamp = Date.now() + i;
      sentMessages.push(timestamp);
      
      await this.page.evaluate((ts) => {
        if ((window as any).__websocketInstance) {
          (window as any).__websocketInstance.send(JSON.stringify({
            type: 'test_order',
            sequence: ts
          }));
        }
      }, timestamp);
    }
    
    // Wait for all responses
    await this.page.waitForTimeout(1000);
    
    const receivedMessages = await this.getMessages();
    const orderMessages = receivedMessages
      .filter(m => m.type === 'test_order_response')
      .map(m => m.payload.sequence)
      .sort((a, b) => a - b);
    
    // Check if messages are in order
    return JSON.stringify(sentMessages) === JSON.stringify(orderMessages);
  }

  /**
   * Clear captured messages
   */
  async clearMessages(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).__websocketMessages = [];
    });
  }

  /**
   * Get connection statistics
   */
  async getConnectionStats(): Promise<{
    totalMessages: number;
    incomingMessages: number;
    outgoingMessages: number;
    messageTypes: string[];
    averageLatency?: number;
  }> {
    const messages = await this.getMessages();
    
    const stats = {
      totalMessages: messages.length,
      incomingMessages: messages.filter(m => (m as any).direction === 'incoming').length,
      outgoingMessages: messages.filter(m => (m as any).direction === 'outgoing').length,
      messageTypes: [...new Set(messages.map(m => m.type))],
      averageLatency: undefined as number | undefined
    };
    
    // Calculate average latency for ping/pong pairs
    const pings = messages.filter(m => m.type === 'ping');
    const pongs = messages.filter(m => m.type === 'pong');
    
    if (pings.length > 0 && pongs.length > 0) {
      const latencies = pings.map(ping => {
        const pong = pongs.find(p => p.timestamp > ping.timestamp);
        return pong ? pong.timestamp - ping.timestamp : null;
      }).filter(l => l !== null) as number[];
      
      if (latencies.length > 0) {
        stats.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      }
    }
    
    return stats;
  }
}