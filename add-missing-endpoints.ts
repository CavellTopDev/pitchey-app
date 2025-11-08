// add-missing-endpoints.ts
// Code to add to working-server.ts to fix missing endpoints
// All database operations use Drizzle ORM

import { db } from "./src/db/client.ts";
import { 
  users, 
  pitches, 
  watchlist, 
  messages, 
  notifications, 
  ndas,
  ndaRequests,
  pitchViews 
} from "./src/db/schema.ts";
import { eq, and, or, desc, sql, ilike, gte, lte, isNull } from "npm:drizzle-orm@0.35.3";

// Add these endpoints after the existing authentication endpoints (around line 1000)

// ============ AUTHENTICATION ENDPOINTS ============

// Logout endpoint
if (url.pathname === "/api/auth/logout" && method === "POST") {
  // For JWT-based auth, logout is handled client-side
  // But we can still provide an endpoint for consistency
  return jsonResponse({
    success: true,
    message: "Logged out successfully"
  });
}

// Get user profile
if (url.pathname === "/api/auth/profile" && method === "GET") {
  // This requires authentication
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authentication required", 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await verify(token, JWT_KEY);
    const userId = payload.userId as number;

    // Get user from database using Drizzle
    const userResult = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        userType: users.userType,
        firstName: users.firstName,
        lastName: users.lastName,
        bio: users.bio,
        profileImageUrl: users.profileImageUrl,
        companyName: users.companyName,
        emailVerified: users.emailVerified,
        subscriptionTier: users.subscriptionTier,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userResult.length) {
      return errorResponse("User not found", 404);
    }

    return jsonResponse({
      success: true,
      user: userResult[0]
    });
  } catch (error) {
    console.error("Profile error:", error);
    return errorResponse("Invalid token", 401);
  }
}

// ============ SEARCH ENDPOINTS ============

// Search pitches endpoint (public and authenticated)
if (url.pathname === "/api/search/pitches" && method === "GET") {
  try {
    const params = new URLSearchParams(url.search);
    const query = params.get("q") || "";
    const genre = params.get("genre");
    const format = params.get("format");
    const limit = parseInt(params.get("limit") || "20");
    const offset = parseInt(params.get("offset") || "0");

    // Check if user is authenticated (optional)
    let userId = null;
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.substring(7);
        const payload = await verify(token, JWT_KEY);
        userId = payload.userId as number;
      } catch {
        // Continue as unauthenticated search
      }
    }

    // Build query conditions using Drizzle
    const conditions = [];
    
    // Only show public/active pitches unless user is searching their own
    conditions.push(eq(pitches.status, "published"));
    conditions.push(or(
      eq(pitches.visibility, "public"),
      isNull(pitches.visibility)
    ));

    // Add search query if provided
    if (query) {
      conditions.push(
        or(
          ilike(pitches.title, `%${query}%`),
          ilike(pitches.logline, `%${query}%`),
          ilike(pitches.shortSynopsis, `%${query}%`)
        )
      );
    }

    // Add genre filter if provided
    if (genre) {
      conditions.push(eq(pitches.genre, genre));
    }

    // Add format filter if provided
    if (format) {
      conditions.push(eq(pitches.format, format));
    }

    // Execute search query with Drizzle
    const searchResults = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        shortSynopsis: pitches.shortSynopsis,
        posterUrl: pitches.posterUrl,
        viewCount: pitches.viewCount,
        likeCount: pitches.likeCount,
        createdAt: pitches.createdAt,
        userId: pitches.userId,
        budgetBracket: pitches.budgetBracket,
        status: pitches.status
      })
      .from(pitches)
      .where(and(...conditions))
      .orderBy(desc(pitches.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql`count(*)::int` })
      .from(pitches)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    return jsonResponse({
      success: true,
      results: searchResults,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    console.error("Search error:", error);
    return serverErrorResponse("Search failed");
  }
}

// ============ FEATURED PITCHES (PUBLIC) ============

if (url.pathname === "/api/pitches/featured" && method === "GET") {
  try {
    // Get featured pitches (high view count, recent, public)
    const featuredPitches = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        posterUrl: pitches.posterUrl,
        viewCount: pitches.viewCount,
        likeCount: pitches.likeCount,
        createdAt: pitches.createdAt
      })
      .from(pitches)
      .where(
        and(
          eq(pitches.status, "published"),
          or(
            eq(pitches.visibility, "public"),
            isNull(pitches.visibility)
          )
        )
      )
      .orderBy(desc(pitches.viewCount), desc(pitches.likeCount))
      .limit(10);

    return jsonResponse({
      success: true,
      pitches: featuredPitches,
      cached: false
    });

  } catch (error) {
    console.error("Featured pitches error:", error);
    return serverErrorResponse("Failed to fetch featured pitches");
  }
}

// ============ WATCHLIST ENDPOINTS ============

// Add to watchlist
if (url.pathname.match(/^\/api\/watchlist\/\d+$/) && method === "POST") {
  // Requires authentication
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authentication required", 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await verify(token, JWT_KEY);
    const userId = payload.userId as number;
    
    const pitchId = parseInt(url.pathname.split('/')[3]);
    
    // Check if pitch exists
    const pitchExists = await db
      .select({ id: pitches.id })
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

    if (!pitchExists.length) {
      return errorResponse("Pitch not found", 404);
    }

    // Check if already in watchlist
    const existing = await db
      .select()
      .from(watchlist)
      .where(
        and(
          eq(watchlist.userId, userId),
          eq(watchlist.pitchId, pitchId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return jsonResponse({
        success: true,
        message: "Already in watchlist"
      });
    }

    // Add to watchlist using Drizzle
    await db.insert(watchlist).values({
      userId,
      pitchId,
      createdAt: new Date()
    });

    return jsonResponse({
      success: true,
      message: "Added to watchlist"
    });

  } catch (error) {
    console.error("Watchlist error:", error);
    return serverErrorResponse("Failed to add to watchlist");
  }
}

// Remove from watchlist
if (url.pathname.match(/^\/api\/watchlist\/\d+$/) && method === "DELETE") {
  // Requires authentication
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authentication required", 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await verify(token, JWT_KEY);
    const userId = payload.userId as number;
    
    const pitchId = parseInt(url.pathname.split('/')[3]);
    
    // Remove from watchlist using Drizzle
    await db
      .delete(watchlist)
      .where(
        and(
          eq(watchlist.userId, userId),
          eq(watchlist.pitchId, pitchId)
        )
      );

    return jsonResponse({
      success: true,
      message: "Removed from watchlist"
    });

  } catch (error) {
    console.error("Watchlist error:", error);
    return serverErrorResponse("Failed to remove from watchlist");
  }
}

// ============ NDA ENDPOINTS ============

// Check NDA status for a pitch
if (url.pathname.match(/^\/api\/nda\/status\/\d+$/) && method === "GET") {
  // Requires authentication
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authentication required", 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await verify(token, JWT_KEY);
    const userId = payload.userId as number;
    
    const pitchId = parseInt(url.pathname.split('/')[4]);
    
    // Check if user has signed NDA for this pitch using Drizzle
    const ndaStatus = await db
      .select({
        id: ndas.id,
        status: ndas.status,
        signedAt: ndas.signedAt,
        expiresAt: ndas.expiresAt
      })
      .from(ndas)
      .where(
        and(
          eq(ndas.pitchId, pitchId),
          eq(ndas.userId, userId)
        )
      )
      .limit(1);

    if (!ndaStatus.length) {
      // Check if there's a pending request
      const pendingRequest = await db
        .select({
          id: ndaRequests.id,
          status: ndaRequests.status,
          requestedAt: ndaRequests.requestedAt
        })
        .from(ndaRequests)
        .where(
          and(
            eq(ndaRequests.pitchId, pitchId),
            eq(ndaRequests.requesterId, userId)
          )
        )
        .limit(1);

      if (pendingRequest.length) {
        return jsonResponse({
          success: true,
          status: "pending",
          request: pendingRequest[0]
        });
      }

      return jsonResponse({
        success: true,
        status: "not_requested",
        message: "No NDA on file"
      });
    }

    return jsonResponse({
      success: true,
      status: ndaStatus[0].status || "signed",
      nda: ndaStatus[0]
    });

  } catch (error) {
    console.error("NDA status error:", error);
    return serverErrorResponse("Failed to check NDA status");
  }
}

// ============ MESSAGE ENDPOINTS ============

// Get unread message count
if (url.pathname === "/api/messages/unread-count" && method === "GET") {
  // Requires authentication
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authentication required", 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await verify(token, JWT_KEY);
    const userId = payload.userId as number;
    
    // Count unread messages using Drizzle
    const unreadCount = await db
      .select({ count: sql`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.isRead, false)
        )
      );

    return jsonResponse({
      success: true,
      unreadCount: unreadCount[0]?.count || 0
    });

  } catch (error) {
    console.error("Message count error:", error);
    return serverErrorResponse("Failed to get unread count");
  }
}

// ============ NOTIFICATION ENDPOINTS ============

// Get unread notifications
if (url.pathname === "/api/notifications/unread" && method === "GET") {
  // Requires authentication
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authentication required", 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await verify(token, JWT_KEY);
    const userId = payload.userId as number;
    
    // Get unread notifications using Drizzle
    const unreadNotifications = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        relatedId: notifications.relatedId,
        createdAt: notifications.createdAt
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    return jsonResponse({
      success: true,
      notifications: unreadNotifications,
      count: unreadNotifications.length
    });

  } catch (error) {
    console.error("Notifications error:", error);
    return serverErrorResponse("Failed to get notifications");
  }
}

// ============ Instructions for adding to working-server.ts ============
/*
To add these endpoints to working-server.ts:

1. Import the required tables at the top of the file if not already imported:
   import { watchlist, ndaRequests } from "./src/db/schema.ts";

2. Add these endpoints after the existing authentication endpoints 
   (around line 1000-1100 after the portal-specific login endpoints)

3. Make sure to have the JWT verification setup:
   - JWT_KEY should be defined
   - verify function from djwt should be imported

4. The endpoints use proper Drizzle ORM syntax:
   - All database queries use db.select(), db.insert(), db.update(), db.delete()
   - Proper use of eq(), and(), or() for conditions
   - Type-safe column references from schema

5. All endpoints include:
   - Proper authentication checks where required
   - Error handling with try/catch blocks
   - Appropriate HTTP status codes
   - JSON responses with success indicators
*/