// quick-fix-remaining-errors.ts
// Apply these changes to working-server.ts to fix remaining errors

// ============================================
// FIX 1: Messages Unread Count (Line ~4895)
// ============================================
// REPLACE THIS:
/*
const unreadCount = await db
  .select({ count: sql`count(*)::int` })
  .from(messages)
  .where(
    and(
      eq(messages.recipientId, user.id),
      eq(messages.isRead, false)
    )
  );
*/

// WITH THIS (using raw SQL):
const unreadCount = await db
  .select({ count: sql`count(*)::int` })
  .from(messages)
  .where(sql`recipient_id = ${user.id} AND is_read = false`);

// ============================================
// FIX 2: NDA Status Check (Add new around line 6440)
// ============================================
// ADD THIS ENDPOINT (if not exists):
if (url.pathname.match(/^\/api\/nda\/status\/\d+$/) && method === "GET") {
  try {
    const pitchId = parseInt(url.pathname.split('/')[4]);
    
    // Use raw SQL for column names
    const ndaStatus = await db
      .select()
      .from(ndas)
      .where(sql`pitch_id = ${pitchId} AND user_id = ${user.id}`)
      .limit(1);

    if (!ndaStatus.length) {
      // Check pending requests
      const pendingRequest = await db
        .select()
        .from(ndaRequests)
        .where(sql`pitch_id = ${pitchId} AND requester_id = ${user.id}`)
        .limit(1);

      if (pendingRequest.length) {
        return jsonResponse({
          success: true,
          status: "pending",
          request: pendingRequest[0]
        });
      }

      return jsonResponse({
        success: true,
        status: "not_requested",
        message: "No NDA on file"
      });
    }

    return jsonResponse({
      success: true,
      status: ndaStatus[0].status || "signed",
      nda: ndaStatus[0]
    });

  } catch (error) {
    console.error("NDA status error:", error);
    return serverErrorResponse("Failed to check NDA status");
  }
}

// ============================================
// FIX 3: Search Pitches (Line ~1423)
// ============================================
// The search endpoint has issues with ilike and column names
// REPLACE the conditions building with:

const conditions = [];

// Base conditions
conditions.push(sql`status = 'published'`);
conditions.push(sql`(visibility = 'public' OR visibility IS NULL)`);

// Search query
if (query) {
  conditions.push(
    sql`(
      LOWER(title) LIKE LOWER(${'%' + query + '%'}) OR
      LOWER(logline) LIKE LOWER(${'%' + query + '%'}) OR
      LOWER(short_synopsis) LIKE LOWER(${'%' + query + '%'})
    )`
  );
}

// Genre filter
if (genre) {
  conditions.push(sql`genre = ${genre}`);
}

// Format filter
if (format) {
  conditions.push(sql`format = ${format}`);
}

// Then use raw SQL for the query:
const searchResults = await db.execute(sql`
  SELECT 
    id, title, logline, genre, format, 
    short_synopsis as "shortSynopsis",
    poster_url as "posterUrl", 
    view_count as "viewCount",
    like_count as "likeCount",
    created_at as "createdAt",
    user_id as "userId",
    budget_bracket as "budgetBracket",
    status
  FROM pitches
  WHERE ${sql.join(conditions, sql` AND `)}
  ORDER BY created_at DESC
  LIMIT ${limit}
  OFFSET ${offset}
`);

// ============================================
// FIX 4: Pitch Access for Investors
// ============================================
// Find the endpoint: GET /api/pitches/:id
// Around line where it checks pitch ownership

// REPLACE:
/*
if (url.pathname.startsWith("/api/pitches/") && method === "GET") {
  const pitchId = parseInt(url.pathname.split('/')[2]);
  const pitch = await PitchService.getPitchById(pitchId, user.id);
  if (!pitch) {
    return errorResponse("Pitch not found or access denied", 404);
  }
*/

// WITH:
if (url.pathname.match(/^\/api\/pitches\/\d+$/) && method === "GET") {
  const pitchId = parseInt(url.pathname.split('/')[2]);
  
  // First try to get user's own pitch
  let pitch = await PitchService.getPitchById(pitchId, user.id);
  
  // If not found, try to get public pitch
  if (!pitch) {
    const publicPitch = await db
      .select()
      .from(pitches)
      .where(
        and(
          eq(pitches.id, pitchId),
          eq(pitches.status, "published"),
          or(
            eq(pitches.visibility, "public"),
            isNull(pitches.visibility)
          )
        )
      )
      .limit(1);
    
    if (publicPitch.length > 0) {
      pitch = publicPitch[0];
    } else {
      return errorResponse("Pitch not found or access denied", 404);
    }
  }
  
  return successResponse({ pitch });
}

// ============================================
// FIX 5: Auth Profile Endpoint 
// ============================================
// This is already fixed but verify the authentication:
// Make sure around line 1104, it uses:
const authResult = await authenticate(request);
// NOT authenticateRequest(request)