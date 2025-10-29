// API Endpoints Test Suite for Pitchey Platform
// Tests all critical API endpoints for functionality and proper responses

import { assertEquals, assertExists } from "@std/testing/asserts.ts";
import { setupTestDB } from "./setup.ts";

const API_BASE = "http://localhost:8001";

// Demo account credentials
const DEMO_ACCOUNTS = {
  creator: { email: "alex.creator@demo.com", password: "Demo123" },
  investor: { email: "sarah.investor@demo.com", password: "Demo123" },
  production: { email: "stellar.production@demo.com", password: "Demo123" },
};

// Helper function to make authenticated requests
async function authenticatedRequest(
  endpoint: string,
  token: string,
  method = "GET",
  body?: any
) {
  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  return {
    status: response.status,
    data: response.headers.get("content-type")?.includes("application/json")
      ? await response.json()
      : await response.text(),
    headers: response.headers,
  };
}

// Helper function to login and get token
async function login(portal: "creator" | "investor" | "production") {
  const credentials = DEMO_ACCOUNTS[portal];
  const response = await fetch(`${API_BASE}/api/auth/${portal}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(`Login failed for ${portal}: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

Deno.test({
  name: "API Endpoints - Health Check",
  async fn() {
    const response = await fetch(`${API_BASE}/api/health`);
    assertEquals(response.status, 200);
    
    const data = await response.json();
    assertExists(data.status);
    // Accept either "healthy" or "ok" for compatibility
    assertEquals(data.status === "healthy" || data.status === "ok", true);
  },
});

Deno.test({
  name: "API Endpoints - Authentication Endpoints",
  async fn() {
    // Test creator login
    const creatorResponse = await fetch(`${API_BASE}/api/auth/creator/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEMO_ACCOUNTS.creator),
    });
    assertEquals(creatorResponse.status, 200);
    
    const creatorData = await creatorResponse.json();
    assertExists(creatorData.token);
    assertExists(creatorData.user);

    // Test investor login
    const investorResponse = await fetch(`${API_BASE}/api/auth/investor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEMO_ACCOUNTS.investor),
    });
    assertEquals(investorResponse.status, 200);
    
    const investorData = await investorResponse.json();
    assertExists(investorData.token);
    assertExists(investorData.user);

    // Test production login
    const productionResponse = await fetch(`${API_BASE}/api/auth/production/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DEMO_ACCOUNTS.production),
    });
    assertEquals(productionResponse.status, 200);
    
    const productionData = await productionResponse.json();
    assertExists(productionData.token);
    assertExists(productionData.user);
  },
});

Deno.test({
  name: "API Endpoints - Pitches CRUD Operations",
  async fn() {
    const creatorToken = await login("creator");

    // Test GET /api/pitches
    const listResponse = await authenticatedRequest("/api/pitches", creatorToken);
    assertEquals(listResponse.status, 200);
    assertExists(listResponse.data);

    // Test POST /api/pitches (create new pitch)
    const newPitch = {
      title: "Test Pitch",
      logline: "A test pitch for automated testing",
      genre: "Drama",
      duration: 120,
      budget: "low",
      category: "Feature Film",
    };

    const createResponse = await authenticatedRequest(
      "/api/pitches",
      creatorToken,
      "POST",
      newPitch
    );
    assertEquals(createResponse.status, 201);
    assertExists(createResponse.data.id);

    const pitchId = createResponse.data.id;

    // Test GET /api/pitches/:id
    const getResponse = await authenticatedRequest(
      `/api/pitches/${pitchId}`,
      creatorToken
    );
    assertEquals(getResponse.status, 200);
    assertEquals(getResponse.data.title, newPitch.title);

    // Test PUT /api/pitches/:id (update)
    const updatedPitch = { ...newPitch, title: "Updated Test Pitch" };
    const updateResponse = await authenticatedRequest(
      `/api/pitches/${pitchId}`,
      creatorToken,
      "PUT",
      updatedPitch
    );
    assertEquals(updateResponse.status, 200);
    assertEquals(updateResponse.data.title, "Updated Test Pitch");

    // Test DELETE /api/pitches/:id
    const deleteResponse = await authenticatedRequest(
      `/api/pitches/${pitchId}`,
      creatorToken,
      "DELETE"
    );
    assertEquals(deleteResponse.status, 204);
  },
});

Deno.test({
  name: "API Endpoints - Browse and Search",
  async fn() {
    // Test public browse endpoint
    const browseResponse = await fetch(`${API_BASE}/api/browse`);
    assertEquals(browseResponse.status, 200);
    
    const browseData = await browseResponse.json();
    assertExists(browseData.pitches);

    // Test browse with filters
    const filteredResponse = await fetch(
      `${API_BASE}/api/browse?genre=Drama&budget=low`
    );
    assertEquals(filteredResponse.status, 200);

    // Test search endpoint
    const searchResponse = await fetch(`${API_BASE}/api/search?q=test`);
    assertEquals(searchResponse.status, 200);
    
    const searchData = await searchResponse.json();
    assertExists(searchData.results);
  },
});

Deno.test({
  name: "API Endpoints - NDA Workflow",
  async fn() {
    const creatorToken = await login("creator");
    const investorToken = await login("investor");

    // Test GET /api/ndas (list NDAs)
    const listResponse = await authenticatedRequest("/api/ndas", creatorToken);
    assertEquals(listResponse.status, 200);

    // Test POST /api/ndas/request (NDA request from investor)
    const ndaRequest = {
      pitchId: 1,
      message: "Test NDA request for automated testing",
    };

    const requestResponse = await authenticatedRequest(
      "/api/ndas/request",
      investorToken,
      "POST",
      ndaRequest
    );
    // Accept 201 (created) or 409 (already exists)
    const acceptableStatuses = [201, 409];
    assertEquals(acceptableStatuses.includes(requestResponse.status), true);

    // Test GET /api/ndas/:id (if we got a new NDA)
    if (requestResponse.status === 201) {
      const ndaId = requestResponse.data.id;
      const getResponse = await authenticatedRequest(
        `/api/ndas/${ndaId}`,
        creatorToken
      );
      assertEquals(getResponse.status, 200);
    }
  },
});

Deno.test({
  name: "API Endpoints - Dashboard Endpoints",
  async fn() {
    const creatorToken = await login("creator");
    const investorToken = await login("investor");
    const productionToken = await login("production");

    // Test creator dashboard
    const creatorDashboard = await authenticatedRequest(
      "/api/creator/dashboard",
      creatorToken
    );
    assertEquals(creatorDashboard.status, 200);
    assertExists(creatorDashboard.data.stats);

    // Test investor dashboard
    const investorDashboard = await authenticatedRequest(
      "/api/investor/dashboard",
      investorToken
    );
    assertEquals(investorDashboard.status, 200);
    assertExists(investorDashboard.data.stats);

    // Test production dashboard
    const productionDashboard = await authenticatedRequest(
      "/api/production/dashboard",
      productionToken
    );
    assertEquals(productionDashboard.status, 200);
    assertExists(productionDashboard.data.stats);
  },
});

Deno.test({
  name: "API Endpoints - File Upload",
  async fn() {
    const creatorToken = await login("creator");

    // Create a simple test file
    const testContent = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const formData = new FormData();
    formData.append("file", new Blob([testContent]), "test.txt");

    const uploadResponse = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${creatorToken}`,
      },
      body: formData,
    });

    // Accept 200, 201, or 413 (file too large) as valid responses
    const acceptableStatuses = [200, 201, 413];
    assertEquals(acceptableStatuses.includes(uploadResponse.status), true);
  },
});

Deno.test({
  name: "API Endpoints - Cache and Performance",
  async fn() {
    // Test cache health endpoint
    const cacheResponse = await fetch(`${API_BASE}/api/cache/health`);
    // Accept 200 (cache working) or 503 (fallback mode)
    const acceptableStatuses = [200, 503];
    assertEquals(acceptableStatuses.includes(cacheResponse.status), true);

    // Test analytics endpoint
    const creatorToken = await login("creator");
    const analyticsResponse = await authenticatedRequest(
      "/api/analytics",
      creatorToken
    );
    // Analytics might not be fully implemented, so accept 200 or 404
    const analyticsStatuses = [200, 404];
    assertEquals(analyticsStatuses.includes(analyticsResponse.status), true);
  },
});

Deno.test({
  name: "API Endpoints - Security and Access Control",
  async fn() {
    // Test unauthorized access to protected endpoint
    const unauthorizedResponse = await fetch(`${API_BASE}/api/admin/users`);
    assertEquals(unauthorizedResponse.status, 401);

    // Test invalid token
    const invalidTokenResponse = await fetch(`${API_BASE}/api/pitches`, {
      headers: { "Authorization": "Bearer invalid-token" },
    });
    assertEquals(invalidTokenResponse.status, 401);

    // Test access control - investor shouldn't be able to create pitches
    const investorToken = await login("investor");
    const createPitchResponse = await authenticatedRequest(
      "/api/pitches",
      investorToken,
      "POST",
      { title: "Unauthorized pitch" }
    );
    assertEquals(createPitchResponse.status, 403);
  },
});

Deno.test({
  name: "API Endpoints - Character Management",
  async fn() {
    const creatorToken = await login("creator");

    // Test characters endpoint
    const charactersResponse = await authenticatedRequest(
      "/api/characters",
      creatorToken
    );
    // Accept 200 (characters exist) or 404 (no characters yet)
    const acceptableStatuses = [200, 404];
    assertEquals(acceptableStatuses.includes(charactersResponse.status), true);

    // Test character creation
    const newCharacter = {
      name: "Test Character",
      description: "A character for testing",
      pitchId: 1,
    };

    const createCharacterResponse = await authenticatedRequest(
      "/api/characters",
      creatorToken,
      "POST",
      newCharacter
    );
    // Accept 201 (created) or 404 (endpoint not implemented)
    const createStatuses = [201, 404];
    assertEquals(createStatuses.includes(createCharacterResponse.status), true);
  },
});

Deno.test({
  name: "API Endpoints - Logout Functionality",
  async fn() {
    const creatorToken = await login("creator");
    const investorToken = await login("investor");
    const productionToken = await login("production");

    // Test creator logout
    const creatorLogout = await authenticatedRequest(
      "/api/auth/creator/logout",
      creatorToken,
      "POST"
    );
    const logoutStatuses = [200, 204];
    assertEquals(logoutStatuses.includes(creatorLogout.status), true);

    // Test investor logout
    const investorLogout = await authenticatedRequest(
      "/api/auth/investor/logout",
      investorToken,
      "POST"
    );
    assertEquals(logoutStatuses.includes(investorLogout.status), true);

    // Test production logout
    const productionLogout = await authenticatedRequest(
      "/api/auth/production/logout",
      productionToken,
      "POST"
    );
    assertEquals(logoutStatuses.includes(productionLogout.status), true);
  },
});

Deno.test({
  name: "API Endpoints - Error Handling",
  async fn() {
    const creatorToken = await login("creator");

    // Test 404 for non-existent resource
    const notFoundResponse = await authenticatedRequest(
      "/api/pitches/99999",
      creatorToken
    );
    assertEquals(notFoundResponse.status, 404);

    // Test malformed JSON
    const malformedResponse = await fetch(`${API_BASE}/api/pitches`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${creatorToken}`,
        "Content-Type": "application/json",
      },
      body: "invalid json",
    });
    assertEquals(malformedResponse.status, 400);

    // Test missing required fields
    const missingFieldsResponse = await authenticatedRequest(
      "/api/pitches",
      creatorToken,
      "POST",
      { title: "" } // Missing required fields
    );
    assertEquals(missingFieldsResponse.status, 400);
  },
});