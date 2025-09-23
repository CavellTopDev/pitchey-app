import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { ndas, pitches, users } from "../../../src/db/schema.ts";
import { eq, desc, and, gte } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

export const handler: Handlers = {
  async GET(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get all signed NDAs for the user
      const signedNDAs = await db.select({
        id: ndas.id,
        pitchId: ndas.pitchId,
        pitchTitle: pitches.title,
        pitchGenre: pitches.genre,
        pitchFormat: pitches.format,
        creatorId: pitches.userId,
        creatorName: users.username,
        creatorCompany: users.companyName,
        creatorType: users.userType,
        ndaType: ndas.ndaType,
        signedAt: ndas.signedAt,
        expiresAt: ndas.expiresAt,
        accessGranted: ndas.accessGranted,
      })
      .from(ndas)
      .innerJoin(pitches, eq(ndas.pitchId, pitches.id))
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(and(
        eq(ndas.signerId, userId),
        eq(ndas.accessGranted, true)
      ))
      .orderBy(desc(ndas.signedAt));

      // Calculate time until expiration for each NDA
      const ndasWithExpiry = signedNDAs.map(nda => {
        const now = new Date();
        const expiresAt = nda.expiresAt ? new Date(nda.expiresAt) : null;
        
        let expiresIn = "Never";
        let isExpired = false;
        
        if (expiresAt) {
          if (expiresAt < now) {
            isExpired = true;
            expiresIn = "Expired";
          } else {
            const diffMs = expiresAt.getTime() - now.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffYears = Math.floor(diffDays / 365);
            const diffMonths = Math.floor((diffDays % 365) / 30);
            
            if (diffYears > 0) {
              expiresIn = `${diffYears} year${diffYears > 1 ? 's' : ''}`;
            } else if (diffMonths > 0) {
              expiresIn = `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
            } else {
              expiresIn = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
            }
          }
        }

        return {
          ...nda,
          expiresIn,
          isExpired,
          signedDate: getRelativeTime(new Date(nda.signedAt)),
        };
      });

      // Also get NDAs for pitches owned by the user (incoming NDAs)
      const userPitches = await db.select({ id: pitches.id })
        .from(pitches)
        .where(eq(pitches.userId, userId));
      
      const pitchIds = userPitches.map(p => p.id);
      
      let incomingSignedNDAs = [];
      if (pitchIds.length > 0) {
        const incoming = await db.select({
          id: ndas.id,
          pitchId: ndas.pitchId,
          pitchTitle: pitches.title,
          signerId: ndas.signerId,
          signerName: users.username,
          signerCompany: users.companyName,
          signerType: users.userType,
          ndaType: ndas.ndaType,
          signedAt: ndas.signedAt,
          expiresAt: ndas.expiresAt,
        })
        .from(ndas)
        .innerJoin(pitches, eq(ndas.pitchId, pitches.id))
        .innerJoin(users, eq(ndas.signerId, users.id))
        .where(and(
          eq(pitches.userId, userId),
          eq(ndas.accessGranted, true)
        ))
        .orderBy(desc(ndas.signedAt));

        incomingSignedNDAs = incoming.map(nda => ({
          ...nda,
          signedDate: getRelativeTime(new Date(nda.signedAt)),
        }));
      }

      return new Response(JSON.stringify({
        success: true,
        signedNDAs: ndasWithExpiry,
        incomingSignedNDAs,
        totalSigned: ndasWithExpiry.length,
        totalIncoming: incomingSignedNDAs.length,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching signed NDAs:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}