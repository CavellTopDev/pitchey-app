/**
 * R2 Multipart Upload Handler for Large Files (up to 1GB)
 * Implements chunked upload with resume support
 */

import type { Env, AuthPayload, SentryLogger } from '../types/worker-types';

export interface MultipartUploadSession {
  uploadId: string;
  key: string;
  bucket: string;
  userId: number;
  filename: string;
  contentType: string;
  totalSize: number;
  chunkSize: number;
  totalParts: number;
  uploadedParts: number[];
  createdAt: string;
  expiresAt: string;
}

export interface UploadPartResult {
  partNumber: number;
  etag: string;
}

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB minimum (R2 requirement)
const MAX_PARTS = 10000; // R2 limit
const UPLOAD_EXPIRY_HOURS = 24;

export class MultipartUploadHandler {
  constructor(
    private env: Env,
    private sentry: SentryLogger
  ) {}

  async handleMultipartRequest(
    request: Request,
    path: string,
    method: string,
    userAuth?: AuthPayload
  ): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': this.env.FRONTEND_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upload-Id, X-Part-Number',
      'Access-Control-Max-Age': '86400',
    };

    try {
      if (method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      if (!userAuth) {
        return this.errorResponse('Authentication required', 401, corsHeaders);
      }

      // Route handling
      if (path === '/api/upload/multipart/initiate' && method === 'POST') {
        return this.initiateUpload(request, corsHeaders, userAuth);
      }

      if (path === '/api/upload/multipart/part' && method === 'PUT') {
        return this.uploadPart(request, corsHeaders, userAuth);
      }

      if (path === '/api/upload/multipart/complete' && method === 'POST') {
        return this.completeUpload(request, corsHeaders, userAuth);
      }

      if (path === '/api/upload/multipart/abort' && method === 'POST') {
        return this.abortUpload(request, corsHeaders, userAuth);
      }

      if (path === '/api/upload/multipart/status' && method === 'GET') {
        return this.getUploadStatus(request, corsHeaders, userAuth);
      }

      return this.errorResponse('Multipart endpoint not found', 404, corsHeaders);
    } catch (error) {
      await this.sentry.captureError(error as Error, { path, method, userId: userAuth?.userId });
      return this.errorResponse('Internal server error', 500, corsHeaders);
    }
  }

  /**
   * Initiate a new multipart upload
   */
  private async initiateUpload(
    request: Request,
    corsHeaders: Record<string, string>,
    userAuth: AuthPayload
  ): Promise<Response> {
    try {
      const body = await request.json() as {
        filename: string;
        contentType: string;
        fileSize: number;
        folder?: string;
        chunkSize?: number;
      };

      const { filename, contentType, fileSize, folder = 'uploads', chunkSize = DEFAULT_CHUNK_SIZE } = body;

      // Validation
      if (!filename || !contentType || !fileSize) {
        return this.errorResponse('filename, contentType, and fileSize are required', 400, corsHeaders);
      }

      if (fileSize > MAX_FILE_SIZE) {
        return this.errorResponse(`File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB`, 400, corsHeaders);
      }

      const effectiveChunkSize = Math.max(chunkSize, MIN_CHUNK_SIZE);
      const totalParts = Math.ceil(fileSize / effectiveChunkSize);

      if (totalParts > MAX_PARTS) {
        return this.errorResponse(`Too many parts. Increase chunk size or reduce file size`, 400, corsHeaders);
      }

      // Generate unique key
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `${folder}/${userAuth.userId}/${timestamp}_${random}_${sanitizedFilename}`;

      // Get R2 bucket based on content type
      const bucket = this.getBucketForContentType(contentType);
      const r2Bucket = this.getR2Bucket(bucket);

      if (!r2Bucket) {
        return this.errorResponse('Storage not available', 503, corsHeaders);
      }

      // Create multipart upload in R2
      const multipartUpload = await r2Bucket.createMultipartUpload(key, {
        httpMetadata: {
          contentType,
        },
        customMetadata: {
          userId: userAuth.userId.toString(),
          originalFilename: filename,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Store session in KV for tracking
      const session: MultipartUploadSession = {
        uploadId: multipartUpload.uploadId,
        key,
        bucket,
        userId: userAuth.userId,
        filename,
        contentType,
        totalSize: fileSize,
        chunkSize: effectiveChunkSize,
        totalParts,
        uploadedParts: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + UPLOAD_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
      };

      // Store session in KV
      if (this.env.CACHE) {
        await this.env.CACHE.put(
          `multipart:${multipartUpload.uploadId}`,
          JSON.stringify(session),
          { expirationTtl: UPLOAD_EXPIRY_HOURS * 60 * 60 }
        );
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          uploadId: multipartUpload.uploadId,
          key,
          chunkSize: effectiveChunkSize,
          totalParts,
          expiresAt: session.expiresAt,
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId: userAuth.userId });
      return this.errorResponse('Failed to initiate upload', 500, corsHeaders);
    }
  }

  /**
   * Upload a single part/chunk
   */
  private async uploadPart(
    request: Request,
    corsHeaders: Record<string, string>,
    userAuth: AuthPayload
  ): Promise<Response> {
    try {
      const uploadId = request.headers.get('X-Upload-Id');
      const partNumberStr = request.headers.get('X-Part-Number');

      if (!uploadId || !partNumberStr) {
        return this.errorResponse('X-Upload-Id and X-Part-Number headers required', 400, corsHeaders);
      }

      const partNumber = parseInt(partNumberStr);
      if (isNaN(partNumber) || partNumber < 1) {
        return this.errorResponse('Invalid part number', 400, corsHeaders);
      }

      // Get session from KV
      const session = await this.getSession(uploadId);
      if (!session) {
        return this.errorResponse('Upload session not found or expired', 404, corsHeaders);
      }

      // Verify ownership
      if (session.userId !== userAuth.userId) {
        return this.errorResponse('Unauthorized', 403, corsHeaders);
      }

      // Get the part data
      const partData = await request.arrayBuffer();
      if (partData.byteLength === 0) {
        return this.errorResponse('Empty part data', 400, corsHeaders);
      }

      // Get R2 bucket
      const r2Bucket = this.getR2Bucket(session.bucket);
      if (!r2Bucket) {
        return this.errorResponse('Storage not available', 503, corsHeaders);
      }

      // Resume the multipart upload and upload the part
      const multipartUpload = r2Bucket.resumeMultipartUpload(session.key, uploadId);
      const uploadedPart = await multipartUpload.uploadPart(partNumber, partData);

      // Update session with uploaded part
      if (!session.uploadedParts.includes(partNumber)) {
        session.uploadedParts.push(partNumber);
        session.uploadedParts.sort((a, b) => a - b);

        if (this.env.CACHE) {
          await this.env.CACHE.put(
            `multipart:${uploadId}`,
            JSON.stringify(session),
            { expirationTtl: UPLOAD_EXPIRY_HOURS * 60 * 60 }
          );
        }
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          partNumber,
          etag: uploadedPart.etag,
          uploadedParts: session.uploadedParts.length,
          totalParts: session.totalParts,
          progress: Math.round((session.uploadedParts.length / session.totalParts) * 100),
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId: userAuth.userId });
      return this.errorResponse('Failed to upload part', 500, corsHeaders);
    }
  }

  /**
   * Complete the multipart upload
   */
  private async completeUpload(
    request: Request,
    corsHeaders: Record<string, string>,
    userAuth: AuthPayload
  ): Promise<Response> {
    try {
      const body = await request.json() as {
        uploadId: string;
        parts: UploadPartResult[];
      };

      const { uploadId, parts } = body;

      if (!uploadId || !parts || parts.length === 0) {
        return this.errorResponse('uploadId and parts array required', 400, corsHeaders);
      }

      // Get session
      const session = await this.getSession(uploadId);
      if (!session) {
        return this.errorResponse('Upload session not found or expired', 404, corsHeaders);
      }

      // Verify ownership
      if (session.userId !== userAuth.userId) {
        return this.errorResponse('Unauthorized', 403, corsHeaders);
      }

      // Verify all parts uploaded
      if (parts.length !== session.totalParts) {
        return this.errorResponse(`Expected ${session.totalParts} parts, received ${parts.length}`, 400, corsHeaders);
      }

      // Get R2 bucket
      const r2Bucket = this.getR2Bucket(session.bucket);
      if (!r2Bucket) {
        return this.errorResponse('Storage not available', 503, corsHeaders);
      }

      // Complete the multipart upload
      const multipartUpload = r2Bucket.resumeMultipartUpload(session.key, uploadId);

      // Sort parts by part number
      const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);
      const uploadedParts = sortedParts.map(p => ({
        partNumber: p.partNumber,
        etag: p.etag,
      }));

      const object = await multipartUpload.complete(uploadedParts);

      // Generate URLs
      const cdnUrl = `https://${this.env.BACKEND_URL || 'pitchey-api-prod.ndlovucavelle.workers.dev'}/api/files/${session.key}`;

      // Clean up session
      if (this.env.CACHE) {
        await this.env.CACHE.delete(`multipart:${uploadId}`);
      }

      // Queue video processing if it's a video
      if (session.contentType.startsWith('video/')) {
        await this.queueVideoProcessing(session, cdnUrl);
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          url: cdnUrl,
          key: session.key,
          filename: session.filename,
          size: session.totalSize,
          contentType: session.contentType,
          etag: object.etag,
          uploadedAt: new Date().toISOString(),
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId: userAuth.userId });
      return this.errorResponse('Failed to complete upload', 500, corsHeaders);
    }
  }

  /**
   * Abort a multipart upload
   */
  private async abortUpload(
    request: Request,
    corsHeaders: Record<string, string>,
    userAuth: AuthPayload
  ): Promise<Response> {
    try {
      const body = await request.json() as { uploadId: string };
      const { uploadId } = body;

      if (!uploadId) {
        return this.errorResponse('uploadId required', 400, corsHeaders);
      }

      // Get session
      const session = await this.getSession(uploadId);
      if (!session) {
        return this.errorResponse('Upload session not found or expired', 404, corsHeaders);
      }

      // Verify ownership
      if (session.userId !== userAuth.userId) {
        return this.errorResponse('Unauthorized', 403, corsHeaders);
      }

      // Get R2 bucket
      const r2Bucket = this.getR2Bucket(session.bucket);
      if (r2Bucket) {
        const multipartUpload = r2Bucket.resumeMultipartUpload(session.key, uploadId);
        await multipartUpload.abort();
      }

      // Clean up session
      if (this.env.CACHE) {
        await this.env.CACHE.delete(`multipart:${uploadId}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Upload aborted'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId: userAuth.userId });
      return this.errorResponse('Failed to abort upload', 500, corsHeaders);
    }
  }

  /**
   * Get upload status for resume functionality
   */
  private async getUploadStatus(
    request: Request,
    corsHeaders: Record<string, string>,
    userAuth: AuthPayload
  ): Promise<Response> {
    try {
      const url = new URL(request.url);
      const uploadId = url.searchParams.get('uploadId');

      if (!uploadId) {
        return this.errorResponse('uploadId query parameter required', 400, corsHeaders);
      }

      // Get session
      const session = await this.getSession(uploadId);
      if (!session) {
        return this.errorResponse('Upload session not found or expired', 404, corsHeaders);
      }

      // Verify ownership
      if (session.userId !== userAuth.userId) {
        return this.errorResponse('Unauthorized', 403, corsHeaders);
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          uploadId: session.uploadId,
          filename: session.filename,
          totalSize: session.totalSize,
          chunkSize: session.chunkSize,
          totalParts: session.totalParts,
          uploadedParts: session.uploadedParts,
          progress: Math.round((session.uploadedParts.length / session.totalParts) * 100),
          expiresAt: session.expiresAt,
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId: userAuth.userId });
      return this.errorResponse('Failed to get upload status', 500, corsHeaders);
    }
  }

  /**
   * Queue video for processing via n8n webhook
   */
  private async queueVideoProcessing(session: MultipartUploadSession, fileUrl: string): Promise<void> {
    try {
      // Send to VIDEO_PROCESSING_QUEUE if available
      if (this.env.VIDEO_PROCESSING_QUEUE) {
        await this.env.VIDEO_PROCESSING_QUEUE.send({
          type: 'video_uploaded',
          uploadId: session.uploadId,
          key: session.key,
          filename: session.filename,
          contentType: session.contentType,
          fileSize: session.totalSize,
          fileUrl,
          userId: session.userId,
          timestamp: new Date().toISOString(),
        });
      }

      // Also trigger n8n webhook if configured
      const webhookUrl = this.env.N8N_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'video.uploaded',
            data: {
              key: session.key,
              filename: session.filename,
              contentType: session.contentType,
              fileSize: session.totalSize,
              fileUrl,
              userId: session.userId,
              timestamp: new Date().toISOString(),
            }
          })
        });
      }
    } catch (error) {
      // Don't fail the upload if webhook fails
      await this.sentry.captureError(error as Error, { context: 'queueVideoProcessing' });
    }
  }

  // Helper methods
  private async getSession(uploadId: string): Promise<MultipartUploadSession | null> {
    if (!this.env.CACHE) return null;

    const data = await this.env.CACHE.get(`multipart:${uploadId}`);
    if (!data) return null;

    try {
      return JSON.parse(data) as MultipartUploadSession;
    } catch {
      return null;
    }
  }

  private getBucketForContentType(contentType: string): string {
    if (contentType.startsWith('video/')) return 'MEDIA_STORAGE';
    if (contentType.startsWith('image/')) return 'MEDIA_STORAGE';
    if (contentType.startsWith('audio/')) return 'MEDIA_STORAGE';
    return 'PITCH_STORAGE';
  }

  private getR2Bucket(bucketName: string): R2Bucket | null {
    switch (bucketName) {
      case 'MEDIA_STORAGE': return this.env.MEDIA_STORAGE as R2Bucket;
      case 'PITCH_STORAGE': return this.env.PITCH_STORAGE as R2Bucket;
      case 'NDA_STORAGE': return this.env.NDA_STORAGE as R2Bucket;
      case 'PROCESSED_STORAGE': return this.env.PROCESSED_STORAGE as R2Bucket;
      case 'TEMP_STORAGE': return this.env.TEMP_STORAGE as R2Bucket;
      default: return this.env.MEDIA_STORAGE as R2Bucket;
    }
  }

  private errorResponse(message: string, status: number, corsHeaders: Record<string, string>): Response {
    return new Response(JSON.stringify({
      success: false,
      error: { message }
    }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
