import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { searchClickTracking, searchHistory } from "../../../src/db/schema.ts";
import { eq } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async POST(req) {
    try {
      const body = await req.json();
      const { pitchId, resultPosition, query, searchHistoryId, sessionId } = body;

      if (!pitchId || !resultPosition || !query) {
        return new Response(JSON.stringify({ 
          error: "pitchId, resultPosition, and query are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      let userId: number | null = null;
      
      if (token) {
        userId = await verifyToken(token);
      }

      // Track the click
      await db.insert(searchClickTracking).values({
        searchHistoryId,
        userId,
        sessionId,
        pitchId,
        resultPosition,
        query,
        source: "web", // TODO: Detect source from user agent
      });

      // Update search history with clicked result
      if (searchHistoryId && userId) {
        const existingHistory = await db.select()
          .from(searchHistory)
          .where(eq(searchHistory.id, searchHistoryId))
          .limit(1);

        if (existingHistory.length > 0) {
          const clickedResults = existingHistory[0].clickedResults || [];
          clickedResults.push({
            pitchId,
            position: resultPosition,
            clickedAt: new Date().toISOString(),
          });

          await db.update(searchHistory)
            .set({ clickedResults })
            .where(eq(searchHistory.id, searchHistoryId));
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Click tracked successfully",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error tracking search click:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to track click" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};