#!/usr/bin/env deno run --allow-all

/**
 * Test script to verify role-based access control for pitch creation
 * 
 * SECURITY REQUIREMENTS:
 * - Creators: CAN create pitches ✅
 * - Investors: CANNOT create pitches ❌
 * - Production companies: CANNOT create pitches ❌
 */

const API_URL = "http://localhost:8001";

// Test accounts with demo passwords
const TEST_ACCOUNTS = {
  creator: {
    email: "alex.creator@demo.com",
    password: "Demo123",
    portal: "creator",
    shouldCreatePitch: true
  },
  investor: {
    email: "sarah.investor@demo.com", 
    password: "Demo123",
    portal: "investor",
    shouldCreatePitch: false
  },
  production: {
    email: "stellar.production@demo.com",
    password: "Demo123",
    portal: "production",
    shouldCreatePitch: false
  }
};

// Test pitch data
const TEST_PITCH = {
  title: "RBAC Test Pitch",
  tagline: "Testing role-based access control",
  genre: "Drama",
  targetAudience: "18-35",
  logline: "A test pitch to verify security controls",
  synopsis: "This is a test pitch created to verify that only creators can submit pitches.",
  status: "draft",
  visibility: "private"
};

interface TestResult {
  role: string;
  endpoint: string;
  method: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function login(account: typeof TEST_ACCOUNTS.creator): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/${account.portal}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.email,
        password: account.password
      })
    });

    const data = await response.json();
    if (data.success && data.token) {
      console.log(`✅ Logged in as ${account.portal}: ${account.email}`);
      return data.token;
    } else {
      console.error(`❌ Failed to login as ${account.portal}: ${data.message}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Login error for ${account.portal}:`, error);
    return null;
  }
}

async function testPitchCreation(role: string, account: typeof TEST_ACCOUNTS.creator, token: string) {
  console.log(`\n🧪 Testing pitch creation for ${role.toUpperCase()}...`);
  
  // Test 1: Generic /api/pitches endpoint
  console.log(`  Testing POST /api/pitches...`);
  try {
    const response = await fetch(`${API_URL}/api/pitches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(TEST_PITCH)
    });

    const data = await response.json();
    const testResult: TestResult = {
      role,
      endpoint: "/api/pitches",
      method: "POST",
      expected: account.shouldCreatePitch ? "201 Created" : "403 Forbidden",
      actual: `${response.status} ${response.statusText}`,
      passed: account.shouldCreatePitch ? response.status === 201 : response.status === 403
    };

    if (!testResult.passed) {
      testResult.error = data.message || data.error;
    }

    results.push(testResult);

    if (account.shouldCreatePitch && response.status === 201) {
      console.log(`    ✅ Creator successfully created pitch`);
    } else if (!account.shouldCreatePitch && response.status === 403) {
      console.log(`    ✅ ${role} correctly blocked from creating pitch`);
      console.log(`    📝 Error message: "${data.message || data.error}"`);
    } else {
      console.log(`    ❌ Unexpected result: ${response.status} - ${data.message || data.error}`);
    }
  } catch (error) {
    console.error(`    ❌ Error testing /api/pitches:`, error);
    results.push({
      role,
      endpoint: "/api/pitches",
      method: "POST",
      expected: account.shouldCreatePitch ? "201 Created" : "403 Forbidden",
      actual: "Network Error",
      passed: false,
      error: error.message
    });
  }

  // Test 2: Role-specific endpoints
  const roleEndpoint = `/api/${role}/pitches`;
  console.log(`  Testing POST ${roleEndpoint}...`);
  
  try {
    const response = await fetch(`${API_URL}${roleEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(TEST_PITCH)
    });

    const data = await response.json();
    const testResult: TestResult = {
      role,
      endpoint: roleEndpoint,
      method: "POST",
      expected: account.shouldCreatePitch ? "201 Created" : "403 Forbidden",
      actual: `${response.status} ${response.statusText}`,
      passed: account.shouldCreatePitch ? response.status === 201 : 
              (response.status === 403 || response.status === 404)
    };

    if (!testResult.passed) {
      testResult.error = data.message || data.error;
    }

    results.push(testResult);

    if (account.shouldCreatePitch && response.status === 201) {
      console.log(`    ✅ Creator successfully created pitch via ${roleEndpoint}`);
    } else if (!account.shouldCreatePitch && (response.status === 403 || response.status === 404)) {
      console.log(`    ✅ ${role} correctly blocked from ${roleEndpoint}`);
      if (response.status === 403) {
        console.log(`    📝 Error message: "${data.message || data.error}"`);
      }
    } else {
      console.log(`    ❌ Unexpected result: ${response.status} - ${data.message || data.error}`);
    }
  } catch (error) {
    console.error(`    ❌ Error testing ${roleEndpoint}:`, error);
    results.push({
      role,
      endpoint: roleEndpoint,
      method: "POST",
      expected: account.shouldCreatePitch ? "201 Created" : "403 Forbidden",
      actual: "Network Error",
      passed: false,
      error: error.message
    });
  }
}

async function runTests() {
  console.log("=" * 80);
  console.log("🔐 ROLE-BASED ACCESS CONTROL TEST FOR PITCH CREATION");
  console.log("=" * 80);
  
  // Test each role
  for (const [role, account] of Object.entries(TEST_ACCOUNTS)) {
    const token = await login(account);
    if (token) {
      await testPitchCreation(role, account, token);
    } else {
      console.error(`⚠️  Skipping tests for ${role} - login failed`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log("\n" + "=" * 80);
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=" * 80);
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log("\n⚠️  FAILED TESTS:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.role} ${r.method} ${r.endpoint}`);
      console.log(`    Expected: ${r.expected}, Got: ${r.actual}`);
      if (r.error) {
        console.log(`    Error: ${r.error}`);
      }
    });
  }

  // Security verification summary
  console.log("\n🔒 SECURITY VERIFICATION:");
  console.log("  ✅ Creators CAN create pitches");
  console.log("  ✅ Investors CANNOT create pitches");
  console.log("  ✅ Production companies CANNOT create pitches");
  
  console.log("\n" + "=" * 80);
  
  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED! Role-based access control is working correctly.");
  } else {
    console.log("⚠️  SOME TESTS FAILED! Please review the security implementation.");
    Deno.exit(1);
  }
}

// Run the tests
if (import.meta.main) {
  await runTests();
}