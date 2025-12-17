/**
 * Pitch Routes Module - Core pitch functionality
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
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
    const orderDirection = order === "asc" ? "ASC" : "DESC";

    // Get pitches with user and company info
    const pitchesQuery = `
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.format,
        p.budget_range as "budgetRange",
        p.stage,
        p.view_count as "viewCount",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        u.first_name as "creator_name",
        u.company_name as "company_name"
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.${sortField} ${orderDirection}
      LIMIT $1 OFFSET $2
    `;

    const pitchesData = await db.execute(pitchesQuery, [limit, offset]);

    // Get total count for pagination
    const totalQuery = `
      SELECT COUNT(*) as count
      FROM pitches 
      WHERE status = 'published'
    `;

    const totalResult = await db.execute(totalQuery, []);
    const total = parseInt(totalResult.rows[0]?.count as string) || 0;

    return successResponse({
      pitches: pitchesData.rows,
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

    // Build WHERE conditions
    const conditions = ["p.status = 'published'"];
    const params: any[] = [];
    let paramIndex = 1;

    // Add search conditions
    if (query.trim()) {
      conditions.push(`(p.title ILIKE $${paramIndex} OR p.logline ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${query}%`);
      paramIndex++;
    }

    if (genre) {
      conditions.push(`p.genre = $${paramIndex}`);
      params.push(genre);
      paramIndex++;
    }

    if (format) {
      conditions.push(`p.format = $${paramIndex}`);
      params.push(format);
      paramIndex++;
    }

    if (budgetRange) {
      conditions.push(`p.budget_range = $${paramIndex}`);
      params.push(budgetRange);
      paramIndex++;
    }

    if (stage) {
      conditions.push(`p.stage = $${paramIndex}`);
      params.push(stage);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Main search query
    const searchQuery = `
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.format,
        p.budget_range,
        p.stage,
        p.view_count,
        p.created_at,
        u.first_name as "creator_name",
        u.company_name as "company_name"
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const searchResults = await db.execute(searchQuery, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM pitches p
      WHERE ${whereClause}
    `;

    const totalResult = await db.execute(countQuery, params.slice(0, -2)); // Remove limit/offset for count
    const total = parseInt(totalResult.rows[0]?.count as string) || 0;

    return successResponse({
      pitches: searchResults.rows,
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
    const trendingQuery = `
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.format,
        p.view_count,
        p.created_at,
        u.first_name as "creator_name",
        u.company_name as "company_name"
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published' 
        AND p.created_at > NOW() - INTERVAL '7 days'
      ORDER BY p.view_count DESC
      LIMIT $1
    `;

    const trendingPitches = await db.execute(trendingQuery, [limit]);

    return successResponse({ pitches: trendingPitches.rows });

  } catch (error) {
    telemetry.logger.error("Get trending pitches error", error);
    return errorResponse("Failed to fetch trending pitches", 500);
  }
};

// Get newest pitches
export const getNewestPitches: RouteHandler = async (request, url) => {
  try {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 50);

    const newestQuery = `
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.format,
        p.view_count,
        p.created_at,
        u.first_name as "creator_name",
        u.company_name as "company_name"
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.created_at DESC
      LIMIT $1
    `;

    const newestPitches = await db.execute(newestQuery, [limit]);

    return successResponse({ pitches: newestPitches.rows });

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
    const featuredQuery = `
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.format,
        p.view_count,
        p.created_at,
        u.first_name as "creator_name",
        u.company_name as "company_name"
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.view_count DESC
      LIMIT $1
    `;

    const featuredPitches = await db.execute(featuredQuery, [limit]);

    return successResponse({ pitches: featuredPitches.rows });

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

    // Build WHERE conditions
    const conditions = ["p.status = 'published'"];
    const params: any[] = [];
    let paramIndex = 1;

    // Apply tab-based filtering
    switch (tab) {
      case "trending":
        conditions.push("p.created_at > NOW() - INTERVAL '7 days'");
        break;
      case "new":
        conditions.push("p.created_at > NOW() - INTERVAL '30 days'");
        break;
      case "featured":
        conditions.push("p.view_count > 100");
        break;
    }

    // Apply filters
    if (genre) {
      conditions.push(`p.genre = $${paramIndex}`);
      params.push(genre);
      paramIndex++;
    }

    if (format) {
      conditions.push(`p.format = $${paramIndex}`);
      params.push(format);
      paramIndex++;
    }

    if (stage) {
      conditions.push(`p.stage = $${paramIndex}`);
      params.push(stage);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Determine sort order based on tab
    let orderClause = "ORDER BY p.created_at DESC";
    if (tab === "trending") {
      orderClause = "ORDER BY p.view_count DESC";
    }

    // Main browse query
    const browseQuery = `
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.format,
        p.budget_range,
        p.stage,
        p.view_count,
        p.created_at,
        u.first_name as "creator_name",
        u.company_name as "company_name"
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const results = await db.execute(browseQuery, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM pitches p
      WHERE ${whereClause}
    `;

    const totalResult = await db.execute(countQuery, params.slice(0, -2)); // Remove limit/offset for count
    const total = parseInt(totalResult.rows[0]?.count as string) || 0;

    return successResponse({
      pitches: results.rows,
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

    const pitchQuery = `
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.description,
        p.genre,
        p.format,
        p.budget_range,
        p.stage,
        p.status,
        p.view_count,
        p.created_at,
        p.updated_at,
        p.user_id,
        u.first_name as "creator_name",
        u.email as "creator_email",
        u.company_name as "company_name"
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
    `;

    const pitchResults = await db.execute(pitchQuery, [parseInt(pitchId)]);

    if (pitchResults.rows.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    const pitch = pitchResults.rows[0];

    // Increment view count
    try {
      const updateViewQuery = `
        UPDATE pitches 
        SET view_count = view_count + 1 
        WHERE id = $1
      `;
      await db.execute(updateViewQuery, [parseInt(pitchId)]);
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