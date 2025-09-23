import { Handlers } from "$fresh/server.ts";
import { SearchService } from "../../../src/services/search.service.ts";

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const query = url.searchParams.get("q") || "";
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);

      if (query.length < 2) {
        return new Response(JSON.stringify({
          success: true,
          suggestions: [],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const suggestions = await SearchService.getSearchSuggestions(query, limit);

      return new Response(JSON.stringify({
        success: true,
        suggestions,
      }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        },
      });
    } catch (error) {
      console.error("Error getting search suggestions:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to get search suggestions" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};