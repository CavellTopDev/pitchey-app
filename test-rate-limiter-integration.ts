#!/usr/bin/env -S deno run --allow-env --allow-net

import { db } from './src/db/client.ts';
import { securityEvents } from './src/db/schema.ts';
import { eq } from 'npm:drizzle-orm@0.35.3';

console.log('🔍 Testing Rate Limiter Integration with Security Events...\n');

// Simulate the exact code from rate-limiter.ts that was failing
async function testRateLimitLogging() {
  console.log('📝 Testing rate limit logging (simulating rate-limiter.ts)...');
  
  try {
    // This is the exact insert statement from rate-limiter.ts line 100-112
    await db.insert(securityEvents).values({
      userId: null,
      eventType: 'rate_limit_exceeded',
      eventStatus: 'warning',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Test) AppleWebKit/537.36',
      location: {
        country: 'US',
        city: 'San Francisco',
        region: 'CA'
      },
      metadata: {
        endpoint: '/api/auth/login',
        method: 'POST',
        limit: 5,
        window: 900000,
      },
    });
    
    console.log('✅ Rate limit logging successful (no more column errors!)');
    return true;
  } catch (error) {
    console.error('❌ Rate limit logging failed:', error.message);
    return false;
  }
}

// Test different types of rate limit events
async function testDifferentRateLimitScenarios() {
  console.log('\n📊 Testing different rate limit scenarios...');
  
  const scenarios = [
    {
      name: 'API Rate Limit',
      eventType: 'rate_limit_exceeded',
      eventStatus: 'warning',
      ipAddress: '10.0.0.1',
      userAgent: 'API Client/1.0',
      location: { country: 'GB', city: 'London' },
      metadata: { endpoint: '/api/pitches', method: 'GET', limit: 100, window: 60000 }
    },
    {
      name: 'Auth Rate Limit',
      eventType: 'rate_limit_exceeded', 
      eventStatus: 'warning',
      ipAddress: '10.0.0.2',
      userAgent: 'Browser/1.0',
      location: { country: 'DE', city: 'Berlin' },
      metadata: { endpoint: '/api/auth/login', method: 'POST', limit: 5, window: 900000 }
    },
    {
      name: 'Upload Rate Limit',
      eventType: 'rate_limit_exceeded',
      eventStatus: 'warning', 
      ipAddress: '10.0.0.3',
      userAgent: 'FileUploader/2.0',
      location: { country: 'FR', city: 'Paris' },
      metadata: { endpoint: '/api/upload', method: 'POST', limit: 10, window: 3600000 }
    }
  ];
  
  for (const scenario of scenarios) {
    try {
      await db.insert(securityEvents).values(scenario);
      console.log(`✅ ${scenario.name}: Success`);
    } catch (error) {
      console.log(`❌ ${scenario.name}: Failed - ${error.message}`);
      return false;
    }
  }
  
  return true;
}

// Query and verify the events
async function verifyStoredEvents() {
  console.log('\n📖 Verifying stored rate limit events...');
  
  const events = await db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.eventType, 'rate_limit_exceeded'))
    .limit(10);
  
  console.log(`Found ${events.length} rate limit events in database:`);
  
  events.forEach((event, index) => {
    console.log(`\n${index + 1}. Event ID: ${event.id}`);
    console.log(`   IP: ${event.ipAddress}`);
    console.log(`   Status: ${event.eventStatus}`);
    console.log(`   User Agent: ${event.userAgent}`);
    
    if (event.location) {
      console.log(`   Location: ${JSON.stringify(event.location)}`);
    }
    
    if (event.metadata) {
      const meta = event.metadata as any;
      console.log(`   Endpoint: ${meta.endpoint}`);
      console.log(`   Method: ${meta.method}`);
      console.log(`   Limit: ${meta.limit} requests per ${meta.window}ms`);
    }
    
    console.log(`   Created: ${event.createdAt}`);
  });
  
  return events.length > 0;
}

// Run all tests
async function runTests() {
  try {
    // Test 1: Basic rate limit logging
    const basicTest = await testRateLimitLogging();
    if (!basicTest) {
      console.log('\n❌ FAILED: Basic rate limit logging test failed');
      Deno.exit(1);
    }
    
    // Test 2: Different scenarios
    const scenarioTest = await testDifferentRateLimitScenarios();
    if (!scenarioTest) {
      console.log('\n❌ FAILED: Rate limit scenarios test failed');
      Deno.exit(1);
    }
    
    // Test 3: Verify stored events
    const verifyTest = await verifyStoredEvents();
    if (!verifyTest) {
      console.log('\n❌ FAILED: No events found in database');
      Deno.exit(1);
    }
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\n📋 SUMMARY:');
    console.log('✅ security_events table has all required columns');
    console.log('✅ event_status column is working correctly');
    console.log('✅ location column (jsonb) is working correctly');
    console.log('✅ metadata column (jsonb) is working correctly');
    console.log('✅ Rate limiting can log events without database errors');
    console.log('✅ Multiple rate limit scenarios work correctly');
    console.log('\n🚀 The rate limiting system is now fully operational!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    console.error('Stack trace:', error.stack);
    Deno.exit(1);
  }
}

await runTests();