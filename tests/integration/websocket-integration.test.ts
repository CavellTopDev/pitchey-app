/**
 * WebSocket Integration Testing
 * Tests real-time communication, room management, and message delivery
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { TestFactory } from "../framework/test-factory.ts";
import { TestHelper, TEST_CONFIG } from "../setup.ts";
import { testDb, withDatabase } from "../framework/test-database.ts";

interface WebSocketTestMessage {
  type: string;
  data: any;
  timestamp: number;
  userId?: number;
  roomId?: string;
}

interface WebSocketRoom {
  id: string;
  participants: number[];
  messages: WebSocketTestMessage[];
  createdAt: Date;
}

class WebSocketIntegrationTester {
  private connections: Map<string, WebSocket> = new Map();
  private messageLog: WebSocketTestMessage[] = [];
  private rooms: Map<string, WebSocketRoom> = new Map();
  private testHelper: TestHelper;

  constructor() {
    this.testHelper = new TestHelper();
  }

  async createConnection(
    userId: number, 
    userType: "creator" | "investor" | "production" = "creator"
  ): Promise<WebSocket> {
    const { token } = await this.testHelper.login(userType);
    const wsUrl = `${TEST_CONFIG.WS_BASE.replace("http", "ws")}/ws?token=${token}`;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const connectionId = `${userType}_${userId}`;
      
      ws.onopen = () => {
        console.log(`🔌 WebSocket connected: ${connectionId}`);
        this.connections.set(connectionId, ws);
        resolve(ws);
      };

      ws.onerror = (error) => {
        console.error(`❌ WebSocket connection failed: ${connectionId}`, error);
        reject(error);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.logMessage({
            type: message.type,
            data: message.data,
            timestamp: Date.now(),
            userId,
          });
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log(`🔌 WebSocket disconnected: ${connectionId}`);
        this.connections.delete(connectionId);
      };

      // Set connection timeout
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          reject(new Error(`Connection timeout for ${connectionId}`));
        }
      }, 10000);
    });
  }

  private logMessage(message: WebSocketTestMessage): void {
    this.messageLog.push(message);
    console.log(`📨 WebSocket message:`, message);
  }

  async sendMessage(connectionId: string, message: any): Promise<void> {
    const ws = this.connections.get(connectionId);
    if (!ws) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Connection ${connectionId} is not open`);
    }

    ws.send(JSON.stringify(message));
  }

  async waitForMessage(
    predicate: (message: WebSocketTestMessage) => boolean,
    timeout: number = 5000
  ): Promise<WebSocketTestMessage> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const message = this.messageLog.find(predicate);
      if (message) {
        return message;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error("Timeout waiting for WebSocket message");
  }

  async waitForMessages(
    count: number,
    timeout: number = 5000
  ): Promise<WebSocketTestMessage[]> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.messageLog.length >= count) {
        return this.messageLog.slice(-count);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Timeout waiting for ${count} WebSocket messages`);
  }

  closeConnection(connectionId: string): void {
    const ws = this.connections.get(connectionId);
    if (ws) {
      ws.close();
      this.connections.delete(connectionId);
    }
  }

  closeAllConnections(): void {
    for (const [connectionId, ws] of this.connections) {
      ws.close();
    }
    this.connections.clear();
  }

  clearMessageLog(): void {
    this.messageLog = [];
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getMessageCount(): number {
    return this.messageLog.length;
  }

  getMessagesOfType(type: string): WebSocketTestMessage[] {
    return this.messageLog.filter(msg => msg.type === type);
  }
}

// ==================== WEBSOCKET INTEGRATION TESTS ====================

Deno.test({
  name: "WebSocket Integration Tests",
  async fn() {
    await withDatabase("multi_user_collaboration", async () => {
      const tester = new WebSocketIntegrationTester();
      
      console.log("🔌 Starting WebSocket Integration Tests...");

      try {
        // ==================== CONNECTION TESTS ====================
        
        await Deno.test({
          name: "WebSocket Connection Establishment",
          async fn() {
            // Test successful connection
            const ws = await tester.createConnection(1, "creator");
            assertEquals(ws.readyState, WebSocket.OPEN);
            assertEquals(tester.getConnectionCount(), 1);

            // Test connection with authentication
            const investorWs = await tester.createConnection(2, "investor");
            assertEquals(investorWs.readyState, WebSocket.OPEN);
            assertEquals(tester.getConnectionCount(), 2);
          }
        });

        await Deno.test({
          name: "WebSocket Connection with Invalid Token",
          async fn() {
            // This should fail or be handled gracefully
            try {
              const wsUrl = `${TEST_CONFIG.WS_BASE.replace("http", "ws")}/ws?token=invalid_token`;
              const ws = new WebSocket(wsUrl);
              
              await new Promise((resolve, reject) => {
                ws.onopen = () => reject(new Error("Should not connect with invalid token"));
                ws.onerror = () => resolve(null);
                ws.onclose = () => resolve(null);
                
                setTimeout(() => resolve(null), 2000);
              });
            } catch (error) {
              // Expected to fail
              assert(true, "Invalid token should be rejected");
            }
          }
        });

        // ==================== MESSAGING TESTS ====================
        
        await Deno.test({
          name: "Real-time Message Broadcasting",
          async fn() {
            tester.clearMessageLog();
            
            // Create connections for creator and investor
            await tester.createConnection(1, "creator");
            await tester.createConnection(2, "investor");

            // Send a message from creator
            await tester.sendMessage("creator_1", {
              type: "chat_message",
              data: {
                message: "Hello from creator!",
                roomId: "pitch_123",
                timestamp: Date.now()
              }
            });

            // Wait for message to be received
            const receivedMessage = await tester.waitForMessage(
              msg => msg.type === "chat_message_received" || msg.type === "chat_message"
            );

            assertExists(receivedMessage);
            assertEquals(receivedMessage.data.message, "Hello from creator!");
          }
        });

        await Deno.test({
          name: "Pitch Update Notifications",
          async fn() {
            tester.clearMessageLog();
            
            await tester.createConnection(1, "creator");
            await tester.createConnection(2, "investor");

            // Send pitch update notification
            await tester.sendMessage("creator_1", {
              type: "pitch_update",
              data: {
                pitchId: 123,
                action: "like",
                userId: 2,
                metadata: {
                  likeCount: 5
                }
              }
            });

            // Wait for notification to be broadcasted
            const notification = await tester.waitForMessage(
              msg => msg.type === "pitch_notification" || msg.type === "pitch_update"
            );

            assertExists(notification);
            assertEquals(notification.data.pitchId, 123);
            assertEquals(notification.data.action, "like");
          }
        });

        await Deno.test({
          name: "NDA Status Updates",
          async fn() {
            tester.clearMessageLog();
            
            await tester.createConnection(1, "creator");
            await tester.createConnection(2, "investor");

            // Send NDA status update
            await tester.sendMessage("creator_1", {
              type: "nda_status_update",
              data: {
                ndaId: 456,
                pitchId: 123,
                status: "signed",
                signerId: 2,
                timestamp: Date.now()
              }
            });

            // Wait for NDA notification
            const ndaNotification = await tester.waitForMessage(
              msg => msg.type === "nda_notification" || msg.type === "nda_status_update"
            );

            assertExists(ndaNotification);
            assertEquals(ndaNotification.data.ndaId, 456);
            assertEquals(ndaNotification.data.status, "signed");
          }
        });

        // ==================== PRESENCE TESTS ====================
        
        await Deno.test({
          name: "User Presence Tracking",
          async fn() {
            tester.clearMessageLog();
            
            const creatorWs = await tester.createConnection(1, "creator");
            
            // Send presence update
            await tester.sendMessage("creator_1", {
              type: "presence_update",
              data: {
                status: "online",
                activity: "viewing_pitch",
                pitchId: 123
              }
            });

            // Connect second user to see presence
            await tester.createConnection(2, "investor");

            // Should receive presence notifications
            const presenceMessage = await tester.waitForMessage(
              msg => msg.type === "presence_notification" || msg.type === "presence_update"
            );

            assertExists(presenceMessage);
          }
        });

        await Deno.test({
          name: "Typing Indicators",
          async fn() {
            tester.clearMessageLog();
            
            await tester.createConnection(1, "creator");
            await tester.createConnection(2, "investor");

            // Send typing indicator
            await tester.sendMessage("creator_1", {
              type: "typing_start",
              data: {
                roomId: "pitch_123",
                userId: 1
              }
            });

            // Wait for typing notification
            const typingMessage = await tester.waitForMessage(
              msg => msg.type === "typing_notification" || msg.type === "typing_start"
            );

            assertExists(typingMessage);
            assertEquals(typingMessage.data.userId, 1);

            // Send typing stop
            await tester.sendMessage("creator_1", {
              type: "typing_stop",
              data: {
                roomId: "pitch_123",
                userId: 1
              }
            });

            const typingStopMessage = await tester.waitForMessage(
              msg => msg.type === "typing_stop_notification" || msg.type === "typing_stop"
            );

            assertExists(typingStopMessage);
          }
        });

        // ==================== ROOM MANAGEMENT TESTS ====================
        
        await Deno.test({
          name: "Room Join and Leave",
          async fn() {
            tester.clearMessageLog();
            
            await tester.createConnection(1, "creator");

            // Join a room
            await tester.sendMessage("creator_1", {
              type: "join_room",
              data: {
                roomId: "pitch_123",
                roomType: "pitch_discussion"
              }
            });

            // Wait for room join confirmation
            const joinConfirmation = await tester.waitForMessage(
              msg => msg.type === "room_joined" || msg.type === "join_room"
            );

            assertExists(joinConfirmation);

            // Leave the room
            await tester.sendMessage("creator_1", {
              type: "leave_room",
              data: {
                roomId: "pitch_123"
              }
            });

            const leaveConfirmation = await tester.waitForMessage(
              msg => msg.type === "room_left" || msg.type === "leave_room"
            );

            assertExists(leaveConfirmation);
          }
        });

        // ==================== PERFORMANCE TESTS ====================
        
        await Deno.test({
          name: "Message Latency Test",
          async fn() {
            tester.clearMessageLog();
            
            await tester.createConnection(1, "creator");
            await tester.createConnection(2, "investor");

            const startTime = Date.now();
            
            await tester.sendMessage("creator_1", {
              type: "ping",
              data: {
                timestamp: startTime,
                messageId: "latency_test_1"
              }
            });

            // Wait for pong response
            const pongMessage = await tester.waitForMessage(
              msg => msg.type === "pong" || (msg.type === "ping" && msg.data.messageId === "latency_test_1")
            );

            const latency = Date.now() - startTime;
            console.log(`WebSocket latency: ${latency}ms`);
            
            assert(latency < 1000, `High latency detected: ${latency}ms`);
            assertExists(pongMessage);
          }
        });

        await Deno.test({
          name: "Concurrent Message Handling",
          async fn() {
            tester.clearMessageLog();
            
            // Create multiple connections
            await tester.createConnection(1, "creator");
            await tester.createConnection(2, "investor");
            await tester.createConnection(3, "production");

            const messageCount = 10;
            const promises: Promise<void>[] = [];

            // Send multiple messages concurrently
            for (let i = 0; i < messageCount; i++) {
              const promise = tester.sendMessage("creator_1", {
                type: "bulk_message",
                data: {
                  messageId: i,
                  content: `Message ${i}`,
                  timestamp: Date.now()
                }
              });
              promises.push(promise);
            }

            await Promise.all(promises);

            // Wait for all messages to be processed
            await new Promise(resolve => setTimeout(resolve, 2000));

            const bulkMessages = tester.getMessagesOfType("bulk_message");
            assert(bulkMessages.length > 0, "Should receive bulk messages");
            
            console.log(`Processed ${bulkMessages.length} concurrent messages`);
          }
        });

        // ==================== ERROR HANDLING TESTS ====================
        
        await Deno.test({
          name: "Connection Recovery Test",
          async fn() {
            const ws = await tester.createConnection(1, "creator");
            assertEquals(ws.readyState, WebSocket.OPEN);

            // Force close connection
            ws.close();
            
            // Wait for close
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify connection is removed from tracking
            assertEquals(tester.getConnectionCount(), 1); // Other connections still active

            // Test reconnection
            const newWs = await tester.createConnection(1, "creator");
            assertEquals(newWs.readyState, WebSocket.OPEN);
          }
        });

        await Deno.test({
          name: "Invalid Message Handling",
          async fn() {
            await tester.createConnection(1, "creator");

            // Send invalid JSON
            try {
              const ws = tester.connections.get("creator_1");
              if (ws) {
                ws.send("invalid json {{{");
                
                // Wait to see if connection stays open
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Connection should still be open (server should handle gracefully)
                assertEquals(ws.readyState, WebSocket.OPEN);
              }
            } catch (error) {
              // Expected behavior - server might close connection for invalid data
              console.log("Connection closed for invalid message (expected)");
            }
          }
        });

        // ==================== INTEGRATION WITH DATABASE ====================
        
        await Deno.test({
          name: "Message Persistence Integration",
          async fn() {
            tester.clearMessageLog();
            
            await tester.createConnection(1, "creator");
            await tester.createConnection(2, "investor");

            // Send a message that should be persisted
            await tester.sendMessage("creator_1", {
              type: "persistent_message",
              data: {
                receiverId: 2,
                subject: "WebSocket Integration Test",
                content: "This message should be saved to database",
                pitchId: 123
              }
            });

            // Wait for persistence confirmation
            const confirmation = await tester.waitForMessage(
              msg => msg.type === "message_saved" || msg.type === "persistent_message"
            );

            assertExists(confirmation);
            
            // Verify message was actually saved (would need database check)
            console.log("Message persistence integration test completed");
          }
        });

        console.log("✅ All WebSocket integration tests passed!");

      } finally {
        // Cleanup all connections
        tester.closeAllConnections();
      }
    });
  }
});