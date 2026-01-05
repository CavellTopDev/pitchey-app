import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '../config';
import type { WebSocketMessage, ConnectionStatus, MessageQueueStatus } from '../types/websocket';

interface UseWebSocketAdvancedOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onReconnect?: (attempt: number) => void;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  maxQueueSize?: number;
  enablePersistence?: boolean;
  rateLimit?: {
    maxMessages: number;
    windowMs: number;
  };
}

interface QueuedMessage extends WebSocketMessage {
  queuedAt: number;
  attempts: number;
  retryAfter?: number;
}

interface RateLimitState {
  messages: number;
  windowStart: number;
  blocked: boolean;
  nextReset: number;
}

const DEFAULT_OPTIONS: Required<UseWebSocketAdvancedOptions> = {
  onMessage: () => {},
  onConnect: () => {},
  onDisconnect: () => {},
  onError: () => {},
  onReconnect: () => {},
  autoConnect: true,
  maxReconnectAttempts: 3,  // Further reduced to prevent API spam
  reconnectInterval: 5000,  // Increased initial interval
  maxReconnectInterval: 60000,  // Increased max interval (1 minute)
  maxQueueSize: 50,  // Reduced queue size
  enablePersistence: true,
  rateLimit: {
    maxMessages: 30,  // Reduced message rate
    windowMs: 60000, // 1 minute
  },
};

const STORAGE_KEYS = {
  QUEUE: 'pitchey_ws_queue',
  RATE_LIMIT: 'pitchey_ws_ratelimit',
  CIRCUIT_BREAKER: 'pitchey_ws_circuit_breaker',
};

interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttemptTime: number;
}

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3,  // Open circuit after 3 consecutive failures
  openStateDuration: 300000,  // Stay open for 5 minutes
  halfOpenMaxAttempts: 1,  // Only 1 attempt in half-open state
};

// CRITICAL: Disable WebSocket on Cloudflare free tier - use polling instead
const WEBSOCKET_ENABLED = false;

export function useWebSocketAdvanced(options: UseWebSocketAdvancedOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // State
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
    reconnecting: false,
    lastConnected: null,
    reconnectAttempts: 0,
    error: null,
  });
  
  const [queueStatus, setQueueStatus] = useState<MessageQueueStatus>({
    queued: 0,
    maxQueue: opts.maxQueueSize,
    dropped: 0,
    rateLimited: 0,
  });
  
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const rateLimitRef = useRef<RateLimitState>({
    messages: 0,
    windowStart: Date.now(),
    blocked: false,
    nextReset: Date.now() + opts.rateLimit.windowMs,
  });
  const circuitBreakerRef = useRef<CircuitBreakerState>({
    failureCount: 0,
    lastFailureTime: 0,
    state: 'closed',
    nextAttemptTime: 0,
  });
  
  // Circuit breaker functions
  const checkCircuitBreakerState = useCallback(() => {
    const now = Date.now();
    const breaker = circuitBreakerRef.current;
    
    switch (breaker.state) {
      case 'open':
        if (now >= breaker.nextAttemptTime) {
          breaker.state = 'half-open';
        }
        break;
      case 'half-open':
        // Half-open state allows limited attempts
        break;
      default:
        // Closed state - normal operation
        break;
    }
    
    return breaker.state;
  }, []);
  
  const recordCircuitBreakerFailure = useCallback(() => {
    const now = Date.now();
    const breaker = circuitBreakerRef.current;
    
    breaker.failureCount++;
    breaker.lastFailureTime = now;
    
    if (breaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      breaker.state = 'open';
      breaker.nextAttemptTime = now + CIRCUIT_BREAKER_CONFIG.openStateDuration;
      console.warn(`Circuit breaker: OPENED after ${breaker.failureCount} failures. Next attempt in ${CIRCUIT_BREAKER_CONFIG.openStateDuration / 1000}s`);
      
      // Persist circuit breaker state
      if (opts.enablePersistence) {
        try {
          localStorage.setItem(STORAGE_KEYS.CIRCUIT_BREAKER, JSON.stringify(breaker));
        } catch (error) {
          console.warn('Failed to persist circuit breaker state:', error);
        }
      }
    }
  }, [opts.enablePersistence]);
  
  const recordCircuitBreakerSuccess = useCallback(() => {
    const breaker = circuitBreakerRef.current;
    breaker.failureCount = 0;
    breaker.state = 'closed';
    
    // Clear persisted circuit breaker state
    if (opts.enablePersistence) {
      try {
        localStorage.removeItem(STORAGE_KEYS.CIRCUIT_BREAKER);
      } catch (error) {
        console.warn('Failed to clear circuit breaker state:', error);
      }
    }
  }, [opts.enablePersistence]);

  // Load persisted data
  useEffect(() => {
    if (opts.enablePersistence) {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.QUEUE);
        if (saved) {
          const parsed = JSON.parse(saved);
          messageQueueRef.current = parsed.filter((msg: QueuedMessage) => 
            Date.now() - msg.queuedAt < 24 * 60 * 60 * 1000 // 24 hours max age
          );
          updateQueueStatus();
        }
        
        const rateLimitSaved = localStorage.getItem(STORAGE_KEYS.RATE_LIMIT);
        if (rateLimitSaved) {
          const parsed = JSON.parse(rateLimitSaved);
          if (Date.now() - parsed.windowStart < opts.rateLimit.windowMs) {
            rateLimitRef.current = parsed;
          }
        }
        
        const circuitBreakerSaved = localStorage.getItem(STORAGE_KEYS.CIRCUIT_BREAKER);
        if (circuitBreakerSaved) {
          const parsed = JSON.parse(circuitBreakerSaved);
          // Only restore if it's not too old
          if (Date.now() - parsed.lastFailureTime < CIRCUIT_BREAKER_CONFIG.openStateDuration * 2) {
            circuitBreakerRef.current = parsed;
          }
        }
      } catch (error) {
        console.warn('Failed to load persisted WebSocket data:', error);
      }
    }
  }, [opts.enablePersistence, opts.rateLimit.windowMs]);
  
  // Rate limiting
  const isRateLimited = useCallback(() => {
    const now = Date.now();
    const state = rateLimitRef.current;
    
    // Reset window if expired
    if (now >= state.nextReset) {
      state.messages = 0;
      state.windowStart = now;
      state.nextReset = now + opts.rateLimit.windowMs;
      state.blocked = false;
    }
    
    // Check if rate limited
    if (state.messages >= opts.rateLimit.maxMessages) {
      state.blocked = true;
      setQueueStatus(prev => ({ ...prev, rateLimited: prev.rateLimited + 1 }));
      return true;
    }
    
    return false;
  }, [opts.rateLimit]);
  
  // Update queue status
  const updateQueueStatus = useCallback(() => {
    setQueueStatus(prev => ({
      ...prev,
      queued: messageQueueRef.current.length,
    }));
  }, []);
  
  // Persist data
  const persistData = useCallback(() => {
    if (opts.enablePersistence) {
      try {
        localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(messageQueueRef.current));
        localStorage.setItem(STORAGE_KEYS.RATE_LIMIT, JSON.stringify(rateLimitRef.current));
      } catch (error) {
        console.warn('Failed to persist WebSocket data:', error);
      }
    }
  }, [opts.enablePersistence]);
  
  // Queue message
  const queueMessage = useCallback((message: WebSocketMessage) => {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random()}`,
      queuedAt: Date.now(),
      attempts: 0,
    };
    
    // Remove oldest messages if queue is full
    while (messageQueueRef.current.length >= opts.maxQueueSize) {
      messageQueueRef.current.shift();
      setQueueStatus(prev => ({ ...prev, dropped: prev.dropped + 1 }));
    }
    
    messageQueueRef.current.push(queuedMessage);
    updateQueueStatus();
    persistData();
  }, [opts.maxQueueSize, updateQueueStatus, persistData]);
  
  // Process queued messages
  const processQueue = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const now = Date.now();
    const toSend: QueuedMessage[] = [];
    const toRetry: QueuedMessage[] = [];
    
    messageQueueRef.current.forEach(message => {
      if (message.retryAfter && now < message.retryAfter) {
        toRetry.push(message);
      } else {
        toSend.push(message);
      }
    });
    
    // Send messages respecting rate limits
    let sent = 0;
    for (const message of toSend) {
      if (isRateLimited()) {
        // Add back to retry queue
        message.retryAfter = rateLimitRef.current.nextReset;
        toRetry.push(message);
        continue;
      }
      
      try {
        wsRef.current.send(JSON.stringify(message));
        rateLimitRef.current.messages++;
        sent++;
      } catch (error) {
        console.error('Failed to send queued message:', error);
        message.attempts++;
        if (message.attempts < 3) {
          message.retryAfter = now + (message.attempts * 5000); // Exponential backoff
          toRetry.push(message);
        }
      }
    }
    
    messageQueueRef.current = toRetry;
    updateQueueStatus();
    persistData();
    
    if (sent > 0) {
    }
  }, [isRateLimited, updateQueueStatus, persistData]);
  
  // Connect function with circuit breaker and bundling-loop protection
  const connect = useCallback(() => {
    // CRITICAL: WebSocket disabled on free tier - use polling instead
    if (!WEBSOCKET_ENABLED) {
      setConnectionStatus(prev => ({
        ...prev,
        connected: false,
        error: 'WebSocket disabled - using polling mode',
      }));
      return;
    }
    
    // Check circuit breaker state first
    const circuitState = checkCircuitBreakerState();
    if (circuitState === 'open') {
      const breaker = circuitBreakerRef.current;
      const waitTime = Math.ceil((breaker.nextAttemptTime - Date.now()) / 1000);
      setConnectionStatus(prev => ({
        ...prev,
        error: `Connection blocked by circuit breaker. Retry in ${waitTime}s`,
      }));
      return;
    }
    
    if (wsRef.current && 
        (wsRef.current.readyState === WebSocket.CONNECTING || 
         wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }
    
    // Prevent rapid connection attempts caused by bundling stale closures
    const lastAttempt = localStorage.getItem('pitchey_last_ws_attempt');
    const now = Date.now();
    if (lastAttempt && (now - parseInt(lastAttempt)) < 2000) { // Increased to 2 seconds
      return;
    }
    localStorage.setItem('pitchey_last_ws_attempt', now.toString());
    
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      // Don't return early - allow unauthenticated connections
    }
    
    const isDemoMode = localStorage.getItem('demoMode') === 'true';
    if (isDemoMode) {
      return;
    }
    
    // Check if WebSocket was manually disabled
    const isDisabled = localStorage.getItem('pitchey_websocket_disabled') === 'true';
    if (isDisabled) {
      return;
    }
    
    setConnectionStatus(prev => ({ 
      ...prev, 
      connecting: true, 
      error: null 
    }));
    
    try {
      const wsUrl = config.WS_URL.replace(/^http/, 'ws');
      
      // Try different authentication methods
      let finalWsUrl: string;
      const authHeaders: Record<string, string> = {};
      
      if (token) {
        // Primary method: Query parameter (most compatible)
        finalWsUrl = `${wsUrl}/ws?token=${token}`;
      } else {
        // Fallback: Connect without authentication (limited functionality)
        finalWsUrl = `${wsUrl}/ws`;
      }
      
      const ws = new WebSocket(finalWsUrl);
      
      ws.onopen = () => {
        
        // Record successful connection in circuit breaker
        recordCircuitBreakerSuccess();
        
        // If we have a token but connected without it (fallback scenario), 
        // try to authenticate via first message
        if (token && !finalWsUrl.includes('token=')) {
          try {
            ws.send(JSON.stringify({
              type: 'auth',
              token: token,
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            console.warn('WebSocket: Failed to send auth message:', error);
          }
        }
        
        setConnectionStatus(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          reconnecting: false,
          lastConnected: new Date(),
          reconnectAttempts: 0,
          error: null,
        }));
        
        opts.onConnect();
        
        // Clear reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }
        
        // Start ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
          }
        }, 30000);
        
        // Process queued messages
        setTimeout(processQueue, 1000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          opts.onMessage(message);
          
          // Handle system messages
          if (message.type === 'ping') {
            // Server sent ping, respond with pong
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            }
          } else if (message.type === 'pong') {
            // Connection health confirmed - no action needed
          } else if (message.type === 'connected') {
            // Handle connection confirmation with authentication status
          } else if (message.type === 'auth_success') {
            // Authentication via first message succeeded
          } else if (message.type === 'auth_error') {
            // Authentication via first message failed
            console.warn('WebSocket: Authentication failed', message.data || message);
          } else if (message.type === 'auth_required') {
            // Operation requires authentication
          } else if (message.type === 'error') {
            // Handle structured error messages
            const errorMsg = message.data?.error || message.data?.message || message.data || 'Unknown error';
            const errorCode = message.data?.code;
            const errorCategory = message.data?.category || 'unknown';
            const errorSeverity = message.data?.severity || 2; // Default to medium severity
            
            // Don't show analytics/tracking errors to user
            if (typeof errorMsg === 'string' && (
                errorMsg.toLowerCase().includes('analytics') || 
                errorMsg.toLowerCase().includes('tracking') ||
                errorMsg.toLowerCase().includes('analytics_events'))) {
              return; // Silently ignore analytics errors
            }
            
            // Only log errors in development or if they're not low-severity
            if (config.IS_DEVELOPMENT || errorSeverity > 1) {
              console.error('WebSocket server error:', {
                message: errorMsg,
                code: errorCode,
                category: errorCategory,
                recoverable: message.data?.recoverable,
                retryAfter: message.data?.retryAfter
              });
            }
            
            // Handle specific error types
            if (errorCode === 2001 || errorCode === 2002) { // Auth token invalid/expired
              // Clear token and redirect to login
              localStorage.removeItem('authToken');
              if (window.location.pathname !== '/login') {
                window.location.href = '/login';
              }
            }
            
            // Update connection status with error info
            setConnectionStatus(prev => ({
              ...prev,
              error: errorMsg
            }));
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onclose = (event) => {
        setConnectionStatus(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: event.reason || `Connection closed (${event.code})`,
        }));
        
        wsRef.current = null;
        opts.onDisconnect();
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = undefined;
        }
        
        // Attempt reconnect if not a clean close or auth failure
        // Auth failure codes: 1008 (Policy Violation), 4001-4003 (Custom auth errors)
        const isAuthFailure = event.code === 1008 || (event.code >= 4001 && event.code <= 4003);
        const isCleanClose = event.code === 1000 || event.code === 1001;
        
        // Record failure in circuit breaker for unexpected disconnections
        if (!isCleanClose && !isAuthFailure) {
          recordCircuitBreakerFailure();
        }
        
        // Check circuit breaker before attempting reconnection
        const circuitState = checkCircuitBreakerState();
        if (circuitState === 'open') {
          setConnectionStatus(prev => ({
            ...prev,
            reconnecting: false,
            error: 'Connection attempts blocked by circuit breaker. Will retry automatically.',
          }));
          return;
        }
        
        if (!isCleanClose && !isAuthFailure &&
            connectionStatus.reconnectAttempts < opts.maxReconnectAttempts) {
          
          const attempt = connectionStatus.reconnectAttempts + 1;
          const delay = Math.min(
            opts.reconnectInterval * Math.pow(2, attempt - 1),
            opts.maxReconnectInterval
          );
          
          setConnectionStatus(prev => ({
            ...prev,
            reconnecting: true,
            reconnectAttempts: attempt,
          }));
          
          
          reconnectTimeoutRef.current = setTimeout(() => {
            opts.onReconnect(attempt);
            connect();
          }, delay);
        } else if (isAuthFailure) {
          // Authentication failed - don't retry, provide clear feedback
          console.warn(`WebSocket authentication failed (code: ${event.code}): ${event.reason}`);
          setConnectionStatus(prev => ({
            ...prev,
            reconnecting: false,
            error: `Authentication failed: ${event.reason || 'Invalid or expired token'}. Please log in again.`,
          }));
          
          // Clear invalid token if authentication failed
          if (event.reason && event.reason.toLowerCase().includes('token')) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userType');
          }
        } else if (connectionStatus.reconnectAttempts >= opts.maxReconnectAttempts) {
          // Max attempts reached - stop trying and show user-friendly message
          console.error(`WebSocket connection failed after ${opts.maxReconnectAttempts} attempts. Real-time features disabled.`);
          setConnectionStatus(prev => ({
            ...prev,
            reconnecting: false,
            error: 'Connection failed after multiple attempts. Real-time features temporarily unavailable.',
          }));
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error occurred:', {
          readyState: ws.readyState,
          url: ws.url,
          error: error
        });
        
        // Record failure in circuit breaker for connection errors
        if (ws.readyState === WebSocket.CONNECTING) {
          recordCircuitBreakerFailure();
        }
        
        // Don't immediately set error state - let onclose handle reconnection logic
        // This prevents error loops when the server is unreachable
        if (ws.readyState === WebSocket.CONNECTING) {
        }
        
        opts.onError(error);
      };
      
      wsRef.current = ws;
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus(prev => ({
        ...prev,
        connecting: false,
        error: 'Failed to create connection',
      }));
    }
  }, [opts, connectionStatus.reconnectAttempts, processQueue, checkCircuitBreakerState, recordCircuitBreakerSuccess, recordCircuitBreakerFailure]);
  
  // Disconnect function
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnecting');
      wsRef.current = null;
    }
    
    setConnectionStatus(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      reconnecting: false,
      reconnectAttempts: 0,
    }));
  }, []);
  
  // Send message function
  const sendMessage = useCallback((message: WebSocketMessage) => {
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    
    // Check rate limiting
    if (isRateLimited()) {
      console.warn('Message rate limited, queuing for later');
      queueMessage(message);
      return false;
    }
    
    // Try to send immediately if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        rateLimitRef.current.messages++;
        persistData();
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        queueMessage(message);
        return false;
      }
    } else {
      // Queue for later if not connected
      queueMessage(message);
      
      // Try to reconnect if not already connecting
      if (!connectionStatus.connecting && !connectionStatus.reconnecting) {
        connect();
      }
      
      return false;
    }
  }, [isRateLimited, queueMessage, persistData, connectionStatus, connect]);
  
  // Clear queue function
  const clearQueue = useCallback(() => {
    messageQueueRef.current = [];
    updateQueueStatus();
    persistData();
  }, [updateQueueStatus, persistData]);
  
  // Get queue messages (for debugging/status)
  const getQueuedMessages = useCallback(() => {
    return [...messageQueueRef.current];
  }, []);
  
  // Auto-connect on mount
  useEffect(() => {
    if (opts.autoConnect) {
      // In development, React StrictMode causes double mounting
      // Delay WebSocket connection slightly to avoid race condition
      const isDev = import.meta.env.DEV;
      const delay = isDev ? 100 : 0;
      
      const timer = setTimeout(() => {
        connect();
      }, delay);
      
      return () => {
        clearTimeout(timer);
        disconnect();
      };
    }
    
    return () => {
      disconnect();
    };
  }, [opts.autoConnect]); // Don't include connect/disconnect to avoid reconnections
  
  // Guard against browser extension message channel errors
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Suppress browser extension message channel errors to prevent console spam
      if (event.reason?.message?.includes('message channel closed before a response was received')) {
        event.preventDefault();
        return;
      }
      // Allow other unhandled rejections to be logged normally
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);
  
  // Circuit breaker automatic retry mechanism
  useEffect(() => {
    const interval = setInterval(() => {
      const circuitState = checkCircuitBreakerState();
      if (circuitState === 'half-open' && !connectionStatus.connected && !connectionStatus.connecting) {
        connect();
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [checkCircuitBreakerState, connect, connectionStatus.connected, connectionStatus.connecting]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);
  
  return {
    // Connection state
    connectionStatus,
    isConnected: connectionStatus.connected,
    isConnecting: connectionStatus.connecting,
    isReconnecting: connectionStatus.reconnecting,
    
    // Message state
    lastMessage,
    queueStatus,
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    clearQueue,
    getQueuedMessages,
    
    // Status helpers
    canSend: connectionStatus.connected && !rateLimitRef.current.blocked,
    nextRetry: rateLimitRef.current.blocked ? new Date(rateLimitRef.current.nextReset) : null,
  };
}

