import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { users } from "../../../src/db/schema.ts";
import { eq, inArray } from "drizzle-orm";
import { getUserFromToken } from "../../../utils/auth.ts";

// For now, we'll create a simple blocked users table structure in memory
// In a production app, you'd want a proper database table for this
const blockedUsers = new Map<number, Set<number>>(); // userId -> Set of blocked userIds

export const handler: Handlers = {
  async POST(req) {
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
      const { targetUserId, action } = body; // action: 'block' or 'unblock'

      if (!targetUserId || !action) {
        return new Response(JSON.stringify({ error: "targetUserId and action are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (targetUserId === user.id) {
        return new Response(JSON.stringify({ error: "Cannot block yourself" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify target user exists
      const targetUser = await db.select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

      if (targetUser.length === 0) {
        return new Response(JSON.stringify({ error: "Target user not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!blockedUsers.has(user.id)) {
        blockedUsers.set(user.id, new Set());
      }

      const userBlockedSet = blockedUsers.get(user.id)!;

      if (action === 'block') {
        userBlockedSet.add(targetUserId);
        
        return new Response(JSON.stringify({
          success: true,
          action: 'blocked',
          targetUserId,
          targetUsername: targetUser[0].username,
          message: `Successfully blocked ${targetUser[0].username}`,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      } else if (action === 'unblock') {
        userBlockedSet.delete(targetUserId);
        
        return new Response(JSON.stringify({
          success: true,
          action: 'unblocked',
          targetUserId,
          targetUsername: targetUser[0].username,
          message: `Successfully unblocked ${targetUser[0].username}`,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      } else {
        return new Response(JSON.stringify({ error: "Invalid action. Use 'block' or 'unblock'" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (error) {
      console.error("Error blocking/unblocking user:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

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

      const blockedUserIds = Array.from(blockedUsers.get(user.id) || []);
      
      // Get user details for blocked users
      let blockedUserDetails = [];
      if (blockedUserIds.length > 0) {
        blockedUserDetails = await db.select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          companyName: users.companyName,
          userType: users.userType,
        })
        .from(users)
        .where(inArray(users.id, blockedUserIds));
      }

      return new Response(JSON.stringify({
        success: true,
        blockedUsers: blockedUserDetails.map(user => ({
          id: user.id,
          username: user.username,
          name: user.companyName || `${user.firstName} ${user.lastName}`.trim() || user.username,
          userType: user.userType,
        })),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// Helper function to check if a user is blocked
export function isUserBlocked(userId: number, targetUserId: number): boolean {
  const blockedSet = blockedUsers.get(userId);
  return blockedSet ? blockedSet.has(targetUserId) : false;
}

// Helper function to get all blocked users for a user
export function getBlockedUsers(userId: number): number[] {
  return Array.from(blockedUsers.get(userId) || []);
}