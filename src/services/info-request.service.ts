// Information Request Service - Post-NDA Communication System
import { db } from '../db/client.ts';
import { infoRequests, infoRequestAttachments, ndas, pitches, users, notifications } from '../db/schema.ts';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { z } from 'npm:zod@3.22.4';

// Validation schemas
const createInfoRequestSchema = z.object({
  ndaId: z.number(),
  pitchId: z.number(),
  requestType: z.enum(['financial', 'production', 'legal', 'marketing', 'casting', 'distribution', 'technical', 'general']),
  subject: z.string().min(1).max(255),
  message: z.string().min(1).max(5000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

const respondToInfoRequestSchema = z.object({
  infoRequestId: z.number(),
  response: z.string().min(1).max(5000),
});

const updateInfoRequestStatusSchema = z.object({
  infoRequestId: z.number(),
  status: z.enum(['pending', 'responded', 'closed']),
});

export class InfoRequestService {
  
  // Create a new information request
  static async createRequest(requesterId: number, data: z.infer<typeof createInfoRequestSchema>) {
    try {
      const validatedData = createInfoRequestSchema.parse(data);
      
      // Verify that the requester has a valid NDA for this pitch
      const ndaCheck = await db.select({
        nda: ndas,
        pitch: pitches,
        owner: users,
      })
      .from(ndas)
      .innerJoin(pitches, eq(ndas.pitchId, pitches.id))
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(and(
        eq(ndas.id, validatedData.ndaId),
        eq(ndas.pitchId, validatedData.pitchId),
        eq(ndas.signerId, requesterId),
        eq(ndas.status, 'signed')
      ))
      .limit(1);
      
      if (!ndaCheck.length) {
        throw new Error('No valid NDA found for this pitch');
      }
      
      const { nda, pitch, owner } = ndaCheck[0];
      
      // Check if NDA is expired
      if (nda.expiresAt && new Date() > nda.expiresAt) {
        throw new Error('NDA has expired');
      }
      
      // Create the information request
      const [newRequest] = await db.insert(infoRequests).values({
        ndaId: validatedData.ndaId,
        pitchId: validatedData.pitchId,
        requesterId,
        ownerId: owner.id,
        requestType: validatedData.requestType,
        subject: validatedData.subject,
        message: validatedData.message,
        priority: validatedData.priority,
        status: 'pending',
      }).returning();
      
      // Create notification for pitch owner
      await db.insert(notifications).values({
        userId: owner.id,
        type: 'info_request',
        title: 'New Information Request',
        message: `You have a new ${validatedData.requestType} information request for "${pitch.title}"`,
        relatedId: newRequest.id,
        relatedType: 'info_request',
        actionUrl: `/creator/info-requests/${newRequest.id}`,
      });
      
      return {
        ...newRequest,
        pitch: { id: pitch.id, title: pitch.title },
        requester: { id: requesterId },
        owner: { id: owner.id, username: owner.username },
      };
    } catch (error) {
      console.error('Error creating information request:', error);
      throw error;
    }
  }
  
  // Get information requests for a pitch owner (incoming)
  static async getIncomingRequests(ownerId: number, filters?: { status?: string, requestType?: string }) {
    try {
      let query = db.select({
        request: infoRequests,
        pitch: { id: pitches.id, title: pitches.title },
        requester: { 
          id: users.id, 
          username: users.username, 
          email: users.email,
          companyName: users.companyName 
        },
      })
      .from(infoRequests)
      .innerJoin(pitches, eq(infoRequests.pitchId, pitches.id))
      .innerJoin(users, eq(infoRequests.requesterId, users.id))
      .where(eq(infoRequests.ownerId, ownerId));
      
      // Apply filters if provided
      if (filters?.status) {
        query = query.where(and(
          eq(infoRequests.ownerId, ownerId),
          eq(infoRequests.status, filters.status)
        ));
      }
      
      if (filters?.requestType) {
        query = query.where(and(
          eq(infoRequests.ownerId, ownerId),
          eq(infoRequests.requestType, filters.requestType)
        ));
      }
      
      const results = await query.orderBy(desc(infoRequests.requestedAt));
      
      return results.map(row => ({
        ...row.request,
        pitch: row.pitch,
        requester: row.requester,
      }));
    } catch (error) {
      console.error('Error fetching incoming information requests:', error);
      throw error;
    }
  }
  
  // Get information requests made by a user (outgoing)
  static async getOutgoingRequests(requesterId: number, filters?: { status?: string, requestType?: string }) {
    try {
      let query = db.select({
        request: infoRequests,
        pitch: { id: pitches.id, title: pitches.title },
        owner: { 
          id: users.id, 
          username: users.username, 
          companyName: users.companyName 
        },
      })
      .from(infoRequests)
      .innerJoin(pitches, eq(infoRequests.pitchId, pitches.id))
      .innerJoin(users, eq(infoRequests.ownerId, users.id))
      .where(eq(infoRequests.requesterId, requesterId));
      
      // Apply filters if provided
      if (filters?.status) {
        query = query.where(and(
          eq(infoRequests.requesterId, requesterId),
          eq(infoRequests.status, filters.status)
        ));
      }
      
      if (filters?.requestType) {
        query = query.where(and(
          eq(infoRequests.requesterId, requesterId),
          eq(infoRequests.requestType, filters.requestType)
        ));
      }
      
      const results = await query.orderBy(desc(infoRequests.requestedAt));
      
      return results.map(row => ({
        ...row.request,
        pitch: row.pitch,
        owner: row.owner,
      }));
    } catch (error) {
      console.error('Error fetching outgoing information requests:', error);
      throw error;
    }
  }
  
  // Respond to an information request
  static async respondToRequest(ownerId: number, data: z.infer<typeof respondToInfoRequestSchema>) {
    try {
      const validatedData = respondToInfoRequestSchema.parse(data);
      
      // Verify ownership of the request
      const [request] = await db.select({
        request: infoRequests,
        pitch: pitches,
        requester: users,
      })
      .from(infoRequests)
      .innerJoin(pitches, eq(infoRequests.pitchId, pitches.id))
      .innerJoin(users, eq(infoRequests.requesterId, users.id))
      .where(and(
        eq(infoRequests.id, validatedData.infoRequestId),
        eq(infoRequests.ownerId, ownerId)
      ))
      .limit(1);
      
      if (!request) {
        throw new Error('Information request not found or unauthorized');
      }
      
      // Update the request with response
      const [updatedRequest] = await db.update(infoRequests)
        .set({
          response: validatedData.response,
          responseAt: new Date(),
          status: 'responded',
          updatedAt: new Date(),
        })
        .where(eq(infoRequests.id, validatedData.infoRequestId))
        .returning();
      
      // Create notification for requester
      await db.insert(notifications).values({
        userId: request.requester.id,
        type: 'info_request_response',
        title: 'Information Request Responded',
        message: `Your ${request.request.requestType} request for "${request.pitch.title}" has been responded to`,
        relatedId: validatedData.infoRequestId,
        relatedType: 'info_request',
        actionUrl: `/investor/info-requests/${validatedData.infoRequestId}`,
      });
      
      return {
        ...updatedRequest,
        pitch: { id: request.pitch.id, title: request.pitch.title },
        requester: { id: request.requester.id, username: request.requester.username },
      };
    } catch (error) {
      console.error('Error responding to information request:', error);
      throw error;
    }
  }
  
  // Update information request status
  static async updateStatus(userId: number, data: z.infer<typeof updateInfoRequestStatusSchema>) {
    try {
      const validatedData = updateInfoRequestStatusSchema.parse(data);
      
      // Verify that user is either the owner or requester
      const [request] = await db.select()
        .from(infoRequests)
        .where(and(
          eq(infoRequests.id, validatedData.infoRequestId),
          or(
            eq(infoRequests.ownerId, userId),
            eq(infoRequests.requesterId, userId)
          )
        ))
        .limit(1);
      
      if (!request) {
        throw new Error('Information request not found or unauthorized');
      }
      
      // Update status
      const [updatedRequest] = await db.update(infoRequests)
        .set({
          status: validatedData.status,
          updatedAt: new Date(),
        })
        .where(eq(infoRequests.id, validatedData.infoRequestId))
        .returning();
      
      return updatedRequest;
    } catch (error) {
      console.error('Error updating information request status:', error);
      throw error;
    }
  }
  
  // Get information request by ID (with access control)
  static async getRequestById(requestId: number, userId: number) {
    try {
      const [result] = await db.select({
        request: infoRequests,
        pitch: { id: pitches.id, title: pitches.title },
        requester: { 
          id: users.id, 
          username: users.username, 
          email: users.email,
          companyName: users.companyName 
        },
      })
      .from(infoRequests)
      .innerJoin(pitches, eq(infoRequests.pitchId, pitches.id))
      .innerJoin(users, eq(infoRequests.requesterId, users.id))
      .where(and(
        eq(infoRequests.id, requestId),
        or(
          eq(infoRequests.ownerId, userId),
          eq(infoRequests.requesterId, userId)
        )
      ))
      .limit(1);
      
      if (!result) {
        throw new Error('Information request not found or unauthorized');
      }
      
      // Get attachments
      const attachments = await db.select()
        .from(infoRequestAttachments)
        .where(eq(infoRequestAttachments.infoRequestId, requestId))
        .orderBy(desc(infoRequestAttachments.uploadedAt));
      
      return {
        ...result.request,
        pitch: result.pitch,
        requester: result.requester,
        attachments,
      };
    } catch (error) {
      console.error('Error fetching information request:', error);
      throw error;
    }
  }
  
  // Add attachment to information request
  static async addAttachment(userId: number, infoRequestId: number, attachmentData: {
    fileName: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number;
  }) {
    try {
      // Verify access to the request
      const [request] = await db.select()
        .from(infoRequests)
        .where(and(
          eq(infoRequests.id, infoRequestId),
          or(
            eq(infoRequests.ownerId, userId),
            eq(infoRequests.requesterId, userId)
          )
        ))
        .limit(1);
      
      if (!request) {
        throw new Error('Information request not found or unauthorized');
      }
      
      // Add attachment
      const [attachment] = await db.insert(infoRequestAttachments).values({
        infoRequestId,
        fileName: attachmentData.fileName,
        fileUrl: attachmentData.fileUrl,
        fileType: attachmentData.fileType,
        fileSize: attachmentData.fileSize,
        uploadedBy: userId,
      }).returning();
      
      return attachment;
    } catch (error) {
      console.error('Error adding attachment:', error);
      throw error;
    }
  }
  
  // Get information request statistics for a user
  static async getStats(userId: number) {
    try {
      // Get stats for requests where user is owner (incoming)
      const incomingStats = await db.select({
        total: sql<number>`COUNT(*)`,
        pending: sql<number>`COUNT(CASE WHEN ${infoRequests.status} = 'pending' THEN 1 END)`,
        responded: sql<number>`COUNT(CASE WHEN ${infoRequests.status} = 'responded' THEN 1 END)`,
        closed: sql<number>`COUNT(CASE WHEN ${infoRequests.status} = 'closed' THEN 1 END)`,
      })
      .from(infoRequests)
      .where(eq(infoRequests.ownerId, userId));
      
      // Get stats for requests where user is requester (outgoing)
      const outgoingStats = await db.select({
        total: sql<number>`COUNT(*)`,
        pending: sql<number>`COUNT(CASE WHEN ${infoRequests.status} = 'pending' THEN 1 END)`,
        responded: sql<number>`COUNT(CASE WHEN ${infoRequests.status} = 'responded' THEN 1 END)`,
        closed: sql<number>`COUNT(CASE WHEN ${infoRequests.status} = 'closed' THEN 1 END)`,
      })
      .from(infoRequests)
      .where(eq(infoRequests.requesterId, userId));
      
      // Get recent activity (last 30 days)
      const recentActivity = await db.select({
        count: sql<number>`COUNT(*)`,
        requestType: infoRequests.requestType,
      })
      .from(infoRequests)
      .where(and(
        or(
          eq(infoRequests.ownerId, userId),
          eq(infoRequests.requesterId, userId)
        ),
        sql`${infoRequests.requestedAt} >= NOW() - INTERVAL '30 days'`
      ))
      .groupBy(infoRequests.requestType);
      
      return {
        incoming: incomingStats[0] || { total: 0, pending: 0, responded: 0, closed: 0 },
        outgoing: outgoingStats[0] || { total: 0, pending: 0, responded: 0, closed: 0 },
        recentActivity: recentActivity || [],
      };
    } catch (error) {
      console.error('Error fetching information request stats:', error);
      return {
        incoming: { total: 0, pending: 0, responded: 0, closed: 0 },
        outgoing: { total: 0, pending: 0, responded: 0, closed: 0 },
        recentActivity: [],
      };
    }
  }
  
  // Get request types with counts for analytics
  static async getRequestTypeAnalytics(userId: number, role: 'owner' | 'requester' = 'owner') {
    try {
      const whereClause = role === 'owner' 
        ? eq(infoRequests.ownerId, userId)
        : eq(infoRequests.requesterId, userId);
      
      const results = await db.select({
        requestType: infoRequests.requestType,
        count: sql<number>`COUNT(*)`,
        pending: sql<number>`COUNT(CASE WHEN ${infoRequests.status} = 'pending' THEN 1 END)`,
        responded: sql<number>`COUNT(CASE WHEN ${infoRequests.status} = 'responded' THEN 1 END)`,
        avgResponseTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${infoRequests.responseAt} - ${infoRequests.requestedAt})) / 3600)`, // in hours
      })
      .from(infoRequests)
      .where(whereClause)
      .groupBy(infoRequests.requestType)
      .orderBy(desc(sql`COUNT(*)`));
      
      return results;
    } catch (error) {
      console.error('Error fetching request type analytics:', error);
      return [];
    }
  }
}

export default InfoRequestService;