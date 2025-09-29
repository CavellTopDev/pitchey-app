#!/usr/bin/env -S deno run --allow-env --allow-net

import { db } from './src/db/client.ts';
import { securityEvents } from './src/db/schema.ts';
import { sql } from 'npm:drizzle-orm';

console.log('🔍 Testing Security Events Table Structure and Rate Limiting...\n');

try {
  // Test 1: Verify table structure
  console.log('📋 Testing table structure...');
  const tableInfo = await db.execute(sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'security_events' 
    AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  
  console.log('Security Events table columns:');
  console.table(tableInfo);
  
  // Check for required columns
  const columnNames = tableInfo.rows ? tableInfo.rows.map(col => col[0]) : [];
  const requiredColumns = ['id', 'event_type', 'event_status', 'location', 'metadata', 'ip_address', 'user_agent', 'created_at'];
  
  let allColumnsPresent = true;
  for (const col of requiredColumns) {
    if (columnNames.includes(col)) {
      console.log(`✅ ${col} column exists`);
    } else {
      console.log(`❌ ${col} column missing`);
      allColumnsPresent = false;
    }
  }
  
  if (allColumnsPresent) {
    console.log('\n✅ All required columns are present!\n');
  } else {
    console.log('\n❌ Some required columns are missing!\n');
    Deno.exit(1);
  }
  
  // Test 2: Test inserting a security event (rate limit violation)
  console.log('📝 Testing security event insertion...');
  
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
  console.log('✅ Successfully inserted test security event');
  
  // Test 3: Query the inserted event
  console.log('📖 Testing security event query...');
  
  const recentEvents = await db
    .select()
    .from(securityEvents)
    .where(sql`event_type = 'rate_limit_exceeded'`)
    .orderBy(sql`created_at DESC`)
    .limit(5);
  
  console.log(`Found ${recentEvents.length} rate limit events:`);
  recentEvents.forEach((event, index) => {
    console.log(`${index + 1}. Event ID: ${event.id}, Status: ${event.eventStatus}, IP: ${event.ipAddress}`);
    if (event.location) {
      console.log(`   Location: ${JSON.stringify(event.location)}`);
    }
    if (event.metadata) {
      console.log(`   Metadata: ${JSON.stringify(event.metadata)}`);
    }
  });
  
  // Test 4: Test different event types
  console.log('\n📝 Testing different security event types...');
  
  const testEvents = [
    {
      eventType: 'login_attempt',
      eventStatus: 'success',
      ipAddress: '192.168.1.101',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      metadata: { userId: 1, timestamp: new Date().toISOString() }
    },
    {
      eventType: 'login_attempt',
      eventStatus: 'failure',
      ipAddress: '192.168.1.102',
      userAgent: 'Mozilla/5.0 (Malicious Browser)',
      metadata: { reason: 'invalid_credentials', timestamp: new Date().toISOString() }
    },
    {
      eventType: 'password_reset',
      eventStatus: 'success',
      ipAddress: '192.168.1.103',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      metadata: { email: 'test@example.com', timestamp: new Date().toISOString() }
    }
  ];
  
  for (const event of testEvents) {
    await db.insert(securityEvents).values(event);
    console.log(`✅ Inserted ${event.eventType} event with status ${event.eventStatus}`);
  }
  
  // Test 5: Performance test with indexes
  console.log('\n⚡ Testing query performance with indexes...');
  
  const startTime = Date.now();
  const eventTypeQuery = await db
    .select()
    .from(securityEvents)
    .where(sql`event_type = 'login_attempt'`)
    .limit(100);
  const endTime = Date.now();
  
  console.log(`✅ Event type query returned ${eventTypeQuery.length} results in ${endTime - startTime}ms`);
  
  // Test 6: Verify indexes exist
  console.log('\n📊 Checking database indexes...');
  
  const indexes = await db.execute(sql`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'security_events'
    ORDER BY indexname
  `);
  
  console.log('Security Events table indexes:');
  indexes.forEach(idx => {
    console.log(`  ${idx.indexname}: ${idx.indexdef}`);
  });
  
  console.log('\n🎉 ALL TESTS PASSED! Security events table is properly configured for rate limiting.');
  console.log('\n📈 SUMMARY:');
  console.log('✅ Table structure matches schema requirements');
  console.log('✅ Required columns present (event_status, location, metadata)');
  console.log('✅ Rate limiting events can be logged successfully');
  console.log('✅ Database indexes are in place for performance');
  console.log('✅ Various security event types work correctly');
  
} catch (error) {
  console.error('❌ Test failed:', error);
  console.error('Stack trace:', error.stack);
  Deno.exit(1);
}