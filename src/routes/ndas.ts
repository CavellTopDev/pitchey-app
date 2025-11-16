/**
 * NDA Routes Module - Non-Disclosure Agreement Management
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
import { ndas, pitches, users, companies } from "../db/schema.ts";
import { eq, and, sql, desc, or } from "npm:drizzle-orm@0.35.3";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { validateEnvironment } from "../utils/env-validation.ts";
import { sendNDARequestEmail, sendNDAResponseEmail } from "../services/email/index.ts";
import { getEmailQueueService } from "../services/email/queue-service.ts";
import { getUnsubscribeUrl, shouldSendEmail } from "../services/email/unsubscribe-service.ts";

const envConfig = validateEnvironment();
const JWT_SECRET = envConfig.JWT_SECRET;

// Middleware to extract user from JWT token
async function getUserFromToken(request: Request): Promise<any> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No token provided");
  }

  const token = authHeader.slice(7);
  const payload = await verify(
    token,
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )
  );

  return payload;
}

// Request NDA for a pitch
export const requestNda: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const { pitch_id } = await request.json();

    if (!pitch_id) {
      return errorResponse("Pitch ID is required", 400);
    }

    // Check if pitch exists
    const pitchResults = await db
      .select({ id: pitches.id, user_id: pitches.user_id })
      .from(pitches)
      .where(eq(pitches.id, pitch_id));

    if (pitchResults.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    const pitch = pitchResults[0];

    // Check if user is trying to request NDA for their own pitch
    if (pitch.user_id === user.userId) {
      return errorResponse("Cannot request NDA for your own pitch", 400);
    }

    // Check if NDA request already exists
    const existingNda = await db
      .select({ id: ndas.id })
      .from(ndas)
      .where(
        and(
          eq(ndas.pitch_id, pitch_id),
          eq(ndas.requester_id, user.userId)
        )
      );

    if (existingNda.length > 0) {
      return errorResponse("NDA request already exists for this pitch", 409);
    }

    // Create NDA request
    const newNda = await db
      .insert(ndas)
      .values({
        pitch_id,
        requester_id: user.userId,
        pitch_owner_id: pitch.user_id,
        status: "pending",
        requested_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    // Get pitch and user details for email
    const [pitchDetails, requesterDetails, ownerDetails] = await Promise.all([
      db.select({ title: pitches.title }).from(pitches).where(eq(pitches.id, pitch_id)),
      db.select({ firstName: users.firstName, email: users.email }).from(users).where(eq(users.id, user.userId)),
      db.select({ firstName: users.firstName, email: users.email }).from(users).where(eq(users.id, pitch.user_id))
    ]);

    // Send NDA request email notification
    try {
      const shouldSend = await shouldSendEmail(pitch.user_id.toString(), 'nda_requests');
      if (shouldSend && pitchDetails[0] && requesterDetails[0] && ownerDetails[0]) {
        const unsubscribeUrl = await getUnsubscribeUrl(
          pitch.user_id.toString(), 
          ownerDetails[0].email, 
          'nda_requests'
        );

        const emailQueue = getEmailQueueService();
        await emailQueue.queueEmail({
          to: ownerDetails[0].email,
          subject: `New NDA Request for "${pitchDetails[0].title}"`,
          html: '', // Will be populated by template engine
          text: '',
          trackingId: `nda-request-${newNda[0].id}-${Date.now()}`,
          unsubscribeUrl,
        }, { priority: 'normal' });

        telemetry.logger.info("NDA request email queued", { 
          ndaId: newNda[0].id, 
          recipientEmail: ownerDetails[0].email 
        });
      }
    } catch (emailError) {
      telemetry.logger.error("Failed to send NDA request email", emailError);
      // Don't fail the request if email fails
    }

    telemetry.logger.info("NDA requested", { 
      ndaId: newNda[0].id,
      pitchId: pitch_id,
      requesterId: user.userId,
      ownerId: pitch.user_id 
    });

    return successResponse({
      nda: newNda[0],
      message: "NDA request submitted successfully"
    });

  } catch (error) {
    telemetry.logger.error("Request NDA error", error);
    return errorResponse("Failed to request NDA", 500);
  }
};

// Approve or reject NDA request
export const respondToNdaRequest: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const ndaId = params?.id;
    const { action, rejection_reason } = await request.json();

    if (!ndaId) {
      return errorResponse("NDA ID is required", 400);
    }

    if (!action || !["approve", "reject"].includes(action)) {
      return errorResponse("Valid action (approve/reject) is required", 400);
    }

    // Get NDA request
    const ndaResults = await db
      .select()
      .from(ndas)
      .where(eq(ndas.id, parseInt(ndaId)));

    if (ndaResults.length === 0) {
      return errorResponse("NDA request not found", 404);
    }

    const nda = ndaResults[0];

    // Check if user owns the pitch
    if (nda.pitch_owner_id !== user.userId) {
      return errorResponse("Only pitch owner can respond to NDA requests", 403);
    }

    // Check if already responded
    if (nda.status !== "pending") {
      return errorResponse(`NDA request has already been ${nda.status}`, 400);
    }

    // Update NDA status
    const updateData: any = {
      status: action === "approve" ? "approved" : "rejected",
      responded_at: new Date(),
      updated_at: new Date(),
    };

    if (action === "approve") {
      updateData.signed_at = new Date();
    } else if (rejection_reason) {
      updateData.rejection_reason = rejection_reason;
    }

    const updatedNda = await db
      .update(ndas)
      .set(updateData)
      .where(eq(ndas.id, parseInt(ndaId)))
      .returning();

    // Send NDA response email to requester
    try {
      const [pitchDetails, requesterDetails] = await Promise.all([
        db.select({ title: pitches.title }).from(pitches).where(eq(pitches.id, nda.pitch_id)),
        db.select({ firstName: users.firstName, email: users.email }).from(users).where(eq(users.id, nda.requester_id))
      ]);

      const shouldSend = await shouldSendEmail(nda.requester_id.toString(), 'nda_responses');
      if (shouldSend && pitchDetails[0] && requesterDetails[0]) {
        const unsubscribeUrl = await getUnsubscribeUrl(
          nda.requester_id.toString(), 
          requesterDetails[0].email, 
          'nda_responses'
        );

        const emailQueue = getEmailQueueService();
        const status = action === "approve" ? "approved" : "rejected";
        await emailQueue.queueEmail({
          to: requesterDetails[0].email,
          subject: `NDA Request ${status === "approved" ? "Approved" : "Declined"} - "${pitchDetails[0].title}"`,
          html: '', // Will be populated by template engine
          text: '',
          trackingId: `nda-response-${nda.id}-${Date.now()}`,
          unsubscribeUrl,
        }, { priority: 'high' });

        telemetry.logger.info("NDA response email queued", { 
          ndaId: parseInt(ndaId), 
          action,
          recipientEmail: requesterDetails[0].email 
        });
      }
    } catch (emailError) {
      telemetry.logger.error("Failed to send NDA response email", emailError);
      // Don't fail the response if email fails
    }

    telemetry.logger.info(`NDA ${action}d`, { 
      ndaId: parseInt(ndaId),
      action,
      responderId: user.userId 
    });

    return successResponse({
      nda: updatedNda[0],
      message: `NDA request ${action}d successfully`
    });

  } catch (error) {
    telemetry.logger.error("Respond to NDA request error", error);
    return errorResponse("Failed to respond to NDA request", 500);
  }
};

// Get user's NDA requests (both sent and received)
export const getUserNdaRequests: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);
    const type = url.searchParams.get("type") || "all"; // all, sent, received
    const status = url.searchParams.get("status"); // pending, approved, rejected
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let whereConditions = [];

    // Filter by type (sent/received)
    if (type === "sent") {
      whereConditions.push(eq(ndas.requester_id, user.userId));
    } else if (type === "received") {
      whereConditions.push(eq(ndas.pitch_owner_id, user.userId));
    } else {
      // All NDAs for this user
      whereConditions.push(
        or(
          eq(ndas.requester_id, user.userId),
          eq(ndas.pitch_owner_id, user.userId)
        )
      );
    }

    // Filter by status
    if (status) {
      whereConditions.push(eq(ndas.status, status));
    }

    // Get NDAs with related information
    const ndaResults = await db
      .select({
        id: ndas.id,
        pitch_id: ndas.pitch_id,
        requester_id: ndas.requester_id,
        pitch_owner_id: ndas.pitch_owner_id,
        status: ndas.status,
        requested_at: ndas.requested_at,
        responded_at: ndas.responded_at,
        signed_at: ndas.signed_at,
        rejection_reason: ndas.rejection_reason,
        created_at: ndas.created_at,
        pitch_title: pitches.title,
        requester_name: sql<string>`requester.name`,
        owner_name: sql<string>`owner.name`,
      })
      .from(ndas)
      .leftJoin(pitches, eq(ndas.pitch_id, pitches.id))
      .leftJoin(users.as("requester"), eq(ndas.requester_id, sql`requester.id`))
      .leftJoin(users.as("owner"), eq(ndas.pitch_owner_id, sql`owner.id`))
      .where(and(...whereConditions))
      .orderBy(desc(ndas.created_at))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ndas)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return successResponse({
      ndas: ndaResults,
      filters: { type, status },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    telemetry.logger.error("Get user NDA requests error", error);
    return errorResponse("Failed to fetch NDA requests", 500);
  }
};

// Get NDA details by ID
export const getNdaById: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const ndaId = params?.id;

    if (!ndaId) {
      return errorResponse("NDA ID is required", 400);
    }

    // Get NDA with full details
    const ndaResults = await db
      .select({
        id: ndas.id,
        pitch_id: ndas.pitch_id,
        requester_id: ndas.requester_id,
        pitch_owner_id: ndas.pitch_owner_id,
        status: ndas.status,
        requested_at: ndas.requested_at,
        responded_at: ndas.responded_at,
        signed_at: ndas.signed_at,
        rejection_reason: ndas.rejection_reason,
        created_at: ndas.created_at,
        pitch_title: pitches.title,
        pitch_logline: pitches.logline,
        requester_name: sql<string>`requester.name`,
        requester_email: sql<string>`requester.email`,
        owner_name: sql<string>`owner.name`,
        owner_email: sql<string>`owner.email`,
      })
      .from(ndas)
      .leftJoin(pitches, eq(ndas.pitch_id, pitches.id))
      .leftJoin(users.as("requester"), eq(ndas.requester_id, sql`requester.id`))
      .leftJoin(users.as("owner"), eq(ndas.pitch_owner_id, sql`owner.id`))
      .where(eq(ndas.id, parseInt(ndaId)));

    if (ndaResults.length === 0) {
      return errorResponse("NDA not found", 404);
    }

    const nda = ndaResults[0];

    // Check if user has access to this NDA
    if (nda.requester_id !== user.userId && nda.pitch_owner_id !== user.userId) {
      return errorResponse("Access denied", 403);
    }

    return successResponse({ nda });

  } catch (error) {
    telemetry.logger.error("Get NDA by ID error", error);
    return errorResponse("Failed to fetch NDA", 500);
  }
};

// Get NDA statistics
export const getNdaStats: RouteHandler = async (request, url) => {
  try {
    const user = await getUserFromToken(request);

    // Get statistics for this user
    const sentStats = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`sum(case when ${ndas.status} = 'pending' then 1 else 0 end)`,
        approved: sql<number>`sum(case when ${ndas.status} = 'approved' then 1 else 0 end)`,
        rejected: sql<number>`sum(case when ${ndas.status} = 'rejected' then 1 else 0 end)`,
      })
      .from(ndas)
      .where(eq(ndas.requester_id, user.userId));

    const receivedStats = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`sum(case when ${ndas.status} = 'pending' then 1 else 0 end)`,
        approved: sql<number>`sum(case when ${ndas.status} = 'approved' then 1 else 0 end)`,
        rejected: sql<number>`sum(case when ${ndas.status} = 'rejected' then 1 else 0 end)`,
      })
      .from(ndas)
      .where(eq(ndas.pitch_owner_id, user.userId));

    const stats = {
      sent: sentStats[0] || { total: 0, pending: 0, approved: 0, rejected: 0 },
      received: receivedStats[0] || { total: 0, pending: 0, approved: 0, rejected: 0 },
    };

    return successResponse({ stats });

  } catch (error) {
    telemetry.logger.error("Get NDA stats error", error);
    return errorResponse("Failed to fetch NDA statistics", 500);
  }
};

// Check NDA status for a specific pitch
export const checkNdaStatus: RouteHandler = async (request, url, params) => {
  try {
    const user = await getUserFromToken(request);
    const pitchId = params?.pitchId;

    if (!pitchId) {
      return errorResponse("Pitch ID is required", 400);
    }

    // Check if NDA exists for this user and pitch
    const ndaResults = await db
      .select({
        id: ndas.id,
        status: ndas.status,
        requested_at: ndas.requested_at,
        responded_at: ndas.responded_at,
        signed_at: ndas.signed_at,
        rejection_reason: ndas.rejection_reason,
      })
      .from(ndas)
      .where(
        and(
          eq(ndas.pitch_id, parseInt(pitchId)),
          eq(ndas.requester_id, user.userId)
        )
      );

    if (ndaResults.length === 0) {
      return successResponse({
        has_nda: false,
        can_request: true,
        nda: null
      });
    }

    const nda = ndaResults[0];

    return successResponse({
      has_nda: true,
      can_request: false,
      nda: {
        id: nda.id,
        status: nda.status,
        requested_at: nda.requested_at,
        responded_at: nda.responded_at,
        signed_at: nda.signed_at,
        rejection_reason: nda.rejection_reason,
      }
    });

  } catch (error) {
    telemetry.logger.error("Check NDA status error", error);
    return errorResponse("Failed to check NDA status", 500);
  }
};