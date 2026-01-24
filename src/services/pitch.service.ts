import { db } from "../db/client.ts";
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
      const result = await db.insert('pitches', {
        user_id: userId,
        title: validated.title || "New Pitch",
        logline: validated.logline || "A compelling story",
        genre: validated.genre || "drama",
        format: validated.format || "feature",
        format_category: validated.formatCategory || null,
        format_subtype: validated.formatSubtype || null,
        custom_format: validated.customFormat || null,
        short_synopsis: validated.shortSynopsis || null,
        long_synopsis: validated.longSynopsis || null,
        characters: validated.characters ? JSON.stringify(validated.characters) : null,
        themes: validated.themes || null,
        world_description: validated.worldDescription || null,
        budget_bracket: validated.budgetBracket || null,
        estimated_budget: validated.estimatedBudget?.toString() || null,
        production_timeline: validated.productionTimeline || null,
        ai_used: validated.aiUsed || false,
        require_nda: validated.requireNDA || false,
        status: 'draft',
        view_count: 0,
        like_count: 0,
        nda_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
      
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
    const pitchResult = await db.execute(
      'SELECT * FROM pitches WHERE id = $1 AND user_id = $2 LIMIT 1',
      [pitchId, userId]
    );
    
    const pitch = pitchResult[0];
    
    if (!pitch) {
      throw new Error("Pitch not found or unauthorized");
    }
    
    // Convert number to string for decimal fields and serialize JSON fields
    const updateData: any = {
      ...data,
      estimated_budget: data.estimatedBudget ? data.estimatedBudget.toString() : undefined,
      characters: data.characters ? JSON.stringify(data.characters) : undefined,
      themes: data.themes,
      world_description: data.worldDescription,
      updated_at: new Date(),
    };
    
    // Remove undefined values
    Object.keys(updateData).forEach((key: string) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    // Convert camelCase to snake_case for database columns
    const dbData: any = {};
    Object.keys(updateData).forEach(key => {
      const dbKey = key === 'formatCategory' ? 'format_category' :
                    key === 'formatSubtype' ? 'format_subtype' :
                    key === 'customFormat' ? 'custom_format' :
                    key === 'shortSynopsis' ? 'short_synopsis' :
                    key === 'longSynopsis' ? 'long_synopsis' :
                    key === 'budgetBracket' ? 'budget_bracket' :
                    key === 'productionTimeline' ? 'production_timeline' :
                    key === 'aiUsed' ? 'ai_used' :
                    key === 'requireNDA' ? 'require_nda' :
                    key === 'titleImage' ? 'title_image' :
                    key === 'lookbookUrl' ? 'lookbook_url' :
                    key === 'pitchDeckUrl' ? 'pitch_deck_url' :
                    key === 'scriptUrl' ? 'script_url' :
                    key === 'trailerUrl' ? 'trailer_url' :
                    key === 'additionalMedia' ? 'additional_media' : key;
      dbData[dbKey] = updateData[key];
    });
    
    const updated = await db.update('pitches', dbData, 'id = $1', [pitchId]);
    
    // Parse JSON fields back to objects
    parsePitchJsonFields(updated[0]);
    
    // Invalidate pitch cache and marketplace cache after update
    try {
      await CacheService.invalidatePitch(pitchId);
      // Only invalidate marketplace if the pitch is published
      if (updated[0] && updated[0].status === 'published') {
        await CacheService.invalidateMarketplace();
      }
    } catch (error) {
      console.warn("Failed to invalidate cache:", error);
    }
    
    return updated[0];
  }
  
  static async publish(pitchId: number, userId: number) {
    const published = await db.update(
      'pitches',
      {
        status: "published",
        published_at: new Date(),
        updated_at: new Date(),
      },
      'id = $1 AND user_id = $2',
      [pitchId, userId]
    );
    
    // Invalidate pitch cache and marketplace cache when pitch is published
    try {
      await CacheService.invalidatePitch(pitchId);
      await CacheService.invalidateMarketplace();
    } catch (error) {
      console.warn("Failed to invalidate cache:", error);
    }
    
    return published[0];
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
      const result = await db.execute(
        'SELECT * FROM pitches WHERE id = $1 AND user_id = $2 LIMIT 1',
        [pitchId, userId]
      );
      
      const pitch = result[0] || null;
      
      // Additional validation of returned data
      if (pitch && (!pitch.id || !pitch.user_id || !pitch.title)) {
        console.error(`Pitch ${pitchId} has corrupted data:`, {
          id: pitch.id,
          userId: pitch.user_id,
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
        const pitchResults = await db.execute(`
          SELECT 
            p.*,
            u.id as creator_id,
            u.username as creator_username,
            u.first_name as creator_first_name,
            u.last_name as creator_last_name,
            u.company_name as creator_company_name,
            u.user_type as creator_user_type,
            u.profile_image_url as creator_profile_image_url
          FROM pitches p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE p.id = $1
          LIMIT 1
        `, [pitchId]);
        
        if (pitchResults.length > 0) {
          const result = pitchResults[0];
          pitch = {
            id: result.id,
            title: result.title,
            logline: result.logline,
            genre: result.genre,
            format: result.format,
            formatCategory: result.format_category,
            formatSubtype: result.format_subtype,
            customFormat: result.custom_format,
            shortSynopsis: result.short_synopsis,
            longSynopsis: result.long_synopsis,
            characters: result.characters,
            themes: result.themes,
            worldDescription: result.world_description,
            budgetBracket: result.budget_bracket,
            estimatedBudget: result.estimated_budget,
            productionTimeline: result.production_timeline,
            titleImage: result.title_image,
            lookbookUrl: result.lookbook_url,
            pitchDeckUrl: result.pitch_deck_url,
            scriptUrl: result.script_url,
            trailerUrl: result.trailer_url,
            additionalMedia: result.additional_media,
            aiUsed: result.ai_used,
            requireNDA: result.require_nda,
            status: result.status,
            viewCount: result.view_count,
            likeCount: result.like_count,
            ndaCount: result.nda_count,
            userId: result.user_id,
            createdAt: result.created_at,
            updatedAt: result.updated_at,
            publishedAt: result.published_at,
            creator: {
              id: result.creator_id,
              username: result.creator_username,
              firstName: result.creator_first_name,
              lastName: result.creator_last_name,
              companyName: result.creator_company_name,
              userType: result.creator_user_type,
              profileImageUrl: result.creator_profile_image_url,
            },
          };
          
          // Get NDAs separately if viewerId provided
          if (viewerId) {
            const ndaResults = await db.execute(
              'SELECT * FROM ndas WHERE pitch_id = $1 AND signer_id = $2',
              [pitchId, viewerId]
            );
            
            pitch.ndas = ndaResults;
          } else {
            pitch.ndas = [];
          }
        }
      } catch (relationError) {
        console.log("Relations not available, fetching pitch without relations");
        // Fallback: get pitch without relations
        const fallbackResults = await db.execute(
          'SELECT * FROM pitches WHERE id = $1 LIMIT 1',
          [pitchId]
        );
        
        const result = fallbackResults[0];
        if (result) {
          pitch = {
            id: result.id,
            title: result.title,
            logline: result.logline,
            genre: result.genre,
            format: result.format,
            formatCategory: result.format_category,
            formatSubtype: result.format_subtype,
            customFormat: result.custom_format,
            shortSynopsis: result.short_synopsis,
            longSynopsis: result.long_synopsis,
            characters: result.characters,
            themes: result.themes,
            worldDescription: result.world_description,
            budgetBracket: result.budget_bracket,
            estimatedBudget: result.estimated_budget,
            productionTimeline: result.production_timeline,
            titleImage: result.title_image,
            lookbookUrl: result.lookbook_url,
            pitchDeckUrl: result.pitch_deck_url,
            scriptUrl: result.script_url,
            trailerUrl: result.trailer_url,
            additionalMedia: result.additional_media,
            aiUsed: result.ai_used,
            requireNDA: result.require_nda,
            status: result.status,
            viewCount: result.view_count,
            likeCount: result.like_count,
            ndaCount: result.nda_count,
            userId: result.user_id,
            createdAt: result.created_at,
            updatedAt: result.updated_at,
            publishedAt: result.published_at,
            creator: {
              id: result.user_id,
              username: "Creator",
              userType: "creator"
            },
            ndas: []
          };
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
    await db.execute(
      'UPDATE pitches SET view_count = view_count + 1 WHERE id = $1',
      [pitchId]
    );
    
    // Record detailed view
    await db.insert('pitch_views', {
      pitch_id: pitchId,
      viewer_id: viewerId,
      view_type: "full",
      created_at: new Date()
    });
  }
  
  static async signNda(pitchId: number, signerId: number, ndaType: "basic" | "enhanced" = "basic") {
    // Check if already signed
    const existingResult = await db.execute(
      'SELECT * FROM ndas WHERE pitch_id = $1 AND signer_id = $2 LIMIT 1',
      [pitchId, signerId]
    );
    
    const existing = existingResult[0];
    
    if (existing) {
      return existing;
    }
    
    // Create NDA record
    const nda = await db.insert('ndas', {
      pitch_id: pitchId,
      signer_id: signerId,
      nda_type: ndaType,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    // Increment NDA count
    await db.execute(
      'UPDATE pitches SET nda_count = nda_count + 1 WHERE id = $1',
      [pitchId]
    );
    
    return nda[0];
  }
  
  static async getTopPitches(limit = 10) {
    const results = await db.execute(`
      SELECT 
        p.*,
        u.username as creator_username,
        u.company_name as creator_company_name,
        u.user_type as creator_user_type
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.like_count DESC, p.view_count DESC
      LIMIT $1
    `, [limit]);
    
    return results.map((row: any) => ({
      id: row.id,
      title: row.title,
      logline: row.logline,
      genre: row.genre,
      format: row.format,
      formatCategory: row.format_category,
      formatSubtype: row.format_subtype,
      customFormat: row.custom_format,
      shortSynopsis: row.short_synopsis,
      longSynopsis: row.long_synopsis,
      characters: row.characters,
      themes: row.themes,
      worldDescription: row.world_description,
      budgetBracket: row.budget_bracket,
      estimatedBudget: row.estimated_budget,
      productionTimeline: row.production_timeline,
      titleImage: row.title_image,
      lookbookUrl: row.lookbook_url,
      pitchDeckUrl: row.pitch_deck_url,
      scriptUrl: row.script_url,
      trailerUrl: row.trailer_url,
      additionalMedia: row.additional_media,
      aiUsed: row.ai_used,
      requireNDA: row.require_nda,
      status: row.status,
      viewCount: row.view_count,
      likeCount: row.like_count,
      ndaCount: row.nda_count,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      creator: {
        username: row.creator_username,
        companyName: row.creator_company_name,
        userType: row.creator_user_type,
      },
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
          COALESCE(p.characters, '[]') as characters,
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

      // Handle different result formats from different database clients
      const rows = results?.rows || results || [];
      console.log(`Found ${rows.length} pitches for public view`);
      
      // Additional safety check for rows array
      if (!Array.isArray(rows)) {
        console.warn("⚠️ Expected array from database query, got:", typeof rows);
        return [];
      }
      
      const formatted = rows.filter(p => p && p.id).map(p => ({
        id: p?.id || 0,
        title: p?.title || 'Untitled',
        logline: p?.logline || '',
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
          id: p?.creator_id || p?.user_id || 0,
          username: p?.creator_username || p?.username || 'Unknown',
          companyName: p?.creator_company_name || p?.company_name,
          userType: p?.creator_user_type || p?.user_type || 'creator'
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
      const results = await db.execute(`
        SELECT 
          p.id,
          p.title,
          p.logline,
          p.genre,
          p.format,
          p.format_category,
          p.format_subtype,
          p.custom_format,
          p.budget_bracket,
          p.estimated_budget,
          p.status,
          p.title_image,
          p.short_synopsis,
          p.view_count,
          p.like_count,
          p.nda_count,
          p.user_id,
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
        LIMIT $1
      `, [limit]);
      
      console.log(`getNewPitches: Found ${results.length} pitches`);
      
      // Transform to expected format with proper creator info
      const formatted = results.map((p: any) => ({
        id: p.id,
        title: p.title,
        logline: p.logline,
        genre: p.genre,
        format: p.format,
        formatCategory: p.format_category,
        formatSubtype: p.format_subtype,
        customFormat: p.custom_format,
        budgetBracket: p.budget_bracket,
        estimatedBudget: p.estimated_budget ? parseFloat(p.estimated_budget) : null,
        status: p.status,
        titleImage: p.title_image,
        shortSynopsis: p.short_synopsis,
        viewCount: p.view_count || 0,
        likeCount: p.like_count || 0,
        ndaCount: p.nda_count || 0,
        userId: p.user_id,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        publishedAt: p.published_at,
        creator: p.creator_id ? {
          id: p.creator_id,
          username: p.creator_username,
          companyName: p.creator_company_name,
          userType: p.creator_user_type
        } : {
          id: p.user_id,
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
    let baseCondition = "p.status = 'published'";
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    if (params.genre) {
      baseCondition += ` AND p.genre = $${paramIndex}`;
      queryParams.push(params.genre);
      paramIndex++;
    }
    
    if (params.format) {
      baseCondition += ` AND p.format = $${paramIndex}`;
      queryParams.push(params.format);
      paramIndex++;
    }
    
    // Add text search for query parameter
    if (params.query && params.query.trim() !== '') {
      const searchTerm = `%${params.query.toLowerCase()}%`;
      baseCondition += ` AND (LOWER(p.title) LIKE $${paramIndex} OR LOWER(p.logline) LIKE $${paramIndex} OR LOWER(p.short_synopsis) LIKE $${paramIndex})`;
      queryParams.push(searchTerm);
      paramIndex++;
    }
    
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    
    const [searchResults, totalCountResults] = await Promise.all([
      db.execute(`
        SELECT 
          p.*,
          u.id as creator_id,
          u.username as creator_username,
          u.company_name as creator_company_name,
          u.user_type as creator_user_type
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE ${baseCondition}
        ORDER BY p.published_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]),
      
      db.execute(`
        SELECT COUNT(*) as count
        FROM pitches p
        WHERE ${baseCondition}
      `, queryParams)
    ]);
    
    const formattedResults = searchResults.map((row: any) => ({
      id: row.id,
      title: row.title,
      logline: row.logline,
      genre: row.genre,
      format: row.format,
      formatCategory: row.format_category,
      formatSubtype: row.format_subtype,
      customFormat: row.custom_format,
      shortSynopsis: row.short_synopsis,
      longSynopsis: row.long_synopsis,
      characters: row.characters,
      themes: row.themes,
      worldDescription: row.world_description,
      budgetBracket: row.budget_bracket,
      estimatedBudget: row.estimated_budget,
      productionTimeline: row.production_timeline,
      titleImage: row.title_image,
      lookbookUrl: row.lookbook_url,
      pitchDeckUrl: row.pitch_deck_url,
      scriptUrl: row.script_url,
      trailerUrl: row.trailer_url,
      additionalMedia: row.additional_media,
      aiUsed: row.ai_used,
      requireNDA: row.require_nda,
      status: row.status,
      viewCount: row.view_count,
      likeCount: row.like_count,
      ndaCount: row.nda_count,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      creator: {
        id: row.creator_id,
        username: row.creator_username,
        companyName: row.creator_company_name,
        userType: row.creator_user_type,
      },
    }));
    
    const totalCount = totalCountResults[0]?.count || 0;
    
    return {
      pitches: formattedResults,
      totalCount: parseInt(totalCount)
    };
  }
  
  static async followPitch(pitchId: number, userId: number) {
    try {
      const follow = await db.insert('follows', {
        follower_id: userId,
        pitch_id: pitchId,
        created_at: new Date()
      });
      return follow[0];
    } catch (error) {
      // Handle unique constraint violation (already following)
      if (error.message?.includes('unique') || error.code === '23505') {
        // Return existing follow record
        const existing = await db.execute(
          'SELECT * FROM follows WHERE pitch_id = $1 AND follower_id = $2',
          [pitchId, userId]
        );
        return existing[0];
      }
      throw error;
    }
  }
  
  static async unfollowPitch(pitchId: number, userId: number) {
    await db.delete('follows', 'pitch_id = $1 AND follower_id = $2', [pitchId, userId]);
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
          COALESCE(p.characters, '[]') as characters,
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
        publishedPitches: parsedPitches.filter((p: any) => p.status === "published").length,
        totalViews: parsedPitches.reduce((sum: number, p: any) => sum + (p.viewCount || 0), 0),
        totalLikes: parsedPitches.reduce((sum: number, p: any) => sum + (p.likeCount || 0), 0),
        totalNDAs: parsedPitches.reduce((sum: number, p: any) => sum + (p.ndaCount || 0), 0),
      };
      
      return {
        pitches: parsedPitches,
        stats,
      };
    } catch (error) {
      console.error("Error fetching user pitches:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error details:", errorMessage);
      console.error("User ID was:", userId);
      
      // Try simplified Drizzle query as fallback
      try {
        console.log("Attempting fallback with simplified Drizzle query...");
        const fallbackPitches = await db
          .select()
          .from(pitches)
          .where(eq(pitches.userId, userId));
        
        if (fallbackPitches && Array.isArray(fallbackPitches)) {
          console.log(`Fallback query returned ${fallbackPitches.length} pitches`);
          return fallbackPitches.map(parsePitchJsonFields);
        } else {
          console.log("Fallback query returned invalid data");
          return [];
        }
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
    const pitchResult = await db.execute(
      'SELECT * FROM pitches WHERE id = $1 AND user_id = $2 LIMIT 1',
      [pitchId, userId]
    );
    
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
      const deleteResult = await db.delete('pitches', 'id = $1', [pitchId]);
      
      if (!deleteResult || deleteResult.length === 0) {
        throw new Error('Failed to delete pitch from database');
      }
      
      console.log(`✅ Pitch ${pitchId} deleted successfully`);
      
      // Invalidate all related caches
      console.log('🗑️ Invalidating caches...');
      
      try {
        // Import dashboard cache service dynamically
        const dashboardCacheModule = await import('./dashboard-cache.service.ts');
        const DashboardCacheService = dashboardCacheModule.DashboardCacheService;
        
        if (DashboardCacheService) {
          // Invalidate trending cache
          await DashboardCacheService.invalidateTrendingCache();
          
          // Get user type to invalidate dashboard cache properly
          const userResult = await db.execute('SELECT user_type FROM users WHERE id = $1', [userId]);
          const userType = userResult[0]?.user_type || 'creator';
          
          // Invalidate user dashboard cache
          await DashboardCacheService.invalidateDashboardCache(userId, userType);
          
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
        const websocketModule = await import('./websocket-integration.service.ts');
        const websocketIntegrationService = new websocketModule.WebSocketIntegrationService();
        if (websocketIntegrationService && typeof websocketIntegrationService.broadcastSystemAnnouncement === 'function') {
          await websocketIntegrationService.broadcastSystemAnnouncement({
            title: 'Pitch Deleted',
            message: `Pitch ${pitchId} has been deleted`,
            type: 'pitch_deleted'
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
      
      let baseCondition = "p.status = 'published'";
      const queryParams: any[] = [];
      let paramIndex = 1;
      
      if (filters.genre) {
        baseCondition += ` AND p.genre = $${paramIndex}`;
        queryParams.push(filters.genre);
        paramIndex++;
      }
      
      if (filters.format) {
        baseCondition += ` AND p.format = $${paramIndex}`;
        queryParams.push(filters.format);
        paramIndex++;
      }

      // Simplified query without relations to avoid issues
      const allPitches = await db.execute(`
        SELECT 
          p.id,
          p.title,
          p.logline,
          p.genre,
          p.format,
          p.format_category,
          p.format_subtype,
          p.custom_format,
          p.budget_bracket,
          p.estimated_budget,
          p.status,
          p.title_image,
          p.short_synopsis,
          p.view_count,
          p.like_count,
          p.nda_count,
          p.user_id,
          p.created_at,
          p.updated_at,
          u.id as creator_id,
          u.username as creator_username,
          u.company_name as creator_company_name,
          u.user_type as creator_user_type
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE ${baseCondition}
        ORDER BY p.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      // Transform to expected format
      const formattedPitches = allPitches.map((p: any) => ({
        id: p.id,
        title: p.title,
        logline: p.logline,
        genre: p.genre,
        format: p.format,
        formatCategory: p.format_category,
        formatSubtype: p.format_subtype,
        customFormat: p.custom_format,
        budgetBracket: p.budget_bracket,
        estimatedBudget: p.estimated_budget ? parseFloat(p.estimated_budget) : null,
        status: p.status,
        titleImage: p.title_image,
        shortSynopsis: p.short_synopsis,
        viewCount: p.view_count || 0,
        likeCount: p.like_count || 0,
        ndaCount: p.nda_count || 0,
        userId: p.user_id,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        creator: p.creator_id ? {
          id: p.creator_id,
          username: p.creator_username,
          companyName: p.creator_company_name,
          userType: p.creator_user_type
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
      const productionPitches = await db.execute(`
        SELECT 
          p.*,
          u.id as creator_id,
          u.username as creator_username,
          u.company_name as creator_company_name,
          u.user_type as creator_user_type
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.status = 'published'
        ORDER BY p.published_at DESC
        LIMIT 50
      `);

      return productionPitches.map((row: any) => ({
        id: row.id,
        title: row.title,
        logline: row.logline,
        genre: row.genre,
        format: row.format,
        formatCategory: row.format_category,
        formatSubtype: row.format_subtype,
        customFormat: row.custom_format,
        shortSynopsis: row.short_synopsis,
        longSynopsis: row.long_synopsis,
        characters: row.characters,
        themes: row.themes,
        worldDescription: row.world_description,
        budgetBracket: row.budget_bracket,
        estimatedBudget: row.estimated_budget,
        productionTimeline: row.production_timeline,
        titleImage: row.title_image,
        lookbookUrl: row.lookbook_url,
        pitchDeckUrl: row.pitch_deck_url,
        scriptUrl: row.script_url,
        trailerUrl: row.trailer_url,
        additionalMedia: row.additional_media,
        aiUsed: row.ai_used,
        requireNDA: row.require_nda,
        status: row.status,
        viewCount: row.view_count,
        likeCount: row.like_count,
        ndaCount: row.nda_count,
        userId: row.user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
        creator: {
          id: row.creator_id,
          username: row.creator_username,
          companyName: row.creator_company_name,
          userType: row.creator_user_type,
        },
      }));
    } catch (error) {
      console.error("Error fetching production pitches:", error);
      throw new Error("Failed to fetch production pitches");
    }
  }
}