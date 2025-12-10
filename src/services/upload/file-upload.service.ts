/**
 * File Upload Service
 * Handles multiple file uploads with R2 storage integration
 * Supports multipart uploads for large files
 */

import { R2Bucket } from '@cloudflare/workers-types';

export interface UploadOptions {
  maxFileSize?: number; // in bytes
  allowedMimeTypes?: string[];
  generateThumbnails?: boolean;
  requireNDA?: boolean;
}

export interface FileUploadResult {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  thumbnailUrl?: string;
}

export interface MultipartUploadPart {
  partNumber: number;
  etag: string;
}

export class FileUploadService {
  private bucket: R2Bucket;
  private maxFileSize: number = 100 * 1024 * 1024; // 100MB default
  private chunkSize: number = 10 * 1024 * 1024; // 10MB chunks for multipart
  
  // Allowed file types for different upload contexts
  private readonly DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  private readonly IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];
  
  private readonly VIDEO_TYPES = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska'
  ];

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  /**
   * Upload a single file
   */
  async uploadFile(
    file: File | ArrayBuffer,
    filename: string,
    options: UploadOptions = {}
  ): Promise<FileUploadResult> {
    try {
      // Validate file
      const fileData = file instanceof File ? await file.arrayBuffer() : file;
      const fileSize = fileData.byteLength;
      const mimeType = file instanceof File ? file.type : 'application/octet-stream';

      // Check file size
      const maxSize = options.maxFileSize || this.maxFileSize;
      if (fileSize > maxSize) {
        throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
      }

      // Check mime type if restrictions are specified
      if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(mimeType)) {
        throw new Error(`File type ${mimeType} is not allowed`);
      }

      // Generate unique key
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `uploads/${timestamp}-${randomId}/${sanitizedFilename}`;

      // Upload to R2
      const uploadResult = await this.bucket.put(key, fileData, {
        httpMetadata: {
          contentType: mimeType,
          contentDisposition: `inline; filename="${sanitizedFilename}"`
        },
        customMetadata: {
          uploadedAt: new Date().toISOString(),
          originalFilename: filename,
          requireNDA: options.requireNDA ? 'true' : 'false'
        }
      });

      // Generate thumbnail if needed (for images)
      let thumbnailUrl: string | undefined;
      if (options.generateThumbnails && this.IMAGE_TYPES.includes(mimeType)) {
        thumbnailUrl = await this.generateThumbnail(key, fileData, mimeType);
      }

      // Generate public URL (or signed URL if NDA required)
      const url = options.requireNDA 
        ? await this.generateSignedUrl(key, 3600) // 1 hour expiry for NDA content
        : this.getPublicUrl(key);

      return {
        id: uploadResult.key,
        filename: sanitizedFilename,
        url,
        size: fileSize,
        mimeType,
        uploadedAt: new Date().toISOString(),
        thumbnailUrl
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: File[],
    options: UploadOptions = {}
  ): Promise<FileUploadResult[]> {
    const uploadPromises = files.map(file => 
      this.uploadFile(file, file.name, options)
    );
    
    // Process uploads in parallel with error handling
    const results = await Promise.allSettled(uploadPromises);
    
    const successful: FileUploadResult[] = [];
    const failed: { filename: string; error: string }[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({
          filename: files[index].name,
          error: result.reason.message
        });
      }
    });
    
    if (failed.length > 0) {
      console.error('Some files failed to upload:', failed);
      // You might want to handle partial failures differently
    }
    
    return successful;
  }

  /**
   * Initialize multipart upload for large files
   */
  async initializeMultipartUpload(
    filename: string,
    options: UploadOptions = {}
  ): Promise<{ uploadId: string; key: string }> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `uploads/${timestamp}-${randomId}/${sanitizedFilename}`;

    const multipartUpload = await this.bucket.createMultipartUpload(key, {
      httpMetadata: {
        contentType: options.allowedMimeTypes?.[0] || 'application/octet-stream'
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        originalFilename: filename,
        requireNDA: options.requireNDA ? 'true' : 'false'
      }
    });

    return {
      uploadId: multipartUpload.uploadId,
      key: multipartUpload.key
    };
  }

  /**
   * Upload a part of a multipart upload
   */
  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    data: ArrayBuffer
  ): Promise<MultipartUploadPart> {
    const multipartUpload = this.bucket.resumeMultipartUpload(key, uploadId);
    const uploadedPart = await multipartUpload.uploadPart(partNumber, data);
    
    return {
      partNumber: uploadedPart.partNumber,
      etag: uploadedPart.etag
    };
  }

  /**
   * Complete a multipart upload
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartUploadPart[]
  ): Promise<FileUploadResult> {
    const multipartUpload = this.bucket.resumeMultipartUpload(key, uploadId);
    const object = await multipartUpload.complete(parts);
    
    return {
      id: object.key,
      filename: object.key.split('/').pop() || '',
      url: this.getPublicUrl(object.key),
      size: object.size,
      mimeType: object.httpMetadata?.contentType || 'application/octet-stream',
      uploadedAt: object.uploaded.toISOString()
    };
  }

  /**
   * Abort a multipart upload
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const multipartUpload = this.bucket.resumeMultipartUpload(key, uploadId);
    await multipartUpload.abort();
  }

  /**
   * Upload custom NDA document
   */
  async uploadNDADocument(
    file: File,
    pitchId: number,
    userId: number
  ): Promise<FileUploadResult> {
    // Validate that it's a PDF
    if (file.type !== 'application/pdf') {
      throw new Error('NDA documents must be in PDF format');
    }

    // Upload with specific NDA metadata
    const key = `nda-documents/${pitchId}/${userId}-${Date.now()}.pdf`;
    const fileData = await file.arrayBuffer();

    await this.bucket.put(key, fileData, {
      httpMetadata: {
        contentType: 'application/pdf',
        contentDisposition: `inline; filename="NDA-${pitchId}.pdf"`
      },
      customMetadata: {
        pitchId: pitchId.toString(),
        userId: userId.toString(),
        uploadedAt: new Date().toISOString(),
        documentType: 'custom-nda'
      }
    });

    // Generate signed URL for NDA (always require auth)
    const url = await this.generateSignedUrl(key, 7200); // 2 hour expiry

    return {
      id: key,
      filename: file.name,
      url,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * Delete a file from R2
   */
  async deleteFile(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  /**
   * Delete multiple files
   */
  async deleteMultipleFiles(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this.bucket.delete(key)));
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<any> {
    const object = await this.bucket.head(key);
    if (!object) {
      throw new Error('File not found');
    }
    
    return {
      key: object.key,
      size: object.size,
      etag: object.etag,
      httpEtag: object.httpEtag,
      uploaded: object.uploaded,
      httpMetadata: object.httpMetadata,
      customMetadata: object.customMetadata
    };
  }

  /**
   * Generate a signed URL for private content
   */
  private async generateSignedUrl(key: string, expiresIn: number): Promise<string> {
    // This would typically use AWS SDK or Cloudflare's signed URL generation
    // For now, returning a placeholder that would be implemented with actual R2 signing
    const baseUrl = 'https://r2.pitchey.com';
    const timestamp = Date.now();
    const expiry = timestamp + (expiresIn * 1000);
    
    // In production, this would generate a proper signed URL
    return `${baseUrl}/${key}?expires=${expiry}&signature=placeholder`;
  }

  /**
   * Get public URL for a file
   */
  private getPublicUrl(key: string): string {
    // This would be configured based on your R2 bucket's public URL
    const baseUrl = 'https://r2.pitchey.com';
    return `${baseUrl}/${key}`;
  }

  /**
   * Generate thumbnail for images (simplified version)
   */
  private async generateThumbnail(
    key: string,
    imageData: ArrayBuffer,
    mimeType: string
  ): Promise<string> {
    // In a real implementation, this would use an image processing service
    // or Cloudflare Images to generate thumbnails
    const thumbnailKey = key.replace('/uploads/', '/thumbnails/').replace(/\.[^.]+$/, '_thumb.jpg');
    
    // For now, we'll just store the same image as a "thumbnail"
    // In production, you'd resize the image using a service like Cloudflare Images
    await this.bucket.put(thumbnailKey, imageData, {
      httpMetadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000'
      }
    });
    
    return this.getPublicUrl(thumbnailKey);
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File, options: UploadOptions = {}): { valid: boolean; error?: string } {
    // Check file size
    const maxSize = options.maxFileSize || this.maxFileSize;
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB` 
      };
    }

    // Check mime type
    if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: `File type ${file.type} is not allowed. Allowed types: ${options.allowedMimeTypes.join(', ')}` 
      };
    }

    return { valid: true };
  }

  /**
   * Get allowed file types for a specific context
   */
  getAllowedFileTypes(context: 'document' | 'image' | 'video' | 'nda'): string[] {
    switch (context) {
      case 'document':
        return this.DOCUMENT_TYPES;
      case 'image':
        return this.IMAGE_TYPES;
      case 'video':
        return this.VIDEO_TYPES;
      case 'nda':
        return ['application/pdf'];
      default:
        return [...this.DOCUMENT_TYPES, ...this.IMAGE_TYPES, ...this.VIDEO_TYPES];
    }
  }
}