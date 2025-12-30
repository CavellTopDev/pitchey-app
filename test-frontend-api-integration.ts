/**
 * Test frontend-backend API integration
 * Verifies all endpoints the frontend expects are implemented in the Worker
 */

// API endpoints the frontend expects (based on typical usage)
const EXPECTED_ENDPOINTS = [
  // Authentication
  { method: 'POST', path: '/api/auth/creator/login', description: 'Creator login' },
  { method: 'POST', path: '/api/auth/investor/login', description: 'Investor login' },
  { method: 'POST', path: '/api/auth/production/login', description: 'Production login' },
  
  // Core data
  { method: 'GET', path: '/api/users', description: 'Get all users' },
  { method: 'GET', path: '/api/pitches', description: 'Get all pitches' },
  { method: 'GET', path: '/api/pitches/1', description: 'Get single pitch' },
  { method: 'POST', path: '/api/pitches', description: 'Create new pitch' },
  { method: 'GET', path: '/api/pitches/featured', description: 'Get featured pitches' },
  
  // Dashboard endpoints
  { method: 'GET', path: '/api/creator/dashboard', description: 'Creator dashboard data' },
  { method: 'GET', path: '/api/investor/dashboard', description: 'Investor dashboard data' },
  { method: 'GET', path: '/api/production/dashboard', description: 'Production dashboard data' },
  
  // System endpoints
  { method: 'GET', path: '/api/health', description: 'Health check' },
];

// Expected response structure for each endpoint
const EXPECTED_RESPONSES = {
  '/api/users': {
    users: 'array',
    source: 'string'
  },
  '/api/pitches': {
    pitches: 'array',
    source: 'string'
  },
  '/api/health': {
    status: 'string',
    database: 'string',
    timestamp: 'string'
  },
  '/api/creator/dashboard': {
    stats: 'object',
    recentPitches: 'array'
  }
};

async function testEndpoint(baseUrl: string, endpoint: any): Promise<boolean> {
  try {
    const url = `${baseUrl}${endpoint.path}`;
    
    let options: RequestInit = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInVzZXJUeXBlIjoiY3JlYXRvciIsImV4cCI6MTcwMTAwMDAwMDAwMH0='
      }
    };

    // Add body for POST requests
    if (endpoint.method === 'POST') {
      if (endpoint.path.includes('login')) {
        options.body = JSON.stringify({
          email: 'alex.creator@demo.com',
          password: 'Demo123'
        });
      } else if (endpoint.path.includes('pitches')) {
        options.body = JSON.stringify({
          title: 'Test Pitch',
          genre: 'Drama',
          budgetRange: '$1M - $5M',
          description: 'A test pitch',
          logline: 'Test logline'
        });
      }
    }

    console.log(`  Testing ${endpoint.method} ${endpoint.path}...`);
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      console.log(`    ❌ Status: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    
    // Validate response structure if expected
    const expectedStructure = EXPECTED_RESPONSES[endpoint.path];
    if (expectedStructure) {
      for (const [key, expectedType] of Object.entries(expectedStructure)) {
        if (!(key in data)) {
          console.log(`    ❌ Missing property: ${key}`);
          return false;
        }
        
        const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
        if (actualType !== expectedType) {
          console.log(`    ❌ Wrong type for ${key}: expected ${expectedType}, got ${actualType}`);
          return false;
        }
      }
    }

    console.log(`    ✅ Success (${response.status})`);
    if (data.source) console.log(`    📊 Data source: ${data.source}`);
    if (data.dbConnected !== undefined) console.log(`    🔌 DB connected: ${data.dbConnected}`);
    
    return true;
  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    return false;
  }
}

async function testWorkerAPI() {
  console.log("🔗 Testing Worker API Integration\n");
  
  // Test against production URL (if deployed) and local backend as fallback
  const testUrls = [
    'https://pitchey-api-prod.ndlovucavelle.workers.dev',
    'https://pitchey-backend-fresh.deno.dev',
    'http://localhost:8001'
  ];
  
  let workingUrl = null;
  
  // Find a working URL
  for (const url of testUrls) {
    try {
      console.log(`🔍 Testing connection to ${url}...`);
      const response = await fetch(`${url}/api/health`);
      if (response.ok) {
        workingUrl = url;
        console.log(`✅ Connected to ${url}\n`);
        break;
      }
    } catch (error) {
      console.log(`❌ Cannot connect to ${url}`);
    }
  }
  
  if (!workingUrl) {
    console.log("❌ No working API URL found. Make sure the backend or worker is running.");
    return;
  }
  
  // Test all endpoints
  let passed = 0;
  let total = EXPECTED_ENDPOINTS.length;
  
  console.log(`📋 Testing ${total} endpoints...\n`);
  
  for (const endpoint of EXPECTED_ENDPOINTS) {
    const success = await testEndpoint(workingUrl, endpoint);
    if (success) passed++;
  }
  
  console.log(`\n📊 Test Results: ${passed}/${total} endpoints working (${Math.round(passed/total*100)}%)`);
  
  if (passed === total) {
    console.log("🎉 All API endpoints are working correctly!");
    console.log("✅ Frontend-backend integration should work perfectly");
  } else {
    console.log("⚠️  Some endpoints need attention");
    console.log("🔧 Check the Worker implementation for missing endpoints");
  }
  
  // Test CORS
  console.log("\n🌐 Testing CORS configuration...");
  try {
    const response = await fetch(`${workingUrl}/api/health`, {
      method: 'OPTIONS'
    });
    if (response.ok) {
      console.log("✅ CORS preflight requests work");
    } else {
      console.log("❌ CORS preflight failed");
    }
  } catch (error) {
    console.log("❌ CORS test failed:", error.message);
  }
}

if (import.meta.main) {
  await testWorkerAPI();
  Deno.exit(0);
}