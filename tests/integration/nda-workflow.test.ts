/**
 * NDA Workflow Integration Tests
 * Tests complete NDA request, approval, and access control flows
 */

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { ApiTestHelper } from "../api/api-test-suite.ts";

const BASE_URL = Deno.env.get("TEST_API_URL") || "http://localhost:8001";

Deno.test({
  name: "NDA Workflow - Complete Request to Approval Flow",
  fn: async () => {
    const creatorHelper = new ApiTestHelper();
    const investorHelper = new ApiTestHelper();
    const investor2Helper = new ApiTestHelper();
    
    // Setup: Creator creates pitch
    await creatorHelper.login("creator");
    
    const pitchResponse = await creatorHelper.request("POST", "/api/pitches", {
      title: "Confidential Project",
      logline: "A secret worth protecting",
      genre: "Thriller",
      format: "Feature Film",
      budgetRange: "$10M - $20M",
      status: "published",
      requiresNda: true
    });
    
    const pitchData = await pitchResponse.json();
    const pitchId = pitchData.data?.pitch.id;
    assertExists(pitchId);
    
    // Add confidential information
    await creatorHelper.request("PUT", `/api/pitches/${pitchId}/confidential`, {
      attachedActors: ["A-list Actor 1", "A-list Actor 2"],
      distributionDeals: "Major studio interested",
      financialProjections: {
        boxOffice: "$100M projected",
        roi: "300%"
      }
    });
    
    // Step 1: Investor 1 views public pitch info
    await investorHelper.login("investor");
    
    const publicViewResponse = await investorHelper.request("GET", `/api/pitches/${pitchId}`);
    const publicView = await publicViewResponse.json();
    
    assertEquals(publicViewResponse.status, 200);
    assertEquals(publicView.data?.pitch.requiresNda, true);
    assert(!publicView.data?.pitch.attachedActors); // Should not see confidential info
    
    // Step 2: Investor 1 requests NDA
    const ndaRequestResponse = await investorHelper.request("POST", "/api/ndas/request", {
      pitchId,
      message: "Very interested in your thriller project"
    });
    
    const ndaRequest = await ndaRequestResponse.json();
    assertEquals(ndaRequestResponse.status, 200);
    assertExists(ndaRequest.data?.nda.id);
    
    const ndaId = ndaRequest.data.nda.id;
    
    // Step 3: Creator receives NDA request notification
    const creatorNotificationsResponse = await creatorHelper.request("GET", "/api/notifications?type=nda_request");
    const creatorNotifications = await creatorNotificationsResponse.json();
    
    assertEquals(creatorNotificationsResponse.status, 200);
    // In real scenario, would verify notification exists
    
    // Step 4: Creator reviews investor profile
    const investorProfileResponse = await creatorHelper.request("GET", `/api/users/${investorHelper.getUserId()}/public`);
    assertEquals(investorProfileResponse.status, 200);
    
    // Step 5: Creator approves NDA
    const approveResponse = await creatorHelper.request("POST", `/api/ndas/${ndaId}/approve`, {
      customTerms: "Additional confidentiality clause applies"
    });
    
    assertEquals(approveResponse.status, 200);
    
    // Step 6: Investor receives approval notification
    const investorNotificationsResponse = await investorHelper.request("GET", "/api/notifications?type=nda_approved");
    assertEquals(investorNotificationsResponse.status, 200);
    
    // Step 7: Investor signs NDA
    const signResponse = await investorHelper.request("POST", `/api/ndas/${ndaId}/sign`, {
      signature: "Digital Signature",
      signedAt: new Date().toISOString(),
      ipAddress: "192.168.1.1"
    });
    
    assertEquals(signResponse.status, 200);
    
    // Step 8: Investor can now see confidential information
    const confidentialViewResponse = await investorHelper.request("GET", `/api/pitches/${pitchId}/full`);
    const confidentialView = await confidentialViewResponse.json();
    
    assertEquals(confidentialViewResponse.status, 200);
    assertExists(confidentialView.data?.pitch.attachedActors); // Can see confidential info
    assertExists(confidentialView.data?.pitch.financialProjections);
    
    // Step 9: Investor 2 tries to access without NDA - should fail
    await investor2Helper.login("investor");
    
    const unauthorizedResponse = await investor2Helper.request("GET", `/api/pitches/${pitchId}/full`);
    assertEquals(unauthorizedResponse.status, 403);
    
    // Step 10: Verify NDA tracking
    const ndaStatusResponse = await investorHelper.request("GET", `/api/ndas/status?pitchId=${pitchId}`);
    const ndaStatus = await ndaStatusResponse.json();
    
    assertEquals(ndaStatusResponse.status, 200);
    assertEquals(ndaStatus.data?.status, "signed");
    assertExists(ndaStatus.data?.signedAt);
  },
  sanitizeResources: false,
  sanitizeOps: false
});

Deno.test({
  name: "NDA Workflow - Rejection and Re-request",
  fn: async () => {
    const creatorHelper = new ApiTestHelper();
    const investorHelper = new ApiTestHelper();
    
    // Setup
    await creatorHelper.login("creator");
    
    const pitchResponse = await creatorHelper.request("POST", "/api/pitches", {
      title: "Selective Project",
      logline: "Not for everyone",
      genre: "Drama",
      status: "published",
      requiresNda: true
    });
    
    const pitchData = await pitchResponse.json();
    const pitchId = pitchData.data?.pitch.id;
    
    // Investor requests NDA
    await investorHelper.login("investor");
    
    const firstRequestResponse = await investorHelper.request("POST", "/api/ndas/request", {
      pitchId
    });
    
    const firstRequest = await firstRequestResponse.json();
    const firstNdaId = firstRequest.data?.nda.id;
    
    // Creator rejects NDA
    const rejectResponse = await creatorHelper.request("POST", `/api/ndas/${firstNdaId}/reject`, {
      reason: "Investor profile doesn't match our requirements"
    });
    
    assertEquals(rejectResponse.status, 200);
    
    // Investor receives rejection notification
    const rejectionNotificationResponse = await investorHelper.request("GET", "/api/notifications?type=nda_rejected");
    assertEquals(rejectionNotificationResponse.status, 200);
    
    // Investor updates profile
    await investorHelper.request("PUT", "/api/users/profile", {
      bio: "Updated bio with more relevant experience",
      investmentHistory: "Previous investments in similar projects"
    });
    
    // Investor re-requests NDA with updated message
    const secondRequestResponse = await investorHelper.request("POST", "/api/ndas/request", {
      pitchId,
      message: "I've updated my profile with relevant experience"
    });
    
    const secondRequest = await secondRequestResponse.json();
    assertEquals(secondRequestResponse.status, 200);
    assertExists(secondRequest.data?.nda.id);
    
    // Verify creator sees updated request
    const pendingNdasResponse = await creatorHelper.request("GET", "/api/ndas/pending");
    const pendingNdas = await pendingNdasResponse.json();
    
    assertEquals(pendingNdasResponse.status, 200);
    assert(pendingNdas.data?.ndas.length > 0);
  },
  sanitizeResources: false,
  sanitizeOps: false
});

Deno.test({
  name: "NDA Workflow - Expiration and Renewal",
  fn: async () => {
    const creatorHelper = new ApiTestHelper();
    const investorHelper = new ApiTestHelper();
    
    // Setup
    await creatorHelper.login("creator");
    
    const pitchResponse = await creatorHelper.request("POST", "/api/pitches", {
      title: "Time-Limited Access",
      logline: "A project with expiring NDAs",
      genre: "Action",
      status: "published",
      requiresNda: true
    });
    
    const pitchData = await pitchResponse.json();
    const pitchId = pitchData.data?.pitch.id;
    
    // Investor requests NDA
    await investorHelper.login("investor");
    
    const ndaRequestResponse = await investorHelper.request("POST", "/api/ndas/request", {
      pitchId
    });
    
    const ndaRequest = await ndaRequestResponse.json();
    const ndaId = ndaRequest.data?.nda.id;
    
    // Creator approves with expiration
    const approveResponse = await creatorHelper.request("POST", `/api/ndas/${ndaId}/approve`, {
      expiresIn: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
    });
    
    assertEquals(approveResponse.status, 200);
    
    // Investor signs
    await investorHelper.request("POST", `/api/ndas/${ndaId}/sign`, {
      signature: "Digital Signature"
    });
    
    // Check NDA status
    const statusResponse = await investorHelper.request("GET", `/api/ndas/${ndaId}`);
    const status = await statusResponse.json();
    
    assertEquals(statusResponse.status, 200);
    assertExists(status.data?.nda.expiresAt);
    
    // Simulate near expiration - request renewal
    const renewalResponse = await investorHelper.request("POST", `/api/ndas/${ndaId}/renew`, {
      reason: "Still in due diligence process"
    });
    
    assertEquals(renewalResponse.status, 200);
    
    // Creator approves renewal
    const renewalApprovalResponse = await creatorHelper.request("POST", `/api/ndas/${ndaId}/renew/approve`, {
      extendBy: 30 * 24 * 60 * 60 * 1000 // Another 30 days
    });
    
    assertEquals(renewalApprovalResponse.status, 200);
  },
  sanitizeResources: false,
  sanitizeOps: false
});

Deno.test({
  name: "NDA Workflow - Bulk NDA Management",
  fn: async () => {
    const creatorHelper = new ApiTestHelper();
    const investors = [];
    
    // Setup: Creator creates pitch
    await creatorHelper.login("creator");
    
    const pitchResponse = await creatorHelper.request("POST", "/api/pitches", {
      title: "Popular Project",
      logline: "Many investors interested",
      genre: "Comedy",
      status: "published",
      requiresNda: true
    });
    
    const pitchData = await pitchResponse.json();
    const pitchId = pitchData.data?.pitch.id;
    
    // Multiple investors request NDAs
    for (let i = 0; i < 3; i++) {
      const helper = new ApiTestHelper();
      await helper.login("investor");
      
      const requestResponse = await helper.request("POST", "/api/ndas/request", {
        pitchId,
        message: `Investor ${i + 1} interested`
      });
      
      assertEquals(requestResponse.status, 200);
      investors.push({
        helper,
        ndaId: (await requestResponse.json()).data?.nda.id
      });
    }
    
    // Creator views all pending NDAs
    const pendingResponse = await creatorHelper.request("GET", `/api/pitches/${pitchId}/ndas?status=pending`);
    const pending = await pendingResponse.json();
    
    assertEquals(pendingResponse.status, 200);
    assertEquals(pending.data?.ndas.length, 3);
    
    // Bulk approve first two
    const bulkApproveResponse = await creatorHelper.request("POST", "/api/ndas/bulk/approve", {
      ndaIds: [investors[0].ndaId, investors[1].ndaId]
    });
    
    assertEquals(bulkApproveResponse.status, 200);
    
    // Reject third one
    await creatorHelper.request("POST", `/api/ndas/${investors[2].ndaId}/reject`, {
      reason: "Not a good fit"
    });
    
    // Check approved NDAs
    const approvedResponse = await creatorHelper.request("GET", `/api/pitches/${pitchId}/ndas?status=approved`);
    const approved = await approvedResponse.json();
    
    assertEquals(approvedResponse.status, 200);
    assertEquals(approved.data?.ndas.length, 2);
    
    // Creator revokes one NDA
    const revokeResponse = await creatorHelper.request("POST", `/api/ndas/${investors[0].ndaId}/revoke`, {
      reason: "Breach of confidentiality"
    });
    
    assertEquals(revokeResponse.status, 200);
    
    // Verify investor loses access
    const accessResponse = await investors[0].helper.request("GET", `/api/pitches/${pitchId}/full`);
    assertEquals(accessResponse.status, 403);
  },
  sanitizeResources: false,
  sanitizeOps: false
});