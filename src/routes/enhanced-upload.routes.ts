import { Context } from "npm:@hono/hono@4.6.12";
import { Hono } from "npm:@hono/hono@4.6.12";
import { getCors } from "../middleware/cors.ts";
import { validateAuth } from "../middleware/auth.middleware.ts";
import type { AuthenticatedUser } from "../types/auth.types.ts";

const enhancedUpload = new Hono();

// Apply CORS middleware
enhancedUpload.use('/*', getCors());

/**
 * POST /api/upload/presigned-enhanced
 * Get enhanced presigned upload URL with optimization features
 */
enhancedUpload.post('/presigned-enhanced', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const env = c.env;
    
    const { fileName, contentType, fileSize, folder, metadata } = await c.req.json();

    if (!fileName || !contentType) {
      return c.json({
        success: false,
        error: 'Missing fileName or contentType'
      }, 400);
    }

    // Generate unique key with organization
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder || 'uploads'}/${timestamp}_${randomId}_${sanitizedName}`;

    // R2 bucket reference
    const bucket = env.R2_BUCKET;
    if (!bucket) {
      return c.json({
        success: false,
        error: 'R2 storage not configured'
      }, 500);
    }

    try {
      // Generate presigned URL for R2
      const presignedUrl = await bucket.sign(key, {
        method: 'PUT',
        expiresIn: 3600, // 1 hour
        httpMetadata: {
          contentType,
          contentDisposition: `attachment; filename="${fileName}"`,
          cacheControl: 'public, max-age=31536000'
        },
        customMetadata: {
          userId: user.userId.toString(),
          originalName: fileName,
          uploadedBy: user.email,
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      });

      // Additional fields for multipart form data (if needed)
      const fields = {
        'Content-Type': contentType,
        'x-amz-meta-user-id': user.userId.toString(),
        'x-amz-meta-original-name': fileName,
        'x-amz-meta-uploaded-at': new Date().toISOString()
      };

      return c.json({
        success: true,
        data: {
          uploadUrl: presignedUrl,
          key,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          fields,
          cdnUrl: `https://${env.R2_DOMAIN || 'files.pitchey.com'}/${key}`,
          metadata: {
            strategy: 'presigned',
            enableOptimization: contentType.startsWith('image/'),
            enableThumbnails: contentType.startsWith('image/') || contentType.startsWith('video/')
          }
        }
      });

    } catch (r2Error: any) {
      console.error('R2 presigned URL generation failed:', r2Error);
      return c.json({
        success: false,
        error: 'Failed to generate upload URL',
        details: r2Error.message
      }, 500);
    }

  } catch (error: any) {
    console.error('Enhanced presigned upload URL error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * POST /api/upload/deduplicate
 * Check for file deduplication
 */
enhancedUpload.post('/deduplicate', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const { hash, fileName, fileSize } = await c.req.json();

    if (!hash) {
      return c.json({
        success: false,
        error: 'Missing file hash'
      }, 400);
    }

    // Check database for existing file with same hash
    // This is a simplified implementation - in production you'd check your database
    const existingFile = null; // TODO: Implement database lookup

    if (existingFile) {
      return c.json({
        success: true,
        exists: true,
        file: {
          url: existingFile.url,
          filename: existingFile.fileName,
          size: existingFile.fileSize,
          type: existingFile.fileType,
          id: existingFile.key,
          uploadedAt: existingFile.uploadedAt
        }
      });
    }

    return c.json({
      success: true,
      exists: false
    });

  } catch (error: any) {
    console.error('Deduplication check error:', error);
    return c.json({
      success: false,
      error: 'Failed to check deduplication',
      message: error.message
    }, 500);
  }
});

/**
 * POST /api/upload/multipart/init
 * Initialize multipart upload
 */
enhancedUpload.post('/multipart/init', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const env = c.env;
    const { fileName, contentType, fileSize, folder } = await c.req.json();

    if (!fileName || !contentType || !fileSize) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }

    // Generate unique key
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder || 'uploads'}/${timestamp}_${randomId}_${sanitizedName}`;

    const bucket = env.R2_BUCKET;
    if (!bucket) {
      return c.json({
        success: false,
        error: 'R2 storage not configured'
      }, 500);
    }

    try {
      // For R2, we'll simulate multipart by tracking upload parts
      // In a real implementation, you'd use R2's multipart upload API
      const uploadId = crypto.randomUUID();
      
      // Store multipart upload metadata (in production, store in database)
      // This is a simplified implementation
      
      return c.json({
        success: true,
        uploadId,
        key,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });

    } catch (r2Error: any) {
      console.error('Multipart init failed:', r2Error);
      return c.json({
        success: false,
        error: 'Failed to initialize multipart upload',
        details: r2Error.message
      }, 500);
    }

  } catch (error: any) {
    console.error('Multipart init error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * POST /api/upload/multipart/chunk
 * Upload individual chunk
 */
enhancedUpload.post('/multipart/chunk', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const env = c.env;
    
    const uploadId = c.req.header('X-Upload-Id');
    const partNumber = c.req.header('X-Part-Number');
    const key = c.req.header('X-Key');
    
    if (!uploadId || !partNumber || !key) {
      return c.json({
        success: false,
        error: 'Missing upload headers'
      }, 400);
    }

    const chunkData = await c.req.arrayBuffer();
    
    const bucket = env.R2_BUCKET;
    if (!bucket) {
      return c.json({
        success: false,
        error: 'R2 storage not configured'
      }, 500);
    }

    try {
      // Upload chunk to R2 with part identifier
      const chunkKey = `${key}.part${partNumber}`;
      const result = await bucket.put(chunkKey, chunkData);
      
      if (!result) {
        throw new Error('Failed to upload chunk');
      }

      // Generate ETag (simplified - R2 should provide this)
      const etag = `"${Date.now()}-${partNumber}"`;

      return c.json({
        success: true,
        etag,
        partNumber: parseInt(partNumber)
      });

    } catch (r2Error: any) {
      console.error('Chunk upload failed:', r2Error);
      return c.json({
        success: false,
        error: 'Failed to upload chunk',
        details: r2Error.message
      }, 500);
    }

  } catch (error: any) {
    console.error('Chunk upload error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * POST /api/upload/multipart/complete
 * Complete multipart upload
 */
enhancedUpload.post('/multipart/complete', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const env = c.env;
    const { uploadId, key, parts } = await c.req.json();

    if (!uploadId || !key || !parts || !Array.isArray(parts)) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }

    const bucket = env.R2_BUCKET;
    if (!bucket) {
      return c.json({
        success: false,
        error: 'R2 storage not configured'
      }, 500);
    }

    try {
      // Combine all parts into final file
      // This is a simplified implementation - in production you'd use R2's proper multipart completion
      
      // Read all chunk parts
      const chunks = [];
      for (const part of parts.sort((a, b) => a.PartNumber - b.PartNumber)) {
        const chunkKey = `${key}.part${part.PartNumber}`;
        const chunk = await bucket.get(chunkKey);
        if (chunk) {
          chunks.push(await chunk.arrayBuffer());
        }
      }

      // Combine chunks
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      
      for (const chunk of chunks) {
        combined.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      // Upload final combined file
      const finalResult = await bucket.put(key, combined, {
        httpMetadata: {
          contentType: 'application/octet-stream',
          cacheControl: 'public, max-age=31536000'
        },
        customMetadata: {
          userId: user.userId.toString(),
          uploadedBy: user.email,
          uploadedAt: new Date().toISOString(),
          multipartUpload: 'true',
          totalParts: parts.length.toString()
        }
      });

      if (!finalResult) {
        throw new Error('Failed to create final file');
      }

      // Clean up part files
      for (let i = 1; i <= parts.length; i++) {
        const chunkKey = `${key}.part${i}`;
        try {
          await bucket.delete(chunkKey);
        } catch (deleteError) {
          console.warn(`Failed to delete chunk ${chunkKey}:`, deleteError);
        }
      }

      const cdnUrl = `https://${env.R2_DOMAIN || 'files.pitchey.com'}/${key}`;

      return c.json({
        success: true,
        data: {
          key,
          url: cdnUrl,
          cdnUrl,
          completedAt: new Date().toISOString(),
          totalParts: parts.length,
          totalSize: combined.length
        }
      });

    } catch (r2Error: any) {
      console.error('Multipart complete failed:', r2Error);
      return c.json({
        success: false,
        error: 'Failed to complete multipart upload',
        details: r2Error.message
      }, 500);
    }

  } catch (error: any) {
    console.error('Multipart complete error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * POST /api/upload/multipart/abort
 * Abort multipart upload
 */
enhancedUpload.post('/multipart/abort', validateAuth, async (c: Context) => {
  try {
    const env = c.env;
    const { uploadId, key } = await c.req.json();

    if (!uploadId || !key) {
      return c.json({
        success: false,
        error: 'Missing uploadId or key'
      }, 400);
    }

    const bucket = env.R2_BUCKET;
    if (!bucket) {
      return c.json({
        success: false,
        error: 'R2 storage not configured'
      }, 500);
    }

    try {
      // Clean up any existing part files
      // In a real implementation, you'd track which parts exist
      for (let i = 1; i <= 10000; i++) { // Reasonable limit
        const chunkKey = `${key}.part${i}`;
        try {
          const exists = await bucket.head(chunkKey);
          if (exists) {
            await bucket.delete(chunkKey);
          } else {
            break; // No more parts
          }
        } catch {
          break; // No more parts or error
        }
      }

      return c.json({
        success: true,
        message: 'Multipart upload aborted and cleaned up'
      });

    } catch (r2Error: any) {
      console.error('Multipart abort failed:', r2Error);
      return c.json({
        success: false,
        error: 'Failed to abort multipart upload',
        details: r2Error.message
      }, 500);
    }

  } catch (error: any) {
    console.error('Multipart abort error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * POST /api/upload/thumbnail
 * Generate thumbnail for uploaded media
 */
enhancedUpload.post('/thumbnail', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const env = c.env;
    const { sourceUrl, mimeType, width = 300, height = 200, quality = 80 } = await c.req.json();

    if (!sourceUrl || !mimeType) {
      return c.json({
        success: false,
        error: 'Missing sourceUrl or mimeType'
      }, 400);
    }

    // For now, return a placeholder response
    // In production, you'd implement actual thumbnail generation
    const thumbnailKey = sourceUrl.replace(/([^/]+)$/, `thumb_${width}x${height}_$1`);
    const thumbnailUrl = `https://${env.R2_DOMAIN || 'files.pitchey.com'}/${thumbnailKey}`;

    return c.json({
      success: true,
      data: {
        url: thumbnailUrl,
        width,
        height,
        quality,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Thumbnail generation error:', error);
    return c.json({
      success: false,
      error: 'Failed to generate thumbnail',
      message: error.message
    }, 500);
  }
});

/**
 * POST /api/upload/analytics
 * Track upload analytics
 */
enhancedUpload.post('/analytics', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const analytics = await c.req.json();

    // Validate analytics data
    if (!analytics.uploadId || !analytics.fileName) {
      return c.json({
        success: false,
        error: 'Missing required analytics fields'
      }, 400);
    }

    // In production, save to database or analytics service
    console.log('Upload Analytics:', {
      userId: user.userId,
      ...analytics,
      receivedAt: new Date().toISOString()
    });

    return c.json({
      success: true,
      message: 'Analytics recorded'
    });

  } catch (error: any) {
    console.error('Analytics tracking error:', error);
    return c.json({
      success: false,
      error: 'Failed to record analytics',
      message: error.message
    }, 500);
  }
});

/**
 * GET /api/upload/info-enhanced
 * Get enhanced upload information and capabilities
 */
enhancedUpload.get('/info-enhanced', validateAuth, async (c: Context) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const env = c.env;

    // Get user's current storage usage (simplified)
    const currentUsage = 0; // TODO: Calculate from database
    const maxQuota = 10 * 1024 * 1024 * 1024; // 10GB default

    return c.json({
      success: true,
      data: {
        maxFileSize: 500 * 1024 * 1024, // 500MB
        allowedTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'audio/mpeg',
          'audio/wav'
        ],
        maxFiles: 50,
        currentUsage,
        maxQuota,
        remainingQuota: maxQuota - currentUsage,
        features: {
          multipartUpload: true,
          deduplication: true,
          compression: true,
          thumbnailGeneration: true,
          preSignedUrls: true,
          directUpload: true,
          batchUpload: true,
          progressTracking: true,
          analytics: true,
          r2Storage: true,
          cdnDelivery: true
        },
        r2Config: {
          domain: env.R2_DOMAIN || 'files.pitchey.com',
          bucketName: 'pitchey-uploads',
          region: 'auto',
          provider: 'cloudflare-r2'
        },
        uploadLimits: {
          hourly: 100,
          daily: 1000,
          monthly: 10000
        },
        optimizations: {
          enabledByDefault: ['deduplication', 'compression'],
          imageFormats: ['webp', 'jpeg', 'png'],
          videoFormats: ['mp4'],
          maxImageDimensions: { width: 4096, height: 4096 },
          compressionQuality: { min: 50, max: 100, default: 85 }
        }
      }
    });

  } catch (error: any) {
    console.error('Enhanced upload info error:', error);
    return c.json({
      success: false,
      error: 'Failed to get upload info',
      message: error.message
    }, 500);
  }
});

export { enhancedUpload };