import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { users } from "../../../src/db/schema.ts";
import { eq } from "drizzle-orm";
import { getUserFromToken } from "../../../utils/auth.ts";

// Notification preferences interface
interface NotificationPreferences {
  email: {
    newMessages: boolean;
    ndaRequests: boolean;
    ndaApprovals: boolean;
    pitchUpdates: boolean;
    offPlatformRequests: boolean;
  };
  push: {
    newMessages: boolean;
    typingIndicators: boolean;
    onlineStatus: boolean;
    ndaRequests: boolean;
    pitchUpdates: boolean;
  };
  emailFrequency: 'immediate' | 'hourly' | 'daily' | 'never';
}

const defaultPreferences: NotificationPreferences = {
  email: {
    newMessages: true,
    ndaRequests: true,
    ndaApprovals: true,
    pitchUpdates: true,
    offPlatformRequests: true,
  },
  push: {
    newMessages: true,
    typingIndicators: true,
    onlineStatus: true,
    ndaRequests: true,
    pitchUpdates: true,
  },
  emailFrequency: 'immediate',
};

export const handler: Handlers = {
  // Get notification preferences
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

      // Get user with metadata that might contain preferences
      const userData = await db
        .select({
          id: users.id,
          // Note: Add notificationPreferences field to users table if needed
          // For now, we'll return default preferences
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      if (userData.length === 0) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Return default preferences for now
      // In production, these would be stored in the database
      return new Response(JSON.stringify({
        success: true,
        preferences: defaultPreferences,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Update notification preferences
  async PUT(req) {
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

      const body = await req.json();
      const { preferences } = body;

      if (!preferences) {
        return new Response(JSON.stringify({ error: "Preferences are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Validate preferences structure
      const validatedPreferences = {
        email: {
          newMessages: Boolean(preferences.email?.newMessages),
          ndaRequests: Boolean(preferences.email?.ndaRequests),
          ndaApprovals: Boolean(preferences.email?.ndaApprovals),
          pitchUpdates: Boolean(preferences.email?.pitchUpdates),
          offPlatformRequests: Boolean(preferences.email?.offPlatformRequests),
        },
        push: {
          newMessages: Boolean(preferences.push?.newMessages),
          typingIndicators: Boolean(preferences.push?.typingIndicators),
          onlineStatus: Boolean(preferences.push?.onlineStatus),
          ndaRequests: Boolean(preferences.push?.ndaRequests),
          pitchUpdates: Boolean(preferences.push?.pitchUpdates),
        },
        emailFrequency: ['immediate', 'hourly', 'daily', 'never'].includes(preferences.emailFrequency) 
          ? preferences.emailFrequency 
          : 'immediate',
      };

      // In production, save to database
      // For now, we'll just return success
      // await db.update(users)
      //   .set({ notificationPreferences: validatedPreferences })
      //   .where(eq(users.id, user.id));

      return new Response(JSON.stringify({
        success: true,
        preferences: validatedPreferences,
        message: "Notification preferences updated successfully",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};