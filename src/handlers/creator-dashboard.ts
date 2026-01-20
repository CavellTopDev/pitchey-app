/**
 * Creator Dashboard Handler - Comprehensive Creator Portal Features
 * Includes Revenue Dashboard, Contract Management, Pitch Analytics, and more
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId, requireRole } from '../utils/auth-extract';
import * as pitchQueries from '../db/queries/pitches';
import * as investmentQueries from '../db/queries/investments';
import * as analyticsQueries from '../db/queries/analytics';
import * as documentQueries from '../db/queries/documents';
import * as notificationQueries from '../db/queries/notifications';
import * as messagingQueries from '../db/queries/messaging';
import * as userQueries from '../db/queries/users';

// GET /api/creator/dashboard - Main creator dashboard data
export async function creatorDashboardHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Require creator role
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const userId = roleCheck.user.id;
  
  try {
    const sql = getDb(env);
    
    if (!sql) {
      console.error('Database connection failed in creator dashboard');
      // Return mock data instead of error to prevent frontend crash
      return new Response(JSON.stringify({ 
        success: true, 
        data: {
          overview: {
            totalPitches: 0,
            totalViews: 0,
            totalFollowers: 0,
            totalInvestments: 0,
            activeDeals: 0,
            pendingActions: 0
          },
          revenue: {
            totalRevenue: 0,
            committedFunds: 0,
            pipelineValue: 0,
            activeInvestors: 0,
            avgDealSize: 0
          },
          recentPitches: [],
          recentActivity: {
            investments: [],
            ndaRequests: [],
            notifications: []
          },
          analytics: {
            viewTrend: [],
            engagementRate: 0,
            topPerformingPitch: null
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // Fetch all dashboard metrics in parallel with error handling for each
    const results = await Promise.allSettled([
      userQueries.getUserStats(sql, userId).catch(() => ({ totalPitches: 0, totalFollowers: 0 })),
      pitchQueries.getCreatorPitches(sql, userId, undefined, 5).catch(() => []),
      analyticsQueries.getUserAnalytics(sql, userId).catch(() => ({ total_views: 0, avg_engagement: 0 })),
      documentQueries.getUserNDARequests(sql, userId, 'received').catch(() => []),
      investmentQueries.getInvestorPortfolio(sql, userId, {}).catch(() => []),
      notificationQueries.getUserNotifications(sql, userId, { limit: 5 }).catch(() => [])
    ]);

    const userStats = results[0].status === 'fulfilled' ? results[0].value as { totalPitches: number; totalFollowers: number } : { totalPitches: 0, totalFollowers: 0 };
    const recentPitches = results[1].status === 'fulfilled' ? results[1].value as pitchQueries.Pitch[] : [];
    const analytics = results[2].status === 'fulfilled' ? results[2].value as { total_views: number; avg_engagement: number } : { total_views: 0, avg_engagement: 0 };
    const pendingNDAs = results[3].status === 'fulfilled' ? results[3].value as documentQueries.NDARequest[] : [];
    const recentInvestments = results[4].status === 'fulfilled' ? results[4].value as investmentQueries.Investment[] : [];
    const notifications = results[5].status === 'fulfilled' ? results[5].value as notificationQueries.Notification[] : [];

    // Calculate revenue metrics with error handling
    const revenueData = await getRevenueMetrics(sql, userId).catch(() => ({
      totalRevenue: 0,
      committedFunds: 0,
      pipelineValue: 0,
      activeInvestors: 0,
      avgDealSize: 0
    }));
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        overview: {
          totalPitches: userStats.totalPitches || 0,
          totalViews: analytics.total_views || 0,
          totalFollowers: userStats.totalFollowers || 0,
          totalInvestments: recentInvestments.length || 0,
          activeDeals: pendingNDAs.filter((n) => n?.status === 'approved').length,
          pendingActions: pendingNDAs.filter((n) => n?.status === 'pending').length
        },
        revenue: revenueData,
        recentPitches: recentPitches,
        recentActivity: {
          investments: recentInvestments.slice(0, 5),
          ndaRequests: pendingNDAs.slice(0, 5),
          notifications: notifications
        },
        analytics: {
          viewTrend: await getViewTrend(sql, userId).catch(() => []),
          engagementRate: analytics.avg_engagement || 0,
          topPerformingPitch: recentPitches.length > 0 ? recentPitches[0] : null
        }
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Creator dashboard error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to load dashboard' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// GET /api/creator/revenue - Revenue Dashboard
export async function creatorRevenueHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Require creator role
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const userId = roleCheck.user.id;
  const period = url.searchParams.get('period') || '30'; // days
  const sql = getDb(env);

  const emptyResponse = {
    success: true,
    data: {
      summary: { totalRevenue: 0, committedFunds: 0, pendingDeals: 0, averageDealSize: 0 },
      trends: [],
      breakdown: [],
      investorDemographics: [],
      projections: { next7Days: 0, next30Days: 0, next90Days: 0, confidence: 'low' }
    }
  };

  if (!sql) {
    return new Response(JSON.stringify(emptyResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Check if investments table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'investments'
      ) as exists
    `.catch(() => [{ exists: false }]);

    if (!tableCheck[0]?.exists) {
      return new Response(JSON.stringify(emptyResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const startDate = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    // Get investment trends for creator's pitches - simplified query
    const investmentTrends = await sql`
      SELECT
        DATE_TRUNC('day', i.created_at) as date,
        COUNT(*) as deal_count,
        COALESCE(SUM(i.amount), 0) as total_amount,
        COALESCE(AVG(i.amount), 0) as avg_amount,
        i.status
      FROM investments i
      JOIN pitches p ON i.pitch_id = p.id
      WHERE (p.creator_id::text = ${userId} OR p.user_id::text = ${userId})
        AND i.created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY DATE_TRUNC('day', i.created_at), i.status
      ORDER BY date DESC
    `.catch(() => []);

    // Get revenue breakdown
    const revenueBreakdown = await sql`
      SELECT
        i.status,
        COUNT(*) as count,
        COALESCE(SUM(i.amount), 0) as total,
        COALESCE(AVG(i.amount), 0) as average,
        COALESCE(MIN(i.amount), 0) as minimum,
        COALESCE(MAX(i.amount), 0) as maximum
      FROM investments i
      JOIN pitches p ON i.pitch_id = p.id
      WHERE (p.creator_id::text = ${userId} OR p.user_id::text = ${userId})
        AND i.created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY i.status
    `.catch(() => []);

    // Get investor demographics
    const investorDemographics = await sql`
      SELECT
        u.location,
        u.company_name,
        COUNT(DISTINCT u.id) as investor_count,
        COALESCE(SUM(i.amount), 0) as total_invested
      FROM investments i
      JOIN pitches p ON i.pitch_id = p.id
      JOIN users u ON i.investor_id::text = u.id::text
      WHERE (p.creator_id::text = ${userId} OR p.user_id::text = ${userId})
        AND i.status IN ('committed', 'funded', 'active')
      GROUP BY u.location, u.company_name
      ORDER BY total_invested DESC
      LIMIT 20
    `.catch(() => []);

    // Calculate projections
    const projections = calculateRevenueProjections(investmentTrends || []);

    const breakdown = revenueBreakdown || [];
    return new Response(JSON.stringify({
      success: true,
      data: {
        summary: {
          totalRevenue: breakdown.reduce((sum: number, r: any) =>
            r.status === 'funded' ? sum + Number(r.total || 0) : sum, 0),
          committedFunds: breakdown.reduce((sum: number, r: any) =>
            r.status === 'committed' ? sum + Number(r.total || 0) : sum, 0),
          pendingDeals: breakdown.reduce((sum: number, r: any) =>
            r.status === 'pending' ? sum + Number(r.total || 0) : sum, 0),
          averageDealSize: breakdown.length > 0 ?
            breakdown.reduce((sum: number, r: any) => sum + Number(r.average || 0), 0) / breakdown.length : 0
        },
        trends: investmentTrends || [],
        breakdown: breakdown,
        investorDemographics: investorDemographics || [],
        projections
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Revenue dashboard error:', error);
    return new Response(JSON.stringify(emptyResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// GET /api/creator/contracts - Contract Management
export async function creatorContractsHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Require creator role
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const userId = roleCheck.user.id;
  const status = url.searchParams.get('status'); // active, pending, completed
  const sql = getDb(env);

  const emptyResponse = {
    success: true,
    data: {
      contracts: [],
      statistics: { pending_count: 0, active_count: 0, completed_count: 0, cancelled_count: 0, total_completed_value: 0, total_pipeline_value: 0 },
      alerts: []
    }
  };

  if (!sql) {
    return new Response(JSON.stringify(emptyResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Check if investments table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'investments'
      ) as exists
    `;

    if (!tableCheck[0]?.exists) {
      return new Response(JSON.stringify(emptyResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get all contracts/deals for creator's pitches - simplified query
    const contracts = await sql`
      SELECT
        i.id as contract_id,
        i.pitch_id,
        p.title as pitch_title,
        i.investor_id,
        COALESCE(u.name, CONCAT(u.first_name, ' ', u.last_name), u.email) as investor_name,
        u.company_name as investor_company,
        i.amount,
        i.status as contract_status,
        i.created_at as initiated_at,
        i.updated_at as last_updated
      FROM investments i
      JOIN pitches p ON i.pitch_id = p.id
      LEFT JOIN users u ON i.investor_id::text = u.id::text
      WHERE (p.creator_id::text = ${userId} OR p.user_id::text = ${userId})
        ${status ? sql`AND i.status = ${status}` : sql``}
      ORDER BY COALESCE(i.updated_at, i.created_at) DESC
      LIMIT 100
    `;

    // Get contract statistics
    const stats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE i.status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE i.status IN ('committed', 'active')) as active_count,
        COUNT(*) FILTER (WHERE i.status = 'funded') as completed_count,
        COUNT(*) FILTER (WHERE i.status = 'cancelled') as cancelled_count,
        COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'funded'), 0) as total_completed_value,
        COALESCE(SUM(i.amount) FILTER (WHERE i.status IN ('committed', 'pending')), 0) as total_pipeline_value
      FROM investments i
      JOIN pitches p ON i.pitch_id = p.id
      WHERE p.creator_id::text = ${userId} OR p.user_id::text = ${userId}
    `;

    return new Response(JSON.stringify({
      success: true,
      data: {
        contracts: contracts || [],
        statistics: stats[0] || emptyResponse.data.statistics,
        alerts: []
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Contracts error:', error);
    // Return empty data instead of error to prevent frontend crash
    return new Response(JSON.stringify(emptyResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// GET /api/creator/analytics/:pitchId - Detailed Pitch Analytics
// Also handles GET /api/creator/analytics/pitches for all creator pitches
export async function creatorPitchAnalyticsHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Require creator role
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const pathParts = url.pathname.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  // If the last part is 'pitches', this is a request for all pitches analytics
  const isAllPitches = lastPart === 'pitches';
  const pitchId = isAllPitches ? null : lastPart;
  const period = url.searchParams.get('period') || '30';
  const sql = getDb(env);

  const emptyAnalytics = {
    success: true,
    data: {
      pitches: [],
      overview: { total_views: 0, unique_viewers: 0, avg_view_duration: 0, total_saves: 0, total_nda_requests: 0 },
      viewHistory: [],
      investment: { total_invested: 0, investor_count: 0 },
      documents: { total: 0, signed: 0 },
      audience: [],
      funnel: { total_viewers: 0, saved_by_users: 0, nda_requests: 0, nda_approved: 0, showed_interest: 0, made_investment: 0 },
      recommendations: []
    }
  };

  if (!sql) {
    return new Response(JSON.stringify(emptyAnalytics), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const userId = roleCheck.user.id;
    const startDate = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000);

    if (isAllPitches) {
      // Get analytics for all creator pitches
      const pitchesAnalytics = await sql`
        SELECT
          p.id,
          p.title,
          p.genre,
          p.status,
          p.created_at,
          COALESCE(pv.view_count, 0) as total_views,
          COALESCE(pv.unique_viewers, 0) as unique_viewers,
          COALESCE(sp_count.saves, 0) as total_saves,
          COALESCE(nda_count.requests, 0) as nda_requests,
          COALESCE(inv_count.investments, 0) as investment_count,
          COALESCE(inv_count.total_amount, 0) as total_invested
        FROM pitches p
        LEFT JOIN (
          SELECT pitch_id, SUM(view_count) as view_count, COUNT(DISTINCT user_id) as unique_viewers
          FROM pitch_views
          GROUP BY pitch_id
        ) pv ON p.id = pv.pitch_id
        LEFT JOIN (
          SELECT pitch_id, COUNT(*) as saves
          FROM saved_pitches
          GROUP BY pitch_id
        ) sp_count ON p.id = sp_count.pitch_id
        LEFT JOIN (
          SELECT pitch_id, COUNT(*) as requests
          FROM nda_requests
          GROUP BY pitch_id
        ) nda_count ON p.id = nda_count.pitch_id
        LEFT JOIN (
          SELECT pitch_id, COUNT(*) as investments, SUM(amount) as total_amount
          FROM investments
          GROUP BY pitch_id
        ) inv_count ON p.id = inv_count.pitch_id
        WHERE p.creator_id::text = ${userId} OR p.user_id::text = ${userId}
        ORDER BY p.created_at DESC
      `.catch(() => []);

      // Get overall analytics summary
      const summary = await sql`
        SELECT
          COALESCE(SUM(pv.view_count), 0) as total_views,
          COALESCE(COUNT(DISTINCT pv.user_id), 0) as unique_viewers,
          COALESCE(COUNT(DISTINCT sp.user_id), 0) as total_saves,
          COALESCE(COUNT(DISTINCT nr.id), 0) as total_nda_requests
        FROM pitches p
        LEFT JOIN pitch_views pv ON p.id = pv.pitch_id
        LEFT JOIN saved_pitches sp ON p.id = sp.pitch_id
        LEFT JOIN nda_requests nr ON p.id = nr.pitch_id
        WHERE p.creator_id::text = ${userId} OR p.user_id::text = ${userId}
      `.catch(() => [{ total_views: 0, unique_viewers: 0, total_saves: 0, total_nda_requests: 0 }]);

      return new Response(JSON.stringify({
        success: true,
        data: {
          pitches: pitchesAnalytics || [],
          overview: summary[0] || emptyAnalytics.data.overview,
          viewHistory: [],
          recommendations: []
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=300',
          ...corsHeaders
        }
      });
    }

    // Single pitch analytics
    // Check if pitch_views table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pitch_views'
      ) as exists
    `;

    if (!tableCheck[0]?.exists) {
      // Return basic pitch info without analytics
      const pitchInfo = await sql`
        SELECT id, title, genre, status, created_at
        FROM pitches WHERE id::text = ${pitchId}
      `.catch(() => []);

      return new Response(JSON.stringify({
        success: true,
        data: {
          ...emptyAnalytics.data,
          pitch: pitchInfo[0] || null
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get view history
    const viewHistory = await sql`
      SELECT
        DATE_TRUNC('day', viewed_at) as date,
        COUNT(*) as views,
        COUNT(DISTINCT user_id) as unique_viewers
      FROM pitch_views
      WHERE pitch_id::text = ${pitchId}
        AND viewed_at >= ${startDate}
      GROUP BY DATE_TRUNC('day', viewed_at)
      ORDER BY date ASC
    `.catch(() => []);

    // Get basic analytics
    const overview = await sql`
      SELECT
        COALESCE(SUM(view_count), 0) as total_views,
        COUNT(DISTINCT user_id) as unique_viewers,
        0 as avg_view_duration
      FROM pitch_views
      WHERE pitch_id::text = ${pitchId}
    `.catch(() => [{ total_views: 0, unique_viewers: 0, avg_view_duration: 0 }]);

    return new Response(JSON.stringify({
      success: true,
      data: {
        overview: overview[0] || emptyAnalytics.data.overview,
        viewHistory: viewHistory || [],
        investment: { total_invested: 0, investor_count: 0 },
        documents: { total: 0, signed: 0 },
        audience: [],
        funnel: emptyAnalytics.data.funnel,
        recommendations: []
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Pitch analytics error:', error);
    return new Response(JSON.stringify(emptyAnalytics), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// GET /api/creator/investors - Investor Relations Management
export async function creatorInvestorsHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Require creator role
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const userId = roleCheck.user.id;
  const filter = url.searchParams.get('filter'); // active, potential, past
  const sql = getDb(env);

  const emptyResponse = {
    success: true,
    data: {
      investors: [],
      communicationSummary: [],
      stats: { totalInvestors: 0, activeInvestors: 0, totalRaised: 0 }
    }
  };

  if (!sql) {
    return new Response(JSON.stringify(emptyResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Check if investments table exists
    const investmentsExist = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'investments'
      ) as exists
    `.catch(() => [{ exists: false }]);

    if (!investmentsExist[0]?.exists) {
      return new Response(JSON.stringify(emptyResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get investors who have invested in creator's pitches - simplified query
    const investors = await sql`
      SELECT
        u.id,
        COALESCE(u.name, CONCAT(u.first_name, ' ', u.last_name), u.email) as name,
        u.email,
        u.company_name,
        u.profile_image,
        u.location,
        u.bio,
        COUNT(DISTINCT i.id) as total_investments,
        COALESCE(SUM(i.amount), 0) as total_invested,
        MAX(i.created_at) as last_investment,
        MIN(i.created_at) as first_investment,
        CASE
          WHEN MAX(i.created_at) > NOW() - INTERVAL '30 days' THEN 'highly_active'
          WHEN MAX(i.created_at) > NOW() - INTERVAL '90 days' THEN 'active'
          ELSE 'inactive'
        END as activity_status
      FROM users u
      JOIN investments i ON i.investor_id::text = u.id::text
      JOIN pitches p ON i.pitch_id = p.id
      WHERE (p.creator_id::text = ${userId} OR p.user_id::text = ${userId})
        ${filter === 'active' ? sql`AND i.status IN ('committed', 'funded', 'active')` : sql``}
      GROUP BY u.id, u.name, u.first_name, u.last_name, u.email, u.company_name, u.profile_image, u.location, u.bio
      ORDER BY total_invested DESC
      LIMIT 100
    `.catch(() => []);

    return new Response(JSON.stringify({
      success: true,
      data: {
        investors: investors || [],
        communicationSummary: [],
        stats: {
          totalInvestors: investors?.length || 0,
          activeInvestors: (investors || []).filter((i: any) => i.activity_status === 'active' || i.activity_status === 'highly_active').length,
          totalRaised: (investors || []).reduce((sum: number, i: any) => sum + Number(i.total_invested || 0), 0)
        }
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=120',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Investors error:', error);
    return new Response(JSON.stringify(emptyResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Helper functions
async function getRevenueMetrics(sql: any, userId: string) {
  const result = await sql`
    SELECT 
      SUM(CASE WHEN status = 'funded' THEN amount ELSE 0 END) as total_revenue,
      SUM(CASE WHEN status = 'committed' THEN amount ELSE 0 END) as committed_funds,
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pipeline_value,
      COUNT(DISTINCT CASE WHEN status IN ('funded', 'committed') THEN investor_id END) as active_investors,
      AVG(CASE WHEN status = 'funded' THEN amount END) as avg_deal_size
    FROM investments i
    JOIN pitches p ON i.pitch_id = p.id
    WHERE p.creator_id = ${userId}
  `;
  
  return {
    totalRevenue: Number(result[0]?.total_revenue || 0),
    committedFunds: Number(result[0]?.committed_funds || 0),
    pipelineValue: Number(result[0]?.pipeline_value || 0),
    activeInvestors: Number(result[0]?.active_investors || 0),
    avgDealSize: Number(result[0]?.avg_deal_size || 0)
  };
}

async function getViewTrend(sql: any, userId: string) {
  const result = await sql`
    SELECT 
      DATE_TRUNC('day', ve.created_at) as date,
      COUNT(*) as views
    FROM view_events ve
    JOIN pitches p ON ve.pitch_id = p.id
    WHERE p.creator_id = ${userId}
      AND ve.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE_TRUNC('day', ve.created_at)
    ORDER BY date ASC
  `;
  return result;
}

async function getContractAlerts(sql: any, userId: string) {
  const alerts: Array<{ type: string; message: string; contractId: string }> = [];
  
  // Check for expiring contracts
  const expiring = await sql`
    SELECT 
      i.id,
      p.title,
      i.updated_at
    FROM investments i
    JOIN pitches p ON i.pitch_id = p.id
    WHERE p.creator_id = ${userId}
      AND i.status = 'pending'
      AND i.created_at < NOW() - INTERVAL '30 days'
  `;
  
  expiring.forEach((contract: any) => {
    alerts.push({
      type: 'warning',
      message: `Contract for "${contract.title}" has been pending for over 30 days`,
      contractId: contract.id
    });
  });
  
  // Check for unsigned documents
  const unsigned = await sql`
    SELECT 
      i.id,
      p.title,
      COUNT(*) as unsigned_count
    FROM investments i
    JOIN pitches p ON i.pitch_id = p.id
    JOIN investment_documents id ON id.investment_id = i.id
    WHERE p.creator_id = ${userId}
      AND i.status IN ('pending', 'committed')
      AND id.is_signed = false
    GROUP BY i.id, p.title
  `;
  
  unsigned.forEach((contract: any) => {
    alerts.push({
      type: 'info',
      message: `${contract.unsigned_count} unsigned document(s) for "${contract.title}"`,
      contractId: contract.id
    });
  });
  
  return alerts;
}

async function getViewHistory(sql: any, pitchId: string, startDate: Date) {
  return await sql`
    SELECT 
      DATE_TRUNC('day', created_at) as date,
      COUNT(*) as views,
      COUNT(DISTINCT viewer_id) as unique_viewers,
      AVG(duration_seconds) as avg_duration
    FROM view_events
    WHERE pitch_id = ${pitchId}
      AND created_at >= ${startDate}
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY date ASC
  `;
}

async function getAudienceDemographics(sql: any, pitchId: string) {
  return await sql`
    SELECT 
      u.user_type,
      u.location,
      COUNT(DISTINCT ve.viewer_id) as viewer_count
    FROM view_events ve
    LEFT JOIN users u ON ve.viewer_id = u.id
    WHERE ve.pitch_id = ${pitchId}
      AND ve.viewer_id IS NOT NULL
    GROUP BY u.user_type, u.location
    ORDER BY viewer_count DESC
  `;
}

function calculateRevenueProjections(trends: any[]) {
  // Simple linear projection based on recent trends
  const recentTrends = trends.slice(0, 7);
  const avgDailyRevenue = recentTrends.reduce((sum, t) => sum + Number(t.total_amount), 0) / recentTrends.length;
  
  return {
    next7Days: avgDailyRevenue * 7,
    next30Days: avgDailyRevenue * 30,
    next90Days: avgDailyRevenue * 90,
    confidence: 'medium' // Could be calculated based on variance
  };
}

function generateAnalyticsRecommendations(analytics: any) {
  const recommendations = [];
  
  if (analytics.bounce_rate > 50) {
    recommendations.push({
      type: 'improvement',
      priority: 'high',
      message: 'High bounce rate detected. Consider improving your pitch opening or adding more engaging visuals.',
      metric: 'bounce_rate'
    });
  }
  
  if (analytics.conversion_rate < 2) {
    recommendations.push({
      type: 'opportunity',
      priority: 'medium',
      message: 'Low conversion rate. Consider adding clearer call-to-actions or investment terms.',
      metric: 'conversion_rate'
    });
  }
  
  if (analytics.avg_view_duration < 60) {
    recommendations.push({
      type: 'improvement',
      priority: 'high',
      message: 'Viewers are not staying long. Consider restructuring content for better engagement.',
      metric: 'avg_view_duration'
    });
  }
  
  return recommendations;
}