// Test script for the latest deployment
// URL: https://pitchey-backend-fresh-tvwzsjy9mb99.deno.dev

async function testDeployment() {
  const baseUrl = 'https://pitchey-backend-fresh-tvwzsjy9mb99.deno.dev';
  
  console.log('🔍 Testing latest deployment...');
  console.log(`URL: ${baseUrl}`);
  
  // Test endpoints
  const endpoints = [
    '/api/health',
    '/api/auth/creator/login', 
    '/api/pitches',
    '/api/users'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📍 Testing: ${endpoint}`);
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: endpoint.includes('login') ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: endpoint.includes('login') ? JSON.stringify({
          email: 'alex.creator@demo.com',
          password: 'Demo123'
        }) : undefined
      });
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Status Text: ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`   Error Response: ${errorText}`);
      } else {
        const data = await response.json().catch(() => 'Non-JSON response');
        console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Fetch Error: ${error.message}`);
    }
  }
  
  // Test environment by checking a simple endpoint response
  console.log('\n🔧 Environment Check:');
  try {
    const response = await fetch(`${baseUrl}/`);
    console.log(`   Root Status: ${response.status}`);
    const text = await response.text();
    console.log(`   Root Response Length: ${text.length}`);
    
    if (text.includes('Missing required environment variables')) {
      console.log('   ❌ Environment variables still missing');
    } else if (text.includes('Environment validation failed')) {
      console.log('   ❌ Environment validation failed');  
    } else {
      console.log('   ✅ No obvious environment errors in root response');
    }
    
  } catch (error) {
    console.log(`   ❌ Root endpoint error: ${error.message}`);
  }
}

if (import.meta.main) {
  testDeployment();
}