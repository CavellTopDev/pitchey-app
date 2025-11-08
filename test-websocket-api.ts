#!/usr/bin/env -S deno run --allow-all

/**
 * Test WebSocket Event Tracking via API
 * Simulates WebSocket events to verify the enum fix
 */

import { AnalyticsService } from "./src/services/analytics.service.ts";
import { db } from "./src/db/client.ts";
import { analyticsEvents } from "./src/db/schema.ts";
import { eq } from "npm:drizzle-orm@0.35.3";

async function testWebSocketEventsViaAPI() {
  console.log("🧪 Testing WebSocket event tracking via Analytics Service...");
  
  const analyticsService = new AnalyticsService();
  const testSessionId = `api-test-ws-${Date.now()}`;
  
  try {
    // Test the events that were failing before
    const testEvents = [
      {
        eventType: "websocket_connected",
        category: "websocket",
        sessionId: testSessionId,
        eventData: { test: true, source: "api_test" }
      },
      {
        eventType: "websocket_message",
        category: "websocket", 
        sessionId: testSessionId,
        eventData: { messageType: "test", test: true }
      },
      {
        eventType: "websocket_disconnected",
        category: "websocket",
        sessionId: testSessionId,
        eventData: { reason: "test_complete", test: true }
      },
      {
        eventType: "ws_connection_established",
        category: "websocket_analytics",
        sessionId: testSessionId,
        eventData: { userAgent: "test", test: true }
      }
    ];

    console.log("\n📡 Testing WebSocket events via Analytics Service...");
    for (const event of testEvents) {
      try {
        await analyticsService.trackEvent(event as any);
        console.log(`✅ Successfully tracked: ${event.eventType}`);
      } catch (error) {
        console.error(`❌ Failed to track ${event.eventType}:`, error.message);
      }
    }

    // Check if events were inserted
    console.log("\n📊 Verifying events in database...");
    const query = db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.sessionId, testSessionId));
    
    const insertedEvents = await query;
    console.log(`Found ${insertedEvents.length} events in database:`);
    
    insertedEvents.forEach(event => {
      console.log(`   - ${event.eventType} (${event.category}) at ${event.timestamp}`);
    });

    // Clean up
    await db
      .delete(analyticsEvents)
      .where(eq(analyticsEvents.sessionId, testSessionId));
    
    console.log(`\n🧹 Cleaned up test events`);
    console.log("\n🎉 WebSocket event tracking API test completed!");
    
  } catch (error) {
    console.error("\n❌ API test failed:");
    console.error(error);
    
    // Still try to clean up
    try {
      await db
        .delete(analyticsEvents)
        .where(eq(analyticsEvents.sessionId, testSessionId));
    } catch (cleanupError) {
      console.error("Failed to clean up:", cleanupError);
    }
    
    throw error;
  }
}

if (import.meta.main) {
  await testWebSocketEventsViaAPI();
}