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

// Storage provider configuration
const STORAGE_PROVIDER = Deno.env.get("STORAGE_PROVIDER") || "hybrid"; // s3, local, hybrid
const USE_LOCAL_FALLBACK = Deno.env.get("USE_LOCAL_FALLBACK") === "true";

// S3 Configuration
const s3Client = new S3Client({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: Deno.env.get("AWS_ACCESS_KEY_ID") && Deno.env.get("AWS_SECRET_ACCESS_KEY") ? {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  } : undefined,
});

// CloudFront Configuration
const cfClient = Deno.env.get("CLOUDFRONT_DISTRIBUTION_ID") ? new CloudFrontClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: Deno.env.get("AWS_ACCESS_KEY_ID") && Deno.env.get("AWS_SECRET_ACCESS_KEY") ? {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  } : undefined,
}) : null;

const BUCKET = Deno.env.get("AWS_S3_BUCKET") || "";
const CDN_URL = Deno.env.get("CLOUDFRONT_URL") || "";
const DISTRIBUTION_ID = Deno.env.get("CLOUDFRONT_DISTRIBUTION_ID") || "";

// File size limits
const MAX_FILE_SIZE = parseInt(Deno.env.get("MAX_FILE_SIZE_MB") || "50") * 1024 * 1024;
const MAX_IMAGE_SIZE = parseInt(Deno.env.get("MAX_IMAGE_SIZE_MB") || "10") * 1024 * 1024;
const MAX_VIDEO_SIZE = parseInt(Deno.env.get("MAX_VIDEO_SIZE_MB") || "500") * 1024 * 1024;
const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // Use multipart for files > 100MB

interface UploadResult {
  url: string;
  key: string;
  cdnUrl?: string;
  provider: "s3" | "local";
}

interface UploadOptions {
  applyWatermark?: boolean;
  encrypt?: boolean;
  publicRead?: boolean;
  metadata?: Record<string, string>;
  accessLevel?: "public" | "basic" | "enhanced" | "nda";
}

export class UploadService {
  /**
   * Upload file with automatic provider selection and fallback
   */
  static async uploadFile(
    file: File, 
    folder: string, 
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // Validate file size
    const maxSize = file.type.startsWith("video/") ? MAX_VIDEO_SIZE : 
                   file.type.startsWith("image/") ? MAX_IMAGE_SIZE : 
                   MAX_FILE_SIZE;
    
    if (file.size > maxSize) {
      const limit = Math.round(maxSize / 1024 / 1024);
      throw new Error(`File size exceeds limit (${limit}MB)`);
    }
    
    // Choose upload strategy based on configuration
    if (STORAGE_PROVIDER === "local") {
      return await this.uploadToLocal(file, folder, options);
    }
    
    if (STORAGE_PROVIDER === "s3") {
      return await this.uploadToS3(file, folder, options);
    }
    
    // Hybrid mode: try S3 first, fall back to local
    try {
      return await this.uploadToS3(file, folder, options);
    } catch (error) {
      console.error("S3 upload failed, falling back to local:", error);
      if (USE_LOCAL_FALLBACK) {
        return await this.uploadToLocal(file, folder, options);
      }
      throw error;
    }
  }

  /**
   * Upload to S3 with multipart support for large files
   */
  private static async uploadToS3(
    file: File, 
    folder: string, 
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!BUCKET) {
      throw new Error("S3 bucket not configured");
    }

    const key = this.generateKey(folder, file.name);
    const buffer = await file.arrayBuffer();
    
    // Apply watermark if requested
    let processedBuffer = buffer;
    if (options.applyWatermark) {
      processedBuffer = await this.applyWatermark(buffer, file.type);
    }
    
    // Use multipart upload for large files
    if (file.size > MULTIPART_THRESHOLD) {
      await this.multipartUpload(key, processedBuffer, file.type, options);
    } else {
      await this.simpleUpload(key, processedBuffer, file.type, options);
    }
    
    // Invalidate CloudFront cache if configured
    if (DISTRIBUTION_ID && cfClient) {
      await this.invalidateCache([`/${key}`]);
    }
    
    return {
      url: `https://${BUCKET}.s3.${Deno.env.get("AWS_REGION") || "us-east-1"}.amazonaws.com/${key}`,
      key,
      cdnUrl: CDN_URL ? `${CDN_URL}/${key}` : undefined,
      provider: "s3"
    };
  }

  /**
   * Simple S3 upload for smaller files
   */
  private static async simpleUpload(
    key: string,
    buffer: ArrayBuffer,
    contentType: string,
    options: UploadOptions
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
      Metadata: options.metadata || {},
      ServerSideEncryption: options.encrypt ? "AES256" : undefined,
      ACL: options.publicRead ? "public-read" : "private",
    });
    
    await s3Client.send(command);
  }

  /**
   * Multipart upload for large files
   */
  private static async multipartUpload(
    key: string,
    buffer: ArrayBuffer,
    contentType: string,
    options: UploadOptions
  ): Promise<void> {
    const chunkSize = 10 * 1024 * 1024; // 10MB chunks
    const chunks = Math.ceil(buffer.byteLength / chunkSize);
    
    // Initiate multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      Metadata: options.metadata || {},
      ServerSideEncryption: options.encrypt ? "AES256" : undefined,
    });
    
    const { UploadId } = await s3Client.send(createCommand);
    
    try {
      const parts = [];
      
      // Upload parts
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, buffer.byteLength);
        const chunk = new Uint8Array(buffer.slice(start, end));
        
        const uploadCommand = new UploadPartCommand({
          Bucket: BUCKET,
          Key: key,
          UploadId,
          PartNumber: i + 1,
          Body: chunk,
        });
        
        const { ETag } = await s3Client.send(uploadCommand);
        parts.push({ ETag, PartNumber: i + 1 });
      }
      
      // Complete multipart upload
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId,
        MultipartUpload: { Parts: parts },
      });
      
      await s3Client.send(completeCommand);
    } catch (error) {
      // Abort multipart upload on error
      const abortCommand = new AbortMultipartUploadCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId,
      });
      await s3Client.send(abortCommand);
      throw error;
    }
  }

  /**
   * Upload to local filesystem
   */
  private static async uploadToLocal(
    file: File, 
    folder: string, 
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const fileName = this.generateKey(folder, file.name);
    const localPath = `./static/uploads/${fileName}`;
    const dir = `./static/uploads/${folder}`;
    
    // Create directory if it doesn't exist
    await Deno.mkdir(dir, { recursive: true });
    
    // Read and process file
    let buffer = await file.arrayBuffer();
    if (options.applyWatermark) {
      buffer = await this.applyWatermark(buffer, file.type);
    }
    
    // Write file
    await Deno.writeFile(localPath, new Uint8Array(buffer));
    
    return {
      url: `/static/uploads/${fileName}`,
      key: fileName,
      provider: "local"
    };
  }
  
  /**
   * Delete file from storage
   */
  static async deleteFile(urlOrKey: string): Promise<void> {
    // Determine if S3 or local
    if (urlOrKey.includes('.amazonaws.com/') || urlOrKey.includes(CDN_URL)) {
      // S3 file
      const key = urlOrKey.includes('.amazonaws.com/') 
        ? urlOrKey.split('.amazonaws.com/')[1]
        : urlOrKey.replace(CDN_URL + '/', '');
      
      const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });
      
      await s3Client.send(command);
      
      // Invalidate CloudFront cache
      if (DISTRIBUTION_ID && cfClient) {
        await this.invalidateCache([`/${key}`]);
      }
    } else if (urlOrKey.startsWith('/static/uploads/')) {
      // Local file
      const localPath = `.${urlOrKey}`;
      await Deno.remove(localPath).catch(() => {});
    }
  }

  /**
   * Generate presigned URL for secure uploads
   */
  static async getPresignedUploadUrl(
    key: string,
    contentType: string,
    metadata: Record<string, string> = {},
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!BUCKET) {
      throw new Error("S3 bucket not configured");
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
      ServerSideEncryption: "AES256",
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    return { uploadUrl, key };
  }

  /**
   * Generate presigned URL for secure downloads
   */
  static async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    if (!BUCKET) {
      throw new Error("S3 bucket not configured");
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Check if file exists in S3
   */
  static async fileExists(key: string): Promise<boolean> {
    if (!BUCKET) return false;
    
    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });
      await s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Validate image file
   */
  static validateImageFile(file: File): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return allowedTypes.includes(file.type) && file.size <= MAX_IMAGE_SIZE;
  }
  
  /**
   * Validate document file
   */
  static validateDocumentFile(file: File): boolean {
    const allowedTypes = [
      'application/pdf', 
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    return allowedTypes.includes(file.type) && file.size <= MAX_FILE_SIZE;
  }

  /**
   * Validate video file
   */
  static validateVideoFile(file: File): boolean {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    return allowedTypes.includes(file.type) && file.size <= MAX_VIDEO_SIZE;
  }

  /**
   * Validate file signature (magic numbers)
   */
  static async validateFileSignature(buffer: ArrayBuffer, expectedType: string): Promise<boolean> {
    const bytes = new Uint8Array(buffer.slice(0, 12));
    
    const signatures: Record<string, number[][]> = {
      'image/jpeg': [[0xFF, 0xD8, 0xFF]],
      'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
      'image/gif': [[0x47, 0x49, 0x46, 0x38]],
      'image/webp': [[0x52, 0x49, 0x46, 0x46], [0x57, 0x45, 0x42, 0x50]],
      'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
      'video/mp4': [[0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]],
    };
    
    const expectedSignatures = signatures[expectedType];
    if (!expectedSignatures) return true; // Allow unknown types
    
    return expectedSignatures.some(sig => 
      sig.every((byte, index) => bytes[index] === byte)
    );
  }

  /**
   * Generate unique key for file
   */
  private static generateKey(folder: string, fileName: string): string {
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const ext = fileName.split('.').pop() || '';
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    return `${folder}/${timestamp}-${uuid}-${safeName}`;
  }

  /**
   * Apply watermark to file (placeholder)
   */
  private static async applyWatermark(
    buffer: ArrayBuffer,
    mimeType: string
  ): Promise<ArrayBuffer> {
    // TODO: Implement actual watermarking
    // This would use canvas API for images or PDF libraries for documents
    console.log(`Would apply watermark to ${mimeType} file`);
    return buffer;
  }

  /**
   * Invalidate CloudFront cache
   */
  private static async invalidateCache(paths: string[]): Promise<void> {
    if (!cfClient || !DISTRIBUTION_ID) return;
    
    try {
      const command = new CreateInvalidationCommand({
        DistributionId: DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
        },
      });
      
      await cfClient.send(command);
    } catch (error) {
      console.error("CloudFront invalidation failed:", error);
    }
  }
}