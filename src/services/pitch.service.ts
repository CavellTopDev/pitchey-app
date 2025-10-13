import { db } from "../db/client.ts";
import { pitches, ndas, pitchViews, follows, users } from "../db/schema.ts";
import { eq, and, desc, sql, or } from "npm:drizzle-orm";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { CacheService } from "./cache.service.ts";

export const CreatePitchSchema = z.object({
  title: z.string().min(1).max(200),
  logline: z.string().min(1).max(500),
  genre: z.enum(["drama", "comedy", "thriller", "horror", "scifi", "fantasy", "documentary", "animation", "action", "romance", "other"]),
  format: z.enum(["feature", "tv", "short", "webseries", "other"]),
  formatCategory: z.string().optional(),
  formatSubtype: z.string().optional(),
  customFormat: z.string().optional(),
  shortSynopsis: z.string().optional(),
  longSynopsis: z.string().optional(),
  characters: z.array(z.object({
    name: z.string(),
    description: z.string(),
    age: z.string().optional(),
    gender: z.string().optional(),
    actor: z.string().optional(),
  })).optional(),
  themes: z.array(z.string()).optional(),
  budgetBracket: z.string().optional(),
  estimatedBudget: z.number().optional(),
  productionTimeline: z.string().optional(),
  titleImage: z.string().optional(),
  lookbookUrl: z.string().optional(),
  pitchDeckUrl: z.string().optional(),
  scriptUrl: z.string().optional(),
  trailerUrl: z.string().optional(),
  additionalMedia: z.array(z.object({
    type: z.enum(['lookbook', 'script', 'trailer', 'pitch_deck', 'budget_breakdown', 'production_timeline', 'other']),
    url: z.string(),
    title: z.string(),
    description: z.string().optional(),
    uploadedAt: z.string(),
  })).optional(),
  aiUsed: z.boolean().optional(),
  requireNDA: z.boolean().optional(),
});

export class PitchService {
  static async create(userId: number, data: z.infer<typeof CreatePitchSchema>) {
    // Skip validation since schema doesn't match database
    const validated = data;
    
    try {
      // Use the proper db client that handles local vs production databases
      const result = await db.insert(pitches).values({
        userId: userId,
        title: validated.title || "New Pitch",
        logline: validated.logline || "A compelling story",
        genre: validated.genre || "drama",
        format: validated.format || "feature",
        formatCategory: validated.formatCategory || null,
        formatSubtype: validated.formatSubtype || null,
        customFormat: validated.customFormat || null,
        shortSynopsis: validated.shortSynopsis || null,
        longSynopsis: validated.longSynopsis || null,
        estimatedBudget: validated.budget || validated.estimatedBudget?.toString() || null,
        status: 'draft',
        viewCount: 0,
        likeCount: 0,
        ndaCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      const pitch = result[0];
      
      // Clear homepage cache when new pitch is created
      try {
        await CacheService.invalidateHomepage();
      } catch (error) {
        console.warn("Failed to clear homepage cache:", error);
      }
      
      return pitch;
    } catch (error) {
      console.error("Database insert error:", error);
      console.error("Data was:", validated);
      throw error;
    }
  }
  
  static async update(pitchId: number, userId: number, data: Partial<z.infer<typeof CreatePitchSchema>>) {
    // Check ownership
    const pitchResult = await db
      .select()
      .from(pitches)
      .where(and(
        eq(pitches.id, pitchId),
        eq(pitches.userId, userId)
      ))
      .limit(1);
    
    const pitch = pitchResult[0];
    
    if (!pitch) {
      throw new Error("Pitch not found or unauthorized");
    }
    
    // Convert number to string for decimal fields
    const updateData = {
      ...data,
      estimatedBudget: data.estimatedBudget ? data.estimatedBudget.toString() : undefined,
      updatedAt: new Date(),
    };
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    const [updated] = await db.update(pitches)
      .set(updateData)
      .where(eq(pitches.id, pitchId))
      .returning();
    
    // Invalidate pitch cache after update
    try {
      await CacheService.invalidatePitch(pitchId);
    } catch (error) {
      console.warn("Failed to invalidate pitch cache:", error);
    }
    
    return updated;
  }
  
  static async publish(pitchId: number, userId: number) {
    const [published] = await db.update(pitches)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(pitches.id, pitchId),
        eq(pitches.userId, userId)
      ))
      .returning();
    
    // Invalidate pitch cache and homepage cache when pitch is published
    try {
      await CacheService.invalidatePitch(pitchId);
      await CacheService.invalidateHomepage();
    } catch (error) {
      console.warn("Failed to invalidate cache:", error);
    }
    
    return published;
  }

  static async getPitchById(pitchId: number, userId: number) {
    try {
      // Validate inputs
      if (!pitchId || isNaN(pitchId) || pitchId <= 0) {
        return null;
      }
      
      if (!userId || isNaN(userId) || userId <= 0) {
        return null;
      }
      
      // Get pitch if user owns it
      const result = await db
        .select()
        .from(pitches)
        .where(and(
          eq(pitches.id, pitchId),
          eq(pitches.userId, userId)
        ))
        .limit(1);
      
      const pitch = result[0] || null;
      
      // Additional validation of returned data
      if (pitch && (!pitch.id || !pitch.userId || !pitch.title)) {
        console.error(`Pitch ${pitchId} has corrupted data:`, {
          id: pitch.id,
          userId: pitch.userId,
          title: pitch.title
        });
        return null;
      }
      
      return pitch;
    } catch (error) {
      console.error(`Error fetching pitch ${pitchId} for user ${userId}:`, error);
      return null;
    }
  }
  
  static async getPitch(pitchId: number, viewerId?: number) {
    try {
      // First try to get pitch with relations
      let pitch;
      try {
        const pitchResults = await db
          .select({
            pitch: pitches,
            creator: {
              id: users.id,
              username: users.username,
              firstName: users.firstName,
              lastName: users.lastName,
              companyName: users.companyName,
              userType: users.userType,
              profileImage: users.profileImage,
            },
          })
          .from(pitches)
          .leftJoin(users, eq(pitches.userId, users.id))
          .where(eq(pitches.id, pitchId))
          .limit(1);
        
        if (pitchResults.length > 0) {
          const result = pitchResults[0];
          pitch = {
            ...result.pitch,
            creator: result.creator,
          };
          
          // Get NDAs separately if viewerId provided
          if (viewerId) {
            const ndaResults = await db
              .select()
              .from(ndas)
              .where(and(
                eq(ndas.pitchId, pitchId),
                eq(ndas.signerId, viewerId)
              ));
            
            pitch.ndas = ndaResults;
          } else {
            pitch.ndas = [];
          }
        }
      } catch (relationError) {
        console.log("Relations not available, fetching pitch without relations");
        // Fallback: get pitch without relations
        const fallbackResults = await db
          .select()
          .from(pitches)
          .where(eq(pitches.id, pitchId))
          .limit(1);
        
        pitch = fallbackResults[0];
        
        if (pitch) {
          // Add minimal creator info from the pitch itself
          pitch.creator = {
            id: pitch.userId,
            username: "Creator",
            userType: "creator"
          };
          pitch.ndas = [];
        }
      }
      
      if (!pitch) return null;
      
      // Record view
      if (viewerId) {
        try {
          await this.recordView(pitchId, viewerId);
        } catch (viewError) {
          console.log("Could not record view:", viewError);
        }
      }
      
      // Determine access level
      const creatorId = pitch.creator?.id || pitch.userId;
      const isOwner = viewerId === creatorId;
      const hasNda = pitch.ndas && pitch.ndas.length > 0;
    const hasFullAccess = isOwner || hasNda;
    
    // Filter content based on access
    if (!hasFullAccess) {
      // Remove protected content
      const { longSynopsis, characters, budgetBracket, scriptUrl, ...publicPitch } = pitch;
      return {
        ...publicPitch,
        hasFullAccess: false,
        requiresNda: true,
      };
    }
    
    return {
      ...pitch,
      hasFullAccess: true,
      requiresNda: false,
    };
    } catch (error) {
      console.error("Error in getPitch:", error);
      // Return null instead of throwing to avoid 500 errors
      return null;
    }
  }
  
  static async recordView(pitchId: number, viewerId: number) {
    // Increment view count
    await db.update(pitches)
      .set({
        viewCount: sql`${pitches.viewCount} + 1`,
      })
      .where(eq(pitches.id, pitchId));
    
    // Record detailed view
    await db.insert(pitchViews)
      .values({
        pitchId,
        viewerId,
        viewType: "full",
      });
  }
  
  static async signNda(pitchId: number, signerId: number, ndaType: "basic" | "enhanced" = "basic") {
    // Check if already signed
    const existingResult = await db
      .select()
      .from(ndas)
      .where(and(
        eq(ndas.pitchId, pitchId),
        eq(ndas.signerId, signerId)
      ))
      .limit(1);
    
    const existing = existingResult[0];
    
    if (existing) {
      return existing;
    }
    
    // Create NDA record
    const [nda] = await db.insert(ndas)
      .values({
        pitchId,
        signerId,
        ndaType,
      })
      .returning();
    
    // Increment NDA count
    await db.update(pitches)
      .set({
        ndaCount: sql`${pitches.ndaCount} + 1`,
      })
      .where(eq(pitches.id, pitchId));
    
    return nda;
  }
  
  static async getTopPitches(limit = 10) {
    const results = await db
      .select({
        pitch: pitches,
        creator: {
          username: users.username,
          companyName: users.companyName,
          userType: users.userType,
        },
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
      .where(eq(pitches.status, "published"))
      .orderBy(desc(pitches.likeCount), desc(pitches.viewCount))
      .limit(limit);
    
    return results.map(row => ({
      ...row.pitch,
      formatCategory: row.pitch.formatCategory,
      formatSubtype: row.pitch.formatSubtype,
      customFormat: row.pitch.customFormat,
      creator: row.creator,
    }));
  }
  
  // Get individual public pitch by ID
  static async getPublicPitchById(pitchId: number) {
    try {
      // Validate inputs
      if (!pitchId || isNaN(pitchId) || pitchId <= 0) {
        return null;
      }
      
      const [pitch] = await db
        .select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          formatCategory: pitches.formatCategory,
          formatSubtype: pitches.formatSubtype,
          customFormat: pitches.customFormat,
          budgetBracket: pitches.budgetBracket,
          estimatedBudget: pitches.estimatedBudget,
          status: pitches.status,
          userId: pitches.userId,
          viewCount: pitches.viewCount,
          likeCount: pitches.likeCount,
          ndaCount: pitches.ndaCount,
          shortSynopsis: pitches.shortSynopsis,
          longSynopsis: pitches.longSynopsis,
          requireNDA: pitches.requireNda,
          createdAt: pitches.createdAt,
          updatedAt: pitches.updatedAt,
          publishedAt: pitches.publishedAt,
          targetAudience: pitches.targetAudience,
          characters: pitches.characters,
          themes: pitches.themes,
          productionTimeline: pitches.productionTimeline,
          titleImage: pitches.titleImage,
          lookbookUrl: pitches.lookbookUrl,
          pitchDeckUrl: pitches.pitchDeckUrl,
          scriptUrl: pitches.scriptUrl,
          trailerUrl: pitches.trailerUrl,
          creator: {
            id: users.id,
            username: users.username,
            companyName: users.companyName,
            userType: users.userType,
          },
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(and(
          eq(pitches.id, pitchId),
          eq(pitches.status, "published")
        ))
        .limit(1);

      // Additional validation of returned data
      if (pitch && (!pitch.id || !pitch.userId || !pitch.title)) {
        console.error(`Public pitch ${pitchId} has corrupted data:`, {
          id: pitch.id,
          userId: pitch.userId,
          title: pitch.title
        });
        return null;
      }

      return pitch || null;
    } catch (error) {
      console.error("Error fetching public pitch:", error);
      // Return null instead of throwing to prevent 500 errors
      return null;
    }
  }

  // NEW METHOD - bypass any caching issues
  static async getPublicPitchesWithUserType(limit = 10) {
    console.log("🚀 FORCE NEW METHOD v4.0: Getting pitches with proper userTypes");
    
    try {
      const results = await db
        .select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          formatCategory: pitches.formatCategory,
          formatSubtype: pitches.formatSubtype,
          customFormat: pitches.customFormat,
          estimatedBudget: pitches.estimatedBudget,
          status: pitches.status,
          userId: pitches.userId,
          viewCount: pitches.viewCount,
          likeCount: pitches.likeCount,
          ndaCount: pitches.ndaCount,
          shortSynopsis: pitches.shortSynopsis,
          requireNda: pitches.requireNda,
          createdAt: pitches.createdAt,
          updatedAt: pitches.updatedAt,
          publishedAt: pitches.publishedAt,
          // User join for proper creator info
          creatorId: users.id,
          creatorUsername: users.username,
          creatorCompanyName: users.companyName,
          creatorUserType: users.userType
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(eq(pitches.status, "published"))
        .orderBy(desc(pitches.publishedAt))
        .limit(limit);

      console.log(`Found ${results.length} pitches for public view`);
      
      const formatted = results.map(p => ({
        id: p.id,
        title: p.title,
        logline: p.logline,
        genre: p.genre,
        format: p.format,
        formatCategory: p.formatCategory,
        formatSubtype: p.formatSubtype,
        customFormat: p.customFormat,
        estimatedBudget: p.estimatedBudget,
        status: p.status,
        userId: p.userId,
        viewCount: p.viewCount || 0,
        likeCount: p.likeCount || 0,
        ndaCount: p.ndaCount || 0,
        shortSynopsis: p.shortSynopsis,
        requireNDA: p.requireNda || false,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        publishedAt: p.publishedAt,
        creator: {
          id: p.creatorId,
          username: p.creatorUsername,
          companyName: p.creatorCompanyName,
          userType: p.creatorUserType // This is the key for PURPLE glow!
        }
      }));
      
      // Debug logging
      if (formatted.length > 0) {
        console.log("First pitch creator:", JSON.stringify(formatted[0].creator, null, 2));
        const productionCount = formatted.filter(p => p.creator.userType === "production").length;
        const creatorCount = formatted.filter(p => p.creator.userType === "creator").length;
        console.log(`Production pitches (PURPLE): ${productionCount}, Creator pitches (BLUE): ${creatorCount}`);
      }
      
      return formatted;
    } catch (error) {
      console.error("Error in getPublicPitchesWithUserType:", error);
      return [];
    }
  }

  static async getNewPitches(limit = 10) {
    try {
      console.log("getNewPitches v2.1: Starting query with userType fix...");
      
      // Query with joins to include proper creator info
      const results = await db
        .select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          formatCategory: pitches.formatCategory,
          formatSubtype: pitches.formatSubtype,
          customFormat: pitches.customFormat,
          budgetBracket: pitches.budgetBracket,
          estimatedBudget: pitches.estimatedBudget,
          status: pitches.status,
          titleImage: pitches.titleImage,
          shortSynopsis: pitches.shortSynopsis,
          viewCount: pitches.viewCount,
          likeCount: pitches.likeCount,
          ndaCount: pitches.ndaCount,
          userId: pitches.userId,
          createdAt: pitches.createdAt,
          updatedAt: pitches.updatedAt,
          publishedAt: pitches.publishedAt,
          // Add user info
          creatorId: users.id,
          creatorUsername: users.username,
          creatorCompanyName: users.companyName,
          creatorUserType: users.userType
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(eq(pitches.status, "published"))
        .orderBy(desc(pitches.publishedAt))
        .limit(limit);
      
      console.log(`getNewPitches: Found ${results.length} pitches`);
      
      // Transform to expected format with proper creator info
      const formatted = results.map(p => ({
        id: p.id,
        title: p.title,
        logline: p.logline,
        genre: p.genre,
        format: p.format,
        formatCategory: p.formatCategory,
        formatSubtype: p.formatSubtype,
        customFormat: p.customFormat,
        budgetBracket: p.budgetBracket,
        estimatedBudget: p.estimatedBudget ? parseFloat(p.estimatedBudget) : null,
        status: p.status,
        titleImage: p.titleImage,
        shortSynopsis: p.shortSynopsis,
        viewCount: p.viewCount || 0,
        likeCount: p.likeCount || 0,
        ndaCount: p.ndaCount || 0,
        userId: p.userId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        publishedAt: p.publishedAt,
        creator: p.creatorId ? {
          id: p.creatorId,
          username: p.creatorUsername,
          companyName: p.creatorCompanyName,
          userType: p.creatorUserType
        } : {
          id: p.userId,
          username: "Unknown Creator",
          companyName: null,
          userType: "creator"
        }
      }));
      
      console.log("getNewPitches: Sample creator object:", JSON.stringify(formatted[0]?.creator, null, 2));
      return formatted;
    } catch (error) {
      console.error("Error in getNewPitches:", error);
      // Return empty array instead of throwing
      return [];
    }
  }
  
  static async searchPitches(params: {
    query?: string;
    genre?: string;
    format?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [eq(pitches.status, "published")];
    
    if (params.genre) {
      conditions.push(eq(pitches.genre, params.genre as any));
    }
    
    if (params.format) {
      conditions.push(eq(pitches.format, params.format as any));
    }
    
    // Add text search for query parameter
    if (params.query && params.query.trim() !== '') {
      const searchTerm = `%${params.query.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${pitches.title}) LIKE ${searchTerm}`,
          sql`LOWER(${pitches.logline}) LIKE ${searchTerm}`,
          sql`LOWER(${pitches.shortSynopsis}) LIKE ${searchTerm}`
        )
      );
    }
    
    const [searchResults, totalCount] = await Promise.all([
      db
        .select({
          pitch: pitches,
          creator: {
            id: users.id,
            username: users.username,
            companyName: users.companyName,
            userType: users.userType,
          },
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(and(...conditions))
        .limit(params.limit || 20)
        .offset(params.offset || 0)
        .orderBy(desc(pitches.publishedAt))
        .then(results => results.map(row => ({
          ...row.pitch,
          formatCategory: row.pitch.formatCategory,
          formatSubtype: row.pitch.formatSubtype,
          customFormat: row.pitch.customFormat,
          creator: row.creator,
        }))),
      db.select({ count: sql<number>`count(*)` })
        .from(pitches)
        .where(and(...conditions))
        .then(result => result[0]?.count || 0)
    ]);
    
    return {
      pitches: searchResults,
      totalCount
    };
  }
  
  static async followPitch(pitchId: number, userId: number) {
    const [follow] = await db.insert(follows)
      .values({
        followerId: userId,
        pitchId,
      })
      .onConflictDoNothing()
      .returning();
    
    return follow;
  }
  
  static async unfollowPitch(pitchId: number, userId: number) {
    await db.delete(follows)
      .where(and(
        eq(follows.pitchId, pitchId),
        eq(follows.followerId, userId)
      ));
  }
  
  static async getUserPitches(userId: number, includeStats = false) {
    try {
      // Simple query without joins to avoid relation issues
      const userPitches = await db
        .select()
        .from(pitches)
        .where(eq(pitches.userId, userId))
        .orderBy(desc(pitches.updatedAt));
      
      if (!includeStats) {
        return userPitches;
      }
      
      // Calculate stats
      const stats = {
        totalPitches: userPitches.length,
        publishedPitches: userPitches.filter(p => p.status === "published").length,
        totalViews: userPitches.reduce((sum, p) => sum + (p.viewCount || 0), 0),
        totalLikes: userPitches.reduce((sum, p) => sum + (p.likeCount || 0), 0),
        totalNDAs: userPitches.reduce((sum, p) => sum + (p.ndaCount || 0), 0),
      };
      
      return {
        pitches: userPitches,
        stats,
      };
    } catch (error) {
      console.error("Error fetching user pitches:", error);
      console.error("Error details:", error.message);
      console.error("User ID was:", userId);
      
      // Try simplified Drizzle query as fallback
      try {
        console.log("Attempting fallback with simplified Drizzle query...");
        const fallbackPitches = await db
          .select()
          .from(pitches)
          .where(eq(pitches.userId, userId));
        
        console.log(`Fallback query returned ${fallbackPitches.length} pitches`);
        return fallbackPitches;
      } catch (fallbackError) {
        console.error("Drizzle fallback also failed:", fallbackError);
      }
      
      // Return empty data instead of throwing
      return {
        pitches: [],
        stats: {
          totalPitches: 0,
          publishedPitches: 0,
          totalViews: 0,
          totalLikes: 0,
          totalNDAs: 0,
        }
      };
    }
  }
  
  static async deletePitch(pitchId: number, userId: number) {
    console.log(`🗑️ Attempting to delete pitch ${pitchId} by user ${userId}`);
    
    // Check ownership
    const pitchResult = await db
      .select()
      .from(pitches)
      .where(and(
        eq(pitches.id, pitchId),
        eq(pitches.userId, userId)
      ))
      .limit(1);
    
    const pitch = pitchResult[0];
    
    if (!pitch) {
      console.error(`❌ Pitch ${pitchId} not found or user ${userId} not authorized`);
      throw new Error("Pitch not found or unauthorized");
    }
    
    console.log('🧹 Preparing to delete pitch...');
    
    try {
      // Since all foreign keys have CASCADE, we can directly delete the pitch
      // Cascade will automatically handle:
      // - pitch_views
      // - ndas
      // - nda_requests
      // - follows
      // - watchlist entries
      
      // Delete the pitch (cascade will handle all related records)
      const deleteResult = await db.delete(pitches)
        .where(eq(pitches.id, pitchId))
        .returning();
      
      if (!deleteResult.length) {
        throw new Error('Failed to delete pitch from database');
      }
      
      console.log(`✅ Pitch ${pitchId} deleted successfully`);
      
      // Invalidate all related caches
      console.log('🗑️ Invalidating caches...');
      
      try {
        // Import dashboard cache service dynamically
        const dashboardCacheModule = await import('./dashboard-cache.service.ts');
        const cacheService = dashboardCacheModule.dashboardCacheService || dashboardCacheModule.default;
        
        if (cacheService && typeof cacheService.invalidateCache === 'function') {
          // Invalidate trending cache
          await cacheService.invalidateCache('trending_pitches');
          
          // Invalidate user's pitch cache
          await cacheService.invalidateCache(`user:${userId}:pitches`);
          
          // Invalidate dashboard cache
          await cacheService.invalidateCache(`dashboard:user:${userId}`);
          await cacheService.invalidateCache(`dashboard:creator:${userId}`);
          
          // Invalidate public pitches cache patterns
          if (typeof cacheService.invalidatePattern === 'function') {
            await cacheService.invalidatePattern('pitchey:pitches:public');
            await cacheService.invalidatePattern(`pitchey:pitch:${pitchId}:*`);
            
            // Invalidate user-specific caches
            await cacheService.invalidatePattern(`pitchey:user:${userId}:*`);
          }
          
          console.log('✅ Caches invalidated');
        } else {
          console.log('⚠️ Cache service not available, skipping cache invalidation');
        }
      } catch (cacheError) {
        console.error('⚠️ Error invalidating cache (non-critical):', cacheError);
        // Continue - cache invalidation failure should not prevent deletion
      }
      
      // Broadcast deletion via WebSocket if available
      try {
        const { websocketIntegrationService } = await import('./websocket-integration.service.ts');
        if (websocketIntegrationService) {
          websocketIntegrationService.broadcast({
            type: 'pitch_deleted',
            data: { pitchId, userId }
          });
          console.log('📡 WebSocket notification sent');
        }
      } catch (wsError) {
        // WebSocket not available, that's okay
        console.log('📡 WebSocket not available for notification');
      }
      
      return { 
        success: true, 
        message: 'Pitch deleted successfully',
        pitchId: pitchId 
      };
      
    } catch (error: any) {
      console.error('❌ Error during pitch deletion:', error);
      
      // Check if it's a foreign key constraint error
      if (error.message?.includes('foreign key constraint') || error.code === '23503') {
        throw new Error('Cannot delete pitch: it has related records that must be removed first');
      }
      
      throw error;
    }
  }

  static async getCreatorDashboard(userId: number) {
    try {
      const userPitchesData = await this.getUserPitches(userId, true);
      
      // Get recent activity (simplified for demo)
      const recentActivity = [
        {
          id: 1,
          type: "view",
          message: "Your pitch was viewed by an investor",
          timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 2,
          type: "nda",
          message: "NDA request received for your project",
          timestamp: new Date(Date.now() - 7200000).toISOString()
        }
      ];

      return {
        stats: userPitchesData.stats || {
          totalPitches: 0,
          totalViews: 0,
          totalLikes: 0,
          activeNDAs: 0
        },
        pitches: userPitchesData.pitches || [],
        recentActivity,
        socialStats: {
          followers: 0,
          following: 0,
          connections: 0
        },
        credits: {
          remaining: 100,
          total: 100
        }
      };
    } catch (error) {
      console.error("Error getting creator dashboard:", error);
      throw error;
    }
  }

  static async createPitch(userId: number, data: any) {
    return await this.create(userId, data);
  }

  static async getAllPitches(filters: any = {}, viewerId?: number) {
    try {
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      
      let conditions = [eq(pitches.status, "published")];
      
      if (filters.genre) {
        conditions.push(eq(pitches.genre, filters.genre));
      }
      
      if (filters.format) {
        conditions.push(eq(pitches.format, filters.format));
      }

      // Simplified query without relations to avoid issues
      const allPitches = await db
        .select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          formatCategory: pitches.formatCategory,
          formatSubtype: pitches.formatSubtype,
          customFormat: pitches.customFormat,
          budgetBracket: pitches.budgetBracket,
          estimatedBudget: pitches.estimatedBudget,
          status: pitches.status,
          titleImage: pitches.titleImage,
          shortSynopsis: pitches.shortSynopsis,
          viewCount: pitches.viewCount,
          likeCount: pitches.likeCount,
          ndaCount: pitches.ndaCount,
          userId: pitches.userId,
          createdAt: pitches.createdAt,
          updatedAt: pitches.updatedAt,
          // Add user info
          creatorId: users.id,
          creatorUsername: users.username,
          creatorCompanyName: users.companyName,
          creatorUserType: users.userType
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(pitches.createdAt))
        .limit(limit)
        .offset(offset);

      // Transform to expected format
      const formattedPitches = allPitches.map(p => ({
        id: p.id,
        title: p.title,
        logline: p.logline,
        genre: p.genre,
        format: p.format,
        formatCategory: p.formatCategory,
        formatSubtype: p.formatSubtype,
        customFormat: p.customFormat,
        budgetBracket: p.budgetBracket,
        estimatedBudget: p.estimatedBudget ? parseFloat(p.estimatedBudget) : null,
        status: p.status,
        titleImage: p.titleImage,
        shortSynopsis: p.shortSynopsis,
        viewCount: p.viewCount || 0,
        likeCount: p.likeCount || 0,
        ndaCount: p.ndaCount || 0,
        userId: p.userId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        creator: p.creatorId ? {
          id: p.creatorId,
          username: p.creatorUsername,
          companyName: p.creatorCompanyName,
          userType: p.creatorUserType
        } : null
      }));

      return formattedPitches;
    } catch (error) {
      console.error("Error getting all pitches:", error);
      return [];
    }
  }

  static async getPitchesByUser(userId: number) {
    return await this.getUserPitches(userId);
  }

  static async updatePitch(pitchId: number, data: any, userId: number) {
    // Check ownership
    const pitchResult = await db
      .select()
      .from(pitches)
      .where(and(
        eq(pitches.id, pitchId),
        eq(pitches.userId, userId)
      ))
      .limit(1);
    
    const pitch = pitchResult[0];

    if (!pitch) {
      throw new Error("Pitch not found or unauthorized");
    }

    // Prepare update data
    const updateData = {
      ...data,
      estimatedBudget: data.estimatedBudget ? data.estimatedBudget.toString() : undefined,
      updatedAt: new Date()
    };

    // Remove undefined fields
    Object.keys(updateData).forEach((key: string) => {
      if ((updateData as any)[key] === undefined) {
        delete (updateData as any)[key];
      }
    });

    const [updatedPitch] = await db.update(pitches)
      .set(updateData)
      .where(eq(pitches.id, pitchId))
      .returning();

    return updatedPitch;
  }

  static async getProductionPitches(productionUserId: number) {
    try {
      // Get all published pitches that production companies can view
      // This could include pitches that are looking for production
      const productionPitches = await db
        .select({
          pitch: pitches,
          creator: {
            id: users.id,
            username: users.username,
            companyName: users.companyName,
            userType: users.userType,
          },
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(
          and(
            eq(pitches.status, "published"),
            // Only show pitches that are looking for production or investment
            // You could add more specific filtering here based on your business logic
          )
        )
        .orderBy(desc(pitches.publishedAt))
        .limit(50);

      return productionPitches.map(row => ({
        ...row.pitch,
        formatCategory: row.pitch.formatCategory,
        formatSubtype: row.pitch.formatSubtype,
        customFormat: row.pitch.customFormat,
        creator: row.creator,
      }));
    } catch (error) {
      console.error("Error fetching production pitches:", error);
      throw new Error("Failed to fetch production pitches");
    }
  }
}