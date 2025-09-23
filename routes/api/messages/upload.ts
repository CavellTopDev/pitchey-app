import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { conversationParticipants } from "../../../src/db/schema.ts";
import { eq, and } from "drizzle-orm";
import { getUserFromToken } from "../../../utils/auth.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";

// File upload configuration
const UPLOAD_DIR = "./static/uploads/messages";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  // Documents
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
  // Video
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
  // Archives
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
];

export const handler: Handlers = {
  async POST(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await getUserFromToken(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Parse multipart form data
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const conversationId = formData.get("conversationId") as string;
      const messageType = formData.get("messageType") as string || "file";

      if (!file) {
        return new Response(JSON.stringify({ error: "No file provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return new Response(JSON.stringify({ 
          error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return new Response(JSON.stringify({ 
          error: `File type ${file.type} is not allowed` 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Validate conversation access if provided
      if (conversationId) {
        const convId = parseInt(conversationId);
        if (!isNaN(convId)) {
          const participation = await db.select({
            id: conversationParticipants.id,
          })
          .from(conversationParticipants)
          .where(and(
            eq(conversationParticipants.conversationId, convId),
            eq(conversationParticipants.userId, user.id),
            eq(conversationParticipants.isActive, true)
          ))
          .limit(1);

          if (participation.length === 0) {
            return new Response(JSON.stringify({ error: "You don't have access to this conversation" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }

      // Ensure upload directory exists
      await ensureDir(UPLOAD_DIR);

      // Generate unique filename
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileExtension = file.name.split('.').pop() || '';
      const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFilename = `${timestamp}_${randomSuffix}_${sanitizedOriginalName}`;
      const filePath = join(UPLOAD_DIR, uniqueFilename);

      // Save file to disk
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      await Deno.writeFile(filePath, fileBytes);

      // Determine file category
      let fileCategory: 'image' | 'document' | 'video' | 'audio' = 'document';
      if (file.type.startsWith('image/')) fileCategory = 'image';
      else if (file.type.startsWith('video/')) fileCategory = 'video';
      else if (file.type.startsWith('audio/')) fileCategory = 'audio';

      // Create file metadata
      const fileMetadata = {
        type: fileCategory,
        url: `/uploads/messages/${uniqueFilename}`,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.id,
      };

      // Store file metadata in database (you might want a separate files table)
      // For now, we'll return the metadata for use in message creation

      return new Response(JSON.stringify({
        success: true,
        file: fileMetadata,
        message: "File uploaded successfully",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  async DELETE(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await getUserFromToken(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const url = new URL(req.url);
      const filename = url.searchParams.get("filename");

      if (!filename) {
        return new Response(JSON.stringify({ error: "Filename is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Security check: ensure filename doesn't contain path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return new Response(JSON.stringify({ error: "Invalid filename" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const filePath = join(UPLOAD_DIR, filename);

      try {
        // Check if file exists
        const fileInfo = await Deno.stat(filePath);
        if (!fileInfo.isFile) {
          return new Response(JSON.stringify({ error: "File not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // In a production app, you'd want to verify that the user owns this file
        // For now, we'll just delete it
        await Deno.remove(filePath);

        return new Response(JSON.stringify({
          success: true,
          message: "File deleted successfully",
          filename,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          return new Response(JSON.stringify({ error: "File not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};