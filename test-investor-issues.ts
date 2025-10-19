#!/usr/bin/env -S deno run --allow-all

// Test script to verify investor login and dashboard functionality
const BASE_URL = 'http://localhost:8001';

async function testInvestorLogin() {
  console.log('\n🔍 Testing Investor Login...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/investor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sarah.investor@demo.com',
        password: 'Demo123'
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Investor login successful');
      console.log('📝 User data:', JSON.stringify(data.user, null, 2));
      return data.token;
    } else {
      console.error('❌ Investor login failed:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Investor login error:', error);
    return null;
  }
}

async function testInvestorDashboard(token: string) {
  console.log('\n📊 Testing Investor Dashboard...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/investor/dashboard`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Investor dashboard loaded successfully');
      console.log('📊 Dashboard data:', JSON.stringify(data, null, 2));
      return true;
    } else {
      console.error('❌ Investor dashboard failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Investor dashboard error:', error);
    return false;
  }
}

async function testInvestorPortfolio(token: string) {
  console.log('\n💼 Testing Investor Portfolio endpoints...');
  
  const endpoints = [
    '/api/investor/portfolio/summary',
    '/api/investor/portfolio/performance',
    '/api/investor/preferences'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${endpoint} - Success`);
      } else {
        console.log(`⚠️ ${endpoint} - Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error}`);
    }
  }
}

async function testLogoutEndpoint() {
  console.log('\n🚪 Testing Logout functionality...');
  
  // Test if there's a logout endpoint on the server
  try {
    const response = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`Logout endpoint status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log('Logout response:', data);
    }
  } catch (error) {
    console.log('❌ No logout endpoint found or error:', error);
  }
}

async function main() {
  console.log('🎯 INVESTOR FUNCTIONALITY TEST');
  console.log('Testing investor login, dashboard, and logout functionality');
  
  // Test login
  const token = await testInvestorLogin();
  
  if (token) {
    // Test dashboard
    await testInvestorDashboard(token);
    
    // Test portfolio endpoints
    await testInvestorPortfolio(token);
  }
  
  // Test logout
  await testLogoutEndpoint();
  
  console.log('\n🎯 Test completed');
}

// Run tests
main().catch(console.error);