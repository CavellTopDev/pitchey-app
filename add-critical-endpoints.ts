// Script to add critical endpoints to working-server.ts
// This file contains the exact code to insert at specific locations

// ============================================
// LOCATION 1: After line 2750 (after Creator analytics endpoint)
// ============================================

export const creatorEndpoints = `
    // GET /api/creator/followers - Get list of followers
    if (url.pathname === "/api/creator/followers" && method === "GET") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;
        
        // Get followers with user details using Drizzle
        const followersQuery = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            profilePicture: users.profilePicture,
            bio: users.bio,
            userType: users.userType,
            followedAt: follows.createdAt
          })
          .from(follows)
          .innerJoin(users, eq(follows.followerId, users.id))
          .where(eq(follows.followingId, userId))
          .orderBy(desc(follows.createdAt))
          .limit(limit)
          .offset(offset);
        
        // Get total count
        const totalResult = await db
          .select({ count: sql<number>\`count(*)::integer\` })
          .from(follows)
          .where(eq(follows.followingId, userId));
        
        return successResponse({
          followers: followersQuery,
          total: totalResult[0]?.count || 0,
          page,
          limit
        });
      } catch (error) {
        console.error("Error fetching followers:", error);
        return errorResponse("Failed to fetch followers");
      }
    }

    // GET /api/creator/saved-pitches - Get saved pitches
    if (url.pathname === "/api/creator/saved-pitches" && method === "GET") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;
        
        // Get saved pitches
        const savedPitchesQuery = await db
          .select({
            id: pitches.id,
            title: pitches.title,
            logline: pitches.logline,
            genre: pitches.genre,
            format: pitches.format,
            thumbnailUrl: pitches.thumbnailUrl,
            status: pitches.status,
            visibility: pitches.visibility,
            viewCount: pitches.viewCount,
            creatorId: pitches.creatorId,
            creatorName: users.name,
            savedAt: savedPitches.createdAt
          })
          .from(savedPitches)
          .innerJoin(pitches, eq(savedPitches.pitchId, pitches.id))
          .innerJoin(users, eq(pitches.creatorId, users.id))
          .where(eq(savedPitches.userId, userId))
          .orderBy(desc(savedPitches.createdAt))
          .limit(limit)
          .offset(offset);
        
        const totalResult = await db
          .select({ count: sql<number>\`count(*)::integer\` })
          .from(savedPitches)
          .where(eq(savedPitches.userId, userId));
        
        return successResponse({
          pitches: savedPitchesQuery,
          total: totalResult[0]?.count || 0,
          page,
          limit
        });
      } catch (error) {
        console.error("Error fetching saved pitches:", error);
        return errorResponse("Failed to fetch saved pitches");
      }
    }

    // GET /api/creator/recommendations - Get recommendations
    if (url.pathname === "/api/creator/recommendations" && method === "GET") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        // Get creator's genre preferences
        const userPitches = await db
          .select({ genre: pitches.genre })
          .from(pitches)
          .where(eq(pitches.creatorId, userId))
          .limit(5);
        
        const userGenres = [...new Set(userPitches.map(p => p.genre).filter(Boolean))];
        
        // Build where conditions
        const whereConditions = [
          ne(pitches.creatorId, userId),
          eq(pitches.visibility, 'public')
        ];
        
        if (userGenres.length > 0) {
          whereConditions.push(inArray(pitches.genre, userGenres));
        }
        
        // Get recommended pitches
        const recommendedPitches = await db
          .select({
            id: pitches.id,
            title: pitches.title,
            logline: pitches.logline,
            genre: pitches.genre,
            format: pitches.format,
            thumbnailUrl: pitches.thumbnailUrl,
            creatorName: users.name,
            creatorId: users.id,
            viewCount: pitches.viewCount,
            createdAt: pitches.createdAt
          })
          .from(pitches)
          .innerJoin(users, eq(pitches.creatorId, users.id))
          .where(and(...whereConditions))
          .orderBy(desc(pitches.viewCount))
          .limit(10);
        
        // Get recommended creators
        const recommendedCreators = await db
          .select({
            id: users.id,
            name: users.name,
            bio: users.bio,
            profilePicture: users.profilePicture,
            followerCount: sql<number>\`(SELECT COUNT(*) FROM follows WHERE following_id = \${users.id})::integer\`,
            pitchCount: sql<number>\`(SELECT COUNT(*) FROM pitches WHERE creator_id = \${users.id})::integer\`
          })
          .from(users)
          .where(and(
            eq(users.userType, 'creator'),
            ne(users.id, userId),
            sql\`\${users.id} NOT IN (SELECT following_id FROM follows WHERE follower_id = \${userId})\`
          ))
          .orderBy(sql\`(SELECT COUNT(*) FROM follows WHERE following_id = \${users.id}) DESC\`)
          .limit(5);
        
        return successResponse({
          pitches: recommendedPitches,
          creators: recommendedCreators
        });
      } catch (error) {
        console.error("Error fetching recommendations:", error);
        return errorResponse("Failed to fetch recommendations");
      }
    }
`;

// ============================================
// LOCATION 2: After line 7100 (after production stats)
// ============================================

export const productionEndpoints = `
    // GET /api/production/analytics - Production analytics
    if (url.pathname === "/api/production/analytics" && method === "GET") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!user[0] || user[0].userType !== 'production') {
          return errorResponse("Not a production company", 403);
        }
        
        const period = url.searchParams.get('period') || '30d';
        const startDate = getStartDateFromPeriod(period);
        
        // Get analytics
        const submissionsResult = await db
          .select({ count: sql<number>\`count(*)::integer\` })
          .from(ndas)
          .where(and(
            eq(ndas.productionId, userId),
            gte(ndas.createdAt, startDate)
          ));
        
        const activeProjectsResult = await db
          .select({ count: sql<number>\`count(*)::integer\` })
          .from(pitches)
          .where(and(
            eq(pitches.productionCompanyId, userId),
            eq(pitches.status, 'in_production')
          ));
        
        const viewsTotalResult = await db
          .select({ sum: sql<number>\`COALESCE(SUM(view_count), 0)::integer\` })
          .from(pitches)
          .where(eq(pitches.productionCompanyId, userId));
        
        const analytics = {
          submissions: submissionsResult[0]?.count || 0,
          activeProjects: activeProjectsResult[0]?.count || 0,
          viewsTotal: viewsTotalResult[0]?.sum || 0,
          engagementRate: 0.0,
          chartData: {
            labels: getLast30Days(),
            submissions: [],
            views: [],
            engagements: []
          }
        };
        
        return successResponse(analytics);
      } catch (error) {
        console.error("Error fetching production analytics:", error);
        return errorResponse("Failed to fetch analytics");
      }
    }

    // POST /api/production/pitches/{id}/review - Review pitch
    if (url.pathname.match(/^\\/api\\/production\\/pitches\\/\\d+\\/review$/) && method === "POST") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        const pitchId = parseInt(url.pathname.split('/')[4]);
        const body = await request.json();
        const { status, feedback, rating } = body;
        
        // Verify access
        const hasAccess = await db
          .select()
          .from(ndas)
          .where(and(
            eq(ndas.pitchId, pitchId),
            eq(ndas.productionId, userId),
            eq(ndas.status, 'signed')
          ))
          .limit(1);
        
        if (!hasAccess[0]) {
          return errorResponse("No access to this pitch", 403);
        }
        
        // Get pitch creator
        const pitch = await db
          .select({ creatorId: pitches.creatorId })
          .from(pitches)
          .where(eq(pitches.id, pitchId))
          .limit(1);
        
        if (!pitch[0]) {
          return errorResponse("Pitch not found", 404);
        }
        
        // Create or update review
        const existingReview = await db
          .select()
          .from(reviews)
          .where(and(
            eq(reviews.pitchId, pitchId),
            eq(reviews.reviewerId, userId)
          ))
          .limit(1);
        
        let review;
        if (existingReview[0]) {
          review = await db
            .update(reviews)
            .set({
              status,
              feedback,
              rating,
              updatedAt: new Date()
            })
            .where(and(
              eq(reviews.pitchId, pitchId),
              eq(reviews.reviewerId, userId)
            ))
            .returning();
        } else {
          review = await db
            .insert(reviews)
            .values({
              pitchId,
              reviewerId: userId,
              status,
              feedback,
              rating
            })
            .returning();
        }
        
        return successResponse({ review: review[0] });
      } catch (error) {
        console.error("Error reviewing pitch:", error);
        return errorResponse("Failed to submit review");
      }
    }

    // GET /api/production/calendar - Get calendar events
    if (url.pathname === "/api/production/calendar" && method === "GET") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        const startDate = url.searchParams.get('start') || new Date().toISOString();
        const endDate = url.searchParams.get('end') || 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
        // Get calendar events
        const events = await db
          .select({
            id: calendarEvents.id,
            title: calendarEvents.title,
            description: calendarEvents.description,
            startDate: calendarEvents.startDate,
            endDate: calendarEvents.endDate,
            type: calendarEvents.type,
            relatedPitchId: calendarEvents.relatedPitchId,
            location: calendarEvents.location,
            attendees: calendarEvents.attendees
          })
          .from(calendarEvents)
          .where(and(
            eq(calendarEvents.userId, userId),
            gte(calendarEvents.startDate, new Date(startDate)),
            lte(calendarEvents.startDate, new Date(endDate))
          ))
          .orderBy(asc(calendarEvents.startDate));
        
        return successResponse({ events });
      } catch (error) {
        console.error("Error fetching calendar events:", error);
        return errorResponse("Failed to fetch calendar");
      }
    }

    // POST /api/production/calendar - Create calendar event
    if (url.pathname === "/api/production/calendar" && method === "POST") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        const body = await request.json();
        const { title, description, startDate, endDate, type, relatedPitchId, location, attendees } = body;
        
        const event = await db
          .insert(calendarEvents)
          .values({
            userId,
            title,
            description,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            type,
            relatedPitchId,
            location,
            attendees: attendees || []
          })
          .returning();
        
        return successResponse({ event: event[0] });
      } catch (error) {
        console.error("Error creating calendar event:", error);
        return errorResponse("Failed to create event");
      }
    }

    // GET /api/production/submissions/stats - Submission statistics
    if (url.pathname === "/api/production/submissions/stats" && method === "GET") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        // Get all stats
        const [total, pending, approved, rejected] = await Promise.all([
          db.select({ count: sql<number>\`count(*)::integer\` })
            .from(ndas)
            .where(eq(ndas.productionId, userId)),
          
          db.select({ count: sql<number>\`count(*)::integer\` })
            .from(ndas)
            .where(and(
              eq(ndas.productionId, userId),
              eq(ndas.status, 'pending')
            )),
          
          db.select({ count: sql<number>\`count(*)::integer\` })
            .from(ndas)
            .where(and(
              eq(ndas.productionId, userId),
              eq(ndas.status, 'signed')
            )),
          
          db.select({ count: sql<number>\`count(*)::integer\` })
            .from(ndas)
            .where(and(
              eq(ndas.productionId, userId),
              eq(ndas.status, 'rejected')
            ))
        ]);
        
        const stats = {
          total: total[0]?.count || 0,
          pending: pending[0]?.count || 0,
          approved: approved[0]?.count || 0,
          rejected: rejected[0]?.count || 0,
          byGenre: {},
          byMonth: {},
          averageResponseTime: 0
        };
        
        return successResponse(stats);
      } catch (error) {
        console.error("Error fetching submission stats:", error);
        return errorResponse("Failed to fetch stats");
      }
    }
`;

// ============================================
// LOCATION 3: After line 6550 (investment endpoints area)
// ============================================

export const investmentEndpoints = `
    // POST /api/investments/{id}/update - Update investment
    if (url.pathname.match(/^\\/api\\/investments\\/\\d+\\/update$/) && method === "POST") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        const investmentId = parseInt(url.pathname.split('/')[3]);
        const body = await request.json();
        
        // Verify ownership
        const investment = await db
          .select()
          .from(investments)
          .where(and(
            eq(investments.id, investmentId),
            eq(investments.investorId, userId)
          ))
          .limit(1);
        
        if (!investment[0]) {
          return errorResponse("Investment not found", 404);
        }
        
        // Update investment
        const updated = await db
          .update(investments)
          .set({
            ...body,
            updatedAt: new Date()
          })
          .where(eq(investments.id, investmentId))
          .returning();
        
        return successResponse({ investment: updated[0] });
      } catch (error) {
        console.error("Error updating investment:", error);
        return errorResponse("Failed to update investment");
      }
    }

    // DELETE /api/investments/{id} - Delete investment
    if (url.pathname.match(/^\\/api\\/investments\\/\\d+$/) && method === "DELETE") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        const investmentId = parseInt(url.pathname.split('/')[3]);
        
        // Verify ownership
        const investment = await db
          .select()
          .from(investments)
          .where(and(
            eq(investments.id, investmentId),
            eq(investments.investorId, userId)
          ))
          .limit(1);
        
        if (!investment[0]) {
          return errorResponse("Investment not found", 404);
        }
        
        // Delete investment
        await db
          .delete(investments)
          .where(eq(investments.id, investmentId));
        
        return successResponse({ message: "Investment deleted successfully" });
      } catch (error) {
        console.error("Error deleting investment:", error);
        return errorResponse("Failed to delete investment");
      }
    }

    // GET /api/investments/{id}/details - Get investment details
    if (url.pathname.match(/^\\/api\\/investments\\/\\d+\\/details$/) && method === "GET") {
      try {
        const userId = getUserIdFromToken(request);
        if (!userId) return errorResponse("Unauthorized", 401);
        
        const investmentId = parseInt(url.pathname.split('/')[3]);
        
        // Get detailed investment information
        const investmentData = await db
          .select({
            id: investments.id,
            amount: investments.amount,
            investorId: investments.investorId,
            pitchId: investments.pitchId,
            status: investments.status,
            terms: investments.terms,
            createdAt: investments.createdAt,
            updatedAt: investments.updatedAt,
            pitchTitle: pitches.title,
            pitchLogline: pitches.logline,
            pitchGenre: pitches.genre,
            pitchStatus: pitches.status,
            creatorName: users.name,
            creatorEmail: users.email,
            creatorId: users.id
          })
          .from(investments)
          .innerJoin(pitches, eq(investments.pitchId, pitches.id))
          .innerJoin(users, eq(pitches.creatorId, users.id))
          .where(and(
            eq(investments.id, investmentId),
            eq(investments.investorId, userId)
          ))
          .limit(1);
        
        if (!investmentData[0]) {
          return errorResponse("Investment not found", 404);
        }
        
        // Get related documents
        const documents = await db
          .select()
          .from(investmentDocuments)
          .where(eq(investmentDocuments.investmentId, investmentId))
          .orderBy(desc(investmentDocuments.uploadedAt));
        
        // Get timeline
        const timeline = await db
          .select()
          .from(investmentTimeline)
          .where(eq(investmentTimeline.investmentId, investmentId))
          .orderBy(desc(investmentTimeline.eventDate));
        
        const currentValue = investmentData[0].amount;
        const roi = ((currentValue - investmentData[0].amount) / investmentData[0].amount) * 100;
        
        const details = {
          ...investmentData[0],
          roi,
          documents,
          timeline,
          updates: []
        };
        
        return successResponse(details);
      } catch (error) {
        console.error("Error fetching investment details:", error);
        return errorResponse("Failed to fetch details");
      }
    }
`;

// Helper functions to add at the end of the file
export const helperFunctions = `
// Helper functions for the new endpoints
function getStartDateFromPeriod(period: string): Date {
  const now = new Date();
  switch(period) {
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '1y': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function getLast30Days(): string[] {
  const dates = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}
`;

console.log(`
INSTRUCTIONS TO ADD ENDPOINTS:

1. Open working-server.ts

2. Add creator endpoints after line 2750:
   - Copy the creatorEndpoints code block

3. Add production endpoints after line 7100:
   - Copy the productionEndpoints code block

4. Add investment endpoints after line 6550:
   - Copy the investmentEndpoints code block

5. Add helper functions at the end of the file:
   - Copy the helperFunctions code block

6. Ensure these imports are at the top:
   import { eq, and, desc, sql, ne, inArray, gte, lte, asc } from "npm:drizzle-orm@0.35.3";
   import { savedPitches, reviews, calendarEvents, investments, investmentDocuments, investmentTimeline } from "./src/db/schema.ts";

7. Test with: ./test-critical-endpoints.sh
`);