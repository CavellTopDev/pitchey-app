/**
 * R2 Upload Handler Service
 * Complete file upload infrastructure with Cloudflare R2
 */

import { ApiResponseBuilder, ErrorCode } from '../utils/api-response';

export interface UploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  virusScanEnabled?: boolean;
}

export interface UploadMetadata {
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  category?: 'document' | 'media' | 'pitch' | 'nda' | 'profile';
  pitchId?: string;
  checksum?: string;
}

export interface UploadResponse {
  key: string;
  url: string;
  publicUrl?: string;
  metadata: UploadMetadata;
}

export class R2UploadHandler {
  private bucket: R2Bucket;
  private config: UploadConfig;

  constructor(bucket: R2Bucket, config: UploadConfig) {
    this.bucket = bucket;
    this.config = config;
  }

  /**
   * Handle generic file upload
   */
  async handleUpload(request: Request, userId: string): Promise<Response> {
    const builder = new ApiResponseBuilder(request);

    try {
      // Parse multipart form data
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return builder.error(ErrorCode.VALIDATION_ERROR, 'No file provided');
      }

      // Validate file
      const validation = await this.validateFile(file);
      if (!validation.valid) {
        return builder.error(ErrorCode.VALIDATION_ERROR, validation.error!);
      }

      // Generate unique key
      const key = this.generateKey(userId, file.name, 'general');

      // Upload to R2
      const uploadResult = await this.uploadToR2(key, file, userId);

      // Store metadata in database (would be implemented)
      await this.storeMetadata(uploadResult.metadata);

      return builder.success(uploadResult);

    } catch (error) {
      console.error('Upload error:', error);
      return builder.error(
        ErrorCode.INTERNAL_ERROR,
        'Failed to upload file'
      );
    }
  }

  /**
   * Handle document upload (PDFs, Word docs, etc.)
   */
  async handleDocumentUpload(request: Request, userId: string): Promise<Response> {
    const builder = new ApiResponseBuilder(request);

    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const pitchId = formData.get('pitchId') as string;
      const documentType = formData.get('type') as string; // 'script', 'nda', 'contract', etc.

      if (!file) {
        return builder.error(ErrorCode.VALIDATION_ERROR, 'No file provided');
      }

      // Validate document file types
      const allowedDocTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/rtf'
      ];

      if (!allowedDocTypes.includes(file.type)) {
        return builder.error(
          ErrorCode.VALIDATION_ERROR,
          'Invalid document type. Allowed: PDF, Word, Text, RTF'
        );
      }

      // Validate file size (max 50MB for documents)
      if (file.size > 50 * 1024 * 1024) {
        return builder.error(
          ErrorCode.VALIDATION_ERROR,
          'Document size exceeds 50MB limit'
        );
      }

      // Scan for viruses if enabled
      if (this.config.virusScanEnabled) {
        const scanResult = await this.scanFile(file);
        if (!scanResult.clean) {
          return builder.error(
            ErrorCode.VALIDATION_ERROR,
            'File failed security scan'
          );
        }
      }

      // Generate key with document category
      const key = this.generateKey(userId, file.name, 'document', pitchId);

      // Upload with metadata
      const metadata: UploadMetadata = {
        userId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        category: 'document',
        pitchId,
        checksum: await this.calculateChecksum(file)
      };

      const uploadResult = await this.uploadToR2(key, file, userId, metadata);

      // Store in database
      await this.storeDocumentRecord(uploadResult, documentType);

      return builder.success({
        ...uploadResult,
        documentType
      });

    } catch (error) {
      console.error('Document upload error:', error);
      return builder.error(
        ErrorCode.INTERNAL_ERROR,
        'Failed to upload document'
      );
    }
  }

  /**
   * Handle media upload (images, videos, audio)
   */
  async handleMediaUpload(request: Request, userId: string): Promise<Response> {
    const builder = new ApiResponseBuilder(request);

    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const pitchId = formData.get('pitchId') as string;
      const mediaType = formData.get('type') as string; // 'poster', 'trailer', 'gallery'

      if (!file) {
        return builder.error(ErrorCode.VALIDATION_ERROR, 'No file provided');
      }

      // Validate media file types
      const allowedMediaTypes = {
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
        audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac']
      };

      const fileCategory = this.getMediaCategory(file.type);
      if (!fileCategory) {
        return builder.error(
          ErrorCode.VALIDATION_ERROR,
          'Unsupported media type'
        );
      }

      // Apply size limits based on media type
      const sizeLimits = {
        image: 10 * 1024 * 1024,  // 10MB
        video: 500 * 1024 * 1024, // 500MB
        audio: 50 * 1024 * 1024   // 50MB
      };

      if (file.size > sizeLimits[fileCategory]) {
        return builder.error(
          ErrorCode.VALIDATION_ERROR,
          `${fileCategory} size exceeds limit of ${sizeLimits[fileCategory] / (1024 * 1024)}MB`
        );
      }

      // Process media (generate thumbnails for images/videos)
      let thumbnail: string | undefined;
      if (fileCategory === 'image' || fileCategory === 'video') {
        thumbnail = await this.generateThumbnail(file);
      }

      // Generate key with media category
      const key = this.generateKey(userId, file.name, 'media', pitchId);

      // Upload main file
      const metadata: UploadMetadata = {
        userId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        category: 'media',
        pitchId,
        checksum: await this.calculateChecksum(file)
      };

      const uploadResult = await this.uploadToR2(key, file, userId, metadata);

      // Upload thumbnail if generated
      let thumbnailUrl: string | undefined;
      if (thumbnail) {
        const thumbKey = `${key}-thumb`;
        await this.bucket.put(thumbKey, thumbnail);
        thumbnailUrl = this.getPublicUrl(thumbKey);
      }

      // Store in database
      await this.storeMediaRecord(uploadResult, mediaType, thumbnailUrl);

      return builder.success({
        ...uploadResult,
        mediaType,
        thumbnailUrl
      });

    } catch (error) {
      console.error('Media upload error:', error);
      return builder.error(
        ErrorCode.INTERNAL_ERROR,
        'Failed to upload media'
      );
    }
  }

  /**
   * Delete uploaded file
   */
  async deleteFile(key: string, userId: string): Promise<Response> {
    const builder = new ApiResponseBuilder();

    try {
      // Verify ownership
      const metadata = await this.bucket.head(key);
      if (!metadata || metadata.customMetadata?.userId !== userId) {
        return builder.error(
          ErrorCode.FORBIDDEN,
          'Not authorized to delete this file'
        );
      }

      // Delete from R2
      await this.bucket.delete(key);

      // Delete from database
      await this.deleteMetadata(key);

      return builder.noContent();

    } catch (error) {
      console.error('Delete file error:', error);
      return builder.error(
        ErrorCode.INTERNAL_ERROR,
        'Failed to delete file'
      );
    }
  }

  /**
   * Get signed URL for private file access
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    // R2 doesn't support signed URLs directly in Workers
    // Instead, we'll use a proxy approach through the worker
    const baseUrl = 'https://pitchey-production.cavelltheleaddev.workers.dev';
    const timestamp = Date.now();
    const expires = timestamp + (expiresIn * 1000);
    
    // Generate signature (simplified - use proper HMAC in production)
    const signature = await this.generateSignature(key, expires);
    
    return `${baseUrl}/api/files/${key}?expires=${expires}&signature=${signature}`;
  }

  /**
   * Stream file from R2
   */
  async streamFile(key: string): Promise<Response> {
    try {
      const object = await this.bucket.get(key);
      
      if (!object) {
        return new Response('File not found', { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);

      return new Response(object.body, {
        headers
      });

    } catch (error) {
      console.error('Stream file error:', error);
      return new Response('Failed to stream file', { status: 500 });
    }
  }

  // Private helper methods

  private async validateFile(file: File): Promise<{ valid: boolean; error?: string }> {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds ${this.config.maxFileSize / (1024 * 1024)}MB limit`
      };
    }

    // Check mime type
    if (!this.config.allowedMimeTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`
      };
    }

    // Check file extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    const dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'jar'];
    if (ext && dangerousExtensions.includes(ext)) {
      return {
        valid: false,
        error: 'Potentially dangerous file type'
      };
    }

    return { valid: true };
  }

  private generateKey(
    userId: string,
    fileName: string,
    category: string,
    pitchId?: string
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    if (pitchId) {
      return `${category}/${userId}/${pitchId}/${timestamp}-${random}-${sanitizedFileName}`;
    }
    
    return `${category}/${userId}/${timestamp}-${random}-${sanitizedFileName}`;
  }

  private async uploadToR2(
    key: string,
    file: File,
    userId: string,
    metadata?: UploadMetadata
  ): Promise<UploadResponse> {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Prepare R2 metadata
    const customMetadata = {
      userId,
      fileName: file.name,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
      ...(metadata && {
        category: metadata.category,
        pitchId: metadata.pitchId
      })
    };

    // Upload to R2
    await this.bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000'
      },
      customMetadata
    });

    // Generate URLs
    const url = this.getPrivateUrl(key);
    const publicUrl = this.getPublicUrl(key);

    return {
      key,
      url,
      publicUrl,
      metadata: metadata || {
        userId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString()
      }
    };
  }

  private getPrivateUrl(key: string): string {
    return `https://pitchey-production.cavelltheleaddev.workers.dev/api/files/${key}`;
  }

  private getPublicUrl(key: string): string {
    // R2 public URL pattern (if public access is enabled on bucket)
    return `https://pub-pitchey.r2.dev/${key}`;
  }

  private getMediaCategory(mimeType: string): 'image' | 'video' | 'audio' | null {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return null;
  }

  private async calculateChecksum(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async generateSignature(key: string, expires: number): Promise<string> {
    const data = `${key}:${expires}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Use a secret key (should be from environment)
    const keyBuffer = encoder.encode('your-secret-key');
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  private async scanFile(file: File): Promise<{ clean: boolean }> {
    // Implement virus scanning integration
    // This would typically call an external service like ClamAV or VirusTotal
    // For now, return true (clean)
    return { clean: true };
  }

  private async generateThumbnail(file: File): Promise<string | undefined> {
    // Implement thumbnail generation
    // This would use an image processing library or external service
    // For now, return undefined
    return undefined;
  }

  // Database operations (to be implemented with actual database)

  private async storeMetadata(metadata: UploadMetadata): Promise<void> {
    // Store file metadata in database
    console.log('Storing metadata:', metadata);
  }

  private async storeDocumentRecord(
    upload: UploadResponse,
    documentType: string
  ): Promise<void> {
    // Store document record in database
    console.log('Storing document:', upload, documentType);
  }

  private async storeMediaRecord(
    upload: UploadResponse,
    mediaType: string,
    thumbnailUrl?: string
  ): Promise<void> {
    // Store media record in database
    console.log('Storing media:', upload, mediaType, thumbnailUrl);
  }

  private async deleteMetadata(key: string): Promise<void> {
    // Delete metadata from database
    console.log('Deleting metadata for key:', key);
  }
}

/**
 * Multipart form data parser utility
 */
export class MultipartParser {
  static async parseFormData(request: Request): Promise<FormData> {
    const contentType = request.headers.get('content-type');
    
    if (!contentType?.includes('multipart/form-data')) {
      throw new Error('Expected multipart/form-data');
    }

    return request.formData();
  }

  static extractBoundary(contentType: string): string | null {
    const match = contentType.match(/boundary=([^;]+)/);
    return match ? match[1] : null;
  }
}

/**
 * File validation utilities
 */
export class FileValidation {
  static readonly DANGEROUS_EXTENSIONS = [
    'exe', 'bat', 'cmd', 'sh', 'ps1', 'jar', 'app',
    'vbs', 'vbe', 'js', 'jse', 'ws', 'wsf', 'scr',
    'msi', 'com', 'pif', 'gadget', 'hta', 'cpl', 'msc'
  ];

  static readonly MIME_TYPE_EXTENSIONS: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
    'video/mp4': ['mp4'],
    'video/quicktime': ['mov'],
    'audio/mpeg': ['mp3'],
    'audio/wav': ['wav']
  };

  static isDangerousFile(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext ? this.DANGEROUS_EXTENSIONS.includes(ext) : false;
  }

  static validateMimeType(fileName: string, mimeType: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const validExtensions = this.MIME_TYPE_EXTENSIONS[mimeType];
    
    if (!ext || !validExtensions) {
      return false;
    }

    return validExtensions.includes(ext);
  }
}