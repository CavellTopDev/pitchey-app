import { Handlers } from "$fresh/server.ts";
import { SearchService } from "../../../src/services/search.service.ts";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
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

      const url = new URL(req.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);

      const searchHistory = await SearchService.getSearchHistory(userId, limit);

      return new Response(JSON.stringify({
        success: true,
        searchHistory,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error getting search history:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to get search history" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};