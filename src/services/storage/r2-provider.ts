import type { StorageProvider, UploadResult, UploadOptions, PresignedUploadResult } from "./interface.ts";

export class R2StorageProvider implements StorageProvider {
  private bucket: R2Bucket;
  private bucketName: string;
  private baseUrl: string;

  constructor(bucket: R2Bucket, bucketName: string) {
    this.bucket = bucket;
    this.bucketName = bucketName;
    this.baseUrl = `https://pub-${bucketName}.r2.dev`;
  }

  async uploadFile(
    file: File,
    folder: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const key = this.generateKey(folder, file.name);
    
    // Validate file
    if (!this.validateFile(file, this.getFileType(file))) {
      throw new Error(`Invalid file: ${file.name}`);
    }

    try {
      // Prepare metadata
      const metadata = {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        size: file.size.toString(),
        type: file.type,
        folder: folder,
        ...options.metadata,
      };

      // Upload to R2
      const result = await this.bucket.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type,
          contentDisposition: `attachment; filename="${file.name}"`,
          cacheControl: 'public, max-age=31536000', // 1 year cache
        },
        customMetadata: metadata,
      });

      if (!result) {
        throw new Error('Failed to upload file to R2');
      }

      const url = `${this.baseUrl}/${key}`;
      
      console.log(`R2 upload successful: ${key} -> ${url}`);
      
      return {
        url,
        key,
        cdnUrl: url, // R2 serves as CDN
        provider: "r2",
      };
    } catch (error: any) {
      console.error('R2 upload error:', error);
      throw new Error(`R2 upload failed: ${error.message}`);
    }
  }

  async deleteFile(urlOrKey: string): Promise<void> {
    try {
      // Extract key from URL if needed
      const key = urlOrKey.startsWith('http') 
        ? urlOrKey.split('/').slice(-1)[0] 
        : urlOrKey;

      await this.bucket.delete(key);
      console.log(`R2 delete successful: ${key}`);
    } catch (error: any) {
      console.error('R2 delete error:', error);
      throw new Error(`R2 delete failed: ${error.message}`);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const object = await this.bucket.head(key);
      return object !== null;
    } catch {
      return false;
    }
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    metadata: Record<string, string> = {},
    expiresIn: number = 3600
  ): Promise<PresignedUploadResult> {
    // R2 presigned URLs - generate signed URL for upload
    try {
      const signedUrl = await this.bucket.sign(key, {
        method: 'PUT',
        expiresIn,
        httpMetadata: {
          contentType,
        },
        customMetadata: {
          uploadedAt: new Date().toISOString(),
          ...metadata,
        },
      });

      return {
        uploadUrl: signedUrl,
        key,
      };
    } catch (error: any) {
      console.error('R2 presigned upload URL error:', error);
      throw new Error(`Failed to generate presigned upload URL: ${error.message}`);
    }
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      return await this.bucket.sign(key, {
        method: 'GET',
        expiresIn,
      });
    } catch (error: any) {
      console.error('R2 presigned download URL error:', error);
      throw new Error(`Failed to generate presigned download URL: ${error.message}`);
    }
  }

  getProviderType(): "s3" | "local" | "r2" {
    return "r2";
  }

  validateFile(file: File, type: "image" | "document" | "video"): boolean {
    // File size limits
    const maxSizes = {
      image: 10 * 1024 * 1024,    // 10MB
      document: 100 * 1024 * 1024, // 100MB
      video: 2 * 1024 * 1024 * 1024, // 2GB
    };

    if (file.size > maxSizes[type]) {
      console.error(`File ${file.name} exceeds size limit for ${type}: ${file.size} > ${maxSizes[type]}`);
      return false;
    }

    // MIME type validation
    const allowedTypes = {
      image: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
      ],
      document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/rtf',
        'application/vnd.final-draft.fdx'
      ],
      video: [
        'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
        'video/webm', 'video/ogg'
      ],
    };

    if (!allowedTypes[type].includes(file.type)) {
      console.error(`Invalid file type ${file.type} for category ${type}`);
      return false;
    }

    return true;
  }

  generateKey(folder: string, fileName: string): string {
    // Sanitize filename
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Generate timestamp-based unique suffix
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const uniqueSuffix = `${timestamp}_${random}`;
    
    // Extract extension
    const lastDot = sanitized.lastIndexOf('.');
    const name = lastDot > 0 ? sanitized.substring(0, lastDot) : sanitized;
    const ext = lastDot > 0 ? sanitized.substring(lastDot) : '';
    
    return `${folder}/${name}_${uniqueSuffix}${ext}`;
  }

  private getFileType(file: File): "image" | "document" | "video" {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
  }
}