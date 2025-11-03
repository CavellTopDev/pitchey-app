#!/usr/bin/env deno run --allow-all

// Load environment variables
import { load } from "https://deno.land/std@0.218.0/dotenv/mod.ts";

// Load .env file
const env = await load({ 
  allowEmptyValues: true,
  defaultsPath: null,
  examplePath: null
});

// Set environment variables
for (const [key, value] of Object.entries(env)) {
  Deno.env.set(key, value);
}

// Import the class directly
import { redisService } from "./src/services/redis.service.ts";

async function testRedisConnection() {
  console.log("🔍 Testing Redis/Upstash Connection...");
  
  // Check configuration
  console.log("\n📋 Configuration:");
  console.log(`CACHE_ENABLED: ${Deno.env.get("CACHE_ENABLED")}`);
  console.log(`UPSTASH_REDIS_REST_URL: ${Deno.env.get("UPSTASH_REDIS_REST_URL")}`);
  console.log(`UPSTASH_REDIS_REST_TOKEN: ${Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ? "[SET]" : "[NOT SET]"}`);
  
  // Check if Redis service is enabled (it was instantiated before env was loaded)
  console.log(`Redis Service Enabled (old instance): ${redisService.isEnabled()}`);
  
  // Create a test Redis service that reads current environment
  const testRedisService = {
    isEnabled: () => {
      const enabled = Deno.env.get("CACHE_ENABLED") === "true";
      const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
      const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
      return enabled && !!url && !!token;
    },
    makeRequest: async (command: string[]) => {
      const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
      const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
      
      const response = await fetch(url!, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        throw new Error(`Redis request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.result;
    }
  };
  
  console.log(`Test Redis Service Enabled: ${testRedisService.isEnabled()}`);
  
  if (!testRedisService.isEnabled()) {
    console.log("❌ Redis service not enabled. Check environment variables.");
    return;
  }
  
  console.log("\n🧪 Testing Basic Operations...");
  
  try {
    // Test SET operation
    console.log("Testing SET operation...");
    const setResult = await testRedisService.makeRequest(["SETEX", "test-key", "60", JSON.stringify("test-value")]);
    console.log(`SET result: ${setResult}`);
    
    // Test GET operation
    console.log("Testing GET operation...");
    const getValue = await testRedisService.makeRequest(["GET", "test-key"]);
    console.log(`GET result:`, getValue ? JSON.parse(getValue) : null);
    
    // Test EXISTS operation
    console.log("Testing EXISTS operation...");
    const existsResult = await testRedisService.makeRequest(["EXISTS", "test-key"]);
    console.log(`EXISTS result: ${existsResult}`);
    
    // Test DEL operation
    console.log("Testing DEL operation...");
    const delResult = await testRedisService.makeRequest(["DEL", "test-key"]);
    console.log(`DEL result: ${delResult}`);
    
    // Test ping
    console.log("\nTesting PING...");
    const pingResult = await testRedisService.makeRequest(["PING"]);
    console.log(`PING result: ${pingResult}`);
    
    console.log("\n✅ All Redis operations completed successfully!");
    
  } catch (error) {
    console.error("❌ Redis operation failed:", error);
  }
}

// Run the test
if (import.meta.main) {
  await testRedisConnection();
}