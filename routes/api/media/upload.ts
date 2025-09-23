import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { ndas, pitches, users } from "../../../src/db/schema.ts";
import { and, eq } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";
import { encodeBase64 } from "https://deno.land/std@0.220.0/encoding/base64.ts";

interface UploadedFile {
  id: string;
  type:
    | "lookbook"
    | "script"
    | "trailer"
    | "pitch_deck"
    | "budget_breakdown"
    | "production_timeline"
    | "other";
  url: string;
  title: string;
  description?: string;
  size: number;
  mimeType: string;
  hasWatermark: boolean;
  accessLevel: "public" | "basic" | "enhanced" | "custom";
  filePath: string;
}

export const handler: Handlers = {
  async POST(req: Request) {
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

      const formData = await req.formData();
      const pitchId = parseInt(formData.get("pitchId") as string);
      const fileType = formData.get("fileType") as string || "other";
      const title = formData.get("title") as string;
      const description = formData.get("description") as string;
      const applyWatermark = formData.get("applyWatermark") === "true";
      const accessLevel = formData.get("accessLevel") as string || "public";

      // Verify pitch ownership
      const pitch = await db.select().from(pitches)
        .where(eq(pitches.id, pitchId))
        .limit(1);

      if (!pitch.length || pitch[0].userId !== userId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized to upload to this pitch" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const uploadedFiles: UploadedFile[] = [];
      const entries: [string, FormDataEntryValue][] = Array.from(
        formData.entries(),
      );

      for (const [key, value] of entries) {
        if (key.startsWith("file") && value instanceof File) {
          const file = value as File;

          // Validate file size based on type
          const maxSize = file.type.startsWith("video/")
            ? 500 * 1024 * 1024
            : 50 * 1024 * 1024; // 500MB for video, 50MB for others
          if (file.size > maxSize) {
            const limit = file.type.startsWith("video/") ? "500MB" : "50MB";
            return new Response(
              JSON.stringify({
                error: `File ${file.name} exceeds ${limit} limit`,
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Validate file type
          const allowedTypes = {
            "lookbook": [
              "application/pdf",
              "image/jpeg",
              "image/png",
              "image/jpg",
            ],
            "script": [
              "application/pdf",
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "text/plain",
            ],
            "trailer": [
              "video/mp4",
              "video/quicktime",
              "video/x-msvideo",
              "video/mpeg",
              "video/webm",
            ],
            "pitch_deck": [
              "application/pdf",
              "application/vnd.ms-powerpoint",
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ],
            "budget_breakdown": [
              "application/pdf",
              "application/vnd.ms-excel",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "text/csv",
            ],
            "production_timeline": [
              "application/pdf",
              "image/jpeg",
              "image/png",
              "image/jpg",
            ],
            "other": [
              "application/pdf",
              "image/jpeg",
              "image/png",
              "image/jpg",
              "video/mp4",
              "video/quicktime",
              "text/plain",
            ],
          };

          const validTypes =
            allowedTypes[fileType as keyof typeof allowedTypes] || [];
          if (validTypes.length && !validTypes.includes(file.type)) {
            return new Response(
              JSON.stringify({
                error: `Invalid file type ${file.type} for ${fileType}`,
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Process file
          const bytes = new Uint8Array(await file.arrayBuffer());
          let processedBytes: Uint8Array = bytes;

          // Apply watermark if requested and file is an image or PDF
          if (
            applyWatermark &&
            (file.type.startsWith("image/") || file.type === "application/pdf")
          ) {
            processedBytes = await applyWatermarkToFile(
              bytes,
              file.type,
              pitch[0].title,
            );
          }

          // Generate unique filename with UUID
          const fileId = crypto.randomUUID();
          const fileExtension = file.name.split(".").pop() || "";
          const timestamp = Date.now();
          const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const fileName = `${fileId}_${timestamp}_${safeFileName}`;

          // Save to local uploads directory (structured by pitch ID)
          const uploadDir = `./static/uploads/${pitchId}`;
          await Deno.mkdir(uploadDir, { recursive: true });
          const filePath = `${uploadDir}/${fileName}`;
          await Deno.writeFile(filePath, processedBytes);

          // Generate URL for accessing the file
          const fileUrl = `/static/uploads/${pitchId}/${fileName}`;

          uploadedFiles.push({
            id: fileId,
            type: fileType as UploadedFile["type"],
            url: fileUrl,
            title: title || file.name,
            description,
            size: file.size,
            mimeType: file.type,
            hasWatermark: applyWatermark,
            accessLevel: accessLevel as UploadedFile["accessLevel"],
            filePath: filePath,
          });
        }
      }

      // Update pitch with new media files
      const existingMedia = pitch[0].additionalMedia || [];
      const updatedMedia = [
        ...(Array.isArray(existingMedia) ? existingMedia : []),
        ...uploadedFiles.map((f) => ({
          id: f.id,
          type: f.type,
          url: f.url,
          title: f.title,
          description: f.description,
          uploadedAt: new Date().toISOString(),
          hasWatermark: f.hasWatermark,
          size: f.size,
          mimeType: f.mimeType,
          accessLevel: f.accessLevel,
          filePath: f.filePath,
        })),
      ];

      // Also update specific media URLs based on type
      const updateFields: any = {
        additionalMedia: updatedMedia,
        updatedAt: new Date(),
      };

      // Set primary URLs for each type (first uploaded file of that type)
      for (const file of uploadedFiles) {
        switch (file.type) {
          case "lookbook":
            if (!pitch[0].lookbookUrl) updateFields.lookbookUrl = file.url;
            break;
          case "script":
            if (!pitch[0].scriptUrl) updateFields.scriptUrl = file.url;
            break;
          case "trailer":
            if (!pitch[0].trailerUrl) updateFields.trailerUrl = file.url;
            break;
          case "pitch_deck":
            if (!pitch[0].pitchDeckUrl) updateFields.pitchDeckUrl = file.url;
            break;
          case "budget_breakdown":
            if (!pitch[0].budgetBreakdownUrl) {
              updateFields.budgetBreakdownUrl = file.url;
            }
            break;
          case "production_timeline":
            if (!pitch[0].productionTimelineUrl) {
              updateFields.productionTimelineUrl = file.url;
            }
            break;
        }
      }

      await db.update(pitches)
        .set(updateFields)
        .where(eq(pitches.id, pitchId));

      return new Response(
        JSON.stringify({
          success: true,
          files: uploadedFiles,
          message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Error uploading media:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

// Watermarking function (simplified version)
async function applyWatermarkToFile(
  bytes: Uint8Array,
  mimeType: string,
  pitchTitle: string,
): Promise<Uint8Array> {
  // In production, this would use ImageMagick or similar
  // For now, return the original bytes
  // Watermark would include:
  // - "CONFIDENTIAL - [Pitch Title]"
  // - "© [Year] - NDA Protected"
  // - Semi-transparent overlay

  // This is a placeholder - actual implementation would:
  // 1. For images: Use canvas API or ImageMagick to overlay text
  // 2. For PDFs: Use PDF libraries to add watermark to each page

  console.log(
    `Would apply watermark to ${mimeType} file for pitch: ${pitchTitle}`,
  );
  return bytes;
}
