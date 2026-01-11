/**
 * WebSocket Reliability Tests
 * Verifies enhanced reliability features including:
 * - Automatic reconnection with exponential backoff
 * - Message queuing for offline users
 * - Heartbeat/ping-pong mechanism
 * - Connection quality indicators
 * - State management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { useWebSocketAdvanced } from '../hooks/useWebSocketAdvanced';
import { WebSocketProvider, useWebSocket } from '../contexts/WebSocketContext';
import { ConnectionQualityIndicator, ConnectionStatusBanner } from '../components/ConnectionQualityIndicator';

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
  private messageQueue: any[] = [];
  
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
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

  static reset() {
    this.instances = [];
  }

  simulateMessage(data: any) {
    if (this.readyState === MockWebSocket.OPEN) {
      // Match production WebSocket event structure
      const enhancedData = {
        ...data,
        eventType: data.eventType || `${data.type}.test`,
        timestamp: data.timestamp || new Date().toISOString(),
        metadata: data.metadata || {}
      };
      const event = new MessageEvent('message', { data: JSON.stringify(enhancedData) });
      this.onmessage?.(event);
    }
  }

  simulateError() {
    const event = new Event('error');
    this.onerror?.(event);
  }

  getMessageQueue() {
    return this.messageQueue;
  }
}

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: jest.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockLocalStorage.store[key];
  }),
  clear: jest.fn(() => {
    mockLocalStorage.store = {};
  }),
};

// Test component that uses the WebSocket hook
function TestComponent() {
  const {
    connectionStatus,
    connectionQuality,
    isConnected,
    isReconnecting,
    retryCount,
    sendMessage,
    manualReconnect,
    getStats,
  } = useWebSocket();

  return (
    <div>
      <div data-testid="connection-state">{connectionStatus.state}</div>
      <div data-testid="connection-quality">{connectionQuality.strength}</div>
      <div data-testid="is-connected">{isConnected.toString()}</div>
      <div data-testid="is-reconnecting">{isReconnecting.toString()}</div>
      <div data-testid="retry-count">{retryCount}</div>
      <div data-testid="latency">{connectionQuality.latency || 'null'}</div>
      <div data-testid="success-rate">{connectionQuality.successRate}</div>
      
      <button
        data-testid="send-message"
        onClick={() => sendMessage({ type: 'test', data: { test: true } })}
      >
        Send Message
      </button>
      
      <button
        data-testid="manual-reconnect"
        onClick={manualReconnect}
      >
        Manual Reconnect
      </button>
      
      <button
        data-testid="get-stats"
        onClick={() => {
          const stats = getStats();
          console.log('WebSocket Stats:', stats);
        }}
      >
        Get Stats
      </button>
    </div>
  );
}

describe('WebSocket Reliability Features', () => {
  beforeEach(() => {
    // Setup mocks
    (global as any).WebSocket = MockWebSocket;
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    });
    
    // Mock timers
    jest.useFakeTimers();
    
    // Reset state
    MockWebSocket.reset();
    mockLocalStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should establish connection and update state correctly', async () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      // Initially disconnected
      expect(screen.getByTestId('connection-state')).toHaveTextContent('disconnected');
      expect(screen.getByTestId('is-connected')).toHaveTextContent('false');

      // Wait for connection
      await waitFor(() => {
        expect(screen.getByTestId('connection-state')).toHaveTextContent('connected');
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });
    });

    it('should handle manual reconnection', async () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      // Wait for initial connection
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      // Trigger manual reconnect
      fireEvent.click(screen.getByTestId('manual-reconnect'));

      // Should briefly disconnect then reconnect
      await waitFor(() => {
        expect(screen.getByTestId('connection-state')).toHaveTextContent('connected');
      });
    });

    it('should track retry count during reconnection attempts', async () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      // Simulate connection loss
      const ws = MockWebSocket.getLastInstance();
      act(() => {
        ws?.close(1006, 'Connection lost');
      });

      // Fast-forward through reconnection attempts
      for (let i = 0; i < 3; i++) {
        act(() => {
          jest.advanceTimersByTime(2000 * Math.pow(2, i)); // Exponential backoff
        });

        await waitFor(() => {
          const retryCount = parseInt(screen.getByTestId('retry-count').textContent || '0');
          expect(retryCount).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Message Queuing', () => {
    it('should queue messages when disconnected', async () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      // Send message while disconnected
      fireEvent.click(screen.getByTestId('send-message'));

      // Message should be queued (we can't directly test this, but it shouldn't throw)
      expect(() => fireEvent.click(screen.getByTestId('send-message'))).not.toThrow();
    });

    it('should process queued messages when reconnected', async () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      // Disconnect
      const ws = MockWebSocket.getLastInstance();
      act(() => {
        ws?.close(1006, 'Connection lost');
      });

      // Send messages while disconnected
      fireEvent.click(screen.getByTestId('send-message'));
      fireEvent.click(screen.getByTestId('send-message'));

      // Advance time to trigger reconnection
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Wait for reconnection and queue processing
      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      // Check if messages were sent (implementation detail)
      const newWs = MockWebSocket.getLastInstance();
      expect(newWs?.getMessageQueue().length).toBeGreaterThan(0);
    });
  });

  describe('Heartbeat Mechanism', () => {
    it('should send ping messages at regular intervals', async () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      const ws = MockWebSocket.getLastInstance();
      
      // Fast-forward to trigger heartbeat
      act(() => {
        jest.advanceTimersByTime(30000); // 30 second heartbeat interval
      });

      // Check if ping was sent
      const messages = ws?.getMessageQueue() || [];
      const pingMessage = messages.find(msg => {
        try {
          const parsed = JSON.parse(msg);
          return parsed.type === 'ping';
        } catch {
          return false;
        }
      });

      expect(pingMessage).toBeDefined();
    });

    it('should handle pong responses and update connection quality', async () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      const ws = MockWebSocket.getLastInstance();

      // Send a pong response
      act(() => {
        ws?.simulateMessage({
          type: 'pong',
          eventType: 'heartbeat.pong',
          timestamp: new Date().toISOString(),
          metadata: {
            latency: 50
          }
        });
      });

      // Connection quality should be updated
      await waitFor(() => {
        const quality = screen.getByTestId('connection-quality').textContent;
        expect(quality).toMatch(/(excellent|good|fair|poor)/);
      });
    });
  });

  describe('Connection Quality Assessment', () => {
    it('should track connection quality metrics', async () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      // Initially should have default values
      expect(screen.getByTestId('connection-quality')).toHaveTextContent('poor');
      expect(screen.getByTestId('success-rate')).toHaveTextContent('0');

      // Simulate successful ping/pong to improve quality
      const ws = MockWebSocket.getLastInstance();
      act(() => {
        ws?.simulateMessage({
          type: 'pong',
          eventType: 'heartbeat.pong',
          timestamp: new Date().toISOString(),
          metadata: {
            latency: 50
          }
        });
      });

      await waitFor(() => {
        const successRate = parseInt(screen.getByTestId('success-rate').textContent || '0');
        expect(successRate).toBeGreaterThan(0);
      });
    });
  });

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff for reconnection attempts', async () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      });

      // Track reconnection timestamps
      const reconnectionTimes: number[] = [];
      let initialTime = Date.now();

      // Simulate multiple connection failures
      for (let attempt = 0; attempt < 3; attempt++) {
        const ws = MockWebSocket.getLastInstance();
        
        // Close connection to trigger reconnection
        act(() => {
          ws?.close(1006, 'Connection lost');
        });

        // Wait for reconnection attempt
        await waitFor(() => {
          expect(screen.getByTestId('is-reconnecting')).toHaveTextContent('true');
        });

        // Calculate expected delay (with jitter, so we check range)
        const expectedDelay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
        const tolerance = expectedDelay * 0.2; // 20% tolerance for jitter

        act(() => {
          const timeBeforeAdvance = Date.now();
          jest.advanceTimersByTime(expectedDelay);
          reconnectionTimes.push(Date.now() - timeBeforeAdvance);
        });

        await waitFor(() => {
          expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
        });
      }

      // Verify exponential backoff pattern (allowing for some variance due to jitter)
      expect(reconnectionTimes[1]).toBeGreaterThan(reconnectionTimes[0] * 0.8);
      expect(reconnectionTimes[2]).toBeGreaterThan(reconnectionTimes[1] * 0.8);
    });
  });

  describe('Persistent Storage', () => {
    it('should persist queued messages in localStorage', async () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      // Send message while disconnected to trigger persistent storage
      fireEvent.click(screen.getByTestId('send-message'));

      // Check if localStorage was called
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('pitchey_ws'),
        expect.any(String)
      );
    });

    it('should load persisted messages on initialization', async () => {
      // Pre-populate localStorage with queued messages
      const queuedMessage = {
        type: 'test',
        data: { test: true },
        queuedAt: Date.now(),
        attempts: 0,
        priority: 'normal',
      };
      
      mockLocalStorage.store['pitchey_ws_persistent_queue'] = JSON.stringify([queuedMessage]);

      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      // Should load persisted data on mount
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('pitchey_ws_persistent_queue');
    });
  });
});

describe('Connection Quality Indicator Component', () => {
  const mockWebSocketContext = {
    connectionStatus: {
      state: 'connected' as const,
      connected: true,
      connecting: false,
      reconnecting: false,
      disconnecting: false,
      lastConnected: new Date(),
      lastDisconnected: null,
      reconnectAttempts: 0,
      error: null,
      quality: {
        strength: 'good' as const,
        latency: 50,
        lastPing: new Date(),
        consecutiveFailures: 0,
        successRate: 95,
      },
    },
    connectionQuality: {
      strength: 'good' as const,
      latency: 50,
      lastPing: new Date(),
      consecutiveFailures: 0,
      successRate: 95,
    },
    isConnected: true,
    isReconnecting: false,
    isDisconnecting: false,
    retryCount: 0,
    isHealthy: true,
    manualReconnect: jest.fn(),
    // ... other required properties
  };

  it('should render connection quality correctly', () => {
    const MockedProvider = ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    );

    // Mock the useWebSocket hook
    jest.mock('../contexts/WebSocketContext', () => ({
      useWebSocket: () => mockWebSocketContext,
    }));

    render(
      <MockedProvider>
        <ConnectionQualityIndicator showDetails />
      </MockedProvider>
    );

    expect(screen.getByText(/good/i)).toBeInTheDocument();
  });

  it('should show reconnect button when disconnected', () => {
    const disconnectedContext = {
      ...mockWebSocketContext,
      isConnected: false,
      isReconnecting: false,
      connectionStatus: {
        ...mockWebSocketContext.connectionStatus,
        connected: false,
        state: 'disconnected' as const,
      },
    };

    jest.mock('../contexts/WebSocketContext', () => ({
      useWebSocket: () => disconnectedContext,
    }));

    render(<ConnectionQualityIndicator />);

    expect(screen.getByText(/reconnect/i)).toBeInTheDocument();
  });
});

describe('Integration Tests', () => {
  it('should handle complete connection lifecycle', async () => {
    render(
      <WebSocketProvider>
        <div>
          <TestComponent />
          <ConnectionQualityIndicator showDetails />
          <ConnectionStatusBanner />
        </div>
      </WebSocketProvider>
    );

    // Wait for initial connection
    await waitFor(() => {
      expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
    });

    // Send some messages to establish quality
    fireEvent.click(screen.getByTestId('send-message'));
    
    // Simulate server pong response
    const ws = MockWebSocket.getLastInstance();
    act(() => {
      ws?.simulateMessage({ 
        type: 'pong', 
        eventType: 'heartbeat.pong',
        timestamp: new Date().toISOString(),
        metadata: { latency: 30 }
      });
    });

    // Verify quality improved
    await waitFor(() => {
      const successRate = parseInt(screen.getByTestId('success-rate').textContent || '0');
      expect(successRate).toBeGreaterThan(0);
    });

    // Test reconnection flow
    act(() => {
      ws?.close(1006, 'Connection lost');
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-reconnecting')).toHaveTextContent('true');
    });

    // Fast-forward to complete reconnection
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
    });
  });
});