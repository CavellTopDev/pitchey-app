#!/usr/bin/env -S deno run --allow-all

/**
 * Test WebSocket Event Tracking
 * Validates that WebSocket events can be properly inserted into analytics_events
 */

import { db } from "./src/db/client.ts";
import { analyticsEvents } from "./src/db/schema.ts";

async function testWebSocketEvents() {
  console.log("🧪 Testing WebSocket event tracking...");
  
  const testSessionId = `test-ws-${Date.now()}`;
  
  try {
    // Test legacy WebSocket events that were failing before
    const legacyEvents = [
      { eventType: "websocket_connected", description: "WebSocket connection established" },
      { eventType: "websocket_message", description: "WebSocket message sent" },
      { eventType: "websocket_disconnected", description: "WebSocket connection closed" },
      { eventType: "websocket_message_processed", description: "WebSocket message processed" }
    ];

    console.log("\n📡 Testing legacy WebSocket events...");
    for (const event of legacyEvents) {
      const result = await db.insert(analyticsEvents).values({
        eventType: event.eventType as any,
        category: "websocket",
        sessionId: testSessionId,
        eventData: { test: true, description: event.description }
      }).returning({ id: analyticsEvents.id });
      
      console.log(`✅ Successfully inserted: ${event.eventType} (ID: ${result[0].id})`);
    }

    // Test new ws_ prefixed events
    const wsAnalyticsEvents = [
      { eventType: "ws_connection_established", description: "WebSocket Analytics - Connection established" },
      { eventType: "ws_message_sent", description: "WebSocket Analytics - Message sent" },
      { eventType: "ws_presence_changed", description: "WebSocket Analytics - Presence changed" },
      { eventType: "ws_error_occurred", description: "WebSocket Analytics - Error occurred" }
    ];

    console.log("\n🔄 Testing WebSocket Analytics events...");
    for (const event of wsAnalyticsEvents) {
      const result = await db.insert(analyticsEvents).values({
        eventType: event.eventType as any,
        category: "websocket_analytics",
        sessionId: testSessionId,
        eventData: { test: true, description: event.description }
      }).returning({ id: analyticsEvents.id });
      
      console.log(`✅ Successfully inserted: ${event.eventType} (ID: ${result[0].id})`);
    }

    // Test other authentication events
    const authEvents = [
      { eventType: "login", description: "User login event" },
      { eventType: "logout", description: "User logout event" },
      { eventType: "registration", description: "User registration event" }
    ];

    console.log("\n🔐 Testing authentication events...");
    for (const event of authEvents) {
      const result = await db.insert(analyticsEvents).values({
        eventType: event.eventType as any,
        category: "authentication",
        sessionId: testSessionId,
        eventData: { test: true, description: event.description }
      }).returning({ id: analyticsEvents.id });
      
      console.log(`✅ Successfully inserted: ${event.eventType} (ID: ${result[0].id})`);
    }

    // Verify all events were inserted
    console.log("\n📊 Verifying inserted events...");
    const insertedEvents = await db
      .select({
        id: analyticsEvents.id,
        eventType: analyticsEvents.eventType,
        category: analyticsEvents.category,
        timestamp: analyticsEvents.timestamp
      })
      .from(analyticsEvents)
      .where(analyticsEvents.sessionId.eq(testSessionId));

    console.log(`\n✅ Total events inserted: ${insertedEvents.length}`);
    insertedEvents.forEach(event => {
      console.log(`   - ${event.eventType} (${event.category}) - ID: ${event.id}`);
    });

    // Clean up test data
    const deleted = await db
      .delete(analyticsEvents)
      .where(analyticsEvents.sessionId.eq(testSessionId))
      .returning({ id: analyticsEvents.id });

    console.log(`\n🧹 Cleaned up ${deleted.length} test events`);
    console.log("\n🎉 All WebSocket event tracking tests passed!");
    
  } catch (error) {
    console.error("\n❌ WebSocket event tracking test failed:");
    console.error(error);
    throw error;
  }
}

if (import.meta.main) {
  await testWebSocketEvents();
}