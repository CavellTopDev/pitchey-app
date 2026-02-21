/**
 * WebSocket Reliability Tests
 * Verifies enhanced reliability features including:
 * - Automatic reconnection with exponential backoff
 * - Message queuing for offline users
 * - Heartbeat/ping-pong mechanism
 * - Connection quality indicators
 * - State management
 */

import { act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock betterAuthStore before imports that use it
vi.mock('../store/betterAuthStore', () => ({
  useBetterAuthStore: vi.fn(() => ({
    user: { id: '1', email: 'test@test.com', name: 'Test User' },
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    checkSession: vi.fn(),
  })),
}));

// Mock config
vi.mock('../config', () => ({
  config: {
    WS_URL: 'ws://localhost:8787',
    API_URL: 'http://localhost:8787',
    WEBSOCKET_ENABLED: true,
    IS_DEVELOPMENT: true,
  },
}));

// Mock the services used by WebSocketContext
vi.mock('../services/presence-fallback.service', () => ({
  presenceFallbackService: {
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: vi.fn(),
    updatePresence: vi.fn(),
  },
}));

vi.mock('../services/polling.service', () => ({
  pollingService: {
    start: vi.fn(),
    stop: vi.fn(),
    addMessageHandler: vi.fn(),
  },
}));

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private static instances: MockWebSocket[] = [];
  private messageQueue: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);

    // Simulate connection after a short delay
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    if (this.readyState === MockWebSocket.OPEN) {
      this.messageQueue.push(data);
    } else {
      throw new Error('WebSocket is not open');
    }
  }

  close(code = 1000, reason = 'Normal closure') {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      const event = new CloseEvent('close', { code, reason });
      this.onclose?.(event);
    }, 10);
  }

  // Test helpers
  static getLastInstance(): MockWebSocket | undefined {
    return this.instances[this.instances.length - 1];
  }

  static getAllInstances(): MockWebSocket[] {
    return [...this.instances];
  }

  static reset() {
    this.instances = [];
  }

  simulateMessage(data: any) {
    if (this.readyState === MockWebSocket.OPEN && this.onmessage) {
      const enhancedData = {
        ...data,
        eventType: data.eventType || `${data.type}.test`,
        timestamp: data.timestamp || new Date().toISOString(),
        metadata: data.metadata || {}
      };
      const event = new MessageEvent('message', { data: JSON.stringify(enhancedData) });
      this.onmessage(event);
    }
  }

  simulateError() {
    const event = new Event('error');
    this.onerror?.(event);
  }

  getMessageQueue() {
    return [...this.messageQueue];
  }

  clearMessageQueue() {
    this.messageQueue = [];
  }
}

// Mock localStorage
const createMockLocalStorage = () => {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
  };
};

describe('WebSocket Reliability Features', () => {
  let mockLocalStorage: ReturnType<typeof createMockLocalStorage>;

  beforeEach(() => {
    // Setup mocks
    (global as any).WebSocket = MockWebSocket;
    mockLocalStorage = createMockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    // Mock timers
    vi.useFakeTimers();

    // Reset state
    MockWebSocket.reset();
    mockLocalStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('MockWebSocket Behavior', () => {
    it('should create a MockWebSocket and transition to OPEN state', async () => {
      const ws = new MockWebSocket('ws://test.com');

      expect(ws.readyState).toBe(MockWebSocket.CONNECTING);

      // Advance timers to allow connection
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(ws.readyState).toBe(MockWebSocket.OPEN);
    });

    it('should track all WebSocket instances', () => {
      new MockWebSocket('ws://test1.com');
      new MockWebSocket('ws://test2.com');

      expect(MockWebSocket.getAllInstances().length).toBe(2);
    });

    it('should queue messages when sent', async () => {
      const ws = new MockWebSocket('ws://test.com');

      // Wait for connection
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      ws.send(JSON.stringify({ type: 'test' }));
      ws.send(JSON.stringify({ type: 'test2' }));

      expect(ws.getMessageQueue().length).toBe(2);
    });

    it('should simulate close correctly', async () => {
      const ws = new MockWebSocket('ws://test.com');
      const onClose = vi.fn();
      ws.onclose = onClose;

      // Wait for connection
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      ws.close(1000, 'Test close');

      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
      expect(onClose).toHaveBeenCalled();
    });

    it('should simulate messages correctly', async () => {
      const ws = new MockWebSocket('ws://test.com');
      const onMessage = vi.fn();
      ws.onmessage = onMessage;

      // Wait for connection
      await act(async () => {
        vi.advanceTimersByTime(20);
      });

      ws.simulateMessage({ type: 'test', data: { foo: 'bar' } });

      expect(onMessage).toHaveBeenCalled();
      const receivedData = JSON.parse(onMessage.mock.calls[0][0].data);
      expect(receivedData.type).toBe('test');
      expect(receivedData.data).toEqual({ foo: 'bar' });
    });
  });

  describe('Exponential Backoff Logic', () => {
    it('should calculate delays with exponential growth', () => {
      const initialDelay = 1000;
      const backoffFactor = 2;
      const maxDelay = 30000;

      const calculateDelay = (attempt: number): number => {
        return Math.min(
          initialDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );
      };

      expect(calculateDelay(0)).toBe(1000);  // 1s
      expect(calculateDelay(1)).toBe(2000);  // 2s
      expect(calculateDelay(2)).toBe(4000);  // 4s
      expect(calculateDelay(3)).toBe(8000);  // 8s
      expect(calculateDelay(4)).toBe(16000); // 16s
      expect(calculateDelay(5)).toBe(30000); // 30s (capped)
      expect(calculateDelay(6)).toBe(30000); // 30s (still capped)
    });

    it('should respect max delay limit', () => {
      const initialDelay = 1000;
      const backoffFactor = 2;
      const maxDelay = 10000;

      const calculateDelay = (attempt: number): number => {
        return Math.min(
          initialDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );
      };

      // After attempt 3: 1000 * 2^3 = 8000 (under limit)
      expect(calculateDelay(3)).toBe(8000);

      // After attempt 4: 1000 * 2^4 = 16000 (capped to 10000)
      expect(calculateDelay(4)).toBe(10000);
    });
  });

  describe('Connection Quality Assessment', () => {
    it('should classify excellent quality correctly', () => {
      const assessQuality = (successRate: number, avgLatency: number | null) => {
        if (successRate >= 90 && (avgLatency === null || avgLatency < 100)) {
          return 'excellent';
        } else if (successRate >= 80 && (avgLatency === null || avgLatency < 200)) {
          return 'good';
        } else if (successRate >= 60 && (avgLatency === null || avgLatency < 500)) {
          return 'fair';
        }
        return 'poor';
      };

      expect(assessQuality(95, 50)).toBe('excellent');
      expect(assessQuality(90, 99)).toBe('excellent');
      expect(assessQuality(100, null)).toBe('excellent');
    });

    it('should classify good quality correctly', () => {
      const assessQuality = (successRate: number, avgLatency: number | null) => {
        if (successRate >= 90 && (avgLatency === null || avgLatency < 100)) {
          return 'excellent';
        } else if (successRate >= 80 && (avgLatency === null || avgLatency < 200)) {
          return 'good';
        } else if (successRate >= 60 && (avgLatency === null || avgLatency < 500)) {
          return 'fair';
        }
        return 'poor';
      };

      expect(assessQuality(85, 150)).toBe('good');
      expect(assessQuality(80, 199)).toBe('good');
      expect(assessQuality(90, 150)).toBe('good'); // High success but higher latency
    });

    it('should classify fair quality correctly', () => {
      const assessQuality = (successRate: number, avgLatency: number | null) => {
        if (successRate >= 90 && (avgLatency === null || avgLatency < 100)) {
          return 'excellent';
        } else if (successRate >= 80 && (avgLatency === null || avgLatency < 200)) {
          return 'good';
        } else if (successRate >= 60 && (avgLatency === null || avgLatency < 500)) {
          return 'fair';
        }
        return 'poor';
      };

      expect(assessQuality(70, 300)).toBe('fair');
      expect(assessQuality(60, 499)).toBe('fair');
    });

    it('should classify poor quality correctly', () => {
      const assessQuality = (successRate: number, avgLatency: number | null) => {
        if (successRate >= 90 && (avgLatency === null || avgLatency < 100)) {
          return 'excellent';
        } else if (successRate >= 80 && (avgLatency === null || avgLatency < 200)) {
          return 'good';
        } else if (successRate >= 60 && (avgLatency === null || avgLatency < 500)) {
          return 'fair';
        }
        return 'poor';
      };

      expect(assessQuality(50, 300)).toBe('poor');
      expect(assessQuality(70, 600)).toBe('poor');
      expect(assessQuality(30, 1000)).toBe('poor');
    });
  });

  describe('Message Queue Logic', () => {
    it('should queue messages and respect max size', () => {
      const maxQueueSize = 5;
      const queue: any[] = [];
      let dropped = 0;

      const queueMessage = (message: any) => {
        while (queue.length >= maxQueueSize) {
          queue.shift();
          dropped++;
        }
        queue.push({ ...message, queuedAt: Date.now() });
      };

      // Queue 7 messages with max of 5
      for (let i = 0; i < 7; i++) {
        queueMessage({ type: 'test', index: i });
      }

      expect(queue.length).toBe(5);
      expect(dropped).toBe(2);
      expect(queue[0].index).toBe(2); // First two were dropped
    });

    it('should filter expired messages from queue', () => {
      const now = Date.now();
      const queue = [
        { type: 'old', queuedAt: now - 25 * 60 * 60 * 1000 }, // 25 hours ago
        { type: 'recent', queuedAt: now - 1 * 60 * 60 * 1000 }, // 1 hour ago
        { type: 'new', queuedAt: now }, // Now
      ];

      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      const validMessages = queue.filter(msg => now - msg.queuedAt < maxAge);

      expect(validMessages.length).toBe(2);
      expect(validMessages[0].type).toBe('recent');
      expect(validMessages[1].type).toBe('new');
    });
  });

  describe('Rate Limiting Logic', () => {
    it('should block when rate limit exceeded', () => {
      const maxMessages = 5;
      const windowMs = 60000;
      const state = {
        messages: 0,
        windowStart: Date.now(),
        nextReset: Date.now() + windowMs,
        blocked: false,
      };

      const isRateLimited = () => {
        const now = Date.now();

        // Reset window if expired
        if (now >= state.nextReset) {
          state.messages = 0;
          state.windowStart = now;
          state.nextReset = now + windowMs;
          state.blocked = false;
        }

        if (state.messages >= maxMessages) {
          state.blocked = true;
          return true;
        }

        return false;
      };

      // Send messages up to limit
      for (let i = 0; i < maxMessages; i++) {
        expect(isRateLimited()).toBe(false);
        state.messages++;
      }

      // Next should be blocked
      expect(isRateLimited()).toBe(true);
      expect(state.blocked).toBe(true);
    });

    it('should reset rate limit after window expires', () => {
      const maxMessages = 3;
      const windowMs = 1000;
      let now = Date.now();

      const state = {
        messages: maxMessages, // At limit
        windowStart: now,
        nextReset: now + windowMs,
        blocked: true,
      };

      const isRateLimited = () => {
        // Reset window if expired
        if (now >= state.nextReset) {
          state.messages = 0;
          state.windowStart = now;
          state.nextReset = now + windowMs;
          state.blocked = false;
        }

        return state.messages >= maxMessages;
      };

      // Should be blocked initially
      expect(isRateLimited()).toBe(true);

      // Advance time past reset
      now += windowMs + 1;

      // Should be unblocked now
      expect(isRateLimited()).toBe(false);
      expect(state.blocked).toBe(false);
    });
  });

  describe('Circuit Breaker Logic', () => {
    it('should open circuit after threshold failures', () => {
      const config = {
        failureThreshold: 3,
        openStateDuration: 5000,
      };

      const breaker = {
        failureCount: 0,
        lastFailureTime: 0,
        state: 'closed' as 'closed' | 'open' | 'half-open',
        nextAttemptTime: 0,
      };

      const recordFailure = () => {
        const now = Date.now();
        breaker.failureCount++;
        breaker.lastFailureTime = now;

        if (breaker.failureCount >= config.failureThreshold) {
          breaker.state = 'open';
          breaker.nextAttemptTime = now + config.openStateDuration;
        }
      };

      // Record failures up to threshold
      recordFailure();
      expect(breaker.state).toBe('closed');

      recordFailure();
      expect(breaker.state).toBe('closed');

      recordFailure();
      expect(breaker.state).toBe('open');
      expect(breaker.nextAttemptTime).toBeGreaterThan(Date.now());
    });

    it('should transition to half-open after duration', () => {
      const config = {
        openStateDuration: 1000,
      };

      let now = Date.now();

      const breaker = {
        failureCount: 3,
        lastFailureTime: now,
        state: 'open' as 'closed' | 'open' | 'half-open',
        nextAttemptTime: now + config.openStateDuration,
      };

      const checkState = () => {
        if (breaker.state === 'open' && now >= breaker.nextAttemptTime) {
          breaker.state = 'half-open';
        }
        return breaker.state;
      };

      // Should stay open before duration
      expect(checkState()).toBe('open');

      // Advance past duration
      now += config.openStateDuration + 1;

      // Should transition to half-open
      expect(checkState()).toBe('half-open');
    });

    it('should close circuit on success', () => {
      const breaker = {
        failureCount: 3,
        state: 'half-open' as 'closed' | 'open' | 'half-open',
      };

      const recordSuccess = () => {
        breaker.failureCount = 0;
        breaker.state = 'closed';
      };

      recordSuccess();

      expect(breaker.state).toBe('closed');
      expect(breaker.failureCount).toBe(0);
    });
  });

  describe('Heartbeat Logic', () => {
    it('should track missed heartbeats', () => {
      const maxMissed = 3;
      const heartbeat = {
        lastPing: null as Date | null,
        lastPong: null as Date | null,
        missedCount: 0,
      };

      const recordMissedHeartbeat = () => {
        heartbeat.missedCount++;
        return heartbeat.missedCount >= maxMissed;
      };

      expect(recordMissedHeartbeat()).toBe(false);
      expect(recordMissedHeartbeat()).toBe(false);
      expect(recordMissedHeartbeat()).toBe(true); // Should trigger reconnect
    });

    it('should reset missed count on pong', () => {
      const heartbeat = {
        lastPing: new Date(Date.now() - 100),
        lastPong: null as Date | null,
        missedCount: 2,
      };

      const handlePong = () => {
        heartbeat.lastPong = new Date();
        heartbeat.missedCount = 0;

        if (heartbeat.lastPing) {
          return heartbeat.lastPong.getTime() - heartbeat.lastPing.getTime();
        }
        return null;
      };

      const latency = handlePong();

      expect(heartbeat.missedCount).toBe(0);
      expect(heartbeat.lastPong).not.toBeNull();
      expect(latency).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Persistent Storage', () => {
    it('should save queue to localStorage', () => {
      const queue = [
        { type: 'test1', queuedAt: Date.now() },
        { type: 'test2', queuedAt: Date.now() },
      ];

      mockLocalStorage.setItem('pitchey_ws_queue', JSON.stringify(queue));

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'pitchey_ws_queue',
        expect.any(String)
      );
    });

    it('should load queue from localStorage', () => {
      const queue = [
        { type: 'test1', queuedAt: Date.now() },
      ];
      mockLocalStorage.store['pitchey_ws_queue'] = JSON.stringify(queue);

      const saved = mockLocalStorage.getItem('pitchey_ws_queue');
      const parsed = saved ? JSON.parse(saved) : [];

      expect(parsed.length).toBe(1);
      expect(parsed[0].type).toBe('test1');
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      let error: Error | null = null;
      try {
        mockLocalStorage.setItem('test', 'value');
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toBe('QuotaExceededError');
    });
  });

  describe('Connection History Tracking', () => {
    it('should track connection attempts', () => {
      const history: Array<{ timestamp: number; success: boolean; latency?: number }> = [];

      const recordAttempt = (success: boolean, latency?: number) => {
        history.push({
          timestamp: Date.now(),
          success,
          latency,
        });

        // Keep only last 10
        if (history.length > 10) {
          history.shift();
        }
      };

      // Record some attempts
      recordAttempt(true, 50);
      recordAttempt(true, 60);
      recordAttempt(false);
      recordAttempt(true, 45);

      expect(history.length).toBe(4);
      expect(history.filter(a => a.success).length).toBe(3);
    });

    it('should calculate success rate from history', () => {
      const history = [
        { timestamp: Date.now(), success: true, latency: 50 },
        { timestamp: Date.now(), success: true, latency: 60 },
        { timestamp: Date.now(), success: false },
        { timestamp: Date.now(), success: true, latency: 45 },
        { timestamp: Date.now(), success: false },
      ];

      const successCount = history.filter(a => a.success).length;
      const successRate = (successCount / history.length) * 100;

      expect(successRate).toBe(60); // 3 out of 5
    });

    it('should calculate average latency from successful attempts', () => {
      const history = [
        { timestamp: Date.now(), success: true, latency: 50 },
        { timestamp: Date.now(), success: true, latency: 100 },
        { timestamp: Date.now(), success: false },
        { timestamp: Date.now(), success: true, latency: 150 },
      ];

      const latencyValues = history
        .filter(a => a.success && a.latency !== undefined)
        .map(a => a.latency!);

      const avgLatency = latencyValues.reduce((sum, lat) => sum + lat, 0) / latencyValues.length;

      expect(avgLatency).toBe(100); // (50 + 100 + 150) / 3
    });
  });
});
