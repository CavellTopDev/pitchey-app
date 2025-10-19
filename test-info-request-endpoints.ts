#!/usr/bin/env -S deno run --allow-net --allow-env

// Test script for Info Request endpoints
import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

// Load environment variables
config({ export: true });

const API_BASE = "http://localhost:8001";

// Demo credentials from CLAUDE.md
const INVESTOR_CREDENTIALS = {
  email: "sarah.investor@demo.com",
  password: "Demo123"
};

const CREATOR_CREDENTIALS = {
  email: "alex.creator@demo.com", 
  password: "Demo123"
};

// Test authentication and get token
async function authenticate(credentials: any, portal: string) {
  try {
    const response = await fetch(`${API_BASE}/api/auth/${portal}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error(`❌ Authentication failed for ${portal}:`, error.message);
    throw error;
  }
}

// Test function to call API endpoints
async function testEndpoint(method: string, endpoint: string, token: string, body?: any) {
  try {
    const options: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log(`\n🔍 Testing ${method} ${endpoint}`);
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log(`   ✅ Success:`, data);
    } else {
      console.log(`   ❌ Error:`, data);
    }

    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.log(`   ❌ Request failed:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main test function
async function runTests() {
  console.log("🚀 Starting Info Request Endpoints Test\n");

  try {
    // Test 1: Authenticate as investor
    console.log("📋 Step 1: Authenticating as investor...");
    const investorToken = await authenticate(INVESTOR_CREDENTIALS, "investor");
    console.log("✅ Investor authentication successful");

    // Test 2: Authenticate as creator
    console.log("\n📋 Step 2: Authenticating as creator...");
    const creatorToken = await authenticate(CREATOR_CREDENTIALS, "creator");
    console.log("✅ Creator authentication successful");

    // Test 3: Test all info request endpoints
    console.log("\n📋 Step 3: Testing Info Request Endpoints...");

    // Test GET endpoints
    await testEndpoint("GET", "/api/info-requests/incoming", creatorToken);
    await testEndpoint("GET", "/api/info-requests/outgoing", investorToken);
    await testEndpoint("GET", "/api/info-requests/stats", investorToken);
    await testEndpoint("GET", "/api/info-requests/analytics", creatorToken);

    // Test GET specific request (will likely fail due to no data, but should not 404)
    await testEndpoint("GET", "/api/info-requests/1", investorToken);

    // Test POST create request (might fail due to missing NDA, but should not 404)
    const createRequestBody = {
      ndaId: 1,
      pitchId: 1,
      requestType: "financial",
      subject: "Test financial information request",
      message: "Can you provide more details about the budget breakdown?",
      priority: "medium"
    };
    await testEndpoint("POST", "/api/info-requests", investorToken, createRequestBody);

    // Test POST respond (will likely fail due to no data, but should not 404)
    const respondBody = {
      response: "Here is the requested information..."
    };
    await testEndpoint("POST", "/api/info-requests/1/respond", creatorToken, respondBody);

    // Test PUT status update (will likely fail due to no data, but should not 404)
    const statusBody = {
      status: "closed"
    };
    await testEndpoint("PUT", "/api/info-requests/1/status", investorToken, statusBody);

  } catch (error) {
    console.error("❌ Test execution failed:", error.message);
  }

  console.log("\n🏁 Test completed!");
}

// Run the tests
if (import.meta.main) {
  runTests();
}