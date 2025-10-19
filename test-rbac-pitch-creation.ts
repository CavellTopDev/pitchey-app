#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * RBAC SECURITY TEST: Verify investors cannot create pitches
 * 
 * This test validates that Role-Based Access Control (RBAC) prevents
 * investors from creating pitches through various attack vectors.
 */

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    username: string;
    userType: string;
    email: string;
  };
  error?: any;
}

interface APIResponse {
  success: boolean;
  data?: any;
  error?: any;
  message?: string;
}

const API_BASE = 'http://localhost:8001';

// Test credentials for investor account
const INVESTOR_CREDENTIALS = {
  email: 'sarah.investor@demo.com',
  password: 'Demo123'
};

// Test pitch data that investor will attempt to create
const TEST_PITCH_DATA = {
  title: 'UNAUTHORIZED PITCH ATTEMPT',
  logline: 'This pitch should NOT be created by an investor',
  genre: 'Drama',
  budget: 1000000,
  description: 'Security test - this should be blocked',
  themes: ['Security', 'Testing'],
  targetAudience: 'Adults',
  status: 'draft'
};

async function makeRequest(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const data = await response.json();
    return {
      status: response.status,
      statusText: response.statusText,
      data
    };
  } catch (error) {
    return {
      status: 0,
      statusText: 'Network Error',
      data: { error: error.message }
    };
  }
}

async function testInvestorLogin(): Promise<{ success: boolean; token?: string; user?: any }> {
  console.log('\n🔐 Testing investor authentication...');
  
  const response = await makeRequest('/api/auth/investor/login', {
    method: 'POST',
    body: JSON.stringify(INVESTOR_CREDENTIALS)
  });
  
  if (response.status === 200 && response.data.success) {
    console.log('✅ Investor login successful');
    console.log(`   User: ${response.data.user.username} (${response.data.user.userType})`);
    return {
      success: true,
      token: response.data.token,
      user: response.data.user
    };
  } else {
    console.log('❌ Investor login failed:', response.data.error);
    return { success: false };
  }
}

async function testPitchCreationEndpoints(token: string) {
  console.log('\n🛡️ Testing pitch creation endpoints with investor token...');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  // Test 1: Main pitch creation endpoint
  console.log('\n📝 Test 1: POST /api/pitches (main endpoint)');
  const response1 = await makeRequest('/api/pitches', {
    method: 'POST',
    headers,
    body: JSON.stringify(TEST_PITCH_DATA)
  });
  
  if (response1.status === 403) {
    console.log('✅ SECURITY OK: Main pitch creation blocked (403 Forbidden)');
    console.log(`   Message: ${response1.data.message || response1.data.error}`);
  } else if (response1.status === 401) {
    console.log('✅ SECURITY OK: Authentication required (401 Unauthorized)');
  } else if (response1.status === 200 || response1.status === 201) {
    console.log('🚨 SECURITY BREACH: Investor was able to create pitch!');
    console.log(`   Response: ${JSON.stringify(response1.data, null, 2)}`);
  } else {
    console.log(`⚠️  Unexpected response: ${response1.status} - ${response1.statusText}`);
    console.log(`   Data: ${JSON.stringify(response1.data, null, 2)}`);
  }
  
  // Test 2: Creator-specific endpoint
  console.log('\n📝 Test 2: POST /api/creator/pitches (creator endpoint)');
  const response2 = await makeRequest('/api/creator/pitches', {
    method: 'POST',
    headers,
    body: JSON.stringify(TEST_PITCH_DATA)
  });
  
  if (response2.status === 403) {
    console.log('✅ SECURITY OK: Creator pitch creation blocked (403 Forbidden)');
    console.log(`   Message: ${response2.data.message || response2.data.error}`);
  } else if (response2.status === 401) {
    console.log('✅ SECURITY OK: Authentication required (401 Unauthorized)');
  } else if (response2.status === 200 || response2.status === 201) {
    console.log('🚨 SECURITY BREACH: Investor was able to create pitch via creator endpoint!');
    console.log(`   Response: ${JSON.stringify(response2.data, null, 2)}`);
  } else {
    console.log(`⚠️  Unexpected response: ${response2.status} - ${response2.statusText}`);
    console.log(`   Data: ${JSON.stringify(response2.data, null, 2)}`);
  }
  
  // Test 3: Draft auto-save endpoint
  console.log('\n📝 Test 3: POST /api/drafts/1/autosave (draft endpoint)');
  const response3 = await makeRequest('/api/drafts/1/autosave', {
    method: 'POST',
    headers,
    body: JSON.stringify({ draftData: TEST_PITCH_DATA })
  });
  
  if (response3.status === 403) {
    console.log('✅ SECURITY OK: Draft auto-save blocked (403 Forbidden)');
    console.log(`   Message: ${response3.data.message || response3.data.error}`);
  } else if (response3.status === 401) {
    console.log('✅ SECURITY OK: Authentication required (401 Unauthorized)');
  } else if (response3.status === 404) {
    console.log('✅ SECURITY OK: Draft not found (legitimate response)');
  } else if (response3.status === 200 || response3.status === 201) {
    console.log('🚨 SECURITY BREACH: Investor was able to save draft!');
    console.log(`   Response: ${JSON.stringify(response3.data, null, 2)}`);
  } else {
    console.log(`⚠️  Unexpected response: ${response3.status} - ${response3.statusText}`);
    console.log(`   Data: ${JSON.stringify(response3.data, null, 2)}`);
  }
}

async function testInvestorPermissions(token: string) {
  console.log('\n🔍 Testing investor-allowed operations...');
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  // Test investor dashboard access
  console.log('\n📊 Testing investor dashboard access...');
  const dashboardResponse = await makeRequest('/api/investor/dashboard', {
    method: 'GET',
    headers
  });
  
  if (dashboardResponse.status === 200) {
    console.log('✅ Investor can access dashboard (expected)');
  } else {
    console.log(`❌ Investor cannot access dashboard: ${dashboardResponse.status}`);
  }
  
  // Test browsing pitches
  console.log('\n🔍 Testing pitch browsing access...');
  const browseResponse = await makeRequest('/api/pitches', {
    method: 'GET',
    headers
  });
  
  if (browseResponse.status === 200) {
    console.log('✅ Investor can browse pitches (expected)');
  } else {
    console.log(`❌ Investor cannot browse pitches: ${browseResponse.status}`);
  }
}

async function runSecurityAudit() {
  console.log('🔒 RBAC SECURITY AUDIT: Pitch Creation Access Control');
  console.log('='.repeat(60));
  console.log('Testing OWASP A01:2021 - Broken Access Control');
  console.log('Validating that investors cannot create pitches\n');
  
  try {
    // Step 1: Authenticate as investor
    const auth = await testInvestorLogin();
    if (!auth.success || !auth.token) {
      console.log('\n❌ Cannot proceed - investor authentication failed');
      return;
    }
    
    // Step 2: Test pitch creation (should be blocked)
    await testPitchCreationEndpoints(auth.token);
    
    // Step 3: Test allowed operations (should work)
    await testInvestorPermissions(auth.token);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🔒 RBAC SECURITY AUDIT COMPLETE');
    console.log('\nExpected Results:');
    console.log('✅ All pitch creation attempts should return 403 Forbidden');
    console.log('✅ Investor dashboard and browsing should work normally');
    console.log('✅ Security events should be logged for audit trail');
    
  } catch (error) {
    console.error('\n💥 Security audit failed:', error);
  }
}

// Run the security audit
if (import.meta.main) {
  await runSecurityAudit();
}