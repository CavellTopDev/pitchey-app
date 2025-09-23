import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { savedSearches } from "../../../src/db/schema.ts";
import { eq, desc } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  // Get user's saved searches
  async GET(req) {
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

      const searches = await db.select()
        .from(savedSearches)
        .where(eq(savedSearches.userId, userId))
        .orderBy(desc(savedSearches.lastUsed), desc(savedSearches.createdAt));

      return new Response(JSON.stringify({
        success: true,
        savedSearches: searches,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error getting saved searches:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to get saved searches" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Save a new search
  async POST(req) {
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

      const body = await req.json();
      const { name, description, filters, isPublic = false, notifyOnResults = false } = body;

      if (!name || !filters) {
        return new Response(JSON.stringify({ 
          error: "Name and filters are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const savedSearch = await db.insert(savedSearches).values({
        userId,
        name,
        description,
        filters,
        isPublic,
        notifyOnResults,
      }).returning();

      return new Response(JSON.stringify({
        success: true,
        savedSearch: savedSearch[0],
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error saving search:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to save search" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};