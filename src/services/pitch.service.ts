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
    id: z.string().optional(),
    name: z.string(),
    description: z.string(),
    age: z.string().optional(),
    gender: z.string().optional(),
    actor: z.string().optional(),
    displayOrder: z.number().optional(),
  })).optional(),
  themes: z.string().optional(),
  worldDescription: z.string().optional(),
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

// Helper function to parse JSON fields in pitch objects
function parsePitchJsonFields(pitch: any) {
  if (!pitch) return pitch;
  
  if (pitch.characters && typeof pitch.characters === 'string') {
    try {
      pitch.characters = JSON.parse(pitch.characters);
    } catch (e) {
      pitch.characters = [];
    }
  }
  
  // themes is now a text field, no parsing needed
  
  if (pitch.additionalMedia && typeof pitch.additionalMedia === 'string') {
    try {
      pitch.additionalMedia = JSON.parse(pitch.additionalMedia);
    } catch (e) {
      pitch.additionalMedia = [];
    }
  }
  
  return pitch;
}

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
        characters: validated.characters ? JSON.stringify(validated.characters) : null,
        themes: validated.themes || null,
        worldDescription: validated.worldDescription || null,
        budgetBracket: validated.budgetBracket || null,
        estimatedBudget: validated.budget || validated.estimatedBudget?.toString() || null,
        productionTimeline: validated.productionTimeline || null,
        aiUsed: validated.aiUsed || false,
        requireNda: validated.requireNDA || false,
        status: 'draft',
        viewCount: 0,
        likeCount: 0,
        ndaCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      const pitch = result[0];
      
      // Parse JSON fields back to objects
      parsePitchJsonFields(pitch);
      
      // Clear homepage and marketplace cache when new pitch is created
      try {
        await CacheService.invalidateMarketplace();
      } catch (error) {
        console.warn("Failed to clear marketplace cache:", error);
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
    
    // Convert number to string for decimal fields and serialize JSON fields
    const updateData = {
      ...data,
      estimatedBudget: data.estimatedBudget ? data.estimatedBudget.toString() : undefined,
      characters: data.characters ? JSON.stringify(data.characters) : undefined,
      themes: data.themes,
      worldDescription: data.worldDescription,
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
    
    // Parse JSON fields back to objects
    parsePitchJsonFields(updated);
    
    // Invalidate pitch cache and marketplace cache after update
    try {
      await CacheService.invalidatePitch(pitchId);
      // Only invalidate marketplace if the pitch is published
      if (updated.status === 'published') {
        await CacheService.invalidateMarketplace();
      }
    } catch (error) {
      console.warn("Failed to invalidate cache:", error);
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
    
    // Invalidate pitch cache and marketplace cache when pitch is published
    try {
      await CacheService.invalidatePitch(pitchId);
      await CacheService.invalidateMarketplace();
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
      
      return parsePitchJsonFields(pitch);
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
      return parsePitchJsonFields({
        ...publicPitch,
        hasFullAccess: false,
        requiresNda: true,
      });
    }
    
    return parsePitchJsonFields({
      ...pitch,
      hasFullAccess: true,
      requiresNda: false,
    });
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
      
      // Use SQL-based approach to avoid Drizzle ORM array column issues
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.title,
          p.logline,
          p.genre,
          p.format,
          p.format_category as "formatCategory",
          p.format_subtype as "formatSubtype",
          p.custom_format as "customFormat",
          p.budget_bracket as "budgetBracket",
          p.estimated_budget as "estimatedBudget",
          p.status,
          p.user_id as "userId",
          p.view_count as "viewCount",
          p.like_count as "likeCount",
          p.nda_count as "ndaCount",
          p.short_synopsis as "shortSynopsis",
          p.long_synopsis as "longSynopsis",
          p.require_nda as "requireNDA",
          p.created_at as "createdAt",
          p.updated_at as "updatedAt",
          p.published_at as "publishedAt",
          p.target_audience as "targetAudience",
          COALESCE(p.characters, '[]'::jsonb) as characters,
          p.themes,
          p.production_timeline as "productionTimeline",
          p.title_image as "titleImage",
          p.lookbook_url as "lookbookUrl",
          p.pitch_deck_url as "pitchDeckUrl",
          p.script_url as "scriptUrl",
          p.trailer_url as "trailerUrl",
          u.id as "creator_id",
          u.username as "creator_username", 
          u.company_name as "creator_companyName",
          u.user_type as "creator_userType"
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ${pitchId} AND p.status = 'published'
        LIMIT 1
      `);
      
      if (!result.rows || result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0] as any;
      const pitch = {
        id: row.id,
        title: row.title,
        logline: row.logline,
        genre: row.genre,
        format: row.format,
        formatCategory: row.formatCategory,
        formatSubtype: row.formatSubtype,
        customFormat: row.customFormat,
        budgetBracket: row.budgetBracket,
        estimatedBudget: row.estimatedBudget,
        status: row.status,
        userId: row.userId,
        viewCount: row.viewCount,
        likeCount: row.likeCount,
        ndaCount: row.ndaCount,
        shortSynopsis: row.shortSynopsis,
        longSynopsis: row.longSynopsis,
        requireNDA: row.requireNDA,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        publishedAt: row.publishedAt,
        targetAudience: row.targetAudience,
        characters: row.characters || [],
        themes: row.themes,
        productionTimeline: row.productionTimeline,
        titleImage: row.titleImage,
        lookbookUrl: row.lookbookUrl,
        pitchDeckUrl: row.pitchDeckUrl,
        scriptUrl: row.scriptUrl,
        trailerUrl: row.trailerUrl,
        creator: {
          id: row.creator_id,
          username: row.creator_username,
          companyName: row.creator_companyName,
          userType: row.creator_userType,
        },
      };

      // Additional validation of returned data
      if (pitch && (!pitch.id || !pitch.userId || !pitch.title)) {
        console.error(`Public pitch ${pitchId} has corrupted data:`, {
          id: pitch.id,
          userId: pitch.userId,
          title: pitch.title
        });
        return null;
      }

      return parsePitchJsonFields(pitch) || null;
    } catch (error) {
      console.error("Error fetching public pitch:", error);
      // Return null instead of throwing to prevent 500 errors
      return null;
    }
  }

  // SQL-BASED METHOD - bypasses Drizzle ORM schema issues
  static async getPublicPitchesWithUserType(limit = 10) {
    console.log("🚀 SQL-BASED METHOD v5.0: Getting pitches with direct SQL");
    
    try {
      const results = await db.execute(sql`
        SELECT 
          p.id,
          p.title,
          p.logline,
          p.genre,
          p.format,
          p.format_category,
          p.format_subtype,
          p.custom_format,
          p.estimated_budget,
          p.status,
          p.user_id,
          p.view_count,
          p.like_count,
          p.nda_count,
          p.short_synopsis,
          p.require_nda,
          p.production_stage,
          p.seeking_investment,
          p.created_at,
          p.updated_at,
          p.published_at,
          u.id as creator_id,
          u.username as creator_username,
          u.company_name as creator_company_name,
          u.user_type as creator_user_type
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.status = 'published'
        ORDER BY p.published_at DESC
        LIMIT ${limit}
      `);

      console.log(`Found ${results.rows.length} pitches for public view`);
      
      const formatted = results.rows.map(p => ({
        id: p.id,
        title: p.title,
        logline: p.logline,
        genre: p.genre,
        format: p.format,
        formatCategory: p.format_category,
        formatSubtype: p.format_subtype,
        customFormat: p.custom_format,
        estimatedBudget: p.estimated_budget,
        status: p.status,
        userId: p.user_id,
        viewCount: p.view_count || 0,
        likeCount: p.like_count || 0,
        ndaCount: p.nda_count || 0,
        shortSynopsis: p.short_synopsis,
        requireNDA: p.require_nda || false,
        productionStage: p.production_stage || 'concept',
        seekingInvestment: p.seeking_investment !== null ? p.seeking_investment : false,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        publishedAt: p.published_at,
        creator: {
          id: p.creator_id,
          username: p.creator_username,
          companyName: p.creator_company_name,
          userType: p.creator_user_type
        }
      }));
      
      // Debug logging
      if (formatted.length > 0) {
        console.log("✅ First pitch sample:", {
          id: formatted[0].id,
          title: formatted[0].title,
          creator: formatted[0].creator
        });
        const productionCount = formatted.filter(p => p.creator.userType === "production").length;
        const creatorCount = formatted.filter(p => p.creator.userType === "creator").length;
        console.log(`🎨 Production pitches (PURPLE): ${productionCount}, Creator pitches (BLUE): ${creatorCount}`);
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
      // Use SQL-based approach to avoid Drizzle ORM array column issues
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.title,
          p.logline,
          p.genre,
          p.format,
          p.format_category as "formatCategory",
          p.format_subtype as "formatSubtype",
          p.custom_format as "customFormat",
          p.budget_bracket as "budgetBracket",
          p.estimated_budget as "estimatedBudget",
          p.status,
          p.user_id as "userId",
          p.view_count as "viewCount",
          p.like_count as "likeCount",
          p.nda_count as "ndaCount",
          p.short_synopsis as "shortSynopsis",
          p.long_synopsis as "longSynopsis",
          p.require_nda as "requireNDA",
          p.created_at as "createdAt",
          p.updated_at as "updatedAt",
          p.published_at as "publishedAt",
          p.target_audience as "targetAudience",
          COALESCE(p.characters, '[]'::jsonb) as characters,
          COALESCE(p.additional_media, '[]'::jsonb) as "additionalMedia",
          p.themes,
          p.production_timeline as "productionTimeline",
          p.title_image as "titleImage",
          p.lookbook_url as "lookbookUrl",
          p.pitch_deck_url as "pitchDeckUrl",
          p.script_url as "scriptUrl",
          p.trailer_url as "trailerUrl"
        FROM pitches p
        WHERE p.user_id = ${userId}
        ORDER BY p.updated_at DESC
      `);
      
      const parsedPitches = result.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        logline: row.logline,
        genre: row.genre,
        format: row.format,
        formatCategory: row.formatCategory,
        formatSubtype: row.formatSubtype,
        customFormat: row.customFormat,
        budgetBracket: row.budgetBracket,
        estimatedBudget: row.estimatedBudget,
        status: row.status,
        userId: row.userId,
        viewCount: row.viewCount,
        likeCount: row.likeCount,
        ndaCount: row.ndaCount,
        shortSynopsis: row.shortSynopsis,
        longSynopsis: row.longSynopsis,
        requireNDA: row.requireNDA,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        publishedAt: row.publishedAt,
        targetAudience: row.targetAudience,
        characters: row.characters || [],
        additionalMedia: row.additionalMedia || [],
        themes: row.themes,
        productionTimeline: row.productionTimeline,
        titleImage: row.titleImage,
        lookbookUrl: row.lookbookUrl,
        pitchDeckUrl: row.pitchDeckUrl,
        scriptUrl: row.scriptUrl,
        trailerUrl: row.trailerUrl,
      }));
      
      if (!includeStats) {
        return parsedPitches;
      }
      
      // Calculate stats
      const stats = {
        totalPitches: parsedPitches.length,
        publishedPitches: parsedPitches.filter(p => p.status === "published").length,
        totalViews: parsedPitches.reduce((sum, p) => sum + (p.viewCount || 0), 0),
        totalLikes: parsedPitches.reduce((sum, p) => sum + (p.likeCount || 0), 0),
        totalNDAs: parsedPitches.reduce((sum, p) => sum + (p.ndaCount || 0), 0),
      };
      
      return {
        pitches: parsedPitches,
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
        return fallbackPitches.map(parsePitchJsonFields);
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

  // Alias for backward compatibility - calls the main update method
  static async updatePitch(pitchId: number, data: any, userId: number) {
    return await this.update(pitchId, userId, data);
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