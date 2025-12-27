/**
 * Analytics and metrics database queries using raw SQL
 * Replaces Drizzle ORM with parameterized Neon queries
 */

import type { SqlQuery } from './base';
import { WhereBuilder, extractFirst, extractMany, DatabaseError } from './base';

// Type definitions
export interface PitchAnalytics {
  pitch_id: string;
  view_count: number;
  unique_viewers: number;
  save_count: number;
  share_count: number;
  avg_view_duration: number;
  bounce_rate: number;
  engagement_score: number;
  conversion_rate: number;
}

export interface UserAnalytics {
  user_id: string;
  total_pitches: number;
  total_views: number;
  total_investments: number;
  avg_engagement: number;
  growth_rate: number;
  active_days: number;
}

export interface PlatformMetrics {
  total_users: number;
  active_users: number;
  total_pitches: number;
  total_investments: number;
  total_revenue: number;
  conversion_rate: number;
  churn_rate: number;
  growth_rate: number;
}

export interface ViewEvent {
  id: string;
  pitch_id: string;
  viewer_id?: string;
  session_id: string;
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
  duration_seconds: number;
  bounce: boolean;
  created_at: Date;
}

// View tracking
export async function trackPitchView(
  sql: SqlQuery,
  pitchId: string,
  viewerId?: string,
  sessionId?: string,
  metadata?: {
    ip_address?: string;
    user_agent?: string;
    referrer?: string;
  }
): Promise<ViewEvent> {
  const result = await sql`
    INSERT INTO view_events (
      pitch_id, viewer_id, session_id,
      ip_address, user_agent, referrer,
      duration_seconds, bounce, created_at
    ) VALUES (
      ${pitchId}, ${viewerId || null}, ${sessionId || crypto.randomUUID()},
      ${metadata?.ip_address || null}, ${metadata?.user_agent || null}, 
      ${metadata?.referrer || null},
      0, false, NOW()
    )
    RETURNING *
  `;
  
  const event = extractFirst<ViewEvent>(result);
  if (!event) {
    throw new DatabaseError('Failed to track view');
  }

  // Update pitch view count
  await sql`
    UPDATE pitches 
    SET 
      view_count = view_count + 1,
      updated_at = NOW()
    WHERE id = ${pitchId}
  `;

  return event;
}

export async function updateViewDuration(
  sql: SqlQuery,
  viewEventId: string,
  durationSeconds: number,
  bounce: boolean
): Promise<void> {
  await sql`
    UPDATE view_events
    SET 
      duration_seconds = ${durationSeconds},
      bounce = ${bounce}
    WHERE id = ${viewEventId}
  `;
}

// Pitch analytics
export async function getPitchAnalytics(
  sql: SqlQuery,
  pitchId: string,
  startDate?: Date,
  endDate?: Date
): Promise<PitchAnalytics> {
  const wb = new WhereBuilder();
  wb.add('ve.pitch_id = $param', pitchId);
  wb.addOptional('ve.created_at', '>=', startDate);
  wb.addOptional('ve.created_at', '<=', endDate);
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT 
      $1 as pitch_id,
      COUNT(*)::int as view_count,
      COUNT(DISTINCT COALESCE(ve.viewer_id, ve.session_id))::int as unique_viewers,
      (SELECT COUNT(*) FROM saved_pitches WHERE pitch_id = $1)::int as save_count,
      0 as share_count, -- Implement share tracking
      COALESCE(AVG(ve.duration_seconds), 0) as avg_view_duration,
      (COUNT(CASE WHEN ve.bounce = true THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100) as bounce_rate,
      COALESCE(
        (COUNT(CASE WHEN ve.duration_seconds > 30 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100),
        0
      ) as engagement_score,
      (
        SELECT COUNT(*)::float / NULLIF(COUNT(DISTINCT ve.viewer_id), 0) * 100
        FROM investments i
        WHERE i.pitch_id = $1
          AND i.status IN ('committed', 'funded')
      ) as conversion_rate
    FROM view_events ve
    ${where}
  `;
  
  const result = await sql(query, params);
  const analytics = extractFirst<PitchAnalytics>(result);
  
  if (!analytics) {
    // Return empty analytics if no data
    return {
      pitch_id: pitchId,
      view_count: 0,
      unique_viewers: 0,
      save_count: 0,
      share_count: 0,
      avg_view_duration: 0,
      bounce_rate: 0,
      engagement_score: 0,
      conversion_rate: 0
    };
  }
  
  return analytics;
}

export async function getTopPerformingPitches(
  sql: SqlQuery,
  limit: number = 10,
  metric: 'views' | 'engagement' | 'conversion' = 'views',
  startDate?: Date,
  endDate?: Date
): Promise<Array<{
  pitch_id: string;
  title: string;
  creator_username: string;
  metric_value: number;
}>> {
  const wb = new WhereBuilder();
  wb.addOptional('ve.created_at', '>=', startDate);
  wb.addOptional('ve.created_at', '<=', endDate);
  
  const { where, params } = wb.build();
  
  const orderBy = {
    views: 'view_count DESC',
    engagement: 'engagement_score DESC',
    conversion: 'conversion_rate DESC'
  }[metric];
  
  const query = `
    SELECT 
      p.id as pitch_id,
      p.title,
      u.username as creator_username,
      CASE 
        WHEN '${metric}' = 'views' THEN COUNT(ve.*)::float
        WHEN '${metric}' = 'engagement' THEN 
          COALESCE(AVG(ve.duration_seconds), 0)::float
        WHEN '${metric}' = 'conversion' THEN 
          (
            SELECT COUNT(*)::float / NULLIF(COUNT(DISTINCT ve.viewer_id), 0) * 100
            FROM investments i
            WHERE i.pitch_id = p.id
              AND i.status IN ('committed', 'funded')
          )
      END as metric_value
    FROM pitches p
    LEFT JOIN view_events ve ON ve.pitch_id = p.id
    LEFT JOIN users u ON p.creator_id = u.id
    ${where.replace('WHERE', where.includes('WHERE') ? 'AND' : 'WHERE')}
    GROUP BY p.id, p.title, u.username
    ORDER BY ${orderBy}
    LIMIT ${limit}
  `;
  
  const result = await sql(query, params);
  return extractMany<any>(result);
}

// User analytics
export async function getUserAnalytics(
  sql: SqlQuery,
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<UserAnalytics> {
  const wb = new WhereBuilder();
  wb.addOptional('created_at', '>=', startDate);
  wb.addOptional('created_at', '<=', endDate);
  
  const { where } = wb.build();
  
  const result = await sql`
    SELECT 
      ${userId} as user_id,
      (SELECT COUNT(*) FROM pitches WHERE creator_id = ${userId})::int as total_pitches,
      (
        SELECT SUM(view_count) FROM pitches 
        WHERE creator_id = ${userId}
      )::int as total_views,
      (
        SELECT COUNT(*) FROM investments 
        WHERE investor_id = ${userId} 
          AND status IN ('committed', 'funded')
      )::int as total_investments,
      (
        SELECT AVG(
          CASE 
            WHEN view_count > 0 THEN 
              (save_count::float / view_count * 100)
            ELSE 0
          END
        )
        FROM pitches 
        WHERE creator_id = ${userId}
      ) as avg_engagement,
      0 as growth_rate, -- Calculate based on time period
      (
        SELECT COUNT(DISTINCT DATE(created_at))::int
        FROM (
          SELECT created_at FROM pitches WHERE creator_id = ${userId}
          UNION ALL
          SELECT created_at FROM messages WHERE sender_id = ${userId}
          UNION ALL
          SELECT created_at FROM investments WHERE investor_id = ${userId}
        ) activity
        ${where}
      ) as active_days
  `;
  
  const analytics = extractFirst<UserAnalytics>(result);
  
  if (!analytics) {
    return {
      user_id: userId,
      total_pitches: 0,
      total_views: 0,
      total_investments: 0,
      avg_engagement: 0,
      growth_rate: 0,
      active_days: 0
    };
  }
  
  return analytics;
}

export async function getUserEngagementHistory(
  sql: SqlQuery,
  userId: string,
  days: number = 30
): Promise<Array<{
  date: string;
  pitches_created: number;
  pitches_viewed: number;
  messages_sent: number;
  investments_made: number;
}>> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const result = await sql`
    WITH date_series AS (
      SELECT generate_series(
        ${startDate}::date,
        CURRENT_DATE,
        '1 day'::interval
      )::date AS date
    ),
    daily_activity AS (
      SELECT 
        DATE(created_at) as activity_date,
        COUNT(CASE WHEN creator_id = ${userId} THEN 1 END) as pitches_created,
        0 as pitches_viewed,
        0 as messages_sent,
        0 as investments_made
      FROM pitches
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      
      UNION ALL
      
      SELECT 
        DATE(created_at) as activity_date,
        0 as pitches_created,
        COUNT(*) as pitches_viewed,
        0 as messages_sent,
        0 as investments_made
      FROM view_events
      WHERE viewer_id = ${userId} AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      
      UNION ALL
      
      SELECT 
        DATE(sent_at) as activity_date,
        0 as pitches_created,
        0 as pitches_viewed,
        COUNT(*) as messages_sent,
        0 as investments_made
      FROM messages
      WHERE sender_id = ${userId} AND sent_at >= ${startDate}
      GROUP BY DATE(sent_at)
      
      UNION ALL
      
      SELECT 
        DATE(created_at) as activity_date,
        0 as pitches_created,
        0 as pitches_viewed,
        0 as messages_sent,
        COUNT(*) as investments_made
      FROM investments
      WHERE investor_id = ${userId} AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
    )
    SELECT 
      ds.date::text,
      COALESCE(SUM(da.pitches_created), 0)::int as pitches_created,
      COALESCE(SUM(da.pitches_viewed), 0)::int as pitches_viewed,
      COALESCE(SUM(da.messages_sent), 0)::int as messages_sent,
      COALESCE(SUM(da.investments_made), 0)::int as investments_made
    FROM date_series ds
    LEFT JOIN daily_activity da ON ds.date = da.activity_date
    GROUP BY ds.date
    ORDER BY ds.date ASC
  `;
  
  return extractMany<any>(result);
}

// Platform metrics
export async function getPlatformMetrics(
  sql: SqlQuery,
  startDate?: Date,
  endDate?: Date
): Promise<PlatformMetrics> {
  const wb = new WhereBuilder();
  wb.addOptional('created_at', '>=', startDate);
  wb.addOptional('created_at', '<=', endDate);
  
  const { where, params } = wb.build();
  
  const result = await sql`
    SELECT 
      (SELECT COUNT(*) FROM users)::int as total_users,
      (
        SELECT COUNT(DISTINCT user_id) FROM (
          SELECT creator_id as user_id FROM pitches ${where}
          UNION
          SELECT sender_id as user_id FROM messages 
            WHERE sent_at >= ${startDate || '1970-01-01'} 
              AND sent_at <= ${endDate || 'NOW()'}
          UNION
          SELECT investor_id as user_id FROM investments ${where}
        ) active
      )::int as active_users,
      (SELECT COUNT(*) FROM pitches)::int as total_pitches,
      (SELECT COUNT(*) FROM investments WHERE status IN ('committed', 'funded'))::int as total_investments,
      (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE status = 'funded') as total_revenue,
      (
        SELECT COUNT(*)::float / NULLIF(COUNT(DISTINCT viewer_id), 0) * 100
        FROM investments i
        JOIN view_events ve ON i.pitch_id = ve.pitch_id
        WHERE i.status IN ('committed', 'funded')
      ) as conversion_rate,
      0 as churn_rate, -- Calculate based on subscription data
      0 as growth_rate -- Calculate based on time period comparison
  `;
  
  const metrics = extractFirst<PlatformMetrics>(result);
  
  if (!metrics) {
    return {
      total_users: 0,
      active_users: 0,
      total_pitches: 0,
      total_investments: 0,
      total_revenue: 0,
      conversion_rate: 0,
      churn_rate: 0,
      growth_rate: 0
    };
  }
  
  return metrics;
}

export async function getDashboardMetrics(
  sql: SqlQuery,
  userId: string,
  userType: 'creator' | 'investor' | 'production'
): Promise<Record<string, any>> {
  if (userType === 'creator') {
    const result = await sql`
      SELECT 
        (SELECT COUNT(*) FROM pitches WHERE creator_id = ${userId})::int as total_pitches,
        (SELECT SUM(view_count) FROM pitches WHERE creator_id = ${userId})::int as total_views,
        (SELECT COUNT(*) FROM follows WHERE following_id = ${userId})::int as total_followers,
        (
          SELECT COUNT(*) FROM investments i
          JOIN pitches p ON i.pitch_id = p.id
          WHERE p.creator_id = ${userId}
            AND i.status IN ('committed', 'funded')
        )::int as total_investors,
        (
          SELECT COALESCE(SUM(i.amount), 0)
          FROM investments i
          JOIN pitches p ON i.pitch_id = p.id
          WHERE p.creator_id = ${userId}
            AND i.status = 'funded'
        ) as total_funding,
        (
          SELECT COUNT(*) FROM nda_requests nr
          JOIN pitches p ON nr.pitch_id = p.id
          WHERE p.creator_id = ${userId}
            AND nr.status = 'pending'
        )::int as pending_ndas
    `;
    return extractFirst<any>(result) || {};
  } else if (userType === 'investor') {
    const result = await sql`
      SELECT 
        (SELECT COUNT(*) FROM investments WHERE investor_id = ${userId})::int as total_investments,
        (
          SELECT COALESCE(SUM(amount), 0) 
          FROM investments 
          WHERE investor_id = ${userId}
            AND status = 'funded'
        ) as total_invested,
        (
          SELECT COUNT(*) FROM investments 
          WHERE investor_id = ${userId}
            AND status IN ('committed', 'funded')
        )::int as active_investments,
        (SELECT COUNT(*) FROM saved_pitches WHERE user_id = ${userId})::int as saved_pitches,
        (
          SELECT COUNT(*) FROM nda_requests 
          WHERE requester_id = ${userId}
            AND status = 'approved'
        )::int as signed_ndas,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ${userId})::int as following_count
    `;
    return extractFirst<any>(result) || {};
  } else if (userType === 'production') {
    const result = await sql`
      SELECT 
        (
          SELECT COUNT(*) FROM pitches p
          JOIN production_interested pi ON pi.pitch_id = p.id
          WHERE pi.production_company_id = ${userId}
        )::int as interested_projects,
        (
          SELECT COUNT(*) FROM pitches p
          WHERE p.production_status = 'in_development'
            AND EXISTS (
              SELECT 1 FROM production_deals pd
              WHERE pd.pitch_id = p.id AND pd.production_company_id = ${userId}
            )
        )::int as projects_in_development,
        (
          SELECT COUNT(*) FROM pitches p
          WHERE p.production_status = 'in_production'
            AND EXISTS (
              SELECT 1 FROM production_deals pd
              WHERE pd.pitch_id = p.id AND pd.production_company_id = ${userId}
            )
        )::int as projects_in_production,
        (
          SELECT COALESCE(SUM(budget_amount), 0)
          FROM production_deals
          WHERE production_company_id = ${userId}
        ) as total_budget,
        (SELECT COUNT(*) FROM messages WHERE sender_id = ${userId})::int as messages_sent,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ${userId})::int as following_count
    `;
    return extractFirst<any>(result) || {};
  }
  
  return {};
}

// Revenue analytics
export async function getRevenueAnalytics(
  sql: SqlQuery,
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'week' | 'month' = 'month'
): Promise<Array<{
  period: string;
  subscription_revenue: number;
  investment_fees: number;
  total_revenue: number;
  new_subscribers: number;
  churned_subscribers: number;
}>> {
  const dateFormat = {
    'day': 'YYYY-MM-DD',
    'week': 'YYYY-WW',
    'month': 'YYYY-MM'
  }[groupBy];

  const result = await sql`
    SELECT 
      TO_CHAR(created_at, ${dateFormat}) as period,
      0 as subscription_revenue, -- Implement based on payment data
      0 as investment_fees, -- Implement based on fee structure
      0 as total_revenue,
      COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as new_subscribers,
      COUNT(CASE WHEN subscription_status = 'cancelled' THEN 1 END) as churned_subscribers
    FROM users
    WHERE created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY period
    ORDER BY period ASC
  `;
  
  return extractMany<any>(result);
}

// Search analytics
export async function trackSearchQuery(
  sql: SqlQuery,
  query: string,
  userId?: string,
  resultCount: number = 0,
  metadata?: Record<string, any>
): Promise<void> {
  await sql`
    INSERT INTO search_queries (
      query_text, user_id, result_count,
      metadata, created_at
    ) VALUES (
      ${query}, ${userId || null}, ${resultCount},
      ${metadata || null}::jsonb, NOW()
    )
  `;
}

export async function getPopularSearches(
  sql: SqlQuery,
  limit: number = 20,
  days: number = 7
): Promise<Array<{
  query: string;
  search_count: number;
  avg_results: number;
  click_through_rate: number;
}>> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const result = await sql`
    SELECT 
      query_text as query,
      COUNT(*) as search_count,
      AVG(result_count) as avg_results,
      0 as click_through_rate -- Implement click tracking
    FROM search_queries
    WHERE created_at >= ${startDate}
    GROUP BY query_text
    ORDER BY search_count DESC
    LIMIT ${limit}
  `;
  
  return extractMany<any>(result);
}

// Performance metrics
export async function getPerformanceMetrics(
  sql: SqlQuery
): Promise<{
  avg_response_time: number;
  error_rate: number;
  cache_hit_rate: number;
  active_connections: number;
}> {
  // This would typically integrate with APM tools
  // Placeholder implementation
  return {
    avg_response_time: 0,
    error_rate: 0,
    cache_hit_rate: 0,
    active_connections: 0
  };
}