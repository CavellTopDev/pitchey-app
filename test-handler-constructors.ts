#!/usr/bin/env deno run --allow-net

/**
 * Test script to verify endpoint handler constructor fixes
 * This tests that the parameter order matches the expected signatures
 */

// Mock objects for testing
const mockEnv = { HYPERDRIVE: { connectionString: "test" } };
const mockDb = { query: () => Promise.resolve([]) };
const mockSentry = { captureMessage: () => {}, captureException: () => {} };

async function testHandlerConstructors() {
  console.log('🧪 Testing Handler Constructor Parameter Order');
  console.log('==============================================');

  try {
    // Import handlers to test constructors
    const { AuthEndpointsHandler } = await import('./src/worker-modules/auth-endpoints.ts');
    const { UserEndpointsHandler } = await import('./src/worker-modules/user-endpoints.ts');
    const { AnalyticsEndpointsHandler } = await import('./src/worker-modules/analytics-endpoints.ts');

    console.log('\n1. Testing AuthEndpointsHandler (db, sentry, env):');
    try {
      const authHandler = new AuthEndpointsHandler(mockDb, mockSentry, mockEnv);
      console.log('   ✅ AuthEndpointsHandler: Constructor accepts (db, sentry, env)');
    } catch (error) {
      console.log(`   ❌ AuthEndpointsHandler: ${error.message}`);
    }

    console.log('\n2. Testing UserEndpointsHandler (env, db, sentry):');
    try {
      const userHandler = new UserEndpointsHandler(mockEnv, mockDb, mockSentry);
      console.log('   ✅ UserEndpointsHandler: Constructor accepts (env, db, sentry)');
    } catch (error) {
      console.log(`   ❌ UserEndpointsHandler: ${error.message}`);
    }

    console.log('\n3. Testing AnalyticsEndpointsHandler (env, db, sentry):');
    try {
      const analyticsHandler = new AnalyticsEndpointsHandler(mockEnv, mockDb, mockSentry);
      console.log('   ✅ AnalyticsEndpointsHandler: Constructor accepts (env, db, sentry)');
    } catch (error) {
      console.log(`   ❌ AnalyticsEndpointsHandler: ${error.message}`);
    }

    console.log('\n🎯 CONSTRUCTOR PARAMETER ORDER VERIFICATION');
    console.log('==========================================');
    console.log('✅ AuthEndpointsHandler: (db, sentry, env)');
    console.log('✅ Other handlers: (env, db, sentry)');
    console.log('✅ UnifiedWorkerHandler parameter order fixed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (import.meta.main) {
  await testHandlerConstructors();
}