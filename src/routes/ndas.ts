/**
 * NDA Routes Module - Non-Disclosure Agreement Management
 */

import { RouteHandler } from "../router/types.ts";
import { getCorsHeaders, getSecurityHeaders, successResponse, errorResponse } from "../utils/response.ts";
import { telemetry } from "../utils/telemetry.ts";
import { db } from "../db/client.ts";
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
    const pitchResults = await db.execute(`
      SELECT id, user_id FROM pitches WHERE id = $1
    `, [pitch_id]);

    if (pitchResults.rows.length === 0) {
      return errorResponse("Pitch not found", 404);
    }

    const pitch = pitchResults.rows[0];

    // Check if user is trying to request NDA for their own pitch
    if (pitch.user_id === user.userId) {
      return errorResponse("Cannot request NDA for your own pitch", 400);
    }

    // Check if NDA request already exists
    const existingNda = await db.execute(`
      SELECT id FROM ndas 
      WHERE pitch_id = $1 AND requester_id = $2
    `, [pitch_id, user.userId]);

    if (existingNda.rows.length > 0) {
      return errorResponse("NDA request already exists for this pitch", 409);
    }

    // Create NDA request
    const newNda = await db.execute(`
      INSERT INTO ndas (pitch_id, requester_id, pitch_owner_id, status, requested_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [pitch_id, user.userId, pitch.user_id, "pending"]);

    // Get pitch and user details for email
    const [pitchDetails, requesterDetails, ownerDetails] = await Promise.all([
      db.execute(`SELECT title FROM pitches WHERE id = $1`, [pitch_id]),
      db.execute(`SELECT first_name, email FROM users WHERE id = $1`, [user.userId]),
      db.execute(`SELECT first_name, email FROM users WHERE id = $1`, [pitch.user_id])
    ]);

    // Send NDA request email notification
    try {
      const shouldSend = await shouldSendEmail(pitch.user_id.toString(), 'nda_requests');
      if (shouldSend && pitchDetails.rows[0] && requesterDetails.rows[0] && ownerDetails.rows[0]) {
        const unsubscribeUrl = await getUnsubscribeUrl(
          pitch.user_id.toString(), 
          ownerDetails.rows[0].email, 
          'nda_requests'
        );

        const emailQueue = getEmailQueueService();
        await emailQueue.queueEmail({
          to: ownerDetails.rows[0].email,
          subject: `New NDA Request for "${pitchDetails.rows[0].title}"`,
          html: '', // Will be populated by template engine
          text: '',
          trackingId: `nda-request-${newNda.rows[0].id}-${Date.now()}`,
          unsubscribeUrl,
        }, { priority: 'normal' });

        telemetry.logger.info("NDA request email queued", { 
          ndaId: newNda.rows[0].id, 
          recipientEmail: ownerDetails.rows[0].email 
        });
      }
    } catch (emailError) {
      telemetry.logger.error("Failed to send NDA request email", emailError);
      // Don't fail the request if email fails
    }

    telemetry.logger.info("NDA requested", { 
      ndaId: newNda.rows[0].id,
      pitchId: pitch_id,
      requesterId: user.userId,
      ownerId: pitch.user_id 
    });

    return successResponse({
      nda: newNda.rows[0],
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
    const ndaResults = await db.execute(`
      SELECT * FROM ndas WHERE id = $1
    `, [parseInt(ndaId)]);

    if (ndaResults.rows.length === 0) {
      return errorResponse("NDA request not found", 404);
    }

    const nda = ndaResults.rows[0];

    // Check if user owns the pitch
    if (nda.pitch_owner_id !== user.userId) {
      return errorResponse("Only pitch owner can respond to NDA requests", 403);
    }

    // Check if already responded
    if (nda.status !== "pending") {
      return errorResponse(`NDA request has already been ${nda.status}`, 400);
    }

    // Update NDA status
    const status = action === "approve" ? "approved" : "rejected";
    let updateQuery = `
      UPDATE ndas 
      SET status = $1, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    `;
    let updateParams = [status];

    if (action === "approve") {
      updateQuery += `, signed_at = CURRENT_TIMESTAMP`;
    } else if (rejection_reason) {
      updateQuery += `, rejection_reason = $${updateParams.length + 1}`;
      updateParams.push(rejection_reason);
    }

    updateQuery += ` WHERE id = $${updateParams.length + 1} RETURNING *`;
    updateParams.push(parseInt(ndaId));

    const updatedNda = await db.execute(updateQuery, updateParams);

    // Send NDA response email to requester
    try {
      const [pitchDetails, requesterDetails] = await Promise.all([
        db.execute(`SELECT title FROM pitches WHERE id = $1`, [nda.pitch_id]),
        db.execute(`SELECT first_name, email FROM users WHERE id = $1`, [nda.requester_id])
      ]);

      const shouldSend = await shouldSendEmail(nda.requester_id.toString(), 'nda_responses');
      if (shouldSend && pitchDetails.rows[0] && requesterDetails.rows[0]) {
        const unsubscribeUrl = await getUnsubscribeUrl(
          nda.requester_id.toString(), 
          requesterDetails.rows[0].email, 
          'nda_responses'
        );

        const emailQueue = getEmailQueueService();
        await emailQueue.queueEmail({
          to: requesterDetails.rows[0].email,
          subject: `NDA Request ${status === "approved" ? "Approved" : "Declined"} - "${pitchDetails.rows[0].title}"`,
          html: '', // Will be populated by template engine
          text: '',
          trackingId: `nda-response-${nda.id}-${Date.now()}`,
          unsubscribeUrl,
        }, { priority: 'high' });

        telemetry.logger.info("NDA response email queued", { 
          ndaId: parseInt(ndaId), 
          action,
          recipientEmail: requesterDetails.rows[0].email 
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
      nda: updatedNda.rows[0],
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

    let whereClause = "";
    let params = [user.userId];

    // Filter by type (sent/received)
    if (type === "sent") {
      whereClause = "n.requester_id = $1";
    } else if (type === "received") {
      whereClause = "n.pitch_owner_id = $1";
    } else {
      // All NDAs for this user
      whereClause = "(n.requester_id = $1 OR n.pitch_owner_id = $1)";
    }

    // Filter by status
    if (status) {
      whereClause += ` AND n.status = $${params.length + 1}`;
      params.push(status);
    }

    // Get NDAs with related information
    const ndaResults = await db.execute(`
      SELECT 
        n.id,
        n.pitch_id,
        n.requester_id,
        n.pitch_owner_id,
        n.status,
        n.requested_at,
        n.responded_at,
        n.signed_at,
        n.rejection_reason,
        n.created_at,
        p.title as pitch_title,
        requester.first_name as requester_name,
        owner.first_name as owner_name
      FROM ndas n
      LEFT JOIN pitches p ON n.pitch_id = p.id
      LEFT JOIN users requester ON n.requester_id = requester.id
      LEFT JOIN users owner ON n.pitch_owner_id = owner.id
      WHERE ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM ndas n WHERE ${whereClause}
    `, params);

    const total = totalResult.rows[0]?.count || 0;

    return successResponse({
      ndas: ndaResults.rows,
      filters: { type, status },
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        hasMore: offset + limit < parseInt(total)
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
    const ndaResults = await db.execute(`
      SELECT 
        n.id,
        n.pitch_id,
        n.requester_id,
        n.pitch_owner_id,
        n.status,
        n.requested_at,
        n.responded_at,
        n.signed_at,
        n.rejection_reason,
        n.created_at,
        p.title as pitch_title,
        p.logline as pitch_logline,
        requester.first_name as requester_name,
        requester.email as requester_email,
        owner.first_name as owner_name,
        owner.email as owner_email
      FROM ndas n
      LEFT JOIN pitches p ON n.pitch_id = p.id
      LEFT JOIN users requester ON n.requester_id = requester.id
      LEFT JOIN users owner ON n.pitch_owner_id = owner.id
      WHERE n.id = $1
    `, [parseInt(ndaId)]);

    if (ndaResults.rows.length === 0) {
      return errorResponse("NDA not found", 404);
    }

    const nda = ndaResults.rows[0];

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
    const sentStats = await db.execute(`
      SELECT 
        count(*) as total,
        sum(case when status = 'pending' then 1 else 0 end) as pending,
        sum(case when status = 'approved' then 1 else 0 end) as approved,
        sum(case when status = 'rejected' then 1 else 0 end) as rejected
      FROM ndas WHERE requester_id = $1
    `, [user.userId]);

    const receivedStats = await db.execute(`
      SELECT 
        count(*) as total,
        sum(case when status = 'pending' then 1 else 0 end) as pending,
        sum(case when status = 'approved' then 1 else 0 end) as approved,
        sum(case when status = 'rejected' then 1 else 0 end) as rejected
      FROM ndas WHERE pitch_owner_id = $1
    `, [user.userId]);

    const stats = {
      sent: sentStats.rows[0] || { total: 0, pending: 0, approved: 0, rejected: 0 },
      received: receivedStats.rows[0] || { total: 0, pending: 0, approved: 0, rejected: 0 },
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
    const ndaResults = await db.execute(`
      SELECT 
        id,
        status,
        requested_at,
        responded_at,
        signed_at,
        rejection_reason
      FROM ndas
      WHERE pitch_id = $1 AND requester_id = $2
    `, [parseInt(pitchId), user.userId]);

    if (ndaResults.rows.length === 0) {
      return successResponse({
        has_nda: false,
        can_request: true,
        nda: null
      });
    }

    const nda = ndaResults.rows[0];

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