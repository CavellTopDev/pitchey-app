import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { db } from "../src/db/client.ts";
import { sql } from "drizzle-orm";

// Test configuration
export const TEST_CONFIG = {
  API_BASE: "http://localhost:8001",
  WS_BASE: "ws://localhost:8001",
  DEMO_ACCOUNTS: {
    creator: { email: "alex.creator@demo.com", password: "Demo123" },
    investor: { email: "sarah.investor@demo.com", password: "Demo123" },
    production: { email: "stellar.production@demo.com", password: "Demo123" },
  },
};

// Test utilities
export class TestHelper {
  private tokens: Map<string, string> = new Map();
  private users: Map<string, any> = new Map();

  async login(portal: "creator" | "investor" | "production") {
    if (this.tokens.has(portal)) {
      return {
        token: this.tokens.get(portal)!,
        user: this.users.get(portal)!,
      };
    }

    const credentials = TEST_CONFIG.DEMO_ACCOUNTS[portal];
    const response = await fetch(`${TEST_CONFIG.API_BASE}/api/auth/${portal}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error(`Login failed for ${portal}: ${response.status}`);
    }

    const data = await response.json();
    this.tokens.set(portal, data.token);
    this.users.set(portal, data.user);
    
    return { token: data.token, user: data.user };
  }

  async authenticatedRequest(
    endpoint: string,
    portal: "creator" | "investor" | "production",
    method = "GET",
    body?: any
  ) {
    const { token } = await this.login(portal);
    
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

    const response = await fetch(`${TEST_CONFIG.API_BASE}${endpoint}`, options);
    return {
      status: response.status,
      ok: response.ok,
      data: response.headers.get("content-type")?.includes("application/json")
        ? await response.json()
        : await response.text(),
      headers: response.headers,
    };
  }

  async createTestPitch(portal: "creator" | "production" = "creator") {
    const pitchData = {
      title: `Test Pitch ${Date.now()}`,
      logline: "A test pitch for automated testing",
      synopsis: "Detailed synopsis for testing purposes",
      genre: "Drama",
      duration: 120,
      budget: "medium",
      category: "Feature Film",
      target_audience: "18-35 Adults",
      themes: "Testing, Automation, Quality Assurance",
      world: "Modern testing environment",
    };

    const response = await this.authenticatedRequest(
      "/api/pitches",
      portal,
      "POST",
      pitchData
    );

    if (response.status === 201) {
      return response.data;
    }
    throw new Error(`Failed to create test pitch: ${response.status}`);
  }

  async cleanupTestPitch(pitchId: number, portal: "creator" | "production" = "creator") {
    try {
      await this.authenticatedRequest(`/api/pitches/${pitchId}`, portal, "DELETE");
    } catch (error) {
      console.warn(`Failed to cleanup test pitch ${pitchId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  async waitForCondition(
    conditionFn: () => Promise<boolean>,
    timeoutMs = 5000,
    intervalMs = 100
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        if (await conditionFn()) {
          return true;
        }
      } catch (error) {
        // Condition check failed, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    return false;
  }

  async checkEndpointHealth(endpoint: string): Promise<boolean> {
    try {
      const response = await fetch(`${TEST_CONFIG.API_BASE}${endpoint}`);
      await response.body?.cancel(); // Consume response body
      return response.status < 500; // Accept 4xx as "healthy" (auth errors are expected)
    } catch (error) {
      return false;
    }
  }

  generateTestFile(type: "image" | "document" | "text" = "text") {
    switch (type) {
      case "image":
        // PNG header
        return new Uint8Array([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
          0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        ]);
      case "document":
        // PDF header
        return new Uint8Array([
          0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34,
        ]);
      default:
        return new TextEncoder().encode("Test file content for automated testing");
    }
  }

  async testWebSocketConnection(timeoutMs = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(`${TEST_CONFIG.WS_BASE}/ws`);
        let resolved = false;
        
        ws.onopen = () => {
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve(true);
          }
        };
        
        ws.onerror = () => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        };
        
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve(false);
          }
        }, timeoutMs);
      } catch (error) {
        resolve(false);
      }
    });
  }

  clearCache() {
    this.tokens.clear();
    this.users.clear();
  }
}

// Database setup and teardown
export async function setupTestDB() {
  try {
    // Run migrations
    await import("../src/db/migrate.ts");
    
    // Clear existing data (be careful with this in production!)
    if (Deno.env.get("NODE_ENV") !== "production") {
      await db.execute(sql`TRUNCATE users, pitches, ndas, sessions CASCADE`);
    }
    
    // Run seeds
    await import("../src/db/seed.ts");
  } catch (error) {
    console.warn("Database setup failed:", error instanceof Error ? error.message : String(error));
    // Don't fail tests if DB setup fails - some tests might still work
  }
}

export async function teardownTestDB() {
  // Cleanup any test data if needed
  // This is intentionally minimal to avoid accidental data loss
}

// Test data factories
export const TestDataFactory = {
  pitch: (overrides: Partial<any> = {}) => ({
    title: "Test Pitch",
    logline: "A test pitch for automated testing",
    synopsis: "Detailed synopsis for testing",
    genre: "Drama",
    duration: 120,
    budget: "medium",
    category: "Feature Film",
    target_audience: "18-35 Adults",
    themes: "Testing, Quality Assurance",
    world: "Modern testing environment",
    ...overrides,
  }),

  character: (pitchId: number, overrides: Partial<any> = {}) => ({
    name: "Test Character",
    description: "A character for testing",
    age: "30s",
    role: "Lead",
    pitchId,
    ...overrides,
  }),

  ndaRequest: (pitchId: number, overrides: Partial<any> = {}) => ({
    pitchId,
    message: "Test NDA request for automated testing",
    ...overrides,
  }),
};

// Export assertions
export { assertEquals, assertExists, assert };

// Global test helper instance
export const testHelper = new TestHelper();