import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { pitches, ndas, users } from "../../../../src/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

interface MediaAccessLevel {
  canViewTeaser: boolean;
  canViewLookbook: boolean;
  canViewScript: boolean;
  canViewTrailer: boolean;
  canViewBudget: boolean;
  canViewTimeline: boolean;
  canViewPitchDeck: boolean;
  canRequestOffPlatform: boolean;
}

export const handler: Handlers = {
  async GET(req, ctx) {
    try {
      const pitchId = parseInt(ctx.params.pitchId);
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      
      let userId: number | null = null;
      if (token) {
        userId = await verifyToken(token);
      }

      // Get pitch details
      const pitch = await db.select({
        id: pitches.id,
        userId: pitches.userId,
        title: pitches.title,
        titleImage: pitches.titleImage,
        lookbookUrl: pitches.lookbookUrl,
        scriptUrl: pitches.scriptUrl,
        trailerUrl: pitches.trailerUrl,
        pitchDeckUrl: pitches.pitchDeckUrl,
        budgetBreakdownUrl: pitches.budgetBreakdownUrl,
        productionTimelineUrl: pitches.productionTimelineUrl,
        additionalMedia: pitches.additionalMedia,
        visibilitySettings: pitches.visibilitySettings,
        status: pitches.status,
      })
      .from(pitches)
      .where(eq(pitches.id, pitchId))
      .limit(1);

      if (!pitch.length || pitch[0].status !== 'published') {
        return new Response(JSON.stringify({ error: "Pitch not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const pitchData = pitch[0];
      let accessLevel: MediaAccessLevel = {
        canViewTeaser: true, // Everyone can view teaser
        canViewLookbook: false,
        canViewScript: false,
        canViewTrailer: false,
        canViewBudget: false,
        canViewTimeline: false,
        canViewPitchDeck: false,
        canRequestOffPlatform: false,
      };

      // Check if user is the owner
      if (userId && userId === pitchData.userId) {
        // Owner has full access
        accessLevel = {
          canViewTeaser: true,
          canViewLookbook: true,
          canViewScript: true,
          canViewTrailer: true,
          canViewBudget: true,
          canViewTimeline: true,
          canViewPitchDeck: true,
          canRequestOffPlatform: false, // Owner doesn't need to request
        };
      } else if (userId) {
        // Check if user has signed NDA
        const userNDA = await db.select({
          ndaType: ndas.ndaType,
          accessGranted: ndas.accessGranted,
          expiresAt: ndas.expiresAt,
        })
        .from(ndas)
        .where(and(
          eq(ndas.pitchId, pitchId),
          eq(ndas.signerId, userId),
          eq(ndas.accessGranted, true)
        ))
        .limit(1);

        if (userNDA.length && (!userNDA[0].expiresAt || userNDA[0].expiresAt > new Date())) {
          const ndaType = userNDA[0].ndaType;
          
          // Check if user is a verified production company
          const user = await db.select({
            userType: users.userType,
            companyVerified: users.companyVerified,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

          const isVerifiedProduction = user[0]?.userType === 'production' && user[0]?.companyVerified;

          // Set access based on NDA type
          if (ndaType === 'basic') {
            accessLevel = {
              canViewTeaser: true,
              canViewLookbook: true,
              canViewScript: false,
              canViewTrailer: true,
              canViewBudget: false,
              canViewTimeline: false,
              canViewPitchDeck: true,
              canRequestOffPlatform: false,
            };
          } else if (ndaType === 'enhanced') {
            accessLevel = {
              canViewTeaser: true,
              canViewLookbook: true,
              canViewScript: true,
              canViewTrailer: true,
              canViewBudget: isVerifiedProduction,
              canViewTimeline: isVerifiedProduction,
              canViewPitchDeck: true,
              canRequestOffPlatform: isVerifiedProduction,
            };
          } else if (ndaType === 'custom') {
            // Full access for custom NDAs
            accessLevel = {
              canViewTeaser: true,
              canViewLookbook: true,
              canViewScript: true,
              canViewTrailer: true,
              canViewBudget: true,
              canViewTimeline: true,
              canViewPitchDeck: true,
              canRequestOffPlatform: true,
            };
          }
        }
      }

      // Filter media based on access level
      const mediaResponse: any = {
        titleImage: pitchData.titleImage,
        accessLevel,
        media: {},
      };

      if (accessLevel.canViewLookbook && pitchData.lookbookUrl) {
        mediaResponse.media.lookbook = pitchData.lookbookUrl;
      }
      if (accessLevel.canViewScript && pitchData.scriptUrl) {
        mediaResponse.media.script = pitchData.scriptUrl;
      }
      if (accessLevel.canViewTrailer && pitchData.trailerUrl) {
        mediaResponse.media.trailer = pitchData.trailerUrl;
      }
      if (accessLevel.canViewPitchDeck && pitchData.pitchDeckUrl) {
        mediaResponse.media.pitchDeck = pitchData.pitchDeckUrl;
      }
      if (accessLevel.canViewBudget && pitchData.budgetBreakdownUrl) {
        mediaResponse.media.budgetBreakdown = pitchData.budgetBreakdownUrl;
      }
      if (accessLevel.canViewTimeline && pitchData.productionTimelineUrl) {
        mediaResponse.media.productionTimeline = pitchData.productionTimelineUrl;
      }

      // Filter additional media based on access
      if (pitchData.additionalMedia && Array.isArray(pitchData.additionalMedia)) {
        mediaResponse.media.additional = (pitchData.additionalMedia as any[]).filter((item: any) => {
          switch (item.type) {
            case 'lookbook': return accessLevel.canViewLookbook;
            case 'script': return accessLevel.canViewScript;
            case 'trailer': return accessLevel.canViewTrailer;
            case 'pitch_deck': return accessLevel.canViewPitchDeck;
            case 'budget_breakdown': return accessLevel.canViewBudget;
            case 'production_timeline': return accessLevel.canViewTimeline;
            default: return accessLevel.canViewTeaser;
          }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        pitchId,
        title: pitchData.title,
        ...mediaResponse,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching media access:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};