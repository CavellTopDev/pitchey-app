import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { notifications } from "../../../src/db/schema.ts";
import { eq, desc, and } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

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

      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const url = new URL(req.url);
      const unreadOnly = url.searchParams.get("unread") === "true";
      const limit = parseInt(url.searchParams.get("limit") || "50");

      // Build query
      let query = db.select().from(notifications);
      
      if (unreadOnly) {
        query = query.where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ));
      } else {
        query = query.where(eq(notifications.userId, userId));
      }

      const userNotifications = await query
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      // Get unread count
      const unreadCount = await db.select().from(notifications)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        ));

      return new Response(JSON.stringify({
        success: true,
        notifications: userNotifications,
        unreadCount: unreadCount.length,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};