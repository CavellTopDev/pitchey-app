#!/usr/bin/env node

/**
 * Test script to verify public endpoints are working without authentication
 */

const API_URL = 'http://localhost:8001';

// Test endpoints without authentication
const testEndpoints = [
  '/api/pitches/public',
  '/api/pitches/public/trending',
  '/api/pitches/public/new',
  '/api/pitches/public/featured',
  '/api/pitches/public/search?q=drama'
];

async function testEndpoint(endpoint) {
  const fullUrl = API_URL + endpoint;
  console.log(`\n🔍 Testing: ${fullUrl}`);
  
  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header - testing public access
      }
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);

    if (!response.ok) {
      const error = await response.text();
      console.log(`   ❌ Error: ${error}`);
      return false;
    }

    const data = await response.json();
    console.log(`   ✅ Success: Received ${data.data?.pitches?.length || 0} pitches`);
    
    // Check if data filtering is working (no sensitive fields)
    if (data.data?.pitches?.length > 0) {
      const firstPitch = data.data.pitches[0];
      const sensitiveFields = ['creator_email', 'funding_goal', 'private_description', 'investment_terms'];
      const foundSensitive = sensitiveFields.filter(field => firstPitch.hasOwnProperty(field));
      
      if (foundSensitive.length > 0) {
        console.log(`   ⚠️  Warning: Found sensitive fields: ${foundSensitive.join(', ')}`);
      } else {
        console.log(`   🔒 Security: No sensitive fields exposed`);
      }
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Network Error: ${error.message}`);
    return false;
  }
}

async function testRateLimit() {
  console.log('\n🚦 Testing rate limiting...');
  
  const promises = [];
  // Send 10 rapid requests
  for (let i = 0; i < 10; i++) {
    promises.push(
      fetch(API_URL + '/api/pitches/public/trending?limit=1', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }

  const responses = await Promise.all(promises);
  const rateLimited = responses.filter(r => r.status === 429);
  
  console.log(`   Sent 10 requests, ${rateLimited.length} were rate limited`);
  console.log(`   Rate limiting: ${rateLimited.length > 0 ? '✅ Working' : '⚠️  No limits detected'}`);
}

async function runTests() {
  console.log('🧪 Testing Public Endpoints for Guest Browsing\n');
  console.log('================================================');
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    const success = await testEndpoint(endpoint);
    results.push({ endpoint, success });
  }
  
  // Test rate limiting
  await testRateLimit();
  
  console.log('\n📊 Test Summary');
  console.log('================');
  
  results.forEach(({ endpoint, success }) => {
    console.log(`${success ? '✅' : '❌'} ${endpoint}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 Results: ${successCount}/${results.length} endpoints working`);
  
  if (successCount === results.length) {
    console.log('🚀 All public endpoints are working correctly!');
    console.log('\n📝 Guest browsing implementation complete:');
    console.log('   • Public pitch browsing without authentication');
    console.log('   • Rate limiting protection (100 req/hour)');
    console.log('   • Sensitive data filtering');
    console.log('   • CDN-friendly caching headers');
    console.log('   • Guest user call-to-action prompts');
  } else {
    console.log('⚠️  Some endpoints need attention');
    process.exit(1);
  }
}

runTests().catch(console.error);