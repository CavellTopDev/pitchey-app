/**
 * NDA Workflow Service for Free Plan
 * Manages NDA requests, approvals, and access control
 */

import { createDatabase } from '../db/raw-sql-connection';

export interface NDARequest {
  id: number;
  pitch_id: number;
  investor_id: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requested_at: string;
  reviewed_at?: string;
  expires_at?: string;
  reviewer_notes?: string;
}

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
   * Request NDA access for a pitch
   */
  async requestNDA(pitchId: number, investorId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Check if NDA already exists
      const existing = await this.db.queryOne(
        `SELECT * FROM nda_requests 
         WHERE pitch_id = $1 AND investor_id = $2 
         AND status IN ('pending', 'approved')`,
        [pitchId, investorId]
      );
      
      if (existing) {
        if (existing.status === 'approved') {
          return { success: false, error: 'NDA already approved' };
        }
        return { success: false, error: 'NDA request already pending' };
      }
      
      // Create new NDA request
      const result = await this.db.queryOne(
        `INSERT INTO nda_requests (pitch_id, investor_id, status, requested_at)
         VALUES ($1, $2, 'pending', NOW())
         RETURNING *`,
        [pitchId, investorId]
      );
      
      // Send notification to creator (would be email/push in production)
      await this.notifyCreator(pitchId, investorId);
      
      return { success: true, data: result };
    } catch (error) {
      console.error('NDA request failed:', error);
      return { success: false, error: 'Failed to create NDA request' };
    }
  }
  
  /**
   * Approve NDA request
   */
  async approveNDA(
    ndaId: number, 
    creatorId: number, 
    expirationDays: number = 30
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Verify creator owns the pitch
      const nda = await this.db.queryOne(
        `SELECT nr.*, p.user_id as creator_id 
         FROM nda_requests nr
         JOIN pitches p ON nr.pitch_id = p.id
         WHERE nr.id = $1 AND p.user_id = $2`,
        [ndaId, creatorId]
      );
      
      if (!nda) {
        return { success: false, error: 'NDA not found or unauthorized' };
      }
      
      if (nda.status !== 'pending') {
        return { success: false, error: `NDA already ${nda.status}` };
      }
      
      // Approve the NDA
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);
      
      const result = await this.db.queryOne(
        `UPDATE nda_requests 
         SET status = 'approved',
             reviewed_at = NOW(),
             expires_at = $1
         WHERE id = $2
         RETURNING *`,
        [expiresAt.toISOString(), ndaId]
      );
      
      // Grant access to protected content
      await this.grantAccess(nda.pitch_id, nda.investor_id);
      
      // Notify investor
      await this.notifyInvestor(nda.investor_id, nda.pitch_id, 'approved');
      
      return { success: true, data: result };
    } catch (error) {
      console.error('NDA approval failed:', error);
      return { success: false, error: 'Failed to approve NDA' };
    }
  }
  
  /**
   * Reject NDA request
   */
  async rejectNDA(
    ndaId: number,
    creatorId: number,
    reason?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Verify creator owns the pitch
      const nda = await this.db.queryOne(
        `SELECT nr.*, p.user_id as creator_id 
         FROM nda_requests nr
         JOIN pitches p ON nr.pitch_id = p.id
         WHERE nr.id = $1 AND p.user_id = $2`,
        [ndaId, creatorId]
      );
      
      if (!nda) {
        return { success: false, error: 'NDA not found or unauthorized' };
      }
      
      if (nda.status !== 'pending') {
        return { success: false, error: `NDA already ${nda.status}` };
      }
      
      // Reject the NDA
      const result = await this.db.queryOne(
        `UPDATE nda_requests 
         SET status = 'rejected',
             reviewed_at = NOW(),
             reviewer_notes = $1
         WHERE id = $2
         RETURNING *`,
        [reason || null, ndaId]
      );
      
      // Notify investor
      await this.notifyInvestor(nda.investor_id, nda.pitch_id, 'rejected', reason);
      
      return { success: true, data: result };
    } catch (error) {
      console.error('NDA rejection failed:', error);
      return { success: false, error: 'Failed to reject NDA' };
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
  
  // Private helper methods
  
  private async grantAccess(pitchId: number, investorId: number): Promise<void> {
    // In production, this would update access control tables
    // For now, the hasNDAAccess check handles this
    console.log(`Granted NDA access for pitch ${pitchId} to investor ${investorId}`);
  }
  
  private async notifyCreator(pitchId: number, investorId: number): Promise<void> {
    // In production, send email/push notification
    // For free plan, just log
    console.log(`Notification: New NDA request for pitch ${pitchId} from investor ${investorId}`);
  }
  
  private async notifyInvestor(
    investorId: number, 
    pitchId: number, 
    status: 'approved' | 'rejected',
    reason?: string
  ): Promise<void> {
    // In production, send email/push notification
    // For free plan, just log
    console.log(`Notification: NDA ${status} for pitch ${pitchId} to investor ${investorId}`);
    if (reason) {
      console.log(`Reason: ${reason}`);
    }
  }
}