import { db } from "../db/client.ts";

export interface CreatePitchDocumentData {
  pitchId: number;
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileKey?: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  isPublic?: boolean;
  requiresNda?: boolean;
  uploadedBy: number;
  metadata?: any;
}

export class PitchDocumentService {
  /**
   * Create a new document record
   */
  static async createDocument(data: CreatePitchDocumentData): Promise<any> {
    try {
      const documentResult = await db.query(`
        INSERT INTO pitch_documents (
          pitch_id, file_name, original_file_name, file_url, file_key,
          file_type, mime_type, file_size, document_type, is_public,
          requires_nda, uploaded_by, uploaded_at, last_modified, download_count, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *
      `, [
        data.pitchId,
        data.fileName,
        data.originalFileName,
        data.fileUrl,
        data.fileKey || null,
        data.fileType,
        data.mimeType,
        data.fileSize,
        data.documentType,
        data.isPublic || false,
        data.requiresNda || false,
        data.uploadedBy,
        new Date(),
        new Date(),
        0,
        JSON.stringify(data.metadata || {})
      ]);

      const document = documentResult[0];
      console.log(`Created document record: ${document.id} for pitch ${data.pitchId}`);
      return document;
    } catch (error: any) {
      console.error('Failed to create document record:', error);
      throw new Error(`Document creation failed: ${error.message}`);
    }
  }

  /**
   * Get a document by ID
   */
  static async getDocument(documentId: number): Promise<any | null> {
    try {
      const documentResult = await db.query(`
        SELECT * FROM pitch_documents WHERE id = $1 LIMIT 1
      `, [documentId]);

      return documentResult[0] || null;
    } catch (error: any) {
      console.error('Failed to get document:', error);
      throw new Error(`Failed to retrieve document: ${error.message}`);
    }
  }

  /**
   * Get documents for a pitch
   */
  static async getPitchDocuments(
    pitchId: number,
    options: {
      userId?: number;
      documentType?: string;
      includePrivate?: boolean;
    } = {}
  ): Promise<any[]> {
    try {
      let querySQL = `
        SELECT 
          pd.id, pd.file_name, pd.original_file_name, pd.file_url,
          pd.file_type, pd.mime_type, pd.file_size, pd.document_type,
          pd.is_public, pd.requires_nda, pd.uploaded_at, pd.download_count,
          pd.uploaded_by, u.username as uploader_name, u.email as uploader_email
        FROM pitch_documents pd
        LEFT JOIN users u ON pd.uploaded_by = u.id
        WHERE pd.pitch_id = $1
      `;
      const queryParams = [pitchId];

      // Filter by document type if specified
      if (options.documentType) {
        querySQL += ` AND pd.document_type = $2`;
        queryParams.push(options.documentType);
      }

      querySQL += ` ORDER BY pd.uploaded_at DESC`;
      const documents = await db.query(querySQL, queryParams);

      // Filter out private documents if user doesn't have access
      if (!options.includePrivate && options.userId) {
        const filteredDocuments = [];
        
        for (const doc of documents) {
          if (doc.is_public || doc.uploaded_by === options.userId) {
            filteredDocuments.push(doc);
          } else if (doc.requires_nda) {
            // Check if user has signed NDA
            const hasNdaAccess = await this.checkNdaAccess(pitchId, options.userId);
            if (hasNdaAccess) {
              filteredDocuments.push(doc);
            }
          }
        }
        
        return filteredDocuments;
      }

      return documents;
    } catch (error: any) {
      console.error('Failed to get pitch documents:', error);
      throw new Error(`Failed to retrieve pitch documents: ${error.message}`);
    }
  }

  /**
   * Delete a document
   */
  static async deleteDocument(documentId: number): Promise<void> {
    try {
      await db.query(`
        DELETE FROM pitch_documents WHERE id = $1
      `, [documentId]);

      console.log(`Deleted document: ${documentId}`);
    } catch (error: any) {
      console.error('Failed to delete document:', error);
      throw new Error(`Document deletion failed: ${error.message}`);
    }
  }

  /**
   * Check if user has access to a document
   */
  static async checkDocumentAccess(documentId: number, userId: number): Promise<boolean> {
    try {
      const document = await this.getDocument(documentId);
      if (!document) return false;

      // Document owner always has access
      if (document.uploaded_by === userId) return true;

      // Public documents are accessible to all
      if (document.is_public) return true;

      // Check NDA requirements
      if (document.requires_nda) {
        return await this.checkNdaAccess(document.pitch_id, userId);
      }

      // Check if user is the pitch owner
      const pitchResult = await db.query(`
        SELECT user_id FROM pitches WHERE id = $1 LIMIT 1
      `, [document.pitch_id]);

      return pitchResult[0]?.user_id === userId;
    } catch (error: any) {
      console.error('Failed to check document access:', error);
      return false;
    }
  }

  /**
   * Check if user has signed NDA for a pitch
   */
  private static async checkNdaAccess(pitchId: number, userId: number): Promise<boolean> {
    try {
      const ndaResult = await db.query(`
        SELECT * FROM ndas 
        WHERE pitch_id = $1 AND signer_id = $2 AND status = 'signed' AND access_granted = true
        LIMIT 1
      `, [pitchId, userId]);

      return !!ndaResult[0];
    } catch (error) {
      console.error('Failed to check NDA access:', error);
      return false;
    }
  }

  /**
   * Track document download
   */
  static async trackDownload(documentId: number, userId: number): Promise<void> {
    try {
      // Increment download count
      await db
        .update(pitchDocuments)
        .set({
          downloadCount: db.raw('download_count + 1')
        })
        .where(eq(pitchDocuments.id, documentId));

      console.log(`Tracked download: document ${documentId} by user ${userId}`);
    } catch (error: any) {
      console.error('Failed to track download:', error);
      // Don't throw error for tracking failures
    }
  }

  /**
   * Get document statistics for a pitch
   */
  static async getPitchDocumentStats(pitchId: number): Promise<{
    totalDocuments: number;
    totalSize: number;
    documentTypes: Record<string, number>;
    totalDownloads: number;
  }> {
    try {
      const documents = await db
        .select({
          documentType: pitchDocuments.documentType,
          fileSize: pitchDocuments.fileSize,
          downloadCount: pitchDocuments.downloadCount
        })
        .from(pitchDocuments)
        .where(eq(pitchDocuments.pitchId, pitchId));

      const stats = {
        totalDocuments: documents.length,
        totalSize: documents.reduce((sum, doc) => sum + doc.fileSize, 0),
        documentTypes: {} as Record<string, number>,
        totalDownloads: documents.reduce((sum, doc) => sum + doc.downloadCount, 0)
      };

      // Count by document type
      for (const doc of documents) {
        stats.documentTypes[doc.documentType] = (stats.documentTypes[doc.documentType] || 0) + 1;
      }

      return stats;
    } catch (error: any) {
      console.error('Failed to get document stats:', error);
      throw new Error(`Failed to retrieve document statistics: ${error.message}`);
    }
  }

  /**
   * Get user's total storage usage
   */
  static async getUserStorageUsage(userId: number): Promise<{
    totalSize: number;
    documentCount: number;
    recentUploads: any[];
  }> {
    try {
      const documents = await db
        .select({
          fileSize: pitchDocuments.fileSize,
          fileName: pitchDocuments.fileName,
          uploadedAt: pitchDocuments.uploadedAt,
          documentType: pitchDocuments.documentType
        })
        .from(pitchDocuments)
        .where(eq(pitchDocuments.uploadedBy, userId))
        .orderBy(desc(pitchDocuments.uploadedAt));

      const totalSize = documents.reduce((sum, doc) => sum + doc.fileSize, 0);
      const recentUploads = documents.slice(0, 10); // Last 10 uploads

      return {
        totalSize,
        documentCount: documents.length,
        recentUploads
      };
    } catch (error: any) {
      console.error('Failed to get user storage usage:', error);
      throw new Error(`Failed to retrieve storage usage: ${error.message}`);
    }
  }

  /**
   * Update document metadata
   */
  static async updateDocument(
    documentId: number, 
    updates: {
      fileName?: string;
      documentType?: string;
      isPublic?: boolean;
      requiresNda?: boolean;
      metadata?: any;
    }
  ): Promise<any> {
    try {
      const [updated] = await db
        .update(pitchDocuments)
        .set({
          ...updates,
          lastModified: new Date()
        })
        .where(eq(pitchDocuments.id, documentId))
        .returning();

      console.log(`Updated document: ${documentId}`);
      return updated;
    } catch (error: any) {
      console.error('Failed to update document:', error);
      throw new Error(`Document update failed: ${error.message}`);
    }
  }

  /**
   * Search documents
   */
  static async searchDocuments(
    query: string,
    filters: {
      userId?: number;
      documentType?: string;
      pitchId?: number;
      fileType?: string;
    } = {}
  ): Promise<any[]> {
    try {
      let dbQuery = db
        .select({
          id: pitchDocuments.id,
          fileName: pitchDocuments.fileName,
          originalFileName: pitchDocuments.originalFileName,
          fileType: pitchDocuments.fileType,
          fileSize: pitchDocuments.fileSize,
          documentType: pitchDocuments.documentType,
          uploadedAt: pitchDocuments.uploadedAt,
          pitchId: pitchDocuments.pitchId,
          pitchTitle: pitches.title,
          uploaderName: users.username
        })
        .from(pitchDocuments)
        .leftJoin(pitches, eq(pitchDocuments.pitchId, pitches.id))
        .leftJoin(users, eq(pitchDocuments.uploadedBy, users.id));

      // Apply filters
      const conditions = [];
      
      if (filters.userId) {
        conditions.push(eq(pitchDocuments.uploadedBy, filters.userId));
      }
      
      if (filters.documentType) {
        conditions.push(eq(pitchDocuments.documentType, filters.documentType));
      }
      
      if (filters.pitchId) {
        conditions.push(eq(pitchDocuments.pitchId, filters.pitchId));
      }
      
      if (filters.fileType) {
        conditions.push(eq(pitchDocuments.fileType, filters.fileType));
      }

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions));
      }

      const documents = await dbQuery.orderBy(desc(pitchDocuments.uploadedAt));

      // Filter by search query if provided
      if (query) {
        const lowerQuery = query.toLowerCase();
        return documents.filter(doc => 
          doc.fileName.toLowerCase().includes(lowerQuery) ||
          doc.originalFileName.toLowerCase().includes(lowerQuery) ||
          doc.pitchTitle?.toLowerCase().includes(lowerQuery)
        );
      }

      return documents;
    } catch (error: any) {
      console.error('Failed to search documents:', error);
      throw new Error(`Document search failed: ${error.message}`);
    }
  }
}