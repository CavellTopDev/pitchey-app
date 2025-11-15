/**
 * Enhanced WebSocket Routes
 * Provides advanced WebSocket management with clustering, rooms, and optimization
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";
import { WebSocketClusterService } from "../services/websocket-cluster.service.ts";
import { telemetry } from "../utils/telemetry.ts";

// Enhanced WebSocket connection handler
export const handleWebSocketConnection: RouteHandler = async (request, url) => {
  if (request.headers.get("upgrade") !== "websocket") {
    return errorResponse("Expected WebSocket upgrade", 400);
  }

  try {
    const { socket, response } = Deno.upgradeWebSocket(request);
    
    // Extract connection parameters
    const sessionId = url.searchParams.get("sessionId");
    const userId = url.searchParams.get("userId");
    const rooms = url.searchParams.get("rooms")?.split(",") || [];
    
    // Handle connection through cluster service
    const connectionId = WebSocketClusterService.handleConnection(socket, request);
    
    // Associate user if provided
    if (userId) {
      WebSocketClusterService.associateUser(connectionId, userId);
    }
    
    // Join requested rooms
    for (const roomId of rooms) {
      if (roomId.trim()) {
        await WebSocketClusterService.joinRoom(connectionId, roomId.trim());
      }
    }
    
    telemetry.logger.info("Enhanced WebSocket connection established", {
      connectionId,
      userId,
      sessionId,
      rooms: rooms.length
    });
    
    return response;
    
  } catch (error) {
    telemetry.logger.error("WebSocket connection error", error);
    return errorResponse("Failed to establish WebSocket connection", 500);
  }
};

// Get WebSocket cluster metrics
export const getWebSocketMetrics: RouteHandler = async (request, url) => {
  try {
    const metrics = WebSocketClusterService.getMetrics();
    const connections = WebSocketClusterService.getConnections();
    const rooms = WebSocketClusterService.getRooms();
    const clusterStatus = WebSocketClusterService.getClusterStatus();
    
    // Calculate additional insights
    const roomStats = rooms.map(room => ({
      ...room,
      utilization: room.memberCount > 0 ? (room.memberCount / 100) * 100 : 0 // Assuming max 100 per room
    }));
    
    const connectionStats = {
      active: connections.filter(c => Date.now() - c.lastActivity < 60000).length,
      idle: connections.filter(c => Date.now() - c.lastActivity >= 60000).length,
      withUsers: connections.filter(c => c.userId).length,
      anonymous: connections.filter(c => !c.userId).length
    };
    
    return successResponse({
      timestamp: new Date().toISOString(),
      metrics,
      connections: {
        total: connections.length,
        stats: connectionStats,
        recent_activity: connections
          .sort((a, b) => b.lastActivity - a.lastActivity)
          .slice(0, 10)
      },
      rooms: {
        total: rooms.length,
        persistent: rooms.filter(r => r.persistent).length,
        temporary: rooms.filter(r => !r.persistent).length,
        stats: roomStats,
        top_rooms: roomStats
          .sort((a, b) => b.memberCount - a.memberCount)
          .slice(0, 10)
      },
      cluster: clusterStatus
    });
    
  } catch (error) {
    telemetry.logger.error("WebSocket metrics error", error);
    return errorResponse("Failed to get WebSocket metrics", 500);
  }
};

// Get WebSocket cluster status
export const getClusterStatus: RouteHandler = async (request, url) => {
  try {
    const clusterStatus = WebSocketClusterService.getClusterStatus();
    const metrics = WebSocketClusterService.getMetrics();
    
    // Calculate load distribution
    const loadDistribution = clusterStatus.nodes.map(node => ({
      nodeId: node.id,
      address: `${node.address}:${node.port}`,
      connections: node.connections,
      load: node.load,
      status: node.status,
      capabilities: node.capabilities,
      lastSeen: new Date(node.lastHeartbeat).toISOString(),
      health: node.status === "active" ? 100 : 
             node.status === "degraded" ? 50 : 0
    }));
    
    const totalCapacity = loadDistribution.reduce((sum, node) => 
      sum + (node.status === "active" ? 1000 : 0), 0); // Assuming 1000 connections per node
    
    const currentLoad = loadDistribution.reduce((sum, node) => 
      sum + node.connections, 0);
    
    return successResponse({
      cluster_enabled: clusterStatus.enabled,
      current_node: clusterStatus.nodeId,
      cluster_health: clusterStatus.health,
      load_overview: {
        total_capacity: totalCapacity,
        current_load: currentLoad,
        utilization_percent: totalCapacity > 0 ? (currentLoad / totalCapacity) * 100 : 0,
        available_capacity: totalCapacity - currentLoad
      },
      nodes: loadDistribution,
      recommendations: generateClusterRecommendations(loadDistribution, metrics)
    });
    
  } catch (error) {
    telemetry.logger.error("Cluster status error", error);
    return errorResponse("Failed to get cluster status", 500);
  }
};

// Create a new WebSocket room
export const createRoom: RouteHandler = async (request, url) => {
  try {
    const { roomId, name, maxConnections, persistent, owner } = await request.json();
    
    if (!roomId || !name) {
      return errorResponse("Room ID and name are required", 400);
    }
    
    const room = WebSocketClusterService.createRoom(roomId, name, {
      maxConnections: maxConnections > 0 ? maxConnections : undefined,
      persistent: persistent === true,
      owner
    });
    
    return successResponse({
      message: "Room created successfully",
      room: {
        id: room.id,
        name: room.name,
        maxConnections: room.maxConnections,
        persistent: room.persistent,
        memberCount: room.connections.size,
        createdAt: room.metadata.createdAt,
        owner: room.metadata.owner
      }
    });
    
  } catch (error) {
    telemetry.logger.error("Create room error", error);
    return errorResponse("Failed to create room", 500);
  }
};

// Broadcast message to all connected clients
export const broadcastMessage: RouteHandler = async (request, url) => {
  try {
    const { message, priority, ttl, excludeConnectionId } = await request.json();
    
    if (!message) {
      return errorResponse("Message is required", 400);
    }
    
    await WebSocketClusterService.broadcastToAll({
      type: "broadcast",
      payload: {
        event: "broadcast",
        message,
        timestamp: Date.now(),
        source: "admin"
      },
      priority: priority || 5,
      ttl: ttl || undefined
    }, excludeConnectionId);
    
    const metrics = WebSocketClusterService.getMetrics();
    
    return successResponse({
      message: "Broadcast sent successfully",
      recipients: metrics.totalConnections - (excludeConnectionId ? 1 : 0),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    telemetry.logger.error("Broadcast message error", error);
    return errorResponse("Failed to send broadcast message", 500);
  }
};

// Send message to specific room
export const sendRoomMessage: RouteHandler = async (request, url) => {
  try {
    const { roomId, message, priority, excludeConnectionId } = await request.json();
    
    if (!roomId || !message) {
      return errorResponse("Room ID and message are required", 400);
    }
    
    const rooms = WebSocketClusterService.getRooms();
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) {
      return errorResponse("Room not found", 404);
    }
    
    await WebSocketClusterService.broadcastToRoom(roomId, {
      type: "room",
      payload: {
        event: "admin_message",
        message,
        timestamp: Date.now(),
        source: "admin"
      },
      priority: priority || 5
    }, excludeConnectionId);
    
    return successResponse({
      message: "Room message sent successfully",
      roomId,
      recipients: room.memberCount - (excludeConnectionId ? 1 : 0),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    telemetry.logger.error("Send room message error", error);
    return errorResponse("Failed to send room message", 500);
  }
};

// Send message to specific user (all their connections)
export const sendUserMessage: RouteHandler = async (request, url) => {
  try {
    const { userId, message, priority } = await request.json();
    
    if (!userId || !message) {
      return errorResponse("User ID and message are required", 400);
    }
    
    const userConnections = WebSocketClusterService.getConnectionsByUser(userId);
    
    if (userConnections.length === 0) {
      return errorResponse("User not connected", 404);
    }
    
    let sentCount = 0;
    for (const connectionId of userConnections) {
      const sent = WebSocketClusterService.sendToConnection(connectionId, {
        type: "private",
        payload: {
          event: "private_message",
          message,
          timestamp: Date.now(),
          source: "admin"
        },
        priority: priority || 5
      });
      
      if (sent) sentCount++;
    }
    
    return successResponse({
      message: "User message sent successfully",
      userId,
      connections: userConnections.length,
      delivered: sentCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    telemetry.logger.error("Send user message error", error);
    return errorResponse("Failed to send user message", 500);
  }
};

// Send message to channel subscribers
export const sendChannelMessage: RouteHandler = async (request, url) => {
  try {
    const { channel, message, priority } = await request.json();
    
    if (!channel || !message) {
      return errorResponse("Channel and message are required", 400);
    }
    
    await WebSocketClusterService.broadcastToChannel(channel, {
      type: "broadcast",
      payload: {
        event: "channel_message",
        channel,
        message,
        timestamp: Date.now(),
        source: "admin"
      },
      priority: priority || 5
    });
    
    // Count subscribers (simplified - would need actual tracking in real implementation)
    const connections = WebSocketClusterService.getConnections();
    const subscriberCount = connections.length; // Simplified
    
    return successResponse({
      message: "Channel message sent successfully",
      channel,
      estimated_recipients: subscriberCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    telemetry.logger.error("Send channel message error", error);
    return errorResponse("Failed to send channel message", 500);
  }
};

// Get detailed connection information
export const getConnectionDetails: RouteHandler = async (request, url) => {
  try {
    const connectionId = url.searchParams.get("connection_id");
    
    if (!connectionId) {
      return errorResponse("Connection ID is required", 400);
    }
    
    const connections = WebSocketClusterService.getConnections();
    const connection = connections.find(c => c.id === connectionId);
    
    if (!connection) {
      return errorResponse("Connection not found", 404);
    }
    
    return successResponse({
      connection: {
        id: connection.id,
        userId: connection.userId,
        rooms: connection.rooms,
        lastActivity: connection.lastActivity,
        lastActivityFormatted: new Date(connection.lastActivity).toISOString(),
        sessionDuration: Date.now() - connection.lastActivity,
        isActive: Date.now() - connection.lastActivity < 60000
      }
    });
    
  } catch (error) {
    telemetry.logger.error("Get connection details error", error);
    return errorResponse("Failed to get connection details", 500);
  }
};

// Force disconnect a connection
export const forceDisconnect: RouteHandler = async (request, url) => {
  try {
    const { connectionId, reason } = await request.json();
    
    if (!connectionId) {
      return errorResponse("Connection ID is required", 400);
    }
    
    // Send disconnect notice
    const sent = WebSocketClusterService.sendToConnection(connectionId, {
      type: "system",
      payload: {
        event: "forced_disconnect",
        reason: reason || "Administrative action",
        timestamp: Date.now()
      },
      priority: 10
    });
    
    if (!sent) {
      return errorResponse("Connection not found or already disconnected", 404);
    }
    
    // Disconnect will be handled by the connection cleanup
    setTimeout(() => {
      WebSocketClusterService.handleDisconnection(connectionId);
    }, 1000); // Give time for the message to be sent
    
    return successResponse({
      message: "Connection disconnected successfully",
      connectionId,
      reason: reason || "Administrative action",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    telemetry.logger.error("Force disconnect error", error);
    return errorResponse("Failed to disconnect connection", 500);
  }
};

// WebSocket performance optimization
export const optimizePerformance: RouteHandler = async (request, url) => {
  try {
    const { action } = await request.json();
    
    const results: any = {};
    
    switch (action) {
      case "cleanup_idle":
        // This would be handled by the service's cleanup process
        results.action = "Cleanup initiated for idle connections";
        break;
        
      case "balance_rooms":
        // Room balancing logic
        const rooms = WebSocketClusterService.getRooms();
        const oversizedRooms = rooms.filter(r => r.memberCount > 50);
        results.action = "Room balancing analysis completed";
        results.oversized_rooms = oversizedRooms.length;
        break;
        
      case "optimize_memory":
        // Memory optimization suggestions
        const metrics = WebSocketClusterService.getMetrics();
        results.action = "Memory optimization suggestions generated";
        results.current_usage = "Analysis not implemented in demo";
        break;
        
      default:
        return errorResponse("Unknown optimization action", 400);
    }
    
    return successResponse({
      optimization_results: results,
      timestamp: new Date().toISOString(),
      recommendations: [
        "Monitor connection idle times",
        "Implement room size limits", 
        "Use connection pooling for high load",
        "Consider horizontal scaling for >10k concurrent connections"
      ]
    });
    
  } catch (error) {
    telemetry.logger.error("Performance optimization error", error);
    return errorResponse("Failed to optimize performance", 500);
  }
};

// Helper functions

function generateClusterRecommendations(nodes: any[], metrics: any): string[] {
  const recommendations = [];
  
  if (nodes.length === 0) {
    recommendations.push("Consider enabling clustering for high availability");
  }
  
  const failedNodes = nodes.filter(n => n.health === 0);
  if (failedNodes.length > 0) {
    recommendations.push(`${failedNodes.length} node(s) have failed - investigate and restart`);
  }
  
  const highLoadNodes = nodes.filter(n => n.load > 80);
  if (highLoadNodes.length > 0) {
    recommendations.push("Some nodes are under high load - consider scaling up");
  }
  
  if (metrics.totalConnections > 500) {
    recommendations.push("High connection count - monitor performance metrics closely");
  }
  
  const averageLoad = nodes.length > 0 
    ? nodes.reduce((sum, n) => sum + n.load, 0) / nodes.length 
    : 0;
    
  if (averageLoad > 70) {
    recommendations.push("Average cluster load is high - consider adding more nodes");
  }
  
  return recommendations;
}