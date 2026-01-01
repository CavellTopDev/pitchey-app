import { Env } from '../types';
import postgres from 'postgres';
import { z } from 'zod';
import { getAuthUser } from '../utils/auth';
import { corsHeaders } from '../utils/cors';

// Schema for tracking a view
const TrackViewSchema = z.object({
  pitchId: z.string().uuid(),
  duration: z.number().optional(), // Duration in seconds
  referrer: z.string().optional(),
  userAgent: z.string().optional()
});

// Schema for view analytics query
const ViewAnalyticsSchema = z.object({
  pitchId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).optional()
});

/**
 * Track a view for a pitch
 */
export async function trackViewHandler(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const { pitchId, duration, referrer, userAgent } = TrackViewSchema.parse(body);
    
    // Get viewer info (may be null for anonymous views)
    const viewer = await getAuthUser(request, env);
    
    // Get IP address and session info
    const ip = request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For')?.split(',')[0] || 
               null;
    
    const sessionId = request.headers.get('X-Session-ID') || 
                     crypto.randomUUID(); // Generate if not provided
    
    // Get geo information from Cloudflare headers
    const country = request.headers.get('CF-IPCountry') || null;
    const city = request.headers.get('CF-IPCity') || null;
    
    // Detect device type from user agent
    const deviceType = detectDeviceType(userAgent || request.headers.get('User-Agent') || '');
    
    const sql = postgres(env.DATABASE_URL);
    
    // Check if this is a duplicate view (same session within 30 minutes)
    if (sessionId) {
      const recentView = await sql`
        SELECT id FROM views 
        WHERE pitch_id = ${pitchId}
        AND session_id = ${sessionId}
        AND viewed_at > NOW() - INTERVAL '30 minutes'
        LIMIT 1
      `;
      
      if (recentView.length > 0) {
        // Update duration if provided
        if (duration) {
          await sql`
            UPDATE views 
            SET duration_seconds = GREATEST(duration_seconds, ${duration})
            WHERE id = ${recentView[0].id}
          `;
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: 'View updated',
          duplicate: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Insert new view
    const [view] = await sql`
      INSERT INTO views (
        pitch_id,
        viewer_id,
        ip_address,
        user_agent,
        referrer,
        session_id,
        duration_seconds,
        country,
        city,
        device_type
      ) VALUES (
        ${pitchId},
        ${viewer?.id || null},
        ${ip}::inet,
        ${userAgent || request.headers.get('User-Agent') || null},
        ${referrer || request.headers.get('Referer') || null},
        ${sessionId},
        ${duration || 0},
        ${country},
        ${city},
        ${deviceType}
      )
      RETURNING id, viewed_at
    `;
    
    // Update pitch view count cache
    await sql`
      UPDATE pitches 
      SET view_count = (
        SELECT COUNT(*) FROM views WHERE pitch_id = ${pitchId}
      ),
      updated_at = NOW()
      WHERE id = ${pitchId}
    `;
    
    // Track unique viewers count
    const [stats] = await sql`
      SELECT 
        COUNT(*) as total_views,
        COUNT(DISTINCT COALESCE(viewer_id::text, ip_address::text)) as unique_viewers,
        AVG(duration_seconds) as avg_duration
      FROM views 
      WHERE pitch_id = ${pitchId}
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        viewId: view.id,
        viewedAt: view.viewed_at,
        stats: {
          totalViews: parseInt(stats.total_views),
          uniqueViewers: parseInt(stats.unique_viewers),
          avgDuration: Math.round(stats.avg_duration || 0)
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Track view error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to track view'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get view analytics for pitches
 */
export async function getViewAnalyticsHandler(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const query = ViewAnalyticsSchema.parse(params);
    
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const sql = postgres(env.DATABASE_URL);
    
    // Build query based on filters
    let whereConditions = [];
    let queryParams: any = {};
    
    if (query.pitchId) {
      whereConditions.push(`v.pitch_id = ${query.pitchId}`);
    }
    
    if (query.userId) {
      // For creators: show their pitch views
      // For others: show what they've viewed
      if (user.userType === 'creator') {
        whereConditions.push(`p.creator_id = ${query.userId}`);
      } else {
        whereConditions.push(`v.viewer_id = ${query.userId}`);
      }
    }
    
    if (query.startDate) {
      whereConditions.push(`v.viewed_at >= ${query.startDate}::date`);
    }
    
    if (query.endDate) {
      whereConditions.push(`v.viewed_at <= ${query.endDate}::date`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // Get aggregated analytics
    const groupBy = query.groupBy || 'day';
    const dateFormat = {
      hour: "DATE_TRUNC('hour', v.viewed_at)",
      day: "DATE_TRUNC('day', v.viewed_at)",
      week: "DATE_TRUNC('week', v.viewed_at)",
      month: "DATE_TRUNC('month', v.viewed_at)"
    }[groupBy];
    
    const analytics = await sql`
      SELECT 
        ${sql.unsafe(dateFormat)} as period,
        COUNT(*) as views,
        COUNT(DISTINCT COALESCE(v.viewer_id::text, v.ip_address::text)) as unique_viewers,
        AVG(v.duration_seconds)::integer as avg_duration,
        COUNT(DISTINCT v.country) as countries,
        COUNT(CASE WHEN v.device_type = 'mobile' THEN 1 END) as mobile_views,
        COUNT(CASE WHEN v.device_type = 'desktop' THEN 1 END) as desktop_views,
        COUNT(CASE WHEN v.device_type = 'tablet' THEN 1 END) as tablet_views
      FROM views v
      LEFT JOIN pitches p ON p.id = v.pitch_id
      ${sql.unsafe(whereClause)}
      GROUP BY period
      ORDER BY period DESC
      LIMIT 100
    `;
    
    // Get top viewers for creator's pitches
    let topViewers = [];
    if (user.userType === 'creator') {
      topViewers = await sql`
        SELECT 
          u.id,
          u.username,
          u.user_type,
          COUNT(*) as view_count,
          MAX(v.viewed_at) as last_viewed
        FROM views v
        JOIN pitches p ON p.id = v.pitch_id
        LEFT JOIN users u ON u.id = v.viewer_id
        WHERE p.creator_id = ${user.id}
        AND v.viewer_id IS NOT NULL
        GROUP BY u.id, u.username, u.user_type
        ORDER BY view_count DESC
        LIMIT 10
      `;
    }
    
    // Get view sources
    const sources = await sql`
      SELECT 
        COALESCE(v.referrer, 'Direct') as source,
        COUNT(*) as count
      FROM views v
      LEFT JOIN pitches p ON p.id = v.pitch_id
      ${sql.unsafe(whereClause)}
      GROUP BY source
      ORDER BY count DESC
      LIMIT 10
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        analytics,
        topViewers,
        sources,
        summary: {
          totalViews: analytics.reduce((sum, a) => sum + parseInt(a.views), 0),
          uniqueViewers: analytics.reduce((sum, a) => sum + parseInt(a.unique_viewers), 0),
          avgDuration: Math.round(
            analytics.reduce((sum, a) => sum + (a.avg_duration || 0), 0) / analytics.length || 0
          )
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Get view analytics error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to get analytics'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get viewers for a specific pitch
 */
export async function getPitchViewersHandler(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pitchId = url.pathname.split('/').pop();
    
    if (!pitchId) {
      return new Response(JSON.stringify({ error: 'Pitch ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const user = await getAuthUser(request, env);
    const sql = postgres(env.DATABASE_URL);
    
    // Check if user owns this pitch or has NDA access
    const [pitch] = await sql`
      SELECT 
        p.id,
        p.creator_id,
        p.requires_nda,
        CASE 
          WHEN p.creator_id = ${user?.id || null} THEN true
          WHEN NOT p.requires_nda THEN true
          WHEN EXISTS (
            SELECT 1 FROM ndas 
            WHERE pitch_id = p.id 
            AND requester_id = ${user?.id || null}
            AND status = 'signed'
          ) THEN true
          ELSE false
        END as has_access
      FROM pitches p
      WHERE p.id = ${pitchId}
    `;
    
    if (!pitch || !pitch.has_access) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get viewers list (anonymize if not owner)
    const isOwner = pitch.creator_id === user?.id;
    
    const viewers = await sql`
      SELECT 
        ${isOwner ? sql`v.id` : sql`NULL as id`},
        ${isOwner ? sql`u.id as user_id` : sql`NULL as user_id`},
        ${isOwner ? sql`u.username` : sql`'Anonymous' as username`},
        ${isOwner ? sql`u.user_type` : sql`NULL as user_type`},
        v.viewed_at,
        v.duration_seconds,
        v.device_type,
        v.country,
        COUNT(*) OVER (PARTITION BY COALESCE(v.viewer_id, v.ip_address)) as visit_count
      FROM views v
      LEFT JOIN users u ON u.id = v.viewer_id
      WHERE v.pitch_id = ${pitchId}
      ORDER BY v.viewed_at DESC
      LIMIT 100
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        viewers,
        isOwner
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Get pitch viewers error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to get viewers'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Helper function to detect device type
function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/smart-tv|tv/i.test(ua)) return 'tv';
  return 'desktop';
}