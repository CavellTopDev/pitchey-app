#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Test database connection with the Cloudflare Worker
 */

async function testDatabaseConnection() {
  const workerUrl = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
  
  console.log('🔍 Testing database connection...\n');
  
  try {
    // Test health endpoint
    console.log('1. Testing /api/health endpoint:');
    const healthResponse = await fetch(`${workerUrl}/api/health`);
    const healthData = await healthResponse.json();
    
    console.log('   Status:', healthResponse.status);
    console.log('   Response:', JSON.stringify(healthData, null, 2));
    
    if (healthData.services?.database?.status === 'connected') {
      console.log('   ✅ Database is connected!');
      console.log('   Database time:', healthData.services.database.time);
    } else {
      console.log('   ❌ Database connection failed');
      if (healthData.services?.database?.error) {
        console.log('   Error:', healthData.services.database.error);
      }
    }
    
    // Test getting pitches (public endpoint)
    console.log('\n2. Testing /api/pitches endpoint:');
    const pitchesResponse = await fetch(`${workerUrl}/api/pitches?limit=5`);
    const pitchesData = await pitchesResponse.json();
    
    console.log('   Status:', pitchesResponse.status);
    if (pitchesResponse.ok) {
      console.log('   ✅ Successfully fetched pitches');
      console.log('   Total pitches:', pitchesData.total);
      console.log('   Returned:', pitchesData.pitches?.length || 0, 'pitches');
    } else {
      console.log('   ❌ Failed to fetch pitches');
      console.log('   Error:', pitchesData.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDatabaseConnection();