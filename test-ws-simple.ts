#!/usr/bin/env -S deno run --allow-all

const WS_URL = "wss://pitchey-api-prod.ndlovucavelle.workers.dev";

console.log("🔌 Testing basic WebSocket connectivity...\n");

const ws = new WebSocket(`${WS_URL}/ws`);

ws.onopen = () => {
  console.log("✅ WebSocket connected!");
  console.log("📤 Sending ping...");
  ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
};

ws.onmessage = (event) => {
  console.log("📨 Received:", event.data);
  
  // Close after receiving response
  setTimeout(() => {
    console.log("👋 Closing connection...");
    ws.close();
  }, 1000);
};

ws.onerror = (error) => {
  console.error("❌ WebSocket error:", error);
};

ws.onclose = (event) => {
  console.log(`🔚 WebSocket closed: Code ${event.code}, Reason: ${event.reason || 'None'}`);
  if (event.code === 1000 || event.code === 1001) {
    console.log("✅ Test completed successfully!");
  }
};

setTimeout(() => {
  console.log("⏰ Timeout reached, closing...");
  ws.close();
}, 5000);
