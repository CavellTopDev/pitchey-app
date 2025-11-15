/**
 * Pitch Routes Module - Core pitch functionality
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { pitches, users } from "../db/schema.ts";
import { eq, desc, asc, like, and, or, sql, inArray } from "npm:drizzle-orm@0.35.3";
import { AdvancedSearchService } from "../services/advanced-search.service.ts";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { validateEnvironment } from "../utils/env-validation.ts";

const envConfig = validateEnvironment();
const JWT_SECRET = envConfig.JWT_SECRET;

// Helper function to extract user from JWT token
async function getUserFromToken(request: Request): Promise<any> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No valid authorization header found");
  }

  const token = authHeader.substring(7);
  const payload = await verify(
    token,
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )
  );
  
  return payload;
}

// Get public pitches (no auth required)
export const getPublicPitches: RouteHandler = async (request, url) => {
  try {
    const searchParams = url.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const sortBy = searchParams.get("sortBy") || "created_at";
    const order = searchParams.get("order") || "desc";

    const validSortFields = ["created_at", "updated_at", "view_count", "title"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "created_at";
    const orderDirection = order === "asc" ? asc : desc;

    // Get pitches with user and company info
    const pitchesData = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        budgetRange: pitches.budgetRange,
        stage: pitches.stage,
        viewCount: pitches.viewCount,
        createdAt: pitches.createdAt,
        updatedAt: pitches.updatedAt,
        creator_name: users.firstName,
        company_name: users.companyName,
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
            .where(eq(pitches.status, "published"))
      .orderBy(orderDirection(sql.raw(sortField)))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pitches)
      .where(eq(pitches.status, "published"));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      pitches: pitchesData,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get public pitches error", error);
    return errorResponse("Failed to fetch pitches", 500);
  }
};

// Search pitches
export const searchPitches: RouteHandler = async (request, url) => {
  try {
    const searchParams = url.searchParams;
    const query = searchParams.get("q") || "";
    const genre = searchParams.get("genre");
    const format = searchParams.get("format");
    const budgetRange = searchParams.get("budget_range");
    const stage = searchParams.get("stage");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    let whereConditions = [eq(pitches.status, "published")];

    // Add search conditions
    if (query.trim()) {
      whereConditions.push(
        or(
          like(pitches.title, `%${query}%`),
          like(pitches.logline, `%${query}%`),
          like(pitches.description, `%${query}%`)
        )
      );
    }

    if (genre) whereConditions.push(eq(pitches.genre, genre));
    if (format) whereConditions.push(eq(pitches.format, format));
    if (budgetRange) whereConditions.push(eq(pitches.budgetRange, budgetRange));
    if (stage) whereConditions.push(eq(pitches.stage, stage));

    const searchResults = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        budget_range: pitches.budget_range,
        stage: pitches.stage,
        view_count: pitches.view_count,
        created_at: pitches.created_at,
        creator_name: users.firstName,
        company_name: users.companyName,
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
            .where(and(...whereConditions))
      .orderBy(desc(pitches.created_at))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pitches)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      pitches: searchResults,
      query: {
        q: query,
        genre,
        format,
        budgetRange,
        stage
      },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Search pitches error", error);
    return errorResponse("Failed to search pitches", 500);
  }
};

// Get trending pitches
export const getTrendingPitches: RouteHandler = async (request, url) => {
  try {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);

    // Get pitches with highest view counts in the last 7 days
    const trendingPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        view_count: pitches.view_count,
        created_at: pitches.created_at,
        creator_name: users.firstName,
        company_name: users.companyName,
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
            .where(
        and(
          eq(pitches.status, "published"),
          sql`${pitches.created_at} > NOW() - INTERVAL '7 days'`
        )
      )
      .orderBy(desc(pitches.view_count))
      .limit(limit);

    return successResponse({ pitches: trendingPitches });

  } catch (error) {
    telemetry.logger.error("Get trending pitches error", error);
    return errorResponse("Failed to fetch trending pitches", 500);
  }
};

// Get newest pitches
export const getNewestPitches: RouteHandler = async (request, url) => {
  try {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);

    const newestPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        view_count: pitches.view_count,
        created_at: pitches.created_at,
        creator_name: users.firstName,
        company_name: users.companyName,
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
            .where(eq(pitches.status, "published"))
      .orderBy(desc(pitches.created_at))
      .limit(limit);

    return successResponse({ pitches: newestPitches });

  } catch (error) {
    telemetry.logger.error("Get newest pitches error", error);
    return errorResponse("Failed to fetch newest pitches", 500);
  }
};

// Get featured pitches
export const getFeaturedPitches: RouteHandler = async (request, url) => {
  try {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);

    // Featured pitches are those with highest view counts and good ratings
    const featuredPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        view_count: pitches.view_count,
        created_at: pitches.created_at,
        creator_name: users.firstName,
        company_name: users.companyName,
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
            .where(eq(pitches.status, "published"))
      .orderBy(desc(pitches.view_count))
      .limit(limit);

    return successResponse({ pitches: featuredPitches });

  } catch (error) {
    telemetry.logger.error("Get featured pitches error", error);
    return errorResponse("Failed to fetch featured pitches", 500);
  }
};

// Browse pitches with enhanced filtering
export const browsePitches: RouteHandler = async (request, url) => {
  try {
    const searchParams = url.searchParams;
    const tab = searchParams.get("tab") || "all";
    const genre = searchParams.get("genre");
    const format = searchParams.get("format");
    const stage = searchParams.get("stage");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    let whereConditions = [eq(pitches.status, "published")];

    // Apply tab-based filtering
    switch (tab) {
      case "trending":
        whereConditions.push(sql`${pitches.created_at} > NOW() - INTERVAL '7 days'`);
        break;
      case "new":
        whereConditions.push(sql`${pitches.created_at} > NOW() - INTERVAL '30 days'`);
        break;
      case "featured":
        whereConditions.push(sql`${pitches.view_count} > 100`);
        break;
    }

    // Apply filters
    if (genre) whereConditions.push(eq(pitches.genre, genre));
    if (format) whereConditions.push(eq(pitches.format, format));
    if (stage) whereConditions.push(eq(pitches.stage, stage));

    // Determine sort order based on tab
    let orderBy = desc(pitches.created_at);
    if (tab === "trending") {
      orderBy = desc(pitches.view_count);
    }

    const results = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        budget_range: pitches.budget_range,
        stage: pitches.stage,
        view_count: pitches.view_count,
        created_at: pitches.created_at,
        creator_name: users.firstName,
        company_name: users.companyName,
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
            .where(and(...whereConditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pitches)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      pitches: results,
      filters: { tab, genre, format, stage },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Browse pitches error", error);
    return errorResponse("Failed to browse pitches", 500);
  }
};

// Get pitch by ID with detailed information
export const getPitchById: RouteHandler = async (request, url, params) => {
  try {
    const pitchId = params?.id;

    if (!pitchId) {
      return errorResponse("Pitch ID is required", 400);
    }

    const pitchResults = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        description: pitches.description,
        genre: pitches.genre,
        format: pitches.format,
        budget_range: pitches.budget_range,
        stage: pitches.stage,
        status: pitches.status,
        view_count: pitches.view_count,
        created_at: pitches.created_at,
        updated_at: pitches.updated_at,
        user_id: pitches.user_id,
        creator_name: users.firstName,
        creator_email: users.email,
        company_name: users.companyName,
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
            .where(eq(pitches.id, parseInt(pitchId)));

    if (pitchResults.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    const pitch = pitchResults[0];

    // Increment view count
    try {
      await db
        .update(pitches)
        .set({ view_count: sql`${pitches.view_count} + 1` })
        .where(eq(pitches.id, parseInt(pitchId)));
    } catch (viewError) {
      telemetry.logger.warn("Failed to update view count", viewError);
    }

    return successResponse({ pitch });

  } catch (error) {
    telemetry.logger.error("Get pitch by ID error", error);
    return errorResponse("Failed to fetch pitch", 500);
  }
};

// Advanced search with comprehensive filtering
export const advancedSearch: RouteHandler = async (request, url) => {
  try {
    const searchParams = url.searchParams;
    
    // Extract user from token if present (optional for search)
    let userId: number | undefined;
    try {
      const user = await getUserFromToken(request);
      userId = user.userId;
    } catch {
      // Continue without user context
    }

    // Build search parameters
    const searchFilters = {
      query: searchParams.get("query") || undefined,
      titleSearch: searchParams.get("title") || undefined,
      loglineSearch: searchParams.get("logline") || undefined,
      descriptionSearch: searchParams.get("description") || undefined,
      
      // Array filters
      genres: searchParams.get("genres")?.split(",").filter(Boolean) || undefined,
      formats: searchParams.get("formats")?.split(",").filter(Boolean) || undefined,
      budgetRanges: searchParams.get("budgetRanges")?.split(",").filter(Boolean) || undefined,
      stages: searchParams.get("stages")?.split(",").filter(Boolean) || undefined,
      
      // User filters
      creatorTypes: searchParams.get("creatorTypes")?.split(",").filter(Boolean) || undefined,
      experienceLevels: searchParams.get("experienceLevels")?.split(",").filter(Boolean) || undefined,
      locations: searchParams.get("locations")?.split(",").filter(Boolean) || undefined,
      
      // Metric filters
      minViews: searchParams.get("minViews") ? parseInt(searchParams.get("minViews")!) : undefined,
      maxViews: searchParams.get("maxViews") ? parseInt(searchParams.get("maxViews")!) : undefined,
      minLikes: searchParams.get("minLikes") ? parseInt(searchParams.get("minLikes")!) : undefined,
      maxLikes: searchParams.get("maxLikes") ? parseInt(searchParams.get("maxLikes")!) : undefined,
      
      // Date filters
      createdAfter: searchParams.get("createdAfter") || undefined,
      createdBefore: searchParams.get("createdBefore") || undefined,
      updatedAfter: searchParams.get("updatedAfter") || undefined,
      
      // Boolean filters
      hasNDA: searchParams.get("hasNDA") === "true",
      requiresInvestment: searchParams.get("requiresInvestment") === "true",
      availableForLicensing: searchParams.get("availableForLicensing") === "true",
      featuredOnly: searchParams.get("featuredOnly") === "true",
      
      // Search options
      page: parseInt(searchParams.get("page") || "1"),
      limit: Math.min(parseInt(searchParams.get("limit") || "20"), 100),
      sortBy: (searchParams.get("sortBy") as any) || "relevance",
      sortOrder: (searchParams.get("sortOrder") as any) || "desc",
      
      includePrivate: searchParams.get("includePrivate") === "true",
      excludeViewed: searchParams.get("excludeViewed") === "true"
    };

    const result = await AdvancedSearchService.search(searchFilters, userId);

    // Log search query for analytics
    if (searchFilters.query) {
      await AdvancedSearchService.logSearchQuery(
        searchFilters.query, 
        userId, 
        result.pitches.length
      );
    }

    return successResponse(result);

  } catch (error) {
    telemetry.logger.error("Advanced search error", error);
    return errorResponse("Failed to perform search", 500);
  }
};

// Find similar pitches to a given pitch
export const findSimilarPitches: RouteHandler = async (request, url, params) => {
  try {
    const pitchId = params?.id;
    const limit = parseInt(url.searchParams.get("limit") || "10");

    if (!pitchId) {
      return errorResponse("Pitch ID is required", 400);
    }

    const result = await AdvancedSearchService.findSimilarContent(parseInt(pitchId), limit);
    
    return successResponse(result);

  } catch (error) {
    telemetry.logger.error("Find similar pitches error", error);
    return errorResponse("Failed to find similar pitches", 500);
  }
};

// Get search suggestions for autocomplete
export const getSearchSuggestions: RouteHandler = async (request, url) => {
  try {
    const query = url.searchParams.get("q") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 20);

    if (!query.trim()) {
      return successResponse({ suggestions: [] });
    }

    const suggestions = await AdvancedSearchService.getSearchSuggestions(query, limit);
    
    return successResponse(suggestions);

  } catch (error) {
    telemetry.logger.error("Get search suggestions error", error);
    return errorResponse("Failed to get search suggestions", 500);
  }
};

// Get trending searches and popular queries
export const getTrendingSearches: RouteHandler = async (request, url) => {
  try {
    const timeframe = (url.searchParams.get("timeframe") as any) || "7d";
    
    const trending = await AdvancedSearchService.getTrendingSearches(timeframe);
    
    return successResponse(trending);

  } catch (error) {
    telemetry.logger.error("Get trending searches error", error);
    return errorResponse("Failed to get trending searches", 500);
  }
};

// Faceted search for dynamic filtering
export const facetedSearch: RouteHandler = async (request, url) => {
  try {
    const searchParams = url.searchParams;
    
    // Extract user from token if present
    let userId: number | undefined;
    try {
      const user = await getUserFromToken(request);
      userId = user.userId;
    } catch {
      // Continue without user context
    }

    const facetField = searchParams.get("facetField") as any;
    if (!["genre", "format", "budgetRange", "stage"].includes(facetField)) {
      return errorResponse("Invalid facet field", 400);
    }

    // Base search parameters (same as advanced search)
    const baseParams = {
      query: searchParams.get("query") || undefined,
      genres: searchParams.get("genres")?.split(",").filter(Boolean) || undefined,
      formats: searchParams.get("formats")?.split(",").filter(Boolean) || undefined,
      budgetRanges: searchParams.get("budgetRanges")?.split(",").filter(Boolean) || undefined,
      stages: searchParams.get("stages")?.split(",").filter(Boolean) || undefined,
      // Add other filters as needed
    };

    const facets = await AdvancedSearchService.facetedSearch(baseParams, facetField, userId);
    
    return successResponse({
      facetField,
      facets
    });

  } catch (error) {
    telemetry.logger.error("Faceted search error", error);
    return errorResponse("Failed to perform faceted search", 500);
  }
};