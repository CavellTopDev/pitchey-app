import { db } from "../db/client.ts";
import { ndas, ndaRequests, pitches, users, notifications } from "../db/schema.ts";
import { eq, and, desc, sql, lt, gte } from "npm:drizzle-orm";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { jsPDF } from "npm:jspdf";

export const CreateNDARequestSchema = z.object({
  pitchId: z.number(),
  ndaType: z.enum(["basic", "enhanced", "custom"]).default("basic"),
  requestMessage: z.string().optional(),
  companyInfo: z.object({
    companyName: z.string(),
    position: z.string(),
    intendedUse: z.string(),
  }).optional(),
  customNdaUrl: z.string().optional(),
});

export const RespondToNDARequestSchema = z.object({
  requestId: z.number(),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().optional(),
});

export class NDAService {
  static async createRequest(requesterId: number, data: z.infer<typeof CreateNDARequestSchema>) {
    const validated = CreateNDARequestSchema.parse(data);
    
    // Get pitch and owner info - use simple select instead of relations
    const pitchResult = await db
      .select({
        pitch: pitches,
        creator: users
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
      .where(eq(pitches.id, validated.pitchId));
    
    if (!pitchResult.length || !pitchResult[0].pitch) {
      throw new Error("Pitch not found");
    }
    
    const pitch = pitchResult[0].pitch;
    const creator = pitchResult[0].creator;
    
    if (!creator) {
      throw new Error("Pitch creator not found");
    }
    
    if (creator.id === requesterId) {
      throw new Error("Cannot request NDA for your own pitch");
    }
    
    // Check if request already exists - use simple select
    const existingRequestResult = await db
      .select()
      .from(ndaRequests)
      .where(and(
        eq(ndaRequests.pitchId, validated.pitchId),
        eq(ndaRequests.requesterId, requesterId)
      ))
      .limit(1);
    
    if (existingRequestResult.length > 0 && existingRequestResult[0].status === "pending") {
      throw new Error("NDA request already pending");
    }
    
    // Check if user already has signed NDA - use simple select
    const existingNDAResult = await db
      .select()
      .from(ndas)
      .where(and(
        eq(ndas.pitchId, validated.pitchId),
        eq(ndas.signerId, requesterId)
      ))
      .limit(1);
    
    if (existingNDAResult.length > 0 && existingNDAResult[0].accessGranted) {
      throw new Error("NDA already signed");
    }
    
    // Create the request
    const [request] = await db.insert(ndaRequests)
      .values({
        pitchId: validated.pitchId,
        requesterId,
        ownerId: creator.id,
        requestMessage: validated.requestMessage,
        companyInfo: validated.companyInfo,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();
    
    // Create notification for pitch owner
    await db.insert(notifications).values({
      userId: creator.id,
      type: "nda_request",
      title: "New NDA Request",
      message: `Someone requested access to your pitch "${pitch.title}"`,
      relatedPitchId: validated.pitchId,
      relatedUserId: requesterId,
      relatedNdaRequestId: request.id,
      actionUrl: `/dashboard/nda-requests/${request.id}`,
    });
    
    return request;
  }
  
  static async getRequestsForOwner(ownerId: number) {
    try {
      return await db.query.ndaRequests.findMany({
        where: eq(ndaRequests.ownerId, ownerId),
        orderBy: [desc(ndaRequests.requestedAt)],
        with: {
          pitch: {
            columns: {
              id: true,
              title: true,
            },
          },
          requester: {
            columns: {
              id: true,
              username: true,
              email: true,
              companyName: true,
              userType: true,
            },
          },
        },
      });
    } catch (error) {
      console.log("NDA requests table not available or error:", error);
      // Return empty array as fallback
      return [];
    }
  }
  
  static async getRequestsForRequester(requesterId: number) {
    return await db.query.ndaRequests.findMany({
      where: eq(ndaRequests.requesterId, requesterId),
      orderBy: [desc(ndaRequests.requestedAt)],
      with: {
        pitch: {
          columns: {
            id: true,
            title: true,
          },
        },
        owner: {
          columns: {
            id: true,
            username: true,
            companyName: true,
          },
        },
      },
    });
  }
  
  static async respondToRequest(ownerId: number, data: z.infer<typeof RespondToNDARequestSchema>) {
    const validated = RespondToNDARequestSchema.parse(data);
    
    // Get the request
    const request = await db.query.ndaRequests.findFirst({
      where: and(
        eq(ndaRequests.id, validated.requestId),
        eq(ndaRequests.ownerId, ownerId)
      ),
      with: {
        pitch: true,
        requester: true,
      },
    });
    
    if (!request) {
      throw new Error("NDA request not found or unauthorized");
    }
    
    if (request.status !== "pending") {
      throw new Error("Request has already been responded to");
    }
    
    // Update request status
    const [updatedRequest] = await db.update(ndaRequests)
      .set({
        status: validated.action === "approve" ? "approved" : "rejected",
        rejectionReason: validated.rejectionReason,
        respondedAt: new Date(),
      })
      .where(eq(ndaRequests.id, validated.requestId))
      .returning();
    
    if (validated.action === "approve") {
      // Create NDA record
      await db.insert(ndas).values({
        pitchId: request.pitchId,
        signerId: request.requesterId,
        ndaType: request.ndaType,
        accessGranted: true,
        // Set expiration to 1 year from now
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      
      // Update pitch NDA count
      await db.update(pitches)
        .set({
          ndaCount: sql`${pitches.ndaCount} + 1`,
        })
        .where(eq(pitches.id, request.pitchId));
    }
    
    // Create notification for requester
    await db.insert(notifications).values({
      userId: request.requesterId,
      type: validated.action === "approve" ? "nda_approved" : "nda_rejected",
      title: `NDA ${validated.action === "approve" ? "Approved" : "Rejected"}`,
      message: `Your NDA request for "${request.pitch.title}" has been ${validated.action}d`,
      relatedPitchId: request.pitchId,
      relatedUserId: ownerId,
      relatedNdaRequestId: request.id,
      actionUrl: validated.action === "approve" ? `/pitch/${request.pitchId}` : "/dashboard/nda-requests",
    });
    
    return updatedRequest;
  }
  
  static async getUserNDAs(userId: number) {
    try {
      return await db.query.ndas.findMany({
        where: eq(ndas.signerId, userId),
        orderBy: [desc(ndas.signedAt)],
        with: {
          pitch: {
            columns: {
              id: true,
              title: true,
              status: true,
            },
            with: {
              creator: {
                columns: {
                  username: true,
                  companyName: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.log("NDAs table not available or error:", error);
      // Return empty array as fallback
      return [];
    }
  }
  
  static async checkNDAAccess(pitchId: number, userId: number) {
    // Check if user is the pitch owner
    const pitch = await db.query.pitches.findFirst({
      where: eq(pitches.id, pitchId),
      columns: {
        userId: true,
      },
    });
    
    if (!pitch) {
      return { hasAccess: false, reason: "Pitch not found" };
    }
    
    if (pitch.userId === userId) {
      return { hasAccess: true, reason: "Owner" };
    }
    
    // Check for valid NDA
    const nda = await db.query.ndas.findFirst({
      where: and(
        eq(ndas.pitchId, pitchId),
        eq(ndas.signerId, userId),
        eq(ndas.accessGranted, true)
      ),
    });
    
    if (!nda) {
      return { hasAccess: false, reason: "No NDA signed" };
    }
    
    if (nda.expiresAt && new Date() > nda.expiresAt) {
      return { hasAccess: false, reason: "NDA expired" };
    }
    
    return { hasAccess: true, reason: "Valid NDA" };
  }
  
  static async signBasicNDA(pitchId: number, signerId: number) {
    // Check if NDA already exists
    const existing = await db.query.ndas.findFirst({
      where: and(
        eq(ndas.pitchId, pitchId),
        eq(ndas.signerId, signerId)
      ),
    });
    
    if (existing) {
      return existing;
    }
    
    // Create NDA record
    const [nda] = await db.insert(ndas)
      .values({
        pitchId,
        signerId,
        ndaType: "basic",
        accessGranted: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      })
      .returning();
    
    // Update pitch NDA count
    await db.update(pitches)
      .set({
        ndaCount: sql`${pitches.ndaCount} + 1`,
      })
      .where(eq(pitches.id, pitchId));
    
    return nda;
  }
  
  static async revokeAccess(pitchId: number, signerId: number, ownerId: number) {
    // Verify ownership
    const pitch = await db.query.pitches.findFirst({
      where: and(
        eq(pitches.id, pitchId),
        eq(pitches.userId, ownerId)
      ),
    });
    
    if (!pitch) {
      throw new Error("Pitch not found or unauthorized");
    }
    
    // Revoke access
    const [revokedNDA] = await db.update(ndas)
      .set({
        accessGranted: false,
        accessRevokedAt: new Date(),
      })
      .where(and(
        eq(ndas.pitchId, pitchId),
        eq(ndas.signerId, signerId)
      ))
      .returning();
    
    if (revokedNDA) {
      // Create notification
      await db.insert(notifications).values({
        userId: signerId,
        type: "nda_revoked",
        title: "NDA Access Revoked",
        message: `Your access to "${pitch.title}" has been revoked`,
        relatedPitchId: pitchId,
        relatedUserId: ownerId,
      });
    }
    
    return revokedNDA;
  }

  static async generateNDAPDF(ndaId: number) {
    const nda = await db.query.ndas.findFirst({
      where: eq(ndas.id, ndaId),
      with: {
        pitch: {
          with: {
            creator: true,
          },
        },
        signer: true,
      },
    });

    if (!nda) {
      throw new Error("NDA not found");
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.text("NON-DISCLOSURE AGREEMENT", 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Project: ${nda.pitch.title}`, 20, 40);
    doc.text(`Creator: ${nda.pitch.creator.username}`, 20, 50);
    doc.text(`Signer: ${nda.signer.username}`, 20, 60);
    doc.text(`NDA Type: ${nda.ndaType.toUpperCase()}`, 20, 70);
    doc.text(`Signed: ${nda.signedAt?.toLocaleDateString() || 'Pending'}`, 20, 80);
    doc.text(`Expires: ${nda.expiresAt?.toLocaleDateString() || 'No expiration'}`, 20, 90);
    
    // Standard NDA text based on type
    let ndaText = "";
    
    if (nda.ndaType === "basic") {
      ndaText = `
BASIC NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into between:

Disclosing Party: ${nda.pitch.creator.username}
Receiving Party: ${nda.signer.username}

Regarding the film project: "${nda.pitch.title}"

1. CONFIDENTIAL INFORMATION
The Receiving Party acknowledges that they may receive confidential information including but not limited to:
- Project synopsis and treatment
- Production details and timeline
- Marketing and distribution plans
- Financial information

2. OBLIGATIONS
The Receiving Party agrees to:
- Keep all information strictly confidential
- Not disclose information to third parties
- Use information solely for evaluation purposes
- Return or destroy all materials upon request

3. TERM
This agreement remains in effect for 2 years from the date of signing.

4. GOVERNING LAW
This agreement is governed by applicable state and federal laws.`;
    } else if (nda.ndaType === "enhanced") {
      ndaText = `
ENHANCED NON-DISCLOSURE AGREEMENT

This Enhanced Non-Disclosure Agreement provides access to detailed financial and production information.

All terms of the Basic NDA apply, plus additional protections for:
- Detailed budget breakdowns
- Investor information
- Distribution agreements
- Revenue projections
- Cast and crew contracts

Enhanced penalties apply for breach of this agreement.
Term: 3 years from signing date.`;
    }
    
    // Add text content
    const lines = doc.splitTextToSize(ndaText, 170);
    doc.text(lines, 20, 110);
    
    // Signature section
    const yPos = 110 + (lines.length * 5) + 20;
    doc.text("Digital Signature:", 20, yPos);
    doc.text(`Signed by: ${nda.signer.username}`, 20, yPos + 10);
    doc.text(`Date: ${nda.signedAt?.toLocaleDateString() || new Date().toLocaleDateString()}`, 20, yPos + 20);
    doc.text(`NDA ID: ${nda.id}`, 20, yPos + 30);
    
    return doc.output('arraybuffer');
  }

  static async getExpiredNDAs() {
    return await db.query.ndas.findMany({
      where: and(
        eq(ndas.accessGranted, true),
        lt(ndas.expiresAt, new Date())
      ),
      with: {
        pitch: {
          columns: {
            id: true,
            title: true,
          },
        },
        signer: {
          columns: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  static async revokeExpiredNDAs() {
    const expiredNDAs = await this.getExpiredNDAs();
    
    for (const nda of expiredNDAs) {
      await db.update(ndas)
        .set({
          accessGranted: false,
          accessRevokedAt: new Date(),
        })
        .where(eq(ndas.id, nda.id));
      
      // Create notification
      await db.insert(notifications).values({
        userId: nda.signer.id,
        type: "nda_expired",
        title: "NDA Access Expired",
        message: `Your NDA access to "${nda.pitch.title}" has expired`,
        relatedPitchId: nda.pitchId,
      });
    }
    
    return expiredNDAs.length;
  }

  static async getNDAStats(userId: number) {
    try {
      // Get stats for pitch owner
      const requestCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(ndaRequests)
        .where(eq(ndaRequests.ownerId, userId));
      
      const signedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(ndas)
        .innerJoin(pitches, eq(ndas.pitchId, pitches.id))
        .where(and(
          eq(pitches.userId, userId),
          eq(ndas.accessGranted, true)
        ));
      
      const pendingCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(ndaRequests)
        .where(and(
          eq(ndaRequests.ownerId, userId),
          eq(ndaRequests.status, "pending")
        ));
      
      return {
        totalRequests: requestCount[0]?.count || 0,
        totalSigned: signedCount[0]?.count || 0,
        pendingRequests: pendingCount[0]?.count || 0,
      };
    } catch (error) {
      console.log("NDA stats error:", error);
      // Return default stats if tables don't exist
      return {
        totalRequests: 0,
        totalSigned: 0,
        pendingRequests: 0,
      };
    }
  }

  static async getProtectedContentAccess(pitchId: number, userId: number) {
    const accessCheck = await this.checkNDAAccess(pitchId, userId);
    
    if (!accessCheck.hasAccess) {
      return {
        hasAccess: false,
        reason: accessCheck.reason,
        protectedFields: [
          'budget',
          'financialProjections',
          'script',
          'contactInfo',
          'distributionStrategy',
          'attachedTalent',
          'marketingPlan'
        ]
      };
    }

    // Get NDA type to determine access level
    const nda = await db.query.ndas.findFirst({
      where: and(
        eq(ndas.pitchId, pitchId),
        eq(ndas.signerId, userId),
        eq(ndas.accessGranted, true)
      ),
    });

    const accessLevel = nda?.ndaType || 'basic';
    let protectedFields: string[] = [];
    
    if (accessLevel === 'basic') {
      // Basic NDA still protects sensitive financial data
      protectedFields = ['budget', 'financialProjections', 'script'];
    } else if (accessLevel === 'enhanced') {
      // Enhanced NDA gives access to everything
      protectedFields = [];
    }

    return {
      hasAccess: true,
      accessLevel,
      protectedFields,
      nda
    };
  }

  // Alias methods for compatibility with Oak server
  static async requestNDA(data: any) {
    return await this.createRequest(data.requesterId, data);
  }

  static async approveNDARequest(requestId: number, ownerId: number) {
    return await this.respondToRequest(ownerId, {
      requestId,
      status: "approved",
      rejectionReason: undefined
    });
  }

  static async rejectNDARequest(requestId: number, ownerId: number, reason?: string) {
    return await this.respondToRequest(ownerId, {
      requestId,
      status: "rejected",
      rejectionReason: reason
    });
  }

  static async signNDA(ndaId: number, signerId: number, signatureData?: any) {
    // For now, use the basic NDA signing - this could be extended
    // to handle custom NDAs based on the ndaId
    const nda = await db.query.ndas.findFirst({
      where: eq(ndas.id, ndaId),
      with: {
        pitch: true
      }
    });

    if (!nda) {
      throw new Error("NDA not found");
    }

    return await this.signBasicNDA(nda.pitchId, signerId);
  }
}