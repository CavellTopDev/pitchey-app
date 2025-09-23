import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { messages, users, conversations, pitches, conversationParticipants } from "../../../src/db/schema.ts";
import { eq, and, or, like, desc, sql } from "drizzle-orm";
import { getUserFromToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req) {
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

      const url = new URL(req.url);
      const query = url.searchParams.get("q");
      const conversationId = url.searchParams.get("conversationId");
      const messageType = url.searchParams.get("messageType");
      const dateFrom = url.searchParams.get("dateFrom");
      const dateTo = url.searchParams.get("dateTo");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      if (!query || query.trim().length < 2) {
        return new Response(JSON.stringify({ error: "Search query must be at least 2 characters" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Build the search query
      let searchQuery = db.select({
        messageId: messages.id,
        conversationId: messages.conversationId,
        senderId: messages.senderId,
        senderName: users.username,
        senderCompany: users.companyName,
        receiverId: messages.receiverId,
        content: messages.content,
        subject: messages.subject,
        messageType: messages.messageType,
        attachments: messages.attachments,
        sentAt: messages.sentAt,
        isRead: messages.isRead,
        pitchId: messages.pitchId,
        pitchTitle: pitches.title,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .leftJoin(pitches, eq(messages.pitchId, pitches.id))
      .leftJoin(conversationParticipants, eq(messages.conversationId, conversationParticipants.conversationId));

      // Build where conditions
      const conditions = [
        // User must be participant in the conversation
        eq(conversationParticipants.userId, user.id),
        eq(conversationParticipants.isActive, true),
        // Message must not be deleted
        eq(messages.isDeleted, false),
        // Text search in content and subject
        or(
          like(messages.content, `%${query}%`),
          like(messages.subject, `%${query}%`)
        ),
      ];

      // Add optional filters
      if (conversationId) {
        conditions.push(eq(messages.conversationId, parseInt(conversationId)));
      }

      if (messageType) {
        conditions.push(eq(messages.messageType, messageType));
      }

      if (dateFrom) {
        conditions.push(sql`${messages.sentAt} >= ${new Date(dateFrom)}`);
      }

      if (dateTo) {
        conditions.push(sql`${messages.sentAt} <= ${new Date(dateTo)}`);
      }

      // Execute search query
      const searchResults = await searchQuery
        .where(and(...conditions))
        .orderBy(desc(messages.sentAt))
        .limit(Math.min(limit, 100)) // Cap at 100 results
        .offset(offset);

      // Get total count for pagination
      const countQuery = await db.select({
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .leftJoin(conversationParticipants, eq(messages.conversationId, conversationParticipants.conversationId))
      .where(and(...conditions));

      const totalCount = countQuery[0]?.count || 0;

      // Group results by conversation for better organization
      const resultsByConversation = new Map();
      for (const result of searchResults) {
        const convId = result.conversationId || 'direct';
        if (!resultsByConversation.has(convId)) {
          resultsByConversation.set(convId, []);
        }
        resultsByConversation.get(convId).push({
          id: result.messageId,
          senderId: result.senderId,
          senderName: result.senderCompany || result.senderName,
          content: result.content,
          subject: result.subject,
          messageType: result.messageType,
          attachments: result.attachments,
          sentAt: result.sentAt,
          isRead: result.isRead,
          pitchId: result.pitchId,
          pitchTitle: result.pitchTitle,
          // Highlight search terms (basic implementation)
          contentHighlight: highlightSearchTerms(result.content, query),
          subjectHighlight: result.subject ? highlightSearchTerms(result.subject, query) : null,
        });
      }

      // Convert to array format
      const organizedResults = Array.from(resultsByConversation.entries()).map(([conversationId, messages]) => ({
        conversationId: conversationId === 'direct' ? null : parseInt(conversationId),
        messageCount: messages.length,
        messages,
      }));

      return new Response(JSON.stringify({
        success: true,
        query,
        totalCount,
        resultCount: searchResults.length,
        hasMore: offset + searchResults.length < totalCount,
        nextOffset: offset + searchResults.length,
        conversations: organizedResults,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error searching messages:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// Simple search term highlighting
function highlightSearchTerms(text: string, searchTerm: string): string {
  if (!text || !searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}