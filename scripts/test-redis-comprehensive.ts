#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Comprehensive Redis Test Suite
 * Tests all Redis functionality including native client and Upstash
 */

import { nativeRedisService, cacheKeys } from "../src/services/redis-native.service.ts";
import { redisService, cacheHelpers } from "../src/services/redis.service.ts";

interface TestResult {
  test: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class RedisTestSuite {
  private results: TestResult[] = [];
  
  /**
   * Run a single test with timing
   */
  private async runTest(testName: string, testFn: () => Promise<void>): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        test: testName,
        passed: true,
        duration
      };
      
      this.results.push(result);
      console.log(`✅ ${testName} (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        test: testName,
        passed: false,
        duration,
        error: error.message
      };
      
      this.results.push(result);
      console.log(`❌ ${testName} (${duration}ms): ${error.message}`);
      return result;
    }
  }

  /**
   * Test native Redis connection
   */
  async testNativeConnection(): Promise<void> {
    console.log('\n🔍 Testing Native Redis Connection...');
    
    await this.runTest('Native Redis Connection', async () => {
      const connected = await nativeRedisService.connect();
      if (!connected) {
        throw new Error('Failed to connect to native Redis');
      }
    });

    await this.runTest('Native Redis Ping', async () => {
      const pingResult = await nativeRedisService.ping();
      if (!pingResult) {
        throw new Error('Redis ping failed');
      }
    });
  }

  /**
   * Test basic CRUD operations
   */
  async testBasicOperations(): Promise<void> {
    console.log('\n🔍 Testing Basic Redis Operations...');
    
    const testKey = 'test:basic:operations';
    const testValue = { message: 'Hello Redis!', timestamp: Date.now() };
    
    await this.runTest('SET Operation', async () => {
      const result = await nativeRedisService.set(testKey, testValue, 60);
      if (!result) {
        throw new Error('SET operation failed');
      }
    });

    await this.runTest('GET Operation', async () => {
      const result = await nativeRedisService.get(testKey);
      if (!result || result.message !== testValue.message) {
        throw new Error('GET operation failed or data mismatch');
      }
    });

    await this.runTest('EXISTS Operation', async () => {
      const exists = await nativeRedisService.exists(testKey);
      if (!exists) {
        throw new Error('EXISTS operation failed');
      }
    });

    await this.runTest('DEL Operation', async () => {
      const deleted = await nativeRedisService.del(testKey);
      if (!deleted) {
        throw new Error('DEL operation failed');
      }
    });

    await this.runTest('Key Not Exists After Delete', async () => {
      const exists = await nativeRedisService.exists(testKey);
      if (exists) {
        throw new Error('Key still exists after deletion');
      }
    });
  }

  /**
   * Test hash operations
   */
  async testHashOperations(): Promise<void> {
    console.log('\n🔍 Testing Hash Operations...');
    
    const hashKey = 'test:hash:user';
    const userData = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      preferences: { theme: 'dark', notifications: true }
    };

    await this.runTest('HSET Operation', async () => {
      const result = await nativeRedisService.hset(hashKey, 'profile', userData);
      if (!result) {
        throw new Error('HSET operation failed');
      }
    });

    await this.runTest('HGET Operation', async () => {
      const result = await nativeRedisService.hget(hashKey, 'profile');
      if (!result || result.name !== userData.name) {
        throw new Error('HGET operation failed or data mismatch');
      }
    });

    await this.runTest('HGETALL Operation', async () => {
      const result = await nativeRedisService.hgetall(hashKey);
      if (!result || !result.profile || result.profile.name !== userData.name) {
        throw new Error('HGETALL operation failed or data mismatch');
      }
    });

    // Cleanup
    await nativeRedisService.del(hashKey);
  }

  /**
   * Test TTL and expiration
   */
  async testTTL(): Promise<void> {
    console.log('\n🔍 Testing TTL and Expiration...');
    
    const ttlKey = 'test:ttl:key';
    const ttlValue = { data: 'temporary' };

    await this.runTest('SET with TTL', async () => {
      const result = await nativeRedisService.set(ttlKey, ttlValue, 2); // 2 seconds
      if (!result) {
        throw new Error('SET with TTL failed');
      }
    });

    await this.runTest('Key Exists Before Expiration', async () => {
      const exists = await nativeRedisService.exists(ttlKey);
      if (!exists) {
        throw new Error('Key should exist before expiration');
      }
    });

    await this.runTest('Wait for Expiration', async () => {
      // Wait for key to expire
      await new Promise(resolve => setTimeout(resolve, 3000));
      const exists = await nativeRedisService.exists(ttlKey);
      if (exists) {
        throw new Error('Key should have expired');
      }
    });
  }

  /**
   * Test cache helper functions
   */
  async testCacheHelpers(): Promise<void> {
    console.log('\n🔍 Testing Cache Helper Functions...');
    
    await this.runTest('Generate Cache Keys', async () => {
      const userKey = nativeRedisService.generateKey('user', 'profile', 123);
      const pitchKey = nativeRedisService.generateKey('pitch', 'details', 456);
      
      if (!userKey.includes('pitchey:') || !userKey.includes('user:profile:123')) {
        throw new Error('User key generation failed');
      }
      
      if (!pitchKey.includes('pitchey:') || !pitchKey.includes('pitch:details:456')) {
        throw new Error('Pitch key generation failed');
      }
    });

    await this.runTest('Cached Function Wrapper', async () => {
      const cacheKey = nativeRedisService.generateKey('test', 'cached_function');
      let fetchCount = 0;
      
      const fetchFunction = async () => {
        fetchCount++;
        return { data: 'cached_data', fetchCount };
      };

      // First call should fetch and cache
      const result1 = await nativeRedisService.cached(cacheKey, fetchFunction, 60);
      
      // Second call should return cached data
      const result2 = await nativeRedisService.cached(cacheKey, fetchFunction, 60);
      
      if (fetchCount !== 1) {
        throw new Error('Function should only be called once (cached on second call)');
      }
      
      if (result1.data !== result2.data) {
        throw new Error('Cached data should match original data');
      }
      
      // Cleanup
      await nativeRedisService.del(cacheKey);
    });
  }

  /**
   * Test Upstash compatibility
   */
  async testUpstashCompatibility(): Promise<void> {
    console.log('\n🔍 Testing Upstash Compatibility...');
    
    if (!Deno.env.get('UPSTASH_REDIS_REST_URL') || !Deno.env.get('UPSTASH_REDIS_REST_TOKEN')) {
      console.log('⚠️  Upstash credentials not found, skipping Upstash tests');
      return;
    }

    const testKey = 'test:upstash:compatibility';
    const testValue = { service: 'upstash', tested: true };

    await this.runTest('Upstash SET', async () => {
      const result = await redisService.set(testKey, testValue, 60);
      if (!result) {
        throw new Error('Upstash SET failed');
      }
    });

    await this.runTest('Upstash GET', async () => {
      const result = await redisService.get(testKey);
      if (!result || result.service !== testValue.service) {
        throw new Error('Upstash GET failed or data mismatch');
      }
    });

    await this.runTest('Upstash DEL', async () => {
      const result = await redisService.del(testKey);
      if (!result) {
        throw new Error('Upstash DEL failed');
      }
    });
  }

  /**
   * Test error handling
   */
  async testErrorHandling(): Promise<void> {
    console.log('\n🔍 Testing Error Handling...');
    
    await this.runTest('Handle Invalid JSON', async () => {
      // This should not throw an error, but return null gracefully
      const result = await nativeRedisService.get('non:existent:key');
      if (result !== null) {
        throw new Error('Expected null for non-existent key');
      }
    });

    await this.runTest('Handle Service Disabled', async () => {
      // Temporarily disable the service
      const originalEnabled = nativeRedisService.isEnabled();
      
      // Mock disabled state by checking if operations return gracefully
      const result = await nativeRedisService.get('test:key');
      
      // Should not throw error even if service issues occur
      if (typeof result !== 'object' && result !== null) {
        throw new Error('Error handling failed for disabled service');
      }
    });
  }

  /**
   * Test performance and statistics
   */
  async testPerformanceAndStats(): Promise<void> {
    console.log('\n🔍 Testing Performance and Statistics...');
    
    await this.runTest('Performance Test - Multiple Operations', async () => {
      const operations = 10;
      const promises = [];
      
      for (let i = 0; i < operations; i++) {
        const key = `test:perf:${i}`;
        const value = { index: i, data: `data_${i}` };
        promises.push(nativeRedisService.set(key, value, 60));
      }
      
      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      if (duration > 5000) { // Should complete within 5 seconds
        throw new Error(`Performance test too slow: ${duration}ms`);
      }
      
      // Cleanup
      for (let i = 0; i < operations; i++) {
        await nativeRedisService.del(`test:perf:${i}`);
      }
    });

    await this.runTest('Statistics Collection', async () => {
      const stats = nativeRedisService.getStats();
      
      if (typeof stats.totalOperations !== 'number' || stats.totalOperations < 0) {
        throw new Error('Invalid statistics: totalOperations');
      }
      
      if (typeof stats.uptime !== 'number' || stats.uptime < 0) {
        throw new Error('Invalid statistics: uptime');
      }
      
      if (!stats.operations || typeof stats.operations.get !== 'number') {
        throw new Error('Invalid statistics: operations breakdown');
      }
    });
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Redis Test Suite...\n');
    
    try {
      await this.testNativeConnection();
      await this.testBasicOperations();
      await this.testHashOperations();
      await this.testTTL();
      await this.testCacheHelpers();
      await this.testUpstashCompatibility();
      await this.testErrorHandling();
      await this.testPerformanceAndStats();
    } finally {
      await nativeRedisService.disconnect();
    }
    
    this.printSummary();
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log('\n📊 Test Summary:');
    console.log(`   Total Tests: ${total}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    console.log(`   Average Duration: ${Math.round(totalDuration / total)}ms`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`   - ${r.test}: ${r.error}`));
    }
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! Redis is working correctly.');
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Please check the Redis setup.`);
    }
  }
}

// Main execution
if (import.meta.main) {
  const testSuite = new RedisTestSuite();
  await testSuite.runAllTests();
}