import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand
} from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { CloudFrontClient, CreateInvalidationCommand } from "npm:@aws-sdk/client-cloudfront";
import type { StorageProvider, UploadResult, UploadOptions, PresignedUploadResult } from "./interface.ts";

/**
 * AWS S3 storage provider for production
 */
export class S3StorageProvider implements StorageProvider {
  private s3Client: S3Client;
  private cfClient?: CloudFrontClient;
  private bucket: string;
  private region: string;
  private cdnUrl?: string;
  private distributionId?: string;
  
  // File size limits (in bytes)
  private readonly MAX_FILE_SIZE = parseInt(Deno.env.get("MAX_FILE_SIZE_MB") || "50") * 1024 * 1024;
  private readonly MAX_IMAGE_SIZE = parseInt(Deno.env.get("MAX_IMAGE_SIZE_MB") || "10") * 1024 * 1024;
  private readonly MAX_VIDEO_SIZE = parseInt(Deno.env.get("MAX_VIDEO_SIZE_MB") || "500") * 1024 * 1024;
  private readonly MULTIPART_THRESHOLD = 100 * 1024 * 1024; // Use multipart for files > 100MB

  constructor() {
    // Validate required environment variables
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("AWS_S3_BUCKET");
    
    if (!accessKeyId || !secretAccessKey || !bucket) {
      throw new Error("AWS credentials and S3 bucket must be configured for S3 storage provider");
    }

    this.bucket = bucket;
    this.region = Deno.env.get("AWS_REGION") || "us-east-1";
    this.cdnUrl = Deno.env.get("CLOUDFRONT_URL");
    this.distributionId = Deno.env.get("CLOUDFRONT_DISTRIBUTION_ID");

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Initialize CloudFront client if distribution ID is provided
    if (this.distributionId) {
      this.cfClient = new CloudFrontClient({
        region: this.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  /**
   * Upload file to S3
   */
  async uploadFile(
    file: File,
    folder: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // Validate file size
    if (!this.validateFile(file, this.getFileType(file.type))) {
      const maxSize = this.getMaxSize(file.type);
      throw new Error(`File size exceeds limit (${Math.round(maxSize / 1024 / 1024)}MB)`);
    }

    const key = this.generateKey(folder, file.name);
    const buffer = await file.arrayBuffer();
    
    // Apply watermark if requested
    let processedBuffer = buffer;
    if (options.applyWatermark) {
      processedBuffer = await this.applyWatermark(buffer, file.type);
    }
    
    // Use multipart upload for large files
    if (file.size > this.MULTIPART_THRESHOLD) {
      await this.multipartUpload(key, processedBuffer, file.type, options);
    } else {
      await this.simpleUpload(key, processedBuffer, file.type, options);
    }
    
    // Invalidate CloudFront cache if configured
    if (this.distributionId && this.cfClient) {
      await this.invalidateCache([`/${key}`]);
    }
    
    return {
      url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
      key,
      cdnUrl: this.cdnUrl ? `${this.cdnUrl}/${key}` : undefined,
      provider: "s3"
    };
  }

  /**
   * Delete file from S3
   */
  async deleteFile(urlOrKey: string): Promise<void> {
    let key: string;
    
    // Extract key from URL or use directly
    if (urlOrKey.includes('.amazonaws.com/')) {
      key = urlOrKey.split('.amazonaws.com/')[1];
    } else if (this.cdnUrl && urlOrKey.includes(this.cdnUrl)) {
      key = urlOrKey.replace(`${this.cdnUrl}/`, '');
    } else {
      key = urlOrKey;
    }

    console.log(`S3 storage: Deleting file with key: ${key}`);
    
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    await this.s3Client.send(command);
    
    // Invalidate CloudFront cache
    if (this.distributionId && this.cfClient) {
      await this.invalidateCache([`/${key}`]);
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate presigned URL for upload
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    metadata: Record<string, string> = {},
    expiresIn: number = 3600
  ): Promise<PresignedUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
      ServerSideEncryption: "AES256",
    });
    
    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    
    return { uploadUrl, key };
  }

  /**
   * Generate presigned URL for download
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Get provider type
   */
  getProviderType(): "s3" {
    return "s3";
  }

  /**
   * Validate file based on type and size constraints
   */
  validateFile(file: File, type: "image" | "document" | "video"): boolean {
    const maxSize = this.getMaxSize(file.type);
    const allowedTypes = this.getAllowedTypes(type);
    
    return allowedTypes.includes(file.type) && file.size <= maxSize;
  }

  /**
   * Generate unique file key
   */
  generateKey(folder: string, fileName: string): string {
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const ext = fileName.split('.').pop() || '';
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    return `${folder}/${timestamp}-${uuid}-${safeName}`;
  }

  /**
   * Simple S3 upload for smaller files
   */
  private async simpleUpload(
    key: string,
    buffer: ArrayBuffer,
    contentType: string,
    options: UploadOptions
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
      Metadata: options.metadata || {},
      ServerSideEncryption: options.encrypt ? "AES256" : undefined,
      ACL: options.publicRead ? "public-read" : "private",
    });
    
    await this.s3Client.send(command);
  }

  /**
   * Multipart upload for large files
   */
  private async multipartUpload(
    key: string,
    buffer: ArrayBuffer,
    contentType: string,
    options: UploadOptions
  ): Promise<void> {
    const chunkSize = 10 * 1024 * 1024; // 10MB chunks
    const chunks = Math.ceil(buffer.byteLength / chunkSize);
    
    // Initiate multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      Metadata: options.metadata || {},
      ServerSideEncryption: options.encrypt ? "AES256" : undefined,
    });
    
    const { UploadId } = await this.s3Client.send(createCommand);
    
    try {
      const parts = [];
      
      // Upload parts
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, buffer.byteLength);
        const chunk = new Uint8Array(buffer.slice(start, end));
        
        const uploadCommand = new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId,
          PartNumber: i + 1,
          Body: chunk,
        });
        
        const { ETag } = await this.s3Client.send(uploadCommand);
        parts.push({ ETag, PartNumber: i + 1 });
      }
      
      // Complete multipart upload
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId,
        MultipartUpload: { Parts: parts },
      });
      
      await this.s3Client.send(completeCommand);
    } catch (error) {
      // Abort multipart upload on error
      const abortCommand = new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId,
      });
      await this.s3Client.send(abortCommand);
      throw error;
    }
  }

  private getFileType(mimeType: string): "image" | "document" | "video" {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    return "document";
  }

  private getMaxSize(mimeType: string): number {
    if (mimeType.startsWith("video/")) return this.MAX_VIDEO_SIZE;
    if (mimeType.startsWith("image/")) return this.MAX_IMAGE_SIZE;
    return this.MAX_FILE_SIZE;
  }

  private getAllowedTypes(type: "image" | "document" | "video"): string[] {
    switch (type) {
      case "image":
        return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      case "video":
        return ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
      case "document":
        return [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain'
        ];
    }
  }

  private async applyWatermark(
    buffer: ArrayBuffer,
    mimeType: string
  ): Promise<ArrayBuffer> {
    // Placeholder watermark implementation
    // In a real implementation, this would use image processing libraries
    console.log(`S3 storage: Would apply watermark to ${mimeType} file`);
    return buffer;
  }

  /**
   * Invalidate CloudFront cache
   */
  private async invalidateCache(paths: string[]): Promise<void> {
    if (!this.cfClient || !this.distributionId) return;
    
    try {
      const command = new CreateInvalidationCommand({
        DistributionId: this.distributionId,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
        },
      });
      
      await this.cfClient.send(command);
    } catch (error) {
      console.error("CloudFront invalidation failed:", error);
    }
  }
}