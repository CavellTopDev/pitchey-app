/**
 * R2 Storage Service for Cloudflare Workers
 * Handles file uploads, downloads, and management
 */

export interface StorageFile {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  maxSize?: number; // in bytes
  allowedTypes?: string[];
}

export class StorageService {
  private bucket: R2Bucket;
  private baseUrl: string;

  constructor(bucket: R2Bucket, baseUrl: string) {
    this.bucket = bucket;
    this.baseUrl = baseUrl;
  }

  /**
   * Upload a file to R2
   */
  async upload(
    key: string,
    data: ArrayBuffer | ReadableStream,
    options: UploadOptions = {}
  ): Promise<StorageFile | null> {
    try {
      // Validate file size if specified
      if (options.maxSize && data instanceof ArrayBuffer && data.byteLength > options.maxSize) {
        throw new Error(`File size exceeds maximum allowed size of ${options.maxSize} bytes`);
      }

      // Validate content type if specified
      if (options.allowedTypes && options.contentType) {
        if (!options.allowedTypes.includes(options.contentType)) {
          throw new Error(`File type ${options.contentType} is not allowed`);
        }
      }

      // Prepare HTTP metadata
      const httpMetadata: R2HTTPMetadata = {
        contentType: options.contentType || 'application/octet-stream',
      };

      // Upload to R2
      const object = await this.bucket.put(key, data, {
        httpMetadata,
        customMetadata: options.metadata,
      });

      if (!object) {
        return null;
      }

      return {
        key: object.key,
        size: object.size,
        etag: object.etag,
        uploaded: object.uploaded,
        contentType: httpMetadata.contentType!,
        metadata: options.metadata,
      };
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  }

  /**
   * Upload a pitch file with validation
   */
  async uploadPitchFile(
    pitchId: number,
    fileName: string,
    data: ArrayBuffer,
    contentType: string
  ): Promise<string | null> {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    const maxSize = 100 * 1024 * 1024; // 100MB
    const key = `pitches/${pitchId}/${Date.now()}-${fileName}`;

    const file = await this.upload(key, data, {
      contentType,
      allowedTypes,
      maxSize,
      metadata: {
        pitchId: pitchId.toString(),
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
      },
    });

    return file ? this.getPublicUrl(key) : null;
  }

  /**
   * Upload a profile picture with validation
   */
  async uploadProfilePicture(
    userId: number,
    data: ArrayBuffer,
    contentType: string
  ): Promise<string | null> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    const key = `profiles/${userId}/avatar-${Date.now()}.${this.getExtension(contentType)}`;

    const file = await this.upload(key, data, {
      contentType,
      allowedTypes,
      maxSize,
      metadata: {
        userId: userId.toString(),
        type: 'avatar',
      },
    });

    return file ? this.getPublicUrl(key) : null;
  }

  /**
   * Get a file from R2
   */
  async get(key: string): Promise<R2ObjectBody | null> {
    try {
      return await this.bucket.get(key);
    } catch (error) {
      console.error('Get error:', error);
      return null;
    }
  }

  /**
   * Delete a file from R2
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.bucket.delete(key);
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMany(keys: string[]): Promise<boolean> {
    try {
      await this.bucket.delete(keys);
      return true;
    } catch (error) {
      console.error('Delete many error:', error);
      return false;
    }
  }

  /**
   * List files with prefix
   */
  async list(prefix: string, limit = 100): Promise<StorageFile[]> {
    try {
      const listed = await this.bucket.list({
        prefix,
        limit,
      });

      return listed.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        etag: obj.etag,
        uploaded: obj.uploaded,
        contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
        metadata: obj.customMetadata,
      }));
    } catch (error) {
      console.error('List error:', error);
      return [];
    }
  }

  /**
   * Generate a signed URL for temporary access
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string | null> {
    try {
      // R2 doesn't support signed URLs natively yet
      // For now, return public URL or implement your own signing
      return this.getPublicUrl(key);
    } catch (error) {
      console.error('Signed URL error:', error);
      return null;
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  /**
   * Get file extension from content type
   */
  private getExtension(contentType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'application/pdf': 'pdf',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    };
    return extensions[contentType] || 'bin';
  }

  /**
   * Clean up old files for a pitch
   */
  async cleanupPitchFiles(pitchId: number): Promise<boolean> {
    try {
      const files = await this.list(`pitches/${pitchId}/`);
      const keys = files.map(f => f.key);
      
      if (keys.length > 0) {
        return await this.deleteMany(keys);
      }
      
      return true;
    } catch (error) {
      console.error('Cleanup error:', error);
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(prefix = ''): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  }> {
    try {
      const files = await this.list(prefix, 1000);
      
      const stats = {
        totalFiles: files.length,
        totalSize: 0,
        byType: {} as Record<string, { count: number; size: number }>,
      };

      for (const file of files) {
        stats.totalSize += file.size;
        
        const type = file.contentType;
        if (!stats.byType[type]) {
          stats.byType[type] = { count: 0, size: 0 };
        }
        stats.byType[type].count++;
        stats.byType[type].size += file.size;
      }

      return stats;
    } catch (error) {
      console.error('Stats error:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        byType: {},
      };
    }
  }
}

/**
 * Handle file upload from request
 */
export async function handleFileUpload(
  request: Request,
  storageService: StorageService
): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Content-Type must be multipart/form-data',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No file provided',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pitchId = formData.get('pitchId') as string;
    const buffer = await file.arrayBuffer();
    
    const url = await storageService.uploadPitchFile(
      parseInt(pitchId),
      file.name,
      buffer,
      file.type
    );

    if (!url) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Upload failed',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        url,
        fileName: file.name,
        size: file.size,
        type: file.type,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Upload handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Upload failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}