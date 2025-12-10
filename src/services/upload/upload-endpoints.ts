/**
 * File Upload API Endpoints
 * Handles file upload operations including multipart uploads
 */

import { FileUploadService } from './file-upload.service';
import { pitches, pitchDocuments, ndaRequests } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export class UploadEndpoints {
  private uploadService: FileUploadService;

  constructor(r2Bucket: any) {
    this.uploadService = new FileUploadService(r2Bucket);
  }

  /**
   * Handle upload-related requests
   */
  async handleUploadRequest(
    request: Request,
    pathname: string,
    auth: any,
    sqlConnection: any
  ): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;

    // Single file upload
    if (pathname === '/api/upload' && method === 'POST') {
      return this.handleSingleUpload(request, auth);
    }

    // Multiple file upload
    if (pathname === '/api/upload/multiple' && method === 'POST') {
      return this.handleMultipleUpload(request, auth);
    }

    // Initialize multipart upload
    if (pathname === '/api/upload/multipart/init' && method === 'POST') {
      return this.initMultipartUpload(request, auth);
    }

    // Upload multipart chunk
    if (pathname === '/api/upload/multipart/part' && method === 'PUT') {
      return this.uploadMultipartPart(request, auth);
    }

    // Complete multipart upload
    if (pathname === '/api/upload/multipart/complete' && method === 'POST') {
      return this.completeMultipartUpload(request, auth, sqlConnection);
    }

    // Abort multipart upload
    if (pathname === '/api/upload/multipart/abort' && method === 'DELETE') {
      return this.abortMultipartUpload(request, auth);
    }

    // Upload NDA document
    if (pathname === '/api/upload/nda' && method === 'POST') {
      return this.uploadNDADocument(request, auth, sqlConnection);
    }

    // Upload pitch documents
    if (pathname.startsWith('/api/pitches/') && pathname.endsWith('/documents') && method === 'POST') {
      const pitchId = pathname.split('/')[3];
      return this.uploadPitchDocuments(request, auth, parseInt(pitchId), sqlConnection);
    }

    // Delete uploaded file
    if (pathname.startsWith('/api/upload/') && method === 'DELETE') {
      const fileKey = pathname.replace('/api/upload/', '');
      return this.deleteUploadedFile(fileKey, auth, sqlConnection);
    }

    return null;
  }

  /**
   * Handle single file upload
   */
  private async handleSingleUpload(request: Request, auth: any): Promise<Response> {
    try {
      if (!auth) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const formData = await request.formData();
      const file = formData.get('file') as File;
      const context = formData.get('context') as string || 'document';
      const requireNDA = formData.get('requireNDA') === 'true';

      if (!file) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'No file provided', code: 'NO_FILE' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get allowed types based on context
      const allowedTypes = this.uploadService.getAllowedFileTypes(context as any);
      
      // Validate file
      const validation = this.uploadService.validateFile(file, { 
        allowedMimeTypes: allowedTypes,
        requireNDA 
      });

      if (!validation.valid) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: validation.error, code: 'INVALID_FILE' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Upload the file
      const result = await this.uploadService.uploadFile(file, file.name, {
        allowedMimeTypes: allowedTypes,
        requireNDA,
        generateThumbnails: context === 'image'
      });

      return new Response(JSON.stringify({
        success: true,
        data: result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Single upload error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Upload failed', code: 'UPLOAD_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle multiple file upload
   */
  private async handleMultipleUpload(request: Request, auth: any): Promise<Response> {
    try {
      if (!auth) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const formData = await request.formData();
      const files: File[] = [];
      const context = formData.get('context') as string || 'document';
      const requireNDA = formData.get('requireNDA') === 'true';

      // Collect all files from form data
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('file') && value instanceof File) {
          files.push(value);
        }
      }

      if (files.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'No files provided', code: 'NO_FILES' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get allowed types based on context
      const allowedTypes = this.uploadService.getAllowedFileTypes(context as any);

      // Validate all files
      for (const file of files) {
        const validation = this.uploadService.validateFile(file, { 
          allowedMimeTypes: allowedTypes 
        });
        if (!validation.valid) {
          return new Response(JSON.stringify({
            success: false,
            error: { 
              message: `File ${file.name}: ${validation.error}`, 
              code: 'INVALID_FILE' 
            }
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Upload all files
      const results = await this.uploadService.uploadMultipleFiles(files, {
        allowedMimeTypes: allowedTypes,
        requireNDA,
        generateThumbnails: context === 'image'
      });

      return new Response(JSON.stringify({
        success: true,
        data: {
          uploaded: results,
          count: results.length
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Multiple upload error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Upload failed', code: 'UPLOAD_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Initialize multipart upload
   */
  private async initMultipartUpload(request: Request, auth: any): Promise<Response> {
    try {
      if (!auth) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json();
      const { filename, context = 'document', requireNDA = false } = body;

      if (!filename) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Filename required', code: 'NO_FILENAME' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const allowedTypes = this.uploadService.getAllowedFileTypes(context);
      const result = await this.uploadService.initializeMultipartUpload(filename, {
        allowedMimeTypes: allowedTypes,
        requireNDA
      });

      return new Response(JSON.stringify({
        success: true,
        data: result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Init multipart error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to initialize upload', code: 'INIT_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Upload a part of multipart upload
   */
  private async uploadMultipartPart(request: Request, auth: any): Promise<Response> {
    try {
      if (!auth) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const url = new URL(request.url);
      const key = url.searchParams.get('key');
      const uploadId = url.searchParams.get('uploadId');
      const partNumber = parseInt(url.searchParams.get('partNumber') || '0');

      if (!key || !uploadId || !partNumber) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Missing required parameters', code: 'MISSING_PARAMS' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const data = await request.arrayBuffer();
      const result = await this.uploadService.uploadPart(key, uploadId, partNumber, data);

      return new Response(JSON.stringify({
        success: true,
        data: result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Upload part error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to upload part', code: 'UPLOAD_PART_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Complete multipart upload
   */
  private async completeMultipartUpload(request: Request, auth: any, sqlConnection: any): Promise<Response> {
    try {
      if (!auth) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json();
      const { key, uploadId, parts } = body;

      if (!key || !uploadId || !parts || !Array.isArray(parts)) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Missing required parameters', code: 'MISSING_PARAMS' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await this.uploadService.completeMultipartUpload(key, uploadId, parts);

      return new Response(JSON.stringify({
        success: true,
        data: result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Complete multipart error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to complete upload', code: 'COMPLETE_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Abort multipart upload
   */
  private async abortMultipartUpload(request: Request, auth: any): Promise<Response> {
    try {
      if (!auth) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const url = new URL(request.url);
      const key = url.searchParams.get('key');
      const uploadId = url.searchParams.get('uploadId');

      if (!key || !uploadId) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Missing required parameters', code: 'MISSING_PARAMS' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await this.uploadService.abortMultipartUpload(key, uploadId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Upload aborted successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Abort multipart error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to abort upload', code: 'ABORT_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Upload custom NDA document
   */
  private async uploadNDADocument(request: Request, auth: any, sqlConnection: any): Promise<Response> {
    try {
      if (!auth) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const formData = await request.formData();
      const file = formData.get('file') as File;
      const pitchId = parseInt(formData.get('pitchId') as string);

      if (!file || !pitchId) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'File and pitch ID required', code: 'MISSING_PARAMS' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user owns the pitch
      const pitch = await sqlConnection
        .select()
        .from(pitches)
        .where(and(
          eq(pitches.id, pitchId),
          eq(pitches.userId, parseInt(auth.userId))
        ))
        .limit(1);

      if (pitch.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Pitch not found or unauthorized', code: 'UNAUTHORIZED' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Upload the NDA document
      const result = await this.uploadService.uploadNDADocument(
        file,
        pitchId,
        parseInt(auth.userId)
      );

      // Update pitch record to indicate custom NDA is available
      await sqlConnection
        .update(pitches)
        .set({ 
          customNdaUrl: result.url,
          requireNda: true,
          updatedAt: new Date()
        })
        .where(eq(pitches.id, pitchId));

      return new Response(JSON.stringify({
        success: true,
        data: result,
        message: 'Custom NDA uploaded successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('NDA upload error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: error.message || 'Failed to upload NDA', code: 'NDA_UPLOAD_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Upload documents for a pitch
   */
  private async uploadPitchDocuments(
    request: Request,
    auth: any,
    pitchId: number,
    sqlConnection: any
  ): Promise<Response> {
    try {
      if (!auth) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user owns the pitch
      const pitch = await sqlConnection
        .select()
        .from(pitches)
        .where(and(
          eq(pitches.id, pitchId),
          eq(pitches.userId, parseInt(auth.userId))
        ))
        .limit(1);

      if (pitch.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Pitch not found or unauthorized', code: 'UNAUTHORIZED' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const formData = await request.formData();
      const files: File[] = [];
      const requireNDA = formData.get('requireNDA') === 'true';
      const documentType = formData.get('documentType') as string || 'supporting';

      // Collect all files
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('file') && value instanceof File) {
          files.push(value);
        }
      }

      if (files.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'No files provided', code: 'NO_FILES' }
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Upload all files
      const uploadedFiles = await this.uploadService.uploadMultipleFiles(files, {
        allowedMimeTypes: this.uploadService.getAllowedFileTypes('document'),
        requireNDA
      });

      // Store document references in database
      for (const file of uploadedFiles) {
        await sqlConnection.insert(pitchDocuments).values({
          pitchId,
          filename: file.filename,
          url: file.url,
          fileType: file.mimeType,
          fileSize: file.size,
          documentType,
          requireNda: requireNDA,
          uploadedBy: parseInt(auth.userId),
          uploadedAt: new Date()
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          uploaded: uploadedFiles,
          count: uploadedFiles.length
        },
        message: `${uploadedFiles.length} document(s) uploaded successfully`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Pitch documents upload error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to upload documents', code: 'DOCUMENTS_UPLOAD_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Delete an uploaded file
   */
  private async deleteUploadedFile(fileKey: string, auth: any, sqlConnection: any): Promise<Response> {
    try {
      if (!auth) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Authentication required', code: 'UNAUTHORIZED' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user owns the file (you'd need to track this in your database)
      // For now, we'll just delete if authenticated
      await this.uploadService.deleteFile(fileKey);

      // Also remove from database if tracked
      await sqlConnection
        .delete(pitchDocuments)
        .where(eq(pitchDocuments.url, fileKey));

      return new Response(JSON.stringify({
        success: true,
        message: 'File deleted successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Delete file error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to delete file', code: 'DELETE_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}