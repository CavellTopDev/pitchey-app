import { Handlers } from "$fresh/server.ts";
import { SearchService } from "../../../src/services/search.service.ts";
import { searchCache } from "../../../src/services/search-cache.service.ts";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  // Cache management endpoint
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
      const { action, pattern } = body;

      let result;

      switch (action) {
        case "warm-up":
          await SearchService.warmUpCache();
          result = { message: "Cache warm-up initiated" };
          break;

        case "precompute":
          await SearchService.precomputePopularSearches();
          result = { message: "Popular searches precomputation initiated" };
          break;

        case "clear":
          await SearchService.invalidateSearchCache(pattern);
          result = { message: pattern ? `Cache cleared for pattern: ${pattern}` : "All cache cleared" };
          break;

        case "stats":
          result = SearchService.getCacheStats();
          break;

        default:
          return new Response(JSON.stringify({ 
            error: "Invalid action. Supported actions: warm-up, precompute, clear, stats" 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
      }

      return new Response(JSON.stringify({
        success: true,
        action,
        result,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error managing search cache:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to manage search cache" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Get cache statistics
  async GET(req) {
    try {
      const stats = SearchService.getCacheStats();

      return new Response(JSON.stringify({
        success: true,
        stats,
      }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to get cache stats" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};