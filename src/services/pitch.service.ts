import { db } from "../db/client.ts";
import { pitches, ndas, pitchViews, follows } from "../db/schema.ts";
import { eq, and, desc, sql } from "npm:drizzle-orm";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const CreatePitchSchema = z.object({
  title: z.string().min(1).max(200),
  logline: z.string().min(10).max(500),
  genre: z.enum(["drama", "comedy", "thriller", "horror", "scifi", "fantasy", "documentary", "animation", "action", "romance", "other"]),
  format: z.enum(["feature", "tv", "short", "webseries", "other"]),
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
});

export class PitchService {
  static async create(userId: number, data: z.infer<typeof CreatePitchSchema>) {
    const validated = CreatePitchSchema.parse(data);
    
    // Convert number to string for decimal fields
    const insertData = {
      userId,
      ...validated,
      status: "draft" as const,
      estimatedBudget: validated.estimatedBudget ? validated.estimatedBudget.toString() : undefined,
    };
    
    const [pitch] = await db.insert(pitches)
      .values(insertData)
      .returning();
    
    return pitch;
  }
  
  static async update(pitchId: number, userId: number, data: Partial<z.infer<typeof CreatePitchSchema>>) {
    // Check ownership
    const pitch = await db.query.pitches.findFirst({
      where: and(
        eq(pitches.id, pitchId),
        eq(pitches.userId, userId)
      ),
    });
    
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
    
    return published;
  }
  
  static async getPitch(pitchId: number, viewerId?: number) {
    // Get pitch with creator and NDA info
    const pitch = await db.query.pitches.findFirst({
      where: eq(pitches.id, pitchId),
      with: {
        creator: {
          columns: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            companyName: true,
            userType: true,
            profileImage: true,
          },
        },
        ndas: viewerId ? {
          where: eq(ndas.signerId, viewerId),
        } : undefined,
      },
    });
    
    if (!pitch) return null;
    
    // Record view
    if (viewerId) {
      await this.recordView(pitchId, viewerId);
    }
    
    // Determine access level
    const isOwner = viewerId === pitch.creator.id;
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
    const existing = await db.query.ndas.findFirst({
      where: and(
        eq(ndas.pitchId, pitchId),
        eq(ndas.signerId, signerId)
      ),
    });
    
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
    return await db.query.pitches.findMany({
      where: eq(pitches.status, "published"),
      orderBy: [desc(pitches.likeCount), desc(pitches.viewCount)],
      limit,
      with: {
        creator: {
          columns: {
            username: true,
            companyName: true,
          },
        },
      },
    });
  }
  
  static async getNewPitches(limit = 10) {
    return await db.query.pitches.findMany({
      where: eq(pitches.status, "published"),
      orderBy: [desc(pitches.publishedAt)],
      limit,
      with: {
        creator: {
          columns: {
            username: true,
            companyName: true,
          },
        },
      },
    });
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
    
    // TODO: Add full-text search for query parameter
    
    const [searchResults, totalCount] = await Promise.all([
      db.query.pitches.findMany({
        where: and(...conditions),
        limit: params.limit || 20,
        offset: params.offset || 0,
        orderBy: [desc(pitches.publishedAt)],
        with: {
          creator: {
            columns: {
              username: true,
              companyName: true,
            },
          },
        },
      }),
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
    const userPitches = await db.query.pitches.findMany({
      where: eq(pitches.userId, userId),
      orderBy: [desc(pitches.updatedAt)],
      with: {
        creator: {
          columns: {
            username: true,
            companyName: true,
          },
        },
      },
    });
    
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
  }
  
  static async deletePitch(pitchId: number, userId: number) {
    // Check ownership
    const pitch = await db.query.pitches.findFirst({
      where: and(
        eq(pitches.id, pitchId),
        eq(pitches.userId, userId)
      ),
    });
    
    if (!pitch) {
      throw new Error("Pitch not found or unauthorized");
    }
    
    // Delete the pitch
    await db.delete(pitches)
      .where(eq(pitches.id, pitchId));
    
    return { success: true };
  }
}