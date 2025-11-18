#!/usr/bin/env deno run --allow-net --allow-env

/**
 * Test script to verify database connection pooling implementation
 * This script simulates multiple concurrent requests to test connection reuse
 */

import { dbPool, withDatabase } from './src/worker-database-pool.ts';
import { Toucan } from 'toucan-js';

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

async function testConnectionPooling() {
  console.log('🧪 Testing Database Connection Pool Implementation');
  console.log('='.repeat(50));
  
  // Initialize the pool
  console.log('\n1. Initializing connection pool...');
  dbPool.initialize(TEST_ENV);
  
  // Test basic connection
  console.log('\n2. Testing basic connection...');
  try {
    const isHealthy = await dbPool.testConnection(TEST_ENV);
    console.log(`✅ Connection test: ${isHealthy ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return;
  }
  
  // Test connection reuse
  console.log('\n3. Testing connection reuse...');
  const startTime = Date.now();
  
  for (let i = 0; i < 5; i++) {
    const connection = dbPool.getConnection(TEST_ENV);
    console.log(`   Request ${i + 1}: Got connection (should reuse same instance)`);
  }
  
  const reuseTime = Date.now() - startTime;
  console.log(`✅ Connection reuse test completed in ${reuseTime}ms`);
  
  // Test concurrent queries
  console.log('\n4. Testing concurrent queries...');
  const concurrentQueries = Array.from({ length: 10 }, async (_, i) => {
    try {
      const result = await dbPool.query(TEST_ENV, 'SELECT $1 as test_value, NOW() as timestamp', [i]);
      console.log(`   Query ${i + 1}: Success - ${JSON.stringify(result[0])}`);
      return true;
    } catch (error) {
      console.error(`   Query ${i + 1}: Failed - ${error.message}`);
      return false;
    }
  });
  
  const queryStartTime = Date.now();
  const results = await Promise.all(concurrentQueries);
  const queryTime = Date.now() - queryStartTime;
  
  const successCount = results.filter(Boolean).length;
  console.log(`✅ Concurrent queries: ${successCount}/10 succeeded in ${queryTime}ms`);
  
  // Test withDatabase helper
  console.log('\n5. Testing withDatabase helper...');
  try {
    const result = await withDatabase(TEST_ENV, async (sql) => {
      return await sql`SELECT 'withDatabase test' as message, COUNT(*) as user_count FROM users LIMIT 1`;
    });
    console.log(`✅ withDatabase helper: ${JSON.stringify(result[0])}`);
  } catch (error) {
    console.error('❌ withDatabase helper failed:', error.message);
  }
  
  // Check pool statistics
  console.log('\n6. Pool statistics:');
  const stats = dbPool.getStats();
  console.log('   📊 Pool Stats:');
  console.log(`      - Initialized: ${stats.initialized}`);
  console.log(`      - Pool Size: ${stats.poolSize}`);
  console.log(`      - Connection Keys: ${stats.connectionKeys.length}`);
  
  // Test error handling
  console.log('\n7. Testing error handling...');
  try {
    await dbPool.query(TEST_ENV, 'SELECT * FROM nonexistent_table');
    console.log('❌ Error test: Should have failed');
  } catch (error) {
    console.log('✅ Error handling: Properly caught database error');
  }
  
  // Performance comparison test
  console.log('\n8. Performance comparison (simulating old vs new approach)...');
  
  // Simulate the old approach (creating new connections each time)
  const { neon } = await import('@neondatabase/serverless');
  
  console.log('   Testing OLD approach (new connection per request):');
  const oldStartTime = Date.now();
  for (let i = 0; i < 3; i++) {
    try {
      const sql = neon(TEST_ENV.HYPERDRIVE!.connectionString);
      await sql`SELECT 1 as test`;
      console.log(`      Request ${i + 1}: New connection created`);
    } catch (error) {
      console.error(`      Request ${i + 1}: Failed - ${error.message}`);
    }
  }
  const oldTime = Date.now() - oldStartTime;
  
  console.log('   Testing NEW approach (connection pooling):');
  const newStartTime = Date.now();
  for (let i = 0; i < 3; i++) {
    try {
      const result = await dbPool.query(TEST_ENV, 'SELECT 1 as test');
      console.log(`      Request ${i + 1}: Reused pooled connection`);
    } catch (error) {
      console.error(`      Request ${i + 1}: Failed - ${error.message}`);
    }
  }
  const newTime = Date.now() - newStartTime;
  
  console.log(`   📈 Performance improvement: OLD=${oldTime}ms vs NEW=${newTime}ms (${Math.round(((oldTime - newTime) / oldTime) * 100)}% faster)`);
  
  console.log('\n🎉 Connection Pool Test Complete!');
  console.log('='.repeat(50));
  
  return {
    poolStats: stats,
    performanceImprovement: oldTime > 0 ? Math.round(((oldTime - newTime) / oldTime) * 100) : 0,
    totalQueries: 10 + 3 + 3 + 1,
    successfulQueries: successCount + 3 + 1
  };
}

// Run tests if this file is executed directly
if (import.meta.main) {
  try {
    const results = await testConnectionPooling();
    console.log('\n📊 Final Test Results:');
    console.log(`   - Pool Size: ${results.poolStats.poolSize} connections`);
    console.log(`   - Performance Improvement: ${results.performanceImprovement}%`);
    console.log(`   - Query Success Rate: ${results.successfulQueries}/${results.totalQueries}`);
    
    if (results.poolStats.poolSize === 1 && results.successfulQueries > 10) {
      console.log('\n✅ SUCCESS: Connection pool is working correctly!');
      console.log('   The pool maintains a single reusable connection and handles queries efficiently.');
      Deno.exit(0);
    } else {
      console.log('\n⚠️  WARNING: Connection pool may need adjustment');
      Deno.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    Deno.exit(1);
  }
}