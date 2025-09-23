import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { savedSearches } from "../../../../src/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

export const handler: Handlers = {
  // Update a saved search
  async PUT(req, ctx) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
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

      const searchId = parseInt(ctx.params.id);
      if (isNaN(searchId)) {
        return new Response(JSON.stringify({ error: "Invalid search ID" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { name, description, filters, isPublic, notifyOnResults } = body;

      const updatedSearch = await db.update(savedSearches)
        .set({
          name,
          description,
          filters,
          isPublic,
          notifyOnResults,
          updatedAt: new Date(),
        })
        .where(and(
          eq(savedSearches.id, searchId),
          eq(savedSearches.userId, userId)
        ))
        .returning();

      if (updatedSearch.length === 0) {
        return new Response(JSON.stringify({ error: "Search not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        savedSearch: updatedSearch[0],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error updating saved search:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to update saved search" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Delete a saved search
  async DELETE(req, ctx) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
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

      const searchId = parseInt(ctx.params.id);
      if (isNaN(searchId)) {
        return new Response(JSON.stringify({ error: "Invalid search ID" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const deletedSearch = await db.delete(savedSearches)
        .where(and(
          eq(savedSearches.id, searchId),
          eq(savedSearches.userId, userId)
        ))
        .returning();

      if (deletedSearch.length === 0) {
        return new Response(JSON.stringify({ error: "Search not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Search deleted successfully",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error deleting saved search:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to delete saved search" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Use a saved search (updates lastUsed and useCount)
  async POST(req, ctx) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
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

      const searchId = parseInt(ctx.params.id);
      if (isNaN(searchId)) {
        return new Response(JSON.stringify({ error: "Invalid search ID" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get the saved search
      const search = await db.select()
        .from(savedSearches)
        .where(and(
          eq(savedSearches.id, searchId),
          eq(savedSearches.userId, userId)
        ))
        .limit(1);

      if (search.length === 0) {
        return new Response(JSON.stringify({ error: "Search not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Update usage stats
      await db.update(savedSearches)
        .set({
          useCount: search[0].useCount + 1,
          lastUsed: new Date(),
        })
        .where(eq(savedSearches.id, searchId));

      return new Response(JSON.stringify({
        success: true,
        filters: search[0].filters,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error using saved search:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to use saved search" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};