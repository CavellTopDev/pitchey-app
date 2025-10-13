// Test WebSocket with Redis pub/sub
import { nativeRedisService } from "./src/services/redis-native.service.ts";

console.log("=== Testing WebSocket Redis Integration ===");

async function testWebSocketRedis() {
  try {
    // Initialize Redis connection
    console.log("1. Connecting to Redis...");
    const connected = await nativeRedisService.connect();
    
    if (!connected) {
      console.error("❌ Failed to connect to Redis");
      return;
    }
    
    console.log("✅ Redis connected successfully");
    
    // Test publishing a WebSocket message
    console.log("\n2. Testing Redis publish for WebSocket messages...");
    const testChannel = "pitchey:notifications:123";
    const testMessage = {
      type: "notification",
      payload: {
        userId: 123,
        message: "Test notification",
        timestamp: Date.now()
      },
      messageId: crypto.randomUUID()
    };
    
    const publishResult = await nativeRedisService.publish(testChannel, testMessage);
    console.log(`✅ Published message to channel ${testChannel}, result: ${publishResult}`);
    
    // Test presence tracking via Redis
    console.log("\n3. Testing presence tracking via Redis...");
    const presenceKey = "pitchey:presence:123";
    const presenceData = {
      status: "online",
      timestamp: Date.now(),
      lastSeen: new Date().toISOString()
    };
    
    const setResult = await nativeRedisService.set(presenceKey, presenceData, 3600);
    console.log(`✅ Set presence data: ${setResult}`);
    
    const getResult = await nativeRedisService.get(presenceKey);
    console.log(`✅ Retrieved presence data:`, getResult);
    
    // Test draft sync via Redis
    console.log("\n4. Testing draft sync via Redis...");
    const draftKey = "pitchey:draft:123:456";
    const draftData = {
      title: "Test Draft",
      content: "This is a test draft",
      timestamp: Date.now(),
      sessionId: "test-session-123"
    };
    
    const draftSetResult = await nativeRedisService.set(draftKey, draftData, 3600);
    console.log(`✅ Set draft data: ${draftSetResult}`);
    
    const draftGetResult = await nativeRedisService.get(draftKey);
    console.log(`✅ Retrieved draft data:`, draftGetResult);
    
    // Get Redis stats
    console.log("\n5. Redis statistics:");
    const stats = nativeRedisService.getStats();
    console.log(stats);
    
    // Cleanup test keys
    console.log("\n6. Cleaning up test keys...");
    await nativeRedisService.del(presenceKey);
    await nativeRedisService.del(draftKey);
    console.log("✅ Test keys cleaned up");
    
    console.log("\n🎉 WebSocket Redis integration test completed successfully!");
    
  } catch (error) {
    console.error("❌ Error testing WebSocket Redis integration:", error);
  }
}

// Run the test
await testWebSocketRedis();