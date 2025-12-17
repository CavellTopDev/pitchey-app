/**
 * Pitch Lifecycle Integration Tests
 * Tests complete pitch creation, management, and collaboration workflows
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { ApiTestHelper } from "../api/api-test-suite.ts";

const BASE_URL = Deno.env.get("TEST_API_URL") || "http://localhost:8001";

Deno.test({
  name: "Pitch Lifecycle - Complete Creation to Investment Flow",
  fn: async () => {
    const creatorHelper = new ApiTestHelper();
    const investorHelper = new ApiTestHelper();
    
    // Step 1: Creator logs in and creates pitch
    await creatorHelper.login("creator");
    
    const pitchData = {
      title: "The Next Big Thing",
      logline: "A revolutionary story about innovation",
      genre: "Drama",
      format: "Feature Film",
      budgetRange: "$5M - $10M",
      targetAudience: "25-45",
      synopsis: "A detailed synopsis of our groundbreaking film...",
      themes: ["Innovation", "Technology", "Human Connection"],
      comparableTitles: ["The Social Network", "Steve Jobs"],
      uniqueSellingPoints: [
        "First film to explore AI consciousness",
        "Award-winning director attached"
      ]
    };
    
    const createResponse = await creatorHelper.request("POST", "/api/pitches", pitchData);
    const createResult = await createResponse.json();
    
    assertEquals(createResponse.status, 200);
    assertExists(createResult.data?.pitch.id);
    
    const pitchId = createResult.data.pitch.id;
    
    // Step 2: Add characters
    const characterResponse = await creatorHelper.request("POST", `/api/pitches/${pitchId}/characters`, {
      name: "Alex Thompson",
      role: "Protagonist",
      description: "A brilliant AI researcher",
      ageRange: "30-35",
      gender: "Non-binary",
      arc: "From isolated genius to connected human"
    });
    
    assertEquals(characterResponse.status, 200);
    
    // Step 3: Upload pitch deck
    const formData = new FormData();
    formData.append("file", new File(["pitch deck content"], "pitch-deck.pdf", { 
      type: "application/pdf" 
    }));
    formData.append("pitchId", pitchId);
    formData.append("type", "pitch-deck");
    
    const uploadResponse = await fetch(`${BASE_URL}/api/upload/document`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${creatorHelper.getToken()}`
      },
      body: formData
    });
    
    assertEquals(uploadResponse.status, 200);
    
    // Step 4: Publish the pitch
    const publishResponse = await creatorHelper.request("PUT", `/api/pitches/${pitchId}`, {
      status: "published"
    });
    
    assertEquals(publishResponse.status, 200);
    
    // Step 5: Investor logs in and discovers pitch
    await investorHelper.login("investor");
    
    const browseResponse = await investorHelper.request("GET", "/api/browse?genre=Drama");
    const browseResult = await browseResponse.json();
    
    assertEquals(browseResponse.status, 200);
    assert(browseResult.data?.pitches.length > 0);
    
    // Step 6: Investor views pitch details
    const viewResponse = await investorHelper.request("GET", `/api/pitches/${pitchId}`);
    const viewResult = await viewResponse.json();
    
    assertEquals(viewResponse.status, 200);
    assertEquals(viewResult.data?.pitch.id, pitchId);
    
    // Step 7: Investor requests NDA
    const ndaResponse = await investorHelper.request("POST", "/api/ndas/request", {
      pitchId
    });
    
    const ndaResult = await ndaResponse.json();
    assertEquals(ndaResponse.status, 200);
    assertExists(ndaResult.data?.nda.id);
    
    const ndaId = ndaResult.data.nda.id;
    
    // Step 8: Creator approves NDA
    const approveResponse = await creatorHelper.request("POST", `/api/ndas/${ndaId}/approve`);
    assertEquals(approveResponse.status, 200);
    
    // Step 9: Investor can now see full pitch details
    const fullViewResponse = await investorHelper.request("GET", `/api/pitches/${pitchId}/full`);
    assertEquals(fullViewResponse.status, 200);
    
    // Step 10: Investor saves pitch
    const saveResponse = await investorHelper.request("POST", `/api/pitches/${pitchId}/save`);
    assertEquals(saveResponse.status, 200);
    
    // Step 11: Investor makes investment offer
    const investmentResponse = await investorHelper.request("POST", "/api/investments", {
      pitchId,
      amount: 1000000,
      investmentType: "equity",
      terms: {
        equityPercentage: 15,
        milestones: ["Pre-production", "Principal Photography", "Post-production"]
      }
    });
    
    const investmentResult = await investmentResponse.json();
    assertEquals(investmentResponse.status, 200);
    assertExists(investmentResult.data?.investment.id);
    
    // Step 12: Creator receives notification (would be via WebSocket)
    const notificationsResponse = await creatorHelper.request("GET", "/api/notifications");
    const notifications = await notificationsResponse.json();
    
    assertEquals(notificationsResponse.status, 200);
    // Would check for investment notification in real scenario
    
    // Step 13: Verify pitch metrics updated
    const metricsResponse = await creatorHelper.request("GET", `/api/pitches/${pitchId}/analytics`);
    const metrics = await metricsResponse.json();
    
    assertEquals(metricsResponse.status, 200);
    assert(metrics.data?.viewCount > 0);
    assert(metrics.data?.ndaCount > 0);
  },
  sanitizeResources: false,
  sanitizeOps: false
});

Deno.test({
  name: "Pitch Lifecycle - Draft Auto-Save and Recovery",
  fn: async () => {
    const helper = new ApiTestHelper();
    await helper.login("creator");
    
    // Create draft
    const draftResponse = await helper.request("POST", "/api/pitches/draft", {
      title: "Work in Progress",
      logline: "An incomplete masterpiece"
    });
    
    const draftData = await draftResponse.json();
    assertEquals(draftResponse.status, 200);
    assertExists(draftData.data?.pitch.id);
    
    const draftId = draftData.data.pitch.id;
    
    // Simulate auto-save updates
    for (let i = 1; i <= 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const updateResponse = await helper.request("PUT", `/api/pitches/${draftId}/draft`, {
        synopsis: `Draft version ${i}`,
        lastEditedAt: new Date().toISOString()
      });
      
      assertEquals(updateResponse.status, 200);
    }
    
    // Retrieve draft
    const retrieveResponse = await helper.request("GET", `/api/pitches/${draftId}`);
    const retrieveData = await retrieveResponse.json();
    
    assertEquals(retrieveResponse.status, 200);
    assertEquals(retrieveData.data?.pitch.synopsis, "Draft version 3");
    assertEquals(retrieveData.data?.pitch.status, "draft");
    
    // List all drafts
    const draftsResponse = await helper.request("GET", "/api/pitches?status=draft");
    const draftsData = await draftsResponse.json();
    
    assertEquals(draftsResponse.status, 200);
    assert(draftsData.data?.length > 0);
  },
  sanitizeResources: false,
  sanitizeOps: false
});

Deno.test({
  name: "Pitch Lifecycle - Collaboration and Comments",
  fn: async () => {
    const creatorHelper = new ApiTestHelper();
    const investorHelper = new ApiTestHelper();
    
    // Creator creates and publishes pitch
    await creatorHelper.login("creator");
    
    const pitchResponse = await creatorHelper.request("POST", "/api/pitches", {
      title: "Collaborative Project",
      logline: "A film about teamwork",
      genre: "Comedy",
      format: "Series",
      status: "published"
    });
    
    const pitchData = await pitchResponse.json();
    const pitchId = pitchData.data?.pitch.id;
    
    // Investor requests and gets approved for NDA
    await investorHelper.login("investor");
    
    const ndaResponse = await investorHelper.request("POST", "/api/ndas/request", {
      pitchId
    });
    const ndaData = await ndaResponse.json();
    
    // Auto-approve for testing
    await creatorHelper.request("POST", `/api/ndas/${ndaData.data?.nda.id}/approve`);
    
    // Investor posts comment
    const commentResponse = await investorHelper.request("POST", `/api/pitches/${pitchId}/comments`, {
      content: "Very interested in this project!",
      isPrivate: true
    });
    
    assertEquals(commentResponse.status, 200);
    
    // Creator replies
    const replyResponse = await creatorHelper.request("POST", `/api/pitches/${pitchId}/comments`, {
      content: "Thank you for your interest! Let's discuss further.",
      parentId: (await commentResponse.json()).data?.comment.id
    });
    
    assertEquals(replyResponse.status, 200);
    
    // Get comment thread
    const threadsResponse = await investorHelper.request("GET", `/api/pitches/${pitchId}/comments`);
    const threadsData = await threadsResponse.json();
    
    assertEquals(threadsResponse.status, 200);
    assert(threadsData.data?.comments.length >= 2);
  },
  sanitizeResources: false,
  sanitizeOps: false
});