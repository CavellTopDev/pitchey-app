import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { users, messages, conversations, messageReadReceipts, conversationParticipants, typingIndicators } from "../../../src/db/schema.ts";
import { eq, and, desc, or, inArray, sql } from "drizzle-orm";
import { verifyToken, getUserFromToken } from "../../../utils/auth.ts";
import { setWebSocketConnection, removeWebSocketConnection, broadcastToUser } from "../../../utils/notifications.ts";

// Enhanced in-memory stores
const connections = new Map<number, Set<WebSocket>>();
const userSessions = new Map<WebSocket, { userId: number; username: string; userType: string; lastActivity: Date }>();
const conversationSubscriptions = new Map<number, Set<number>>(); // conversationId -> Set of userIds
const messageQueue = new Map<number, Array<any>>(); // userId -> queued messages for offline users

// Message types
interface WebSocketMessage {
  type: string;
  conversationId?: number;
  messageId?: number;
  content?: string;
  recipientId?: number;
  typingStatus?: boolean;
  attachments?: Array<{
    type: 'image' | 'document' | 'video' | 'audio';
    url: string;
    filename: string;
    size: number;
  }>;
  encrypted?: boolean;
  encryptionKey?: string;
  [key: string]: any;
}

interface ConnectedUser {
  id: number;
  username: string;
  userType: string;
  ws: WebSocket;
  lastActivity: Date;
}

// Enhanced cleanup with database persistence for typing indicators
setInterval(async () => {
  try {
    // Clean up expired typing indicators from database
    await db.delete(typingIndicators)
      .where(sql`${typingIndicators.updatedAt} < NOW() - INTERVAL '10 seconds'`);
    
    // Clean up stale user sessions
    const staleTime = new Date(Date.now() - 300000); // 5 minutes
    for (const [ws, session] of userSessions.entries()) {
      if (session.lastActivity < staleTime) {
        userSessions.delete(ws);
      }
    }
  } catch (error) {
    console.error('Error in cleanup interval:', error);
  }
}, 30000); // Run every 30 seconds

// Enhanced message delivery with offline queuing
function broadcastToUserEnhanced(userId: number, message: WebSocketMessage): boolean {
  const userConnections = connections.get(userId);
  let delivered = false;
  
  if (userConnections && userConnections.size > 0) {
    // Send to all user's active connections
    for (const ws of userConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          delivered = true;
        } catch (error) {
          console.error(`Failed to send message to user ${userId}:`, error);
          userConnections.delete(ws);
          userSessions.delete(ws);
        }
      } else {
        userConnections.delete(ws);
        userSessions.delete(ws);
      }
    }
    
    // Clean up empty connection sets
    if (userConnections.size === 0) {
      connections.delete(userId);
    }
  }
  
  // Queue message for offline users
  if (!delivered) {
    if (!messageQueue.has(userId)) {
      messageQueue.set(userId, []);
    }
    messageQueue.get(userId)!.push({
      ...message,
      queuedAt: new Date().toISOString(),
    });
    
    // Limit queue size to prevent memory bloat
    const queue = messageQueue.get(userId)!;
    if (queue.length > 100) {
      queue.splice(0, queue.length - 100);
    }
  }
  
  return delivered;
}

// Enhanced conversation broadcasting with subscription management
function broadcastToConversation(conversationId: number, message: WebSocketMessage, excludeUserId?: number) {
  const subscribers = conversationSubscriptions.get(conversationId);
  if (subscribers) {
    subscribers.forEach(userId => {
      if (excludeUserId && userId === excludeUserId) return;
      broadcastToUserEnhanced(userId, message);
    });
  } else {
    // Fallback to database lookup
    getConversationParticipants(conversationId).then(participants => {
      participants.forEach(userId => {
        if (excludeUserId && userId === excludeUserId) return;
        broadcastToUserEnhanced(userId, message);
      });
    }).catch(error => {
      console.error('Failed to get conversation participants:', error);
    });
  }
}

async function getConversationParticipants(conversationId: number): Promise<number[]> {
  try {
    const participants = await db.select({
      userId: conversationParticipants.userId,
    })
    .from(conversationParticipants)
    .where(and(
      eq(conversationParticipants.conversationId, conversationId),
      eq(conversationParticipants.isActive, true)
    ));

    return participants.map(p => p.userId);
  } catch (error) {
    console.error('Error getting conversation participants:', error);
    return [];
  }
}

// Subscribe user to conversation updates
async function subscribeToConversation(userId: number, conversationId: number) {
  if (!conversationSubscriptions.has(conversationId)) {
    conversationSubscriptions.set(conversationId, new Set());
  }
  conversationSubscriptions.get(conversationId)!.add(userId);
}

// Unsubscribe user from conversation updates
function unsubscribeFromConversation(userId: number, conversationId: number) {
  const subscribers = conversationSubscriptions.get(conversationId);
  if (subscribers) {
    subscribers.delete(userId);
    if (subscribers.size === 0) {
      conversationSubscriptions.delete(conversationId);
    }
  }
}

// Enhanced file attachment handling
async function processAttachments(attachments: any[], userId: number): Promise<any[]> {
  if (!attachments || attachments.length === 0) return [];
  
  const processedAttachments = [];
  for (const attachment of attachments) {
    // Basic validation
    if (!attachment.filename || !attachment.type || !attachment.size) {
      continue;
    }
    
    // File size limit (10MB)
    if (attachment.size > 10 * 1024 * 1024) {
      throw new Error(`File ${attachment.filename} exceeds 10MB limit`);
    }
    
    // Allowed file types
    const allowedTypes = ['image', 'document', 'video', 'audio'];
    if (!allowedTypes.includes(attachment.type)) {
      throw new Error(`File type ${attachment.type} not allowed`);
    }
    
    processedAttachments.push({
      type: attachment.type,
      url: attachment.url,
      filename: attachment.filename,
      size: attachment.size,
      mimeType: attachment.mimeType || 'application/octet-stream',
    });
  }
  
  return processedAttachments;
}

async function handleIncomingMessage(user: ConnectedUser, message: WebSocketMessage) {
  try {
    // Update last activity
    user.lastActivity = new Date();
    const session = userSessions.get(user.ws);
    if (session) {
      session.lastActivity = new Date();
    }

    switch (message.type) {
      case 'ping':
        user.ws.send(JSON.stringify({ 
          type: 'pong', 
          timestamp: new Date().toISOString(),
          userId: user.id 
        }));
        break;

      case 'send_message':
        await handleSendMessage(user, message);
        break;

      case 'typing_start':
      case 'typing_stop':
        await handleTypingIndicator(user, message);
        break;

      case 'mark_read':
        await handleMarkRead(user, message);
        break;

      case 'mark_conversation_read':
        await handleMarkConversationRead(user, message);
        break;

      case 'join_conversation':
        await handleJoinConversation(user, message);
        break;

      case 'leave_conversation':
        await handleLeaveConversation(user, message);
        break;

      case 'delete_message':
        await handleDeleteMessage(user, message);
        break;

      case 'edit_message':
        await handleEditMessage(user, message);
        break;

      case 'get_online_users':
        await handleGetOnlineUsers(user, message);
        break;

      case 'search_messages':
        await handleSearchMessages(user, message);
        break;

      case 'get_conversation_history':
        await handleGetConversationHistory(user, message);
        break;

      case 'block_user':
      case 'unblock_user':
        await handleBlockUser(user, message);
        break;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    console.error('Error handling WebSocket message:', error);
    user.ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process message',
      error: error.message,
      requestId: message.requestId,
    }));
  }
}

async function handleSendMessage(user: ConnectedUser, message: WebSocketMessage) {
  if (!message.conversationId || !message.content) {
    user.ws.send(JSON.stringify({
      type: 'error',
      message: 'Missing required fields for message',
      requestId: message.requestId,
    }));
    return;
  }

  try {
    // Process attachments if any
    const processedAttachments = await processAttachments(message.attachments || [], user.id);
    
    // Create the message in database
    const newMessage = await db.insert(messages).values({
      conversationId: message.conversationId,
      senderId: user.id,
      receiverId: message.recipientId || null,
      content: message.content,
      messageType: message.messageType || 'text',
      attachments: processedAttachments.length > 0 ? processedAttachments : null,
      pitchId: message.pitchId || null,
      subject: message.subject || null,
      sentAt: new Date(),
    }).returning();

    if (newMessage.length > 0) {
      const messageData = {
        type: 'new_message',
        messageId: newMessage[0].id,
        conversationId: message.conversationId,
        senderId: user.id,
        senderName: user.username,
        content: message.content,
        attachments: processedAttachments,
        messageType: message.messageType || 'text',
        timestamp: newMessage[0].sentAt.toISOString(),
        delivered: true,
        requestId: message.requestId,
      };

      // Send confirmation to sender
      user.ws.send(JSON.stringify({
        ...messageData,
        type: 'message_sent',
      }));

      // Broadcast to all conversation participants
      broadcastToConversation(message.conversationId, messageData, user.id);

      // Update conversation last message time
      await db.update(conversations)
        .set({ 
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, message.conversationId));

      // Create delivery receipts for all participants
      const participants = await getConversationParticipants(message.conversationId);
      const deliveryReceipts = participants
        .filter(participantId => participantId !== user.id)
        .map(participantId => ({
          messageId: newMessage[0].id,
          userId: participantId,
          deliveredAt: new Date(),
        }));

      if (deliveryReceipts.length > 0) {
        await db.insert(messageReadReceipts).values(deliveryReceipts);
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
    user.ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to send message',
      error: error.message,
      requestId: message.requestId,
    }));
  }
}

async function handleTypingIndicator(user: ConnectedUser, message: WebSocketMessage) {
  if (!message.conversationId) return;

  try {
    const isTyping = message.type === 'typing_start';
    
    if (isTyping) {
      // Update or insert typing indicator in database
      await db.insert(typingIndicators).values({
        conversationId: message.conversationId,
        userId: user.id,
        isTyping: true,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [typingIndicators.conversationId, typingIndicators.userId],
        set: {
          isTyping: true,
          updatedAt: new Date(),
        },
      });
    } else {
      // Remove typing indicator
      await db.delete(typingIndicators)
        .where(and(
          eq(typingIndicators.conversationId, message.conversationId),
          eq(typingIndicators.userId, user.id)
        ));
    }

    // Broadcast typing status to other conversation participants
    broadcastToConversation(message.conversationId, {
      type: 'user_typing',
      userId: user.id,
      username: user.username,
      conversationId: message.conversationId,
      isTyping,
      timestamp: new Date().toISOString(),
    }, user.id);
  } catch (error) {
    console.error('Error handling typing indicator:', error);
  }
}

async function handleMarkConversationRead(user: ConnectedUser, message: WebSocketMessage) {
  if (!message.conversationId) return;

  try {
    // Get all unread messages in the conversation for this user
    const unreadMessages = await db.select({
      id: messages.id,
    })
    .from(messages)
    .leftJoin(messageReadReceipts, and(
      eq(messages.id, messageReadReceipts.messageId),
      eq(messageReadReceipts.userId, user.id)
    ))
    .where(and(
      eq(messages.conversationId, message.conversationId),
      sql`${messages.senderId} != ${user.id}`,
      sql`${messageReadReceipts.readAt} IS NULL`
    ));

    if (unreadMessages.length > 0) {
      // Mark all messages as read
      await db.update(messageReadReceipts)
        .set({ readAt: new Date() })
        .where(and(
          inArray(messageReadReceipts.messageId, unreadMessages.map(m => m.id)),
          eq(messageReadReceipts.userId, user.id)
        ));

      // Notify other participants
      broadcastToConversation(message.conversationId, {
        type: 'conversation_read',
        conversationId: message.conversationId,
        userId: user.id,
        username: user.username,
        readCount: unreadMessages.length,
        timestamp: new Date().toISOString(),
      }, user.id);
    }

    user.ws.send(JSON.stringify({
      type: 'conversation_marked_read',
      conversationId: message.conversationId,
      markedCount: unreadMessages.length,
      requestId: message.requestId,
    }));
  } catch (error) {
    console.error('Error marking conversation as read:', error);
  }
}

async function handleDeleteMessage(user: ConnectedUser, message: WebSocketMessage) {
  if (!message.messageId) return;

  try {
    // Check if user owns the message
    const messageToDelete = await db.select({
      id: messages.id,
      senderId: messages.senderId,
      conversationId: messages.conversationId,
    })
    .from(messages)
    .where(eq(messages.id, message.messageId))
    .limit(1);

    if (messageToDelete.length === 0) {
      user.ws.send(JSON.stringify({
        type: 'error',
        message: 'Message not found',
        requestId: message.requestId,
      }));
      return;
    }

    if (messageToDelete[0].senderId !== user.id) {
      user.ws.send(JSON.stringify({
        type: 'error',
        message: 'You can only delete your own messages',
        requestId: message.requestId,
      }));
      return;
    }

    // Soft delete the message
    await db.update(messages)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        content: '[Message deleted]',
      })
      .where(eq(messages.id, message.messageId));

    // Broadcast deletion to conversation participants
    broadcastToConversation(messageToDelete[0].conversationId, {
      type: 'message_deleted',
      messageId: message.messageId,
      conversationId: messageToDelete[0].conversationId,
      deletedBy: user.id,
      timestamp: new Date().toISOString(),
    });

    user.ws.send(JSON.stringify({
      type: 'message_deleted_success',
      messageId: message.messageId,
      requestId: message.requestId,
    }));
  } catch (error) {
    console.error('Error deleting message:', error);
    user.ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to delete message',
      requestId: message.requestId,
    }));
  }
}

async function handleEditMessage(user: ConnectedUser, message: WebSocketMessage) {
  if (!message.messageId || !message.content) return;

  try {
    // Check if user owns the message
    const messageToEdit = await db.select({
      id: messages.id,
      senderId: messages.senderId,
      conversationId: messages.conversationId,
      sentAt: messages.sentAt,
    })
    .from(messages)
    .where(eq(messages.id, message.messageId))
    .limit(1);

    if (messageToEdit.length === 0) {
      user.ws.send(JSON.stringify({
        type: 'error',
        message: 'Message not found',
        requestId: message.requestId,
      }));
      return;
    }

    if (messageToEdit[0].senderId !== user.id) {
      user.ws.send(JSON.stringify({
        type: 'error',
        message: 'You can only edit your own messages',
        requestId: message.requestId,
      }));
      return;
    }

    // Check if message is too old to edit (15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (messageToEdit[0].sentAt < fifteenMinutesAgo) {
      user.ws.send(JSON.stringify({
        type: 'error',
        message: 'Message is too old to edit',
        requestId: message.requestId,
      }));
      return;
    }

    // Update the message
    await db.update(messages)
      .set({
        content: message.content,
        isEdited: true,
        editedAt: new Date(),
      })
      .where(eq(messages.id, message.messageId));

    // Broadcast edit to conversation participants
    broadcastToConversation(messageToEdit[0].conversationId, {
      type: 'message_edited',
      messageId: message.messageId,
      conversationId: messageToEdit[0].conversationId,
      newContent: message.content,
      editedBy: user.id,
      timestamp: new Date().toISOString(),
    });

    user.ws.send(JSON.stringify({
      type: 'message_edited_success',
      messageId: message.messageId,
      newContent: message.content,
      requestId: message.requestId,
    }));
  } catch (error) {
    console.error('Error editing message:', error);
    user.ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to edit message',
      requestId: message.requestId,
    }));
  }
}

async function handleMarkRead(user: ConnectedUser, message: WebSocketMessage) {
  if (!message.messageId) return;

  try {
    // Create read receipt
    await createReadReceipt(message.messageId, user.id);

    // Update message as read
    await db.update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(messages.id, message.messageId),
        eq(messages.receiverId, user.id)
      ));

    // Get the message to find the sender
    const messageData = await db.select({
      senderId: messages.senderId,
    })
    .from(messages)
    .where(eq(messages.id, message.messageId))
    .limit(1);

    if (messageData.length > 0) {
      // Notify sender that message was read
      broadcastToUser(messageData[0].senderId, {
        type: 'message_read',
        messageId: message.messageId,
        readBy: user.id,
        readByName: user.username,
        readAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error marking message as read:', error);
  }
}

async function handleJoinConversation(user: ConnectedUser, message: WebSocketMessage) {
  if (!message.conversationId) return;

  // Send recent messages from this conversation
  try {
    const recentMessages = await db.select({
      id: messages.id,
      senderId: messages.senderId,
      content: messages.content,
      sentAt: messages.sentAt,
      isRead: messages.isRead,
    })
    .from(messages)
    .where(or(
      and(
        eq(messages.senderId, user.id),
        eq(messages.receiverId, message.conversationId)
      ),
      and(
        eq(messages.senderId, message.conversationId),
        eq(messages.receiverId, user.id)
      )
    ))
    .orderBy(desc(messages.sentAt))
    .limit(50);

    user.ws.send(JSON.stringify({
      type: 'conversation_history',
      conversationId: message.conversationId,
      messages: recentMessages.reverse(),
    }));
  } catch (error) {
    console.error('Error getting conversation history:', error);
  }
}

async function handleGetOnlineUsers(user: ConnectedUser, message: WebSocketMessage) {
  const onlineUsers = Array.from(connections.keys())
    .filter(userId => userId !== user.id)
    .map(userId => {
      const status = userOnlineStatus.get(userId);
      return {
        userId,
        isOnline: true,
        lastSeen: status?.lastSeen || new Date(),
      };
    });

  user.ws.send(JSON.stringify({
    type: 'online_users',
    users: onlineUsers,
  }));
}

async function createDeliveryReceipt(messageId: number, userId: number) {
  try {
    await db.insert(messageReadReceipts).values({
      messageId,
      userId,
      deliveredAt: new Date(),
    });
  } catch (error) {
    console.error('Error creating delivery receipt:', error);
  }
}

async function createReadReceipt(messageId: number, userId: number) {
  try {
    await db.update(messageReadReceipts)
      .set({ readAt: new Date() })
      .where(and(
        eq(messageReadReceipts.messageId, messageId),
        eq(messageReadReceipts.userId, userId)
      ));
  } catch (error) {
    console.error('Error creating read receipt:', error);
  }
}

export const handler: Handlers = {
  async GET(req) {
    const upgrade = req.headers.get("upgrade") || "";
    if (upgrade.toLowerCase() !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }

    // Get token from URL params
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    
    if (!token) {
      return new Response("Missing authentication token", { status: 401 });
    }

    // Verify user
    const user = await getUserFromToken(token);
    if (!user) {
      return new Response("Invalid authentication token", { status: 401 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      console.log(`WebSocket connection opened for user ${user.username} (${user.id})`);
      
      // Store connection in both stores
      connections.set(user.id, socket);
      setWebSocketConnection(user.id, socket);
      userOnlineStatus.set(user.id, {
        lastSeen: new Date(),
        isOnline: true,
      });

      // Send welcome message
      socket.send(JSON.stringify({
        type: 'connected',
        userId: user.id,
        username: user.username,
        timestamp: new Date().toISOString(),
      }));

      // Broadcast user online status
      Array.from(connections.keys()).forEach(userId => {
        if (userId !== user.id) {
          broadcastToUser(userId, {
            type: 'user_online',
            userId: user.id,
            username: user.username,
          });
        }
      });
    };

    socket.onmessage = async (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        await handleIncomingMessage({
          id: user.id,
          username: user.username,
          userType: user.userType,
          ws: socket,
        }, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    };

    socket.onclose = () => {
      console.log(`WebSocket connection closed for user ${user.username} (${user.id})`);
      
      // Remove connection from both stores
      connections.delete(user.id);
      removeWebSocketConnection(user.id);
      
      // Update user status
      userOnlineStatus.set(user.id, {
        lastSeen: new Date(),
        isOnline: false,
      });

      // Clean up typing indicators
      for (const [key, status] of userTypingStatus.entries()) {
        if (status.userId === user.id) {
          userTypingStatus.delete(key);
          broadcastToConversation(status.conversationId, {
            type: 'user_typing',
            userId: user.id,
            isTyping: false,
          }, user.id);
        }
      }

      // Broadcast user offline status
      Array.from(connections.keys()).forEach(userId => {
        broadcastToUser(userId, {
          type: 'user_offline',
          userId: user.id,
          username: user.username,
          lastSeen: new Date().toISOString(),
        });
      });
    };

    socket.onerror = (error) => {
      console.error(`WebSocket error for user ${user.username}:`, error);
    };

    return response;
  },
};