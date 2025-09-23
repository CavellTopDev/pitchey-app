import { Handlers } from "$fresh/server.ts";
import { SearchService, type SearchFilters } from "../../../src/services/search.service.ts";
import { db } from "../../../src/db/client.ts";
import { searchHistory } from "../../../src/db/schema.ts";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async POST(req) {
    const startTime = Date.now();
    
    try {
      const body = await req.json();
      const filters: SearchFilters = body;
      
      // Get user if authenticated
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      let userId: number | null = null;
      if (token) {
        userId = await verifyToken(token);
      }

      // Perform advanced search using the new service
      const searchResult = await SearchService.advancedSearch(filters, userId || undefined);

      // Track search history
      if (filters.query) {
        const searchDuration = Date.now() - startTime;
        const userAgent = req.headers.get("user-agent") || undefined;
        const sessionId = req.headers.get("x-session-id") || crypto.randomUUID();

        try {
          const historyRecord = await db.insert(searchHistory).values({
            userId,
            sessionId,
            query: filters.query,
            filters: filters as any,
            resultCount: searchResult.total,
            searchDuration,
            source: "web",
            userAgent,
          }).returning();

          // Add search history ID to response for click tracking
          return new Response(JSON.stringify({
            success: true,
            ...searchResult,
            searchHistoryId: historyRecord[0]?.id,
            searchDuration,
            filters: {
              applied: filters,
              available: {
                genres: ['drama', 'comedy', 'thriller', 'horror', 'scifi', 'fantasy', 'documentary', 'animation', 'action', 'romance', 'other'],
                formats: ['feature', 'tv', 'short', 'webseries', 'other'],
                mediaTypes: ['lookbook', 'script', 'trailer', 'pitch_deck'],
                budgetRanges: [
                  { label: 'Under $100K', min: 0, max: 99999 },
                  { label: '$100K - $1M', min: 100000, max: 999999 },
                  { label: '$1M - $10M', min: 1000000, max: 9999999 },
                  { label: '$10M - $50M', min: 10000000, max: 49999999 },
                  { label: '$50M+', min: 50000000, max: null },
                ],
                creatorTypes: [
                  { value: 'any', label: 'All Creators' },
                  { value: 'creator', label: 'Individual Creators' },
                  { value: 'production', label: 'Production Companies' },
                ],
                sortOptions: [
                  { value: 'relevance', label: 'Most Relevant' },
                  { value: 'newest', label: 'Newest First' },
                  { value: 'oldest', label: 'Oldest First' },
                  { value: 'views', label: 'Most Viewed' },
                  { value: 'likes', label: 'Most Liked' },
                  { value: 'ndas', label: 'Most NDAs' },
                  { value: 'budget_high', label: 'Highest Budget' },
                  { value: 'budget_low', label: 'Lowest Budget' },
                  { value: 'alpha', label: 'Alphabetical' },
                ],
              },
            },
          }), {
            status: 200,
            headers: { 
              "Content-Type": "application/json",
              "X-Search-Duration": searchDuration.toString(),
            },
          });
        } catch (historyError) {
          console.error("Failed to save search history:", historyError);
          // Continue without search history
        }
      }

      return new Response(JSON.stringify({
        success: true,
        ...searchResult,
        searchDuration: Date.now() - startTime,
        filters: {
          applied: filters,
          available: {
            genres: ['drama', 'comedy', 'thriller', 'horror', 'scifi', 'fantasy', 'documentary', 'animation', 'action', 'romance', 'other'],
            formats: ['feature', 'tv', 'short', 'webseries', 'other'],
            mediaTypes: ['lookbook', 'script', 'trailer', 'pitch_deck'],
            budgetRanges: [
              { label: 'Under $100K', min: 0, max: 99999 },
              { label: '$100K - $1M', min: 100000, max: 999999 },
              { label: '$1M - $10M', min: 1000000, max: 9999999 },
              { label: '$10M - $50M', min: 10000000, max: 49999999 },
              { label: '$50M+', min: 50000000, max: null },
            ],
            creatorTypes: [
              { value: 'any', label: 'All Creators' },
              { value: 'creator', label: 'Individual Creators' },
              { value: 'production', label: 'Production Companies' },
            ],
            sortOptions: [
              { value: 'relevance', label: 'Most Relevant' },
              { value: 'newest', label: 'Newest First' },
              { value: 'oldest', label: 'Oldest First' },
              { value: 'views', label: 'Most Viewed' },
              { value: 'likes', label: 'Most Liked' },
              { value: 'ndas', label: 'Most NDAs' },
              { value: 'budget_high', label: 'Highest Budget' },
              { value: 'budget_low', label: 'Lowest Budget' },
              { value: 'alpha', label: 'Alphabetical' },
            ],
          },
        },
      }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "X-Search-Duration": (Date.now() - startTime).toString(),
        },
      });
    } catch (error) {
      console.error("Error in advanced search:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Internal server error",
        searchDuration: Date.now() - startTime,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};