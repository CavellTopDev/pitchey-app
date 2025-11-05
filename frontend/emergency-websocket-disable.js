// Emergency WebSocket Disable Script
// Run this in browser console to immediately stop WebSocket reconnection loops

// Disable WebSocket reconnection
localStorage.setItem('pitchey_websocket_disabled', 'true');

// Clear any existing rate limit state that might be causing issues
localStorage.removeItem('pitchey_ws_queue');
localStorage.removeItem('pitchey_ws_ratelimit');
localStorage.removeItem('pitchey_last_ws_attempt');

console.log('✅ Emergency WebSocket disable complete');
console.log('WebSocket reconnection disabled until localStorage flag is cleared');
console.log('To re-enable: localStorage.removeItem("pitchey_websocket_disabled")');