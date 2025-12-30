# Multiple File Upload System

This document describes the comprehensive multiple file upload system implemented for Pitchey, including frontend components, backend services, and R2 storage integration.

## Overview

The multiple file upload system provides:
- **Concurrent uploads** with configurable limits
- **Drag & drop interface** with visual feedback
- **Progress tracking** with speed and ETA calculations
- **File type validation** and size limits
- **Retry functionality** for failed uploads
- **Bulk operations** (select all, upload all, delete selected)
- **Grid/List view modes** for file management
- **Preview capabilities** for images and videos
- **R2 storage integration** with CDN support
- **Deduplication** to avoid duplicate uploads

## Components

### 1. DocumentUpload Component

**Location**: `/frontend/src/components/DocumentUpload/DocumentUpload.tsx`

A specialized component for uploading documents (scripts, treatments, pitch decks, etc.) with business logic specific to pitch creation.

#### Features:
- Document type categorization (script, treatment, pitch_deck, etc.)
- NDA configuration integration
- Document metadata (title, description, type)
- Support for PDF, DOC, DOCX, PPT, PPTX, TXT files
- Maximum 15 files, 10MB per file

#### Usage:
```tsx
import { DocumentUpload, DocumentFile } from '../components/DocumentUpload';

function MyComponent() {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);

  return (
    <DocumentUpload
      documents={documents}
      onChange={setDocuments}
      maxFiles={15}
      maxFileSize={10}
      enableConcurrentUploads={true}
      maxConcurrentUploads={3}
      showBulkActions={true}
      viewMode="list"
    />
  );
}
```

#### Props:
- `documents`: Array of DocumentFile objects
- `onChange`: Callback when documents change
- `maxFiles`: Maximum number of files (default: 15)
- `maxFileSize`: Maximum file size in MB (default: 10)
- `enableConcurrentUploads`: Enable concurrent uploading (default: true)
- `maxConcurrentUploads`: Max concurrent uploads (default: 3)
- `showBulkActions`: Show bulk selection/actions (default: true)
- `viewMode`: Display mode 'grid' or 'list' (default: 'list')

### 2. FileUpload Component

**Location**: `/frontend/src/components/FileUpload/FileUpload.tsx`

A general-purpose component for uploading media files (images, videos, audio, documents, archives).

#### Features:
- Multi-format support (images, videos, audio, documents, archives)
- Automatic thumbnail generation for images/videos
- Metadata extraction (dimensions, duration, file size)
- Preview modal for media files
- Support for larger files (up to 50MB)
- Maximum 20 files per upload

#### Usage:
```tsx
import { FileUpload, MediaFile } from '../components/FileUpload';

function MyComponent() {
  const [files, setFiles] = useState<MediaFile[]>([]);

  return (
    <FileUpload
      files={files}
      onChange={setFiles}
      maxFiles={20}
      maxFileSize={50}
      enableThumbnails={true}
      enableMetadataExtraction={true}
      viewMode="grid"
    />
  );
}
```

#### Props:
- `files`: Array of MediaFile objects
- `onChange`: Callback when files change
- `acceptedTypes`: Array of accepted MIME types
- `maxFiles`: Maximum number of files (default: 20)
- `maxFileSize`: Maximum file size in MB (default: 50)
- `enableThumbnails`: Generate thumbnails (default: true)
- `enableMetadataExtraction`: Extract file metadata (default: true)

## Backend Services

### 1. Enhanced Upload Endpoints

#### Multiple Document Upload
**Endpoint**: `POST /api/upload/documents`

Uploads multiple documents with enhanced metadata support.

**Request Format**:
```
FormData with:
- files: File[] (multiple files)
- documentTypes: string[] (document types)
- titles: string[] (document titles)
- descriptions: string[] (descriptions)
```

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "id": "uuid",
      "file": "filename.pdf",
      "title": "Document Title",
      "description": "Description",
      "documentType": "script",
      "url": "https://cdn.example.com/file.pdf",
      "cdnUrl": "https://cdn.example.com/file.pdf",
      "key": "documents/user123/file.pdf",
      "size": 1048576,
      "mimeType": "application/pdf",
      "provider": "r2",
      "uploadedAt": "2025-11-02T10:00:00Z",
      "uploadedBy": 123
    }
  ],
  "errors": [],
  "uploaded": 1,
  "failed": 0,
  "message": "1 file(s) uploaded successfully"
}
```

#### Multiple Media Upload
**Endpoint**: `POST /api/upload/media-batch`

Uploads multiple media files with metadata extraction.

**Request Format**:
```
FormData with:
- files: File[] (multiple files)
- titles: string[] (file titles)
- descriptions: string[] (descriptions)
- metadata: string[] (JSON-encoded metadata)
```

#### Upload Information
**Endpoint**: `GET /api/upload/info`

Returns upload configuration and limits.

**Response**:
```json
{
  "maxFileSize": 52428800,
  "allowedTypes": ["image/jpeg", "video/mp4", ...],
  "maxFiles": 20,
  "totalStorage": 1073741824,
  "usedStorage": 0,
  "remainingStorage": 1073741824,
  "uploadLimits": {
    "hourly": 100,
    "daily": 500,
    "monthly": 2000
  },
  "currentUsage": {
    "hourly": 0,
    "daily": 0,
    "monthly": 0
  },
  "features": {
    "concurrentUploads": true,
    "chunkUpload": false,
    "deduplication": true,
    "previewGeneration": true
  },
  "provider": "r2"
}
```

### 2. Storage Integration

The system integrates with Cloudflare R2 storage through the existing storage service:

**Location**: `/src/services/storage.service.ts`

Features:
- R2 bucket integration via `wrangler.toml` configuration
- File validation and security checks
- Automatic file naming and collision prevention
- Metadata preservation
- CDN URL generation

### 3. Upload Service Enhancements

**Location**: `/frontend/src/services/upload.service.ts`

Enhanced with:
- **Concurrent upload management**: Queue-based system with configurable limits
- **Progress tracking**: Real-time progress with speed and ETA calculations
- **Retry logic**: Automatic retry with exponential backoff
- **Deduplication**: File hash checking to avoid duplicate uploads
- **Enhanced error handling**: Detailed error reporting per file

#### Key Methods:

```typescript
// Upload multiple documents
uploadMultipleDocumentsEnhanced(files, options): Promise<{results, errors}>

// Upload multiple media files
uploadMultipleMediaEnhanced(files, options): Promise<{results, errors}>

// Upload with comprehensive progress tracking
uploadFilesWithProgress(files, onProgress, onComplete, onError): Promise<{results, errors}>

// Get upload information
getUploadInfo(): Promise<UploadInfo>

// Check file existence for deduplication
checkFileExists(hash): Promise<{exists, url?}>
```

## File Types and Limits

### Document Files (DocumentUpload)
- **Types**: PDF, DOC, DOCX, PPT, PPTX, TXT
- **Max Size**: 10MB per file
- **Max Files**: 15 files per upload
- **Categories**: script, treatment, pitch_deck, lookbook, budget, nda, supporting_materials

### Media Files (FileUpload)
- **Images**: JPEG, PNG, WebP, GIF, SVG
- **Videos**: MP4, MOV, AVI, WebM
- **Audio**: MP3, WAV, OGG, M4A
- **Documents**: PDF, DOC, DOCX
- **Archives**: ZIP, RAR
- **Max Size**: 50MB per file
- **Max Files**: 20 files per upload

## Security Features

1. **File Type Validation**: MIME type and extension checking
2. **File Size Limits**: Configurable per file type
3. **File Signature Validation**: Magic number checking to prevent file type spoofing
4. **Authentication Required**: All uploads require valid JWT token
5. **User Isolation**: Files are stored in user-specific folders
6. **NDA Protection**: Documents can be marked as NDA-protected

## Progress Tracking

The system provides comprehensive progress tracking:

```typescript
interface UploadProgress {
  loaded: number;          // Bytes uploaded
  total: number;           // Total bytes
  percentage: number;      // Percentage complete
  speed?: number;          // Upload speed (bytes/sec)
  estimatedTimeRemaining?: number; // ETA in seconds
}
```

Progress is tracked at both individual file and overall batch levels.

## Error Handling

### Frontend Error Handling
- File validation errors (type, size, duplicate)
- Network errors with retry capability
- Server errors with detailed messages
- Per-file error tracking in batch uploads

### Backend Error Handling
- Comprehensive validation before processing
- Graceful failure with partial success reporting
- Detailed error messages for debugging
- Storage provider error translation

## Usage Examples

### Basic Document Upload
```tsx
import { DocumentUpload } from '../components/DocumentUpload';

function PitchCreation() {
  const [documents, setDocuments] = useState([]);
  
  const handleDocumentUpload = (docs) => {
    setDocuments(docs);
    // Documents are automatically uploaded when added
  };

  return (
    <DocumentUpload
      documents={documents}
      onChange={handleDocumentUpload}
      maxFiles={10}
      maxFileSize={10}
      enableConcurrentUploads={true}
    />
  );
}
```

### Advanced Media Upload with Progress
```tsx
import { FileUpload } from '../components/FileUpload';

function MediaGallery() {
  const [files, setFiles] = useState([]);
  
  const handleUploadComplete = (file) => {
    console.log('Upload completed:', file);
  };
  
  const handleUploadError = (file, error) => {
    console.error('Upload failed:', file, error);
  };

  return (
    <FileUpload
      files={files}
      onChange={setFiles}
      onUploadComplete={handleUploadComplete}
      onUploadError={handleUploadError}
      enableConcurrentUploads={true}
      maxConcurrentUploads={5}
      enableThumbnails={true}
      showPreview={true}
      viewMode="grid"
    />
  );
}
```

### Manual Upload with Service
```typescript
import { uploadService } from '../services/upload.service';

async function uploadFilesManually(files) {
  try {
    const fileData = files.map(file => ({
      file,
      type: file.type.startsWith('image/') ? 'media' : 'document',
      title: file.name,
      description: 'Auto-uploaded file'
    }));
    
    const result = await uploadService.uploadFilesWithProgress(
      fileData,
      (index, progress) => {
        console.log(`File ${index}: ${progress.percentage}%`);
      },
      (index, result) => {
        console.log(`File ${index} completed:`, result);
      },
      (index, error) => {
        console.error(`File ${index} failed:`, error);
      }
    );
    
    console.log('Upload results:', result);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

## Configuration

### Frontend Configuration
Update `.env` files to configure upload endpoints:
```env
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```

### Backend Configuration
The R2 storage is configured in `wrangler.toml`:
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "pitchey-uploads"
```

## Performance Considerations

1. **Concurrent Uploads**: Default limit of 3 concurrent uploads to balance speed and resource usage
2. **File Size Limits**: Reasonable limits to prevent timeout and memory issues
3. **Progress Throttling**: Progress updates are throttled to prevent UI flooding
4. **CDN Integration**: Uploaded files are served via CDN for optimal performance
5. **Lazy Loading**: File previews and thumbnails are generated on-demand

## Browser Compatibility

The system supports modern browsers with:
- File API support
- FormData support
- XMLHttpRequest Level 2
- Drag and drop API
- Web Crypto API (for file hashing)

## Future Enhancements

1. **Chunked Uploads**: For very large files (>100MB)
2. **Resumable Uploads**: Resume interrupted uploads
3. **Background Sync**: Upload files in background with Service Workers
4. **Image Processing**: Automatic image optimization and format conversion
5. **Video Processing**: Automatic video transcoding and thumbnail generation
6. **Advanced Analytics**: Upload statistics and user behavior tracking

## Troubleshooting

### Common Issues

1. **Upload Fails Immediately**
   - Check file size limits
   - Verify file type is supported
   - Ensure user is authenticated

2. **Progress Tracking Not Working**
   - Verify XMLHttpRequest is being used (not fetch for progress)
   - Check that onProgress callback is provided

3. **Concurrent Uploads Not Working**
   - Verify `enableConcurrentUploads` is true
   - Check `maxConcurrentUploads` setting
   - Monitor browser network limits

4. **Files Not Appearing in R2**
   - Check R2 bucket configuration in `wrangler.toml`
   - Verify R2 bucket permissions
   - Check backend logs for storage errors

### Debug Information

Enable debug logging:
```typescript
// Frontend
localStorage.setItem('uploadDebug', 'true');

// Backend logs will show detailed upload information
```

This comprehensive upload system provides a robust, user-friendly solution for handling multiple file uploads in the Pitchey platform while maintaining security, performance, and reliability.