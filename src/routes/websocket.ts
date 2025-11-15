/**
 * Real-time WebSocket Routes Module
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { validateEnvironment } from "../utils/env-validation.ts";

const envConfig = validateEnvironment();
const JWT_SECRET = envConfig.JWT_SECRET;

// WebSocket connection management
const connections = new Map<string, WebSocket>();
const userSessions = new Map<number, Set<string>>();
const roomSessions = new Map<string, Set<string>>();

interface WebSocketMessage {
  type: string;
  data?: any;
  userId?: number;
  room?: string;
  timestamp?: string;
}

// Middleware to extract user from JWT token
async function getUserFromToken(token: string): Promise<any> {
  const payload = await verify(
    token,
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )
  );
  return payload;
}

// WebSocket connection handler
export const handleWebSocketConnection: RouteHandler = async (request, url) => {
  try {
    const token = url.searchParams.get("token");
    if (!token) {
      return errorResponse("Authentication token required", 401);
    }

    const user = await getUserFromToken(token);
    const connectionId = crypto.randomUUID();

    const { socket, response } = Deno.upgradeWebSocket(request);

    socket.onopen = () => {
      connections.set(connectionId, socket);
      
      // Track user sessions
      if (!userSessions.has(user.userId)) {
        userSessions.set(user.userId, new Set());
      }
      userSessions.get(user.userId)!.add(connectionId);

      // Send connection confirmation
      const welcomeMessage: WebSocketMessage = {
        type: "connection_established",
        data: {
          connectionId,
          userId: user.userId,
          timestamp: new Date().toISOString()
        }
      };
      socket.send(JSON.stringify(welcomeMessage));

      telemetry.logger.info("WebSocket connection established", { 
        connectionId, 
        userId: user.userId 
      });
    };

    socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleWebSocketMessage(connectionId, user.userId, message);
      } catch (error) {
        telemetry.logger.error("WebSocket message parse error", error);
        const errorMsg: WebSocketMessage = {
          type: "error",
          data: { message: "Invalid message format" }
        };
        socket.send(JSON.stringify(errorMsg));
      }
    };

    socket.onclose = () => {
      // Cleanup connections
      connections.delete(connectionId);
      
      const userConnections = userSessions.get(user.userId);
      if (userConnections) {
        userConnections.delete(connectionId);
        if (userConnections.size === 0) {
          userSessions.delete(user.userId);
        }
      }

      // Remove from all rooms
      for (const [room, roomConnections] of roomSessions) {
        roomConnections.delete(connectionId);
        if (roomConnections.size === 0) {
          roomSessions.delete(room);
        }
      }

      telemetry.logger.info("WebSocket connection closed", { 
        connectionId, 
        userId: user.userId 
      });
    };

    socket.onerror = (error) => {
      telemetry.logger.error("WebSocket error", error, { 
        connectionId, 
        userId: user.userId 
      });
    };

    return response;

  } catch (error) {
    telemetry.logger.error("WebSocket connection error", error);
    return errorResponse("Failed to establish WebSocket connection", 500);
  }
};

// Handle incoming WebSocket messages
function handleWebSocketMessage(connectionId: string, userId: number, message: WebSocketMessage) {
  switch (message.type) {
    case "join_room":
      joinRoom(connectionId, message.room!);
      break;
    case "leave_room":
      leaveRoom(connectionId, message.room!);
      break;
    case "send_notification":
      sendNotification(userId, message.data);
      break;
    case "pitch_view":
      handlePitchView(userId, message.data);
      break;
    case "typing_indicator":
      handleTypingIndicator(connectionId, message.data);
      break;
    case "presence_update":
      handlePresenceUpdate(userId, message.data);
      break;
    case "draft_sync":
      handleDraftSync(userId, message.data);
      break;
    default:
      telemetry.logger.warn("Unknown WebSocket message type", { type: message.type });
  }
}

// Room management
function joinRoom(connectionId: string, room: string) {
  if (!roomSessions.has(room)) {
    roomSessions.set(room, new Set());
  }
  roomSessions.get(room)!.add(connectionId);

  const socket = connections.get(connectionId);
  if (socket) {
    const response: WebSocketMessage = {
      type: "room_joined",
      data: { room, timestamp: new Date().toISOString() }
    };
    socket.send(JSON.stringify(response));
  }
}

function leaveRoom(connectionId: string, room: string) {
  const roomConnections = roomSessions.get(room);
  if (roomConnections) {
    roomConnections.delete(connectionId);
    if (roomConnections.size === 0) {
      roomSessions.delete(room);
    }
  }

  const socket = connections.get(connectionId);
  if (socket) {
    const response: WebSocketMessage = {
      type: "room_left",
      data: { room, timestamp: new Date().toISOString() }
    };
    socket.send(JSON.stringify(response));
  }
}

// Broadcast to room
function broadcastToRoom(room: string, message: WebSocketMessage, excludeConnectionId?: string) {
  const roomConnections = roomSessions.get(room);
  if (!roomConnections) return;

  for (const connectionId of roomConnections) {
    if (connectionId === excludeConnectionId) continue;
    
    const socket = connections.get(connectionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

// Broadcast to user (all their connections)
function broadcastToUser(userId: number, message: WebSocketMessage) {
  const userConnections = userSessions.get(userId);
  if (!userConnections) return;

  for (const connectionId of userConnections) {
    const socket = connections.get(connectionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

// Send notification to specific user
function sendNotification(fromUserId: number, data: any) {
  const { targetUserId, type, title, message } = data;
  
  const notification: WebSocketMessage = {
    type: "notification_received",
    data: {
      from: fromUserId,
      type,
      title,
      message,
      timestamp: new Date().toISOString()
    }
  };

  broadcastToUser(targetUserId, notification);
  
  telemetry.logger.info("WebSocket notification sent", { 
    from: fromUserId, 
    to: targetUserId, 
    type 
  });
}

// Handle pitch view events
function handlePitchView(userId: number, data: any) {
  const { pitchId, viewDuration, scrollDepth } = data;
  
  // Broadcast live view count to pitch room
  const liveViewMessage: WebSocketMessage = {
    type: "live_view_update",
    data: {
      pitchId,
      viewCount: 1, // This would be calculated from current viewers
      timestamp: new Date().toISOString()
    }
  };

  broadcastToRoom(`pitch_${pitchId}`, liveViewMessage);

  telemetry.logger.info("Pitch view tracked", { userId, pitchId, viewDuration });
}

// Handle typing indicators
function handleTypingIndicator(connectionId: string, data: any) {
  const { room, isTyping } = data;
  
  const typingMessage: WebSocketMessage = {
    type: "typing_indicator",
    data: {
      connectionId,
      isTyping,
      timestamp: new Date().toISOString()
    }
  };

  broadcastToRoom(room, typingMessage, connectionId);
}

// Handle presence updates
function handlePresenceUpdate(userId: number, data: any) {
  const { status } = data; // online, away, busy, offline
  
  const presenceMessage: WebSocketMessage = {
    type: "presence_changed",
    data: {
      userId,
      status,
      timestamp: new Date().toISOString()
    }
  };

  // Broadcast to all user's contacts/followers
  broadcastToUser(userId, presenceMessage);
  
  telemetry.logger.info("Presence updated", { userId, status });
}

// Handle draft synchronization
function handleDraftSync(userId: number, data: any) {
  const { draftId, content, lastModified } = data;
  
  const draftSyncMessage: WebSocketMessage = {
    type: "draft_synced",
    data: {
      draftId,
      content,
      lastModified,
      timestamp: new Date().toISOString()
    }
  };

  // Send confirmation back to user
  broadcastToUser(userId, draftSyncMessage);
  
  telemetry.logger.info("Draft synchronized", { userId, draftId });
}

// Get WebSocket statistics
export const getWebSocketStats: RouteHandler = async (request, url) => {
  try {
    const stats = {
      active_connections: connections.size,
      active_users: userSessions.size,
      active_rooms: roomSessions.size,
      connections_by_room: Object.fromEntries(
        Array.from(roomSessions.entries()).map(([room, connections]) => [
          room, 
          connections.size
        ])
      ),
      timestamp: new Date().toISOString()
    };

    return successResponse(stats);

  } catch (error) {
    telemetry.logger.error("WebSocket stats error", error);
    return errorResponse("Failed to fetch WebSocket statistics", 500);
  }
};

// Send admin broadcast
export const sendAdminBroadcast: RouteHandler = async (request, url) => {
  try {
    const { message, type = "admin_announcement" } = await request.json();

    if (!message) {
      return errorResponse("Message is required", 400);
    }

    const broadcastMessage: WebSocketMessage = {
      type,
      data: {
        message,
        timestamp: new Date().toISOString()
      }
    };

    // Broadcast to all connected users
    let sentCount = 0;
    for (const socket of connections.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(broadcastMessage));
        sentCount++;
      }
    }

    telemetry.logger.info("Admin broadcast sent", { 
      message, 
      recipientCount: sentCount 
    });

    return successResponse({
      message: "Broadcast sent successfully",
      recipients: sentCount
    });

  } catch (error) {
    telemetry.logger.error("Admin broadcast error", error);
    return errorResponse("Failed to send broadcast", 500);
  }
};

// Check user online status
export const getUserOnlineStatus: RouteHandler = async (request, url) => {
  try {
    const userIds = url.searchParams.get("userIds")?.split(",").map(id => parseInt(id));
    
    if (!userIds || userIds.length === 0) {
      return errorResponse("User IDs are required", 400);
    }

    const onlineStatus = userIds.map(userId => ({
      userId,
      online: userSessions.has(userId),
      connectionCount: userSessions.get(userId)?.size || 0
    }));

    return successResponse({
      users: onlineStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    telemetry.logger.error("User online status error", error);
    return errorResponse("Failed to check user online status", 500);
  }
};