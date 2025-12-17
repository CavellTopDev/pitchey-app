/**
 * User Management Routes Module
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { validateEnvironment } from "../utils/env-validation.ts";

const envConfig = validateEnvironment();
const JWT_SECRET = envConfig.JWT_SECRET;

// Middleware to extract user from JWT token
async function getUserFromToken(request: Request): Promise<any> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No token provided");
  }

  const token = authHeader.slice(7);
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

// Get user profile
export const getUserProfile: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    const userResults = await db.execute(`
      SELECT id, email, first_name, last_name, user_type, bio, location, website, 
             avatar_url, created_at, company_name, company_website
      FROM users WHERE id = $1
    `, [user.userId]);

    if (userResults.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    return successResponse({ user: userResults.rows[0] });

  } catch (error) {
    telemetry.logger.error("Get user profile error", error);
    return errorResponse("Failed to fetch user profile", 500);
  }
};

// Update user profile
export const updateUserProfile: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { firstName, lastName, bio, location, website, avatar_url } = await request.json();

    if (!firstName) {
      return errorResponse("First name is required", 400);
    }

    const updateData: any = {
      first_name: firstName,
    };

    if (lastName !== undefined) updateData.last_name = lastName;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (website !== undefined) updateData.website = website;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
    
    const updatedUsers = await db.execute(`
      UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${fields.length + 1}
      RETURNING *
    `, [...values, user.userId]);

    if (updatedUsers.rows.length === 0) {
      return errorResponse("Failed to update profile", 400);
    }

    telemetry.logger.info("User profile updated", { userId: user.userId });

    return successResponse({ 
      user: updatedUsers.rows[0],
      message: "Profile updated successfully" 
    });

  } catch (error) {
    telemetry.logger.error("Update user profile error", error);
    return errorResponse("Failed to update profile", 500);
  }
};

// Get user settings
export const getUserSettings: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    const userResults = await db.execute(`
      SELECT id, email, first_name, last_name, user_type, email_notifications,
             marketing_emails, two_factor_enabled, privacy_settings
      FROM users WHERE id = $1
    `, [user.userId]);

    if (userResults.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    return successResponse({ settings: userResults.rows[0] });

  } catch (error) {
    telemetry.logger.error("Get user settings error", error);
    return errorResponse("Failed to fetch user settings", 500);
  }
};

// Update user settings
export const updateUserSettings: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { 
      email_notifications, 
      marketing_emails, 
      two_factor_enabled,
      privacy_settings 
    } = await request.json();

    const updateData: any = {};

    if (email_notifications !== undefined) updateData.email_notifications = email_notifications;
    if (marketing_emails !== undefined) updateData.marketing_emails = marketing_emails;
    if (two_factor_enabled !== undefined) updateData.two_factor_enabled = two_factor_enabled;
    if (privacy_settings !== undefined) updateData.privacy_settings = privacy_settings;

    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
    
    const updatedUsers = await db.execute(`
      UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${fields.length + 1}
      RETURNING *
    `, [...values, user.userId]);

    if (updatedUsers.rows.length === 0) {
      return errorResponse("Failed to update settings", 400);
    }

    telemetry.logger.info("User settings updated", { userId: user.userId });

    return successResponse({ 
      settings: updatedUsers.rows[0],
      message: "Settings updated successfully" 
    });

  } catch (error) {
    telemetry.logger.error("Update user settings error", error);
    return errorResponse("Failed to update settings", 500);
  }
};

// Get user preferences
export const getUserPreferences: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    const userResults = await db.execute(`
      SELECT id, preferred_genres, preferred_formats, preferred_budget_ranges, notification_frequency
      FROM users WHERE id = $1
    `, [user.userId]);

    if (userResults.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    return successResponse({ preferences: userResults.rows[0] });

  } catch (error) {
    telemetry.logger.error("Get user preferences error", error);
    return errorResponse("Failed to fetch user preferences", 500);
  }
};

// Update user preferences
export const updateUserPreferences: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { 
      preferred_genres, 
      preferred_formats, 
      preferred_budget_ranges,
      notification_frequency 
    } = await request.json();

    const updateData: any = {};

    if (preferred_genres !== undefined) updateData.preferred_genres = preferred_genres;
    if (preferred_formats !== undefined) updateData.preferred_formats = preferred_formats;
    if (preferred_budget_ranges !== undefined) updateData.preferred_budget_ranges = preferred_budget_ranges;
    if (notification_frequency !== undefined) updateData.notification_frequency = notification_frequency;

    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
    
    const updatedUsers = await db.execute(`
      UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${fields.length + 1}
      RETURNING *
    `, [...values, user.userId]);

    if (updatedUsers.rows.length === 0) {
      return errorResponse("Failed to update preferences", 400);
    }

    telemetry.logger.info("User preferences updated", { userId: user.userId });

    return successResponse({ 
      preferences: updatedUsers.rows[0],
      message: "Preferences updated successfully" 
    });

  } catch (error) {
    telemetry.logger.error("Update user preferences error", error);
    return errorResponse("Failed to update preferences", 500);
  }
};

// Search users
export const searchUsers: RouteHandler = async (request, url) => {
  try {
    const searchParams = url.searchParams;
    const query = searchParams.get("q") || "";
    const userType = searchParams.get("type");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!query.trim()) {
      return errorResponse("Search query is required", 400);
    }

    let whereClause = "(first_name ILIKE $1 OR bio ILIKE $1)";
    let params = [`%${query}%`];

    if (userType) {
      whereClause += " AND user_type = $2";
      params.push(userType);
    }

    const searchResults = await db.execute(`
      SELECT id, first_name, last_name, user_type, bio, location, avatar_url, company_name
      FROM users 
      WHERE ${whereClause}
      ORDER BY id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM users WHERE ${whereClause}
    `, params);

    const total = totalResult.rows[0]?.count || 0;

    return successResponse({
      users: searchResults.rows,
      query: { q: query, type: userType },
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(total)
      }
    });

  } catch (error) {
    telemetry.logger.error("Search users error", error);
    return errorResponse("Failed to search users", 500);
  }
};

// Get user by ID (public profile)
export const getUserById: RouteHandler = async (request, url, params) => {
  try {
    const userId = params?.id;

    if (!userId) {
      return errorResponse("User ID is required", 400);
    }

    const userResults = await db.execute(`
      SELECT id, first_name, last_name, user_type, bio, location, website,
             avatar_url, created_at, company_name, company_website
      FROM users WHERE id = $1
    `, [parseInt(userId)]);

    if (userResults.rows.length === 0) {
      return errorResponse("User not found", 404);
    }

    return successResponse({ user: userResults.rows[0] });

  } catch (error) {
    telemetry.logger.error("Get user by ID error", error);
    return errorResponse("Failed to fetch user", 500);
  }
};

// Get user notifications
export const getUserNotifications: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // This is a placeholder - in a real implementation, you'd have a notifications table
    // For now, return mock notifications
    const notifications = [
      {
        id: 1,
        type: "pitch_view",
        title: "Your pitch received a new view",
        message: "Someone viewed your pitch 'The Amazing Adventure'",
        read: false,
        created_at: new Date(Date.now() - 86400000), // 1 day ago
      },
      {
        id: 2,
        type: "follow",
        title: "New follower",
        message: "John Doe started following you",
        read: false,
        created_at: new Date(Date.now() - 172800000), // 2 days ago
      }
    ];

    return successResponse({
      notifications,
      pagination: {
        total: notifications.length,
        limit,
        offset,
        hasMore: false
      }
    });

  } catch (error) {
    telemetry.logger.error("Get user notifications error", error);
    return errorResponse("Failed to fetch notifications", 500);
  }
};