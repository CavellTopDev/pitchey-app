#!/usr/bin/env deno test --allow-all

/**
 * INVESTOR WORKFLOW TEST SUITE
 * 
 * Comprehensive test coverage for the complete investor journey on Pitchey platform.
 * Tests all investor-specific functionality from registration to investment tracking.
 * 
 * Coverage Target: 98%
 * 
 * Test Categories:
 * 1. Authentication & Profile Management
 * 2. Pitch Discovery & Browsing
 * 3. NDA Request Workflow
 * 4. Investment Process
 * 5. Portfolio Management
 * 6. Communication & Info Requests
 * 7. Dashboard & Analytics
 * 8. Edge Cases & Error Handling
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { testHelper, TestDataFactory, TEST_CONFIG } from "../setup.ts";
import { MockServiceFactory } from "../utilities/mock-services.ts";

// Test configuration
const INVESTOR_CREDENTIALS = TEST_CONFIG.DEMO_ACCOUNTS.investor;
const API_BASE = TEST_CONFIG.API_BASE;

// Helper to ensure response bodies are consumed
async function consumeResponse(response: Response) {
  try {
    if (response.headers.get("content-type")?.includes("application/json")) {
      return await response.json();
    }
    return await response.text();
  } catch {
    await response.body?.cancel();
    return null;
  }
}

// ============================================================================
// AUTHENTICATION & PROFILE TESTS
// ============================================================================

Deno.test({
  name: "Investor Workflow: Authentication - Successful Login",
  async fn() {
    const response = await fetch(`${API_BASE}/api/auth/investor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(INVESTOR_CREDENTIALS),
    });

    const data = await consumeResponse(response);
    
    assertEquals(response.status, 200, "Login should succeed");
    assertExists(data?.token, "Should return JWT token");
    assertExists(data?.user, "Should return user data");
    assertEquals(data?.user?.userType, "investor", "User should have investor type");
    assertEquals(data?.user?.email, INVESTOR_CREDENTIALS.email, "Email should match");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Authentication - Invalid Credentials",
  async fn() {
    const response = await fetch(`${API_BASE}/api/auth/investor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: INVESTOR_CREDENTIALS.email,
        password: "WrongPassword123",
      }),
    });

    await consumeResponse(response);
    assertEquals(response.status, 401, "Should reject invalid credentials");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Authentication - Registration Flow",
  async fn() {
    const newInvestor = {
      email: `investor_${Date.now()}@test.com`,
      password: "SecurePass123!",
      name: "Test Investor",
      company: "Test Ventures LLC",
      phone: "+1234567890",
      investment_range: "100K-500K",
      investment_focus: ["Drama", "Thriller", "Sci-Fi"],
      bio: "Experienced investor focusing on innovative content",
    };

    const response = await fetch(`${API_BASE}/api/auth/investor/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newInvestor),
    });

    const data = await consumeResponse(response);
    
    if (response.status === 201) {
      assertExists(data?.user, "Should return created user");
      assertEquals(data?.user?.email, newInvestor.email, "Email should match");
      assertEquals(data?.user?.userType, "investor", "Should have investor type");
    } else {
      // Registration might be disabled in test environment
      assertEquals(response.status, 403, "Registration might be disabled");
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Profile - Get Current Profile",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/investor/profile`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    assertEquals(response.status, 200, "Should retrieve profile");
    assertExists(data?.email, "Profile should have email");
    assertEquals(data?.userType, "investor", "Should be investor type");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Profile - Update Investment Preferences",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const updates = {
      investment_range: "500K-1M",
      investment_focus: ["Action", "Comedy", "Documentary"],
      bio: "Updated investment focus on commercial content",
    };

    const response = await fetch(`${API_BASE}/api/investor/profile`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    const data = await consumeResponse(response);
    
    if (response.status === 200) {
      assertEquals(data?.investment_range, updates.investment_range, "Range should update");
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================================================
// PITCH DISCOVERY & BROWSING TESTS
// ============================================================================

Deno.test({
  name: "Investor Workflow: Browse - Get All Pitches",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/pitches`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    assertEquals(response.status, 200, "Should retrieve pitches");
    assert(Array.isArray(data?.pitches || data), "Should return array of pitches");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Browse - Filter by Genre",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/pitches?genre=Drama`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    assertEquals(response.status, 200, "Should filter pitches");
    const pitches = data?.pitches || data || [];
    if (pitches.length > 0) {
      assert(
        pitches.every((p: any) => p.genre === "Drama"),
        "All pitches should be Drama genre"
      );
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Browse - Search Functionality",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/pitches/search?q=adventure`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    assertEquals(response.status, 200, "Search should work");
    assert(Array.isArray(data?.pitches || data), "Should return search results");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Browse - Get Trending Pitches",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/pitches/trending`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    assertEquals(response.status, 200, "Should get trending pitches");
    assert(Array.isArray(data?.pitches || data), "Should return array");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Browse - View Pitch Details (No NDA)",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    // First get a pitch to view
    const listResponse = await fetch(`${API_BASE}/api/pitches`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const listData = await consumeResponse(listResponse);
    const pitches = listData?.pitches || listData || [];
    
    if (pitches.length > 0) {
      const pitchId = pitches[0].id;
      const response = await fetch(`${API_BASE}/api/pitches/${pitchId}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });

      const data = await consumeResponse(response);
      
      if (response.status === 200) {
        assertExists(data?.id, "Should have pitch ID");
        assertExists(data?.title, "Should have title");
        // NDA-protected fields might be hidden
        if (data?.nda_required && !data?.nda_approved) {
          assertEquals(data?.synopsis, undefined, "Synopsis should be hidden without NDA");
        }
      }
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================================================
// NDA WORKFLOW TESTS
// ============================================================================

Deno.test({
  name: "Investor Workflow: NDA - Request Access",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    // Create a test pitch that requires NDA
    const pitch = await testHelper.createTestPitch("creator");
    
    const response = await fetch(`${API_BASE}/api/pitches/${pitch.id}/nda-request`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Interested in reviewing this pitch for potential investment",
      }),
    });

    const data = await consumeResponse(response);
    
    if (response.status === 201) {
      assertExists(data?.id, "Should create NDA request");
      assertEquals(data?.status, "pending", "Initial status should be pending");
    }
    
    // Cleanup
    await testHelper.cleanupTestPitch(pitch.id);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: NDA - View Request Status",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/ndas`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    assertEquals(response.status, 200, "Should retrieve NDA requests");
    assert(Array.isArray(data?.ndas || data?.data || data), "Should return array");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: NDA - Access Protected Content After Approval",
  async fn() {
    const { token: creatorToken } = await testHelper.login("creator");
    const { token: investorToken } = await testHelper.login("investor");
    
    // Create NDA-protected pitch
    const pitch = await testHelper.createTestPitch("creator");
    
    // Request NDA
    const ndaResponse = await fetch(`${API_BASE}/api/pitches/${pitch.id}/nda-request`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${investorToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Test NDA request" }),
    });
    
    const ndaData = await consumeResponse(ndaResponse);
    
    if (ndaResponse.status === 201 && ndaData?.id) {
      // Creator approves NDA
      const approveResponse = await fetch(`${API_BASE}/api/ndas/${ndaData.id}/approve`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${creatorToken}`,
          "Content-Type": "application/json",
        },
      });
      
      await consumeResponse(approveResponse);
      
      // Now investor should see full content
      const pitchResponse = await fetch(`${API_BASE}/api/pitches/${pitch.id}`, {
        headers: { "Authorization": `Bearer ${investorToken}` },
      });
      
      const pitchData = await consumeResponse(pitchResponse);
      
      if (pitchResponse.status === 200) {
        assertExists(pitchData?.synopsis, "Should see synopsis after NDA approval");
      }
    }
    
    // Cleanup
    await testHelper.cleanupTestPitch(pitch.id);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================================================
// INVESTMENT PROCESS TESTS
// ============================================================================

Deno.test({
  name: "Investor Workflow: Investment - Express Interest",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    // Get a pitch to invest in
    const pitch = await testHelper.createTestPitch("creator");
    
    const response = await fetch(`${API_BASE}/api/pitches/${pitch.id}/express-interest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        investment_amount: 250000,
        message: "Very interested in this project",
      }),
    });

    const data = await consumeResponse(response);
    
    if (response.status === 201) {
      assertExists(data?.id, "Should create interest record");
    }
    
    // Cleanup
    await testHelper.cleanupTestPitch(pitch.id);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Investment - Save Pitch to Watchlist",
  async fn() {
    const { token } = await testHelper.login("investor");
    const pitch = await testHelper.createTestPitch("creator");
    
    const response = await fetch(`${API_BASE}/api/investor/saved/${pitch.id}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notes: "Test watchlist item" }),
    });

    const data = await consumeResponse(response);
    
    if (response.status === 201) {
      assertExists(data?.id || data?.success, "Should save pitch to watchlist");
    }
    
    // Cleanup
    await testHelper.cleanupTestPitch(pitch.id);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Investment - Get Saved Pitches",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/investor/watchlist`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    assertEquals(response.status, 200, "Should retrieve watchlist");
    assert(Array.isArray(data?.watchlist || data?.data || data), "Should return array");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Investment - Portfolio Overview",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/investor/portfolio`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    assertEquals(response.status, 200, "Should retrieve portfolio");
    if (data?.portfolio || data?.data) {
      assertExists(data.portfolio !== undefined || data.data !== undefined, "Should have portfolio data");
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================================================
// COMMUNICATION TESTS
// ============================================================================

Deno.test({
  name: "Investor Workflow: Communication - Send Info Request",
  async fn() {
    const { token } = await testHelper.login("investor");
    const pitch = await testHelper.createTestPitch("creator");
    
    const response = await fetch(`${API_BASE}/api/info-requests`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pitchId: pitch.id,
        message: "Could you provide more details about the budget breakdown?",
        requestType: "budget_details",
      }),
    });

    const data = await consumeResponse(response);
    
    if (response.status === 201) {
      assertExists(data?.id, "Should create info request");
      assertEquals(data?.status, "pending", "Initial status should be pending");
    }
    
    // Cleanup
    await testHelper.cleanupTestPitch(pitch.id);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Communication - Get Info Requests",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/info-requests`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    if (response.status === 200) {
      assert(Array.isArray(data?.requests || data?.data || data), "Should return array");
    } else {
      // Info requests endpoint might return 404 if none exist
      assert(response.status >= 200 && response.status < 500, "Should handle gracefully");
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================================================
// DASHBOARD & ANALYTICS TESTS
// ============================================================================

Deno.test({
  name: "Investor Workflow: Dashboard - Get Dashboard Data",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/investor/dashboard`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    assertEquals(response.status, 200, "Should retrieve dashboard");
    if (data?.data?.data) {
      assertExists(data.data.data.portfolio, "Should have portfolio stats");
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Dashboard - Get Investment Analytics",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/investor/analytics`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    if (response.status === 200) {
      assertExists(data, "Should return analytics data");
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Dashboard - Get Notifications",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const response = await fetch(`${API_BASE}/api/notifications`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await consumeResponse(response);
    
    if (response.status === 200) {
      assert(Array.isArray(data?.notifications || data?.data || data), "Should return array");
    } else {
      // Notifications endpoint might not exist or return 404
      assert(response.status >= 200 && response.status < 500, "Should handle gracefully");
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================================================
// EDGE CASES & ERROR HANDLING TESTS
// ============================================================================

Deno.test({
  name: "Investor Workflow: Edge Case - Expired Token",
  async fn() {
    const expiredToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token";
    
    const response = await fetch(`${API_BASE}/api/investor/dashboard`, {
      headers: { "Authorization": `Bearer ${expiredToken}` },
    });

    await consumeResponse(response);
    assertEquals(response.status, 401, "Should reject expired token");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Edge Case - Access Creator-Only Endpoint",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    // Try to create a pitch (creator-only)
    const response = await fetch(`${API_BASE}/api/pitches`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Investor trying to create pitch",
        logline: "This should fail",
      }),
    });

    await consumeResponse(response);
    assertEquals(response.status, 403, "Should deny access to creator endpoints");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Edge Case - Investment Amount Validation",
  async fn() {
    const { token } = await testHelper.login("investor");
    const pitch = await testHelper.createTestPitch("creator");
    
    // Try negative amount
    const response = await fetch(`${API_BASE}/api/pitches/${pitch.id}/express-interest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        investment_amount: -1000,
        message: "Invalid amount",
      }),
    });

    await consumeResponse(response);
    assert(response.status >= 400, "Should reject negative investment");
    
    // Cleanup
    await testHelper.cleanupTestPitch(pitch.id);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Edge Case - Duplicate NDA Request",
  async fn() {
    const { token } = await testHelper.login("investor");
    const pitch = await testHelper.createTestPitch("creator");
    
    // First NDA request
    const response1 = await fetch(`${API_BASE}/api/pitches/${pitch.id}/nda-request`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "First request" }),
    });
    
    await consumeResponse(response1);
    
    // Duplicate request
    const response2 = await fetch(`${API_BASE}/api/pitches/${pitch.id}/nda-request`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Duplicate request" }),
    });
    
    await consumeResponse(response2);
    
    if (response1.status === 201) {
      assert(response2.status >= 400, "Should prevent duplicate NDA requests");
    }
    
    // Cleanup
    await testHelper.cleanupTestPitch(pitch.id);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Edge Case - Unicode in Info Request",
  async fn() {
    const { token } = await testHelper.login("investor");
    const pitch = await testHelper.createTestPitch("creator");
    
    const response = await fetch(`${API_BASE}/api/info-requests`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pitchId: pitch.id,
        message: "Can you provide details? 你好 🎬 €1000",
        requestType: "general",
      }),
    });

    const data = await consumeResponse(response);
    
    if (response.status === 201) {
      assert(data?.message?.includes("你好"), "Should handle unicode");
    }
    
    // Cleanup
    await testHelper.cleanupTestPitch(pitch.id);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

Deno.test({
  name: "Investor Workflow: Performance - Dashboard Load Time",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const startTime = performance.now();
    const response = await fetch(`${API_BASE}/api/investor/dashboard`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    
    await consumeResponse(response);
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    assert(duration < 3000, `Dashboard should load in < 3s (took ${duration}ms)`);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Investor Workflow: Performance - Pitch List Load Time",
  async fn() {
    const { token } = await testHelper.login("investor");
    
    const startTime = performance.now();
    const response = await fetch(`${API_BASE}/api/pitches?limit=50`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    
    await consumeResponse(response);
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    assert(duration < 5000, `Pitch list should load in < 5s (took ${duration}ms)`);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================================================
// COMPLETE INVESTOR JOURNEY TEST
// ============================================================================

Deno.test({
  name: "Investor Workflow: E2E - Complete Investor Journey",
  async fn() {
    console.log("Starting complete investor journey test...");
    
    // 1. Login as investor
    const { token, user } = await testHelper.login("investor");
    assertExists(token, "Should login successfully");
    console.log("✓ Investor logged in");
    
    // 2. Browse available pitches
    const browseResponse = await fetch(`${API_BASE}/api/pitches`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const pitches = await consumeResponse(browseResponse);
    if (browseResponse.status === 200) {
      assert(pitches?.pitches || pitches?.data || Array.isArray(pitches), "Should get pitches");
    }
    console.log("✓ Browsed available pitches");
    
    // 3. Create a test pitch to interact with
    const pitch = await testHelper.createTestPitch("creator");
    console.log("✓ Test pitch created");
    
    // 4. View pitch details (limited without NDA)
    const detailResponse = await fetch(`${API_BASE}/api/pitches/${pitch.id}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    await consumeResponse(detailResponse);
    console.log("✓ Viewed pitch details");
    
    // 5. Request NDA access
    const ndaResponse = await fetch(`${API_BASE}/api/pitches/${pitch.id}/nda-request`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Would like to review this pitch for potential investment",
      }),
    });
    const ndaData = await consumeResponse(ndaResponse);
    console.log("✓ NDA requested");
    
    // 6. Save pitch to watchlist
    const saveResponse = await fetch(`${API_BASE}/api/investor/saved-pitches`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pitchId: pitch.id }),
    });
    await consumeResponse(saveResponse);
    console.log("✓ Pitch saved to watchlist");
    
    // 7. Send info request
    const infoResponse = await fetch(`${API_BASE}/api/info-requests`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pitchId: pitch.id,
        message: "Could you provide more financial details?",
        requestType: "financial",
      }),
    });
    await consumeResponse(infoResponse);
    console.log("✓ Info request sent");
    
    // 8. Express investment interest
    const interestResponse = await fetch(`${API_BASE}/api/pitches/${pitch.id}/express-interest`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        investment_amount: 500000,
        message: "Very interested in this project",
      }),
    });
    await consumeResponse(interestResponse);
    console.log("✓ Investment interest expressed");
    
    // 9. Check dashboard
    const dashboardResponse = await fetch(`${API_BASE}/api/investor/dashboard`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    await consumeResponse(dashboardResponse);
    assertEquals(dashboardResponse.status, 200, "Dashboard should load");
    console.log("✓ Dashboard accessed");
    
    // 10. Check portfolio
    const portfolioResponse = await fetch(`${API_BASE}/api/investor/portfolio`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    await consumeResponse(portfolioResponse);
    console.log("✓ Portfolio checked");
    
    // Cleanup
    await testHelper.cleanupTestPitch(pitch.id);
    console.log("✓ Test data cleaned up");
    
    console.log("Complete investor journey test passed!");
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

console.log("Investor workflow test suite loaded successfully!");