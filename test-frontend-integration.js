#!/usr/bin/env node

// Test script for frontend-worker integration
const API_URL = 'https://pitchey-api-production.cavelltheleaddev.workers.dev';

console.log('🧪 Testing Frontend-Worker Integration\n');

async function testAPI() {
  // Test 1: Health check
  console.log('1. Testing API Health Check...');
  try {
    const health = await fetch(`${API_URL}/api/health`);
    const healthData = await health.json();
    console.log(`   ✅ Health: ${healthData.status} | DB: ${healthData.database} | Users: ${healthData.userCount}`);
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
  }

  // Test 2: Authentication
  console.log('\n2. Testing Authentication...');
  try {
    const auth = await fetch(`${API_URL}/api/auth/creator/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({
        email: 'alex.creator@demo.com',
        password: 'Demo123'
      })
    });
    
    const authData = await auth.json();
    if (authData.token) {
      console.log(`   ✅ Login successful: ${authData.user.displayName} (${authData.user.userType}) | Source: ${authData.user.source}`);
      
      // Test 3: Dashboard with authentication
      console.log('\n3. Testing Creator Dashboard...');
      const dashboard = await fetch(`${API_URL}/api/creator/dashboard`, {
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Origin': 'http://localhost:5173'
        }
      });
      
      const dashboardData = await dashboard.json();
      console.log(`   ✅ Dashboard: ${dashboardData.stats.totalPitches} pitches | ${dashboardData.stats.views} views`);
      
      return authData.token;
    } else {
      console.log(`   ❌ Login failed: ${authData.error}`);
    }
  } catch (error) {
    console.log(`   ❌ Authentication failed: ${error.message}`);
  }
  
  return null;
}

async function testPitches(token) {
  console.log('\n4. Testing Pitch Operations...');
  
  // Test 4a: List pitches
  try {
    const pitches = await fetch(`${API_URL}/api/pitches`, {
      headers: {
        'Origin': 'http://localhost:5173'
      }
    });
    const pitchesData = await pitches.json();
    console.log(`   ✅ Pitches: ${pitchesData.pitches.length} found | Source: ${pitchesData.source}`);
  } catch (error) {
    console.log(`   ❌ List pitches failed: ${error.message}`);
  }
  
  // Test 4b: Create pitch
  if (token) {
    try {
      const newPitch = await fetch(`${API_URL}/api/pitches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': 'http://localhost:5173'
        },
        body: JSON.stringify({
          title: 'Frontend Integration Test',
          genre: 'Drama',
          budget: '1000000',
          description: 'Testing the frontend integration with Worker API'
        })
      });
      
      const newPitchData = await newPitch.json();
      if (newPitchData.pitch) {
        console.log(`   ✅ Pitch created: "${newPitchData.pitch.title}" | ID: ${newPitchData.pitch.id}`);
      } else {
        console.log(`   ❌ Pitch creation failed: ${newPitchData.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Pitch creation failed: ${error.message}`);
    }
  }
}

async function testInvestorFlow() {
  console.log('\n5. Testing Investor Flow...');
  
  try {
    // Login as investor
    const auth = await fetch(`${API_URL}/api/auth/investor/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({
        email: 'sarah.investor@demo.com',
        password: 'Demo123'
      })
    });
    
    const authData = await auth.json();
    if (authData.token) {
      console.log(`   ✅ Investor login: ${authData.user.displayName}`);
      
      // Test investor dashboard
      const dashboard = await fetch(`${API_URL}/api/investor/dashboard`, {
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Origin': 'http://localhost:5173'
        }
      });
      
      const dashboardData = await dashboard.json();
      console.log(`   ✅ Portfolio: ${dashboardData.stats.totalInvestments} investments | $${dashboardData.stats.portfolioValue} value`);
    }
  } catch (error) {
    console.log(`   ❌ Investor flow failed: ${error.message}`);
  }
}

async function testCORS() {
  console.log('\n6. Testing CORS Configuration...');
  
  try {
    const response = await fetch(`${API_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log(`   ✅ CORS preflight: ${response.status === 200 ? 'OK' : 'Failed'}`);
    console.log(`   ✅ CORS headers: ${response.headers.get('Access-Control-Allow-Origin') || 'Not set'}`);
  } catch (error) {
    console.log(`   ❌ CORS test failed: ${error.message}`);
  }
}

// Run all tests
async function runTests() {
  const token = await testAPI();
  await testPitches(token);
  await testInvestorFlow();
  await testCORS();
  
  console.log('\n🎉 Frontend integration testing complete!');
  console.log('📱 Frontend URL: http://localhost:5173');
  console.log('🔗 Worker API URL:', API_URL);
}

runTests().catch(console.error);