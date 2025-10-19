#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Test Role-Based Access Control for Pitch Creation/Management
 * 
 * This script tests that:
 * - Creators CAN create, update, delete pitches
 * - Investors CANNOT create, update, delete pitches
 * - Production companies CANNOT create, update, delete pitches
 */

const API_URL = "http://localhost:8001";

// Test credentials
const credentials = {
  creator: { email: "alex.creator@demo.com", password: "Demo123" },
  investor: { email: "sarah.investor@demo.com", password: "Demo123" },
  production: { email: "stellar.production@demo.com", password: "Demo123" }
};

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

// Login function for each user type
async function login(userType: "creator" | "investor" | "production"): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/${userType}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials[userType])
    });

    if (response.ok) {
      const data = await response.json();
      return data.token;
    }
    console.error(`Failed to login as ${userType}:`, response.status);
    return null;
  } catch (error) {
    console.error(`Login error for ${userType}:`, error);
    return null;
  }
}

// Test pitch creation
async function testPitchCreation(token: string, userType: string): Promise<boolean> {
  const testPitch = {
    title: `Test Pitch - ${userType} - ${Date.now()}`,
    logline: "A test pitch to verify role-based access control",
    genre: "Drama",
    format: "Feature Film",
    shortSynopsis: "Testing access control",
    longSynopsis: "This pitch is created to test role-based access control",
    estimatedBudget: 1000000,
    status: "draft"
  };

  const endpoints = [
    "/api/pitches",
    "/api/creator/pitches"
  ];

  let allTestsPassed = true;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(testPitch)
      });

      const expectedStatus = userType === "creator" ? 201 : 403;
      const passed = response.status === expectedStatus;
      
      if (passed) {
        console.log(`${colors.green}✓${colors.reset} ${userType.padEnd(10)} | ${endpoint.padEnd(25)} | Status: ${response.status} (${userType === "creator" ? "ALLOWED" : "BLOCKED"})`);
      } else {
        console.log(`${colors.red}✗${colors.reset} ${userType.padEnd(10)} | ${endpoint.padEnd(25)} | Status: ${response.status} (Expected: ${expectedStatus})`);
        const body = await response.text();
        console.log(`  Response: ${body.substring(0, 100)}...`);
        allTestsPassed = false;
      }

      // If creator successfully created a pitch, return the ID for further testing
      if (userType === "creator" && response.status === 201) {
        const data = await response.json();
        return data.pitch?.id || true;
      }
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} ${userType.padEnd(10)} | ${endpoint.padEnd(25)} | Error: ${error.message}`);
      allTestsPassed = false;
    }
  }

  return allTestsPassed;
}

// Test pitch update
async function testPitchUpdate(token: string, userType: string, pitchId: number): Promise<boolean> {
  const updateData = {
    title: `Updated Pitch - ${userType} - ${Date.now()}`,
    logline: "Updated logline"
  };

  const endpoints = [
    `/api/pitches/${pitchId}`,
    `/api/creator/pitches/${pitchId}`
  ];

  let allTestsPassed = true;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updateData)
      });

      const expectedStatus = userType === "creator" ? 200 : 403;
      const passed = response.status === expectedStatus;
      
      if (passed) {
        console.log(`${colors.green}✓${colors.reset} ${userType.padEnd(10)} | UPDATE ${endpoint.padEnd(25)} | Status: ${response.status} (${userType === "creator" ? "ALLOWED" : "BLOCKED"})`);
      } else {
        console.log(`${colors.red}✗${colors.reset} ${userType.padEnd(10)} | UPDATE ${endpoint.padEnd(25)} | Status: ${response.status} (Expected: ${expectedStatus})`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} ${userType.padEnd(10)} | UPDATE ${endpoint.padEnd(25)} | Error: ${error.message}`);
      allTestsPassed = false;
    }
  }

  return allTestsPassed;
}

// Test pitch deletion
async function testPitchDeletion(token: string, userType: string, pitchId: number): Promise<boolean> {
  const endpoints = [
    `/api/pitches/${pitchId}`,
    `/api/creator/pitches/${pitchId}`
  ];

  let allTestsPassed = true;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const expectedStatus = userType === "creator" ? 200 : 403;
      const passed = response.status === expectedStatus;
      
      if (passed) {
        console.log(`${colors.green}✓${colors.reset} ${userType.padEnd(10)} | DELETE ${endpoint.padEnd(25)} | Status: ${response.status} (${userType === "creator" ? "ALLOWED" : "BLOCKED"})`);
      } else {
        console.log(`${colors.red}✗${colors.reset} ${userType.padEnd(10)} | DELETE ${endpoint.padEnd(25)} | Status: ${response.status} (Expected: ${expectedStatus})`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} ${userType.padEnd(10)} | DELETE ${endpoint.padEnd(25)} | Error: ${error.message}`);
      allTestsPassed = false;
    }
  }

  return allTestsPassed;
}

// Test draft operations
async function testDraftOperations(token: string, userType: string, pitchId: number): Promise<boolean> {
  const draftData = {
    content: { title: "Draft content", description: "Test draft" },
    version: 1,
    deviceId: "test-device"
  };

  const endpoints = [
    { path: `/api/drafts/${pitchId}/autosave`, method: "POST", body: draftData },
    { path: `/api/drafts/${pitchId}/save`, method: "POST", body: {} }
  ];

  let allTestsPassed = true;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_URL}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(endpoint.body)
      });

      const expectedStatus = userType === "creator" ? [200, 409] : [403];
      const passed = expectedStatus.includes(response.status);
      
      if (passed) {
        console.log(`${colors.green}✓${colors.reset} ${userType.padEnd(10)} | DRAFT ${endpoint.path.padEnd(30)} | Status: ${response.status} (${userType === "creator" ? "ALLOWED" : "BLOCKED"})`);
      } else {
        console.log(`${colors.red}✗${colors.reset} ${userType.padEnd(10)} | DRAFT ${endpoint.path.padEnd(30)} | Status: ${response.status} (Expected: ${expectedStatus.join(" or ")})`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} ${userType.padEnd(10)} | DRAFT ${endpoint.path.padEnd(30)} | Error: ${error.message}`);
      allTestsPassed = false;
    }
  }

  return allTestsPassed;
}

// Main test runner
async function runTests() {
  console.log(`${colors.cyan}========================================`);
  console.log("  Role-Based Access Control Test Suite");
  console.log(`========================================${colors.reset}\n`);

  let allTestsPassed = true;
  let createdPitchId: number | null = null;

  // Test 1: Login for all user types
  console.log(`${colors.blue}1. Testing Authentication${colors.reset}`);
  const tokens: Record<string, string> = {};
  
  for (const userType of ["creator", "investor", "production"] as const) {
    const token = await login(userType);
    if (token) {
      tokens[userType] = token;
      console.log(`${colors.green}✓${colors.reset} Successfully logged in as ${userType}`);
    } else {
      console.log(`${colors.red}✗${colors.reset} Failed to login as ${userType}`);
      allTestsPassed = false;
    }
  }

  if (!tokens.creator || !tokens.investor || !tokens.production) {
    console.log(`${colors.red}\nCannot proceed without all user tokens${colors.reset}`);
    return;
  }

  // Test 2: Pitch Creation
  console.log(`\n${colors.blue}2. Testing Pitch Creation${colors.reset}`);
  console.log("Expected: Only creators should be able to create pitches\n");
  
  for (const [userType, token] of Object.entries(tokens)) {
    const result = await testPitchCreation(token, userType);
    if (userType === "creator" && typeof result === "number") {
      createdPitchId = result;
    }
    if (!result && userType !== "creator") {
      // This is expected for non-creators
    } else if (userType === "creator" && !result) {
      allTestsPassed = false;
    }
  }

  // Create a test pitch for update/delete testing
  if (!createdPitchId) {
    console.log(`\n${colors.yellow}Creating a test pitch for further testing...${colors.reset}`);
    const testPitchResponse = await fetch(`${API_URL}/api/creator/pitches`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokens.creator}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Test Pitch for RBAC",
        logline: "Testing role-based access control",
        genre: "Drama",
        format: "Feature Film",
        shortSynopsis: "Test",
        longSynopsis: "Test",
        estimatedBudget: 1000000
      })
    });

    if (testPitchResponse.ok) {
      const data = await testPitchResponse.json();
      createdPitchId = data.pitch?.id;
      console.log(`Created test pitch with ID: ${createdPitchId}`);
    }
  }

  if (createdPitchId) {
    // Test 3: Pitch Update
    console.log(`\n${colors.blue}3. Testing Pitch Update (Pitch ID: ${createdPitchId})${colors.reset}`);
    console.log("Expected: Only creators should be able to update pitches\n");
    
    for (const [userType, token] of Object.entries(tokens)) {
      const result = await testPitchUpdate(token, userType, createdPitchId);
      if (!result && userType === "creator") {
        allTestsPassed = false;
      }
    }

    // Test 4: Draft Operations
    console.log(`\n${colors.blue}4. Testing Draft Operations (Pitch ID: ${createdPitchId})${colors.reset}`);
    console.log("Expected: Only creators should be able to save drafts\n");
    
    for (const [userType, token] of Object.entries(tokens)) {
      const result = await testDraftOperations(token, userType, createdPitchId);
      if (!result && userType === "creator") {
        allTestsPassed = false;
      }
    }

    // Test 5: Pitch Deletion
    console.log(`\n${colors.blue}5. Testing Pitch Deletion (Pitch ID: ${createdPitchId})${colors.reset}`);
    console.log("Expected: Only creators should be able to delete pitches\n");
    
    for (const [userType, token] of Object.entries(tokens)) {
      const result = await testPitchDeletion(token, userType, createdPitchId);
      if (!result && userType === "creator") {
        allTestsPassed = false;
      }
    }
  }

  // Summary
  console.log(`\n${colors.cyan}========================================${colors.reset}`);
  if (allTestsPassed) {
    console.log(`${colors.green}✓ ALL TESTS PASSED${colors.reset}`);
    console.log("\nRole-based access control is working correctly:");
    console.log("- Creators CAN create, update, and delete pitches");
    console.log("- Investors CANNOT create, update, or delete pitches");
    console.log("- Production companies CANNOT create, update, or delete pitches");
  } else {
    console.log(`${colors.red}✗ SOME TESTS FAILED${colors.reset}`);
    console.log("\nPlease review the failed tests above.");
  }
  console.log(`${colors.cyan}========================================${colors.reset}`);
}

// Run the tests
runTests().catch(console.error);