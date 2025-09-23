import { db } from "../db/client.ts";
import { 
  messages, 
  conversations, 
  conversationParticipants, 
  messageReadReceipts,
  users,
  pitches 
} from "../db/schema.ts";
import { eq, and, or, desc, sql } from "npm:drizzle-orm";

export class MessageService {
  static async getUserMessages(userId: number) {
    try {
      const userMessages = await db.query.messages.findMany({
        where: or(
          eq(messages.senderId, userId),
          eq(messages.receiverId, userId)
        ),
        with: {
          sender: {
            columns: {
              id: true,
              username: true,
              email: true,
              userType: true,
              companyName: true
            }
          },
          receiver: {
            columns: {
              id: true,
              username: true,
              email: true,
              userType: true,
              companyName: true
            }
          },
          conversation: true,
          pitch: {
            columns: {
              id: true,
              title: true,
              logline: true
            }
          }
        },
        orderBy: desc(messages.sentAt),
        limit: 50
      });

      return userMessages;
    } catch (error) {
      console.error("Error fetching user messages:", error);
      return [];
    }
  }

  static async getConversationMessages(conversationId: number, userId: number) {
    try {
      // First verify user has access to this conversation
      const participant = await db.query.conversationParticipants.findFirst({
        where: and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      });

      if (!participant) {
        throw new Error("Access denied to conversation");
      }

      const conversationMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        with: {
          sender: {
            columns: {
              id: true,
              username: true,
              email: true,
              userType: true,
              companyName: true
            }
          },
          readReceipts: true
        },
        orderBy: desc(messages.sentAt)
      });

      return conversationMessages;
    } catch (error) {
      console.error("Error fetching conversation messages:", error);
      throw error;
    }
  }

  static async getUserConversations(userId: number) {
    try {
      const userConversations = await db.query.conversationParticipants.findMany({
        where: eq(conversationParticipants.userId, userId),
        with: {
          conversation: {
            with: {
              createdBy: {
                columns: {
                  id: true,
                  username: true,
                  email: true,
                  userType: true,
                  companyName: true
                }
              },
              pitch: {
                columns: {
                  id: true,
                  title: true,
                  logline: true
                }
              },
              participants: {
                with: {
                  user: {
                    columns: {
                      id: true,
                      username: true,
                      email: true,
                      userType: true,
                      companyName: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: desc(conversationParticipants.id)
      });

      return userConversations.map(cp => cp.conversation);
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
        const existingConversation = await db.query.conversations.findFirst({
          where: and(
            eq(conversations.pitchId, data.pitchId || null),
            eq(conversations.createdById, data.senderId)
          ),
          with: {
            participants: {
              where: eq(conversationParticipants.userId, data.receiverId)
            }
          }
        });

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
      const fullMessage = await db.query.messages.findFirst({
        where: eq(messages.id, message.id),
        with: {
          sender: {
            columns: {
              id: true,
              username: true,
              email: true,
              userType: true,
              companyName: true
            }
          },
          receiver: {
            columns: {
              id: true,
              username: true,
              email: true,
              userType: true,
              companyName: true
            }
          },
          conversation: true,
          pitch: {
            columns: {
              id: true,
              title: true,
              logline: true
            }
          }
        }
      });

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