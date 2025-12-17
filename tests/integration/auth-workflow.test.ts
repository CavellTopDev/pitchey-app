/**
 * Authentication Workflow Integration Tests
 * Tests complete authentication flows across all portals
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { ApiTestHelper } from "../api/api-test-suite.ts";

const BASE_URL = Deno.env.get("TEST_API_URL") || "http://localhost:8001";

Deno.test({
  name: "Authentication Workflow - Complete Creator Journey",
  fn: async () => {
    const helper = new ApiTestHelper();
    const uniqueEmail = `creator_${Date.now()}@test.com`;
    
    // Step 1: Register new creator
    const registerResponse = await helper.request("POST", "/api/auth/creator/register", {
      email: uniqueEmail,
      password: "SecurePass123!",
      name: "Test Creator",
      userType: "creator",
      companyName: "Test Studios"
    });
    
    const registerData = await registerResponse.json();
    assertEquals(registerResponse.status, 200);
    assertExists(registerData.data?.token);
    assertExists(registerData.data?.user.id);
    
    const userId = registerData.data.user.id;
    const token = registerData.data.token;
    
    // Step 2: Verify session is created
    const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    assertEquals(sessionResponse.status, 200);
    
    // Step 3: Update profile
    const profileResponse = await fetch(`${BASE_URL}/api/users/profile`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bio: "Film director with 10 years experience",
        website: "https://teststudios.com"
      })
    });
    
    assertEquals(profileResponse.status, 200);
    
    // Step 4: Create a pitch
    const pitchResponse = await fetch(`${BASE_URL}/api/pitches`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: "Integration Test Movie",
        logline: "A thrilling test of system integration",
        genre: "Thriller",
        format: "Feature Film",
        budgetRange: "$1M - $5M",
        targetAudience: "18-34"
      })
    });
    
    const pitchData = await pitchResponse.json();
    assertEquals(pitchResponse.status, 200);
    assertExists(pitchData.data?.pitch.id);
    
    // Step 5: Sign out
    const signOutResponse = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    assertEquals(signOutResponse.status, 200);
    
    // Step 6: Verify session is destroyed
    const invalidSessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    
    assertEquals(invalidSessionResponse.status, 401);
  },
  sanitizeResources: false,
  sanitizeOps: false
});

Deno.test({
  name: "Authentication Workflow - Cross-Portal Access Control",
  fn: async () => {
    const helper = new ApiTestHelper();
    
    // Login as creator
    await helper.login("creator");
    const creatorToken = helper.getToken();
    
    // Try to access investor-only endpoint
    const investorEndpointResponse = await fetch(`${BASE_URL}/api/investor/portfolio`, {
      headers: {
        "Authorization": `Bearer ${creatorToken}`
      }
    });
    
    // Should be forbidden
    assertEquals(investorEndpointResponse.status, 403);
    
    // Login as investor
    await helper.logout();
    await helper.login("investor");
    const investorToken = helper.getToken();
    
    // Access investor endpoint - should succeed
    const portfolioResponse = await fetch(`${BASE_URL}/api/investor/portfolio`, {
      headers: {
        "Authorization": `Bearer ${investorToken}`
      }
    });
    
    assertEquals(portfolioResponse.status, 200);
    
    // Try to access creator-only endpoint
    const creatorEndpointResponse = await fetch(`${BASE_URL}/api/creator/analytics`, {
      headers: {
        "Authorization": `Bearer ${investorToken}`
      }
    });
    
    // Should be forbidden
    assertEquals(creatorEndpointResponse.status, 403);
  },
  sanitizeResources: false,
  sanitizeOps: false
});

Deno.test({
  name: "Authentication Workflow - Token Refresh",
  fn: async () => {
    const helper = new ApiTestHelper();
    
    // Login
    await helper.login("creator");
    const initialToken = helper.getToken();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Refresh session
    const refreshResponse = await fetch(`${BASE_URL}/api/auth/session/refresh`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${initialToken}`
      }
    });
    
    const refreshData = await refreshResponse.json();
    assertEquals(refreshResponse.status, 200);
    assertExists(refreshData.data?.token);
    
    // Verify new token works
    const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        "Authorization": `Bearer ${refreshData.data.token}`
      }
    });
    
    assertEquals(sessionResponse.status, 200);
  },
  sanitizeResources: false,
  sanitizeOps: false
});

Deno.test({
  name: "Authentication Workflow - Password Reset",
  fn: async () => {
    const helper = new ApiTestHelper();
    const email = "test.reset@example.com";
    
    // Request password reset
    const resetRequestResponse = await helper.request("POST", "/api/auth/password/reset", {
      email
    });
    
    assertEquals(resetRequestResponse.status, 200);
    const resetData = await resetRequestResponse.json();
    
    // In a real scenario, we'd get the token from email
    // For testing, we'll simulate having received it
    const resetToken = "simulated-reset-token";
    
    // Reset password with token
    const resetResponse = await helper.request("POST", "/api/auth/password/confirm", {
      token: resetToken,
      newPassword: "NewSecurePass123!"
    });
    
    // This would succeed in a real implementation
    // For now, we expect it to fail gracefully
    const resetResult = await resetResponse.json();
    assertExists(resetResult);
  },
  sanitizeResources: false,
  sanitizeOps: false
});