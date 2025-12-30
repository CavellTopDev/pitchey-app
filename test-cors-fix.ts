// Test CORS configuration
async function testCorsFromFrontend() {
  const frontendOrigin = 'https://pitchey-5o8.pages.dev';
  const backendUrl = 'https://pitchey-backend-fresh-sxp78xb7z1at.deno.dev';
  
  console.log('🔧 Testing CORS configuration...');
  console.log(`Frontend Origin: ${frontendOrigin}`);
  console.log(`Backend URL: ${backendUrl}`);
  
  // Test OPTIONS preflight for auth endpoint
  console.log('\n📍 Testing OPTIONS preflight for /api/auth/creator/login...');
  try {
    const preflightResponse = await fetch(`${backendUrl}/api/auth/creator/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': frontendOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    
    console.log(`   Status: ${preflightResponse.status}`);
    console.log(`   Status Text: ${preflightResponse.statusText}`);
    
    const corsHeaders = {};
    preflightResponse.headers.forEach((value, key) => {
      if (key.toLowerCase().includes('access-control') || key.toLowerCase().includes('cors')) {
        corsHeaders[key] = value;
      }
    });
    
    console.log(`   CORS Headers: ${JSON.stringify(corsHeaders, null, 2)}`);
    
    if (preflightResponse.status !== 204) {
      const text = await preflightResponse.text();
      console.log(`   Response Body: ${text}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Preflight Error: ${error.message}`);
  }
  
  // Test actual POST request
  console.log('\n📍 Testing POST request to /api/auth/creator/login...');
  try {
    const response = await fetch(`${backendUrl}/api/auth/creator/login`, {
      method: 'POST',
      headers: {
        'Origin': frontendOrigin,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test123'
      })
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Status Text: ${response.statusText}`);
    
    const corsHeaders = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().includes('access-control') || key.toLowerCase().includes('cors')) {
        corsHeaders[key] = value;
      }
    });
    
    console.log(`   CORS Headers: ${JSON.stringify(corsHeaders, null, 2)}`);
    
    const responseText = await response.text();
    console.log(`   Response: ${responseText}`);
    
  } catch (error) {
    console.log(`   ❌ POST Error: ${error.message}`);
  }
  
  // Test health endpoint
  console.log('\n📍 Testing GET request to /api/health...');
  try {
    const response = await fetch(`${backendUrl}/api/health`, {
      headers: {
        'Origin': frontendOrigin
      }
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Status Text: ${response.statusText}`);
    
    if (response.status === 200) {
      const data = await response.json();
      console.log(`   Health Data: ${JSON.stringify(data, null, 2)}`);
    } else {
      const text = await response.text();
      console.log(`   Error Response: ${text}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Health Check Error: ${error.message}`);
  }
}

if (import.meta.main) {
  testCorsFromFrontend();
}