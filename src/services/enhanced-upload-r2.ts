/**
 * Enhanced R2 Upload Handler with Chunked/Multipart Support
 * Complete implementation for Cloudflare R2 with chunk assembly
 */

import { ApiResponseBuilder, ErrorCode } from '../utils/api-response';

export interface ChunkedUploadSession {
  sessionId: string;
  uploadId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  parts: Array<{
    partNumber: number;
    etag: string;
    checksum: string;
  }>;
  status: 'initializing' | 'uploading' | 'completing' | 'completed' | 'failed' | 'aborted';
  userId: string;
  category: 'document' | 'image' | 'video' | 'nda';
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface R2MultipartInfo {
  uploadId: string;
  key: string;
  bucket: string;
}

export class EnhancedR2UploadHandler {
  private bucket: R2Bucket;
  private sessions: Map<string, ChunkedUploadSession> = new Map();
  private multipartUploads: Map<string, R2MultipartInfo> = new Map();

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
    
    // Start cleanup interval for expired sessions
    this.startCleanupInterval();
  }

  /**
   * Initialize a chunked upload session
   */
  async initializeChunkedUpload(
    fileName: string,
    fileSize: number,
    mimeType: string,
    category: 'document' | 'image' | 'video' | 'nda',
    chunkSize: number,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<ChunkedUploadSession> {
    const sessionId = crypto.randomUUID();
    const uploadId = crypto.randomUUID();
    const fileKey = this.generateFileKey(userId, fileName, category);
    const totalChunks = Math.ceil(fileSize / chunkSize);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create R2 multipart upload
    const r2UploadId = await this.createMultipartUpload(fileKey, mimeType);

    const session: ChunkedUploadSession = {
      sessionId,
      uploadId,
      fileKey,
      fileName,
      fileSize,
      mimeType,
      chunkSize,
      totalChunks,
      uploadedChunks: [],
      parts: [],
      status: 'initializing',
      userId,
      category,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    // Store session and multipart info
    this.sessions.set(sessionId, session);
    this.multipartUploads.set(uploadId, {
      uploadId: r2UploadId,
      key: fileKey,
      bucket: this.bucket.name || 'pitchey-uploads'
    });

    return session;
  }

  /**
   * Upload a single chunk
   */
  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunkData: ArrayBuffer,
    expectedChecksum: string
  ): Promise<{ etag: string; checksum: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Upload session not found or expired');
    }

    if (session.status !== 'initializing' && session.status !== 'uploading') {
      throw new Error(`Cannot upload chunk for session in status: ${session.status}`);
    }

    // Validate checksum
    const actualChecksum = await this.calculateChecksum(chunkData);
    if (actualChecksum !== expectedChecksum) {
      throw new Error('Chunk checksum validation failed');
    }

    // Get multipart upload info
    const multipartInfo = this.multipartUploads.get(session.uploadId);
    if (!multipartInfo) {
      throw new Error('Multipart upload info not found');
    }

    const partNumber = chunkIndex + 1;

    try {
      // Upload chunk to R2
      const uploadResult = await this.uploadPartToR2(
        multipartInfo,
        partNumber,
        chunkData
      );

      // Update session
      session.status = 'uploading';
      session.uploadedChunks.push(chunkIndex);
      session.parts.push({
        partNumber,
        etag: uploadResult.etag,
        checksum: actualChecksum
      });
      session.updatedAt = new Date().toISOString();

      // Sort parts by part number to maintain order
      session.parts.sort((a, b) => a.partNumber - b.partNumber);

      this.sessions.set(sessionId, session);

      return {
        etag: uploadResult.etag,
        checksum: actualChecksum
      };

    } catch (error) {
      console.error(`Failed to upload chunk ${chunkIndex}:`, error);
      throw new Error(`Chunk upload failed: ${error.message}`);
    }
  }

  /**
   * Complete the multipart upload
   */
  async completeChunkedUpload(sessionId: string): Promise<{
    fileKey: string;
    fileName: string;
    fileSize: number;
    url: string;
    publicUrl?: string;
    metadata?: Record<string, any>;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Upload session not found or expired');
    }

    if (session.uploadedChunks.length !== session.totalChunks) {
      throw new Error(`Missing chunks: expected ${session.totalChunks}, got ${session.uploadedChunks.length}`);
    }

    // Validate all parts are present
    for (let i = 0; i < session.totalChunks; i++) {
      if (!session.uploadedChunks.includes(i)) {
        throw new Error(`Missing chunk ${i}`);
      }
    }

    const multipartInfo = this.multipartUploads.get(session.uploadId);
    if (!multipartInfo) {
      throw new Error('Multipart upload info not found');
    }

    session.status = 'completing';
    this.sessions.set(sessionId, session);

    try {
      // Complete the multipart upload
      await this.completeMultipartUpload(multipartInfo, session.parts);

      // Update session status
      session.status = 'completed';
      session.updatedAt = new Date().toISOString();
      this.sessions.set(sessionId, session);

      // Generate URLs
      const url = this.getPrivateFileUrl(session.fileKey);
      const publicUrl = this.getPublicFileUrl(session.fileKey);

      // Clean up
      this.multipartUploads.delete(session.uploadId);

      return {
        fileKey: session.fileKey,
        fileName: session.fileName,
        fileSize: session.fileSize,
        url,
        publicUrl,
        metadata: session.metadata
      };

    } catch (error) {
      session.status = 'failed';
      this.sessions.set(sessionId, session);
      console.error('Failed to complete multipart upload:', error);
      throw new Error(`Failed to complete upload: ${error.message}`);
    }
  }

  /**
   * Abort a chunked upload
   */
  async abortChunkedUpload(sessionId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return; // Already cleaned up
    }

    const multipartInfo = this.multipartUploads.get(session.uploadId);
    if (multipartInfo) {
      try {
        await this.abortMultipartUpload(multipartInfo);
      } catch (error) {
        console.warn('Failed to abort multipart upload:', error);
      }
      this.multipartUploads.delete(session.uploadId);
    }

    session.status = 'aborted';
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);

    // Schedule cleanup
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 5000);
  }

  /**
   * Get upload session info
   */
  getUploadSession(sessionId: string): ChunkedUploadSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get resume information for a session
   */
  getResumeInfo(sessionId: string): {
    canResume: boolean;
    uploadedChunks: number[];
    remainingChunks: number[];
    nextChunkIndex: number;
    reason?: string;
  } {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return {
        canResume: false,
        uploadedChunks: [],
        remainingChunks: [],
        nextChunkIndex: 0,
        reason: 'Session not found or expired'
      };
    }

    if (session.status === 'completed' || session.status === 'aborted') {
      return {
        canResume: false,
        uploadedChunks: session.uploadedChunks,
        remainingChunks: [],
        nextChunkIndex: session.totalChunks,
        reason: `Upload ${session.status}`
      };
    }

    const allChunks = Array.from({ length: session.totalChunks }, (_, i) => i);
    const remainingChunks = allChunks.filter(i => !session.uploadedChunks.includes(i));
    const nextChunkIndex = remainingChunks.length > 0 ? remainingChunks[0] : session.totalChunks;

    return {
      canResume: true,
      uploadedChunks: session.uploadedChunks,
      remainingChunks,
      nextChunkIndex
    };
  }

  // Private helper methods

  private generateFileKey(userId: string, fileName: string, category: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${category}/${userId}/${timestamp}-${random}-${sanitizedFileName}`;
  }

  private async createMultipartUpload(key: string, contentType: string): Promise<string> {
    try {
      // Create multipart upload using R2's createMultipartUpload method
      const multipart = await this.bucket.createMultipartUpload(key, {
        httpMetadata: {
          contentType,
          cacheControl: 'public, max-age=31536000'
        }
      });

      return multipart.uploadId;
    } catch (error) {
      console.error('Failed to create multipart upload:', error);
      throw new Error('Failed to initialize multipart upload');
    }
  }

  private async uploadPartToR2(
    multipartInfo: R2MultipartInfo,
    partNumber: number,
    data: ArrayBuffer
  ): Promise<{ etag: string }> {
    try {
      // Upload part using R2's uploadPart method
      const part = await this.bucket.uploadPart(multipartInfo.key, multipartInfo.uploadId, partNumber, data);
      
      return {
        etag: part.etag
      };
    } catch (error) {
      console.error(`Failed to upload part ${partNumber}:`, error);
      throw new Error(`Failed to upload part ${partNumber}`);
    }
  }

  private async completeMultipartUpload(
    multipartInfo: R2MultipartInfo,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void> {
    try {
      // Complete multipart upload
      await this.bucket.completeMultipartUpload(
        multipartInfo.key,
        multipartInfo.uploadId,
        parts.map(part => ({
          partNumber: part.partNumber,
          etag: part.etag
        }))
      );
    } catch (error) {
      console.error('Failed to complete multipart upload:', error);
      throw new Error('Failed to complete multipart upload');
    }
  }

  private async abortMultipartUpload(multipartInfo: R2MultipartInfo): Promise<void> {
    try {
      await this.bucket.abortMultipartUpload(multipartInfo.key, multipartInfo.uploadId);
    } catch (error) {
      console.error('Failed to abort multipart upload:', error);
      // Don't throw here, just log the warning
    }
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private getPrivateFileUrl(key: string): string {
    // Return worker URL for private file access
    return `https://pitchey-api-prod.ndlovucavelle.workers.dev/api/files/${encodeURIComponent(key)}`;
  }

  private getPublicFileUrl(key: string): string {
    // Return R2 public URL if public access is enabled
    return `https://pub-pitchey.r2.dev/${encodeURIComponent(key)}`;
  }

  private startCleanupInterval(): void {
    // Clean up expired sessions every hour
    const cleanupInterval = 60 * 60 * 1000; // 1 hour
    
    setInterval(() => {
      const now = Date.now();
      const expiredSessions: string[] = [];

      this.sessions.forEach((session, sessionId) => {
        const expiresAt = new Date(session.expiresAt).getTime();
        const isCompleted = session.status === 'completed';
        const completedMoreThanDay = isCompleted && 
          (now - new Date(session.updatedAt).getTime()) > 24 * 60 * 60 * 1000;

        if (expiresAt < now || completedMoreThanDay) {
          expiredSessions.push(sessionId);
        }
      });

      // Clean up expired sessions
      expiredSessions.forEach(sessionId => {
        const session = this.sessions.get(sessionId);
        if (session && session.status !== 'completed' && session.status !== 'aborted') {
          // Abort incomplete uploads
          this.abortChunkedUpload(sessionId, 'Session expired').catch(console.error);
        }
        this.sessions.delete(sessionId);
      });

      if (expiredSessions.length > 0) {
        console.log(`Cleaned up ${expiredSessions.length} expired upload sessions`);
      }
    }, cleanupInterval);
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    failedSessions: number;
    pendingCleanup: number;
  } {
    const sessions = Array.from(this.sessions.values());
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => ['initializing', 'uploading', 'completing'].includes(s.status)).length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      failedSessions: sessions.filter(s => s.status === 'failed').length,
      pendingCleanup: sessions.filter(s => s.status === 'aborted').length
    };
  }

  /**
   * Force cleanup of completed sessions
   */
  forceCleanup(): number {
    const completedSessions = Array.from(this.sessions.entries())
      .filter(([_, session]) => session.status === 'completed')
      .map(([sessionId, _]) => sessionId);

    completedSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
    });

    return completedSessions.length;
  }
}