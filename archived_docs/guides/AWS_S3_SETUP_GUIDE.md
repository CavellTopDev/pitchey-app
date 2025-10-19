# AWS S3 Cloud Storage Setup Guide for Pitchey

## Table of Contents
1. [Overview](#overview)
2. [AWS Account Setup](#aws-account-setup)
3. [S3 Bucket Configuration](#s3-bucket-configuration)
4. [IAM Policy Setup](#iam-policy-setup)
5. [CloudFront CDN Configuration](#cloudfront-cdn-configuration)
6. [Environment Variables](#environment-variables)
7. [Implementation Details](#implementation-details)
8. [Security Configuration](#security-configuration)
9. [Migration Strategy](#migration-strategy)
10. [Testing & Verification](#testing-verification)
11. [Cost Estimation](#cost-estimation)
12. [Monitoring & Maintenance](#monitoring-maintenance)

## Overview

This guide provides step-by-step instructions for setting up AWS S3 cloud storage for Pitchey, including:
- Secure file uploads with presigned URLs
- CDN distribution via CloudFront
- Automatic file lifecycle management
- Cost-optimized storage tiers
- Security best practices

### Architecture Diagram
```
Users → Application → S3 (Storage) → CloudFront (CDN) → End Users
         ↓
    Local Fallback
```

## AWS Account Setup

### Step 1: Create AWS Account
1. Navigate to https://aws.amazon.com
2. Click "Create an AWS Account"
3. Enter email and account name
4. Verify email and complete setup
5. Add billing information
6. Select "Basic Support - Free" plan

### Step 2: Enable MFA
1. Go to IAM Console → Users
2. Click on root user
3. Security credentials → Assign MFA device
4. Use authenticator app (recommended)

## S3 Bucket Configuration

### Step 1: Create S3 Buckets

Create separate buckets for different content types:

```bash
# Production bucket
pitchey-production-media

# Staging bucket  
pitchey-staging-media

# Backup bucket
pitchey-backups
```

### Step 2: Configure Main Bucket

1. **Go to S3 Console**
2. **Click "Create bucket"**
3. **Basic Configuration:**
   ```
   Bucket name: pitchey-production-media
   Region: us-east-1 (or nearest to your users)
   Object Ownership: ACLs disabled
   ```

4. **Block Public Access Settings:**
   ```json
   {
     "BlockPublicAcls": true,
     "IgnorePublicAcls": true,
     "BlockPublicPolicy": false,
     "RestrictPublicBuckets": false
   }
   ```

5. **Bucket Versioning:** Enable
6. **Default Encryption:** Enable AES-256
7. **Object Lock:** Disable (unless required for compliance)

### Step 3: Create Folder Structure

```
/pitchey-production-media
  /profiles
    /avatars
    /covers
  /pitches
    /lookbooks
    /scripts
    /trailers
    /pitch-decks
    /budgets
    /timelines
  /ndas
    /signed
    /templates
  /messages
    /attachments
  /marketing
    /materials
  /temp
    /uploads (auto-delete after 24h)
```

### Step 4: Configure Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::pitchey-production-media/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
        }
      }
    },
    {
      "Sid": "AllowPresignedUrls",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/pitchey-app"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::pitchey-production-media/*"
    }
  ]
}
```

### Step 5: Configure CORS

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "https://pitchey.com",
      "https://www.pitchey.com",
      "https://staging.pitchey.com",
      "http://localhost:8000",
      "http://localhost:5173"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "x-amz-server-side-encryption",
      "x-amz-request-id"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### Step 6: Configure Lifecycle Rules

```json
{
  "Rules": [
    {
      "Id": "DeleteTempFiles",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "temp/"
      },
      "Expiration": {
        "Days": 1
      }
    },
    {
      "Id": "MoveToIA",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "INTELLIGENT_TIERING"
        }
      ]
    },
    {
      "Id": "DeleteOldVersions",
      "Status": "Enabled",
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 30
      }
    }
  ]
}
```

## IAM Policy Setup

### Step 1: Create IAM User

1. Go to IAM Console → Users → Add User
2. User name: `pitchey-app`
3. Access type: Programmatic access
4. Don't attach policies yet

### Step 2: Create Custom Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3BucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObjectVersion",
        "s3:GetObjectAcl",
        "s3:PutObjectAcl"
      ],
      "Resource": [
        "arn:aws:s3:::pitchey-production-media/*",
        "arn:aws:s3:::pitchey-staging-media/*"
      ]
    },
    {
      "Sid": "S3BucketList",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning"
      ],
      "Resource": [
        "arn:aws:s3:::pitchey-production-media",
        "arn:aws:s3:::pitchey-staging-media"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": "*"
    }
  ]
}
```

### Step 3: Attach Policy to User

1. Name policy: `PitcheyS3Policy`
2. Attach to `pitchey-app` user
3. Save access keys securely

## CloudFront CDN Configuration

### Step 1: Create Distribution

1. **Go to CloudFront Console**
2. **Create Distribution**
3. **Origin Settings:**
   ```
   Origin Domain: pitchey-production-media.s3.amazonaws.com
   Origin Path: /
   Origin Access: Origin Access Control
   ```

4. **Default Cache Behavior:**
   ```
   Viewer Protocol Policy: Redirect HTTP to HTTPS
   Allowed HTTP Methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   Cache Policy: Managed-CachingOptimized
   Origin Request Policy: Managed-CORS-S3Origin
   ```

5. **Distribution Settings:**
   ```
   Price Class: Use North America, Europe, Asia (or customize)
   Alternate Domain Names: cdn.pitchey.com
   Custom SSL Certificate: Use ACM certificate
   Security Policy: TLSv1.2_2021
   HTTP/2: Enabled
   HTTP/3: Enabled
   ```

### Step 2: Configure Cache Behaviors

Create specific cache behaviors for different content:

```
/profiles/* - Cache 7 days
/pitches/trailers/* - Cache 30 days
/pitches/lookbooks/* - Cache 7 days
/ndas/* - No cache
/temp/* - No cache
/messages/* - Cache 1 day
```

### Step 3: Configure Error Pages

```
403 → /error/403.html (Cache 300s)
404 → /error/404.html (Cache 300s)
500 → /error/500.html (Cache 0s)
```

## Environment Variables

Add to `.env` file:

```bash
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_S3_BUCKET=pitchey-production-media
AWS_S3_BUCKET_STAGING=pitchey-staging-media

# CloudFront Configuration
CLOUDFRONT_URL=https://cdn.pitchey.com
CLOUDFRONT_DISTRIBUTION_ID=E1EXAMPLE123

# Storage Configuration
STORAGE_PROVIDER=s3  # Options: s3, local, hybrid
USE_LOCAL_FALLBACK=true
MAX_FILE_SIZE_MB=500
MAX_IMAGE_SIZE_MB=10
MAX_DOCUMENT_SIZE_MB=50

# File Security
ENABLE_VIRUS_SCAN=true
ENABLE_WATERMARK=true
SIGNED_URL_EXPIRY_SECONDS=3600

# File Type Restrictions
ALLOWED_IMAGE_TYPES=jpeg,jpg,png,webp,gif
ALLOWED_VIDEO_TYPES=mp4,mov,avi,webm
ALLOWED_DOCUMENT_TYPES=pdf,doc,docx,ppt,pptx,xls,xlsx
```

## Implementation Details

### Enhanced Upload Service

Create `/src/services/s3-upload.service.ts`:

```typescript
import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { CloudFrontClient, CreateInvalidationCommand } from "npm:@aws-sdk/client-cloudfront";

export class S3UploadService {
  private s3Client: S3Client;
  private cfClient: CloudFrontClient;
  private bucket: string;
  private cdnUrl: string;
  private distributionId: string;
  private useLocalFallback: boolean;

  constructor() {
    this.s3Client = new S3Client({
      region: Deno.env.get("AWS_REGION") || "us-east-1",
      credentials: {
        accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
        secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
      },
    });

    this.cfClient = new CloudFrontClient({
      region: Deno.env.get("AWS_REGION") || "us-east-1",
      credentials: {
        accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
        secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
      },
    });

    this.bucket = Deno.env.get("AWS_S3_BUCKET")!;
    this.cdnUrl = Deno.env.get("CLOUDFRONT_URL")!;
    this.distributionId = Deno.env.get("CLOUDFRONT_DISTRIBUTION_ID")!;
    this.useLocalFallback = Deno.env.get("USE_LOCAL_FALLBACK") === "true";
  }

  // Generate presigned URL for direct browser upload
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    metadata: Record<string, string> = {}
  ): Promise<{ uploadUrl: string; key: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
      ServerSideEncryption: "AES256",
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    return { uploadUrl, key };
  }

  // Upload file with automatic retry and fallback
  async uploadFile(
    file: File,
    folder: string,
    options: {
      applyWatermark?: boolean;
      encrypt?: boolean;
      publicRead?: boolean;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<{ url: string; key: string; cdnUrl: string }> {
    try {
      const key = this.generateKey(folder, file.name);
      const buffer = await file.arrayBuffer();

      // Apply watermark if requested
      let processedBuffer = buffer;
      if (options.applyWatermark) {
        processedBuffer = await this.applyWatermark(buffer, file.type);
      }

      // Use multipart upload for large files
      if (file.size > 100 * 1024 * 1024) { // 100MB
        await this.multipartUpload(key, processedBuffer, file.type, options);
      } else {
        await this.simpleUpload(key, processedBuffer, file.type, options);
      }

      // Invalidate CloudFront cache for immediate availability
      await this.invalidateCache([`/${key}`]);

      return {
        url: `https://${this.bucket}.s3.amazonaws.com/${key}`,
        key,
        cdnUrl: `${this.cdnUrl}/${key}`,
      };
    } catch (error) {
      if (this.useLocalFallback) {
        return await this.uploadToLocal(file, folder);
      }
      throw error;
    }
  }

  // Simple upload for smaller files
  private async simpleUpload(
    key: string,
    buffer: ArrayBuffer,
    contentType: string,
    options: any
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

  // Multipart upload for large files
  private async multipartUpload(
    key: string,
    buffer: ArrayBuffer,
    contentType: string,
    options: any
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

      // Upload parts in parallel (max 3 concurrent)
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

  // Delete file from S3
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);

    // Invalidate CloudFront cache
    await this.invalidateCache([`/${key}`]);
  }

  // Get presigned URL for secure downloads
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

  // Invalidate CloudFront cache
  private async invalidateCache(paths: string[]): Promise<void> {
    if (!this.distributionId) return;

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
  }

  // Generate unique S3 key
  private generateKey(folder: string, fileName: string): string {
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const ext = fileName.split('.').pop();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${folder}/${timestamp}-${uuid}-${safeName}`;
  }

  // Apply watermark (placeholder - implement with sharp or similar)
  private async applyWatermark(
    buffer: ArrayBuffer,
    mimeType: string
  ): Promise<ArrayBuffer> {
    // TODO: Implement watermarking with image processing library
    console.log(`Watermarking ${mimeType} file`);
    return buffer;
  }

  // Local fallback for S3 failures
  private async uploadToLocal(
    file: File,
    folder: string
  ): Promise<{ url: string; key: string; cdnUrl: string }> {
    const fileName = `${Date.now()}-${file.name}`;
    const localPath = `./static/uploads/${folder}/${fileName}`;
    
    await Deno.mkdir(`./static/uploads/${folder}`, { recursive: true });
    const buffer = await file.arrayBuffer();
    await Deno.writeFile(localPath, new Uint8Array(buffer));

    return {
      url: `/static/uploads/${folder}/${fileName}`,
      key: `${folder}/${fileName}`,
      cdnUrl: `/static/uploads/${folder}/${fileName}`,
    };
  }

  // Validate file before upload
  validateFile(
    file: File,
    type: 'image' | 'video' | 'document'
  ): { valid: boolean; error?: string } {
    const limits = {
      image: { size: 10 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
      video: { size: 500 * 1024 * 1024, types: ['video/mp4', 'video/quicktime', 'video/webm'] },
      document: { size: 50 * 1024 * 1024, types: ['application/pdf', 'application/msword'] },
    };

    const limit = limits[type];

    if (file.size > limit.size) {
      return { valid: false, error: `File too large (max ${limit.size / 1024 / 1024}MB)` };
    }

    if (!limit.types.includes(file.type)) {
      return { valid: false, error: `Invalid file type: ${file.type}` };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const s3Upload = new S3UploadService();
```

### File Upload API Route

Update `/routes/api/media/upload-s3.ts`:

```typescript
import { Handlers } from "$fresh/server.ts";
import { s3Upload } from "../../../src/services/s3-upload.service.ts";
import { db } from "../../../src/db/client.ts";
import { pitches, users } from "../../../src/db/schema.ts";
import { eq } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  // Get presigned URL for direct browser upload
  async GET(req: Request) {
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

    const url = new URL(req.url);
    const fileName = url.searchParams.get("fileName");
    const fileType = url.searchParams.get("fileType");
    const folder = url.searchParams.get("folder") || "temp";

    if (!fileName || !fileType) {
      return new Response(
        JSON.stringify({ error: "Missing fileName or fileType" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const { uploadUrl, key } = await s3Upload.getPresignedUploadUrl(
        `${folder}/${userId}/${fileName}`,
        fileType,
        { userId, uploadedAt: new Date().toISOString() }
      );

      return new Response(
        JSON.stringify({ uploadUrl, key, expiresIn: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      return new Response(
        JSON.stringify({ error: "Failed to generate upload URL" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },

  // Server-side upload with processing
  async POST(req: Request) {
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

    try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const folder = formData.get("folder") as string || "temp";
      const pitchId = formData.get("pitchId") as string;
      const applyWatermark = formData.get("applyWatermark") === "true";
      const fileType = formData.get("fileType") as 'image' | 'video' | 'document';

      if (!file) {
        return new Response(
          JSON.stringify({ error: "No file provided" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Validate file
      const validation = s3Upload.validateFile(file, fileType);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Upload to S3
      const result = await s3Upload.uploadFile(file, `${folder}/${userId}`, {
        applyWatermark,
        encrypt: true,
        metadata: {
          userId,
          pitchId: pitchId || "",
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Update database if pitch ID provided
      if (pitchId) {
        const pitch = await db.select().from(pitches)
          .where(eq(pitches.id, parseInt(pitchId)))
          .limit(1);

        if (pitch.length && pitch[0].userId === userId) {
          // Update pitch with new media
          const mediaEntry = {
            id: crypto.randomUUID(),
            type: fileType,
            url: result.cdnUrl,
            s3Key: result.key,
            title: file.name,
            size: file.size,
            mimeType: file.type,
            uploadedAt: new Date().toISOString(),
          };

          const existingMedia = pitch[0].additionalMedia || [];
          await db.update(pitches)
            .set({
              additionalMedia: [...existingMedia, mediaEntry],
              updatedAt: new Date(),
            })
            .where(eq(pitches.id, parseInt(pitchId)));
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          url: result.cdnUrl,
          key: result.key,
          message: "File uploaded successfully",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error uploading file:", error);
      return new Response(
        JSON.stringify({ error: "Upload failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
```

## Security Configuration

### File Validation & Virus Scanning

```typescript
// src/services/file-security.service.ts
import { createHash } from "https://deno.land/std/hash/mod.ts";

export class FileSecurityService {
  // Validate file signatures (magic numbers)
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

  // Generate file hash for deduplication
  static async generateFileHash(buffer: ArrayBuffer): Promise<string> {
    const hash = createHash("sha256");
    hash.update(new Uint8Array(buffer));
    return hash.toString("hex");
  }

  // Check for malicious content patterns
  static async scanForMalware(buffer: ArrayBuffer): Promise<boolean> {
    // Integrate with AWS Macie or third-party service
    // For now, basic pattern matching
    const dangerous = [
      '<script', 'javascript:', 'eval(', 'document.cookie',
      'onclick=', 'onerror=', '.exe', '.bat', '.cmd'
    ];

    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const lowercase = text.toLowerCase();

    return !dangerous.some(pattern => lowercase.includes(pattern));
  }

  // Sanitize filename
  static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
  }
}
```

### Access Control Implementation

```typescript
// src/services/file-access.service.ts
export class FileAccessService {
  static async checkAccess(
    userId: string,
    fileKey: string,
    requiredLevel: 'public' | 'basic' | 'enhanced' | 'nda'
  ): Promise<boolean> {
    // Check if user has required access level for file
    const fileMetadata = await this.getFileMetadata(fileKey);
    
    if (fileMetadata.accessLevel === 'public') {
      return true;
    }

    if (fileMetadata.accessLevel === 'nda') {
      // Check if user has signed NDA for this content
      const nda = await db.select().from(ndas)
        .where(and(
          eq(ndas.investorId, userId),
          eq(ndas.pitchId, fileMetadata.pitchId),
          eq(ndas.status, 'signed')
        ))
        .limit(1);

      return nda.length > 0;
    }

    // Check subscription level
    const user = await db.select().from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const levels = { 'basic': 1, 'enhanced': 2, 'premium': 3 };
    const userLevel = levels[user[0].subscriptionTier] || 0;
    const requiredLevelNum = levels[requiredLevel] || 0;

    return userLevel >= requiredLevelNum;
  }

  private static async getFileMetadata(key: string): Promise<any> {
    // Retrieve metadata from S3 or database
    // Implementation depends on your metadata storage strategy
    return {};
  }
}
```

## Migration Strategy

### Phase 1: Preparation (Week 1)
1. Set up AWS account and S3 buckets
2. Configure IAM policies and security
3. Deploy updated upload service with S3 support
4. Enable hybrid mode (S3 + local fallback)

### Phase 2: Migration (Week 2-3)
1. **Batch Migration Script:**
```typescript
// scripts/migrate-to-s3.ts
import { s3Upload } from "../src/services/s3-upload.service.ts";
import { db } from "../src/db/client.ts";
import { pitches, users } from "../src/db/schema.ts";
import { walk } from "https://deno.land/std/fs/walk.ts";

async function migrateLocalFiles() {
  const localPath = "./static/uploads";
  const files = [];

  // Scan local files
  for await (const entry of walk(localPath)) {
    if (entry.isFile) {
      files.push(entry.path);
    }
  }

  console.log(`Found ${files.length} files to migrate`);

  // Migrate in batches
  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (filePath) => {
      try {
        const file = await Deno.readFile(filePath);
        const fileName = filePath.split('/').pop()!;
        const folder = filePath.split('/').slice(-2, -1)[0];

        // Upload to S3
        const result = await s3Upload.uploadFile(
          new File([file], fileName),
          folder
        );

        console.log(`Migrated: ${filePath} → ${result.key}`);

        // Update database references
        await updateDatabaseReferences(filePath, result.cdnUrl);
      } catch (error) {
        console.error(`Failed to migrate ${filePath}:`, error);
      }
    }));

    console.log(`Migrated batch ${i / batchSize + 1}`);
  }
}

async function updateDatabaseReferences(oldPath: string, newUrl: string) {
  // Update all database tables with new URLs
  // This is a simplified example - actual implementation would be more complex
  
  const tables = [
    { table: pitches, columns: ['lookbookUrl', 'scriptUrl', 'trailerUrl'] },
    { table: users, columns: ['avatarUrl', 'coverUrl'] },
  ];

  for (const { table, columns } of tables) {
    for (const column of columns) {
      await db.update(table)
        .set({ [column]: newUrl })
        .where(eq(table[column], oldPath));
    }
  }
}

// Run migration
if (import.meta.main) {
  await migrateLocalFiles();
}
```

### Phase 3: Validation (Week 4)
1. Verify all files accessible via CDN
2. Test download/upload functionality
3. Monitor error rates and performance
4. Update DNS to point to CloudFront

### Phase 4: Cleanup
1. Archive local files to S3 Glacier
2. Remove local storage code (keep fallback)
3. Update documentation

## Testing & Verification

### Test Checklist

```typescript
// tests/s3-integration.test.ts
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { s3Upload } from "../src/services/s3-upload.service.ts";

Deno.test("S3 Upload - Image file", async () => {
  const testFile = new File(
    [new Uint8Array(1024)], 
    "test.jpg",
    { type: "image/jpeg" }
  );

  const result = await s3Upload.uploadFile(testFile, "test");
  
  assertEquals(result.url.includes("s3.amazonaws.com"), true);
  assertEquals(result.cdnUrl.includes("cdn.pitchey.com"), true);
});

Deno.test("S3 Upload - Large file multipart", async () => {
  const largeFile = new File(
    [new Uint8Array(150 * 1024 * 1024)], // 150MB
    "large.mp4",
    { type: "video/mp4" }
  );

  const result = await s3Upload.uploadFile(largeFile, "videos");
  
  assertEquals(result.url.includes("videos/"), true);
});

Deno.test("S3 Upload - Presigned URL", async () => {
  const { uploadUrl, key } = await s3Upload.getPresignedUploadUrl(
    "test/file.pdf",
    "application/pdf"
  );

  assertEquals(uploadUrl.includes("X-Amz-Signature"), true);
  assertEquals(key, "test/file.pdf");
});

Deno.test("File validation", () => {
  const validImage = new File([new Uint8Array(1024)], "test.jpg", { 
    type: "image/jpeg" 
  });
  const validation = s3Upload.validateFile(validImage, 'image');
  assertEquals(validation.valid, true);

  const oversizedImage = new File(
    [new Uint8Array(20 * 1024 * 1024)], 
    "large.jpg",
    { type: "image/jpeg" }
  );
  const validation2 = s3Upload.validateFile(oversizedImage, 'image');
  assertEquals(validation2.valid, false);
});
```

### Performance Testing

```bash
# Load test with Apache Bench
ab -n 1000 -c 10 -T "multipart/form-data" \
  -p test-file.dat \
  https://api.pitchey.com/api/media/upload-s3

# Monitor CloudFront performance
aws cloudfront get-metric-statistics \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --metric-name BytesDownloaded \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum \
  --dimensions Name=DistributionId,Value=YOUR_DISTRIBUTION_ID
```

## Cost Estimation

### Monthly Cost Breakdown (Estimated)

```
Storage Costs:
- S3 Standard (first 50 TB): $0.023/GB
- S3 Infrequent Access: $0.0125/GB
- S3 Intelligent Tiering: $0.023/GB + $0.0025/1000 objects

Transfer Costs:
- Data Transfer OUT to Internet: $0.09/GB (first 10 TB)
- CloudFront to Internet: $0.085/GB
- S3 to CloudFront: Free

Request Costs:
- PUT/COPY/POST: $0.005/1000 requests
- GET/SELECT: $0.0004/1000 requests
- CloudFront HTTP requests: $0.0075/10000 requests

Example for 1000 active users:
- Storage: 500GB Standard + 1TB IA = ~$25/month
- Transfer: 100GB/month = ~$8.50/month
- Requests: 100k uploads + 1M downloads = ~$5/month
- CloudFront: 200GB served = ~$17/month

Total: ~$55-60/month
```

### Cost Optimization Tips

1. **Use S3 Intelligent-Tiering** for automatic cost optimization
2. **Enable CloudFront compression** to reduce transfer costs
3. **Set appropriate cache headers** to minimize origin requests
4. **Use S3 Transfer Acceleration** only for large files
5. **Monitor with AWS Cost Explorer** and set billing alerts
6. **Consider Reserved Capacity** for predictable workloads
7. **Implement request throttling** to prevent abuse

## Monitoring & Maintenance

### CloudWatch Metrics

```typescript
// src/services/monitoring.service.ts
import { CloudWatchClient, PutMetricDataCommand } from "npm:@aws-sdk/client-cloudwatch";

export class MonitoringService {
  private cloudWatch: CloudWatchClient;

  constructor() {
    this.cloudWatch = new CloudWatchClient({
      region: Deno.env.get("AWS_REGION")!,
    });
  }

  async trackUploadMetric(
    fileSize: number,
    duration: number,
    success: boolean
  ): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: "Pitchey/Uploads",
      MetricData: [
        {
          MetricName: "UploadSize",
          Value: fileSize,
          Unit: "Bytes",
          Timestamp: new Date(),
        },
        {
          MetricName: "UploadDuration",
          Value: duration,
          Unit: "Milliseconds",
          Timestamp: new Date(),
        },
        {
          MetricName: success ? "UploadSuccess" : "UploadFailure",
          Value: 1,
          Unit: "Count",
          Timestamp: new Date(),
        },
      ],
    });

    await this.cloudWatch.send(command);
  }
}
```

### Alarms Configuration

```json
{
  "alarms": [
    {
      "name": "High-S3-Errors",
      "metric": "4xxErrors",
      "threshold": 10,
      "period": 300,
      "evaluationPeriods": 2
    },
    {
      "name": "High-Transfer-Costs",
      "metric": "BytesDownloaded",
      "threshold": 1099511627776,
      "period": 86400,
      "evaluationPeriods": 1
    },
    {
      "name": "CloudFront-Origin-Latency",
      "metric": "OriginLatency",
      "threshold": 1000,
      "period": 300,
      "evaluationPeriods": 3
    }
  ]
}
```

### Maintenance Tasks

1. **Daily:**
   - Monitor CloudWatch dashboards
   - Check error logs
   - Review cost explorer

2. **Weekly:**
   - Analyze access patterns
   - Review security alerts
   - Check lifecycle policy effectiveness

3. **Monthly:**
   - Cost optimization review
   - Security audit
   - Performance analysis
   - Backup verification

4. **Quarterly:**
   - Disaster recovery drill
   - Capacity planning
   - Policy updates

## Troubleshooting Guide

### Common Issues and Solutions

1. **CORS Errors:**
   - Verify CORS configuration in S3 bucket
   - Check CloudFront behavior settings
   - Ensure headers are properly forwarded

2. **Upload Timeouts:**
   - Use multipart upload for large files
   - Implement retry logic with exponential backoff
   - Consider S3 Transfer Acceleration

3. **Access Denied:**
   - Check IAM policy permissions
   - Verify bucket policy
   - Ensure presigned URLs haven't expired

4. **High Costs:**
   - Review S3 Intelligent-Tiering
   - Optimize CloudFront cache behaviors
   - Implement request rate limiting

5. **Slow Performance:**
   - Enable CloudFront compression
   - Use appropriate cache headers
   - Consider edge locations closer to users

## Support and Resources

- AWS S3 Documentation: https://docs.aws.amazon.com/s3/
- CloudFront Best Practices: https://docs.aws.amazon.com/cloudfront/
- AWS Support Center: https://console.aws.amazon.com/support/
- Pitchey Internal Docs: /docs/infrastructure/

## Conclusion

This guide provides a complete setup for AWS S3 cloud storage integration with Pitchey. Follow the steps sequentially, test thoroughly at each stage, and monitor continuously for optimal performance and cost efficiency.

For questions or issues, contact the infrastructure team or refer to the troubleshooting section.