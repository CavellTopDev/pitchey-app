/**
 * File Handler for Cloudflare Workers Free Plan
 * 
 * Handles file uploads without R2 storage by using:
 * - Base64 encoding for small files stored in database
 * - Size limits appropriate for free plan
 * - Temporary in-memory processing
 */

interface FileMetadata {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  ownerId: number;
  pitchId?: number;
  type: 'thumbnail' | 'document' | 'nda' | 'attachment';
  storageType: 'database' | 'external';
}

interface StoredFile extends FileMetadata {
  data?: string; // Base64 encoded for database storage
  url?: string;  // External URL if using external storage
}

export class WorkerFileHandler {
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB limit for free plan
  private readonly ALLOWED_MIME_TYPES = {
    thumbnail: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    nda: ['application/pdf'],
    attachment: ['application/pdf', 'image/jpeg', 'image/png', 'video/mp4']
  };
  
  private db: any; // Database connection
  
  constructor(db: any) {
    this.db = db;
  }
  
  /**
   * Handle file upload from FormData
   */
  async handleUpload(
    formData: FormData,
    userId: number,
    type: FileMetadata['type'],
    pitchId?: number
  ): Promise<{ success: boolean; file?: StoredFile; error?: string }> {
    try {
      const file = formData.get('file') as File;
      
      if (!file) {
        return { success: false, error: 'No file provided' };
      }
      
      // Validate file
      const validation = await this.validateFile(file, type);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      
      // Process based on size
      if (file.size <= 500 * 1024) { // Under 500KB - store in database
        return await this.storeInDatabase(file, userId, type, pitchId);
      } else {
        // For larger files, we'll need to handle differently
        // For free plan, we can either reject or use temporary storage
        return await this.handleLargeFile(file, userId, type, pitchId);
      }
    } catch (error) {
      console.error('File upload failed:', error);
      return { success: false, error: 'File upload failed' };
    }
  }
  
  /**
   * Store small files directly in database as base64
   */
  private async storeInDatabase(
    file: File,
    userId: number,
    type: FileMetadata['type'],
    pitchId?: number
  ): Promise<{ success: boolean; file?: StoredFile; error?: string }> {
    try {
      // Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const base64 = btoa(String.fromCharCode(...bytes));
      
      const fileId = this.generateFileId();
      const metadata: StoredFile = {
        id: fileId,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        ownerId: userId,
        pitchId,
        type,
        storageType: 'database',
        data: base64
      };
      
      // Store in database
      const result = await this.db.queryOne(
        `INSERT INTO files (
          id, filename, mime_type, size, uploaded_at, 
          owner_id, pitch_id, file_type, storage_type, data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          fileId,
          metadata.filename,
          metadata.mimeType,
          metadata.size,
          metadata.uploadedAt,
          metadata.ownerId,
          metadata.pitchId || null,
          metadata.type,
          'database',
          base64
        ]
      );
      
      return {
        success: true,
        file: {
          ...metadata,
          url: `/api/files/${fileId}` // Serve via API endpoint
        }
      };
    } catch (error) {
      console.error('Database storage failed:', error);
      return { success: false, error: 'Failed to store file' };
    }
  }
  
  /**
   * Handle larger files for free plan
   */
  private async handleLargeFile(
    file: File,
    userId: number,
    type: FileMetadata['type'],
    pitchId?: number
  ): Promise<{ success: boolean; file?: StoredFile; error?: string }> {
    // Options for free plan:
    // 1. Reject files over 500KB
    // 2. Compress images before storing
    // 3. Use external free storage (would require API integration)
    
    if (type === 'thumbnail' && file.type.startsWith('image/')) {
      // Attempt to compress image
      return await this.compressAndStore(file, userId, type, pitchId);
    }
    
    // For documents and other files, we have to reject on free plan
    return {
      success: false,
      error: `File too large (${(file.size / 1024).toFixed(1)}KB). Maximum size for ${type} is 500KB on free plan.`
    };
  }
  
  /**
   * Compress images before storage
   */
  private async compressAndStore(
    file: File,
    userId: number,
    type: FileMetadata['type'],
    pitchId?: number
  ): Promise<{ success: boolean; file?: StoredFile; error?: string }> {
    try {
      // For free plan, we'll do basic compression by resizing
      // This is a simplified version - in production you'd use a proper image library
      
      // For now, if image is too large, suggest using smaller images
      return {
        success: false,
        error: 'Image too large. Please use images under 500KB or use an external image host.'
      };
    } catch (error) {
      console.error('Image compression failed:', error);
      return { success: false, error: 'Failed to compress image' };
    }
  }
  
  /**
   * Retrieve file from database
   */
  async getFile(fileId: string, userId?: number): Promise<{ success: boolean; file?: StoredFile; error?: string }> {
    try {
      let query = `SELECT * FROM files WHERE id = $1`;
      const params: any[] = [fileId];
      
      // If userId provided, verify ownership or access
      if (userId) {
        query += ` AND (owner_id = $2 OR pitch_id IN (
          SELECT id FROM pitches WHERE user_id = $2 OR id IN (
            SELECT pitch_id FROM nda_requests
            WHERE requester_id = $2 AND status = 'approved'
          )
        ))`;
        params.push(userId);
      }
      
      const file = await this.db.queryOne(query, params);
      
      if (!file) {
        return { success: false, error: 'File not found or access denied' };
      }
      
      return {
        success: true,
        file: {
          id: file.id,
          filename: file.filename,
          mimeType: file.mime_type,
          size: file.size,
          uploadedAt: file.uploaded_at,
          ownerId: file.owner_id,
          pitchId: file.pitch_id,
          type: file.file_type,
          storageType: file.storage_type,
          data: file.data,
          url: `/api/files/${file.id}`
        }
      };
    } catch (error) {
      console.error('File retrieval failed:', error);
      return { success: false, error: 'Failed to retrieve file' };
    }
  }
  
  /**
   * Delete file from storage
   */
  async deleteFile(fileId: string, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify ownership
      const result = await this.db.query(
        `DELETE FROM files WHERE id = $1 AND owner_id = $2 RETURNING id`,
        [fileId, userId]
      );
      
      if (result.length === 0) {
        return { success: false, error: 'File not found or unauthorized' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('File deletion failed:', error);
      return { success: false, error: 'Failed to delete file' };
    }
  }
  
  /**
   * List files for a user or pitch
   */
  async listFiles(
    userId: number,
    pitchId?: number,
    type?: FileMetadata['type']
  ): Promise<StoredFile[]> {
    try {
      let query = `SELECT * FROM files WHERE owner_id = $1`;
      const params: any[] = [userId];
      
      if (pitchId) {
        query += ` AND pitch_id = $2`;
        params.push(pitchId);
      }
      
      if (type) {
        query += ` AND file_type = $${params.length + 1}`;
        params.push(type);
      }
      
      query += ` ORDER BY uploaded_at DESC`;
      
      const files = await this.db.query(query, params);
      
      return files.map((file: any) => ({
        id: file.id,
        filename: file.filename,
        mimeType: file.mime_type,
        size: file.size,
        uploadedAt: file.uploaded_at,
        ownerId: file.owner_id,
        pitchId: file.pitch_id,
        type: file.file_type,
        storageType: file.storage_type,
        url: `/api/files/${file.id}`
      }));
    } catch (error) {
      console.error('Failed to list files:', error);
      return [];
    }
  }
  
  /**
   * Validate file before upload
   */
  private async validateFile(
    file: File,
    type: FileMetadata['type']
  ): Promise<{ valid: boolean; error?: string }> {
    // Check size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      };
    }
    
    // Check MIME type
    const allowedTypes = this.ALLOWED_MIME_TYPES[type];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types for ${type}: ${allowedTypes.join(', ')}`
      };
    }
    
    // Additional validation for specific types
    if (type === 'nda' && !file.name.toLowerCase().includes('nda')) {
      console.warn('NDA file name does not contain "nda":', file.name);
    }
    
    return { valid: true };
  }
  
  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Get storage statistics
   */
  async getStorageStats(userId: number): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  }> {
    try {
      const stats = await this.db.queryOne(`
        SELECT 
          COUNT(*) as total_files,
          COALESCE(SUM(size), 0) as total_size,
          COUNT(CASE WHEN file_type = 'thumbnail' THEN 1 END) as thumbnail_count,
          COALESCE(SUM(CASE WHEN file_type = 'thumbnail' THEN size END), 0) as thumbnail_size,
          COUNT(CASE WHEN file_type = 'document' THEN 1 END) as document_count,
          COALESCE(SUM(CASE WHEN file_type = 'document' THEN size END), 0) as document_size,
          COUNT(CASE WHEN file_type = 'nda' THEN 1 END) as nda_count,
          COALESCE(SUM(CASE WHEN file_type = 'nda' THEN size END), 0) as nda_size,
          COUNT(CASE WHEN file_type = 'attachment' THEN 1 END) as attachment_count,
          COALESCE(SUM(CASE WHEN file_type = 'attachment' THEN size END), 0) as attachment_size
        FROM files
        WHERE owner_id = $1
      `, [userId]);
      
      return {
        totalFiles: parseInt(stats.total_files),
        totalSize: parseInt(stats.total_size),
        byType: {
          thumbnail: {
            count: parseInt(stats.thumbnail_count),
            size: parseInt(stats.thumbnail_size)
          },
          document: {
            count: parseInt(stats.document_count),
            size: parseInt(stats.document_size)
          },
          nda: {
            count: parseInt(stats.nda_count),
            size: parseInt(stats.nda_size)
          },
          attachment: {
            count: parseInt(stats.attachment_count),
            size: parseInt(stats.attachment_size)
          }
        }
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        byType: {
          thumbnail: { count: 0, size: 0 },
          document: { count: 0, size: 0 },
          nda: { count: 0, size: 0 },
          attachment: { count: 0, size: 0 }
        }
      };
    }
  }
}

/**
 * Helper to create file response
 */
export function createFileResponse(file: StoredFile): Response {
  if (file.storageType === 'database' && file.data) {
    // Decode base64 and return as binary
    const binaryString = atob(file.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Response(bytes, {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${file.filename}"`,
        'Content-Length': file.size.toString(),
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
  
  // External URL redirect
  if (file.url && file.storageType === 'external') {
    return Response.redirect(file.url, 302);
  }
  
  return new Response('File not found', { status: 404 });
}