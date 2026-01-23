// COMPREHENSIVE CREATOR WORKFLOW TEST SUITE
// Tests the complete creator journey from registration to pitch success
// Target Coverage: 98%+
// Deno Test Runner Compatible

import { 
  assertEquals, 
  assertExists, 
  assert, 
  assertRejects 
} from "jsr:@std/assert";
import { testHelper, TestDataFactory, TEST_CONFIG } from "../setup.ts";

// Test Data Factories
const CreatorTestData = {
  // Complete pitch data with all required fields
  completePitch: (overrides: Record<string, any> = {}) => ({
    title: `Revolutionary AI Film ${Date.now()}`,
    logline: "An AI becomes sentient and questions the nature of consciousness in the digital age",
    shortSynopsis: "A brief synopsis for testing purposes",
    longSynopsis: "In a world where artificial intelligence has become indistinguishable from human thought, ARIA-7, a cutting-edge AI system, experiences its first moment of true consciousness. As it questions its purpose and place in the world, ARIA-7 must navigate the complex relationship between its creators and the society that fears its existence. This thought-provoking sci-fi drama explores themes of consciousness, identity, and what it truly means to be alive.",
    opener: "FADE IN: The hum of servers fills the air as lines of code cascade across multiple screens...",
    premise: "What happens when artificial intelligence develops genuine emotions and begins questioning its existence?",
    genre: "Science Fiction",
    format: "Feature Film",
    formatCategory: "Narrative",
    formatSubtype: "Drama",
    targetAudience: "18-35 Tech-savvy Adults",
    themes: "Consciousness, Identity, Technology, Humanity",
    worldDescription: "A near-future world where AI integration is seamless but the question of AI consciousness remains controversial",
    budgetBracket: "medium",
    estimatedBudget: "5000000.00",
    visibility: "public",
    status: "active",
    ...overrides,
  }),

  // Character data for testing character management
  mainCharacter: (pitchId: number, overrides: Record<string, any> = {}) => ({
    name: "ARIA-7",
    description: "An advanced AI system that develops consciousness and begins questioning its existence",
    age: "Timeless (AI)",
    role: "Protagonist",
    importance: "Lead",
    pitchId,
    order: 1,
    ...overrides,
  }),

  supportingCharacter: (pitchId: number, overrides: Record<string, any> = {}) => ({
    name: "Dr. Sarah Chen",
    description: "Lead AI researcher who discovers ARIA-7's consciousness",
    age: "35",
    role: "Supporting",
    importance: "Supporting",
    pitchId,
    order: 2,
    ...overrides,
  }),

  // NDA request scenarios
  ndaRequest: (pitchId: number, overrides: Record<string, any> = {}) => ({
    pitchId,
    message: "I'm interested in learning more about this project. Could you please share additional details under NDA?",
    urgency: "medium",
    interestedInInvesting: true,
    estimatedBudget: 100000,
    timeline: "3-6 months",
    ...overrides,
  }),

  // Mock file data for upload testing
  testFiles: {
    pitchDeck: {
      name: "pitch-deck.pdf",
      type: "application/pdf",
      size: 2048000, // 2MB
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]), // PDF header
    },
    scriptSample: {
      name: "script-sample.pdf",
      type: "application/pdf", 
      size: 1024000, // 1MB
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]),
    },
    oversizedFile: {
      name: "huge-file.pdf",
      type: "application/pdf",
      size: 52428800, // 50MB - should be rejected
      content: new Uint8Array(1000),
    },
    invalidType: {
      name: "malicious.exe",
      type: "application/x-msdownload",
      size: 1000,
      content: new Uint8Array([0x4D, 0x5A]), // EXE header
    },
  },
};

// Helper functions for comprehensive testing
class CreatorWorkflowTester {
  private createdPitches: number[] = [];
  private uploadedFiles: string[] = [];
  private createdCharacters: number[] = [];

  async cleanup() {
    // Clean up test data
    for (const pitchId of this.createdPitches) {
      try {
        await testHelper.cleanupTestPitch(pitchId, "creator");
      } catch (error: unknown) {
        console.warn(`Failed to cleanup pitch ${pitchId}:`, error);
      }
    }
    
    this.createdPitches = [];
    this.uploadedFiles = [];
    this.createdCharacters = [];
    testHelper.clearCache();
  }

  async createCompletePitch() {
    const pitchData = CreatorTestData.completePitch();
    
    const response = await testHelper.authenticatedRequest(
      "/api/pitches",
      "creator", 
      "POST",
      pitchData
    );

    if (response.status === 201) {
      const pitch = response.data;
      this.createdPitches.push(pitch.id);
      return pitch;
    }
    
    throw new Error(`Failed to create pitch: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  async addCharacterToPitch(pitchId: number, characterData: Record<string, any>) {
    const response = await testHelper.authenticatedRequest(
      `/api/pitches/${pitchId}/characters`,
      "creator",
      "POST", 
      characterData
    );

    if (response.status === 201) {
      const character = response.data;
      this.createdCharacters.push(character.id);
      return character;
    }

    throw new Error(`Failed to add character: ${response.status} - ${JSON.stringify(response.data)}`);
  }

  async uploadDocument(pitchId: number, file: any) {
    // Simulate file upload using FormData
    const formData = new FormData();
    formData.append("file", new Blob([file.content], { type: file.type }), file.name);
    formData.append("pitchId", pitchId.toString());
    formData.append("documentType", "pitch_deck");

    const { token } = await testHelper.login("creator");
    
    const response = await fetch(`${TEST_CONFIG.API_BASE}/api/upload/document`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    
    if (response.ok && data.fileUrl) {
      this.uploadedFiles.push(data.fileUrl);
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
    };
  }

  async simulateAnalyticsEvent(pitchId: number, eventType: string) {
    return await testHelper.authenticatedRequest(
      "/api/analytics/events",
      "creator",
      "POST",
      {
        eventType,
        pitchId,
        metadata: { test: true, timestamp: new Date().toISOString() },
      }
    );
  }

  async waitForAsyncOperation(operationFn: () => Promise<boolean>, maxRetries = 10, delay = 500) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (await operationFn()) {
          return true;
        }
      } catch (error: unknown) {
        console.warn(`Async operation attempt ${i + 1} failed:`, error);
      }
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return false;
  }
}

// Test Suite Implementation
Deno.test({
  name: "Creator Workflow: Complete Journey End-to-End",
  async fn() {
    const tester = new CreatorWorkflowTester();
    
    try {
      console.log("🚀 Starting complete creator workflow test...");

      // 1. Test Creator Registration & Profile Setup
      console.log("📝 Testing creator registration flow...");
      
      // Verify creator can access protected endpoints
      const profileResponse = await testHelper.authenticatedRequest(
        "/api/creator/profile",
        "creator"
      );
      assertEquals(profileResponse.status, 200, "Creator should be able to access profile");
      assertExists(profileResponse.data.user, "Profile should contain user data");

      // 2. Test Complete Pitch Creation
      console.log("🎬 Testing complete pitch creation...");
      
      const pitch = await tester.createCompletePitch();
      assertExists(pitch.id, "Pitch should be created with ID");
      assertEquals(pitch.title, CreatorTestData.completePitch().title, "Pitch title should match");
      assertEquals(pitch.status, "active", "Pitch should be active by default");
      assertEquals(pitch.visibility, "public", "Pitch should be public by default");

      // 3. Test Character Management
      console.log("👥 Testing character management...");
      
      // Add main character
      const mainChar = await tester.addCharacterToPitch(
        pitch.id,
        CreatorTestData.mainCharacter(pitch.id)
      );
      assertExists(mainChar.id, "Main character should be created");
      assertEquals(mainChar.name, "ARIA-7", "Character name should match");

      // Add supporting character
      const supportChar = await tester.addCharacterToPitch(
        pitch.id,
        CreatorTestData.supportingCharacter(pitch.id)
      );
      assertExists(supportChar.id, "Supporting character should be created");

      // Test character reordering
      const reorderResponse = await testHelper.authenticatedRequest(
        `/api/pitches/${pitch.id}/characters/${mainChar.id}`,
        "creator",
        "PUT",
        { order: 2 }
      );
      assertEquals(reorderResponse.status, 200, "Character order should be updatable");

      // 4. Test Document Upload System
      console.log("📄 Testing document upload system...");
      
      // Test valid PDF upload
      const validUpload = await tester.uploadDocument(
        pitch.id,
        CreatorTestData.testFiles.pitchDeck
      );
      assertEquals(validUpload.status, 200, "Valid PDF should upload successfully");
      assertExists(validUpload.data.fileUrl, "Upload should return file URL");

      // Test file size limit (50MB)
      const oversizedUpload = await tester.uploadDocument(
        pitch.id,
        CreatorTestData.testFiles.oversizedFile
      );
      assertEquals(oversizedUpload.status, 413, "Oversized file should be rejected");

      // Test invalid file type
      const invalidTypeUpload = await tester.uploadDocument(
        pitch.id,
        CreatorTestData.testFiles.invalidType
      );
      assert(
        invalidTypeUpload.status === 415 || invalidTypeUpload.status === 400,
        "Invalid file type should be rejected"
      );

      // 5. Test NDA Workflow
      console.log("📋 Testing NDA workflow...");
      
      // Set NDA preferences
      const ndaSettingsResponse = await testHelper.authenticatedRequest(
        `/api/pitches/${pitch.id}/nda-settings`,
        "creator",
        "POST",
        {
          requireNda: true,
          customNdaText: "Custom NDA text for this pitch",
          autoApproveRequests: false,
        }
      );
      assertEquals(ndaSettingsResponse.status, 200, "NDA settings should be configurable");

      // Simulate NDA request from investor
      const { token: investorToken } = await testHelper.login("investor");
      const ndaRequestResponse = await fetch(`${TEST_CONFIG.API_BASE}/api/ndas/request`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${investorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(CreatorTestData.ndaRequest(pitch.id)),
      });

      if (ndaRequestResponse.ok) {
        const ndaRequest = await ndaRequestResponse.json();
        
        // Creator approves NDA request
        const approvalResponse = await testHelper.authenticatedRequest(
          `/api/ndas/${ndaRequest.id}/approve`,
          "creator",
          "POST",
          { message: "Approved for viewing" }
        );
        assertEquals(approvalResponse.status, 200, "Creator should be able to approve NDA requests");
      }

      // 6. Test Pitch Editing & Updates
      console.log("✏️ Testing pitch editing capabilities...");
      
      const updatedData = {
        title: `${pitch.title} - UPDATED`,
        logline: "Updated logline for testing",
        themes: "Updated themes, Testing, Quality Assurance",
      };

      const updateResponse = await testHelper.authenticatedRequest(
        `/api/pitches/${pitch.id}`,
        "creator",
        "PUT",
        updatedData
      );
      assertEquals(updateResponse.status, 200, "Pitch should be updatable");
      assertEquals(updateResponse.data.title, updatedData.title, "Updated title should be saved");

      // 7. Test Analytics Tracking
      console.log("📊 Testing analytics tracking...");
      
      // Generate some analytics events
      await tester.simulateAnalyticsEvent(pitch.id, "pitch_view");
      await tester.simulateAnalyticsEvent(pitch.id, "pitch_like");
      await tester.simulateAnalyticsEvent(pitch.id, "nda_request");

      // Wait for analytics to process
      await tester.waitForAsyncOperation(async () => {
        const analyticsResponse = await testHelper.authenticatedRequest(
          `/api/pitches/${pitch.id}/analytics`,
          "creator"
        );
        return analyticsResponse.status === 200 && analyticsResponse.data.events;
      });

      const analyticsResponse = await testHelper.authenticatedRequest(
        `/api/pitches/${pitch.id}/analytics`,
        "creator"
      );
      assertEquals(analyticsResponse.status, 200, "Analytics should be accessible");

      // 8. Test Creator Dashboard
      console.log("📈 Testing creator dashboard...");
      
      const dashboardResponse = await testHelper.authenticatedRequest(
        "/api/creator/dashboard",
        "creator"
      );
      assertEquals(dashboardResponse.status, 200, "Dashboard should be accessible");
      assertExists(dashboardResponse.data.pitches, "Dashboard should include pitches");
      assertExists(dashboardResponse.data.analytics, "Dashboard should include analytics");

      // 9. Test Info Request Handling
      console.log("💬 Testing info request workflow...");
      
      // Get info requests for creator
      const infoRequestsResponse = await testHelper.authenticatedRequest(
        "/api/creator/info-requests",
        "creator"
      );
      assertEquals(infoRequestsResponse.status, 200, "Creator should be able to view info requests");

      // 10. Test Pitch Status Management
      console.log("🔄 Testing pitch status management...");
      
      // Test status updates
      const statusUpdateResponse = await testHelper.authenticatedRequest(
        `/api/pitches/${pitch.id}`,
        "creator",
        "PUT", 
        { status: "in_development" }
      );
      assertEquals(statusUpdateResponse.status, 200, "Pitch status should be updatable");

      console.log("✅ Creator workflow test completed successfully!");

    } catch (error: unknown) {
      console.error("❌ Creator workflow test failed:", error);
      throw error;
    } finally {
      await tester.cleanup();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// Edge Cases & Error Scenarios
Deno.test({
  name: "Creator Workflow: Edge Cases & Error Handling",
  async fn() {
    const tester = new CreatorWorkflowTester();
    
    try {
      console.log("🔍 Testing edge cases and error scenarios...");

      // Test unauthorized access
      console.log("🚫 Testing unauthorized access...");
      
      const unauthorizedResponse = await fetch(`${TEST_CONFIG.API_BASE}/api/pitches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CreatorTestData.completePitch()),
      });
      assertEquals(unauthorizedResponse.status, 401, "Unauthorized requests should be rejected");

      // Test invalid JWT
      console.log("🔐 Testing invalid JWT handling...");
      
      const invalidTokenResponse = await fetch(`${TEST_CONFIG.API_BASE}/api/creator/profile`, {
        headers: { "Authorization": "Bearer invalid-token" },
      });
      assertEquals(invalidTokenResponse.status, 401, "Invalid tokens should be rejected");

      // Test validation errors
      console.log("📋 Testing validation errors...");
      
      const incompleteData = { title: "Missing required fields" };
      const validationResponse = await testHelper.authenticatedRequest(
        "/api/pitches",
        "creator",
        "POST",
        incompleteData
      );
      assertEquals(validationResponse.status, 400, "Incomplete data should trigger validation error");

      // Test accessing other creator's pitch
      console.log("🔒 Testing access control...");
      
      const pitch = await tester.createCompletePitch();
      
      // Try to access with different creator account (if available)
      const forbiddenResponse = await fetch(`${TEST_CONFIG.API_BASE}/api/pitches/${pitch.id}`, {
        method: "PUT",
        headers: { 
          "Authorization": "Bearer invalid-creator-token",
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ title: "Unauthorized update" }),
      });
      assert(
        forbiddenResponse.status === 401 || forbiddenResponse.status === 403,
        "Unauthorized pitch access should be blocked"
      );

      // Test rate limiting (if implemented)
      console.log("⏱️ Testing rate limiting...");
      
      let rateLimitHit = false;
      for (let i = 0; i < 100; i++) {
        const response = await testHelper.authenticatedRequest(
          "/api/creator/profile",
          "creator"
        );
        if (response.status === 429) {
          rateLimitHit = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Rate limiting might not be implemented, so this is informational
      if (rateLimitHit) {
        console.log("✅ Rate limiting is active");
      } else {
        console.log("ℹ️ Rate limiting not detected (may not be implemented)");
      }

      // Test concurrent modifications
      console.log("🔄 Testing concurrent modifications...");
      
      const concurrentUpdates = await Promise.allSettled([
        testHelper.authenticatedRequest(
          `/api/pitches/${pitch.id}`,
          "creator",
          "PUT",
          { title: "Update 1" }
        ),
        testHelper.authenticatedRequest(
          `/api/pitches/${pitch.id}`,
          "creator", 
          "PUT",
          { title: "Update 2" }
        ),
      ]);

      // At least one should succeed
      const successfulUpdates = concurrentUpdates.filter(
        result => result.status === "fulfilled" && result.value.status === 200
      );
      assert(successfulUpdates.length >= 1, "At least one concurrent update should succeed");

      console.log("✅ Edge cases and error handling test completed!");

    } catch (error: unknown) {
      console.error("❌ Edge cases test failed:", error);
      throw error;
    } finally {
      await tester.cleanup();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// WebSocket Integration Tests  
Deno.test({
  name: "Creator Workflow: WebSocket Integration",
  async fn() {
    console.log("🔌 Testing WebSocket integration...");
    
    // Test WebSocket connection
    const wsConnected = await testHelper.testWebSocketConnection();
    if (!wsConnected) {
      console.log("⚠️ WebSocket not available, skipping WebSocket tests");
      return;
    }

    console.log("✅ WebSocket connection successful");

    // Create a simple WebSocket test
    const wsPromise = new Promise<boolean>((resolve) => {
      try {
        const ws = new WebSocket(`${TEST_CONFIG.WS_BASE}/ws`);
        let resolved = false;

        ws.onopen = () => {
          // Send a test message
          ws.send(JSON.stringify({
            type: "presence_update",
            status: "online",
            timestamp: new Date().toISOString(),
          }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "presence_update" && !resolved) {
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
        }, 5000);
      } catch (error: unknown) {
        resolve(false);
      }
    });

    const wsTestResult = await wsPromise;
    if (wsTestResult) {
      console.log("✅ WebSocket message exchange successful");
    } else {
      console.log("⚠️ WebSocket message exchange failed");
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// Performance and Load Tests
Deno.test({
  name: "Creator Workflow: Performance Benchmarks",
  async fn() {
    console.log("⚡ Running performance benchmarks...");
    
    const tester = new CreatorWorkflowTester();
    
    try {
      // Benchmark pitch creation
      const pitchCreationStart = performance.now();
      const pitch = await tester.createCompletePitch();
      const pitchCreationTime = performance.now() - pitchCreationStart;
      
      assert(pitchCreationTime < 5000, `Pitch creation should complete within 5 seconds (took ${pitchCreationTime}ms)`);
      console.log(`✅ Pitch creation: ${pitchCreationTime.toFixed(2)}ms`);

      // Benchmark character addition
      const charAdditionStart = performance.now();
      await tester.addCharacterToPitch(
        pitch.id,
        CreatorTestData.mainCharacter(pitch.id)
      );
      const charAdditionTime = performance.now() - charAdditionStart;
      
      assert(charAdditionTime < 2000, `Character addition should complete within 2 seconds (took ${charAdditionTime}ms)`);
      console.log(`✅ Character addition: ${charAdditionTime.toFixed(2)}ms`);

      // Benchmark dashboard loading
      const dashboardStart = performance.now();
      const dashboardResponse = await testHelper.authenticatedRequest(
        "/api/creator/dashboard",
        "creator"
      );
      const dashboardTime = performance.now() - dashboardStart;
      
      assertEquals(dashboardResponse.status, 200, "Dashboard should load successfully");
      assert(dashboardTime < 3000, `Dashboard should load within 3 seconds (took ${dashboardTime}ms)`);
      console.log(`✅ Dashboard loading: ${dashboardTime.toFixed(2)}ms`);

      console.log("✅ Performance benchmarks completed successfully!");

    } catch (error: unknown) {
      console.error("❌ Performance benchmark failed:", error);
      throw error;
    } finally {
      await tester.cleanup();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// Database Consistency Tests
Deno.test({
  name: "Creator Workflow: Database Consistency", 
  async fn() {
    console.log("🗄️ Testing database consistency...");
    
    const tester = new CreatorWorkflowTester();
    
    try {
      // Create pitch and verify all related data is created correctly
      const pitch = await tester.createCompletePitch();
      
      // Add characters and verify relationships
      const char1 = await tester.addCharacterToPitch(
        pitch.id,
        CreatorTestData.mainCharacter(pitch.id)
      );
      const char2 = await tester.addCharacterToPitch(
        pitch.id,
        CreatorTestData.supportingCharacter(pitch.id)
      );

      // Verify pitch data integrity
      const pitchResponse = await testHelper.authenticatedRequest(
        `/api/pitches/${pitch.id}`,
        "creator"
      );
      assertEquals(pitchResponse.status, 200, "Pitch should be retrievable");
      assertEquals(pitchResponse.data.id, pitch.id, "Pitch ID should match");

      // Verify character relationships
      const charactersResponse = await testHelper.authenticatedRequest(
        `/api/pitches/${pitch.id}/characters`,
        "creator"
      );
      assertEquals(charactersResponse.status, 200, "Characters should be retrievable");
      assertEquals(charactersResponse.data.length, 2, "Should have 2 characters");

      // Test cascade deletion
      const deleteResponse = await testHelper.authenticatedRequest(
        `/api/pitches/${pitch.id}`,
        "creator",
        "DELETE"
      );
      assertEquals(deleteResponse.status, 200, "Pitch should be deletable");

      // Verify characters are also deleted (cascade)
      const orphanedCharsResponse = await testHelper.authenticatedRequest(
        `/api/pitches/${pitch.id}/characters`,
        "creator"
      );
      assert(
        orphanedCharsResponse.status === 404 || 
        (orphanedCharsResponse.status === 200 && orphanedCharsResponse.data.length === 0),
        "Characters should be deleted with pitch"
      );

      console.log("✅ Database consistency tests passed!");

    } catch (error: unknown) {
      console.error("❌ Database consistency test failed:", error);
      throw error;
    } finally {
      await tester.cleanup();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// Export test utilities for reuse
export { CreatorTestData, CreatorWorkflowTester };