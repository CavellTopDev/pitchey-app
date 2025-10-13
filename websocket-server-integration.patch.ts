/**
 * WebSocket Server Integration Patch
 * This file shows how to integrate the WebSocket server with the existing working-server.ts
 * 
 * INTEGRATION INSTRUCTIONS:
 * 1. Add the imports at the top of working-server.ts
 * 2. Add the WebSocket initialization after the server setup
 * 3. Replace the serve() call with the WebSocket-enabled handler
 * 4. Add the WebSocket endpoints to the route handler
 */

// ====================
// 1. ADD THESE IMPORTS TO THE TOP OF working-server.ts
// ====================

import { 
  webSocketIntegration, 
  addWebSocketSupport, 
  addWebSocketHeaders 
} from "./src/services/websocket-integration.service.ts";

// ====================
// 2. ADD THIS INITIALIZATION AFTER THE EXISTING SERVER SETUP
// ====================

// Initialize WebSocket integration
console.log("Initializing WebSocket services...");
await webSocketIntegration.initialize();
console.log("WebSocket services initialized successfully");

// ====================
// 3. REPLACE THE EXISTING serve() CALL WITH THIS WebSocket-ENABLED VERSION
// ====================

// Original code:
// serve(handler, { port: parseInt(port) });

// Replace with:
const webSocketEnabledHandler = addWebSocketSupport(async (request: Request): Promise<Response> => {
  // Your existing request handler code goes here
  // This is the main handler function that processes HTTP requests
  
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Set request origin for CORS
  setRequestOrigin(request);
  
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  // Apply security middleware
  try {
    // Rate limiting (existing code)
    // Authentication (existing code)
    // Your existing middleware chain...
    
    // ====================
    // 4. ADD THESE WebSocket ENDPOINTS TO YOUR ROUTE HANDLER
    // ====================
    
    // WebSocket health check
    if (pathname === "/api/ws/health") {
      try {
        const healthStatus = await webSocketIntegration.getHealthStatus();
        return jsonResponse(healthStatus);
      } catch (error) {
        console.error("WebSocket health check failed:", error);
        return serverErrorResponse("Health check failed");
      }
    }
    
    // WebSocket server statistics (admin only)
    if (pathname === "/api/ws/stats") {
      try {
        // Add authentication check here
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        
        if (!token) {
          return authErrorResponse("Authentication required");
        }
        
        const payload = await verifyToken(token);
        if (!payload) {
          return authErrorResponse("Invalid token");
        }
        
        // Check if user is admin (implement your admin check logic)
        const isAdmin = true; // Replace with actual admin check
        if (!isAdmin) {
          return forbiddenResponse("Admin access required");
        }
        
        const stats = await webSocketIntegration.getServerStats();
        return jsonResponse(stats);
      } catch (error) {
        console.error("WebSocket stats failed:", error);
        return serverErrorResponse("Stats retrieval failed");
      }
    }
    
    // Send notification via WebSocket (for HTTP API compatibility)
    if (pathname === "/api/ws/notify" && request.method === "POST") {
      try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        
        if (!token) {
          return authErrorResponse("Authentication required");
        }
        
        const payload = await verifyToken(token);
        if (!payload) {
          return authErrorResponse("Invalid token");
        }
        
        const body = await request.json();
        const { userId, notification } = body;
        
        if (!userId || !notification) {
          return validationErrorResponse("userId and notification are required");
        }
        
        const success = await webSocketIntegration.sendNotificationToUser(userId, notification);
        
        if (success) {
          return successResponse({ message: "Notification sent successfully" });
        } else {
          return serverErrorResponse("Failed to send notification");
        }
      } catch (error) {
        console.error("WebSocket notification failed:", error);
        return serverErrorResponse("Notification failed");
      }
    }
    
    // Get user presence status
    if (pathname.startsWith("/api/ws/presence/") && request.method === "GET") {
      try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        
        if (!token) {
          return authErrorResponse("Authentication required");
        }
        
        const tokenPayload = await verifyToken(token);
        if (!tokenPayload) {
          return authErrorResponse("Invalid token");
        }
        
        const userId = parseInt(pathname.split("/").pop() || "0");
        if (!userId) {
          return validationErrorResponse("Invalid user ID");
        }
        
        const presence = await webSocketIntegration.getUserPresence(userId);
        
        if (presence) {
          return jsonResponse(presence);
        } else {
          return notFoundResponse("User presence not found");
        }
      } catch (error) {
        console.error("Get presence failed:", error);
        return serverErrorResponse("Failed to get presence");
      }
    }
    
    // Get online following users
    if (pathname === "/api/ws/following-online" && request.method === "GET") {
      try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        
        if (!token) {
          return authErrorResponse("Authentication required");
        }
        
        const tokenPayload = await verifyToken(token);
        if (!tokenPayload) {
          return authErrorResponse("Invalid token");
        }
        
        const userId = parseInt(tokenPayload.sub);
        const onlineFollowing = await webSocketIntegration.getFollowingOnlineUsers(userId);
        
        return jsonResponse({
          onlineFollowing,
          count: onlineFollowing.length
        });
      } catch (error) {
        console.error("Get following online failed:", error);
        return serverErrorResponse("Failed to get online following");
      }
    }
    
    // Send upload progress update
    if (pathname === "/api/ws/upload-progress" && request.method === "POST") {
      try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        
        if (!token) {
          return authErrorResponse("Authentication required");
        }
        
        const tokenPayload = await verifyToken(token);
        if (!tokenPayload) {
          return authErrorResponse("Invalid token");
        }
        
        const body = await request.json();
        const { uploadId, progress, status } = body;
        
        if (!uploadId || progress === undefined || !status) {
          return validationErrorResponse("uploadId, progress, and status are required");
        }
        
        const userId = parseInt(tokenPayload.sub);
        const success = await webSocketIntegration.sendUploadProgress(
          userId, 
          uploadId, 
          progress, 
          status
        );
        
        if (success) {
          return successResponse({ message: "Upload progress sent" });
        } else {
          return serverErrorResponse("Failed to send upload progress");
        }
      } catch (error) {
        console.error("Upload progress update failed:", error);
        return serverErrorResponse("Upload progress update failed");
      }
    }
    
    // Update pitch statistics
    if (pathname.startsWith("/api/ws/pitch/") && pathname.endsWith("/stats") && request.method === "POST") {
      try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        
        if (!token) {
          return authErrorResponse("Authentication required");
        }
        
        const tokenPayload = await verifyToken(token);
        if (!tokenPayload) {
          return authErrorResponse("Invalid token");
        }
        
        const pitchId = parseInt(pathname.split("/")[3]);
        if (!pitchId) {
          return validationErrorResponse("Invalid pitch ID");
        }
        
        const body = await request.json();
        const { stats } = body;
        
        if (!stats) {
          return validationErrorResponse("stats are required");
        }
        
        const success = await webSocketIntegration.updatePitchStats(pitchId, stats);
        
        if (success) {
          return successResponse({ message: "Pitch stats updated" });
        } else {
          return serverErrorResponse("Failed to update pitch stats");
        }
      } catch (error) {
        console.error("Pitch stats update failed:", error);
        return serverErrorResponse("Pitch stats update failed");
      }
    }
    
    // System announcement (admin only)
    if (pathname === "/api/ws/announce" && request.method === "POST") {
      try {
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.replace("Bearer ", "");
        
        if (!token) {
          return authErrorResponse("Authentication required");
        }
        
        const tokenPayload = await verifyToken(token);
        if (!tokenPayload) {
          return authErrorResponse("Invalid token");
        }
        
        // Check if user is admin
        const isAdmin = true; // Replace with actual admin check
        if (!isAdmin) {
          return forbiddenResponse("Admin access required");
        }
        
        const body = await request.json();
        const { announcement } = body;
        
        if (!announcement || !announcement.title || !announcement.message) {
          return validationErrorResponse("announcement with title and message is required");
        }
        
        const success = await webSocketIntegration.broadcastSystemAnnouncement(announcement);
        
        if (success) {
          return successResponse({ message: "Announcement broadcast successfully" });
        } else {
          return serverErrorResponse("Failed to broadcast announcement");
        }
      } catch (error) {
        console.error("System announcement failed:", error);
        return serverErrorResponse("System announcement failed");
      }
    }
    
    // Your existing route handlers continue here...
    // ... existing code for /api/users, /api/pitches, etc.
    
  } catch (error) {
    console.error("Request processing error:", error);
    captureException(error);
    return serverErrorResponse("Internal server error");
  }
  
  // If no route matched, return 404
  return notFoundResponse("Endpoint not found");
});

// Start the server with WebSocket support
serve(webSocketEnabledHandler, { 
  port: parseInt(port),
  onListen: ({ port, hostname }) => {
    console.log(`Server running on http://${hostname}:${port}`);
    console.log(`WebSocket endpoint: ws://${hostname}:${port}/ws`);
    console.log("WebSocket features enabled:");
    console.log("  - Real-time notifications");
    console.log("  - Live dashboard metrics");
    console.log("  - Draft auto-sync");
    console.log("  - Presence tracking");
    console.log("  - Upload progress");
    console.log("  - Live pitch view counters");
    console.log("  - Typing indicators");
    console.log("  - Activity feed updates");
  }
});

// ====================
// 5. ADD GRACEFUL SHUTDOWN HANDLING
// ====================

// Handle graceful shutdown
const shutdown = async () => {
  console.log("Shutting down server...");
  await webSocketIntegration.shutdown();
  Deno.exit(0);
};

// Listen for shutdown signals
Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

// ====================
// 6. MODIFY EXISTING FUNCTIONS TO INTEGRATE WebSocket FEATURES
// ====================

// Example: Modify the notification creation function to also send via WebSocket
// Find your existing notification function and modify it like this:

/*
// Original notification function:
async function createNotification(userId: number, notification: any) {
  // Insert into database
  const result = await db.insert(notifications).values({
    userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    // ... other fields
  }).returning();
  
  return result[0];
}

// Modified to include WebSocket:
async function createNotification(userId: number, notification: any) {
  // Insert into database
  const result = await db.insert(notifications).values({
    userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    // ... other fields
  }).returning();
  
  // Send via WebSocket for real-time delivery
  await webSocketIntegration.sendNotificationToUser(userId, {
    type: notification.type,
    title: notification.title,
    message: notification.message,
    relatedId: notification.relatedId,
    relatedType: notification.relatedType
  });
  
  return result[0];
}
*/

// ====================
// 7. EXAMPLE INTEGRATION POINTS FOR EXISTING FEATURES
// ====================

/*
// 1. When a pitch view is recorded:
// Add this after recording the view in the database:
await webSocketIntegration.updatePitchStats(pitchId, {
  viewCount: newViewCount,
  uniqueViewers: uniqueViewerCount
});

// 2. When a user follows another user:
// Add this after the follow is created:
await webSocketIntegration.sendNotificationToUser(creatorId, {
  type: "new_follower",
  title: "New Follower",
  message: `${followerName} started following you`,
  relatedId: followerId,
  relatedType: "user"
});

// 3. When a message is sent:
// The WebSocket system handles this automatically, but you can also
// send notifications for important messages:
if (message.priority === "high") {
  await webSocketIntegration.sendNotificationToUser(recipientId, {
    type: "important_message",
    title: "Important Message",
    message: `You have a new important message from ${senderName}`,
    relatedId: messageId,
    relatedType: "message"
  });
}

// 4. When upload progress changes:
// Add this in your file upload handler:
await webSocketIntegration.sendUploadProgress(
  userId,
  uploadId,
  progressPercentage,
  status
);

// 5. When dashboard metrics update:
// Add this in your analytics update function:
await webSocketIntegration.sendDashboardUpdate(userId, {
  pitchViews: totalViews,
  followers: followerCount,
  messages: messageCount,
  // ... other metrics
});
*/

console.log("WebSocket server integration patch ready for application");
console.log("Please follow the integration instructions in the comments above");

export {
  webSocketIntegration,
  addWebSocketSupport,
  addWebSocketHeaders
};