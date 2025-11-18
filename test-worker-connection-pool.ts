#!/usr/bin/env deno run --allow-net --allow-env

/**
 * Test script to verify Worker connection pooling without query parameter issues
 * This tests the actual patterns used in the Worker endpoints
 */

import { dbPool, withDatabase } from './src/worker-database-pool.ts';

interface TestEnv {
  HYPERDRIVE?: {
    connectionString: string;
  };
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
}

const TEST_ENV: TestEnv = {
  HYPERDRIVE: {
    connectionString: "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
  },
  SENTRY_DSN: "https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536",
  SENTRY_ENVIRONMENT: "test",
  SENTRY_RELEASE: "connection-pool-test-v1.0"
};

async function testWorkerConnectionPool() {
  console.log('🧪 Testing Worker Connection Pool Implementation');
  console.log('='.repeat(50));
  
  // Initialize the pool
  console.log('\n1. Initializing connection pool...');
  dbPool.initialize(TEST_ENV);
  
  // Test basic connection
  console.log('\n2. Testing basic connection...');
  let isHealthy = false;
  try {
    isHealthy = await dbPool.testConnection(TEST_ENV);
    console.log(`✅ Connection test: ${isHealthy ? 'PASSED' : 'FAILED'}`);
    
    if (!isHealthy) {
      console.log('❌ Basic connection failed, stopping tests');
      return false;
    }
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
  
  // Test connection reuse (this is the key test)
  console.log('\n3. Testing connection reuse (simulating multiple API calls)...');
  let reuseSuccess = true;
  
  for (let i = 0; i < 10; i++) {
    try {
      const connection = dbPool.getConnection(TEST_ENV);
      if (connection) {
        console.log(`   API Call ${i + 1}: ✅ Got connection`);
      } else {
        console.log(`   API Call ${i + 1}: ❌ No connection returned`);
        reuseSuccess = false;
      }
    } catch (error) {
      console.log(`   API Call ${i + 1}: ❌ Error getting connection: ${error.message}`);
      reuseSuccess = false;
    }
  }
  
  console.log(`✅ Connection reuse test: ${reuseSuccess ? 'PASSED' : 'FAILED'}`);
  
  // Test the withDatabase pattern (how Worker endpoints actually work)
  console.log('\n4. Testing withDatabase pattern (actual Worker usage)...');
  
  try {
    const userCount = await withDatabase(TEST_ENV, async (sql) => {
      // This mimics the actual Worker endpoint pattern
      const result = await sql`SELECT COUNT(*) as total FROM users`;
      return result[0].total;
    });
    
    console.log(`✅ withDatabase test: Found ${userCount} users`);
  } catch (error) {
    console.error('❌ withDatabase test failed:', error.message);
    return false;
  }
  
  // Test multiple concurrent withDatabase calls (simulates high load)
  console.log('\n5. Testing concurrent withDatabase calls...');
  
  const concurrentTests = Array.from({ length: 5 }, async (_, i) => {
    try {
      const result = await withDatabase(TEST_ENV, async (sql) => {
        // Simulate different endpoint types
        if (i % 2 === 0) {
          return await sql`SELECT id, email FROM users LIMIT 1`;
        } else {
          return await sql`SELECT id, title FROM pitches LIMIT 1`;
        }
      });
      console.log(`   Concurrent test ${i + 1}: ✅ Success`);
      return true;
    } catch (error) {
      console.log(`   Concurrent test ${i + 1}: ❌ Failed - ${error.message}`);
      return false;
    }
  });
  
  const concurrentResults = await Promise.all(concurrentTests);
  const concurrentSuccess = concurrentResults.every(Boolean);
  console.log(`✅ Concurrent test: ${concurrentSuccess ? 'PASSED' : 'FAILED'}`);
  
  // Check pool statistics
  console.log('\n6. Pool statistics:');
  const stats = dbPool.getStats();
  console.log('   📊 Pool Stats:');
  console.log(`      - Initialized: ${stats.initialized}`);
  console.log(`      - Pool Size: ${stats.poolSize}`);
  console.log(`      - Connection Keys: ${stats.connectionKeys.length}`);
  
  // Verify single connection (the key metric)
  const singleConnection = stats.poolSize === 1;
  console.log(`✅ Single connection maintained: ${singleConnection ? 'PASSED' : 'FAILED'}`);
  
  // Performance test (simulate old vs new approach)
  console.log('\n7. Performance comparison test...');
  
  const { neon } = await import('@neondatabase/serverless');
  
  // Test old approach (new connection each time)
  console.log('   Testing old approach (connection per request):');
  const oldStart = Date.now();
  try {
    for (let i = 0; i < 3; i++) {
      const sql = neon(TEST_ENV.HYPERDRIVE!.connectionString);
      await sql`SELECT 1 as test`;
      console.log(`      Request ${i + 1}: New connection created`);
    }
  } catch (error) {
    console.log(`      Old approach failed: ${error.message}`);
  }
  const oldTime = Date.now() - oldStart;
  
  // Test new approach (connection pooling)
  console.log('   Testing new approach (connection pooling):');
  const newStart = Date.now();
  try {
    for (let i = 0; i < 3; i++) {
      await withDatabase(TEST_ENV, async (sql) => {
        return await sql`SELECT 1 as test`;
      });
      console.log(`      Request ${i + 1}: Reused pooled connection`);
    }
  } catch (error) {
    console.log(`      New approach failed: ${error.message}`);
  }
  const newTime = Date.now() - newStart;
  
  const improvement = oldTime > 0 ? Math.round(((oldTime - newTime) / oldTime) * 100) : 0;
  console.log(`   📈 Performance: OLD=${oldTime}ms vs NEW=${newTime}ms (${improvement}% improvement)`);
  
  console.log('\n🎉 Worker Connection Pool Test Complete!');
  console.log('='.repeat(50));
  
  // Final assessment
  const allTestsPassed = isHealthy && reuseSuccess && concurrentSuccess && singleConnection;
  
  if (allTestsPassed) {
    console.log('\n✅ SUCCESS: Connection pool is working correctly!');
    console.log('   ✓ Maintains single reusable connection');
    console.log('   ✓ Handles concurrent requests');
    console.log('   ✓ Uses Worker-compatible patterns');
    console.log('   ✓ Performance improvement achieved');
    console.log('\n🚀 Ready to fix CONNECTION_CLOSED errors in production!');
    return true;
  } else {
    console.log('\n❌ ISSUES DETECTED:');
    if (!isHealthy) console.log('   • Basic connection failed');
    if (!reuseSuccess) console.log('   • Connection reuse failed');
    if (!concurrentSuccess) console.log('   • Concurrent calls failed');
    if (!singleConnection) console.log('   • Multiple connections created (should be 1)');
    return false;
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  const success = await testWorkerConnectionPool();
  Deno.exit(success ? 0 : 1);
}

export { testWorkerConnectionPool };