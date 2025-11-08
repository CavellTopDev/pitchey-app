#!/usr/bin/env -S deno run --allow-net

/**
 * Simple WebSocket Test
 */

const BACKEND_URL = "http://localhost:8001";
const WS_URL = "ws://localhost:8001/ws";

console.log("🧪 Simple WebSocket Test");

// Step 1: Get auth token
console.log("1. Getting auth token...");
try {
  const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "alex.creator@demo.com",
      password: "Demo123"
    })
  });
  
  const loginData = await loginResponse.json();
  console.log("✅ Login successful:", loginData.user.email);
  
  const token = loginData.token;
  
  // Step 2: Test WebSocket connection with token
  console.log("2. Testing WebSocket connection...");
  
  const wsUrlWithToken = `${WS_URL}?token=${token}`;
  const ws = new WebSocket(wsUrlWithToken);
  
  ws.onopen = () => {
    console.log("🔌 WebSocket connected!");
    
    // Send a ping message
    ws.send(JSON.stringify({
      type: "ping",
      payload: { timestamp: Date.now() }
    }));
  };
  
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("📨 Received message:", message.type, message.payload);
      
      if (message.type === "connected") {
        console.log("✅ Connection confirmed with session ID:", message.payload?.sessionId);
      } else if (message.type === "pong") {
        console.log("✅ Ping-pong successful!");
        ws.close();
      }
    } catch (error) {
      console.error("❌ Failed to parse message:", error);
    }
  };
  
  ws.onclose = (event) => {
    console.log(`🔒 WebSocket closed: ${event.code} - ${event.reason}`);
    if (event.code === 1000) {
      console.log("✅ Normal closure - test passed!");
    }
    Deno.exit(0);
  };
  
  ws.onerror = (error) => {
    console.error("❌ WebSocket error:", error);
    Deno.exit(1);
  };
  
  // Timeout after 10 seconds
  setTimeout(() => {
    console.log("⏰ Test timeout");
    ws.close();
    Deno.exit(1);
  }, 10000);
  
} catch (error) {
  console.error("❌ Test failed:", error);
  Deno.exit(1);
}