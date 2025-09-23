import { Handlers } from "$fresh/server.ts";
import { SearchService } from "../../../src/services/search.service.ts";

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);

      const popularSearches = await SearchService.getPopularSearches(limit);

      return new Response(JSON.stringify({
        success: true,
        popularSearches,
      }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=1800", // Cache for 30 minutes
        },
      });
    } catch (error) {
      console.error("Error getting popular searches:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to get popular searches" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};