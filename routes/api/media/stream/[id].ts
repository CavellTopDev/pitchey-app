import { Handlers, RouteContext } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { ndas, pitches, users } from "../../../../src/db/schema.ts";
import { and, eq } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req: Request, ctx: RouteContext) {
    try {
      const mediaId = ctx.params.id;
      const url = new URL(req.url);
      const pitchId = parseInt(url.searchParams.get("pitchId") || "0");

      if (!mediaId || !pitchId) {
        return new Response("Media ID and Pitch ID required", { status: 400 });
      }

      // Get token from header or query param
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "") ||
        url.searchParams.get("token");

      let userId: number | null = null;
      if (token) {
        userId = await verifyToken(token);
      }

      // Get pitch and media details
      const pitch = await db.select().from(pitches)
        .where(eq(pitches.id, pitchId))
        .limit(1);

      if (!pitch.length) {
        return new Response("Pitch not found", { status: 404 });
      }

      const pitchData = pitch[0];
      const additionalMedia = pitchData.additionalMedia as any[] || [];
      const mediaFile = additionalMedia.find((m) => m.id === mediaId);

      if (!mediaFile) {
        return new Response("Media not found", { status: 404 });
      }

      // Check access permissions
      const canAccess = await checkMediaAccess(
        pitchData,
        mediaFile,
        userId,
        pitchId,
      );

      if (!canAccess.allowed) {
        return new Response(
          JSON.stringify({
            error: canAccess.reason,
            requiresNDA: canAccess.requiresNDA,
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Get file path and check if file exists
      const filePath = mediaFile.filePath;

      try {
        const fileInfo = await Deno.stat(filePath);
        const file = await Deno.open(filePath, { read: true });

        // Handle range requests for video streaming
        const range = req.headers.get("range");
        let start = 0;
        let end = fileInfo.size - 1;

        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          start = parseInt(parts[0], 10);
          end = parts[1] ? parseInt(parts[1], 10) : fileInfo.size - 1;
        }

        const contentLength = end - start + 1;
        const headers = new Headers({
          "Content-Type": getContentType(mediaFile.mimeType),
          "Accept-Ranges": "bytes",
          "Content-Length": contentLength.toString(),
          "Cache-Control": "private, max-age=3600",
        });

        if (range) {
          headers.set(
            "Content-Range",
            `bytes ${start}-${end}/${fileInfo.size}`,
          );
          headers.set("Content-Length", contentLength.toString());
        }

        // Create readable stream for the file range
        const stream = new ReadableStream({
          start(controller) {
            const buffer = new Uint8Array(64 * 1024); // 64KB chunks
            let position = start;

            const readChunk = async () => {
              try {
                if (position > end) {
                  file.close();
                  controller.close();
                  return;
                }

                await file.seek(position, Deno.SeekMode.Start);
                const chunkSize = Math.min(buffer.length, end - position + 1);
                const bytesRead = await file.read(
                  buffer.subarray(0, chunkSize),
                );

                if (bytesRead === null || bytesRead === 0) {
                  file.close();
                  controller.close();
                  return;
                }

                controller.enqueue(buffer.slice(0, bytesRead));
                position += bytesRead;
                readChunk();
              } catch (error) {
                file.close();
                controller.error(error);
              }
            };

            readChunk();
          },
        });

        const status = range ? 206 : 200;
        return new Response(stream, { status, headers });
      } catch (error) {
        console.error("Error reading file:", error);
        return new Response("File not found", { status: 404 });
      }
    } catch (error) {
      console.error("Error streaming media:", error);
      return new Response("Internal server error", { status: 500 });
    }
  },
};

async function checkMediaAccess(
  pitch: any,
  mediaFile: any,
  userId: number | null,
  pitchId: number,
): Promise<{ allowed: boolean; reason?: string; requiresNDA?: boolean }> {
  // Check if user is the owner
  if (userId && pitch.userId === userId) {
    return { allowed: true };
  }

  // Check access level requirements
  const accessLevel = mediaFile.accessLevel || "public";

  switch (accessLevel) {
    case "public":
      return { allowed: true };

    case "basic":
    case "enhanced":
    case "custom":
      if (!userId) {
        return {
          allowed: false,
          reason: "Authentication required for protected content",
          requiresNDA: true,
        };
      }

      // Check if user has signed appropriate NDA
      const ndaCheck = await db.select()
        .from(ndas)
        .where(and(
          eq(ndas.pitchId, pitchId),
          eq(ndas.signerId, userId),
          eq(ndas.accessGranted, true),
        ))
        .limit(1);

      if (ndaCheck.length === 0) {
        return {
          allowed: false,
          reason: "NDA signature required for this content",
          requiresNDA: true,
        };
      }

      const nda = ndaCheck[0];

      // Check if NDA level matches required access level
      const ndaLevel = nda.ndaType;
      const requiredLevel = accessLevel;

      if (requiredLevel === "enhanced" && ndaLevel === "basic") {
        return {
          allowed: false,
          reason: "Enhanced NDA required for this content",
          requiresNDA: true,
        };
      }

      if (
        requiredLevel === "custom" &&
        (ndaLevel === "basic" || ndaLevel === "enhanced")
      ) {
        return {
          allowed: false,
          reason: "Custom NDA required for this content",
          requiresNDA: true,
        };
      }

      // Check if NDA is still valid
      if (nda.expiresAt && new Date() > nda.expiresAt) {
        return {
          allowed: false,
          reason: "NDA has expired",
          requiresNDA: true,
        };
      }

      return { allowed: true };

    default:
      return {
        allowed: false,
        reason: "Unknown access level",
      };
  }
}

function getContentType(mimeType: string): string {
  // Ensure proper content types for streaming
  const contentTypes: { [key: string]: string } = {
    "video/mp4": "video/mp4",
    "video/quicktime": "video/quicktime",
    "video/x-msvideo": "video/avi",
    "video/mpeg": "video/mpeg",
    "video/webm": "video/webm",
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "application/pdf": "application/pdf",
    "text/plain": "text/plain",
    "application/msword": "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint": "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  return contentTypes[mimeType] || "application/octet-stream";
}
