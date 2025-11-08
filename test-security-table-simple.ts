#!/usr/bin/env -S deno run --allow-env --allow-net

import { db } from './src/db/client.ts';
import { securityEvents } from './src/db/schema.ts';
import { eq } from 'npm:drizzle-orm@0.35.3';

console.log('🔍 Testing Security Events Table for Rate Limiting...\n');

try {
  // Test 1: Insert a rate limit security event
  console.log('📝 Testing rate limit security event insertion...');
  
  const testEvent = {
    eventType: 'rate_limit_exceeded',
    eventStatus: 'warning',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Test Browser)',
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
      timestamp: new Date().toISOString()
    }
  };
  
  const insertResult = await db.insert(securityEvents).values(testEvent);
  console.log('✅ Successfully inserted rate limit security event');
  
  // Test 2: Query rate limit events
  console.log('📖 Querying rate limit events...');
  
  const rateLimitEvents = await db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.eventType, 'rate_limit_exceeded'))
    .limit(3);
  
  console.log(`Found ${rateLimitEvents.length} rate limit events:`);
  rateLimitEvents.forEach((event, index) => {
    console.log(`${index + 1}. Event ID: ${event.id}`);
    console.log(`   Type: ${event.eventType}, Status: ${event.eventStatus}`);
    console.log(`   IP: ${event.ipAddress}`);
    if (event.location) {
      console.log(`   Location: ${JSON.stringify(event.location)}`);
    }
    if (event.metadata) {
      console.log(`   Metadata: ${JSON.stringify(event.metadata)}`);
    }
    console.log(`   Created: ${event.createdAt}`);
    console.log('');
  });
  
  // Test 3: Test different security event types
  console.log('📝 Testing other security event types...');
  
  const loginFailEvent = {
    eventType: 'login_attempt',
    eventStatus: 'failure',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Suspicious Browser)',
    metadata: {
      reason: 'invalid_credentials',
      attempts: 3,
      timestamp: new Date().toISOString()
    }
  };
  
  await db.insert(securityEvents).values(loginFailEvent);
  console.log('✅ Successfully inserted login failure event');
  
  // Test 4: Verify column existence
  console.log('🔍 Verifying all required columns exist...');
  
  const allEvents = await db.select().from(securityEvents).limit(1);
  if (allEvents.length > 0) {
    const event = allEvents[0];
    const hasEventStatus = 'eventStatus' in event;
    const hasLocation = 'location' in event;
    const hasMetadata = 'metadata' in event;
    
    console.log(`✅ event_status column: ${hasEventStatus ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ location column: ${hasLocation ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ metadata column: ${hasMetadata ? 'EXISTS' : 'MISSING'}`);
    
    if (hasEventStatus && hasLocation && hasMetadata) {
      console.log('\n🎉 ALL REQUIRED COLUMNS ARE PRESENT!');
    } else {
      console.log('\n❌ Some required columns are missing!');
      Deno.exit(1);
    }
  }
  
  console.log('\n✅ SUCCESS: Security events table is properly configured for rate limiting!');
  console.log('✅ Rate limiting can now log events without database errors');
  console.log('✅ Both location and event_status columns are working correctly');
  
} catch (error) {
  console.error('❌ Test failed:', error);
  console.error('Stack trace:', error.stack);
  Deno.exit(1);
}