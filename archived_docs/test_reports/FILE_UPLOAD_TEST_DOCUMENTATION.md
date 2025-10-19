# File Upload Test Suite Documentation

## Overview
The `test-file-upload-workflows.sh` script provides comprehensive testing for all file upload functionality in the Pitchey application. It covers security validations, file type restrictions, storage management, and integration testing.

## Test Coverage

### 1. Script Upload Testing (.pdf, .doc, .docx)
- **Valid Formats**: PDF, DOCX, plain text
- **Size Validation**: Maximum 50MB for documents
- **Security**: Rejects executable files disguised as documents
- **Access Levels**: Tests public, basic, enhanced, and NDA access levels

### 2. Pitch Deck Upload Testing
- **Valid Formats**: PDF, PowerPoint (PPT/PPTX)
- **Size Validation**: Maximum 50MB
- **Type Validation**: Rejects video files for pitch decks
- **Watermarking**: Tests watermark application for confidential content

### 3. Lookbook/Image Gallery Testing
- **Valid Formats**: PNG, JPEG, GIF, WebP, PDF
- **Multiple Upload**: Simulates gallery upload with multiple images
- **Size Validation**: Maximum 10MB per image
- **Batch Processing**: Tests concurrent upload handling

### 4. Trailer/Video Upload Testing
- **Valid Formats**: MP4, QuickTime (MOV), AVI, WebM
- **Size Validation**: Maximum 500MB for videos
- **Type Validation**: Rejects non-video files for trailer uploads
- **Streaming**: Tests video processing and streaming preparation

### 5. Profile and Cover Image Testing
- **Profile Images**: User avatar uploads
- **Cover Images**: Background/banner image uploads
- **Size Optimization**: Tests image compression and resizing
- **Format Validation**: Ensures only image files are accepted

## Security Testing

### 1. File Type Validation
- **MIME Type Checking**: Validates actual file content vs. declared type
- **File Signature Validation**: Uses magic numbers to detect file types
- **Double Extension Prevention**: Blocks files like `malicious.pdf.exe`
- **Script Detection**: Prevents upload of executable scripts

### 2. Malicious File Detection
- **Executable Files**: Blocks Windows PE executables (.exe, .dll)
- **Script Files**: Prevents shell scripts and batch files
- **Dangerous Extensions**: Rejects potentially harmful file types
- **Content Scanning**: Basic signature-based malware detection

### 3. Path Traversal Prevention
- **Directory Traversal**: Tests for `../../../etc/passwd` style attacks
- **Filename Sanitization**: Ensures safe file naming
- **Storage Isolation**: Verifies files are stored in designated areas
- **Access Control**: Tests unauthorized file access prevention

### 4. File Size Restrictions
- **Per-Type Limits**: Different limits for images, documents, videos
- **Total Upload Limits**: Prevents excessive storage usage
- **Chunked Upload Support**: Tests large file handling
- **Progress Tracking**: Monitors upload progress for large files

## Storage Management Testing

### 1. Local Storage
- **File System**: Tests local file storage and organization
- **Directory Structure**: Validates proper folder organization
- **Permission Management**: Ensures correct file permissions
- **Cleanup**: Tests file deletion and cleanup processes

### 2. Cloud Storage Integration
- **AWS S3**: Tests S3 upload and management
- **CloudFront CDN**: Validates CDN integration and cache invalidation
- **Multipart Upload**: Tests chunked uploads for large files
- **Access Control**: Tests pre-signed URLs and access permissions

### 3. Hybrid Storage
- **Fallback Mechanism**: Tests S3 → Local fallback
- **Provider Selection**: Validates storage provider choice logic
- **Consistency**: Ensures data consistency across providers
- **Migration**: Tests moving files between storage types

## Access Control Testing

### 1. Authentication
- **Creator Access**: Tests creator file upload permissions
- **Investor Access**: Validates investor file access restrictions
- **Production Access**: Tests production company uploads
- **Anonymous Access**: Ensures unauthorized uploads are blocked

### 2. Authorization Levels
- **Public Files**: Accessible to all users
- **Basic Access**: Requires user registration
- **Enhanced Access**: Premium user access
- **NDA Protected**: Requires signed NDA for access

### 3. Pitch Ownership
- **Owner Uploads**: Allows pitch owners to upload files
- **Cross-User Uploads**: Prevents uploading to others' pitches
- **Collaboration**: Tests shared pitch upload permissions
- **Transfer**: Tests ownership transfer scenarios

## Performance Testing

### 1. Concurrent Uploads
- **Multiple Users**: Tests simultaneous uploads from different users
- **Same User**: Tests multiple files from single user
- **Resource Limits**: Validates server resource usage
- **Queue Management**: Tests upload queue handling

### 2. Large File Handling
- **Video Files**: Tests large video file uploads (up to 500MB)
- **Progress Tracking**: Monitors upload progress
- **Timeout Handling**: Tests connection timeout scenarios
- **Resume Capability**: Tests upload resume functionality

### 3. Network Conditions
- **Slow Connections**: Tests uploads over slow networks
- **Intermittent Connectivity**: Tests connection interruption handling
- **Bandwidth Limits**: Validates upload speed controls
- **Mobile Networks**: Tests mobile upload scenarios

## Watermarking and Processing

### 1. Image Watermarking
- **Text Overlay**: Adds confidential watermarks to images
- **Logo Integration**: Includes company/platform branding
- **Transparency**: Maintains image usability with watermarks
- **Batch Processing**: Tests watermarking multiple images

### 2. Document Watermarking
- **PDF Watermarks**: Adds watermarks to PDF documents
- **Page-by-Page**: Ensures all pages are watermarked
- **Confidentiality**: Marks documents as NDA protected
- **Preservation**: Maintains document formatting

### 3. Video Processing
- **Thumbnail Generation**: Creates video thumbnails
- **Format Conversion**: Converts to web-compatible formats
- **Compression**: Optimizes file sizes for streaming
- **Quality Options**: Tests different quality settings

## API Endpoint Testing

### Core Upload Endpoints
- `POST /api/media/upload` - Main file upload endpoint
- `POST /api/media/chunked-upload` - Large file upload
- `DELETE /api/media/delete` - File deletion
- `GET /api/media/upload-progress/:id` - Upload progress tracking

### Authentication Endpoints
- `POST /api/auth/creator/login` - Creator authentication
- `POST /api/auth/investor/login` - Investor authentication
- `POST /api/auth/production/login` - Production authentication

### File Management Endpoints
- `GET /api/pitches` - List pitches for upload testing
- `POST /api/users/profile-image` - Profile image upload
- `GET /api/media/stream/:id` - File streaming

## Error Handling

### 1. Validation Errors
- **File Too Large**: Returns appropriate error for oversized files
- **Invalid Type**: Rejects unsupported file formats
- **Missing Parameters**: Handles incomplete upload requests
- **Malformed Data**: Validates multipart form data

### 2. Network Errors
- **Connection Timeout**: Handles network timeouts gracefully
- **Upload Interruption**: Manages interrupted uploads
- **Server Errors**: Provides meaningful error messages
- **Retry Logic**: Tests automatic retry mechanisms

### 3. Storage Errors
- **Disk Full**: Handles insufficient storage space
- **Permission Denied**: Manages file system permission errors
- **Cloud Failures**: Handles AWS S3 service failures
- **Corruption**: Detects and handles file corruption

## Usage Instructions

### Running the Test Suite
```bash
# Make the script executable
chmod +x test-file-upload-workflows.sh

# Run all tests with default settings
./test-file-upload-workflows.sh

# Run tests against a different API URL
./test-file-upload-workflows.sh --api-url https://api.pitchey.com

# Show help information
./test-file-upload-workflows.sh --help
```

### Prerequisites
- **curl**: For making HTTP requests
- **jq**: For parsing JSON responses
- **dd**: For generating test files
- **bash**: Version 4.0 or higher

### Environment Setup
1. Ensure the Pitchey API is running on port 8001
2. Verify demo accounts exist (alex.creator@demo.com, sarah.investor@demo.com)
3. Configure storage providers (local/S3) as needed
4. Set appropriate file size limits in environment variables

### Test Configuration
```bash
# Environment variables for configuration
export MAX_IMAGE_SIZE_MB=10
export MAX_DOCUMENT_SIZE_MB=50
export MAX_VIDEO_SIZE_MB=500
export STORAGE_PROVIDER=hybrid
export AWS_S3_BUCKET=pitchey-uploads
```

## Test Output

### Success Indicators
- ✅ Green checkmarks for passed tests
- 📊 Summary statistics at the end
- 🎉 Success message if all critical tests pass

### Warning Indicators
- ⚠️ Yellow warnings for non-critical issues
- 📝 Information messages for reference
- 🔍 Debug information when needed

### Failure Indicators
- ❌ Red X marks for failed tests
- 💥 Error details and response codes
- 📋 Suggestions for fixing issues

### Sample Output
```
📁 Comprehensive File Upload Test Suite for Pitchey
==================================================

🔍 Checking API availability...
  ✅ API is available at http://localhost:8001

📋 Setting Up Authentication
----------------------------------------
  ✅ Creator authentication successful
  ✅ Investor authentication successful
  ✅ Using existing pitch ID: 45

📋 Testing Script File Uploads
----------------------------------------
  ✅ Valid PDF script upload
  ✅ Valid DOCX script upload
  ✅ Invalid PNG for script (should fail)

========================================
📊 Test Summary
========================================
✅ Passed: 15
❌ Failed: 0
⚠️ Warnings: 2
========================================
Pass Rate: 100%

🎉 All critical tests passed!
```

## Troubleshooting

### Common Issues

1. **API Not Available**
   - Ensure the server is running on port 8001
   - Check firewall settings
   - Verify network connectivity

2. **Authentication Failures**
   - Confirm demo accounts exist
   - Check password requirements
   - Verify JWT token generation

3. **File Upload Failures**
   - Check file size limits
   - Verify storage configuration
   - Ensure proper permissions

4. **Missing Dependencies**
   - Install curl: `apt-get install curl`
   - Install jq: `apt-get install jq`
   - Update bash: `apt-get install bash`

### Debug Mode
Add debug output by modifying the script:
```bash
# Enable verbose curl output
curl -v ...

# Show all variables
set -x

# Print additional debug info
echo "DEBUG: Token = $CREATOR_TOKEN"
echo "DEBUG: Pitch ID = $TEST_PITCH_ID"
```

## Integration with CI/CD

### GitHub Actions
```yaml
name: File Upload Tests
on: [push, pull_request]
jobs:
  upload-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y curl jq
      - name: Start API server
        run: |
          npm install
          npm start &
          sleep 10
      - name: Run upload tests
        run: ./test-file-upload-workflows.sh
```

### Docker Testing
```dockerfile
FROM node:16-alpine
RUN apk add --no-cache curl jq bash
COPY . /app
WORKDIR /app
RUN npm install
CMD ["./test-file-upload-workflows.sh"]
```

## Maintenance

### Regular Updates
- Update file signatures for new file types
- Add support for new storage providers
- Enhance security validation rules
- Update API endpoint changes

### Performance Monitoring
- Monitor test execution time
- Track file upload speeds
- Measure storage usage
- Analyze error rates

### Security Reviews
- Review new attack vectors
- Update malicious file signatures
- Enhance path traversal prevention
- Audit access control mechanisms

This test suite provides comprehensive coverage of all file upload functionality and should be run regularly to ensure the Pitchey platform maintains high security and reliability standards.