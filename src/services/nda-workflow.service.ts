/**
 * Enhanced NDA Workflow Service
 * Manages complete NDA lifecycle with watermarking, audit trail, and access control
 */

import { createDatabase } from '../db/raw-sql-connection';
import { z } from 'zod';
import { createHash } from 'crypto';

// NDA workflow states
export enum NDAState {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected', 
  SIGNED = 'signed',
  ACTIVE = 'active', // Signed and access granted
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

// NDA access levels
export enum NDAAccessLevel {
  NONE = 'none',
  BASIC = 'basic', // View basic info
  STANDARD = 'standard', // View full pitch deck
  FULL = 'full', // View everything including financial data
  CUSTOM = 'custom' // Custom permissions
}

// NDA document types
export enum NDADocumentType {
  STANDARD = 'standard',
  MUTUAL = 'mutual',
  CUSTOM = 'custom',
  CONFIDENTIALITY = 'confidentiality'
}

// Watermark configuration
export interface WatermarkConfig {
  enabled: boolean;
  text?: string;
  opacity?: number;
  position?: 'diagonal' | 'header' | 'footer' | 'center';
  includeTimestamp?: boolean;
  includeUserId?: boolean;
  includeIpAddress?: boolean;
}

// NDA request interface
export interface NDARequest {
  id: number;
  pitch_id: number;
  investor_id: number;
  requester_id?: number; // For compatibility
  owner_id?: number;
  status: string;
  nda_type?: string;
  requested_access?: string;
  access_level?: string;
  requested_at: string;
  reviewed_at?: string;
  responded_at?: string;
  expires_at?: string;
  reviewer_notes?: string;
  rejection_reason?: string;
  request_message?: string;
  watermark_enabled?: boolean;
  download_enabled?: boolean;
  custom_terms?: string;
}

// NDA document interface
export interface NDADocument {
  id: number;
  signer_id: number;
  pitch_id: number;
  status: string;
  nda_type: string;
  access_level: string;
  access_granted: boolean;
  watermark_enabled: boolean;
  watermark_config?: any;
  download_enabled: boolean;
  signature_data?: any;
  signature_hash?: string;
  signed_at?: string;
  expires_at?: string;
  revoked_at?: string;
  revoked_by?: number;
  revocation_reason?: string;
}

// Validation schemas
export const NDARequestSchema = z.object({
  pitchId: z.number(),
  ndaType: z.enum(['standard', 'mutual', 'custom', 'confidentiality']).default('standard'),
  requestMessage: z.string().optional(),
  requestedAccess: z.enum(['basic', 'standard', 'full']).default('standard'),
  expirationDays: z.number().min(7).max(365).default(90)
});

export const NDAApprovalSchema = z.object({
  requestId: z.number(),
  accessLevel: z.enum(['basic', 'standard', 'full', 'custom']).optional(),
  expirationDate: z.string().optional(),
  customTerms: z.string().optional(),
  watermarkEnabled: z.boolean().default(true),
  downloadEnabled: z.boolean().default(false)
});

export const NDARejectionSchema = z.object({
  requestId: z.number(),
  reason: z.string().min(10),
  suggestAlternative: z.boolean().default(false)
});

export const NDASignatureSchema = z.object({
  ndaId: z.number(),
  signature: z.string(),
  fullName: z.string(),
  title: z.string().optional(),
  company: z.string().optional(),
  ipAddress: z.string(),
  acceptTerms: z.boolean()
});

export class NDAWorkflowService {
  private db: ReturnType<typeof createDatabase>;
  
  constructor(env: any) {
    this.db = createDatabase({
      DATABASE_URL: env.DATABASE_URL,
      READ_REPLICA_URLS: env.READ_REPLICA_URLS,
      UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN
    });
  }
  
  /**
   * Create a new NDA request with enhanced validation and tracking
   */
  async requestNDA(
    investorId: number,
    data: z.infer<typeof NDARequestSchema>
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Validate the request
      const validated = NDARequestSchema.parse(data);
      
      // Check if user already has an active NDA for this pitch
      const existingActive = await this.db.queryOne(
        `SELECT * FROM ndas 
         WHERE signer_id = $1 AND pitch_id = $2 
         AND status IN ('signed', 'active', 'approved')
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [investorId, validated.pitchId]
      );

      if (existingActive) {
        return { success: false, error: 'You already have an active NDA for this pitch' };
      }

      // Check for pending requests
      const pendingRequest = await this.db.queryOne(
        `SELECT * FROM nda_requests
         WHERE requester_id = $1 AND pitch_id = $2
         AND status = 'pending'`,
        [investorId, validated.pitchId]
      );

      if (pendingRequest) {
        return { success: false, error: 'You already have a pending NDA request for this pitch' };
      }

      // Get pitch owner
      const pitch = await this.db.queryOne(
        `SELECT creator_id, title FROM pitches WHERE id = $1`,
        [validated.pitchId]
      );

      if (!pitch) {
        return { success: false, error: 'Pitch not found' };
      }

      // Create the NDA request
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validated.expirationDays);

      const result = await this.db.queryOne(
        `INSERT INTO nda_requests (
          requester_id, pitch_id, owner_id, status,
          nda_type, requested_access, expires_at,
          request_message, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        ) RETURNING *`,
        [
          investorId,
          validated.pitchId,
          pitch.creator_id,
          'pending',
          validated.ndaType,
          validated.requestedAccess,
          expiresAt,
          validated.requestMessage || null
        ]
      );
      
      // Log audit entry
      await this.logAuditEntry({
        ndaRequestId: result.id,
        userId: investorId,
        action: 'REQUEST_CREATED',
        metadata: {
          pitchId: validated.pitchId,
          ndaType: validated.ndaType,
          requestedAccess: validated.requestedAccess
        }
      });
      
      // Send notification to creator
      await this.notifyCreator(pitch.creator_id, investorId, pitch.title, result.id);
      
      return { success: true, data: result };
    } catch (error) {
      console.error('NDA request failed:', error);
      return { success: false, error: error.message || 'Failed to create NDA request' };
    }
  }
  
  /**
   * Approve NDA request with enhanced features
   */
  async approveNDA(
    creatorId: number,
    data: z.infer<typeof NDAApprovalSchema>
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const validated = NDAApprovalSchema.parse(data);

      // Verify ownership and get request details
      const ndaRequest = await this.db.queryOne(
        `SELECT nr.*, p.title as pitch_title, p.creator_id
         FROM nda_requests nr
         JOIN pitches p ON p.id = nr.pitch_id
         WHERE nr.id = $1 AND nr.owner_id = $2 AND nr.status = 'pending'`,
        [validated.requestId, creatorId]
      );

      if (!ndaRequest) {
        return { success: false, error: 'NDA request not found or not authorized' };
      }

      // Update the request
      const updatedRequest = await this.db.queryOne(
        `UPDATE nda_requests SET
          status = 'approved',
          responded_at = NOW(),
          approved_by = $2,
          access_level = $3,
          custom_terms = $4,
          watermark_enabled = $5,
          download_enabled = $6,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
        [
          validated.requestId,
          creatorId,
          validated.accessLevel || ndaRequest.requested_access,
          validated.customTerms,
          validated.watermarkEnabled,
          validated.downloadEnabled
        ]
      );

      // Create the NDA document record
      const ndaDoc = await this.db.queryOne(
        `INSERT INTO ndas (
          signer_id, pitch_id, status, nda_type,
          access_level, access_granted, watermark_enabled,
          download_enabled, expires_at, created_at, updated_at
        ) VALUES (
          $1, $2, 'approved', $3, $4, false, $5, $6, $7, NOW(), NOW()
        ) ON CONFLICT (signer_id, pitch_id) 
        DO UPDATE SET
          status = 'approved',
          access_level = $4,
          watermark_enabled = $5,
          download_enabled = $6,
          expires_at = $7,
          updated_at = NOW()
        RETURNING *`,
        [
          ndaRequest.requester_id,
          ndaRequest.pitch_id,
          ndaRequest.nda_type || 'standard',
          validated.accessLevel || ndaRequest.requested_access || 'standard',
          validated.watermarkEnabled,
          validated.downloadEnabled,
          validated.expirationDate || ndaRequest.expires_at
        ]
      );

      // Generate watermark configuration if enabled
      if (validated.watermarkEnabled) {
        await this.generateWatermarkConfig(ndaDoc.id, ndaRequest.requester_id);
      }

      // Log audit entry
      await this.logAuditEntry({
        ndaId: ndaDoc.id,
        userId: creatorId,
        action: 'NDA_APPROVED',
        metadata: {
          requestId: validated.requestId,
          accessLevel: validated.accessLevel || ndaRequest.requested_access,
          watermarkEnabled: validated.watermarkEnabled
        }
      });

      // Notify investor
      await this.notifyInvestor(
        ndaRequest.requester_id,
        ndaRequest.pitch_id,
        'approved',
        null,
        { pitchTitle: ndaRequest.pitch_title, ndaId: ndaDoc.id }
      );
      
      return { success: true, data: { request: updatedRequest, nda: ndaDoc } };
    } catch (error) {
      console.error('NDA approval failed:', error);
      return { success: false, error: error.message || 'Failed to approve NDA' };
    }
  }
  
  /**
   * Reject NDA request with reason
   */
  async rejectNDA(
    creatorId: number,
    data: z.infer<typeof NDARejectionSchema>
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const validated = NDARejectionSchema.parse(data);

      // Verify ownership
      const ndaRequest = await this.db.queryOne(
        `SELECT nr.*, p.title as pitch_title
         FROM nda_requests nr
         JOIN pitches p ON p.id = nr.pitch_id
         WHERE nr.id = $1 AND nr.owner_id = $2 AND nr.status = 'pending'`,
        [validated.requestId, creatorId]
      );

      if (!ndaRequest) {
        return { success: false, error: 'NDA request not found or not authorized' };
      }

      // Update the request
      const result = await this.db.queryOne(
        `UPDATE nda_requests SET
          status = 'rejected',
          responded_at = NOW(),
          rejection_reason = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
        [validated.requestId, validated.reason]
      );

      // Log audit entry
      await this.logAuditEntry({
        ndaRequestId: validated.requestId,
        userId: creatorId,
        action: 'NDA_REJECTED',
        metadata: {
          reason: validated.reason,
          suggestAlternative: validated.suggestAlternative
        }
      });

      // Notify investor
      await this.notifyInvestor(
        ndaRequest.requester_id,
        ndaRequest.pitch_id,
        'rejected',
        validated.reason,
        {
          pitchTitle: ndaRequest.pitch_title,
          suggestAlternative: validated.suggestAlternative
        }
      );
      
      return { success: true, data: result };
    } catch (error) {
      console.error('NDA rejection failed:', error);
      return { success: false, error: error.message || 'Failed to reject NDA' };
    }
  }
  
  /**
   * Check if user has NDA access to a pitch
   */
  async hasNDAAccess(pitchId: number, userId: number): Promise<boolean> {
    try {
      const result = await this.db.queryOne(
        `SELECT 1 FROM nda_requests
         WHERE pitch_id = $1 
         AND investor_id = $2
         AND status = 'approved'
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [pitchId, userId]
      );
      
      return !!result;
    } catch (error) {
      console.error('NDA access check failed:', error);
      return false;
    }
  }
  
  /**
   * Get all NDA requests for a creator's pitches
   */
  async getCreatorNDARequests(creatorId: number, status?: string): Promise<any[]> {
    try {
      let query = `
        SELECT 
          nr.*,
          p.title as pitch_title,
          p.thumbnail_url as pitch_thumbnail,
          u.name as investor_name,
          u.email as investor_email,
          u.company_name as investor_company
        FROM nda_requests nr
        JOIN pitches p ON nr.pitch_id = p.id
        JOIN users u ON nr.investor_id = u.id
        WHERE p.user_id = $1
      `;
      
      const params: any[] = [creatorId];
      
      if (status) {
        query += ` AND nr.status = $2`;
        params.push(status);
      }
      
      query += ` ORDER BY nr.requested_at DESC`;
      
      return await this.db.query(query, params);
    } catch (error) {
      console.error('Failed to get creator NDA requests:', error);
      return [];
    }
  }
  
  /**
   * Get all NDA requests for an investor
   */
  async getInvestorNDARequests(investorId: number, status?: string): Promise<any[]> {
    try {
      let query = `
        SELECT 
          nr.*,
          p.title as pitch_title,
          p.thumbnail_url as pitch_thumbnail,
          p.genre,
          p.format,
          u.name as creator_name
        FROM nda_requests nr
        JOIN pitches p ON nr.pitch_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE nr.investor_id = $1
      `;
      
      const params: any[] = [investorId];
      
      if (status) {
        query += ` AND nr.status = $2`;
        params.push(status);
      }
      
      query += ` ORDER BY nr.requested_at DESC`;
      
      return await this.db.query(query, params);
    } catch (error) {
      console.error('Failed to get investor NDA requests:', error);
      return [];
    }
  }
  
  /**
   * Get NDA statistics for dashboard
   */
  async getNDAStats(userId: number, userType: string): Promise<any> {
    try {
      if (userType === 'creator') {
        const stats = await this.db.queryOne(`
          SELECT 
            COUNT(CASE WHEN nr.status = 'pending' THEN 1 END) as pending_count,
            COUNT(CASE WHEN nr.status = 'approved' THEN 1 END) as approved_count,
            COUNT(CASE WHEN nr.status = 'rejected' THEN 1 END) as rejected_count,
            COUNT(*) as total_count
          FROM nda_requests nr
          JOIN pitches p ON nr.pitch_id = p.id
          WHERE p.user_id = $1
        `, [userId]);
        
        return stats || { pending_count: 0, approved_count: 0, rejected_count: 0, total_count: 0 };
      } else {
        const stats = await this.db.queryOne(`
          SELECT 
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
            COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
            COUNT(*) as total_count
          FROM nda_requests
          WHERE investor_id = $1
        `, [userId]);
        
        return stats || { pending_count: 0, approved_count: 0, rejected_count: 0, total_count: 0 };
      }
    } catch (error) {
      console.error('Failed to get NDA stats:', error);
      return { pending_count: 0, approved_count: 0, rejected_count: 0, total_count: 0 };
    }
  }
  
  /**
   * Clean up expired NDAs
   */
  async cleanupExpiredNDAs(): Promise<number> {
    try {
      const result = await this.db.query(
        `UPDATE nda_requests 
         SET status = 'expired'
         WHERE status = 'approved' 
         AND expires_at < NOW()
         RETURNING id`
      );
      
      return result.length;
    } catch (error) {
      console.error('Failed to cleanup expired NDAs:', error);
      return 0;
    }
  }
  
  /**
   * Sign an approved NDA
   */
  async signNDA(
    signerId: number,
    data: z.infer<typeof NDASignatureSchema>
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const validated = NDASignatureSchema.parse(data);

      // Verify the NDA exists and is approved
      const nda = await this.db.queryOne(
        `SELECT n.*, p.title as pitch_title, p.creator_id
         FROM ndas n
         JOIN pitches p ON p.id = n.pitch_id
         WHERE n.id = $1 AND n.signer_id = $2 AND n.status = 'approved'`,
        [validated.ndaId, signerId]
      );

      if (!nda) {
        return { success: false, error: 'NDA not found, not approved, or not authorized' };
      }

      // Create signature hash
      const signatureHash = this.createSignatureHash({
        ndaId: validated.ndaId,
        signerId,
        fullName: validated.fullName,
        timestamp: new Date().toISOString()
      });

      // Update NDA with signature
      const signedNda = await this.db.queryOne(
        `UPDATE ndas SET
          status = 'active',
          signed_at = NOW(),
          signature_data = $3,
          signature_hash = $4,
          access_granted = true,
          signer_ip = $5,
          updated_at = NOW()
        WHERE id = $1 AND signer_id = $2
        RETURNING *`,
        [
          validated.ndaId,
          signerId,
          JSON.stringify({
            signature: validated.signature,
            fullName: validated.fullName,
            title: validated.title,
            company: validated.company,
            acceptTerms: validated.acceptTerms,
            signedAt: new Date().toISOString()
          }),
          signatureHash,
          validated.ipAddress
        ]
      );

      // Grant access to protected content
      await this.grantContentAccess(signerId, nda.pitch_id, nda.access_level);

      // Log audit entry
      await this.logAuditEntry({
        ndaId: validated.ndaId,
        userId: signerId,
        action: 'NDA_SIGNED',
        metadata: {
          signatureHash,
          fullName: validated.fullName,
          company: validated.company
        }
      });

      // Notify creator
      await this.sendNotification(
        nda.creator_id,
        'nda_signed',
        {
          signerName: validated.fullName,
          pitchTitle: nda.pitch_title,
          ndaId: validated.ndaId
        }
      );

      // Schedule expiration check if applicable
      if (nda.expires_at) {
        await this.scheduleExpirationCheck(validated.ndaId, nda.expires_at);
      }

      return { success: true, data: signedNda };
    } catch (error) {
      console.error('Error signing NDA:', error);
      return { success: false, error: error.message || 'Failed to sign NDA' };
    }
  }

  /**
   * Revoke an active NDA
   */
  async revokeNDA(
    revokerId: number,
    ndaId: number,
    reason: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Verify ownership
      const nda = await this.db.queryOne(
        `SELECT n.*, p.creator_id, p.title as pitch_title
         FROM ndas n
         JOIN pitches p ON p.id = n.pitch_id
         WHERE n.id = $1 AND p.creator_id = $2 AND n.status = 'active'`,
        [ndaId, revokerId]
      );

      if (!nda) {
        return { success: false, error: 'NDA not found or not authorized' };
      }

      // Revoke the NDA
      const revokedNda = await this.db.queryOne(
        `UPDATE ndas SET
          status = 'revoked',
          revoked_at = NOW(),
          revoked_by = $2,
          revocation_reason = $3,
          access_granted = false,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
        [ndaId, revokerId, reason]
      );

      // Revoke access to protected content
      await this.revokeContentAccess(nda.signer_id, nda.pitch_id);

      // Log audit entry
      await this.logAuditEntry({
        ndaId,
        userId: revokerId,
        action: 'NDA_REVOKED',
        metadata: { reason }
      });

      // Notify signer
      await this.sendNotification(
        nda.signer_id,
        'nda_revoked',
        {
          pitchTitle: nda.pitch_title,
          reason
        }
      );

      return { success: true, data: revokedNda };
    } catch (error) {
      console.error('Error revoking NDA:', error);
      return { success: false, error: error.message || 'Failed to revoke NDA' };
    }
  }

  /**
   * Check and expire NDAs automatically
   */
  async checkAndExpireNDAs(): Promise<void> {
    try {
      // Find expired NDAs
      const expiredNDAs = await this.db.query(
        `SELECT n.*, p.title as pitch_title
         FROM ndas n
         JOIN pitches p ON p.id = n.pitch_id
         WHERE n.status = 'active' 
         AND n.expires_at IS NOT NULL 
         AND n.expires_at < NOW()`
      );

      for (const nda of expiredNDAs) {
        // Update status to expired
        await this.db.query(
          `UPDATE ndas SET
            status = 'expired',
            access_granted = false,
            updated_at = NOW()
          WHERE id = $1`,
          [nda.id]
        );

        // Revoke access
        await this.revokeContentAccess(nda.signer_id, nda.pitch_id);

        // Log audit entry
        await this.logAuditEntry({
          ndaId: nda.id,
          userId: 0, // System action
          action: 'NDA_EXPIRED',
          metadata: {
            expiredAt: nda.expires_at
          }
        });

        // Send notification
        await this.sendNotification(
          nda.signer_id,
          'nda_expired',
          {
            pitchTitle: nda.pitch_title
          }
        );
      }
      
      // Also update expired requests
      await this.db.query(
        `UPDATE nda_requests 
         SET status = 'expired'
         WHERE status = 'approved' 
         AND expires_at < NOW()`
      );
    } catch (error) {
      console.error('Error checking expired NDAs:', error);
    }
  }

  /**
   * Get NDA audit trail
   */
  async getNDAAuditTrail(ndaId: number, userId: number): Promise<any[]> {
    try {
      // Verify user has access to this NDA
      const nda = await this.db.queryOne(
        `SELECT n.*, p.creator_id
         FROM ndas n
         JOIN pitches p ON p.id = n.pitch_id
         WHERE n.id = $1 AND (n.signer_id = $2 OR p.creator_id = $2)`,
        [ndaId, userId]
      );

      if (!nda) {
        return [];
      }

      // Get audit trail
      const auditTrail = await this.db.query(
        `SELECT al.*, u.name as user_name, u.email as user_email
         FROM nda_audit_log al
         LEFT JOIN users u ON u.id = al.user_id
         WHERE al.nda_id = $1
         ORDER BY al.created_at DESC`,
        [ndaId]
      );

      return auditTrail;
    } catch (error) {
      console.error('Error getting NDA audit trail:', error);
      return [];
    }
  }

  // Enhanced private helper methods
  
  private async grantContentAccess(
    userId: number,
    pitchId: number,
    accessLevel: string
  ): Promise<void> {
    try {
      // Create or update access record
      await this.db.query(
        `INSERT INTO pitch_access (
          user_id, pitch_id, access_level,
          granted_at, granted_via
        ) VALUES (
          $1, $2, $3, NOW(), 'nda'
        ) ON CONFLICT (user_id, pitch_id) 
        DO UPDATE SET
          access_level = $3,
          granted_at = NOW(),
          granted_via = 'nda'`,
        [userId, pitchId, accessLevel]
      );
    } catch (error) {
      console.error('Error granting content access:', error);
    }
  }

  private async revokeContentAccess(
    userId: number,
    pitchId: number
  ): Promise<void> {
    try {
      await this.db.query(
        `DELETE FROM pitch_access
         WHERE user_id = $1 AND pitch_id = $2`,
        [userId, pitchId]
      );
    } catch (error) {
      console.error('Error revoking content access:', error);
    }
  }

  private async generateWatermarkConfig(
    ndaId: number,
    userId: number
  ): Promise<void> {
    try {
      const user = await this.db.queryOne(
        `SELECT name, email FROM users WHERE id = $1`,
        [userId]
      );

      const watermarkConfig: WatermarkConfig = {
        enabled: true,
        text: `CONFIDENTIAL - ${user?.name || user?.email} - NDA #${ndaId}`,
        opacity: 0.3,
        position: 'diagonal',
        includeTimestamp: true,
        includeUserId: true
      };

      // Store watermark configuration
      await this.db.query(
        `UPDATE ndas SET
          watermark_config = $2
        WHERE id = $1`,
        [ndaId, JSON.stringify(watermarkConfig)]
      );
    } catch (error) {
      console.error('Error generating watermark config:', error);
    }
  }

  private createSignatureHash(data: any): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  private async logAuditEntry(entry: {
    ndaId?: number;
    ndaRequestId?: number;
    userId: number;
    action: string;
    metadata: any;
  }): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO nda_audit_log (
          nda_id, nda_request_id, user_id, action, 
          metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, NOW()
        )`,
        [
          entry.ndaId || null,
          entry.ndaRequestId || null,
          entry.userId,
          entry.action,
          JSON.stringify(entry.metadata)
        ]
      );
    } catch (error) {
      console.error('Error logging audit entry:', error);
    }
  }

  private async sendNotification(
    recipientId: number,
    type: string,
    data: any
  ): Promise<void> {
    try {
      // Create notification record
      await this.db.query(
        `INSERT INTO notifications (
          user_id, type, title, message,
          data, status, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'unread', NOW()
        )`,
        [
          recipientId,
          type,
          this.getNotificationTitle(type, data),
          this.getNotificationMessage(type, data),
          JSON.stringify(data)
        ]
      );
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  private getNotificationTitle(type: string, data: any): string {
    switch (type) {
      case 'nda_request':
        return 'New NDA Request';
      case 'nda_approved':
        return 'NDA Approved';
      case 'nda_rejected':
        return 'NDA Rejected';
      case 'nda_signed':
        return 'NDA Signed';
      case 'nda_revoked':
        return 'NDA Revoked';
      case 'nda_expired':
        return 'NDA Expired';
      default:
        return 'NDA Update';
    }
  }

  private getNotificationMessage(type: string, data: any): string {
    switch (type) {
      case 'nda_request':
        return `${data.requesterName} has requested an NDA for "${data.pitchTitle}"`;
      case 'nda_approved':
        return `Your NDA request for "${data.pitchTitle}" has been approved. Please sign to gain access.`;
      case 'nda_rejected':
        return `Your NDA request for "${data.pitchTitle}" has been rejected. Reason: ${data.reason}`;
      case 'nda_signed':
        return `${data.signerName} has signed the NDA for "${data.pitchTitle}"`;
      case 'nda_revoked':
        return `Your NDA access for "${data.pitchTitle}" has been revoked. Reason: ${data.reason}`;
      case 'nda_expired':
        return `Your NDA for "${data.pitchTitle}" has expired`;
      default:
        return 'Your NDA status has been updated';
    }
  }

  private async scheduleExpirationCheck(ndaId: number, expiresAt: Date): Promise<void> {
    // This would integrate with a job queue or scheduler
    // For now, we'll rely on periodic checks
    console.log(`Scheduled expiration check for NDA ${ndaId} at ${expiresAt}`);
  }

  // Updated notification methods for compatibility
  private async notifyCreator(
    creatorId: number,
    investorId: number,
    pitchTitle?: string,
    requestId?: number
  ): Promise<void> {
    const investor = await this.db.queryOne(
      `SELECT name, email FROM users WHERE id = $1`,
      [investorId]
    );
    
    await this.sendNotification(creatorId, 'nda_request', {
      requesterName: investor?.name || investor?.email || 'Unknown User',
      pitchTitle: pitchTitle || 'Unknown Pitch',
      requestId: requestId
    });
  }
  
  private async notifyInvestor(
    investorId: number, 
    pitchId: number, 
    status: 'approved' | 'rejected',
    reason?: string,
    additionalData?: any
  ): Promise<void> {
    const type = status === 'approved' ? 'nda_approved' : 'nda_rejected';
    await this.sendNotification(investorId, type, {
      ...additionalData,
      reason
    });
  }
}