const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8001/api/messages/ws?token=' + process.argv[2]);

let messageCount = 0;
let pingCount = 0;
let pongCount = 0;

console.log('🔌 Connecting to WebSocket...');

setTimeout(() => {
  console.log('⏰ Test complete - closing connection');
  console.log('📊 Final stats:');
  console.log(`  - Total messages: ${messageCount}`);
  console.log(`  - Ping messages: ${pingCount}`);
  console.log(`  - Pong responses sent: ${pongCount}`);
  ws.close();
}, 65000); // Run for 65 seconds to catch at least 2 heartbeats

ws.on('open', () => {
  console.log('✅ Connected - waiting for server heartbeat pings...');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  messageCount++;
  
  console.log(`📥 [${new Date().toISOString()}] ${message.type}`);
  
  if (message.type === 'ping') {
    pingCount++;
    console.log(`   🏓 Responding with pong (ping #${pingCount})`);
    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
    pongCount++;
  }
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

ws.on('close', (code) => {
  console.log(`🔌 Closed with code: ${code}`);
  process.exit(0);
});
