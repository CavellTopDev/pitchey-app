/**
 * NDA Workflow Service
 * Handles the complete NDA approval process with notifications
 */

import { ndaRequests, pitches, users, notifications } from '../../db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { EmailService } from '../email/email.service';
import { WebSocketService } from '../websocket/websocket.service';

export interface NDARequest {
  id: number;
  pitchId: number;
  requesterId: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  message?: string;
  signedAt?: Date;
  expiresAt?: Date;
  documentUrl?: string;
  createdAt: Date;
}

export interface NDAApprovalRequest {
  requestId: number;
  approved: boolean;
  message?: string;
  customTerms?: string;
  expiryDays?: number;
}

export class NDAWorkflowService {
  private emailService: EmailService;
  private wsService: WebSocketService;
  private defaultExpiryDays = 90; // Default NDA validity period

  constructor(emailService: EmailService, wsService: WebSocketService) {
    this.emailService = emailService;
    this.wsService = wsService;
  }

  /**
   * Request NDA access for a pitch
   */
  async requestNDA(
    pitchId: number,
    requesterId: number,
    message: string,
    sqlConnection: any
  ): Promise<NDARequest> {
    try {
      // Check if pitch exists and requires NDA
      const pitch = await sqlConnection
        .select()
        .from(pitches)
        .where(eq(pitches.id, pitchId))
        .limit(1);

      if (pitch.length === 0) {
        throw new Error('Pitch not found');
      }

      const pitchData = pitch[0];

      // Check if requester already has an active NDA
      const existingNDA = await sqlConnection
        .select()
        .from(ndaRequests)
        .where(and(
          eq(ndaRequests.pitchId, pitchId),
          eq(ndaRequests.requesterId, requesterId),
          or(
            eq(ndaRequests.status, 'approved'),
            eq(ndaRequests.status, 'pending')
          )
        ))
        .limit(1);

      if (existingNDA.length > 0) {
        const existing = existingNDA[0];
        if (existing.status === 'approved') {
          // Check if NDA is still valid
          if (existing.expiresAt && new Date(existing.expiresAt) > new Date()) {
            throw new Error('You already have an active NDA for this pitch');
          }
        } else {
          throw new Error('You have a pending NDA request for this pitch');
        }
      }

      // Get requester details
      const requester = await sqlConnection
        .select()
        .from(users)
        .where(eq(users.id, requesterId))
        .limit(1);

      if (requester.length === 0) {
        throw new Error('Requester not found');
      }

      const requesterData = requester[0];

      // Create NDA request
      const newRequest = await sqlConnection
        .insert(ndaRequests)
        .values({
          pitchId,
          requesterId,
          status: 'pending',
          message,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      const ndaRequest = newRequest[0];

      // Get pitch creator details
      const creator = await sqlConnection
        .select()
        .from(users)
        .where(eq(users.id, pitchData.userId))
        .limit(1);

      if (creator.length > 0) {
        const creatorData = creator[0];

        // Send email notification to creator
        await this.emailService.sendNDARequestEmail({
          to: creatorData.email,
          creatorName: creatorData.firstName || creatorData.username,
          requesterName: requesterData.companyName || requesterData.username,
          requesterType: requesterData.userType,
          pitchTitle: pitchData.title,
          message: message,
          requestId: ndaRequest.id
        });

        // Send real-time notification via WebSocket
        await this.wsService.sendNotification(creatorData.id, {
          type: 'nda_request',
          title: 'New NDA Request',
          message: `${requesterData.companyName || requesterData.username} has requested NDA access to "${pitchData.title}"`,
          data: {
            requestId: ndaRequest.id,
            pitchId: pitchId,
            requesterId: requesterId
          },
          timestamp: new Date().toISOString()
        });

        // Store notification in database
        await sqlConnection.insert(notifications).values({
          userId: creatorData.id,
          type: 'nda_request',
          title: 'New NDA Request',
          message: `${requesterData.companyName || requesterData.username} has requested NDA access to "${pitchData.title}"`,
          relatedId: ndaRequest.id,
          relatedType: 'nda_request',
          isRead: false,
          createdAt: new Date()
        });
      }

      return {
        id: ndaRequest.id,
        pitchId: ndaRequest.pitchId,
        requesterId: ndaRequest.requesterId,
        status: ndaRequest.status,
        message: ndaRequest.message,
        createdAt: ndaRequest.createdAt
      };

    } catch (error) {
      console.error('NDA request error:', error);
      throw error;
    }
  }

  /**
   * Approve or reject an NDA request
   */
  async processNDARequest(
    creatorId: number,
    approval: NDAApprovalRequest,
    sqlConnection: any
  ): Promise<void> {
    try {
      // Get the NDA request
      const request = await sqlConnection
        .select({
          id: ndaRequests.id,
          pitchId: ndaRequests.pitchId,
          requesterId: ndaRequests.requesterId,
          status: ndaRequests.status,
          pitchTitle: pitches.title,
          pitchUserId: pitches.userId,
          customNdaUrl: pitches.customNdaUrl
        })
        .from(ndaRequests)
        .leftJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
        .where(eq(ndaRequests.id, approval.requestId))
        .limit(1);

      if (request.length === 0) {
        throw new Error('NDA request not found');
      }

      const requestData = request[0];

      // Verify creator owns the pitch
      if (requestData.pitchUserId !== creatorId) {
        throw new Error('Unauthorized to process this NDA request');
      }

      // Check if request is still pending
      if (requestData.status !== 'pending') {
        throw new Error('This NDA request has already been processed');
      }

      // Get requester details
      const requester = await sqlConnection
        .select()
        .from(users)
        .where(eq(users.id, requestData.requesterId))
        .limit(1);

      if (requester.length === 0) {
        throw new Error('Requester not found');
      }

      const requesterData = requester[0];

      // Process the request
      if (approval.approved) {
        // Calculate expiry date
        const expiryDays = approval.expiryDays || this.defaultExpiryDays;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);

        // Update NDA request status
        await sqlConnection
          .update(ndaRequests)
          .set({
            status: 'approved',
            approvedAt: new Date(),
            signedAt: new Date(),
            expiresAt: expiresAt,
            approverMessage: approval.message,
            customTerms: approval.customTerms,
            documentUrl: requestData.customNdaUrl,
            updatedAt: new Date()
          })
          .where(eq(ndaRequests.id, approval.requestId));

        // Send approval email
        await this.emailService.sendNDAApprovalEmail({
          to: requesterData.email,
          requesterName: requesterData.firstName || requesterData.username,
          pitchTitle: requestData.pitchTitle,
          expiresAt: expiresAt,
          documentUrl: requestData.customNdaUrl,
          customTerms: approval.customTerms,
          message: approval.message
        });

        // Send real-time notification
        await this.wsService.sendNotification(requestData.requesterId, {
          type: 'nda_approved',
          title: 'NDA Request Approved',
          message: `Your NDA request for "${requestData.pitchTitle}" has been approved`,
          data: {
            requestId: approval.requestId,
            pitchId: requestData.pitchId,
            expiresAt: expiresAt.toISOString()
          },
          timestamp: new Date().toISOString()
        });

        // Store notification
        await sqlConnection.insert(notifications).values({
          userId: requestData.requesterId,
          type: 'nda_approved',
          title: 'NDA Request Approved',
          message: `Your NDA request for "${requestData.pitchTitle}" has been approved. Access granted until ${expiresAt.toLocaleDateString()}.`,
          relatedId: approval.requestId,
          relatedType: 'nda_request',
          isRead: false,
          createdAt: new Date()
        });

        // Grant access to pitch materials (update pitch visibility for this user)
        // This would typically involve updating a pitch_access table
        await this.grantPitchAccess(requestData.pitchId, requestData.requesterId, expiresAt, sqlConnection);

      } else {
        // Reject the request
        await sqlConnection
          .update(ndaRequests)
          .set({
            status: 'rejected',
            rejectedAt: new Date(),
            approverMessage: approval.message,
            updatedAt: new Date()
          })
          .where(eq(ndaRequests.id, approval.requestId));

        // Send rejection email
        await this.emailService.sendNDARejectionEmail({
          to: requesterData.email,
          requesterName: requesterData.firstName || requesterData.username,
          pitchTitle: requestData.pitchTitle,
          message: approval.message
        });

        // Send real-time notification
        await this.wsService.sendNotification(requestData.requesterId, {
          type: 'nda_rejected',
          title: 'NDA Request Rejected',
          message: `Your NDA request for "${requestData.pitchTitle}" has been rejected`,
          data: {
            requestId: approval.requestId,
            pitchId: requestData.pitchId,
            reason: approval.message
          },
          timestamp: new Date().toISOString()
        });

        // Store notification
        await sqlConnection.insert(notifications).values({
          userId: requestData.requesterId,
          type: 'nda_rejected',
          title: 'NDA Request Rejected',
          message: `Your NDA request for "${requestData.pitchTitle}" has been rejected. ${approval.message ? `Reason: ${approval.message}` : ''}`,
          relatedId: approval.requestId,
          relatedType: 'nda_request',
          isRead: false,
          createdAt: new Date()
        });
      }

    } catch (error) {
      console.error('NDA processing error:', error);
      throw error;
    }
  }

  /**
   * Check if user has valid NDA for a pitch
   */
  async hasValidNDA(
    pitchId: number,
    userId: number,
    sqlConnection: any
  ): Promise<boolean> {
    try {
      const validNDA = await sqlConnection
        .select()
        .from(ndaRequests)
        .where(and(
          eq(ndaRequests.pitchId, pitchId),
          eq(ndaRequests.requesterId, userId),
          eq(ndaRequests.status, 'approved')
        ))
        .limit(1);

      if (validNDA.length === 0) {
        return false;
      }

      const nda = validNDA[0];

      // Check if NDA has expired
      if (nda.expiresAt) {
        const expiryDate = new Date(nda.expiresAt);
        if (expiryDate < new Date()) {
          // NDA has expired, update status
          await sqlConnection
            .update(ndaRequests)
            .set({ 
              status: 'expired',
              updatedAt: new Date()
            })
            .where(eq(ndaRequests.id, nda.id));

          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('NDA validation error:', error);
      return false;
    }
  }

  /**
   * Get all NDA requests for a creator's pitches
   */
  async getCreatorNDARequests(
    creatorId: number,
    status: string | null,
    sqlConnection: any
  ): Promise<any[]> {
    try {
      let query = sqlConnection
        .select({
          requestId: ndaRequests.id,
          pitchId: ndaRequests.pitchId,
          pitchTitle: pitches.title,
          requesterId: ndaRequests.requesterId,
          requesterName: users.username,
          requesterCompany: users.companyName,
          requesterType: users.userType,
          status: ndaRequests.status,
          message: ndaRequests.message,
          createdAt: ndaRequests.createdAt,
          signedAt: ndaRequests.signedAt,
          expiresAt: ndaRequests.expiresAt
        })
        .from(ndaRequests)
        .leftJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
        .leftJoin(users, eq(ndaRequests.requesterId, users.id))
        .where(eq(pitches.userId, creatorId));

      if (status) {
        query = query.where(eq(ndaRequests.status, status));
      }

      query = query.orderBy(desc(ndaRequests.createdAt));

      return await query;

    } catch (error) {
      console.error('Get creator NDA requests error:', error);
      throw error;
    }
  }

  /**
   * Get all NDA requests made by a user
   */
  async getUserNDARequests(
    userId: number,
    status: string | null,
    sqlConnection: any
  ): Promise<any[]> {
    try {
      let query = sqlConnection
        .select({
          requestId: ndaRequests.id,
          pitchId: ndaRequests.pitchId,
          pitchTitle: pitches.title,
          creatorId: pitches.userId,
          creatorName: users.username,
          status: ndaRequests.status,
          message: ndaRequests.message,
          approverMessage: ndaRequests.approverMessage,
          createdAt: ndaRequests.createdAt,
          signedAt: ndaRequests.signedAt,
          expiresAt: ndaRequests.expiresAt,
          documentUrl: ndaRequests.documentUrl
        })
        .from(ndaRequests)
        .leftJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(eq(ndaRequests.requesterId, userId));

      if (status) {
        query = query.where(eq(ndaRequests.status, status));
      }

      query = query.orderBy(desc(ndaRequests.createdAt));

      return await query;

    } catch (error) {
      console.error('Get user NDA requests error:', error);
      throw error;
    }
  }

  /**
   * Send reminder notifications for expiring NDAs
   */
  async sendExpiryReminders(sqlConnection: any): Promise<void> {
    try {
      // Find NDAs expiring in 7 days
      const expiringNDAs = await sqlConnection
        .select({
          id: ndaRequests.id,
          pitchId: ndaRequests.pitchId,
          pitchTitle: pitches.title,
          requesterId: ndaRequests.requesterId,
          requesterEmail: users.email,
          requesterName: users.username,
          expiresAt: ndaRequests.expiresAt
        })
        .from(ndaRequests)
        .leftJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
        .leftJoin(users, eq(ndaRequests.requesterId, users.id))
        .where(and(
          eq(ndaRequests.status, 'approved'),
          // SQL to check if expires in 7 days
          sql`DATE(${ndaRequests.expiresAt}) = DATE(NOW() + INTERVAL '7 days')`
        ));

      for (const nda of expiringNDAs) {
        // Send email reminder
        await this.emailService.sendNDAExpiryReminder({
          to: nda.requesterEmail,
          requesterName: nda.requesterName,
          pitchTitle: nda.pitchTitle,
          expiresAt: nda.expiresAt,
          pitchId: nda.pitchId
        });

        // Send notification
        await sqlConnection.insert(notifications).values({
          userId: nda.requesterId,
          type: 'nda_expiring',
          title: 'NDA Expiring Soon',
          message: `Your NDA for "${nda.pitchTitle}" will expire on ${new Date(nda.expiresAt).toLocaleDateString()}`,
          relatedId: nda.id,
          relatedType: 'nda_request',
          isRead: false,
          createdAt: new Date()
        });
      }

    } catch (error) {
      console.error('Send expiry reminders error:', error);
    }
  }

  /**
   * Grant pitch access to a user after NDA approval
   */
  private async grantPitchAccess(
    pitchId: number,
    userId: number,
    expiresAt: Date,
    sqlConnection: any
  ): Promise<void> {
    try {
      // This would typically update a pitch_access table
      // For now, we'll update the NDA request to indicate access is granted
      
      // You might also want to:
      // - Update user permissions
      // - Send additional documents
      // - Enable download capabilities
      // - Grant access to specific pitch materials
      
      console.log(`Granted access to pitch ${pitchId} for user ${userId} until ${expiresAt}`);

    } catch (error) {
      console.error('Grant pitch access error:', error);
      throw error;
    }
  }

  /**
   * Revoke expired NDA access
   */
  async revokeExpiredAccess(sqlConnection: any): Promise<void> {
    try {
      // Find and update expired NDAs
      await sqlConnection
        .update(ndaRequests)
        .set({
          status: 'expired',
          updatedAt: new Date()
        })
        .where(and(
          eq(ndaRequests.status, 'approved'),
          sql`${ndaRequests.expiresAt} < NOW()`
        ));

      console.log('Expired NDA access revoked');

    } catch (error) {
      console.error('Revoke expired access error:', error);
    }
  }
}