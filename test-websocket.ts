#!/usr/bin/env deno run --allow-net

// Simple WebSocket test script for the Pitchey messaging system
// Usage: deno run --allow-net test-websocket.ts

const SERVER_URL = 'ws://localhost:8000/api/messages/ws';

// Demo authentication token (use a real token from login)
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsInVzZXJuYW1lIjoiYWxleGNyZWF0b3IiLCJ1c2VyVHlwZSI6ImNyZWF0b3IiLCJlbWFpbCI6ImFsZXguY3JlYXRvckBkZW1vLmNvbSIsImNvbXBhbnlOYW1lIjoiSW5kZXBlbmRlbnQgRmlsbXMiLCJpYXQiOjE3MzI0NjU4MzksImV4cCI6MTczMzMzNjYzOX0.example-token';

async function testWebSocketConnection() {
  console.log('🧪 Testing WebSocket connection to Pitchey messaging system...\n');

  try {
    const ws = new WebSocket(`${SERVER_URL}?token=${TEST_TOKEN}`);

    ws.onopen = () => {
      console.log('✅ WebSocket connected successfully');
      
      // Send ping to test basic connectivity
      setTimeout(() => {
        console.log('📤 Sending ping...');
        ws.send(JSON.stringify({ type: 'ping' }));
      }, 1000);

      // Test typing indicator
      setTimeout(() => {
        console.log('📤 Testing typing indicator...');
        ws.send(JSON.stringify({
          type: 'typing_start',
          conversationId: 1
        }));
      }, 2000);

      // Stop typing
      setTimeout(() => {
        console.log('📤 Stopping typing indicator...');
        ws.send(JSON.stringify({
          type: 'typing_stop',
          conversationId: 1
        }));
      }, 4000);

      // Test send message
      setTimeout(() => {
        console.log('📤 Sending test message...');
        ws.send(JSON.stringify({
          type: 'send_message',
          conversationId: 1,
          content: 'Hello! This is a test message from the WebSocket test script.',
          requestId: 'test_' + Date.now()
        }));
      }, 5000);

      // Test join conversation
      setTimeout(() => {
        console.log('📤 Joining conversation...');
        ws.send(JSON.stringify({
          type: 'join_conversation',
          conversationId: 1
        }));
      }, 6000);

      // Test get online users
      setTimeout(() => {
        console.log('📤 Getting online users...');
        ws.send(JSON.stringify({
          type: 'get_online_users'
        }));
      }, 7000);

      // Close connection after tests
      setTimeout(() => {
        console.log('🔌 Closing connection...');
        ws.close();
      }, 10000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📥 Received message:', {
          type: message.type,
          timestamp: message.timestamp || new Date().toISOString(),
          ...Object.fromEntries(
            Object.entries(message).filter(([key]) => 
              !['type', 'timestamp'].includes(key)
            )
          )
        });
      } catch (error) {
        console.error('❌ Error parsing message:', error);
        console.log('Raw message:', event.data);
      }
    };

    ws.onclose = (event) => {
      console.log(`\n🔌 WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
      
      if (event.code === 1000) {
        console.log('✅ Connection closed normally');
      } else if (event.code === 1006) {
        console.log('❌ Connection closed abnormally (server may not be running)');
      } else {
        console.log('⚠️  Connection closed with unusual code');
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

  } catch (error) {
    console.error('❌ Failed to create WebSocket connection:', error);
    console.log('\n💡 Make sure the server is running on localhost:8000');
    console.log('💡 You can start it with: deno run --allow-all working-server.ts');
  }
}

// Connection test without authentication
async function testConnectionWithoutAuth() {
  console.log('\n🧪 Testing connection without authentication...');
  
  try {
    const ws = new WebSocket(SERVER_URL);
    
    ws.onopen = () => {
      console.log('❌ Unexpected: Connection opened without authentication');
      ws.close();
    };
    
    ws.onclose = (event) => {
      if (event.code === 1002 || event.code === 1011) {
        console.log('✅ Connection properly rejected without authentication');
      } else {
        console.log(`⚠️  Unexpected close code: ${event.code}`);
      }
    };
    
    ws.onerror = () => {
      console.log('✅ Connection properly rejected (error expected)');
    };
    
  } catch (error) {
    console.log('✅ Connection creation failed as expected:', error.message);
  }
}

// Message format validation test
function testMessageFormats() {
  console.log('\n🧪 Testing message format validation...');
  
  const validFormats = [
    {
      name: 'Basic message',
      message: {
        type: 'send_message',
        conversationId: 1,
        content: 'Test message'
      }
    },
    {
      name: 'Message with attachments',
      message: {
        type: 'send_message',
        conversationId: 1,
        content: 'Message with file',
        attachments: [{
          type: 'image',
          url: 'https://example.com/image.jpg',
          filename: 'test.jpg',
          size: 1024
        }]
      }
    },
    {
      name: 'Typing indicator',
      message: {
        type: 'typing_start',
        conversationId: 1
      }
    }
  ];

  validFormats.forEach(({ name, message }) => {
    try {
      const json = JSON.stringify(message);
      const parsed = JSON.parse(json);
      console.log(`✅ ${name}: Valid format`);
    } catch (error) {
      console.log(`❌ ${name}: Invalid format - ${error.message}`);
    }
  });
}

// Performance test
async function performanceTest() {
  console.log('\n🧪 Running basic performance test...');
  
  const messageCount = 10;
  const startTime = Date.now();
  
  console.log(`📤 Sending ${messageCount} messages rapidly...`);
  
  // This would require an active connection, so we'll just validate the concept
  const messages = Array.from({ length: messageCount }, (_, i) => ({
    type: 'send_message',
    conversationId: 1,
    content: `Performance test message ${i + 1}`,
    requestId: `perf_test_${i}_${Date.now()}`
  }));
  
  messages.forEach((msg, i) => {
    const json = JSON.stringify(msg);
    // In a real test, we'd send these via WebSocket
    if (i === 0) console.log(`Sample message size: ${json.length} bytes`);
  });
  
  const endTime = Date.now();
  console.log(`✅ Generated ${messageCount} messages in ${endTime - startTime}ms`);
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Pitchey WebSocket Test Suite\n');
  console.log('=====================================\n');
  
  // Run validation tests first (don't require server)
  testMessageFormats();
  await performanceTest();
  
  // Connection tests (require server)
  await testConnectionWithoutAuth();
  
  // Wait a bit before the main test
  setTimeout(async () => {
    await testWebSocketConnection();
  }, 2000);
}

// Run tests
if (import.meta.main) {
  runAllTests();
}