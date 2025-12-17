import { Context } from "hono";
import { Hono } from "hono";
import { getCors } from "../middleware/cors.ts";
import { validateAuth } from "../middleware/auth.middleware.ts";
import { UploadService } from "../services/upload.service.ts";
import { FileValidationService } from "../services/file-validation.service.ts";
import { PitchDocumentService } from "../services/pitchDocument.service.ts";
import type { AuthenticatedUser } from "../types/auth.types.ts";

const upload = new Hono();

// Apply CORS middleware
upload.use('/*', getCors());

/**
 * POST /api/upload
 * Single file upload
 */
upload.post('/upload', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    // Get form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'uploads';
    const documentType = formData.get('documentType') as string || 'supporting';
    const pitchId = formData.get('pitchId') as string;
    const isPublic = formData.get('isPublic') === 'true';
    const requiresNda = formData.get('requiresNda') === 'true';

    if (!file) {
      return c.json({
        success: false,
        error: 'No file provided'
      }, 400);
    }

    // Determine file category
    const fileCategory = getFileCategory(file.type, documentType);
    
    // Validate file
    const validationResult = await FileValidationService.validateFile(file, fileCategory, {
      enforceSizeLimit: true,
      validateSignature: true,
      checkSecurity: true
    });

    if (!validationResult.isValid) {
      return c.json({
        success: false,
        error: 'File validation failed',
        details: validationResult.errors
      }, 400);
    }

    // Check user quota
    const quotaCheck = await FileValidationService.checkUserQuota(user.userId, file.size);
    if (!quotaCheck.allowed) {
      return c.json({
        success: false,
        error: 'Storage quota exceeded',
        quota: quotaCheck
      }, 409);
    }

    // Upload file
    const uploadResult = await UploadService.uploadFile(file, folder, {
      publicRead: isPublic,
      metadata: {
        userId: user.userId.toString(),
        documentType,
        originalName: file.name,
        uploadedBy: user.email,
        uploadedAt: new Date().toISOString()
      }
    });

    // Save document metadata to database if pitch is specified
    let documentRecord = null;
    if (pitchId) {
      documentRecord = await PitchDocumentService.createDocument({
        pitchId: parseInt(pitchId),
        fileName: FileValidationService.sanitizeFilename(file.name),
        originalFileName: file.name,
        fileUrl: uploadResult.url,
        fileKey: uploadResult.key,
        fileType: file.type,
        mimeType: file.type,
        fileSize: file.size,
        documentType,
        isPublic,
        requiresNda,
        uploadedBy: user.userId,
        metadata: {
          validation: validationResult,
          uploadResult,
          cdnUrl: uploadResult.cdnUrl
        }
      });
    }

    return c.json({
      success: true,
      data: {
        file: uploadResult,
        document: documentRecord,
        validation: {
          warnings: validationResult.warnings,
          metadata: validationResult.metadata
        }
      }
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return c.json({
      success: false,
      error: 'Upload failed',
      message: error.message
    }, 500);
  }
});

/**
 * POST /api/upload/multiple
 * Multiple file upload
 */
upload.post('/upload/multiple', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    const formData = await c.req.formData();
    const files = formData.getAll('files') as File[];
    const folder = formData.get('folder') as string || 'uploads';
    const documentType = formData.get('documentType') as string || 'supporting';
    const pitchId = formData.get('pitchId') as string;
    const isPublic = formData.get('isPublic') === 'true';
    const requiresNda = formData.get('requiresNda') === 'true';

    if (!files || files.length === 0) {
      return c.json({
        success: false,
        error: 'No files provided'
      }, 400);
    }

    // Validate all files first
    const validationResults = [];
    let totalSize = 0;

    for (const file of files) {
      const fileCategory = getFileCategory(file.type, documentType);
      const validation = await FileValidationService.validateFile(file, fileCategory);
      validationResults.push({ file: file.name, validation });
      totalSize += file.size;
    }

    // Check for validation errors
    const invalidFiles = validationResults.filter(r => !r.validation.isValid);
    if (invalidFiles.length > 0) {
      return c.json({
        success: false,
        error: 'Some files failed validation',
        details: invalidFiles.map(f => ({
          file: f.file,
          errors: f.validation.errors
        }))
      }, 400);
    }

    // Check total quota
    const quotaCheck = await FileValidationService.checkUserQuota(user.userId, totalSize);
    if (!quotaCheck.allowed) {
      return c.json({
        success: false,
        error: 'Total files size exceeds storage quota',
        quota: quotaCheck
      }, 409);
    }

    // Upload all files
    const uploadResults = [];
    const documentRecords = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const uploadResult = await UploadService.uploadFile(file, folder, {
          publicRead: isPublic,
          metadata: {
            userId: user.userId.toString(),
            documentType,
            originalName: file.name,
            uploadedBy: user.email,
            uploadedAt: new Date().toISOString(),
            batchUpload: 'true',
            batchIndex: i.toString()
          }
        });

        uploadResults.push({
          file: file.name,
          success: true,
          result: uploadResult
        });

        // Save to database if pitch is specified
        if (pitchId) {
          const documentRecord = await PitchDocumentService.createDocument({
            pitchId: parseInt(pitchId),
            fileName: FileValidationService.sanitizeFilename(file.name),
            originalFileName: file.name,
            fileUrl: uploadResult.url,
            fileKey: uploadResult.key,
            fileType: file.type,
            mimeType: file.type,
            fileSize: file.size,
            documentType,
            isPublic,
            requiresNda,
            uploadedBy: user.userId,
            metadata: {
              validation: validationResults[i].validation,
              uploadResult,
              batchUpload: true,
              batchIndex: i
            }
          });
          documentRecords.push(documentRecord);
        }

      } catch (error: any) {
        uploadResults.push({
          file: file.name,
          success: false,
          error: error.message
        });
      }
    }

    const successful = uploadResults.filter(r => r.success).length;
    const failed = uploadResults.filter(r => !r.success).length;

    return c.json({
      success: failed === 0,
      data: {
        summary: {
          total: files.length,
          successful,
          failed
        },
        uploads: uploadResults,
        documents: documentRecords,
        validations: validationResults.map(v => ({
          file: v.file,
          warnings: v.validation.warnings
        }))
      }
    });

  } catch (error: any) {
    console.error('Multiple upload error:', error);
    return c.json({
      success: false,
      error: 'Multiple upload failed',
      message: error.message
    }, 500);
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
upload.delete('/documents/:id', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const documentId = parseInt(c.req.param('id'));

    if (!documentId) {
      return c.json({
        success: false,
        error: 'Invalid document ID'
      }, 400);
    }

    // Get document info
    const document = await PitchDocumentService.getDocument(documentId);
    if (!document) {
      return c.json({
        success: false,
        error: 'Document not found'
      }, 404);
    }

    // Check permissions - only owner or admin can delete
    if (document.uploadedBy !== user.userId && user.userType !== 'admin') {
      return c.json({
        success: false,
        error: 'Permission denied'
      }, 403);
    }

    // Delete from storage
    if (document.fileKey) {
      try {
        await UploadService.deleteFile(document.fileKey);
      } catch (error) {
        console.warn('Failed to delete file from storage:', error);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from database
    await PitchDocumentService.deleteDocument(documentId);

    return c.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error: any) {
    console.error('Document deletion error:', error);
    return c.json({
      success: false,
      error: 'Document deletion failed',
      message: error.message
    }, 500);
  }
});

/**
 * GET /api/documents/:id/url
 * Get presigned URL for document access
 */
upload.get('/documents/:id/url', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const documentId = parseInt(c.req.param('id'));
    const expiresIn = parseInt(c.req.query('expires') || '3600'); // 1 hour default

    if (!documentId) {
      return c.json({
        success: false,
        error: 'Invalid document ID'
      }, 400);
    }

    const document = await PitchDocumentService.getDocument(documentId);
    if (!document) {
      return c.json({
        success: false,
        error: 'Document not found'
      }, 404);
    }

    // Check access permissions
    const hasAccess = await PitchDocumentService.checkDocumentAccess(documentId, user.userId);
    if (!hasAccess) {
      return c.json({
        success: false,
        error: 'Access denied - NDA may be required'
      }, 403);
    }

    // Generate presigned URL
    const presignedUrl = await UploadService.getPresignedDownloadUrl(document.fileKey, expiresIn);

    // Track download
    await PitchDocumentService.trackDownload(documentId, user.userId);

    return c.json({
      success: true,
      data: {
        url: presignedUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        document: {
          id: document.id,
          fileName: document.fileName,
          fileSize: document.fileSize,
          documentType: document.documentType
        }
      }
    });

  } catch (error: any) {
    console.error('Presigned URL generation error:', error);
    return c.json({
      success: false,
      error: 'Failed to generate download URL',
      message: error.message
    }, 500);
  }
});

/**
 * POST /api/upload/presigned
 * Get presigned upload URL for direct browser upload
 */
upload.post('/upload/presigned', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const { fileName, contentType, folder = 'uploads', fileSize } = await c.req.json();

    if (!fileName || !contentType) {
      return c.json({
        success: false,
        error: 'Missing fileName or contentType'
      }, 400);
    }

    // Determine file category and validate
    const fileCategory = getFileCategory(contentType);
    
    // Basic validation
    if (fileSize) {
      const maxSize = {
        image: 10 * 1024 * 1024,
        document: 100 * 1024 * 1024,
        video: 2 * 1024 * 1024 * 1024,
        script: 50 * 1024 * 1024
      }[fileCategory];

      if (fileSize > maxSize) {
        return c.json({
          success: false,
          error: `File size exceeds limit for ${fileCategory} files`
        }, 400);
      }

      // Check quota
      const quotaCheck = await FileValidationService.checkUserQuota(user.userId, fileSize);
      if (!quotaCheck.allowed) {
        return c.json({
          success: false,
          error: 'Storage quota exceeded',
          quota: quotaCheck
        }, 409);
      }
    }

    // Generate unique key
    const key = UploadService.generateKey(folder, fileName);
    
    // Generate presigned upload URL
    const presignedResult = await UploadService.getPresignedUploadUrl(
      key,
      contentType,
      {
        userId: user.userId.toString(),
        originalName: fileName,
        uploadedBy: user.email,
        uploadedAt: new Date().toISOString()
      },
      3600 // 1 hour expiry
    );

    return c.json({
      success: true,
      data: {
        uploadUrl: presignedResult.uploadUrl,
        key: presignedResult.key,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        fields: {
          'Content-Type': contentType,
          'x-amz-meta-user-id': user.userId.toString(),
          'x-amz-meta-original-name': fileName
        }
      }
    });

  } catch (error: any) {
    console.error('Presigned upload URL error:', error);
    return c.json({
      success: false,
      error: 'Failed to generate upload URL',
      message: error.message
    }, 500);
  }
});

/**
 * GET /api/upload/quota
 * Get user storage quota information
 */
upload.get('/upload/quota', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    const quota = await FileValidationService.checkUserQuota(user.userId, 0);
    
    return c.json({
      success: true,
      data: {
        currentUsage: quota.currentUsage,
        maxQuota: quota.maxQuota,
        remainingQuota: quota.remainingQuota,
        usagePercentage: Math.round((quota.currentUsage / quota.maxQuota) * 100),
        formattedUsage: formatFileSize(quota.currentUsage),
        formattedQuota: formatFileSize(quota.maxQuota),
        formattedRemaining: formatFileSize(quota.remainingQuota)
      }
    });

  } catch (error: any) {
    console.error('Quota check error:', error);
    return c.json({
      success: false,
      error: 'Failed to check quota',
      message: error.message
    }, 500);
  }
});

// Helper functions
function getFileCategory(mimeType: string, documentType?: string): 'image' | 'document' | 'video' | 'script' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (documentType === 'script') return 'script';
  return 'document';
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export { upload };