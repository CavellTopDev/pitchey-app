#!/usr/bin/env deno run --allow-all

async function testWebSocketConnection() {
  console.log("🔍 Testing WebSocket Connection and Authentication...");
  
  // First, let's authenticate with a demo account to get a token
  console.log("\n🔐 Step 1: Authenticating with demo account...");
  
  const authResponse = await fetch("http://localhost:8001/api/auth/creator/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "alex.creator@demo.com",
      password: "Demo123"
    })
  });
  
  if (!authResponse.ok) {
    console.error("❌ Authentication failed:", authResponse.status, authResponse.statusText);
    return;
  }
  
  const authData = await authResponse.json();
  console.log("✅ Authentication successful");
  
  if (!authData.success || !authData.token) {
    console.error("❌ No token received in auth response:", authData);
    return;
  }
  
  const token = authData.token;
  console.log("🎫 Token received:", token.substring(0, 20) + "...");
  
  // Test WebSocket connection without authentication
  console.log("\n📡 Step 2: Testing WebSocket connection without authentication...");
  
  try {
    const wsNoAuth = new WebSocket("ws://localhost:8001/ws");
    
    wsNoAuth.onopen = () => {
      console.log("✅ WebSocket connection opened (no auth)");
      wsNoAuth.close();
    };
    
    wsNoAuth.onmessage = (event) => {
      console.log("📨 Received message (no auth):", event.data);
    };
    
    wsNoAuth.onerror = (error) => {
      console.error("❌ WebSocket error (no auth):", error);
    };
    
    wsNoAuth.onclose = (event) => {
      console.log(`🔌 WebSocket closed (no auth): ${event.code} - ${event.reason}`);
    };
    
    // Wait a bit for connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error("❌ WebSocket connection failed (no auth):", error);
  }
  
  // Test WebSocket connection with authentication via query parameter
  console.log("\n🔐 Step 3: Testing WebSocket connection with authentication (query param)...");
  
  try {
    const wsWithAuth = new WebSocket(`ws://localhost:8001/ws?token=${token}`);
    
    let messageCount = 0;
    const maxMessages = 5;
    
    wsWithAuth.onopen = () => {
      console.log("✅ WebSocket connection opened (with auth)");
      
      // Test sending a message
      const testMessage = {
        type: "ping",
        data: { message: "Hello WebSocket!" },
        timestamp: new Date().toISOString()
      };
      
      console.log("📤 Sending test message:", testMessage);
      wsWithAuth.send(JSON.stringify(testMessage));
    };
    
    wsWithAuth.onmessage = (event) => {
      messageCount++;
      console.log(`📨 Received message ${messageCount}:`, event.data);
      
      try {
        const data = JSON.parse(event.data);
        console.log("   Parsed data:", data);
      } catch (e) {
        console.log("   Raw message (not JSON)");
      }
      
      if (messageCount >= maxMessages) {
        console.log("🔌 Closing WebSocket after receiving expected messages");
        wsWithAuth.close();
      }
    };
    
    wsWithAuth.onerror = (error) => {
      console.error("❌ WebSocket error (with auth):", error);
    };
    
    wsWithAuth.onclose = (event) => {
      console.log(`🔌 WebSocket closed (with auth): ${event.code} - ${event.reason}`);
    };
    
    // Wait for messages
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error("❌ WebSocket connection failed (with auth):", error);
  }
  
  // Test WebSocket stats endpoint
  console.log("\n📊 Step 4: Testing WebSocket stats...");
  
  try {
    const statsResponse = await fetch("http://localhost:8001/api/ws/stats", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log("✅ WebSocket stats retrieved:", stats);
    } else {
      console.error("❌ Failed to get WebSocket stats:", statsResponse.status, statsResponse.statusText);
    }
  } catch (error) {
    console.error("❌ WebSocket stats request failed:", error);
  }
  
  console.log("\n🎯 WebSocket tests completed!");
}

// Run the test
if (import.meta.main) {
  await testWebSocketConnection();
}