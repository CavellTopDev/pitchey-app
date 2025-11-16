/**
 * Simple Browse Service that works with the actual database schema
 */

import { db } from "../db/client.ts";
import { pitches, users } from "../db/schema.ts";
import { eq, sql, desc, asc, and, gte, inArray } from "npm:drizzle-orm@0.35.3";

export interface BrowseFilters {
  tab?: 'trending' | 'new' | 'popular';
  page?: number;
  limit?: number;
}

export interface BrowseResult {
  items: any[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  hasMore: boolean;
}

export class SimpleBrowseService {
  
  static async browse(filters: BrowseFilters): Promise<BrowseResult> {
    const tab = filters.tab || 'trending';
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 24, 100);
    const offset = (page - 1) * limit;

    try {
      // Base conditions - only active/published pitches
      const conditions: any[] = [];
      // Check for both 'published' and 'active' status since database uses 'active'
      conditions.push(eq(pitches.status, 'active'));

      // Build the query based on tab - using simpler order by for now
      let orderByClause;
      
      switch (tab) {
        case 'trending':
          // Trending: For now, order by likes then views
          orderByClause = [desc(pitches.likeCount), desc(pitches.viewCount)];
          break;
          
        case 'new':
          // New: most recent first
          orderByClause = [desc(pitches.createdAt)];
          break;
          
        case 'popular':
          // Popular: most views
          orderByClause = [desc(pitches.viewCount)];
          break;
          
        default:
          orderByClause = [desc(pitches.createdAt)];
      }

      // Get total count
      const totalResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(pitches)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      const total = Number(totalResult[0]?.count || 0);
      const totalPages = Math.ceil(total / limit);

      // Get pitches first without join to avoid the error
      const pitchResults = await db
        .select()
        .from(pitches)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(...orderByClause)
        .limit(limit)
        .offset(offset);

      // Now get user info for each pitch
      const userIds = [...new Set(pitchResults.map(p => p.userId).filter(Boolean))];
      const userMap = new Map();
      
      if (userIds.length > 0) {
        // Convert IDs to numbers to ensure proper type
        const numericUserIds = userIds.map(id => Number(id)).filter(id => !isNaN(id));
        
        if (numericUserIds.length > 0) {
          const userResults = await db
            .select()
            .from(users)
            .where(inArray(users.id, numericUserIds));
          
          userResults.forEach(user => {
            userMap.set(user.id, user);
          });
        }
      }

      const results = pitchResults.map(pitch => {
        const creator = userMap.get(pitch.userId);
        return {
          ...pitch,
          creatorId: creator?.id,
          creatorUsername: creator?.username,
          creatorEmail: creator?.email,
          creatorUserType: creator?.userType
        };
      });

      // Transform results to match expected format
      const items = results.map(row => ({
        id: row.id,
        title: row.title,
        logline: row.logline,
        genre: row.genre,
        format: row.format,
        budget: row.budget,
        status: row.status,
        viewCount: row.viewCount || 0,
        likeCount: row.likeCount || 0,
        ndaCount: row.ndaCount || 0,
        createdAt: row.createdAt,
        thumbnailUrl: row.thumbnailUrl,
        creator: {
          id: row.creatorId,
          username: row.creatorUsername,
          userType: row.creatorUserType,
          name: row.creatorUsername, // For display
        }
      }));

      return {
        items,
        total,
        page,
        totalPages,
        limit,
        hasMore: page < totalPages
      };
      
    } catch (error) {
      console.error('SimpleBrowseService error:', error);
      throw error;
    }
  }
}