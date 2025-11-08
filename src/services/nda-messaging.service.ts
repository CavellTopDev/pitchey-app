import { db } from "../db/client.ts";
import { ndas, ndaRequests, messages, conversations, conversationParticipants, pitches, users } from "../db/schema.ts";
import { eq, and, or } from "npm:drizzle-orm@0.35.3";

export class NDAMessagingService {
  /**
   * Check if two users can communicate about a specific pitch
   */
  static async canUsersMessage(senderId: number, receiverId: number, pitchId?: number): Promise<{
    canMessage: boolean;
    reason?: string;
    requiresNDA: boolean;
  }> {
    try {
      // If no pitch is involved, users can always message (general conversation)
      if (!pitchId) {
        return { canMessage: true, requiresNDA: false };
      }

      // Get pitch details
      const pitch = await db.select({
        id: pitches.id,
        userId: pitches.userId,
        status: pitches.status,
      })
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

      if (pitch.length === 0) {
        return { 
          canMessage: false, 
          reason: "Pitch not found",
          requiresNDA: false 
        };
      }

      // If sender is the pitch owner, they can always message about their pitch
      if (pitch[0].userId === senderId) {
        return { canMessage: true, requiresNDA: false };
      }

      // Check if sender has valid NDA for this pitch
      const senderNDA = await db.select({
        id: ndas.id,
        accessGranted: ndas.accessGranted,
        expiresAt: ndas.expiresAt,
      })
      .from(ndas)
      .where(and(
        eq(ndas.pitchId, pitchId),
        eq(ndas.signerId, senderId),
        eq(ndas.accessGranted, true)
      ))
      .limit(1);

      if (senderNDA.length === 0) {
        return {
          canMessage: false,
          reason: "You need to sign an NDA to message about this pitch",
          requiresNDA: true
        };
      }

      // Check if NDA has expired
      const nda = senderNDA[0];
      if (nda.expiresAt && new Date() > nda.expiresAt) {
        return {
          canMessage: false,
          reason: "Your NDA for this pitch has expired",
          requiresNDA: true
        };
      }

      return { canMessage: true, requiresNDA: false };
    } catch (error) {
      console.error("Error checking message permissions:", error);
      return {
        canMessage: false,
        reason: "Error checking permissions",
        requiresNDA: false
      };
    }
  }

  /**
   * Create or get conversation between users for a pitch
   */
  static async getOrCreatePitchConversation(
    userId1: number,
    userId2: number,
    pitchId: number
  ): Promise<{
    conversation: any;
    created: boolean;
  }> {
    try {
      // Look for existing conversation between these users for this pitch
      const existingConversation = await db.select({
        id: conversations.id,
        title: conversations.title,
        pitchId: conversations.pitchId,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
      .where(and(
        eq(conversations.pitchId, pitchId),
        eq(conversationParticipants.userId, userId1)
      ))
      .limit(1);

      // Check if user2 is also in this conversation
      if (existingConversation.length > 0) {
        const user2InConversation = await db.select({
          id: conversationParticipants.id,
        })
        .from(conversationParticipants)
        .where(and(
          eq(conversationParticipants.conversationId, existingConversation[0].id),
          eq(conversationParticipants.userId, userId2),
          eq(conversationParticipants.isActive, true)
        ))
        .limit(1);

        if (user2InConversation.length > 0) {
          return {
            conversation: existingConversation[0],
            created: false
          };
        }
      }

      // Get pitch details for conversation title
      const pitch = await db.select({
        title: pitches.title,
      })
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

      const pitchTitle = pitch[0]?.title || "Unknown Pitch";

      // Create new conversation
      const newConversation = await db.insert(conversations).values({
        pitchId,
        createdById: userId1,
        title: `Discussion about "${pitchTitle}"`,
        lastMessageAt: new Date(),
      }).returning();

      // Add participants
      await db.insert(conversationParticipants).values([
        {
          conversationId: newConversation[0].id,
          userId: userId1,
        },
        {
          conversationId: newConversation[0].id,
          userId: userId2,
        }
      ]);

      return {
        conversation: newConversation[0],
        created: true
      };
    } catch (error) {
      console.error("Error creating pitch conversation:", error);
      throw new Error("Failed to create conversation");
    }
  }

  /**
   * Get all conversations for a user with NDA status
   */
  static async getUserConversationsWithNDAStatus(userId: number) {
    try {
      const conversations = await db.select({
        conversationId: conversations.id,
        title: conversations.title,
        pitchId: conversations.pitchId,
        pitchTitle: pitches.title,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        hasValidNDA: ndas.accessGranted,
        ndaExpiresAt: ndas.expiresAt,
      })
      .from(conversations)
      .innerJoin(
        conversationParticipants,
        eq(conversations.id, conversationParticipants.conversationId)
      )
      .leftJoin(pitches, eq(conversations.pitchId, pitches.id))
      .leftJoin(ndas, and(
        eq(ndas.pitchId, conversations.pitchId),
        eq(ndas.signerId, userId),
        eq(ndas.accessGranted, true)
      ))
      .where(and(
        eq(conversationParticipants.userId, userId),
        eq(conversationParticipants.isActive, true)
      ));

      return conversations.map(conv => ({
        ...conv,
        ndaRequired: !!conv.pitchId,
        canMessage: !conv.pitchId || conv.hasValidNDA,
        ndaExpired: conv.ndaExpiresAt ? new Date() > conv.ndaExpiresAt : false,
      }));
    } catch (error) {
      console.error("Error getting user conversations with NDA status:", error);
      throw new Error("Failed to get conversations");
    }
  }

  /**
   * Send a message with NDA validation
   */
  static async sendMessage(
    senderId: number,
    receiverId: number,
    content: string,
    options: {
      pitchId?: number;
      conversationId?: number;
      subject?: string;
      attachments?: any[];
      messageType?: string;
    } = {}
  ) {
    try {
      // Check if users can message about this pitch
      const permission = await this.canUsersMessage(senderId, receiverId, options.pitchId);
      
      if (!permission.canMessage) {
        throw new Error(permission.reason || "You cannot send messages about this pitch");
      }

      let conversationId = options.conversationId;

      // Create or get conversation if pitchId is provided
      if (options.pitchId && !conversationId) {
        const convResult = await this.getOrCreatePitchConversation(
          senderId,
          receiverId,
          options.pitchId
        );
        conversationId = convResult.conversation.id;
      }

      // Create the message
      const newMessage = await db.insert(messages).values({
        conversationId,
        pitchId: options.pitchId || null,
        senderId,
        receiverId,
        content,
        subject: options.subject || null,
        messageType: options.messageType || 'text',
        attachments: options.attachments || null,
        sentAt: new Date(),
      }).returning();

      // Update conversation last message time
      if (conversationId) {
        await db.update(conversations)
          .set({ 
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, conversationId));
      }

      return {
        message: newMessage[0],
        conversationId,
        ndaRequired: permission.requiresNDA,
      };
    } catch (error) {
      console.error("Error sending message with NDA validation:", error);
      throw error;
    }
  }

  /**
   * Request NDA access to message about a pitch
   */
  static async requestNDAAccess(
    requesterId: number,
    pitchId: number,
    message?: string
  ) {
    try {
      // Get pitch owner
      const pitch = await db.select({
        id: pitches.id,
        userId: pitches.userId,
        title: pitches.title,
      })
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

      if (pitch.length === 0) {
        throw new Error("Pitch not found");
      }

      // Check if request already exists
      const existingRequest = await db.select({
        id: ndaRequests.id,
        status: ndaRequests.status,
      })
      .from(ndaRequests)
      .where(and(
        eq(ndaRequests.pitchId, pitchId),
        eq(ndaRequests.requesterId, requesterId)
      ))
      .limit(1);

      if (existingRequest.length > 0) {
        if (existingRequest[0].status === 'pending') {
          throw new Error("NDA request already pending");
        }
        if (existingRequest[0].status === 'approved') {
          throw new Error("NDA already approved");
        }
      }

      // Get requester info
      const requester = await db.select({
        companyName: users.companyName,
        userType: users.userType,
      })
      .from(users)
      .where(eq(users.id, requesterId))
      .limit(1);

      // Create NDA request
      const ndaRequest = await db.insert(ndaRequests).values({
        pitchId,
        requesterId,
        ownerId: pitch[0].userId,
        ndaType: 'basic',
        requestMessage: message || `${requester[0]?.companyName || 'User'} would like to access your pitch "${pitch[0].title}" for messaging purposes.`,
        status: 'pending',
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }).returning();

      return {
        request: ndaRequest[0],
        pitchTitle: pitch[0].title,
        ownerUserId: pitch[0].userId,
      };
    } catch (error) {
      console.error("Error requesting NDA access:", error);
      throw error;
    }
  }

  /**
   * Check if a conversation requires NDA and user has access
   */
  static async validateConversationAccess(userId: number, conversationId: number) {
    try {
      const conversation = await db.select({
        id: conversations.id,
        pitchId: conversations.pitchId,
        title: conversations.title,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

      if (conversation.length === 0) {
        return { hasAccess: false, reason: "Conversation not found" };
      }

      // Check if user is participant
      const participation = await db.select({
        id: conversationParticipants.id,
        isActive: conversationParticipants.isActive,
      })
      .from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ))
      .limit(1);

      if (participation.length === 0 || !participation[0].isActive) {
        return { hasAccess: false, reason: "You are not a participant in this conversation" };
      }

      // If no pitch involved, access is granted
      if (!conversation[0].pitchId) {
        return { hasAccess: true };
      }

      // Check NDA access for pitch
      const permission = await this.canUsersMessage(userId, 0, conversation[0].pitchId);
      
      return {
        hasAccess: permission.canMessage,
        reason: permission.reason,
        requiresNDA: permission.requiresNDA,
        pitchId: conversation[0].pitchId,
      };
    } catch (error) {
      console.error("Error validating conversation access:", error);
      return { hasAccess: false, reason: "Error validating access" };
    }
  }

  /**
   * Get pitch-related conversations for analytics
   */
  static async getPitchConversationStats(pitchId: number) {
    try {
      const stats = await db.select({
        conversationCount: conversations.id,
        messageCount: messages.id,
        uniqueParticipants: conversationParticipants.userId,
      })
      .from(conversations)
      .leftJoin(messages, eq(conversations.id, messages.conversationId))
      .leftJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
      .where(eq(conversations.pitchId, pitchId));

      const conversationCount = new Set(stats.map(s => s.conversationCount)).size;
      const messageCount = stats.filter(s => s.messageCount).length;
      const uniqueParticipants = new Set(stats.map(s => s.uniqueParticipants)).size;

      return {
        conversationCount,
        messageCount,
        uniqueParticipants,
      };
    } catch (error) {
      console.error("Error getting pitch conversation stats:", error);
      return {
        conversationCount: 0,
        messageCount: 0,
        uniqueParticipants: 0,
      };
    }
  }
}