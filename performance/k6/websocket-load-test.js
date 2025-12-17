/**
 * K6 WebSocket Load Testing Script for Pitchey Real-time Features
 * Tests WebSocket connections via Cloudflare Durable Objects
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import http from 'k6/http';

// Custom metrics for WebSocket performance
const wsConnectionErrors = new Rate('ws_connection_errors');
const wsMessageErrors = new Rate('ws_message_errors');
const wsConnectionTime = new Trend('ws_connection_duration');
const wsMessageLatency = new Trend('ws_message_latency');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsMessagesSent = new Counter('ws_messages_sent');
const activeConnections = new Counter('ws_active_connections');

// Environment configuration
const WS_URL = __ENV.WS_URL || 'wss://pitchey-production.cavelltheleaddev.workers.dev/ws';
const API_URL = __ENV.API_URL || 'https://pitchey-production.cavelltheleaddev.workers.dev';

export const options = {
  scenarios: {
    // WebSocket connection stress test
    connection_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Ramp to 10 concurrent connections
        { duration: '3m', target: 10 },   // Hold 10 connections
        { duration: '1m', target: 50 },   // Ramp to 50 connections
        { duration: '5m', target: 50 },   // Hold 50 connections
        { duration: '2m', target: 0 },    // Ramp down
      ],
      tags: { test_type: 'connection_stress' },
      env: { SCENARIO: 'connection_stress' },
    },

    // Real-time messaging load test
    messaging_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      tags: { test_type: 'messaging_load' },
      env: { SCENARIO: 'messaging_load' },
      startTime: '12m', // Start after connection stress
    },

    // Notification broadcast test
    notification_broadcast: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: 100,
      maxDuration: '5m',
      tags: { test_type: 'notification_broadcast' },
      env: { SCENARIO: 'notification_broadcast' },
      startTime: '22m', // Start after messaging load
    },

    // Long-running connection test (soak)
    connection_soak: {
      executor: 'constant-vus',
      vus: 15,
      duration: '30m',
      tags: { test_type: 'connection_soak' },
      env: { SCENARIO: 'connection_soak' },
      startTime: '27m', // Start after notification broadcast
    },
  },

  thresholds: {
    // Connection performance
    'ws_connection_duration': ['p(95)<1000'], // 95% of connections establish in <1s
    'ws_connection_errors': ['rate<0.05'],    // <5% connection failures
    
    // Message performance
    'ws_message_latency': ['p(95)<500'],      // 95% of messages in <500ms
    'ws_message_errors': ['rate<0.01'],       // <1% message errors
    
    // Throughput
    'ws_messages_sent': ['count>1000'],       // Ensure substantial traffic
    'ws_messages_received': ['count>1000'],   // Ensure message delivery
  },
};

// Demo user credentials for authentication
const DEMO_USERS = [
  { type: 'creator', email: 'alex.creator@demo.com', password: 'Demo123' },
  { type: 'investor', email: 'sarah.investor@demo.com', password: 'Demo123' },
  { type: 'production', email: 'stellar.production@demo.com', password: 'Demo123' },
];

// Message types to test
const MESSAGE_TYPES = {
  PING: 'ping',
  NOTIFICATION_REQUEST: 'notification_request',
  PRESENCE_UPDATE: 'presence_update',
  TYPING_INDICATOR: 'typing_indicator',
  PITCH_UPDATE: 'pitch_update',
  CHAT_MESSAGE: 'chat_message',
  ANALYTICS_EVENT: 'analytics_event',
};

// Test scenarios based on real usage patterns
const USAGE_PATTERNS = {
  creator_dashboard: [
    MESSAGE_TYPES.PRESENCE_UPDATE,
    MESSAGE_TYPES.PITCH_UPDATE,
    MESSAGE_TYPES.NOTIFICATION_REQUEST,
    MESSAGE_TYPES.ANALYTICS_EVENT,
  ],
  
  investor_portfolio: [
    MESSAGE_TYPES.PRESENCE_UPDATE,
    MESSAGE_TYPES.NOTIFICATION_REQUEST,
    MESSAGE_TYPES.CHAT_MESSAGE,
  ],
  
  production_monitoring: [
    MESSAGE_TYPES.PRESENCE_UPDATE,
    MESSAGE_TYPES.ANALYTICS_EVENT,
    MESSAGE_TYPES.NOTIFICATION_REQUEST,
  ],
  
  general_activity: [
    MESSAGE_TYPES.PING,
    MESSAGE_TYPES.PRESENCE_UPDATE,
    MESSAGE_TYPES.TYPING_INDICATOR,
  ],
};

// Authenticate user and get token
function authenticate() {
  const user = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
  
  const response = http.post(`${API_URL}/api/auth/${user.type}/login`, {
    email: user.email,
    password: user.password,
  }, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status !== 200) {
    console.error(`Authentication failed for ${user.type}:`, response.body);
    return null;
  }

  const result = response.json();
  return {
    token: result.token,
    userType: user.type,
    userId: result.user?.id || `test-${Math.random().toString(36).substr(2, 9)}`,
  };
}

// Generate realistic test messages
function generateTestMessage(messageType, userData) {
  const baseMessage = {
    type: messageType,
    timestamp: Date.now(),
    userId: userData.userId,
    userType: userData.userType,
  };

  switch (messageType) {
    case MESSAGE_TYPES.PING:
      return { ...baseMessage };

    case MESSAGE_TYPES.NOTIFICATION_REQUEST:
      return {
        ...baseMessage,
        data: {
          type: 'nda_request',
          pitchId: `pitch-${Math.floor(Math.random() * 100)}`,
          message: 'New NDA request received',
        },
      };

    case MESSAGE_TYPES.PRESENCE_UPDATE:
      return {
        ...baseMessage,
        data: {
          status: Math.random() > 0.5 ? 'online' : 'away',
          lastSeen: Date.now(),
        },
      };

    case MESSAGE_TYPES.TYPING_INDICATOR:
      return {
        ...baseMessage,
        data: {
          isTyping: Math.random() > 0.5,
          conversationId: `conv-${Math.floor(Math.random() * 20)}`,
        },
      };

    case MESSAGE_TYPES.PITCH_UPDATE:
      return {
        ...baseMessage,
        data: {
          pitchId: `pitch-${Math.floor(Math.random() * 100)}`,
          updateType: Math.random() > 0.5 ? 'view' : 'like',
          metadata: { source: 'dashboard' },
        },
      };

    case MESSAGE_TYPES.CHAT_MESSAGE:
      return {
        ...baseMessage,
        data: {
          conversationId: `conv-${Math.floor(Math.random() * 20)}`,
          message: 'Test message from load testing',
          threadId: `thread-${Math.floor(Math.random() * 10)}`,
        },
      };

    case MESSAGE_TYPES.ANALYTICS_EVENT:
      return {
        ...baseMessage,
        data: {
          event: 'page_view',
          page: Math.random() > 0.5 ? '/dashboard' : '/browse',
          duration: Math.floor(Math.random() * 30000), // 0-30s
        },
      };

    default:
      return baseMessage;
  }
}

// Main WebSocket test function
export default function () {
  const scenario = __ENV.SCENARIO || 'connection_stress';
  const auth = authenticate();
  
  if (!auth || !auth.token) {
    console.error('Failed to authenticate, skipping WebSocket test');
    wsConnectionErrors.add(1);
    return;
  }

  // Determine usage pattern based on user type
  const usagePattern = USAGE_PATTERNS[`${auth.userType}_${
    auth.userType === 'creator' ? 'dashboard' :
    auth.userType === 'investor' ? 'portfolio' : 'monitoring'
  }`] || USAGE_PATTERNS.general_activity;

  // Connect to WebSocket with authentication
  const wsUrl = `${WS_URL}?token=${auth.token}&userId=${auth.userId}&userType=${auth.userType}`;
  
  const startTime = Date.now();
  let connectionEstablished = false;
  let messagesReceived = 0;
  let messagesSent = 0;
  let lastPingTime = 0;

  const response = ws.connect(wsUrl, {
    headers: {
      'User-Agent': 'K6-WebSocket-Load-Test/1.0',
    },
  }, function (socket) {
    connectionEstablished = true;
    const connectionTime = Date.now() - startTime;
    wsConnectionTime.add(connectionTime);
    activeConnections.add(1);

    socket.on('open', function () {
      console.log(`WebSocket connection opened for ${auth.userType}`);
    });

    socket.on('message', function (data) {
      try {
        const message = JSON.parse(data);
        messagesReceived++;
        wsMessagesReceived.add(1);

        // Calculate latency for ping messages
        if (message.type === MESSAGE_TYPES.PING && lastPingTime > 0) {
          const latency = Date.now() - lastPingTime;
          wsMessageLatency.add(latency);
        }

        // Handle different message types
        handleIncomingMessage(message, socket, auth);
        
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        wsMessageErrors.add(1);
      }
    });

    socket.on('error', function (error) {
      console.error('WebSocket error:', error);
      wsMessageErrors.add(1);
    });

    socket.on('close', function () {
      console.log(`WebSocket connection closed for ${auth.userType}`);
      activeConnections.add(-1);
    });

    // Test behavior based on scenario
    switch (scenario) {
      case 'connection_stress':
        runConnectionStressTest(socket, usagePattern, auth);
        break;

      case 'messaging_load':
        runMessagingLoadTest(socket, usagePattern, auth);
        break;

      case 'notification_broadcast':
        runNotificationBroadcastTest(socket, auth);
        break;

      case 'connection_soak':
        runConnectionSoakTest(socket, usagePattern, auth);
        break;

      default:
        runBasicTest(socket, usagePattern, auth);
    }
  });

  // Check connection establishment
  check(response, {
    'WebSocket connection established': () => connectionEstablished,
    'Messages received': () => messagesReceived > 0,
  });

  if (!connectionEstablished) {
    wsConnectionErrors.add(1);
  }
}

// Test scenarios
function runConnectionStressTest(socket, usagePattern, auth) {
  // Send periodic messages to maintain connection
  for (let i = 0; i < 5; i++) {
    const messageType = usagePattern[Math.floor(Math.random() * usagePattern.length)];
    sendTestMessage(socket, messageType, auth);
    sleep(2 + Math.random() * 3); // 2-5 second intervals
  }
}

function runMessagingLoadTest(socket, usagePattern, auth) {
  // High-frequency message sending
  for (let i = 0; i < 20; i++) {
    const messageType = usagePattern[Math.floor(Math.random() * usagePattern.length)];
    sendTestMessage(socket, messageType, auth);
    sleep(0.5 + Math.random() * 1); // 0.5-1.5 second intervals
  }
}

function runNotificationBroadcastTest(socket, auth) {
  // Send notification requests
  for (let i = 0; i < 10; i++) {
    sendTestMessage(socket, MESSAGE_TYPES.NOTIFICATION_REQUEST, auth);
    sleep(1);
  }
  
  // Wait for responses
  sleep(5);
}

function runConnectionSoakTest(socket, usagePattern, auth) {
  // Long-running connection with periodic activity
  const testDuration = 25 * 60 * 1000; // 25 minutes in ms
  const startTime = Date.now();
  
  while (Date.now() - startTime < testDuration) {
    const messageType = usagePattern[Math.floor(Math.random() * usagePattern.length)];
    sendTestMessage(socket, messageType, auth);
    
    // Variable sleep times to simulate real usage
    const sleepTime = Math.random() < 0.3 ? 
      Math.random() * 5 :      // 30% chance of short burst
      10 + Math.random() * 20; // 70% chance of longer pause
    
    sleep(sleepTime);
  }
}

function runBasicTest(socket, usagePattern, auth) {
  // Standard test pattern
  for (let i = 0; i < 10; i++) {
    const messageType = usagePattern[Math.floor(Math.random() * usagePattern.length)];
    sendTestMessage(socket, messageType, auth);
    sleep(1 + Math.random() * 2);
  }
}

// Send test message via WebSocket
function sendTestMessage(socket, messageType, auth) {
  const message = generateTestMessage(messageType, auth);
  
  try {
    if (messageType === MESSAGE_TYPES.PING) {
      lastPingTime = Date.now();
    }
    
    socket.send(JSON.stringify(message));
    messagesSent++;
    wsMessagesSent.add(1);
    
  } catch (error) {
    console.error('Error sending WebSocket message:', error);
    wsMessageErrors.add(1);
  }
}

// Handle incoming messages and send appropriate responses
function handleIncomingMessage(message, socket, auth) {
  switch (message.type) {
    case 'ping':
      // Respond to ping with pong
      socket.send(JSON.stringify({
        type: 'pong',
        timestamp: Date.now(),
        originalTimestamp: message.timestamp,
      }));
      break;

    case 'notification':
      // Acknowledge notifications
      socket.send(JSON.stringify({
        type: 'notification_ack',
        notificationId: message.id,
        timestamp: Date.now(),
      }));
      break;

    case 'presence_request':
      // Respond to presence requests
      socket.send(JSON.stringify({
        type: 'presence_response',
        status: 'online',
        timestamp: Date.now(),
        userId: auth.userId,
      }));
      break;

    case 'typing_indicator':
      // Occasionally respond with typing indicator
      if (Math.random() < 0.3) {
        setTimeout(() => {
          socket.send(JSON.stringify({
            type: 'typing_indicator',
            isTyping: false,
            conversationId: message.data?.conversationId,
            timestamp: Date.now(),
          }));
        }, 1000 + Math.random() * 3000); // 1-4 second delay
      }
      break;

    default:
      // Generic acknowledgment for other message types
      if (Math.random() < 0.1) { // 10% chance of acknowledgment
        socket.send(JSON.stringify({
          type: 'ack',
          originalType: message.type,
          timestamp: Date.now(),
        }));
      }
  }
}

// Setup function
export function setup() {
  console.log('Setting up WebSocket load test...');
  
  // Test basic connectivity
  const healthResponse = http.get(`${API_URL}/api/health`);
  
  if (healthResponse.status !== 200) {
    console.error('API health check failed:', healthResponse.body);
    throw new Error('API not available for WebSocket testing');
  }

  return {
    startTime: new Date().toISOString(),
    wsUrl: WS_URL,
    apiUrl: API_URL,
  };
}

// Teardown function
export function teardown(data) {
  console.log('WebSocket load test completed at:', new Date().toISOString());
  console.log('Test configuration:', data);
}

// Custom summary handler
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  return {
    [`performance/reports/ws-summary-${timestamp}.json`]: JSON.stringify(data, null, 2),
    [`performance/reports/ws-summary-${timestamp}.html`]: generateWebSocketHTMLReport(data),
    stdout: generateWebSocketTextSummary(data),
  };
}

function generateWebSocketHTMLReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .metric { background: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .good { border-left: 5px solid #4CAF50; }
        .warning { border-left: 5px solid #FF9800; }
        .error { border-left: 5px solid #F44336; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    </style>
</head>
<body>
    <h1>Pitchey WebSocket Performance Test Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    
    <div class="stats-grid">
        <div>
            <h2>Connection Performance</h2>
            <div class="metric">
                <strong>Average Connection Time:</strong> ${(data.metrics.ws_connection_duration?.avg || 0).toFixed(2)}ms<br>
                <strong>95th Percentile:</strong> ${(data.metrics.ws_connection_duration?.p95 || 0).toFixed(2)}ms<br>
                <strong>Connection Error Rate:</strong> ${((data.metrics.ws_connection_errors?.rate || 0) * 100).toFixed(2)}%
            </div>
            
            <h2>Message Performance</h2>
            <div class="metric">
                <strong>Messages Sent:</strong> ${data.metrics.ws_messages_sent?.count || 0}<br>
                <strong>Messages Received:</strong> ${data.metrics.ws_messages_received?.count || 0}<br>
                <strong>Average Latency:</strong> ${(data.metrics.ws_message_latency?.avg || 0).toFixed(2)}ms<br>
                <strong>Message Error Rate:</strong> ${((data.metrics.ws_message_errors?.rate || 0) * 100).toFixed(2)}%
            </div>
        </div>
        
        <div>
            <h2>Threshold Results</h2>
            ${Object.entries(data.thresholds || {}).map(([name, result]) => `
                <div class="metric ${result.ok ? 'good' : 'error'}">
                    <strong>${name}:</strong> ${result.ok ? 'PASSED' : 'FAILED'}
                </div>
            `).join('')}
        </div>
    </div>
    
    <h2>Test Summary</h2>
    <div class="metric">
        <strong>Test Duration:</strong> ${Math.round((data.state?.testRunDurationMs || 0) / 1000)}s<br>
        <strong>Peak Active Connections:</strong> ${data.metrics.ws_active_connections?.max || 0}<br>
        <strong>Message Throughput:</strong> ${((data.metrics.ws_messages_sent?.count || 0) / ((data.state?.testRunDurationMs || 1) / 1000)).toFixed(2)} msg/s
    </div>
</body>
</html>`;
}

function generateWebSocketTextSummary(data) {
  return `
WebSocket Performance Test Summary
=================================
Duration: ${Math.round((data.state?.testRunDurationMs || 0) / 1000)}s

Connection Performance:
- Average Connection Time: ${(data.metrics.ws_connection_duration?.avg || 0).toFixed(2)}ms
- 95th Percentile: ${(data.metrics.ws_connection_duration?.p95 || 0).toFixed(2)}ms
- Connection Errors: ${((data.metrics.ws_connection_errors?.rate || 0) * 100).toFixed(2)}%

Message Performance:
- Messages Sent: ${data.metrics.ws_messages_sent?.count || 0}
- Messages Received: ${data.metrics.ws_messages_received?.count || 0}
- Average Latency: ${(data.metrics.ws_message_latency?.avg || 0).toFixed(2)}ms
- Message Errors: ${((data.metrics.ws_message_errors?.rate || 0) * 100).toFixed(2)}%

Throughput: ${((data.metrics.ws_messages_sent?.count || 0) / ((data.state?.testRunDurationMs || 1) / 1000)).toFixed(2)} msg/s

Thresholds: ${Object.values(data.thresholds || {}).filter(t => t.ok).length}/${Object.keys(data.thresholds || {}).length} passed
`;
}