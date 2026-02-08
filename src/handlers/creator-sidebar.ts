/**
 * Creator Portal Sidebar Handlers
 * Real database query implementations replacing stub endpoints
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  data: unknown,
  origin: string | null,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...getCorsHeaders(origin),
    },
  });
}

function parsePageParams(request: Request): { page: number; limit: number; offset: number } {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ---------------------------------------------------------------------------
// 1. GET /api/creator/stats
// ---------------------------------------------------------------------------

export async function creatorStatsHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = {
    totalPitches: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalSubmissions: 0,
    pendingSubmissions: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    teamMembers: 0,
  };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    // Pitch counts by status
    const pitchStats = await sql`
      SELECT
        COUNT(*)::int AS total_pitches,
        COUNT(CASE WHEN status IN ('public', 'active') THEN 1 END)::int AS active_projects,
        COUNT(CASE WHEN status = 'archived' THEN 1 END)::int AS completed_projects,
        COALESCE(SUM(view_count), 0)::int AS total_views,
        COALESCE(SUM(like_count), 0)::int AS total_likes
      FROM pitches
      WHERE creator_id = ${userId}
    `;

    // Follower count (people following this creator)
    const followerStats = await sql`
      SELECT COUNT(*)::int AS follower_count
      FROM follows
      WHERE following_id = ${userId}
    `;

    // Investment totals for the creator's pitches
    const investmentStats = await sql`
      SELECT
        COALESCE(SUM(amount), 0)::numeric AS total_revenue
      FROM investments
      WHERE pitch_id IN (SELECT id FROM pitches WHERE creator_id = ${userId})
        AND status IN ('completed', 'committed')
    `;

    // Monthly revenue (investments completed/committed this calendar month)
    const monthlyStats = await sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS monthly_revenue
      FROM investments
      WHERE pitch_id IN (SELECT id FROM pitches WHERE creator_id = ${userId})
        AND status IN ('completed', 'committed')
        AND created_at >= date_trunc('month', CURRENT_DATE)
    `;

    const p = pitchStats[0] || {};
    const f = followerStats[0] || {};
    const i = investmentStats[0] || {};
    const m = monthlyStats[0] || {};

    return jsonResponse({
      success: true,
      data: {
        totalPitches: Number(p.total_pitches) || 0,
        activeProjects: Number(p.active_projects) || 0,
        completedProjects: Number(p.completed_projects) || 0,
        totalSubmissions: Number(p.total_pitches) || 0,
        pendingSubmissions: 0,
        totalRevenue: Number(i.total_revenue) || 0,
        monthlyRevenue: Number(m.monthly_revenue) || 0,
        teamMembers: Number(f.follower_count) || 0,
      },
    }, origin);
  } catch (error) {
    console.error('creatorStatsHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 2. GET /api/creator/activity
// ---------------------------------------------------------------------------

export async function creatorActivityHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);
  const { page, limit, offset } = parsePageParams(request);

  const emptyData = {
    activities: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
  };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const countResult = await sql`
      SELECT COUNT(*)::int AS total
      FROM notifications
      WHERE user_id = ${userId}
    `;
    const total = Number(countResult[0]?.total) || 0;
    const totalPages = Math.ceil(total / limit);

    const activities = await sql`
      SELECT id, user_id, type, title, message, is_read, created_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return jsonResponse({
      success: true,
      data: {
        activities,
        pagination: { page, limit, total, totalPages },
      },
    }, origin);
  } catch (error) {
    console.error('creatorActivityHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 3. GET /api/creator/pitches/analytics
// ---------------------------------------------------------------------------

export async function creatorPitchesAnalyticsHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = {
    pitches: [],
    totals: { totalViews: 0, totalLikes: 0 },
  };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const pitches = await sql`
      SELECT
        p.id,
        p.title,
        COALESCE(p.view_count, 0)::int AS views,
        COALESCE(p.like_count, 0)::int AS likes,
        (SELECT COUNT(*)::int FROM saved_pitches sp WHERE sp.pitch_id = p.id) AS saves
      FROM pitches p
      WHERE p.creator_id = ${userId}
      ORDER BY p.view_count DESC NULLS LAST
    `;

    const totals = await sql`
      SELECT
        COALESCE(SUM(view_count), 0)::int AS total_views,
        COALESCE(SUM(like_count), 0)::int AS total_likes
      FROM pitches
      WHERE creator_id = ${userId}
    `;

    const t = totals[0] || {};

    return jsonResponse({
      success: true,
      data: {
        pitches,
        totals: {
          totalViews: Number(t.total_views) || 0,
          totalLikes: Number(t.total_likes) || 0,
        },
      },
    }, origin);
  } catch (error) {
    console.error('creatorPitchesAnalyticsHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 4. GET /api/creator/portfolio
// ---------------------------------------------------------------------------

export async function creatorPortfolioHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { pitches: [], totalInvestment: 0 };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const pitches = await sql`
      SELECT
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.status,
        p.cover_image,
        COALESCE(p.view_count, 0)::int AS view_count,
        COALESCE(p.like_count, 0)::int AS like_count,
        p.created_at,
        COALESCE(inv.investment_total, 0)::numeric AS investment_total
      FROM pitches p
      LEFT JOIN (
        SELECT pitch_id, SUM(amount) AS investment_total
        FROM investments
        WHERE status IN ('completed', 'committed')
        GROUP BY pitch_id
      ) inv ON inv.pitch_id = p.id
      WHERE p.creator_id = ${userId}
      ORDER BY p.created_at DESC
    `;

    const totalInvestmentResult = await sql`
      SELECT COALESCE(SUM(i.amount), 0)::numeric AS total
      FROM investments i
      JOIN pitches p ON p.id = i.pitch_id
      WHERE p.creator_id = ${userId}
        AND i.status IN ('completed', 'committed')
    `;

    return jsonResponse({
      success: true,
      data: {
        pitches,
        totalInvestment: Number(totalInvestmentResult[0]?.total) || 0,
      },
    }, origin);
  } catch (error) {
    console.error('creatorPortfolioHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 5. GET /api/creator/ndas
// ---------------------------------------------------------------------------

export async function creatorNdasHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { ndas: [], total: 0 };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const ndas = await sql`
      SELECT
        nr.id,
        nr.pitch_id,
        nr.requester_id,
        nr.pitch_owner_id,
        nr.status,
        nr.message,
        nr.response_message,
        nr.requested_at,
        nr.responded_at,
        nr.expires_at,
        p.title AS pitch_title,
        u.email AS requester_email,
        COALESCE(u.name, u.email) AS requester_name
      FROM nda_requests nr
      JOIN pitches p ON p.id = nr.pitch_id
      LEFT JOIN users u ON u.id::text = nr.requester_id::text
      WHERE nr.pitch_owner_id = ${userId}
      ORDER BY nr.requested_at DESC
    `;

    return jsonResponse({
      success: true,
      data: {
        ndas,
        total: ndas.length,
      },
    }, origin);
  } catch (error) {
    console.error('creatorNdasHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 6. GET /api/creator/calendar
// ---------------------------------------------------------------------------

export async function creatorCalendarHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { events: [] };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    // calendar_events table does not currently exist in the schema.
    // Synthesise events from NDA deadlines and investment milestones instead.
    const ndaEvents = await sql`
      SELECT
        nr.id,
        'nda_deadline' AS type,
        'NDA: ' || p.title AS title,
        'NDA request for pitch "' || p.title || '"' AS description,
        nr.requested_at AS start_date,
        nr.expires_at AS end_date
      FROM nda_requests nr
      JOIN pitches p ON p.id = nr.pitch_id
      WHERE nr.pitch_owner_id = ${userId}
        AND nr.status = 'pending'
      ORDER BY nr.requested_at DESC
      LIMIT 50
    `;

    const investmentEvents = await sql`
      SELECT
        i.id,
        'investment' AS type,
        'Investment: ' || p.title AS title,
        'Investment of $' || i.amount || ' on pitch "' || p.title || '"' AS description,
        i.created_at AS start_date,
        NULL AS end_date
      FROM investments i
      JOIN pitches p ON p.id = i.pitch_id
      WHERE p.creator_id = ${userId}
      ORDER BY i.created_at DESC
      LIMIT 50
    `;

    const events = [...ndaEvents, ...investmentEvents].sort(
      (a: any, b: any) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );

    return jsonResponse({ success: true, data: { events } }, origin);
  } catch (error) {
    console.error('creatorCalendarHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 7. GET /api/creator/earnings
// ---------------------------------------------------------------------------

export async function creatorEarningsHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { total: 0, pending: 0, paid: 0, transactions: [] };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    // Aggregate earnings from investments on the creator's pitches
    const earningsSummary = await sql`
      SELECT
        COALESCE(SUM(i.amount), 0)::numeric AS total,
        COALESCE(SUM(CASE WHEN i.status = 'pending' THEN i.amount ELSE 0 END), 0)::numeric AS pending,
        COALESCE(SUM(CASE WHEN i.status IN ('completed', 'committed') THEN i.amount ELSE 0 END), 0)::numeric AS paid
      FROM investments i
      JOIN pitches p ON p.id = i.pitch_id
      WHERE p.creator_id = ${userId}
    `;

    // Also check investment_deals for additional earnings data
    let dealEarnings = { total: 0, pending: 0, paid: 0 };
    try {
      const dealResult = await sql`
        SELECT
          COALESCE(SUM(investment_amount), 0)::numeric AS total,
          COALESCE(SUM(CASE WHEN deal_state = 'inquiry' THEN investment_amount ELSE 0 END), 0)::numeric AS pending,
          COALESCE(SUM(CASE WHEN deal_state IN ('funded', 'completed') THEN investment_amount ELSE 0 END), 0)::numeric AS paid
        FROM investment_deals
        WHERE creator_id = ${userId}
      `;
      if (dealResult[0]) {
        dealEarnings = {
          total: Number(dealResult[0].total) || 0,
          pending: Number(dealResult[0].pending) || 0,
          paid: Number(dealResult[0].paid) || 0,
        };
      }
    } catch {
      // investment_deals table may not exist -- silently continue
    }

    // Recent transactions: latest investments on the creator's pitches
    const transactions = await sql`
      SELECT
        i.id,
        i.amount,
        i.status,
        i.created_at,
        p.title AS pitch_title,
        u.email AS investor_email,
        COALESCE(u.name, u.email) AS investor_name
      FROM investments i
      JOIN pitches p ON p.id = i.pitch_id
      LEFT JOIN users u ON u.id::text = i.investor_id::text
      WHERE p.creator_id = ${userId}
      ORDER BY i.created_at DESC
      LIMIT 50
    `;

    const s = earningsSummary[0] || {};

    return jsonResponse({
      success: true,
      data: {
        total: (Number(s.total) || 0) + dealEarnings.total,
        pending: (Number(s.pending) || 0) + dealEarnings.pending,
        paid: (Number(s.paid) || 0) + dealEarnings.paid,
        transactions,
      },
    }, origin);
  } catch (error) {
    console.error('creatorEarningsHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 8. GET /api/creator/followers
// ---------------------------------------------------------------------------

export async function creatorFollowersHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { followers: [], total: 0 };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const countResult = await sql`
      SELECT COUNT(*)::int AS total
      FROM follows
      WHERE following_id = ${userId}
    `;
    const total = Number(countResult[0]?.total) || 0;

    const followers = await sql`
      SELECT
        u.id,
        u.email,
        COALESCE(u.name, u.email) AS name,
        u.user_type,
        u.profile_image,
        u.bio,
        f.created_at AS followed_at
      FROM follows f
      JOIN users u ON u.id::text = f.follower_id::text
      WHERE f.following_id = ${userId}
      ORDER BY f.created_at DESC
      LIMIT 100
    `;

    return jsonResponse({
      success: true,
      data: {
        followers,
        total,
      },
    }, origin);
  } catch (error) {
    console.error('creatorFollowersHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 9. GET /api/creator/performance
// ---------------------------------------------------------------------------

export async function creatorPerformanceHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = {
    pitchPerformance: [],
    genreBreakdown: [],
    monthlyTrends: [],
    overallStats: { totalViews: 0, totalLikes: 0, avgEngagement: 0 },
  };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const pitchPerformance = await sql`
      SELECT
        p.id,
        p.title,
        p.genre,
        p.status,
        COALESCE(p.view_count, 0)::int AS views,
        COALESCE(p.like_count, 0)::int AS likes,
        CASE WHEN COALESCE(p.view_count, 0) > 0
          THEN ROUND((COALESCE(p.like_count, 0)::numeric / p.view_count) * 100, 2)
          ELSE 0
        END AS engagement_rate,
        p.created_at
      FROM pitches p
      WHERE p.creator_id = ${userId}
      ORDER BY views DESC
      LIMIT 50
    `;

    const genreBreakdown = await sql`
      SELECT
        p.genre,
        COUNT(*)::int AS pitch_count,
        COALESCE(SUM(p.view_count), 0)::int AS total_views,
        COALESCE(SUM(p.like_count), 0)::int AS total_likes
      FROM pitches p
      WHERE p.creator_id = ${userId}
      GROUP BY p.genre
      ORDER BY total_views DESC
    `;

    const monthlyTrends = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', p.created_at), 'YYYY-MM') AS month,
        COUNT(*)::int AS pitches_created,
        COALESCE(SUM(p.view_count), 0)::int AS views,
        COALESCE(SUM(p.like_count), 0)::int AS likes
      FROM pitches p
      WHERE p.creator_id = ${userId}
        AND p.created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', p.created_at)
      ORDER BY month ASC
    `;

    let totalViews = 0;
    let totalLikes = 0;
    for (const row of pitchPerformance) {
      totalViews += Number(row.views) || 0;
      totalLikes += Number(row.likes) || 0;
    }
    const avgEngagement = totalViews > 0
      ? Number(((totalLikes / totalViews) * 100).toFixed(2))
      : 0;

    return jsonResponse({
      success: true,
      data: {
        pitchPerformance,
        genreBreakdown,
        monthlyTrends,
        overallStats: { totalViews, totalLikes, avgEngagement },
      },
    }, origin);
  } catch (error) {
    console.error('creatorPerformanceHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}

// ---------------------------------------------------------------------------
// 10. GET /api/creator/network
// ---------------------------------------------------------------------------

export async function creatorNetworkHandler(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  const emptyData = { connections: [], total: 0 };

  if (!sql || !userId) {
    return jsonResponse({ success: true, data: emptyData }, origin);
  }

  try {
    const connections = await sql`
      SELECT DISTINCT
        u.id,
        u.name,
        u.email,
        u.user_type,
        u.avatar_url,
        f.created_at AS connected_since
      FROM follows f
      JOIN users u ON (
        (f.follower_id::text = ${userId} AND u.id::text = f.following_id::text)
        OR
        (f.following_id::text = ${userId} AND u.id::text = f.follower_id::text)
      )
      WHERE f.follower_id::text = ${userId}
         OR f.following_id::text = ${userId}
      ORDER BY f.created_at DESC
    `;

    return jsonResponse({
      success: true,
      data: { connections, total: connections.length },
    }, origin);
  } catch (error) {
    console.error('creatorNetworkHandler error:', error);
    return jsonResponse({ success: true, data: emptyData }, origin);
  }
}