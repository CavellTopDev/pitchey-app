/**
 * Creator Dashboard Handler - Comprehensive Creator Portal Features
 * Includes Revenue Dashboard, Contract Management, Pitch Analytics, and more
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import * as pitchQueries from '../db/queries/pitches';
import * as investmentQueries from '../db/queries/investments';
import * as analyticsQueries from '../db/queries/analytics';
import * as documentQueries from '../db/queries/documents';
import * as notificationQueries from '../db/queries/notifications';
import * as messagingQueries from '../db/queries/messaging';
import * as userQueries from '../db/queries/users';

// GET /api/creator/dashboard - Main creator dashboard data
export async function creatorDashboardHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '1';
  const sql = getDb(env);
  
  if (!sql) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Database unavailable' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Fetch all dashboard metrics in parallel
    const [
      userStats,
      recentPitches,
      analytics,
      pendingNDAs,
      recentInvestments,
      notifications
    ] = await Promise.all([
      userQueries.getUserStats(sql, userId),
      pitchQueries.getCreatorPitches(sql, userId, { limit: 5 }),
      analyticsQueries.getUserAnalytics(sql, userId),
      documentQueries.getUserNDARequests(sql, userId, 'received'),
      investmentQueries.getInvestorPortfolio(sql, userId, { limit: 5 }),
      notificationQueries.getUserNotifications(sql, userId, { limit: 5 })
    ]);

    // Calculate revenue metrics
    const revenueData = await getRevenueMetrics(sql, userId);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        overview: {
          totalPitches: userStats.totalPitches,
          totalViews: analytics.total_views,
          totalFollowers: userStats.totalFollowers,
          totalInvestments: recentInvestments.length,
          activeDeals: pendingNDAs.filter(n => n.status === 'approved').length,
          pendingActions: pendingNDAs.filter(n => n.status === 'pending').length
        },
        revenue: revenueData,
        recentPitches,
        recentActivity: {
          investments: recentInvestments,
          ndaRequests: pendingNDAs.slice(0, 5),
          notifications: notifications
        },
        analytics: {
          viewTrend: await getViewTrend(sql, userId),
          engagementRate: analytics.avg_engagement,
          topPerformingPitch: recentPitches[0] // Simplified - should get actual top performer
        }
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60'
      }
    });
    
  } catch (error) {
    console.error('Creator dashboard error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to load dashboard' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/creator/revenue - Revenue Dashboard
export async function creatorRevenueHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '1';
  const period = url.searchParams.get('period') || '30'; // days
  const sql = getDb(env);
  
  if (!sql) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Database unavailable' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const startDate = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000);
    const endDate = new Date();
    
    // Get investment trends for creator's pitches
    const investmentTrends = await sql`
      SELECT 
        DATE_TRUNC('day', i.created_at) as date,
        COUNT(*) as deal_count,
        SUM(i.amount) as total_amount,
        AVG(i.amount) as avg_amount,
        i.investment_type,
        i.status
      FROM investments i
      JOIN pitches p ON i.pitch_id = p.id
      WHERE p.creator_id = ${userId}
        AND i.created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY DATE_TRUNC('day', i.created_at), i.investment_type, i.status
      ORDER BY date DESC
    `;
    
    // Get revenue breakdown
    const revenueBreakdown = await sql`
      SELECT 
        i.investment_type,
        i.status,
        COUNT(*) as count,
        SUM(i.amount) as total,
        AVG(i.amount) as average,
        MIN(i.amount) as minimum,
        MAX(i.amount) as maximum
      FROM investments i
      JOIN pitches p ON i.pitch_id = p.id
      WHERE p.creator_id = ${userId}
        AND i.created_at BETWEEN ${startDate} AND ${endDate}
      GROUP BY i.investment_type, i.status
    `;
    
    // Get investor demographics
    const investorDemographics = await sql`
      SELECT 
        u.location,
        u.company_name,
        COUNT(DISTINCT u.id) as investor_count,
        SUM(i.amount) as total_invested
      FROM investments i
      JOIN pitches p ON i.pitch_id = p.id
      JOIN users u ON i.investor_id = u.id
      WHERE p.creator_id = ${userId}
        AND i.status IN ('committed', 'funded')
      GROUP BY u.location, u.company_name
      ORDER BY total_invested DESC
      LIMIT 20
    `;
    
    // Calculate projections
    const projections = calculateRevenueProjections(investmentTrends);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        summary: {
          totalRevenue: revenueBreakdown.reduce((sum: number, r: any) => 
            r.status === 'funded' ? sum + Number(r.total) : sum, 0),
          committedFunds: revenueBreakdown.reduce((sum: number, r: any) => 
            r.status === 'committed' ? sum + Number(r.total) : sum, 0),
          pendingDeals: revenueBreakdown.reduce((sum: number, r: any) => 
            r.status === 'pending' ? sum + Number(r.total) : sum, 0),
          averageDealSize: revenueBreakdown.reduce((sum: number, r: any) => 
            sum + Number(r.average), 0) / revenueBreakdown.length || 0
        },
        trends: investmentTrends,
        breakdown: revenueBreakdown,
        investorDemographics,
        projections
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300'
      }
    });
    
  } catch (error) {
    console.error('Revenue dashboard error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to load revenue data' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/creator/contracts - Contract Management
export async function creatorContractsHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '1';
  const status = url.searchParams.get('status'); // active, pending, completed
  const sql = getDb(env);
  
  if (!sql) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Database unavailable' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get all contracts/deals for creator's pitches
    const contracts = await sql`
      SELECT 
        i.id as contract_id,
        i.pitch_id,
        p.title as pitch_title,
        i.investor_id,
        u.username as investor_name,
        u.company_name as investor_company,
        i.amount,
        i.currency,
        i.investment_type,
        i.status as contract_status,
        i.equity_percentage,
        i.valuation,
        i.terms,
        i.notes,
        i.committed_at,
        i.funded_at,
        i.created_at as initiated_at,
        i.updated_at as last_updated,
        COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', id.id,
              'type', id.document_type,
              'name', id.document_name,
              'url', id.document_url,
              'is_signed', id.is_signed,
              'signed_at', id.signed_at
            )
          )
          FROM investment_documents id
          WHERE id.investment_id = i.id
          ), '[]'::jsonb
        ) as documents,
        COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'date', m.sent_at,
              'content', m.content,
              'sender', CASE 
                WHEN m.sender_id = ${userId} THEN 'You'
                ELSE u2.username
              END
            )
          )
          FROM messages m
          JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
          LEFT JOIN users u2 ON m.sender_id = u2.id
          WHERE cp.user_id IN (${userId}, i.investor_id)
            AND m.metadata->>'contract_id' = i.id::text
          ORDER BY m.sent_at DESC
          LIMIT 5
          ), '[]'::jsonb
        ) as recent_communications
      FROM investments i
      JOIN pitches p ON i.pitch_id = p.id
      JOIN users u ON i.investor_id = u.id
      WHERE p.creator_id = ${userId}
        ${status ? sql`AND i.status = ${status}` : sql``}
      ORDER BY i.updated_at DESC
    `;
    
    // Get contract statistics
    const stats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'committed') as active_count,
        COUNT(*) FILTER (WHERE status = 'funded') as completed_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        SUM(amount) FILTER (WHERE status = 'funded') as total_completed_value,
        SUM(amount) FILTER (WHERE status IN ('committed', 'pending')) as total_pipeline_value
      FROM investments i
      JOIN pitches p ON i.pitch_id = p.id
      WHERE p.creator_id = ${userId}
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        contracts,
        statistics: stats[0],
        alerts: await getContractAlerts(sql, userId)
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60'
      }
    });
    
  } catch (error) {
    console.error('Contracts error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to load contracts' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/creator/analytics/:pitchId - Detailed Pitch Analytics
export async function creatorPitchAnalyticsHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const pitchId = pathParts[pathParts.length - 1];
  const period = url.searchParams.get('period') || '30';
  const sql = getDb(env);
  
  if (!sql) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Database unavailable' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const startDate = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000);
    
    // Get comprehensive analytics
    const [
      pitchAnalytics,
      viewHistory,
      investmentStats,
      documentStats,
      audienceDemographics
    ] = await Promise.all([
      analyticsQueries.getPitchAnalytics(sql, pitchId, startDate),
      getViewHistory(sql, pitchId, startDate),
      investmentQueries.getPitchInvestmentStats(sql, pitchId),
      documentQueries.getDocumentStats(sql, pitchId),
      getAudienceDemographics(sql, pitchId)
    ]);
    
    // Get conversion funnel
    const conversionFunnel = await sql`
      SELECT 
        COUNT(DISTINCT ve.viewer_id) as total_viewers,
        COUNT(DISTINCT sp.user_id) as saved_by_users,
        COUNT(DISTINCT nr.requester_id) as nda_requests,
        COUNT(DISTINCT CASE WHEN nr.status = 'approved' THEN nr.requester_id END) as nda_approved,
        COUNT(DISTINCT ii.investor_id) as showed_interest,
        COUNT(DISTINCT i.investor_id) as made_investment
      FROM view_events ve
      LEFT JOIN saved_pitches sp ON sp.pitch_id = ${pitchId}
      LEFT JOIN nda_requests nr ON nr.pitch_id = ${pitchId}
      LEFT JOIN investment_interests ii ON ii.pitch_id = ${pitchId}
      LEFT JOIN investments i ON i.pitch_id = ${pitchId}
      WHERE ve.pitch_id = ${pitchId}
        AND ve.created_at >= ${startDate}
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        overview: pitchAnalytics,
        viewHistory,
        investment: investmentStats,
        documents: documentStats,
        audience: audienceDemographics,
        funnel: conversionFunnel[0],
        recommendations: generateAnalyticsRecommendations(pitchAnalytics)
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300'
      }
    });
    
  } catch (error) {
    console.error('Pitch analytics error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to load analytics' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET /api/creator/investors - Investor Relations Management
export async function creatorInvestorsHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '1';
  const filter = url.searchParams.get('filter'); // active, potential, past
  const sql = getDb(env);
  
  if (!sql) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Database unavailable' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get investors based on filter
    let investors;
    if (filter === 'active') {
      // Active investors with current investments
      investors = await sql`
        SELECT DISTINCT ON (u.id)
          u.id,
          u.username,
          u.email,
          u.company_name,
          u.profile_image,
          u.location,
          u.bio,
          COUNT(DISTINCT i.id) as total_investments,
          SUM(i.amount) as total_invested,
          MAX(i.created_at) as last_investment,
          MIN(i.created_at) as first_investment,
          array_agg(DISTINCT p.title) as invested_pitches,
          CASE 
            WHEN MAX(i.created_at) > NOW() - INTERVAL '30 days' THEN 'highly_active'
            WHEN MAX(i.created_at) > NOW() - INTERVAL '90 days' THEN 'active'
            ELSE 'inactive'
          END as activity_status
        FROM users u
        JOIN investments i ON i.investor_id = u.id
        JOIN pitches p ON i.pitch_id = p.id
        WHERE p.creator_id = ${userId}
          AND i.status IN ('committed', 'funded')
        GROUP BY u.id
        ORDER BY u.id, total_invested DESC
      `;
    } else if (filter === 'potential') {
      // Potential investors who showed interest
      investors = await sql`
        SELECT DISTINCT ON (u.id)
          u.id,
          u.username,
          u.email,
          u.company_name,
          u.profile_image,
          u.location,
          u.bio,
          COUNT(DISTINCT ve.pitch_id) as pitches_viewed,
          COUNT(DISTINCT sp.pitch_id) as pitches_saved,
          COUNT(DISTINCT nr.pitch_id) as nda_requests,
          MAX(ve.created_at) as last_view,
          array_agg(DISTINCT p.title) as interested_pitches,
          'potential' as activity_status
        FROM users u
        LEFT JOIN view_events ve ON ve.viewer_id = u.id
        LEFT JOIN saved_pitches sp ON sp.user_id = u.id
        LEFT JOIN nda_requests nr ON nr.requester_id = u.id
        JOIN pitches p ON p.id IN (ve.pitch_id, sp.pitch_id, nr.pitch_id)
        WHERE p.creator_id = ${userId}
          AND u.user_type = 'investor'
          AND NOT EXISTS (
            SELECT 1 FROM investments i2 
            WHERE i2.investor_id = u.id 
              AND i2.pitch_id = p.id
          )
        GROUP BY u.id
        HAVING COUNT(DISTINCT ve.pitch_id) > 0 
           OR COUNT(DISTINCT sp.pitch_id) > 0
           OR COUNT(DISTINCT nr.pitch_id) > 0
        ORDER BY u.id, last_view DESC
      `;
    } else {
      // All investors
      investors = await sql`
        SELECT DISTINCT ON (u.id)
          u.id,
          u.username,
          u.email,
          u.company_name,
          u.profile_image,
          u.location,
          u.bio,
          COALESCE(inv_stats.total_investments, 0) as total_investments,
          COALESCE(inv_stats.total_invested, 0) as total_invested,
          COALESCE(view_stats.total_views, 0) as total_views,
          COALESCE(inv_stats.last_activity, view_stats.last_activity) as last_activity
        FROM users u
        LEFT JOIN (
          SELECT 
            i.investor_id,
            COUNT(*) as total_investments,
            SUM(i.amount) as total_invested,
            MAX(i.created_at) as last_activity
          FROM investments i
          JOIN pitches p ON i.pitch_id = p.id
          WHERE p.creator_id = ${userId}
          GROUP BY i.investor_id
        ) inv_stats ON inv_stats.investor_id = u.id
        LEFT JOIN (
          SELECT 
            ve.viewer_id,
            COUNT(*) as total_views,
            MAX(ve.created_at) as last_activity
          FROM view_events ve
          JOIN pitches p ON ve.pitch_id = p.id
          WHERE p.creator_id = ${userId}
          GROUP BY ve.viewer_id
        ) view_stats ON view_stats.viewer_id = u.id
        WHERE u.user_type = 'investor'
          AND (inv_stats.investor_id IS NOT NULL OR view_stats.viewer_id IS NOT NULL)
        ORDER BY u.id, COALESCE(inv_stats.total_invested, 0) DESC
      `;
    }
    
    // Get communication history summary
    const communicationSummary = await sql`
      SELECT 
        cp.user_id as investor_id,
        COUNT(DISTINCT m.id) as message_count,
        MAX(m.sent_at) as last_message,
        COUNT(DISTINCT m.id) FILTER (WHERE m.sender_id = ${userId}) as sent_messages,
        COUNT(DISTINCT m.id) FILTER (WHERE m.sender_id != ${userId}) as received_messages
      FROM conversation_participants cp
      JOIN messages m ON m.conversation_id = cp.conversation_id
      WHERE cp.user_id IN (SELECT id FROM users WHERE user_type = 'investor')
        AND EXISTS (
          SELECT 1 FROM conversation_participants cp2 
          WHERE cp2.conversation_id = cp.conversation_id 
            AND cp2.user_id = ${userId}
        )
      GROUP BY cp.user_id
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        investors,
        communicationSummary,
        stats: {
          totalInvestors: investors.length,
          activeInvestors: investors.filter((i: any) => i.activity_status === 'active').length,
          totalRaised: investors.reduce((sum: number, i: any) => sum + Number(i.total_invested || 0), 0)
        }
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=120'
      }
    });
    
  } catch (error) {
    console.error('Investors error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to load investors' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
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
  const alerts = [];
  
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