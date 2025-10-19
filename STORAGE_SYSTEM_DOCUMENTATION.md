# Pitchey Storage System Documentation

## Overview

The Pitchey platform now includes a production-ready file storage service with swap-ready architecture that allows seamless switching between local storage (development) and AWS S3 (production) with just environment variables.

## Architecture

### Files Created

- `src/services/storage/interface.ts` - Storage provider interface
- `src/services/storage/local-provider.ts` - Local filesystem storage implementation
- `src/services/storage/s3-provider.ts` - AWS S3 storage implementation  
- `src/services/storage/factory.ts` - Factory for provider selection
- `src/services/storage/index.ts` - Main exports and utilities

### Updated Files

- `src/services/upload.service.ts` - Now uses the new storage abstraction
- `working-server.ts` - Updated to serve files from both `/uploads/` and `/static/uploads/` routes

## Configuration

### Local Development (Default)

No configuration needed. Files are stored in `./uploads/` directory.

```bash
# Optional - explicitly set local storage
STORAGE_PROVIDER=local
```

### AWS S3 Production

```bash
STORAGE_PROVIDER=s3
AWS_S3_BUCKET=pitchey-production
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Optional CloudFront CDN
CLOUDFRONT_URL=https://d123456.cloudfront.net
CLOUDFRONT_DISTRIBUTION_ID=E123456789...
```

### Hybrid Mode (S3 with Local Fallback)

```bash
STORAGE_PROVIDER=hybrid
AWS_S3_BUCKET=pitchey-production
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

### File Size Limits

```bash
MAX_FILE_SIZE_MB=50        # General files (default: 50MB)
MAX_IMAGE_SIZE_MB=10       # Images (default: 10MB)  
MAX_VIDEO_SIZE_MB=500      # Videos (default: 500MB)
```

## Usage

### Basic File Upload

```typescript
import { UploadService } from "./src/services/upload.service.ts";

// Upload a file
const result = await UploadService.uploadFile(file, "pitches", {
  publicRead: true,
  metadata: { userId: "123" }
});

console.log(result.url);      // File URL
console.log(result.key);      // Storage key
console.log(result.provider); // "local" or "s3"
```

### File Validation

```typescript
// Validate different file types
const isValidImage = UploadService.validateImageFile(file);
const isValidDocument = UploadService.validateDocumentFile(file);
const isValidVideo = UploadService.validateVideoFile(file);
```

### File Management

```typescript
// Check if file exists
const exists = await UploadService.fileExists("pitches/123-file.jpg");

// Delete file
await UploadService.deleteFile("pitches/123-file.jpg");

// Get storage info
const info = UploadService.getStorageInfo();
```

### S3 Presigned URLs (S3 Only)

```typescript
// Generate upload URL for direct client uploads
const { uploadUrl, key } = await UploadService.getPresignedUploadUrl(
  "pitches/new-file.jpg",
  "image/jpeg",
  { userId: "123" },
  3600 // expires in 1 hour
);

// Generate download URL for protected files
const downloadUrl = await UploadService.getPresignedDownloadUrl(
  "pitches/123-file.jpg",
  3600 // expires in 1 hour
);
```

### Direct Storage Provider Access

```typescript
import { getStorageProvider } from "./src/services/storage/index.ts";

const provider = getStorageProvider();
console.log("Using:", provider.getProviderType());

// Upload directly
const result = await provider.uploadFile(file, "folder", options);
```

## File Serving

### Local Storage

Files are served from:
- `/uploads/folder/file.jpg` (new path)
- `/static/uploads/folder/file.jpg` (legacy path)

Both paths are supported for backward compatibility.

### S3 Storage

Files are served from:
- Direct S3 URLs: `https://bucket.s3.region.amazonaws.com/key`
- CloudFront CDN URLs: `https://distribution.cloudfront.net/key`

## Directory Structure

### Local Storage

```
./uploads/
├── pitches/
│   ├── timestamp-uuid-filename.jpg
│   └── timestamp-uuid-filename.jpg.meta.json
├── documents/
└── profile-images/
```

### S3 Storage

```
s3://bucket/
├── pitches/
│   └── timestamp-uuid-filename.jpg
├── documents/
└── profile-images/
```

## Features

### Local Storage Provider

- ✅ File validation by type and size
- ✅ Metadata storage in `.meta.json` files
- ✅ Directory creation and management
- ✅ File listing and stats
- ✅ Secure file serving
- ✅ Watermark support (placeholder)

### S3 Storage Provider

- ✅ Multipart uploads for large files (>100MB)
- ✅ Server-side encryption
- ✅ Presigned URLs for secure access
- ✅ CloudFront CDN integration
- ✅ Cache invalidation
- ✅ Metadata support
- ✅ File validation
- ✅ Watermark support (placeholder)

### Factory Pattern

- ✅ Environment-based provider selection
- ✅ Automatic fallback to local storage
- ✅ Configuration validation
- ✅ Singleton pattern for efficiency
- ✅ Storage information reporting

## Error Handling

The system includes comprehensive error handling:

1. **Missing AWS credentials** - Falls back to local storage
2. **Invalid file types** - Throws validation errors
3. **File size limits** - Throws size limit errors
4. **S3 failures** - Falls back to local storage (hybrid mode)
5. **File not found** - Returns appropriate HTTP status

## Testing

Run the storage system test:

```bash
deno run --allow-all test-storage-system.ts
```

This will:
- Validate configuration
- Show storage information
- Test provider functionality
- Display environment variables
- Provide usage examples

## Security

### Local Storage
- Path traversal protection
- File type validation
- Size limit enforcement
- Metadata isolation

### S3 Storage
- Server-side encryption
- Presigned URL expiration
- IAM role-based access
- CloudFront security headers

## Migration Path

1. **Development**: Use local storage (default)
2. **Staging**: Test with S3 configuration
3. **Production**: Switch to S3 with environment variables
4. **Hybrid**: Use S3 with local fallback for reliability

## Monitoring

The system logs all operations:
- Provider selection decisions
- File upload/download operations
- Error conditions and fallbacks
- Configuration validation results

Check console logs for storage-related messages prefixed with:
- `Storage Factory:`
- `Local storage:`
- `S3 storage:`
- `Upload Service:`

## Next Steps

1. **Implement actual watermarking** - Replace placeholder functions
2. **Add file encryption** - Implement client-side encryption
3. **Add compression** - Optimize file sizes before upload
4. **Add progress tracking** - Real-time upload progress
5. **Add retry logic** - Automatic retry for failed operations