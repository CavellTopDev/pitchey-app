#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Simple Redis Test - Direct Connection Test
 */

// Load environment variables for development
const loadEnvFile = async (filePath: string) => {
  try {
    const envContent = await Deno.readTextFile(filePath);
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        Deno.env.set(key, value);
      }
    });
    console.log(`✅ Loaded environment from ${filePath}`);
  } catch (error) {
    console.log(`⚠️  Could not load ${filePath}: ${error.message}`);
  }
};

// Load development environment
await loadEnvFile('.env.development');

console.log('🔍 Testing Direct Redis Connection...\n');

// Test 1: Direct TCP connection to Redis
console.log('1. Testing direct TCP connection...');
try {
  const connection = await Deno.connect({ hostname: 'localhost', port: 6379 });
  
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Send PING command
  await connection.write(encoder.encode('*1\r\n$4\r\nPING\r\n'));
  
  const buffer = new Uint8Array(1024);
  const bytesRead = await connection.read(buffer);
  const response = decoder.decode(buffer.subarray(0, bytesRead || 0));
  
  connection.close();
  
  if (response.includes('+PONG')) {
    console.log('✅ Direct TCP connection successful');
    console.log(`   Response: ${response.trim()}`);
  } else {
    console.log('❌ Unexpected response from Redis');
    console.log(`   Response: ${response}`);
  }
} catch (error) {
  console.log('❌ Direct TCP connection failed');
  console.log(`   Error: ${error.message}`);
  console.log('   Make sure Redis is running: docker run -d --name pitchey-redis -p 6379:6379 redis:7-alpine');
}

// Test 2: Using Deno Redis client
console.log('\n2. Testing Deno Redis client...');
try {
  const { connect } = await import("redis");
  
  const redis = await connect({
    hostname: 'localhost',
    port: 6379
  });
  
  console.log('✅ Redis client connected');
  
  // Test basic operations
  console.log('   Testing SET operation...');
  const setResult = await redis.set('test:key', 'test:value');
  console.log(`   SET result: ${setResult}`);
  
  console.log('   Testing GET operation...');
  const getValue = await redis.get('test:key');
  console.log(`   GET result: ${getValue}`);
  
  console.log('   Testing DEL operation...');
  const delResult = await redis.del('test:key');
  console.log(`   DEL result: ${delResult}`);
  
  await redis.close();
  console.log('✅ Redis client operations successful');
  
} catch (error) {
  console.log('❌ Deno Redis client failed');
  console.log(`   Error: ${error.message}`);
}

// Test 3: Using our Redis service with environment variables set
console.log('\n3. Testing our Redis service...');

// Set environment variables for testing
Deno.env.set('CACHE_ENABLED', 'true');
Deno.env.set('NODE_ENV', 'development');

try {
  const { nativeRedisService } = await import("../src/services/redis-native.service.ts");
  
  console.log('   Connecting to Redis...');
  const connected = await nativeRedisService.connect();
  
  if (connected) {
    console.log('✅ Our Redis service connected');
    
    console.log('   Testing PING...');
    const pingResult = await nativeRedisService.ping();
    console.log(`   PING result: ${pingResult}`);
    
    console.log('   Testing SET operation...');
    const setResult = await nativeRedisService.set('test:service', { message: 'Hello from service!' }, 60);
    console.log(`   SET result: ${setResult}`);
    
    console.log('   Testing GET operation...');
    const getValue = await nativeRedisService.get('test:service');
    console.log(`   GET result: ${JSON.stringify(getValue)}`);
    
    console.log('   Testing cache key generation...');
    const cacheKey = nativeRedisService.generateKey('user', 'profile', 123);
    console.log(`   Generated key: ${cacheKey}`);
    
    console.log('   Getting service statistics...');
    const stats = nativeRedisService.getStats();
    console.log(`   Stats: ${JSON.stringify(stats, null, 2)}`);
    
    await nativeRedisService.disconnect();
    console.log('✅ Our Redis service operations successful');
  } else {
    console.log('❌ Our Redis service failed to connect');
  }
} catch (error) {
  console.log('❌ Our Redis service test failed');
  console.log(`   Error: ${error.message}`);
}

console.log('\n📊 Redis Setup Summary:');
console.log('   - Local Redis Docker container should be running on port 6379');
console.log('   - Direct TCP connection test shows basic Redis connectivity');
console.log('   - Deno Redis client test shows library compatibility');
console.log('   - Our Redis service test shows full integration');
console.log('\nNext steps:');
console.log('   - Use `deno task redis:health` for ongoing health checks');
console.log('   - Check Redis container status with `docker ps | grep redis`');
console.log('   - View Redis logs with `docker logs pitchey-redis`');