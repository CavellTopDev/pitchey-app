import { Handlers } from "$fresh/server.ts";
import { SearchAnalyticsService } from "../../../src/services/search-analytics.service.ts";
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
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      const type = url.searchParams.get("type") || "overview";
      const granularity = url.searchParams.get("granularity") || "day";

      // Default to last 30 days if no dates provided
      const defaultEndDate = new Date();
      const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const start = startDate ? new Date(startDate) : defaultStartDate;
      const end = endDate ? new Date(endDate) : defaultEndDate;

      let result;

      switch (type) {
        case "overview":
          result = await SearchAnalyticsService.getSearchAnalytics(start, end, userId);
          break;

        case "performance":
          result = await SearchAnalyticsService.getSearchPerformanceOverTime(
            start, 
            end, 
            granularity as 'hour' | 'day' | 'week'
          );
          break;

        case "abandonment":
          result = await SearchAnalyticsService.getSearchAbandonmentRate(start, end);
          break;

        case "content-gaps":
          const minSearchCount = parseInt(url.searchParams.get("minSearchCount") || "5");
          result = await SearchAnalyticsService.identifyContentGaps(start, end, minSearchCount);
          break;

        case "query-performance":
          const queries = url.searchParams.get("queries");
          if (!queries) {
            return new Response(JSON.stringify({ 
              error: "queries parameter required for query-performance type" 
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          const queryList = queries.split(',').map(q => q.trim());
          result = await SearchAnalyticsService.getQueryPerformance(queryList, start, end);
          break;

        default:
          return new Response(JSON.stringify({ 
            error: "Invalid analytics type. Supported types: overview, performance, abandonment, content-gaps, query-performance" 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
      }

      return new Response(JSON.stringify({
        success: true,
        type,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        data: result,
      }), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300", // Cache for 5 minutes
        },
      });
    } catch (error) {
      console.error("Error getting search analytics:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Failed to get search analytics" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};