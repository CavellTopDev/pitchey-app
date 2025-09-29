// NDA Service with complete Drizzle ORM integration
import { db } from '../db/client.ts';
import { ndas, ndaRequests, pitches, users, notifications } from '../db/schema.ts';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { z } from 'npm:zod@3.22.4';

// Validation schemas
const createNDARequestSchema = z.object({
  pitchId: z.number(),
  requesterId: z.number(),
  ndaType: z.enum(['basic', 'enhanced', 'custom']).default('basic'),
  requestMessage: z.string().optional(),
  companyInfo: z.object({
    companyName: z.string(),
    position: z.string(),
    intendedUse: z.string(),
  }).optional(),
});

const signNDASchema = z.object({
  pitchId: z.number(),
  signerId: z.number(),
  ndaType: z.enum(['basic', 'enhanced', 'custom']),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  signatureData: z.any().optional(),
  customNdaUrl: z.string().optional(),
});

export class NDAService {
  // Create NDA request
  static async createRequest(data: z.infer<typeof createNDARequestSchema>) {
    try {
      console.log("NDA Request data received:", data);
      const validatedData = createNDARequestSchema.parse(data);
      console.log("NDA Request data validated:", validatedData);
      
      // Get the pitch owner
      const pitch = await db.select().from(pitches)
        .where(eq(pitches.id, validatedData.pitchId))
        .limit(1);
      
      if (!pitch || pitch.length === 0) {
        throw new Error('Pitch not found');
      }
      
      // Check if an active request already exists
      const existingRequest = await db.select().from(ndaRequests)
        .where(and(
          eq(ndaRequests.pitchId, validatedData.pitchId),
          eq(ndaRequests.requesterId, validatedData.requesterId),
          eq(ndaRequests.status, 'pending')
        ))
        .limit(1);
      
      if (existingRequest.length > 0) {
        throw new Error('An NDA request is already pending for this pitch');
      }
      
      // Create new NDA request
      const [newRequest] = await db.insert(ndaRequests).values({
        pitchId: validatedData.pitchId,
        requesterId: validatedData.requesterId,
        ownerId: pitch[0].userId,
        ndaType: validatedData.ndaType,
        requestMessage: validatedData.requestMessage,
        companyInfo: validatedData.companyInfo,
        status: 'pending',
        requestedAt: new Date(),
      }).returning();
      
      // Create notification for pitch owner
      await db.insert(notifications).values({
        userId: pitch[0].userId,
        type: 'nda_request',
        title: 'New NDA Request',
        message: `You have a new NDA request for "${pitch[0].title}"`,
        relatedPitchId: validatedData.pitchId,
        relatedUserId: validatedData.requesterId,
        relatedNdaRequestId: newRequest.id,
        actionUrl: `/creator/nda-requests/${newRequest.id}`,
      });
      
      return newRequest;
    } catch (error) {
      console.error('Error creating NDA request:', error);
      throw error;
    }
  }
  
  // Get NDA requests for a user (incoming)
  static async getIncomingRequests(userId: number) {
    try {
      const requests = await db.select({
        request: ndaRequests,
        pitch: pitches,
        requester: users,
      })
      .from(ndaRequests)
      .innerJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
      .innerJoin(users, eq(ndaRequests.requesterId, users.id))
      .where(eq(ndaRequests.ownerId, userId))
      .orderBy(desc(ndaRequests.requestedAt));
      
      return requests;
    } catch (error) {
      console.error('Error fetching incoming NDA requests:', error);
      throw error;
    }
  }
  
  // Get NDA requests by a user (outgoing)
  static async getOutgoingRequests(userId: number) {
    try {
      const requests = await db.select({
        request: ndaRequests,
        pitch: pitches,
        owner: users,
      })
      .from(ndaRequests)
      .innerJoin(pitches, eq(ndaRequests.pitchId, pitches.id))
      .innerJoin(users, eq(ndaRequests.ownerId, users.id))
      .where(eq(ndaRequests.requesterId, userId))
      .orderBy(desc(ndaRequests.requestedAt));
      
      return requests;
    } catch (error) {
      console.error('Error fetching outgoing NDA requests:', error);
      throw error;
    }
  }
  
  // Approve NDA request
  static async approveRequest(requestId: number, ownerId: number) {
    try {
      // Verify ownership
      const [request] = await db.select().from(ndaRequests)
        .where(and(
          eq(ndaRequests.id, requestId),
          eq(ndaRequests.ownerId, ownerId),
          eq(ndaRequests.status, 'pending')
        ))
        .limit(1);
      
      if (!request) {
        throw new Error('NDA request not found or already processed');
      }
      
      // Update request status
      await db.update(ndaRequests)
        .set({
          status: 'approved',
          respondedAt: new Date(),
        })
        .where(eq(ndaRequests.id, requestId));
      
      // Create NDA record
      const [nda] = await db.insert(ndas).values({
        pitchId: request.pitchId,
        signerId: request.requesterId,
        ndaType: request.ndaType,
        signedAt: new Date(),
        accessGranted: true,
      }).returning();
      
      // Create notification for requester
      await db.insert(notifications).values({
        userId: request.requesterId,
        type: 'nda_approved',
        title: 'NDA Request Approved',
        message: 'Your NDA request has been approved',
        relatedPitchId: request.pitchId,
        relatedUserId: ownerId,
        relatedNdaRequestId: requestId,
        actionUrl: `/pitch/${request.pitchId}`,
      });
      
      // Increment NDA count on pitch
      await db.update(pitches)
        .set({
          ndaCount: sql`${pitches.ndaCount} + 1`,
        })
        .where(eq(pitches.id, request.pitchId));
      
      return nda;
    } catch (error) {
      console.error('Error approving NDA request:', error);
      throw error;
    }
  }
  
  // Reject NDA request
  static async rejectRequest(requestId: number, ownerId: number, rejectionReason?: string) {
    try {
      // Verify ownership
      const [request] = await db.select().from(ndaRequests)
        .where(and(
          eq(ndaRequests.id, requestId),
          eq(ndaRequests.ownerId, ownerId),
          eq(ndaRequests.status, 'pending')
        ))
        .limit(1);
      
      if (!request) {
        throw new Error('NDA request not found or already processed');
      }
      
      // Update request status
      await db.update(ndaRequests)
        .set({
          status: 'rejected',
          rejectionReason: rejectionReason,
          respondedAt: new Date(),
        })
        .where(eq(ndaRequests.id, requestId));
      
      // Create notification for requester
      await db.insert(notifications).values({
        userId: request.requesterId,
        type: 'nda_rejected',
        title: 'NDA Request Rejected',
        message: rejectionReason || 'Your NDA request has been rejected',
        relatedPitchId: request.pitchId,
        relatedUserId: ownerId,
        relatedNdaRequestId: requestId,
      });
      
      return { success: true, message: 'NDA request rejected' };
    } catch (error) {
      console.error('Error rejecting NDA request:', error);
      throw error;
    }
  }
  
  // Check if user has signed NDA for a pitch
  static async hasSignedNDA(userId: number, pitchId: number) {
    try {
      const [nda] = await db.select().from(ndas)
        .where(and(
          eq(ndas.pitchId, pitchId),
          eq(ndas.signerId, userId),
          eq(ndas.accessGranted, true)
        ))
        .limit(1);
      
      return !!nda;
    } catch (error) {
      console.error('Error checking NDA status:', error);
      return false;
    }
  }
  
  // Get all NDAs signed by a user
  static async getUserSignedNDAs(userId: number) {
    try {
      const ndaRecords = await db.select({
        nda: ndas,
        pitch: pitches,
      })
      .from(ndas)
      .innerJoin(pitches, eq(ndas.pitchId, pitches.id))
      .where(eq(ndas.signerId, userId))
      .orderBy(desc(ndas.signedAt));
      
      return ndaRecords;
    } catch (error) {
      console.error('Error fetching user NDAs:', error);
      throw error;
    }
  }
  
  // Get all NDAs for a pitch
  static async getPitchNDAs(pitchId: number, ownerId: number) {
    try {
      // Verify ownership
      const [pitch] = await db.select().from(pitches)
        .where(and(
          eq(pitches.id, pitchId),
          eq(pitches.userId, ownerId)
        ))
        .limit(1);
      
      if (!pitch) {
        throw new Error('Pitch not found or unauthorized');
      }
      
      const ndaRecords = await db.select({
        nda: ndas,
        signer: users,
      })
      .from(ndas)
      .innerJoin(users, eq(ndas.signerId, users.id))
      .where(eq(ndas.pitchId, pitchId))
      .orderBy(desc(ndas.signedAt));
      
      return ndaRecords;
    } catch (error) {
      console.error('Error fetching pitch NDAs:', error);
      throw error;
    }
  }
  
  // Revoke NDA access
  static async revokeAccess(ndaId: number, ownerId: number) {
    try {
      // Get NDA details
      const [nda] = await db.select({
        nda: ndas,
        pitch: pitches,
      })
      .from(ndas)
      .innerJoin(pitches, eq(ndas.pitchId, pitches.id))
      .where(and(
        eq(ndas.id, ndaId),
        eq(pitches.userId, ownerId)
      ))
      .limit(1);
      
      if (!nda) {
        throw new Error('NDA not found or unauthorized');
      }
      
      // Revoke access
      await db.update(ndas)
        .set({
          accessGranted: false,
          accessRevokedAt: new Date(),
        })
        .where(eq(ndas.id, ndaId));
      
      // Create notification for signer
      await db.insert(notifications).values({
        userId: nda.nda.signerId,
        type: 'nda_revoked',
        title: 'NDA Access Revoked',
        message: `Access to "${nda.pitch.title}" has been revoked`,
        relatedPitchId: nda.pitch.id,
        relatedUserId: ownerId,
      });
      
      return { success: true, message: 'NDA access revoked' };
    } catch (error) {
      console.error('Error revoking NDA access:', error);
      throw error;
    }
  }
  
  // Sign NDA directly (without request)
  static async signNDA(data: z.infer<typeof signNDASchema>) {
    try {
      const validatedData = signNDASchema.parse(data);
      
      // Check if already signed
      const existing = await db.select().from(ndas)
        .where(and(
          eq(ndas.pitchId, validatedData.pitchId),
          eq(ndas.signerId, validatedData.signerId)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        throw new Error('NDA already signed for this pitch');
      }
      
      // Create NDA record
      const [nda] = await db.insert(ndas).values({
        ...validatedData,
        signedAt: new Date(),
        accessGranted: true,
      }).returning();
      
      // Increment NDA count
      await db.update(pitches)
        .set({
          ndaCount: sql`${pitches.ndaCount} + 1`,
        })
        .where(eq(pitches.id, validatedData.pitchId));
      
      // Get pitch details for notification
      const [pitch] = await db.select().from(pitches)
        .where(eq(pitches.id, validatedData.pitchId))
        .limit(1);
      
      // Notify pitch owner
      await db.insert(notifications).values({
        userId: pitch.userId,
        type: 'nda_signed',
        title: 'New NDA Signed',
        message: `Someone signed an NDA for "${pitch.title}"`,
        relatedPitchId: validatedData.pitchId,
        relatedUserId: validatedData.signerId,
      });
      
      return nda;
    } catch (error) {
      console.error('Error signing NDA:', error);
      throw error;
    }
  }
  
  // Get NDA statistics for a user
  static async getUserNDAStats(userId: number) {
    try {
      const [stats] = await db.select({
        totalRequests: sql<number>`COUNT(DISTINCT ${ndaRequests.id})`,
        pendingRequests: sql<number>`COUNT(DISTINCT CASE WHEN ${ndaRequests.status} = 'pending' THEN ${ndaRequests.id} END)`,
        approvedRequests: sql<number>`COUNT(DISTINCT CASE WHEN ${ndaRequests.status} = 'approved' THEN ${ndaRequests.id} END)`,
        rejectedRequests: sql<number>`COUNT(DISTINCT CASE WHEN ${ndaRequests.status} = 'rejected' THEN ${ndaRequests.id} END)`,
        signedNDAs: sql<number>`(SELECT COUNT(*) FROM ${ndas} WHERE ${ndas.signerId} = ${userId})`,
      })
      .from(ndaRequests)
      .where(or(
        eq(ndaRequests.requesterId, userId),
        eq(ndaRequests.ownerId, userId)
      ));
      
      return stats;
    } catch (error) {
      console.error('Error fetching NDA stats:', error);
      throw error;
    }
  }
}

export default NDAService;