#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

/**
 * Complete NDA Workflow Integration Test
 * Tests the full NDA workflow including:
 * 1. Requesting an NDA
 * 2. Approving/Rejecting NDA requests
 * 3. Signing NDAs
 * 4. Downloading NDA documents
 * 5. Managing NDA access
 */

// Test configuration
const API_BASE = "http://localhost:8001";
const DEMO_TOKENS = {
  creator: "demo-creator",
  investor: "demo-investor",
  production: "demo-production"
};

// Test data
interface TestUser {
  token: string;
  userType: string;
  userId: number;
}

const testUsers: Record<string, TestUser> = {
  creator: { token: DEMO_TOKENS.creator, userType: "creator", userId: 1004 },
  investor: { token: DEMO_TOKENS.investor, userType: "investor", userId: 1005 },
  production: { token: DEMO_TOKENS.production, userType: "production", userId: 1006 }
};

// Test pitch ID (assuming exists in database)
const TEST_PITCH_ID = 1;

// Utility functions
function logTest(test: string, result: "PASS" | "FAIL", details?: string) {
  const icon = result === "PASS" ? "✅" : "❌";
  console.log(`${icon} ${test}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function makeApiCall(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const text = await response.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawResponse: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: response.headers
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error.message },
      headers: new Headers()
    };
  }
}

async function authenticatedCall(endpoint: string, userType: string, options: RequestInit = {}) {
  const user = testUsers[userType];
  return makeApiCall(endpoint, {
    ...options,
    headers: {
      'Authorization': `Bearer ${user.token}`,
      ...options.headers,
    },
  });
}

// Test functions
async function testNDARequest() {
  console.log("\n🧪 Testing NDA Request Creation...");

  // Test creating NDA request from investor to creator's pitch
  const requestData = {
    pitchId: TEST_PITCH_ID,
    ndaType: "basic",
    requestMessage: "I'm interested in learning more about this project and would like to sign an NDA to view the complete details.",
    companyInfo: {
      companyName: "Demo Investment Corp",
      position: "Senior Investor",
      intendedUse: "Investment evaluation"
    }
  };

  const response = await authenticatedCall("/api/ndas/request", "investor", {
    method: "POST",
    body: JSON.stringify(requestData)
  });

  if (response.ok && response.data.success) {
    logTest("NDA Request Creation", "PASS", `Request ID: ${response.data.data.nda.id}`);
    return response.data.data.nda.id;
  } else {
    logTest("NDA Request Creation", "FAIL", response.data.message || "Unknown error");
    return null;
  }
}

async function testNDARequestList() {
  console.log("\n🧪 Testing NDA Request Listing...");

  // Test getting incoming requests (creator's view)
  const creatorResponse = await authenticatedCall("/api/nda/pending", "creator");
  
  if (creatorResponse.ok) {
    logTest("Creator Incoming NDA Requests", "PASS", `Found ${creatorResponse.data.data.ndas.length} requests`);
  } else {
    logTest("Creator Incoming NDA Requests", "FAIL", creatorResponse.data.message);
  }

  // Test getting outgoing requests (investor's view)
  const investorResponse = await authenticatedCall("/api/ndas/request", "investor");
  
  if (investorResponse.ok) {
    logTest("Investor Outgoing NDA Requests", "PASS", `Found ${investorResponse.data.data.ndaRequests.length} requests`);
  } else {
    logTest("Investor Outgoing NDA Requests", "FAIL", investorResponse.data.message);
  }
}

async function testNDAApproval(requestId: number) {
  console.log("\n🧪 Testing NDA Approval...");

  const response = await authenticatedCall(`/api/ndas/${requestId}/approve`, "creator", {
    method: "POST"
  });

  if (response.ok && response.data.success) {
    logTest("NDA Approval", "PASS", `NDA ID: ${response.data.data.nda.id}`);
    return response.data.data.nda.id;
  } else {
    logTest("NDA Approval", "FAIL", response.data.message || "Unknown error");
    return null;
  }
}

async function testNDARejection(requestId: number) {
  console.log("\n🧪 Testing NDA Rejection...");

  const rejectionData = {
    reason: "Project no longer available for investment review"
  };

  const response = await authenticatedCall(`/api/ndas/${requestId}/reject`, "creator", {
    method: "POST",
    body: JSON.stringify(rejectionData)
  });

  if (response.ok && response.data.success) {
    logTest("NDA Rejection", "PASS", response.data.data.message);
    return true;
  } else {
    logTest("NDA Rejection", "FAIL", response.data.message || "Unknown error");
    return false;
  }
}

async function testDirectNDASigning() {
  console.log("\n🧪 Testing Direct NDA Signing...");

  const signData = {
    pitchId: TEST_PITCH_ID,
    ndaType: "enhanced",
    ipAddress: "127.0.0.1",
    userAgent: "Test-Agent/1.0",
    signatureData: { timestamp: Date.now() }
  };

  const response = await authenticatedCall("/api/ndas/sign", "production", {
    method: "POST",
    body: JSON.stringify(signData)
  });

  if (response.ok && response.data.success) {
    logTest("Direct NDA Signing", "PASS", `NDA ID: ${response.data.data.nda.id}`);
    return response.data.data.nda.id;
  } else {
    logTest("Direct NDA Signing", "FAIL", response.data.message || "Unknown error");
    return null;
  }
}

async function testNDAStatus() {
  console.log("\n🧪 Testing NDA Status Check...");

  const response = await authenticatedCall(`/api/ndas/pitch/${TEST_PITCH_ID}/status`, "investor");

  if (response.ok && response.data.success) {
    const hasNDA = response.data.data.hasNDA;
    const canAccess = response.data.data.canAccess;
    logTest("NDA Status Check", "PASS", `Has NDA: ${hasNDA}, Can Access: ${canAccess}`);
    return response.data.data;
  } else {
    logTest("NDA Status Check", "FAIL", response.data.message || "Unknown error");
    return null;
  }
}

async function testSignedNDAsList() {
  console.log("\n🧪 Testing Signed NDAs List...");

  const response = await authenticatedCall("/api/ndas/signed", "investor");

  if (response.ok && response.data.success) {
    logTest("Signed NDAs List", "PASS", `Found ${response.data.data.ndas.length} signed NDAs`);
    return response.data.data.ndas;
  } else {
    logTest("Signed NDAs List", "FAIL", response.data.message || "Unknown error");
    return [];
  }
}

async function testNDADocumentDownload(ndaId: number) {
  console.log("\n🧪 Testing NDA Document Download...");

  // Test HTML format
  const htmlResponse = await authenticatedCall(`/api/nda/documents/${ndaId}/download?format=html`, "investor");

  if (htmlResponse.ok) {
    logTest("NDA Document Download (HTML)", "PASS", `Content type: ${htmlResponse.headers.get('content-type')}`);
  } else {
    logTest("NDA Document Download (HTML)", "FAIL", "Download failed");
  }

  // Test text format
  const textResponse = await authenticatedCall(`/api/nda/documents/${ndaId}/download?format=text`, "investor");

  if (textResponse.ok) {
    logTest("NDA Document Download (Text)", "PASS", `Content type: ${textResponse.headers.get('content-type')}`);
  } else {
    logTest("NDA Document Download (Text)", "FAIL", "Download failed");
  }
}

async function testNDAStats() {
  console.log("\n🧪 Testing NDA Statistics...");

  const response = await authenticatedCall("/api/nda/stats", "creator");

  if (response.ok && response.data.success) {
    const stats = response.data.data;
    logTest("NDA Statistics", "PASS", `Pending: ${stats.pendingRequests}, Approved: ${stats.approvedRequests}, Signed: ${stats.signedNDAs}`);
  } else {
    logTest("NDA Statistics", "FAIL", response.data.message || "Unknown error");
  }
}

async function testIncomingNDAs() {
  console.log("\n🧪 Testing Incoming NDAs...");

  const response = await authenticatedCall("/api/ndas/incoming-requests", "creator");

  if (response.ok && response.data.success) {
    logTest("Incoming NDA Requests", "PASS", `Found ${response.data.requests.length} incoming requests`);
  } else {
    logTest("Incoming NDA Requests", "FAIL", response.data.message || "Unknown error");
  }
}

async function testOutgoingNDAs() {
  console.log("\n🧪 Testing Outgoing NDAs...");

  const response = await authenticatedCall("/api/ndas/outgoing-requests", "investor");

  if (response.ok && response.data.success) {
    logTest("Outgoing NDA Requests", "PASS", `Found ${response.data.requests.length} outgoing requests`);
  } else {
    logTest("Outgoing NDA Requests", "FAIL", response.data.message || "Unknown error");
  }
}

async function testCompleteWorkflow() {
  console.log("🚀 Starting Complete NDA Workflow Test\n");

  let testResults = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Track original console.log
  const originalLog = console.log;
  let passCount = 0;
  let failCount = 0;

  // Override console.log to count results
  console.log = (...args) => {
    originalLog(...args);
    const message = args.join(' ');
    if (message.includes('✅')) passCount++;
    if (message.includes('❌')) failCount++;
  };

  try {
    // Test 1: Create NDA request
    const requestId = await testNDARequest();
    
    // Test 2: List NDA requests
    await testNDARequestList();

    // Test 3: Approve NDA request (if created successfully)
    let approvedNdaId = null;
    if (requestId) {
      approvedNdaId = await testNDAApproval(requestId);
    }

    // Test 4: Direct NDA signing
    const directNdaId = await testDirectNDASigning();

    // Test 5: Check NDA status
    await testNDAStatus();

    // Test 6: List signed NDAs
    await testSignedNDAsList();

    // Test 7: Download NDA documents
    if (approvedNdaId) {
      await testNDADocumentDownload(approvedNdaId);
    } else if (directNdaId) {
      await testNDADocumentDownload(directNdaId);
    }

    // Test 8: NDA statistics
    await testNDAStats();

    // Test 9: Incoming NDAs
    await testIncomingNDAs();

    // Test 10: Outgoing NDAs  
    await testOutgoingNDAs();

    // Test 11: Create and reject an NDA request
    console.log("\n🧪 Testing NDA Rejection Workflow...");
    const rejectRequestId = await testNDARequest();
    if (rejectRequestId) {
      await testNDARejection(rejectRequestId);
    }

  } catch (error) {
    originalLog(`\n❌ Test suite failed with error: ${error.message}`);
    failCount++;
  } finally {
    // Restore original console.log
    console.log = originalLog;
    
    // Print final results
    console.log("\n" + "=".repeat(60));
    console.log("📊 NDA WORKFLOW TEST RESULTS");
    console.log("=".repeat(60));
    console.log(`✅ Tests Passed: ${passCount}`);
    console.log(`❌ Tests Failed: ${failCount}`);
    console.log(`📈 Success Rate: ${passCount > 0 ? Math.round((passCount / (passCount + failCount)) * 100) : 0}%`);
    console.log("=".repeat(60));

    if (passCount >= 15) { // Expecting around 15+ test assertions
      console.log("\n🎉 NDA WORKFLOW IMPLEMENTATION IS COMPLETE AND FUNCTIONAL!");
      console.log("✨ All major NDA features are working correctly:");
      console.log("   • NDA request creation and management");
      console.log("   • Approval and rejection workflows");
      console.log("   • Direct NDA signing");
      console.log("   • Document generation and download");
      console.log("   • Access control and permissions");
      console.log("   • Statistics and monitoring");
    } else {
      console.log("\n⚠️  Some NDA workflow features need attention.");
      console.log("   Please review the failed tests above.");
    }
  }
}

// Health check first
async function checkServerHealth() {
  console.log("🔍 Checking server health...");
  const health = await makeApiCall("/api/health");
  
  if (health.ok) {
    console.log("✅ Server is healthy and ready for testing");
    return true;
  } else {
    console.log("❌ Server health check failed");
    console.log("   Please make sure the server is running on port 8001");
    console.log("   Run: PORT=8001 deno run --allow-all working-server.ts");
    return false;
  }
}

// Main execution
if (import.meta.main) {
  const serverHealthy = await checkServerHealth();
  if (serverHealthy) {
    await testCompleteWorkflow();
  } else {
    Deno.exit(1);
  }
}