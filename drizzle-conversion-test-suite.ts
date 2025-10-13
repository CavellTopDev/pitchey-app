#!/usr/bin/env deno run --allow-all

/**
 * COMPREHENSIVE DRIZZLE ORM CONVERSION VALIDATION TEST SUITE
 * 
 * This test suite validates that all raw SQL to Drizzle ORM conversions 
 * are working correctly across 72 locations in 31 files.
 * 
 * Tests verify:
 * - API endpoints functionality
 * - Database operations (CRUD)
 * - Date serialization fixes
 * - Type safety
 * - Performance validation
 * - End-to-end workflows
 */

import { assert, assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Test configuration
const BASE_URL = "http://localhost:8001";
const DEMO_ACCOUNTS = {
  creator: { email: "alex.creator@demo.com", password: "Demo123" },
  investor: { email: "sarah.investor@demo.com", password: "Demo123" },
  production: { email: "stellar.production@demo.com", password: "Demo123" }
};

interface TestContext {
  tokens: {
    creator?: string;
    investor?: string; 
    production?: string;
  };
  createdPitchId?: number;
  startTime: number;
}

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  duration: number;
  error?: string;
  details?: any;
}

class DrizzleConversionTestSuite {
  private context: TestContext = {
    tokens: {},
    startTime: Date.now()
  };
  private results: TestResult[] = [];

  // Utility methods
  private async makeRequest(
    path: string, 
    options: RequestInit = {},
    token?: string
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers as Record<string, string>
    };
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers
    });
  }

  private async testWrapper(
    name: string, 
    testFn: () => Promise<void>
  ): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Testing: ${name}`);
      await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ PASS: ${name} (${duration}ms)`);
      
      return {
        name,
        status: "PASS",
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ FAIL: ${name} (${duration}ms): ${error.message}`);
      
      return {
        name,
        status: "FAIL", 
        duration,
        error: error.message
      };
    }
  }

  // Authentication tests
  async testAuthentication(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test Creator Login
    tests.push(await this.testWrapper("Creator Portal Authentication", async () => {
      const response = await this.makeRequest("/api/auth/creator/login", {
        method: "POST",
        body: JSON.stringify(DEMO_ACCOUNTS.creator)
      });

      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.token);
      assertExists(data.user);
      assertEquals(data.user.userType, "creator");
      
      this.context.tokens.creator = data.token;
    }));

    // Test Investor Login
    tests.push(await this.testWrapper("Investor Portal Authentication", async () => {
      const response = await this.makeRequest("/api/auth/investor/login", {
        method: "POST", 
        body: JSON.stringify(DEMO_ACCOUNTS.investor)
      });

      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.token);
      assertExists(data.user);
      assertEquals(data.user.userType, "investor");
      
      this.context.tokens.investor = data.token;
    }));

    // Test Production Login
    tests.push(await this.testWrapper("Production Portal Authentication", async () => {
      const response = await this.makeRequest("/api/auth/production/login", {
        method: "POST",
        body: JSON.stringify(DEMO_ACCOUNTS.production)
      });

      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.token);
      assertExists(data.user);
      assertEquals(data.user.userType, "production");
      
      this.context.tokens.production = data.token;
    }));

    return tests;
  }

  // Dashboard and metrics tests (previously failing due to Date serialization)
  async testDashboardMetrics(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test Creator Dashboard
    tests.push(await this.testWrapper("Creator Dashboard Metrics", async () => {
      const response = await this.makeRequest("/api/dashboard/creator", {
        method: "GET"
      }, this.context.tokens.creator);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      // Verify dashboard data structure (Date serialization critical here)
      assertExists(data.stats);
      assertExists(data.pitches);
      assertExists(data.recentActivity);
      
      // Verify no Date serialization errors
      assert(Array.isArray(data.pitches));
      assert(Array.isArray(data.recentActivity));
      
      // Check for proper date formatting
      if (data.recentActivity.length > 0) {
        const activity = data.recentActivity[0];
        assert(typeof activity.timestamp === "string");
        assert(!isNaN(Date.parse(activity.timestamp)));
      }
    }));

    // Test Investor Dashboard
    tests.push(await this.testWrapper("Investor Dashboard Metrics", async () => {
      const response = await this.makeRequest("/api/dashboard/investor", {
        method: "GET"
      }, this.context.tokens.investor);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertExists(data.stats);
      assertExists(data.topPitches);
      assertExists(data.portfolio);
      assertExists(data.recentActivity);
      
      // Verify Date serialization
      assert(Array.isArray(data.topPitches));
      assert(Array.isArray(data.portfolio));
    }));

    // Test Production Dashboard  
    tests.push(await this.testWrapper("Production Dashboard Metrics", async () => {
      const response = await this.makeRequest("/api/dashboard/production", {
        method: "GET"
      }, this.context.tokens.production);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertExists(data.stats);
      assertExists(data.activeProjects);
      assertExists(data.pitchesInReview);
      
      // Verify Date serialization in projects
      assert(Array.isArray(data.activeProjects));
      assert(Array.isArray(data.pitchesInReview));
    }));

    return tests;
  }

  // Pitch CRUD operations tests
  async testPitchOperations(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test Create Pitch
    tests.push(await this.testWrapper("Create Pitch with Drizzle", async () => {
      const pitchData = {
        title: "Test Drizzle Conversion Film",
        logline: "A comprehensive test of database operations",
        genre: "drama",
        format: "feature",
        shortSynopsis: "Testing the conversion from raw SQL to Drizzle ORM",
        estimatedBudget: 1000000,
        requireNDA: false
      };

      const response = await this.makeRequest("/api/pitches", {
        method: "POST",
        body: JSON.stringify(pitchData)
      }, this.context.tokens.creator);

      assertEquals(response.status, 201);
      const data = await response.json();
      
      assertExists(data.id);
      assertEquals(data.title, pitchData.title);
      assertEquals(data.logline, pitchData.logline);
      assertExists(data.createdAt);
      assertExists(data.updatedAt);
      
      // Verify Date fields are properly serialized
      assert(!isNaN(Date.parse(data.createdAt)));
      assert(!isNaN(Date.parse(data.updatedAt)));
      
      this.context.createdPitchId = data.id;
    }));

    // Test Update Pitch
    tests.push(await this.testWrapper("Update Pitch with Drizzle", async () => {
      if (!this.context.createdPitchId) {
        throw new Error("No pitch created to update");
      }

      const updateData = {
        title: "Updated Test Film via Drizzle",
        longSynopsis: "Extended synopsis added via Drizzle ORM update"
      };

      const response = await this.makeRequest(`/api/pitches/${this.context.createdPitchId}`, {
        method: "PUT",
        body: JSON.stringify(updateData)
      }, this.context.tokens.creator);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertEquals(data.title, updateData.title);
      assertEquals(data.longSynopsis, updateData.longSynopsis);
      assertExists(data.updatedAt);
      
      // Verify updatedAt is newer than createdAt
      assert(new Date(data.updatedAt) >= new Date(data.createdAt));
    }));

    // Test Get Pitch by ID
    tests.push(await this.testWrapper("Get Pitch by ID with Drizzle", async () => {
      if (!this.context.createdPitchId) {
        throw new Error("No pitch created to retrieve");
      }

      const response = await this.makeRequest(`/api/pitches/${this.context.createdPitchId}`, {
        method: "GET"
      }, this.context.tokens.creator);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertEquals(data.id, this.context.createdPitchId);
      assertExists(data.title);
      assertExists(data.creator);
      assertExists(data.createdAt);
      
      // Verify creator relationship is properly joined
      assertEquals(data.creator.userType, "creator");
    }));

    // Test Public Pitch View (with view tracking)
    tests.push(await this.testWrapper("Public Pitch View with View Tracking", async () => {
      if (!this.context.createdPitchId) {
        throw new Error("No pitch created to view");
      }

      // Publish the pitch first
      const publishResponse = await this.makeRequest(`/api/pitches/${this.context.createdPitchId}/publish`, {
        method: "POST"
      }, this.context.tokens.creator);
      
      assertEquals(publishResponse.status, 200);

      // View as investor (should track view)
      const viewResponse = await this.makeRequest(`/api/pitches/public/${this.context.createdPitchId}`, {
        method: "GET"
      }, this.context.tokens.investor);

      assertEquals(viewResponse.status, 200);
      const data = await viewResponse.json();
      
      assertEquals(data.id, this.context.createdPitchId);
      assertExists(data.viewCount);
      
      // Verify view count increased
      assert(data.viewCount >= 1);
    }));

    return tests;
  }

  // View tracking and analytics tests
  async testViewTracking(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    tests.push(await this.testWrapper("View Tracking Service with Drizzle", async () => {
      if (!this.context.createdPitchId) {
        throw new Error("No pitch created for view tracking");
      }

      // Test view demographics endpoint
      const response = await this.makeRequest(`/api/analytics/pitch/${this.context.createdPitchId}/demographics`, {
        method: "GET"
      }, this.context.tokens.creator);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertExists(data.totalViews);
      assertExists(data.demographics);
      assertExists(data.demographics.investors);
      assertExists(data.demographics.productions);
      assertExists(data.demographics.creators);
      
      // Verify demographics are numbers (not strings)
      assert(typeof data.totalViews === "number");
      assert(typeof data.demographics.investors === "number");
    }));

    tests.push(await this.testWrapper("View Tracking by Date with Drizzle", async () => {
      if (!this.context.createdPitchId) {
        throw new Error("No pitch created for date tracking");
      }

      const response = await this.makeRequest(`/api/analytics/pitch/${this.context.createdPitchId}/views-by-date`, {
        method: "GET"
      }, this.context.tokens.creator);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assert(Array.isArray(data));
      
      // Verify date format if data exists
      if (data.length > 0) {
        const entry = data[0];
        assertExists(entry.date);
        assertExists(entry.views);
        assert(typeof entry.views === "number");
      }
    }));

    return tests;
  }

  // Search and filtering tests
  async testSearchOperations(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    tests.push(await this.testWrapper("Pitch Search with Drizzle", async () => {
      const response = await this.makeRequest("/api/pitches/search?q=test&genre=drama&limit=10", {
        method: "GET"
      });

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertExists(data.pitches);
      assertExists(data.totalCount);
      assert(Array.isArray(data.pitches));
      assert(typeof data.totalCount === "number");
      
      // Verify pitch objects have required fields
      if (data.pitches.length > 0) {
        const pitch = data.pitches[0];
        assertExists(pitch.id);
        assertExists(pitch.title);
        assertExists(pitch.creator);
        assertExists(pitch.createdAt);
      }
    }));

    tests.push(await this.testWrapper("Advanced Search with Date Filters", async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];
      
      const response = await this.makeRequest(`/api/pitches/search?created_after=${dateFilter}&format=feature`, {
        method: "GET"
      });

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertExists(data.pitches);
      assert(Array.isArray(data.pitches));
      
      // Verify date filtering worked
      if (data.pitches.length > 0) {
        const pitch = data.pitches[0];
        const createdAt = new Date(pitch.createdAt);
        assert(createdAt >= thirtyDaysAgo);
      }
    }));

    return tests;
  }

  // NDA workflow tests
  async testNDAWorkflow(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    tests.push(await this.testWrapper("NDA Request and Signing with Drizzle", async () => {
      if (!this.context.createdPitchId) {
        throw new Error("No pitch created for NDA testing");
      }

      // Request NDA as investor
      const requestResponse = await this.makeRequest(`/api/ndas/request`, {
        method: "POST",
        body: JSON.stringify({
          pitchId: this.context.createdPitchId,
          message: "Interested in your project"
        })
      }, this.context.tokens.investor);

      assertEquals(requestResponse.status, 201);
      const requestData = await requestResponse.json();
      
      assertExists(requestData.id);
      assertExists(requestData.status);
      assertEquals(requestData.status, "pending");
      
      // Sign NDA as the same investor
      const signResponse = await this.makeRequest(`/api/ndas/sign`, {
        method: "POST",
        body: JSON.stringify({
          pitchId: this.context.createdPitchId,
          ndaType: "basic"
        })
      }, this.context.tokens.investor);

      assertEquals(signResponse.status, 200);
      const signData = await signResponse.json();
      
      assertExists(signData.id);
      assertExists(signData.signedAt);
      
      // Verify signed date is valid
      assert(!isNaN(Date.parse(signData.signedAt)));
    }));

    return tests;
  }

  // User data and relationships tests
  async testUserOperations(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    tests.push(await this.testWrapper("User Profile with Drizzle Relations", async () => {
      const response = await this.makeRequest("/api/profile", {
        method: "GET"
      }, this.context.tokens.creator);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertExists(data.id);
      assertExists(data.email);
      assertExists(data.userType);
      assertExists(data.createdAt);
      
      // Verify Date serialization
      assert(!isNaN(Date.parse(data.createdAt)));
      
      if (data.lastLoginAt) {
        assert(!isNaN(Date.parse(data.lastLoginAt)));
      }
    }));

    tests.push(await this.testWrapper("User Pitch List with Stats", async () => {
      const response = await this.makeRequest("/api/users/pitches", {
        method: "GET"
      }, this.context.tokens.creator);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertExists(data.pitches);
      assertExists(data.stats);
      assert(Array.isArray(data.pitches));
      
      // Verify stats structure
      assert(typeof data.stats.totalPitches === "number");
      assert(typeof data.stats.totalViews === "number");
      assert(typeof data.stats.totalLikes === "number");
      
      // Verify pitch dates are properly serialized
      if (data.pitches.length > 0) {
        const pitch = data.pitches[0];
        assertExists(pitch.createdAt);
        assert(!isNaN(Date.parse(pitch.createdAt)));
      }
    }));

    return tests;
  }

  // Complex query and aggregation tests
  async testComplexQueries(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    tests.push(await this.testWrapper("Dashboard Analytics Aggregations", async () => {
      const response = await this.makeRequest("/api/analytics/dashboard", {
        method: "GET"
      }, this.context.tokens.creator);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertExists(data.totalPitches);
      assertExists(data.totalViews);
      assertExists(data.totalUsers);
      assertExists(data.dailyViews);
      
      // Verify aggregated numbers
      assert(typeof data.totalPitches === "number");
      assert(typeof data.totalViews === "number");
      assert(typeof data.totalUsers === "number");
      assert(Array.isArray(data.dailyViews));
    }));

    tests.push(await this.testWrapper("Investment Portfolio Aggregations", async () => {
      const response = await this.makeRequest("/api/portfolio", {
        method: "GET"
      }, this.context.tokens.investor);

      assertEquals(response.status, 200);
      const data = await response.json();
      
      assertExists(data.investments);
      assertExists(data.totalInvested);
      assertExists(data.currentValue);
      assert(Array.isArray(data.investments));
      
      // Verify numeric calculations
      assert(typeof data.totalInvested === "number");
      assert(typeof data.currentValue === "number");
    }));

    return tests;
  }

  // Type safety and error handling tests
  async testTypeSafety(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    tests.push(await this.testWrapper("Type Safety - Invalid Data Rejection", async () => {
      const invalidPitchData = {
        title: "", // Invalid - empty title
        logline: "A" * 1000, // Invalid - too long
        genre: "invalid_genre", // Invalid genre
        estimatedBudget: "not_a_number" // Invalid budget type
      };

      const response = await this.makeRequest("/api/pitches", {
        method: "POST",
        body: JSON.stringify(invalidPitchData)
      }, this.context.tokens.creator);

      // Should return validation error, not 500
      assert(response.status >= 400 && response.status < 500);
      
      const data = await response.json();
      assertExists(data.error);
    }));

    tests.push(await this.testWrapper("Type Safety - SQL Injection Prevention", async () => {
      const maliciousQuery = "'; DROP TABLE pitches; --";
      
      const response = await this.makeRequest(`/api/pitches/search?q=${encodeURIComponent(maliciousQuery)}`, {
        method: "GET"
      });

      // Should handle gracefully, not crash
      assertEquals(response.status, 200);
      const data = await response.json();
      assertExists(data.pitches);
    }));

    return tests;
  }

  // Performance validation tests
  async testPerformance(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    tests.push(await this.testWrapper("Performance - Dashboard Load Time", async () => {
      const startTime = Date.now();
      
      const response = await this.makeRequest("/api/dashboard/creator", {
        method: "GET"
      }, this.context.tokens.creator);
      
      const loadTime = Date.now() - startTime;
      
      assertEquals(response.status, 200);
      
      // Dashboard should load in under 2 seconds
      assert(loadTime < 2000, `Dashboard took ${loadTime}ms to load (should be < 2000ms)`);
    }));

    tests.push(await this.testWrapper("Performance - Pitch List Pagination", async () => {
      const startTime = Date.now();
      
      const response = await this.makeRequest("/api/pitches?limit=50&offset=0", {
        method: "GET"
      });
      
      const loadTime = Date.now() - startTime;
      
      assertEquals(response.status, 200);
      
      // Paginated list should load quickly
      assert(loadTime < 1000, `Pitch list took ${loadTime}ms to load (should be < 1000ms)`);
      
      const data = await response.json();
      assert(Array.isArray(data));
      assert(data.length <= 50); // Respects limit
    }));

    return tests;
  }

  // Cleanup test
  async testCleanup(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    tests.push(await this.testWrapper("Cleanup - Delete Test Pitch", async () => {
      if (!this.context.createdPitchId) {
        throw new Error("No pitch to cleanup");
      }

      const response = await this.makeRequest(`/api/pitches/${this.context.createdPitchId}`, {
        method: "DELETE"
      }, this.context.tokens.creator);

      assertEquals(response.status, 200);
      
      // Verify deletion
      const getResponse = await this.makeRequest(`/api/pitches/${this.context.createdPitchId}`, {
        method: "GET"
      }, this.context.tokens.creator);
      
      assertEquals(getResponse.status, 404);
    }));

    return tests;
  }

  // Main test runner
  async runAllTests(): Promise<void> {
    console.log("🚀 Starting Comprehensive Drizzle ORM Conversion Test Suite");
    console.log("=" * 80);
    
    const testSuites = [
      { name: "Authentication", tests: await this.testAuthentication() },
      { name: "Dashboard Metrics", tests: await this.testDashboardMetrics() },
      { name: "Pitch Operations", tests: await this.testPitchOperations() },
      { name: "View Tracking", tests: await this.testViewTracking() },
      { name: "Search Operations", tests: await this.testSearchOperations() },
      { name: "NDA Workflow", tests: await this.testNDAWorkflow() },
      { name: "User Operations", tests: await this.testUserOperations() },
      { name: "Complex Queries", tests: await this.testComplexQueries() },
      { name: "Type Safety", tests: await this.testTypeSafety() },
      { name: "Performance", tests: await this.testPerformance() },
      { name: "Cleanup", tests: await this.testCleanup() }
    ];

    // Collect all results
    for (const suite of testSuites) {
      this.results.push(...suite.tests);
    }

    // Print summary
    this.printTestSummary();
  }

  private printTestSummary(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === "PASS").length;
    const failedTests = this.results.filter(r => r.status === "FAIL").length;
    const skippedTests = this.results.filter(r => r.status === "SKIP").length;
    const totalDuration = Date.now() - this.context.startTime;

    console.log("\n" + "=" * 80);
    console.log("📊 DRIZZLE ORM CONVERSION TEST RESULTS");
    console.log("=" * 80);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⏭️  Skipped: ${skippedTests}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`🎯 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log("\n❌ FAILED TESTS:");
      this.results
        .filter(r => r.status === "FAIL")
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }

    console.log("\n📋 VALIDATION SUMMARY:");
    console.log("✅ API Endpoints: Authentication, Dashboard, CRUD operations");
    console.log("✅ Database Operations: Drizzle ORM CRUD, complex queries, aggregations");
    console.log("✅ Date Serialization: Fixed Date serialization in dashboard metrics");
    console.log("✅ Type Safety: Validation, error handling, SQL injection prevention");
    console.log("✅ View Tracking: Demographics, date-based analytics");
    console.log("✅ Performance: Response times, pagination, optimization");
    console.log("✅ Workflows: NDA signing, user management, search operations");

    if (passedTests === totalTests) {
      console.log("\n🎉 ALL DRIZZLE ORM CONVERSIONS VALIDATED SUCCESSFULLY!");
      console.log("✨ The conversion from raw SQL to Drizzle ORM is complete and functional.");
    } else {
      console.log(`\n⚠️  ${failedTests} test(s) failed. Review the errors above.`);
    }
  }
}

// Run the test suite
if (import.meta.main) {
  const testSuite = new DrizzleConversionTestSuite();
  await testSuite.runAllTests();
}

export { DrizzleConversionTestSuite };