import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitches } from "../../../src/db/schema.ts";
import { eq } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async DELETE(req: Request) {
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

      const body = await req.json();
      const { pitchId, mediaId } = body;

      if (!pitchId || !mediaId) {
        return new Response(
          JSON.stringify({ error: "Pitch ID and Media ID required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Verify pitch ownership
      const pitch = await db.select().from(pitches)
        .where(eq(pitches.id, pitchId))
        .limit(1);

      if (!pitch.length || pitch[0].userId !== userId) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized to delete media from this pitch",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const pitchData = pitch[0];
      const additionalMedia = pitchData.additionalMedia as any[] || [];
      const mediaIndex = additionalMedia.findIndex((m) => m.id === mediaId);

      if (mediaIndex === -1) {
        return new Response(JSON.stringify({ error: "Media not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const mediaFile = additionalMedia[mediaIndex];

      // Remove file from filesystem
      try {
        await Deno.remove(mediaFile.filePath);
      } catch (error) {
        console.warn("Warning: Could not delete file from filesystem:", error);
        // Continue with database cleanup even if file deletion fails
      }

      // Remove from additionalMedia array
      const updatedMedia = additionalMedia.filter((m) => m.id !== mediaId);

      // Prepare update fields
      const updateFields: any = {
        additionalMedia: updatedMedia,
        updatedAt: new Date(),
      };

      // Check if this was the primary media for any type and clear it
      const mediaType = mediaFile.type;
      switch (mediaType) {
        case "lookbook":
          if (pitchData.lookbookUrl === mediaFile.url) {
            updateFields.lookbookUrl = null;
          }
          break;
        case "script":
          if (pitchData.scriptUrl === mediaFile.url) {
            updateFields.scriptUrl = null;
          }
          break;
        case "trailer":
          if (pitchData.trailerUrl === mediaFile.url) {
            updateFields.trailerUrl = null;
          }
          break;
        case "pitch_deck":
          if (pitchData.pitchDeckUrl === mediaFile.url) {
            updateFields.pitchDeckUrl = null;
          }
          break;
        case "budget_breakdown":
          if (pitchData.budgetBreakdownUrl === mediaFile.url) {
            updateFields.budgetBreakdownUrl = null;
          }
          break;
        case "production_timeline":
          if (pitchData.productionTimelineUrl === mediaFile.url) {
            updateFields.productionTimelineUrl = null;
          }
          break;
      }

      // Update pitch in database
      await db.update(pitches)
        .set(updateFields)
        .where(eq(pitches.id, pitchId));

      // Calculate updated media counts by type
      const mediaCounts = updatedMedia.reduce((counts: any, media: any) => {
        counts[media.type] = (counts[media.type] || 0) + 1;
        return counts;
      }, {});

      return new Response(
        JSON.stringify({
          success: true,
          message: "Media deleted successfully",
          deletedMedia: {
            id: mediaId,
            title: mediaFile.title,
            type: mediaFile.type,
          },
          remainingMediaCount: updatedMedia.length,
          mediaCounts,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Error deleting media:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
