import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitches, users, ndas, pitchViews, follows } from "../../../src/db/schema.ts";
import { eq, desc, and, sql } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  // Get all pitches for production company with enhanced data
  async GET(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

      // Verify user is a production company
      const user = await db.select({
        userType: users.userType,
        companyVerified: users.companyVerified,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

      if (!user.length || user[0].userType !== 'production') {
        return new Response(JSON.stringify({ 
          error: "Only production companies can access this endpoint" 
        }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get production company's own pitches
      const myPitches = await db.select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        shortSynopsis: pitches.shortSynopsis,
        titleImage: pitches.titleImage,
        status: pitches.status,
        viewCount: pitches.viewCount,
        likeCount: pitches.likeCount,
        ndaCount: pitches.ndaCount,
        createdAt: pitches.createdAt,
        publishedAt: pitches.publishedAt,
        mediaFiles: pitches.additionalMedia,
        budgetBracket: pitches.budgetBracket,
        estimatedBudget: pitches.estimatedBudget,
        hasLookbook: sql<boolean>`${pitches.lookbookUrl} IS NOT NULL`,
        hasScript: sql<boolean>`${pitches.scriptUrl} IS NOT NULL`,
        hasTrailer: sql<boolean>`${pitches.trailerUrl} IS NOT NULL`,
        hasPitchDeck: sql<boolean>`${pitches.pitchDeckUrl} IS NOT NULL`,
        hasBudgetBreakdown: sql<boolean>`${pitches.budgetBreakdownUrl} IS NOT NULL`,
        hasProductionTimeline: sql<boolean>`${pitches.productionTimelineUrl} IS NOT NULL`,
      })
      .from(pitches)
      .where(eq(pitches.userId, userId))
      .orderBy(desc(pitches.createdAt));

      // Get pitches with signed NDAs
      const ndasSigned = await db.select({
        pitchId: ndas.pitchId,
        ndaType: ndas.ndaType,
        signedAt: ndas.signedAt,
        expiresAt: ndas.expiresAt,
      })
      .from(ndas)
      .where(and(
        eq(ndas.signerId, userId),
        eq(ndas.accessGranted, true)
      ));

      const ndaMap = new Map(ndasSigned.map(nda => [
        nda.pitchId, 
        { 
          ndaType: nda.ndaType, 
          signedAt: nda.signedAt,
          expiresAt: nda.expiresAt 
        }
      ]));

      // Get followed pitches
      const followedPitches = await db.select({
        pitchId: follows.pitchId,
      })
      .from(follows)
      .where(eq(follows.followerId, userId));

      const followedSet = new Set(followedPitches.map(f => f.pitchId));

      // Get recent views
      const recentViews = await db.select({
        pitchId: pitchViews.pitchId,
        viewedAt: pitchViews.viewedAt,
      })
      .from(pitchViews)
      .where(eq(pitchViews.viewerId, userId))
      .orderBy(desc(pitchViews.viewedAt))
      .limit(10);

      // Combine data
      const enrichedPitches = myPitches.map(pitch => ({
        ...pitch,
        isOwned: true,
        hasNDA: false,
        ndaDetails: null,
        isFollowing: followedSet.has(pitch.id),
        lastViewed: recentViews.find(v => v.pitchId === pitch.id)?.viewedAt || null,
      }));

      // Get accessible pitches (with NDAs)
      if (ndaMap.size > 0) {
        const accessiblePitches = await db.select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          shortSynopsis: pitches.shortSynopsis,
          titleImage: pitches.titleImage,
          status: pitches.status,
          viewCount: pitches.viewCount,
          likeCount: pitches.likeCount,
          ndaCount: pitches.ndaCount,
          createdAt: pitches.createdAt,
          publishedAt: pitches.publishedAt,
          creator: {
            id: users.id,
            username: users.username,
            userType: users.userType,
            companyName: users.companyName,
          },
        })
        .from(pitches)
        .innerJoin(users, eq(pitches.userId, users.id))
        .where(sql`${pitches.id} IN ${Array.from(ndaMap.keys())}`)
        .orderBy(desc(pitches.createdAt));

        const accessibleEnriched = accessiblePitches.map(pitch => ({
          ...pitch,
          isOwned: false,
          hasNDA: true,
          ndaDetails: ndaMap.get(pitch.id),
          isFollowing: followedSet.has(pitch.id),
          lastViewed: recentViews.find(v => v.pitchId === pitch.id)?.viewedAt || null,
        }));

        enrichedPitches.push(...accessibleEnriched);
      }

      return new Response(JSON.stringify({
        success: true,
        pitches: enrichedPitches,
        stats: {
          totalOwned: myPitches.length,
          totalWithNDA: ndaMap.size,
          totalFollowing: followedSet.size,
          isVerified: user[0].companyVerified,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching production pitches:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // Create a new production pitch
  async POST(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

      // Verify user is a production company
      const user = await db.select({
        userType: users.userType,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

      if (!user.length || user[0].userType !== 'production') {
        return new Response(JSON.stringify({ 
          error: "Only production companies can create production pitches" 
        }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const {
        title,
        logline,
        genre,
        format,
        shortSynopsis,
        longSynopsis,
        targetAudience,
        characters,
        themes,
        budgetBracket,
        estimatedBudget,
        productionTimeline,
        visibilitySettings,
        status = 'draft',
      } = body;

      // Validate required fields
      if (!title || !logline || !genre || !format) {
        return new Response(JSON.stringify({ 
          error: "Title, logline, genre, and format are required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create pitch
      const newPitch = await db.insert(pitches).values({
        userId,
        title,
        logline,
        genre,
        format,
        shortSynopsis,
        longSynopsis,
        targetAudience,
        characters,
        themes,
        budgetBracket,
        estimatedBudget,
        productionTimeline,
        visibilitySettings: visibilitySettings || {
          showShortSynopsis: true,
          showCharacters: false,
          showBudget: false,
          showMedia: false,
        },
        status,
        publishedAt: status === 'published' ? new Date() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return new Response(JSON.stringify({
        success: true,
        pitch: newPitch[0],
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error creating production pitch:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};