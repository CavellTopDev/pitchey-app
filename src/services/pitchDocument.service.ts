import { db } from "../db/index.ts";
import { pitchDocuments, pitches, ndas, users } from "../db/schema.ts";
import { eq, and, desc, count } from "npm:drizzle-orm@0.35.3";
import type { PitchDocument } from "../db/schema.ts";

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
      const [document] = await db.insert(pitchDocuments).values({
        pitchId: data.pitchId,
        fileName: data.fileName,
        originalFileName: data.originalFileName,
        fileUrl: data.fileUrl,
        fileKey: data.fileKey || null,
        fileType: data.fileType,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        documentType: data.documentType,
        isPublic: data.isPublic || false,
        requiresNda: data.requiresNda || false,
        uploadedBy: data.uploadedBy,
        uploadedAt: new Date(),
        lastModified: new Date(),
        downloadCount: 0,
        metadata: data.metadata || {}
      }).returning();

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
      const [document] = await db
        .select()
        .from(pitchDocuments)
        .where(eq(pitchDocuments.id, documentId))
        .limit(1);

      return document || null;
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
      let query = db
        .select({
          id: pitchDocuments.id,
          fileName: pitchDocuments.fileName,
          originalFileName: pitchDocuments.originalFileName,
          fileUrl: pitchDocuments.fileUrl,
          fileType: pitchDocuments.fileType,
          mimeType: pitchDocuments.mimeType,
          fileSize: pitchDocuments.fileSize,
          documentType: pitchDocuments.documentType,
          isPublic: pitchDocuments.isPublic,
          requiresNda: pitchDocuments.requiresNda,
          uploadedAt: pitchDocuments.uploadedAt,
          downloadCount: pitchDocuments.downloadCount,
          uploadedBy: pitchDocuments.uploadedBy,
          uploaderName: users.username,
          uploaderEmail: users.email
        })
        .from(pitchDocuments)
        .leftJoin(users, eq(pitchDocuments.uploadedBy, users.id))
        .where(eq(pitchDocuments.pitchId, pitchId));

      // Filter by document type if specified
      if (options.documentType) {
        query = query.where(
          and(
            eq(pitchDocuments.pitchId, pitchId),
            eq(pitchDocuments.documentType, options.documentType)
          )
        );
      }

      const documents = await query.orderBy(desc(pitchDocuments.uploadedAt));

      // Filter out private documents if user doesn't have access
      if (!options.includePrivate && options.userId) {
        const filteredDocuments = [];
        
        for (const doc of documents) {
          if (doc.isPublic || doc.uploadedBy === options.userId) {
            filteredDocuments.push(doc);
          } else if (doc.requiresNda) {
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
      await db
        .delete(pitchDocuments)
        .where(eq(pitchDocuments.id, documentId));

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
      if (document.uploadedBy === userId) return true;

      // Public documents are accessible to all
      if (document.isPublic) return true;

      // Check NDA requirements
      if (document.requiresNda) {
        return await this.checkNdaAccess(document.pitchId, userId);
      }

      // Check if user is the pitch owner
      const [pitch] = await db
        .select({ userId: pitches.userId })
        .from(pitches)
        .where(eq(pitches.id, document.pitchId))
        .limit(1);

      return pitch?.userId === userId;
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
      const [nda] = await db
        .select()
        .from(ndas)
        .where(
          and(
            eq(ndas.pitchId, pitchId),
            eq(ndas.signerId, userId),
            eq(ndas.status, 'signed'),
            eq(ndas.accessGranted, true)
          )
        )
        .limit(1);

      return !!nda;
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