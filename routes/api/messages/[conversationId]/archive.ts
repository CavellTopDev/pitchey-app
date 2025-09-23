import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { conversationParticipants, conversations } from "../../../../src/db/schema.ts";
import { eq, and, desc } from "drizzle-orm";
import { getUserFromToken } from "../../../../utils/auth.ts";

export const handler: Handlers = {
  async POST(req, ctx) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await getUserFromToken(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const conversationId = parseInt(ctx.params.conversationId);
      if (isNaN(conversationId)) {
        return new Response(JSON.stringify({ error: "Invalid conversation ID" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { action } = body; // 'archive' or 'unarchive'

      if (!action || !['archive', 'unarchive'].includes(action)) {
        return new Response(JSON.stringify({ error: "Invalid action. Use 'archive' or 'unarchive'" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if user is participant in the conversation
      const participation = await db.select({
        id: conversationParticipants.id,
        isActive: conversationParticipants.isActive,
      })
      .from(conversationParticipants)
      .where(and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, user.id)
      ))
      .limit(1);

      if (participation.length === 0) {
        return new Response(JSON.stringify({ error: "You are not a participant in this conversation" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!participation[0].isActive && action === 'archive') {
        return new Response(JSON.stringify({ error: "Conversation is already archived for you" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (participation[0].isActive && action === 'unarchive') {
        return new Response(JSON.stringify({ error: "Conversation is not archived" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Update participant status
      const isActive = action === 'unarchive';
      await db.update(conversationParticipants)
        .set({
          isActive,
          leftAt: action === 'archive' ? new Date() : null,
        })
        .where(and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, user.id)
        ));

      // Get conversation details for response
      const conversation = await db.select({
        id: conversations.id,
        title: conversations.title,
        pitchId: conversations.pitchId,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

      return new Response(JSON.stringify({
        success: true,
        action,
        conversationId,
        conversation: conversation[0] || null,
        message: `Conversation ${action}d successfully`,
        archivedAt: action === 'archive' ? new Date().toISOString() : null,
        restoredAt: action === 'unarchive' ? new Date().toISOString() : null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error archiving/unarchiving conversation:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  async GET(req, ctx) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await getUserFromToken(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get all archived conversations for the user
      const archivedConversations = await db.select({
        conversationId: conversations.id,
        title: conversations.title,
        pitchId: conversations.pitchId,
        lastMessageAt: conversations.lastMessageAt,
        leftAt: conversationParticipants.leftAt,
      })
      .from(conversations)
      .innerJoin(conversationParticipants, eq(conversations.id, conversationParticipants.conversationId))
      .where(and(
        eq(conversationParticipants.userId, user.id),
        eq(conversationParticipants.isActive, false)
      ))
      .orderBy(desc(conversationParticipants.leftAt));

      return new Response(JSON.stringify({
        success: true,
        archivedConversations: archivedConversations.map(conv => ({
          id: conv.conversationId,
          title: conv.title,
          pitchId: conv.pitchId,
          lastMessageAt: conv.lastMessageAt,
          archivedAt: conv.leftAt,
        })),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching archived conversations:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};