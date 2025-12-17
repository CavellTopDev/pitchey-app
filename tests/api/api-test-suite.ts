/**
 * Comprehensive API Test Suite for Pitchey Platform
 * Tests all critical endpoints and workflows
 */

import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("TEST_API_URL") || "http://localhost:8001";
const TEST_TIMEOUT = 30000;

// Test data
const testUsers = {
  creator: {
    email: "test.creator@example.com",
    password: "TestPass123!",
    name: "Test Creator",
    userType: "creator"
  },
  investor: {
    email: "test.investor@example.com",
    password: "TestPass123!",
    name: "Test Investor",
    userType: "investor"
  },
  production: {
    email: "test.production@example.com",
    password: "TestPass123!",
    name: "Test Production",
    userType: "production"
  }
};

// Helper functions
class ApiTestHelper {
  private token: string | null = null;
  private userId: string | null = null;

  async request(
    method: string,
    endpoint: string,
    body?: any,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...options
    });

    return response;
  }

  async login(userType: "creator" | "investor" | "production"): Promise<void> {
    const user = testUsers[userType];
    const response = await this.request("POST", `/api/auth/${userType}/login`, {
      email: user.email,
      password: user.password
    });

    const data = await response.json();
    if (data.success && data.data) {
      this.token = data.data.token;
      this.userId = data.data.user.id;
    } else {
      throw new Error(`Login failed for ${userType}: ${data.error?.message}`);
    }
  }

  async logout(): Promise<void> {
    await this.request("POST", "/api/auth/logout");
    this.token = null;
    this.userId = null;
  }

  getToken(): string | null {
    return this.token;
  }

  getUserId(): string | null {
    return this.userId;
  }
}

// Test Suite
Deno.test({
  name: "API Test Suite",
  fn: async (t) => {
    const helper = new ApiTestHelper();

    // ============================================
    // AUTHENTICATION TESTS
    // ============================================
    
    await t.step("Authentication - Creator Registration", async () => {
      const response = await helper.request("POST", "/api/auth/creator/register", {
        ...testUsers.creator,
        companyName: "Test Studios"
      });

      const data = await response.json();
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.token);
      assertExists(data.data?.user);
    });

    await t.step("Authentication - Creator Login", async () => {
      const response = await helper.request("POST", "/api/auth/creator/login", {
        email: testUsers.creator.email,
        password: testUsers.creator.password
      });

      const data = await response.json();
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.token);
      assertEquals(data.data?.user.email, testUsers.creator.email);
    });

    await t.step("Authentication - Invalid Credentials", async () => {
      const response = await helper.request("POST", "/api/auth/creator/login", {
        email: testUsers.creator.email,
        password: "WrongPassword"
      });

      const data = await response.json();
      assertEquals(response.status, 401);
      assertEquals(data.success, false);
      assertExists(data.error);
    });

    await t.step("Authentication - Session Check", async () => {
      await helper.login("creator");
      
      const response = await helper.request("GET", "/api/auth/session");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.session);
    });

    // ============================================
    // USER PROFILE TESTS
    // ============================================

    await t.step("User Profile - Get Profile", async () => {
      await helper.login("creator");
      
      const response = await helper.request("GET", "/api/users/profile");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.user);
      assertExists(data.data?.stats);
    });

    await t.step("User Profile - Update Profile", async () => {
      await helper.login("creator");
      
      const updates = {
        bio: "Updated bio for testing",
        website: "https://example.com",
        linkedinUrl: "https://linkedin.com/in/testuser"
      };

      const response = await helper.request("PUT", "/api/users/profile", updates);
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data?.user.bio, updates.bio);
    });

    await t.step("User Settings - Get Settings", async () => {
      await helper.login("creator");
      
      const response = await helper.request("GET", "/api/users/settings");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.settings);
    });

    await t.step("User Settings - Update Settings", async () => {
      await helper.login("creator");
      
      const settings = {
        theme: "dark",
        language: "en",
        notificationSettings: {
          email: true,
          push: false
        }
      };

      const response = await helper.request("PUT", "/api/users/settings", settings);
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data?.settings.theme, "dark");
    });

    // ============================================
    // PITCH MANAGEMENT TESTS
    // ============================================

    let createdPitchId: string;

    await t.step("Pitches - Create Pitch", async () => {
      await helper.login("creator");
      
      const pitchData = {
        title: "Test Movie Pitch",
        logline: "A compelling story about testing",
        genre: "Drama",
        format: "Feature Film",
        budgetRange: "$1M - $5M",
        targetAudience: "18-34",
        synopsis: "This is a test synopsis for our movie pitch."
      };

      const response = await helper.request("POST", "/api/pitches", pitchData);
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.pitch);
      assertEquals(data.data?.pitch.title, pitchData.title);
      
      createdPitchId = data.data?.pitch.id;
    });

    await t.step("Pitches - Get Single Pitch", async () => {
      const response = await helper.request("GET", `/api/pitches/${createdPitchId}`);
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data?.pitch.id, createdPitchId);
    });

    await t.step("Pitches - Update Pitch", async () => {
      await helper.login("creator");
      
      const updates = {
        title: "Updated Test Movie Pitch",
        budgetRange: "$5M - $10M"
      };

      const response = await helper.request("PUT", `/api/pitches/${createdPitchId}`, updates);
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertEquals(data.data?.pitch.title, updates.title);
    });

    await t.step("Pitches - List Pitches", async () => {
      const response = await helper.request("GET", "/api/pitches?page=1&limit=10");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data);
      assertExists(data.meta?.pagination);
    });

    await t.step("Pitches - Search Pitches", async () => {
      const response = await helper.request("GET", "/api/search?q=test&genre=Drama");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data);
    });

    await t.step("Pitches - Browse Pitches", async () => {
      const response = await helper.request("GET", "/api/browse?tab=trending");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.pitches);
      assertEquals(data.data?.tab, "trending");
    });

    // ============================================
    // NDA WORKFLOW TESTS
    // ============================================

    await t.step("NDA - Request NDA", async () => {
      await helper.login("investor");
      
      const response = await helper.request("POST", "/api/ndas/request", {
        pitchId: createdPitchId
      });
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.nda);
      assertEquals(data.data?.nda.status, "pending");
    });

    await t.step("NDA - Get NDAs", async () => {
      await helper.login("investor");
      
      const response = await helper.request("GET", "/api/ndas");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.ndas);
    });

    // ============================================
    // INVESTMENT TESTS
    // ============================================

    await t.step("Investments - Create Investment", async () => {
      await helper.login("investor");
      
      const investmentData = {
        pitchId: createdPitchId,
        amount: 100000,
        investmentType: "equity",
        terms: {
          equityPercentage: 10,
          milestones: ["Pre-production", "Production", "Post-production"]
        }
      };

      const response = await helper.request("POST", "/api/investments", investmentData);
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.investment);
      assertEquals(data.data?.investment.amount, investmentData.amount);
    });

    await t.step("Investments - Get Portfolio", async () => {
      await helper.login("investor");
      
      const response = await helper.request("GET", "/api/portfolio");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.summary);
      assertExists(data.data?.recentInvestments);
    });

    // ============================================
    // FILE UPLOAD TESTS
    // ============================================

    await t.step("Upload - Document Upload", async () => {
      await helper.login("creator");
      
      const formData = new FormData();
      const file = new File(["test content"], "test.pdf", { type: "application/pdf" });
      formData.append("file", file);
      formData.append("pitchId", createdPitchId);
      formData.append("type", "script");

      const response = await fetch(`${BASE_URL}/api/upload/document`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${helper.getToken()}`
        },
        body: formData
      });

      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.key);
      assertExists(data.data?.url);
    });

    // ============================================
    // DASHBOARD TESTS
    // ============================================

    await t.step("Dashboard - Creator Dashboard", async () => {
      await helper.login("creator");
      
      const response = await helper.request("GET", "/api/creator/dashboard");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.stats);
      assertExists(data.data?.recentPitches);
    });

    await t.step("Dashboard - Investor Dashboard", async () => {
      await helper.login("investor");
      
      const response = await helper.request("GET", "/api/investor/dashboard");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.stats);
      assertExists(data.data?.recentActivity);
    });

    await t.step("Dashboard - Production Dashboard", async () => {
      await helper.login("production");
      
      const response = await helper.request("GET", "/api/production/dashboard");
      const data = await response.json();
      
      assertEquals(response.status, 200);
      assertEquals(data.success, true);
      assertExists(data.data?.stats);
      assertExists(data.data?.activeProjects);
    });

    // ============================================
    // ERROR HANDLING TESTS
    // ============================================

    await t.step("Error Handling - 404 Not Found", async () => {
      const response = await helper.request("GET", "/api/nonexistent");
      assertEquals(response.status, 404);
    });

    await t.step("Error Handling - 401 Unauthorized", async () => {
      await helper.logout();
      
      const response = await helper.request("GET", "/api/users/profile");
      assertEquals(response.status, 401);
    });

    await t.step("Error Handling - 400 Bad Request", async () => {
      await helper.login("creator");
      
      const response = await helper.request("POST", "/api/pitches", {
        // Missing required fields
        title: ""
      });
      
      assertEquals(response.status, 400);
    });

    // ============================================
    // CLEANUP
    // ============================================

    await t.step("Cleanup - Delete Pitch", async () => {
      await helper.login("creator");
      
      const response = await helper.request("DELETE", `/api/pitches/${createdPitchId}`);
      assertEquals(response.status, 204);
    });
  },
  sanitizeResources: false,
  sanitizeOps: false
});

// Performance Test
Deno.test({
  name: "API Performance Test",
  fn: async () => {
    const helper = new ApiTestHelper();
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await helper.request("GET", "/api/pitches?page=1&limit=20");
      const end = performance.now();
      times.push(end - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    console.log(`Performance Metrics (${iterations} requests):`);
    console.log(`  Average: ${avgTime.toFixed(2)}ms`);
    console.log(`  Min: ${minTime.toFixed(2)}ms`);
    console.log(`  Max: ${maxTime.toFixed(2)}ms`);

    // Assert performance thresholds
    assertEquals(avgTime < 500, true, "Average response time should be under 500ms");
    assertEquals(maxTime < 1000, true, "Max response time should be under 1000ms");
  }
});