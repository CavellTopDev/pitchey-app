#!/usr/bin/env -S deno run --allow-net

/**
 * Security Test Suite for Cloudflare Worker
 * Tests role-based access control and authentication
 */

const API_URL = 'https://pitchey-api-production.cavelltheleaddev.workers.dev';
// const API_URL = 'http://localhost:8787'; // For local testing with wrangler

// Test credentials
const TEST_USERS = {
  creator: {
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    token: 'demo-creator-1',
    expectedRole: 'creator'
  },
  investor: {
    email: 'sarah.investor@demo.com', 
    password: 'Demo123',
    token: 'demo-investor-2',
    expectedRole: 'investor'
  },
  production: {
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    token: 'demo-production-3',
    expectedRole: 'production'
  }
};

// Color codes for output
const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m'
};

// Test result tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults: Array<{name: string, passed: boolean, details: string}> = [];

async function runTest(testName: string, testFn: () => Promise<boolean>) {
  totalTests++;
  console.log(`\n${COLORS.BLUE}Testing: ${testName}${COLORS.RESET}`);
  
  try {
    const passed = await testFn();
    if (passed) {
      passedTests++;
      console.log(`${COLORS.GREEN}✓ PASSED${COLORS.RESET}`);
      testResults.push({name: testName, passed: true, details: 'Test passed'});
    } else {
      failedTests++;
      console.log(`${COLORS.RED}✗ FAILED${COLORS.RESET}`);
      testResults.push({name: testName, passed: false, details: 'Test assertion failed'});
    }
    return passed;
  } catch (error: any) {
    failedTests++;
    console.log(`${COLORS.RED}✗ FAILED: ${error.message}${COLORS.RESET}`);
    testResults.push({name: testName, passed: false, details: error.message});
    return false;
  }
}

// Test functions
async function testValidateToken(userType: keyof typeof TEST_USERS) {
  const response = await fetch(`${API_URL}/api/validate-token`, {
    headers: {
      'Authorization': `Bearer ${TEST_USERS[userType].token}`
    }
  });
  
  if (!response.ok) {
    console.log(`Response status: ${response.status}`);
    const text = await response.text();
    console.log(`Response body: ${text}`);
    return false;
  }
  
  const data = await response.json();
  console.log(`Token validation result:`, data);
  
  return data.valid === true && data.user?.userType === TEST_USERS[userType].expectedRole;
}

async function testProfile(userType: keyof typeof TEST_USERS) {
  const response = await fetch(`${API_URL}/api/profile`, {
    headers: {
      'Authorization': `Bearer ${TEST_USERS[userType].token}`
    }
  });
  
  if (!response.ok) {
    console.log(`Response status: ${response.status}`);
    const text = await response.text();
    console.log(`Response body: ${text}`);
    return false;
  }
  
  const data = await response.json();
  console.log(`Profile result:`, data);
  
  return data.success === true && 
         data.profile?.userType === TEST_USERS[userType].expectedRole &&
         data.profile?.email === TEST_USERS[userType].email;
}

async function testCreatorPitchesAccess(userType: keyof typeof TEST_USERS, shouldHaveAccess: boolean) {
  const response = await fetch(`${API_URL}/api/creator/pitches`, {
    headers: {
      'Authorization': `Bearer ${TEST_USERS[userType].token}`
    }
  });
  
  const data = await response.json();
  console.log(`${userType} accessing /api/creator/pitches:`, {
    status: response.status,
    success: data.success,
    error: data.error,
    requiredRole: data.requiredRole,
    currentRole: data.currentRole
  });
  
  if (shouldHaveAccess) {
    // Should get 200 OK with data
    return response.status === 200 && data.success === true;
  } else {
    // Should get 403 Forbidden with role mismatch error
    return response.status === 403 && 
           data.success === false &&
           data.requiredRole === 'creator' &&
           data.currentRole === TEST_USERS[userType].expectedRole;
  }
}

async function testInvestorDashboardAccess(userType: keyof typeof TEST_USERS, shouldHaveAccess: boolean) {
  const response = await fetch(`${API_URL}/api/investor/dashboard`, {
    headers: {
      'Authorization': `Bearer ${TEST_USERS[userType].token}`
    }
  });
  
  const data = await response.json();
  console.log(`${userType} accessing /api/investor/dashboard:`, {
    status: response.status,
    success: data.success,
    error: data.error,
    requiredRole: data.requiredRole,
    currentRole: data.currentRole
  });
  
  if (shouldHaveAccess) {
    // Should get 200 OK with dashboard data
    return response.status === 200 && data.success === true && data.data !== undefined;
  } else {
    // Should get 403 Forbidden with role mismatch error
    return response.status === 403 && 
           data.success === false &&
           data.requiredRole === 'investor' &&
           data.currentRole === TEST_USERS[userType].expectedRole;
  }
}

async function testProductionDashboardAccess(userType: keyof typeof TEST_USERS, shouldHaveAccess: boolean) {
  const response = await fetch(`${API_URL}/api/production/dashboard`, {
    headers: {
      'Authorization': `Bearer ${TEST_USERS[userType].token}`
    }
  });
  
  const data = await response.json();
  console.log(`${userType} accessing /api/production/dashboard:`, {
    status: response.status,
    success: data.success,
    error: data.error,
    requiredRole: data.requiredRole,
    currentRole: data.currentRole
  });
  
  if (shouldHaveAccess) {
    // Should get 200 OK with dashboard data
    return response.status === 200 && data.success === true && data.data !== undefined;
  } else {
    // Should get 403 Forbidden with role mismatch error
    return response.status === 403 && 
           data.success === false &&
           data.requiredRole === 'production' &&
           data.currentRole === TEST_USERS[userType].expectedRole;
  }
}

async function testUnauthenticatedAccess() {
  const endpoints = [
    '/api/creator/pitches',
    '/api/investor/dashboard',
    '/api/production/dashboard',
    '/api/profile',
    '/api/validate-token'
  ];
  
  for (const endpoint of endpoints) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        // No Authorization header
      }
    });
    
    console.log(`Unauthenticated access to ${endpoint}: Status ${response.status}`);
    
    if (response.status !== 401) {
      console.log(`${COLORS.RED}SECURITY ISSUE: ${endpoint} should return 401 for unauthenticated requests${COLORS.RESET}`);
      return false;
    }
  }
  
  return true;
}

// Main test suite
async function runSecurityTests() {
  console.log(`${COLORS.YELLOW}========================================`);
  console.log(`SECURITY TEST SUITE FOR CLOUDFLARE WORKER`);
  console.log(`API URL: ${API_URL}`);
  console.log(`========================================${COLORS.RESET}`);
  
  // Test 1: Validate Token Endpoint
  console.log(`\n${COLORS.YELLOW}=== VALIDATE TOKEN TESTS ===${COLORS.RESET}`);
  await runTest('Creator token validation', () => testValidateToken('creator'));
  await runTest('Investor token validation', () => testValidateToken('investor'));
  await runTest('Production token validation', () => testValidateToken('production'));
  
  // Test 2: Profile Endpoint
  console.log(`\n${COLORS.YELLOW}=== PROFILE ENDPOINT TESTS ===${COLORS.RESET}`);
  await runTest('Creator profile access', () => testProfile('creator'));
  await runTest('Investor profile access', () => testProfile('investor'));
  await runTest('Production profile access', () => testProfile('production'));
  
  // Test 3: Creator Pitches Endpoint (Role-based)
  console.log(`\n${COLORS.YELLOW}=== CREATOR PITCHES ENDPOINT TESTS ===${COLORS.RESET}`);
  await runTest('Creator CAN access creator/pitches', () => testCreatorPitchesAccess('creator', true));
  await runTest('Investor CANNOT access creator/pitches', () => testCreatorPitchesAccess('investor', false));
  await runTest('Production CANNOT access creator/pitches', () => testCreatorPitchesAccess('production', false));
  
  // Test 4: Investor Dashboard Endpoint (Role-based)
  console.log(`\n${COLORS.YELLOW}=== INVESTOR DASHBOARD ENDPOINT TESTS ===${COLORS.RESET}`);
  await runTest('Creator CANNOT access investor/dashboard', () => testInvestorDashboardAccess('creator', false));
  await runTest('Investor CAN access investor/dashboard', () => testInvestorDashboardAccess('investor', true));
  await runTest('Production CANNOT access investor/dashboard', () => testInvestorDashboardAccess('production', false));
  
  // Test 5: Production Dashboard Endpoint (Role-based)
  console.log(`\n${COLORS.YELLOW}=== PRODUCTION DASHBOARD ENDPOINT TESTS ===${COLORS.RESET}`);
  await runTest('Creator CANNOT access production/dashboard', () => testProductionDashboardAccess('creator', false));
  await runTest('Investor CANNOT access production/dashboard', () => testProductionDashboardAccess('investor', false));
  await runTest('Production CAN access production/dashboard', () => testProductionDashboardAccess('production', true));
  
  // Test 6: Unauthenticated Access
  console.log(`\n${COLORS.YELLOW}=== UNAUTHENTICATED ACCESS TESTS ===${COLORS.RESET}`);
  await runTest('All protected endpoints reject unauthenticated requests', testUnauthenticatedAccess);
  
  // Summary
  console.log(`\n${COLORS.YELLOW}========================================`);
  console.log(`TEST SUMMARY`);
  console.log(`========================================${COLORS.RESET}`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`${COLORS.GREEN}Passed: ${passedTests}${COLORS.RESET}`);
  console.log(`${COLORS.RED}Failed: ${failedTests}${COLORS.RESET}`);
  
  if (failedTests > 0) {
    console.log(`\n${COLORS.RED}FAILED TESTS:${COLORS.RESET}`);
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }
  
  if (failedTests === 0) {
    console.log(`\n${COLORS.GREEN}🎉 ALL SECURITY TESTS PASSED! The worker is properly secured.${COLORS.RESET}`);
  } else {
    console.log(`\n${COLORS.RED}⚠️  SECURITY VULNERABILITIES DETECTED! Fix the failed tests immediately.${COLORS.RESET}`);
  }
  
  // Exit with appropriate code
  Deno.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
if (import.meta.main) {
  runSecurityTests().catch(console.error);
}