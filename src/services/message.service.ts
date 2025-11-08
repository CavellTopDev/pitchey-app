import { db } from "../db/client.ts";
import { 
  messages, 
  conversations, 
  conversationParticipants, 
  messageReadReceipts,
  users,
  pitches 
} from "../db/schema.ts";
import { eq, and, or, desc, sql } from "npm:drizzle-orm@0.35.3";

export class MessageService {
  static async getUserMessages(userId: number) {
    try {
      const results = await db
        .select({
          message: messages,
          sender: {
            id: users.id,
            username: users.username,
            email: users.email,
            userType: users.userType,
            companyName: users.companyName,
          },
          conversation: conversations,
          pitch: {
            id: pitches.id,
            title: pitches.title,
            logline: pitches.logline,
          },
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .leftJoin(conversations, eq(messages.conversationId, conversations.id))
        .leftJoin(pitches, eq(messages.pitchId, pitches.id))
        .where(or(
          eq(messages.senderId, userId),
          eq(messages.receiverId, userId)
        ))
        .orderBy(desc(messages.sentAt))
        .limit(50);
      
      // Get receiver info separately for each message
      const userMessages = [];
      for (const row of results) {
        let receiver = null;
        if (row.message.receiverId) {
          const receiverResult = await db
            .select({
              id: users.id,
              username: users.username,
              email: users.email,
              userType: users.userType,
              companyName: users.companyName,
            })
            .from(users)
            .where(eq(users.id, row.message.receiverId))
            .limit(1);
          receiver = receiverResult[0] || null;
        }
        
        userMessages.push({
          ...row.message,
          sender: row.sender,
          receiver,
          conversation: row.conversation,
          pitch: row.pitch,
        });
      }

      return userMessages;
    } catch (error) {
      console.error("Error fetching user messages:", error);
      return [];
    }
  }

  static async getConversationMessages(conversationId: number, userId: number) {
    try {
      // First verify user has access to this conversation
      const participantResult = await db
        .select()
        .from(conversationParticipants)
        .where(and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        ))
        .limit(1);

      const participant = participantResult[0];

      if (!participant) {
        throw new Error("Access denied to conversation");
      }

      const results = await db
        .select({
          message: messages,
          sender: {
            id: users.id,
            username: users.username,
            email: users.email,
            userType: users.userType,
            companyName: users.companyName,
          },
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.sentAt));
      
      // Get read receipts for each message
      const conversationMessages = [];
      for (const row of results) {
        const readReceiptResults = await db
          .select()
          .from(messageReadReceipts)
          .where(eq(messageReadReceipts.messageId, row.message.id));
        
        conversationMessages.push({
          ...row.message,
          sender: row.sender,
          readReceipts: readReceiptResults,
        });
      }

      return conversationMessages;
    } catch (error) {
      console.error("Error fetching conversation messages:", error);
      throw error;
    }
  }

  static async getUserConversations(userId: number) {
    try {
      const results = await db
        .select({
          participant: conversationParticipants,
          conversation: conversations,
          createdBy: {
            id: users.id,
            username: users.username,
            email: users.email,
            userType: users.userType,
            companyName: users.companyName,
          },
          pitch: {
            id: pitches.id,
            title: pitches.title,
            logline: pitches.logline,
          },
        })
        .from(conversationParticipants)
        .leftJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
        .leftJoin(users, eq(conversations.createdById, users.id))
        .leftJoin(pitches, eq(conversations.pitchId, pitches.id))
        .where(eq(conversationParticipants.userId, userId))
        .orderBy(desc(conversationParticipants.id));
      
      // Get participants for each conversation
      const conversationsWithParticipants = [];
      for (const row of results) {
        if (!row.conversation) continue;
        
        const participantResults = await db
          .select({
            participant: conversationParticipants,
            user: {
              id: users.id,
              username: users.username,
              email: users.email,
              userType: users.userType,
              companyName: users.companyName,
            },
          })
          .from(conversationParticipants)
          .leftJoin(users, eq(conversationParticipants.userId, users.id))
          .where(eq(conversationParticipants.conversationId, row.conversation.id));
        
        const participants = participantResults.map(p => ({
          ...p.participant,
          user: p.user,
        }));
        
        conversationsWithParticipants.push({
          ...row.conversation,
          createdBy: row.createdBy,
          pitch: row.pitch,
          participants,
        });
      }

      return conversationsWithParticipants;
    } catch (error) {
      console.error("Error fetching user conversations:", error);
      return [];
    }
  }

  static async sendMessage(data: {
    senderId: number;
    receiverId?: number;
    conversationId?: number;
    pitchId?: number;
    content: string;
    subject?: string;
    messageType?: string;
  }) {
    try {
      let conversationId = data.conversationId;

      // If no conversation ID provided, create or find one
      if (!conversationId && data.receiverId) {
        // Try to find existing conversation between these users
        const existingConversationResults = await db
          .select({
            conversation: conversations,
          })
          .from(conversations)
          .where(and(
            eq(conversations.pitchId, data.pitchId || null),
            eq(conversations.createdById, data.senderId)
          ))
          .limit(1);
        
        let existingConversation = null;
        if (existingConversationResults.length > 0) {
          const conv = existingConversationResults[0].conversation;
          
          // Check if receiverId is a participant
          const participantCheck = await db
            .select()
            .from(conversationParticipants)
            .where(and(
              eq(conversationParticipants.conversationId, conv.id),
              eq(conversationParticipants.userId, data.receiverId!)
            ))
            .limit(1);
          
          if (participantCheck.length > 0) {
            existingConversation = { ...conv, participants: participantCheck };
          }
        }

        if (existingConversation && existingConversation.participants.length > 0) {
          conversationId = existingConversation.id;
        } else {
          // Create new conversation
          const [newConversation] = await db.insert(conversations)
            .values({
              createdById: data.senderId,
              pitchId: data.pitchId,
              title: data.subject || "New Message",
              lastMessageAt: new Date()
            })
            .returning();

          conversationId = newConversation.id;

          // Add participants
          await db.insert(conversationParticipants).values([
            { conversationId, userId: data.senderId },
            { conversationId, userId: data.receiverId! }
          ]);
        }
      }

      // Create the message
      const [message] = await db.insert(messages)
        .values({
          conversationId,
          senderId: data.senderId,
          receiverId: data.receiverId,
          pitchId: data.pitchId,
          content: data.content,
          subject: data.subject,
          messageType: data.messageType || "text"
        })
        .returning();

      // Update conversation last message time
      if (conversationId) {
        await db.update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, conversationId));
      }

      // Get full message with relations
      const fullMessageResults = await db
        .select({
          message: messages,
          sender: {
            id: users.id,
            username: users.username,
            email: users.email,
            userType: users.userType,
            companyName: users.companyName,
          },
          conversation: conversations,
          pitch: {
            id: pitches.id,
            title: pitches.title,
            logline: pitches.logline,
          },
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .leftJoin(conversations, eq(messages.conversationId, conversations.id))
        .leftJoin(pitches, eq(messages.pitchId, pitches.id))
        .where(eq(messages.id, message.id))
        .limit(1);
      
      if (!fullMessageResults.length) {
        return message;
      }
      
      const result = fullMessageResults[0];
      
      // Get receiver info separately
      let receiver = null;
      if (result.message.receiverId) {
        const receiverResult = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            userType: users.userType,
            companyName: users.companyName,
          })
          .from(users)
          .where(eq(users.id, result.message.receiverId))
          .limit(1);
        receiver = receiverResult[0] || null;
      }
      
      const fullMessage = {
        ...result.message,
        sender: result.sender,
        receiver,
        conversation: result.conversation,
        pitch: result.pitch,
      };

      return fullMessage;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  static async markMessageAsRead(messageId: number, userId: number) {
    try {
      // Update message as read if user is the receiver
      await db.update(messages)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(messages.id, messageId),
          eq(messages.receiverId, userId)
        ));

      // Create read receipt
      await db.insert(messageReadReceipts)
        .values({
          messageId,
          userId,
          readAt: new Date()
        })
        .onConflictDoUpdate({
          target: [messageReadReceipts.messageId, messageReadReceipts.userId],
          set: { readAt: new Date() }
        });

      return true;
    } catch (error) {
      console.error("Error marking message as read:", error);
      throw error;
    }
  }

  static async getUnreadCount(userId: number) {
    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(
          eq(messages.receiverId, userId),
          eq(messages.isRead, false)
        ));

      return result.count || 0;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }

  static async deleteMessage(messageId: number, userId: number) {
    try {
      // Soft delete - mark as deleted
      const [deletedMessage] = await db.update(messages)
        .set({ 
          isDeleted: true, 
          deletedAt: new Date() 
        })
        .where(and(
          eq(messages.id, messageId),
          eq(messages.senderId, userId) // Only sender can delete
        ))
        .returning();

      return deletedMessage;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }
}