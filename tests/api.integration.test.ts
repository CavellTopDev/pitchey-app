import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const API_URL = "http://localhost:8001";
let authToken: string;
let userId: number;
let pitchId: number;

// Helper function to make API requests
async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  
  return await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
}

Deno.test("API Integration Tests", async (t) => {
  
  await t.step("Health Check", async () => {
    const response = await apiRequest("/api/health");
    assertEquals(response.status, 200);
    const data = await response.json();
    assertEquals(data.status, "healthy");
  });

  await t.step("Authentication", async (st) => {
    
    await st.step("Register new user", async () => {
      const response = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: `test${Date.now()}@example.com`,
          username: `testuser${Date.now()}`,
          password: "password123",
          userType: "creator",
        }),
      });
      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.user);
      assertExists(data.session);
      authToken = data.session.token;
      userId = data.user.id;
    });

    await st.step("Login with credentials", async () => {
      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });
      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.session.token);
    });

    await st.step("Login with invalid credentials", async () => {
      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "wrong@example.com",
          password: "wrongpassword",
        }),
      });
      assertEquals(response.status, 401);
    });
  });

  await t.step("User Profile", async (st) => {
    
    await st.step("Get profile (authenticated)", async () => {
      const response = await apiRequest("/api/profile", {
        method: "GET",
      });
      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.id);
      assertExists(data.email);
    });

    await st.step("Get profile (unauthenticated)", async () => {
      const response = await fetch(`${API_URL}/api/profile`);
      await response.json(); // Consume the body
      assertEquals(response.status, 401);
    });

    await st.step("Update profile", async () => {
      const response = await apiRequest("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          firstName: "Test",
          lastName: "User",
          bio: "Test bio",
          location: "Test City",
        }),
      });
      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(data.message, "Profile updated successfully");
    });
  });

  await t.step("Pitches", async (st) => {
    
    await st.step("List all pitches", async () => {
      const response = await apiRequest("/api/pitches");
      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(Array.isArray(data), true);
    });

    await st.step("Create new pitch", async () => {
      const response = await apiRequest("/api/pitches", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Pitch",
          logline: "A test pitch for integration testing",
          genre: "drama",
          format: "feature",
          shortSynopsis: "This is a test synopsis",
        }),
      });
      assertEquals(response.status, 201);
      const data = await response.json();
      assertExists(data.id);
      pitchId = data.id;
    });

    await st.step("Get pitch by ID", async () => {
      const response = await apiRequest(`/api/pitches/${pitchId}`);
      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(data.id, pitchId);
      assertEquals(data.title, "Test Pitch");
    });

    await st.step("Search pitches", async () => {
      const response = await apiRequest("/api/search?q=test&genre=drama");
      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.results);
      assertExists(data.totalCount);
    });

    await st.step("Get trending pitches", async () => {
      const response = await apiRequest("/api/trending");
      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(Array.isArray(data), true);
    });
  });

  await t.step("NDA Management", async (st) => {
    
    await st.step("Sign NDA for pitch", async () => {
      // Use a different pitch ID that we don't own
      const response = await apiRequest("/api/pitches/23/nda", {
        method: "POST",
        body: JSON.stringify({
          ndaType: "basic",
        }),
      });
      
      // Should succeed or return already signed
      const validStatuses = [201, 200, 409]; // Created, OK, or Conflict (already signed)
      assertEquals(validStatuses.includes(response.status), true);
    });
  });

  await t.step("Analytics", async (st) => {
    
    await st.step("Record pitch view", async () => {
      const response = await apiRequest(`/api/pitches/${pitchId}/view`, {
        method: "POST",
      });
      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(data.message, "View recorded");
      assertExists(data.viewCount);
    });

    await st.step("Get pitch analytics (owner)", async () => {
      const response = await apiRequest(`/api/pitches/${pitchId}/analytics`);
      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.totalViews);
      assertExists(data.uniqueViewers);
      assertExists(data.viewerDemographics);
    });

    await st.step("Get pitch analytics (non-owner)", async () => {
      // Try to get analytics for a pitch we don't own
      const response = await apiRequest("/api/pitches/1/analytics");
      assertEquals(response.status, 403);
    });
  });

  await t.step("Error Handling", async (st) => {
    
    await st.step("404 for non-existent pitch", async () => {
      const response = await apiRequest("/api/pitches/99999");
      assertEquals(response.status, 404);
    });

    await st.step("401 for protected endpoint without auth", async () => {
      const response = await fetch(`${API_URL}/api/pitches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          logline: "Test",
        }),
      });
      await response.json(); // Consume the body
      assertEquals(response.status, 401);
    });

    await st.step("Invalid request body", async () => {
      const response = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "invalid-email",
          password: "short",
        }),
      });
      assertEquals(response.status, 400);
    });
  });

  await t.step("Search and Filtering", async (st) => {
    
    await st.step("Filter by genre", async () => {
      const response = await apiRequest("/api/pitches?genre=scifi");
      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(Array.isArray(data), true);
    });

    await st.step("Filter by format", async () => {
      const response = await apiRequest("/api/pitches?format=feature");
      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(Array.isArray(data), true);
    });

    await st.step("Pagination", async () => {
      const response = await apiRequest("/api/pitches?page=1&limit=5");
      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(Array.isArray(data), true);
      assertEquals(data.length <= 5, true);
    });

    await st.step("Combined filters", async () => {
      const response = await apiRequest("/api/pitches?genre=drama&format=feature&search=test");
      assertEquals(response.status, 200);
      const data = await response.json();
      assertEquals(Array.isArray(data), true);
    });
  });
});

// Performance tests
Deno.test("API Performance Tests", async (t) => {
  
  await t.step("Response time < 500ms for list endpoints", async () => {
    const start = Date.now();
    const response = await apiRequest("/api/pitches");
    await response.json(); // Consume the body
    const duration = Date.now() - start;
    assertEquals(duration < 500, true);
  });

  await t.step("Concurrent requests handling", async () => {
    const requests = Array.from({ length: 10 }, () => 
      apiRequest("/api/pitches")
    );
    
    const responses = await Promise.all(requests);
    for (const response of responses) {
      assertEquals(response.status, 200);
      await response.json(); // Consume the body
    }
  });
});

// Security tests
Deno.test("API Security Tests", async (t) => {
  
  await t.step("CORS headers present", async () => {
    const response = await apiRequest("/api/health");
    await response.json(); // Consume the body
    assertEquals(response.headers.has("access-control-allow-origin"), true);
  });

  await t.step("SQL injection protection", async () => {
    const response = await apiRequest("/api/search?q=' OR '1'='1");
    await response.json(); // Consume the body
    // Should not cause error, just return normal results
    assertEquals(response.status, 200);
  });

  await t.step("XSS protection", async () => {
    const response = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        username: "<script>alert('xss')</script>",
        password: "password123",
        userType: "creator",
      }),
    });
    await response.json(); // Consume the body
    // Should sanitize or reject
    const validStatuses = [400, 200]; // Bad request or sanitized success
    assertEquals(validStatuses.includes(response.status), true);
  });
});