/**
 * Enhanced Real-time Service
 * Combines WebSocket (when available) with optimized polling fallback
 */

import type { WebSocketMessage } from '../types/websocket.types';

interface RealtimeMessage {
  type: 'notification' | 'dashboard_update' | 'chat_message' | 'presence_update' | 'typing_indicator' | 'upload_progress' | 'pitch_view_update';
  payload: any;
  timestamp: string;
  userId?: string;
  channel?: string;
}

interface RealtimeConfig {
  preferWebSocket: boolean;
  pollingInterval: number;
  heartbeatInterval: number;
  reconnectAttempts: number;
  batchingEnabled: boolean;
  compressionEnabled: boolean;
}

export class EnhancedRealtimeService {
  private static instance: EnhancedRealtimeService;
  private ws: WebSocket | null = null;
  private pollingInterval: number | null = null;
  private heartbeatInterval: number | null = null;
  private messageQueue: RealtimeMessage[] = [];
  private subscribers: Map<string, Set<Function>> = new Map();
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'polling' = 'disconnected';
  private lastMessageId: string | null = null;
  private userId: string | null = null;
  private config: RealtimeConfig;

  private constructor() {
    this.config = {
      preferWebSocket: true,
      pollingInterval: 5000, // 5 seconds
      heartbeatInterval: 30000, // 30 seconds
      reconnectAttempts: 3,
      batchingEnabled: true,
      compressionEnabled: false // Disabled for simplicity
    };
  }

  static getInstance(): EnhancedRealtimeService {
    if (!EnhancedRealtimeService.instance) {
      EnhancedRealtimeService.instance = new EnhancedRealtimeService();
    }
    return EnhancedRealtimeService.instance;
  }

  /**
   * Initialize real-time connection
   */
  async connect(userId: string): Promise<boolean> {
    this.userId = userId;
    this.connectionState = 'connecting';

    // Try WebSocket first (if available)
    if (this.config.preferWebSocket) {
      const wsConnected = await this.tryWebSocketConnection();
      if (wsConnected) {
        return true;
      }
    }

    // Fallback to optimized polling
    this.startOptimizedPolling();
    return true;
  }

  /**
   * Attempt WebSocket connection
   */
  private async tryWebSocketConnection(): Promise<boolean> {
    try {
      const wsUrl = this.getWebSocketUrl();
      this.ws = new WebSocket(wsUrl);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.ws?.close();
          resolve(false);
        }, 5000);

        this.ws!.onopen = () => {
          clearTimeout(timeout);
          this.connectionState = 'connected';
          this.setupWebSocketHandlers();
          this.startHeartbeat();
          console.log('🟢 WebSocket connection established');
          resolve(true);
        };

        this.ws!.onerror = () => {
          clearTimeout(timeout);
          console.log('🔴 WebSocket connection failed, falling back to polling');
          resolve(false);
        };
      });
    } catch (error) {
      console.log('🔴 WebSocket not available, using polling');
      return false;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const message: RealtimeMessage = JSON.parse(event.data);
        this.handleRealtimeMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('🔴 WebSocket connection closed, switching to polling');
      this.connectionState = 'polling';
      this.startOptimizedPolling();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  /**
   * Start optimized polling with smart intervals
   */
  private startOptimizedPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.connectionState = 'polling';
    console.log('🔄 Starting optimized polling');

    // Adaptive polling interval based on activity
    let currentInterval = this.config.pollingInterval;
    let consecutiveEmptyPolls = 0;

    const poll = async () => {
      try {
        const updates = await this.fetchRealtimeUpdates();
        
        if (updates && updates.length > 0) {
          consecutiveEmptyPolls = 0;
          currentInterval = Math.max(2000, this.config.pollingInterval / 2); // Increase frequency on activity
          
          updates.forEach(message => this.handleRealtimeMessage(message));
        } else {
          consecutiveEmptyPolls++;
          
          // Decrease polling frequency if no activity
          if (consecutiveEmptyPolls > 3) {
            currentInterval = Math.min(30000, this.config.pollingInterval * 2);
          }
        }

        // Schedule next poll
        this.pollingInterval = setTimeout(poll, currentInterval) as any;
      } catch (error) {
        console.error('Polling error:', error);
        // Retry with backoff
        this.pollingInterval = setTimeout(poll, Math.min(60000, currentInterval * 2)) as any;
      }
    };

    // Start polling
    poll();
  }

  /**
   * Fetch real-time updates via HTTP polling
   */
  private async fetchRealtimeUpdates(): Promise<RealtimeMessage[]> {
    const url = `/api/poll/updates`;
    const params = new URLSearchParams();
    
    if (this.lastMessageId) {
      params.append('since', this.lastMessageId);
    }
    params.append('userId', this.userId || '');

    const response = await fetch(`${url}?${params}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Polling failed: ${response.status}`);
    }

    const data = await response.json();
    const messages = data.messages || [];
    
    // Update last message ID for next poll
    if (messages.length > 0) {
      this.lastMessageId = messages[messages.length - 1].id;
    }

    return messages;
  }

  /**
   * Handle incoming real-time message
   */
  private handleRealtimeMessage(message: RealtimeMessage): void {
    // Emit to subscribers based on message type
    const typeSubscribers = this.subscribers.get(message.type);
    if (typeSubscribers) {
      typeSubscribers.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Subscriber error:', error);
        }
      });
    }

    // Emit to all subscribers
    const allSubscribers = this.subscribers.get('*');
    if (allSubscribers) {
      allSubscribers.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Subscriber error:', error);
        }
      });
    }
  }

  /**
   * Send message via WebSocket or queue for next poll
   */
  async sendMessage(message: Omit<RealtimeMessage, 'timestamp'>): Promise<boolean> {
    const fullMessage: RealtimeMessage = {
      ...message,
      timestamp: new Date().toISOString(),
      userId: this.userId || undefined
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(fullMessage));
        return true;
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        return false;
      }
    } else {
      // Queue for HTTP send on next poll or immediate HTTP send
      return this.sendViaHTTP(fullMessage);
    }
  }

  /**
   * Send message via HTTP
   */
  private async sendViaHTTP(message: RealtimeMessage): Promise<boolean> {
    try {
      const response = await fetch('/api/realtime/send', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message)
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send HTTP message:', error);
      return false;
    }
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(messageType: string, callback: (message: RealtimeMessage) => void): () => void {
    if (!this.subscribers.has(messageType)) {
      this.subscribers.set(messageType, new Set());
    }

    this.subscribers.get(messageType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(messageType)?.delete(callback);
    };
  }

  /**
   * Subscribe to all messages
   */
  subscribeAll(callback: (message: RealtimeMessage) => void): () => void {
    return this.subscribe('*', callback);
  }

  /**
   * Start heartbeat for WebSocket
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, this.config.heartbeatInterval) as any;
  }

  /**
   * Get WebSocket URL
   */
  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws?userId=${this.userId}`;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    console.log('🔌 Disconnecting real-time service');
    
    this.connectionState = 'disconnected';
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.subscribers.clear();
    this.messageQueue = [];
    this.userId = null;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): string {
    return this.connectionState;
  }

  /**
   * Get connection info for debugging
   */
  getConnectionInfo(): object {
    return {
      state: this.connectionState,
      hasWebSocket: !!this.ws,
      wsReadyState: this.ws?.readyState,
      subscriberCount: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
      queuedMessages: this.messageQueue.length,
      lastMessageId: this.lastMessageId,
      userId: this.userId
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RealtimeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart polling if interval changed and we're currently polling
    if (newConfig.pollingInterval && this.connectionState === 'polling') {
      this.startOptimizedPolling();
    }
  }

  /**
   * Force reconnection
   */
  async reconnect(): Promise<boolean> {
    this.disconnect();
    if (this.userId) {
      return this.connect(this.userId);
    }
    return false;
  }
}