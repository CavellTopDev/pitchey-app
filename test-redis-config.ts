// Test Redis configuration and connection
import { nativeRedisService } from "./src/services/redis-native.service.ts";

console.log("=== Redis Configuration Test ===");

// Check environment variables
console.log("Environment variables:");
console.log("CACHE_ENABLED:", Deno.env.get("CACHE_ENABLED"));
console.log("REDIS_HOST:", Deno.env.get("REDIS_HOST"));
console.log("REDIS_PORT:", Deno.env.get("REDIS_PORT"));
console.log("REDIS_PASSWORD:", Deno.env.get("REDIS_PASSWORD"));
console.log("REDIS_DB:", Deno.env.get("REDIS_DB"));
console.log("NODE_ENV:", Deno.env.get("NODE_ENV"));
console.log("DENO_ENV:", Deno.env.get("DENO_ENV"));

console.log("\n=== Testing Redis Connection ===");

try {
  const connected = await nativeRedisService.connect();
  console.log("Connection result:", connected);
  
  if (connected) {
    console.log("✅ Redis connection successful!");
    
    // Test basic operations
    const testKey = "test:key";
    const testValue = { message: "Hello Redis!", timestamp: Date.now() };
    
    console.log("\nTesting Redis operations...");
    
    // Set a value
    const setResult = await nativeRedisService.set(testKey, testValue, 60);
    console.log("SET result:", setResult);
    
    // Get the value
    const getValue = await nativeRedisService.get(testKey);
    console.log("GET result:", getValue);
    
    // Test ping
    const pingResult = await nativeRedisService.ping();
    console.log("PING result:", pingResult);
    
    // Get stats
    const stats = nativeRedisService.getStats();
    console.log("Stats:", stats);
    
    // Cleanup
    await nativeRedisService.del(testKey);
    console.log("Test key cleaned up");
    
  } else {
    console.log("❌ Redis connection failed");
  }
} catch (error) {
  console.error("Error testing Redis:", error);
}