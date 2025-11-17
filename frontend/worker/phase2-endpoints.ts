import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import { Env } from './index';

// Import JWT verification from main file
async function verifyJWT(token: string, secret: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expectedSignature = new Uint8Array(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map(char => char.charCodeAt(0))
  );
  
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    expectedSignature,
    encoder.encode(data)
  );
  
  if (!isValid) {
    throw new Error('Invalid JWT signature');
  }
  
  return JSON.parse(atob(payload));
}

// Helper to verify JWT and get user info
async function getUserFromAuth(request: Request, env: Env): Promise<{ id: number; userType: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  try {
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    return { id: payload.id, userType: payload.userType };
  } catch {
    return null;
  }
}

export function setupPhase2Endpoints(
  request: Request,
  env: Env,
  sql: ReturnType<typeof neon>,
  redis: Redis | null,
  url: URL,
  corsHeaders: Record<string, string>
): Response | null {

  // ============= INVESTMENT MANAGEMENT (NO PAYMENTS) =============
  
  // Track investment interest (without actual payment)
  if (url.pathname === '/api/investments/track-interest' && request.method === 'POST') {
    return handleTrackInvestmentInterest(request, sql, env, redis, corsHeaders);
  }

  // Get investment opportunities
  if (url.pathname === '/api/investor/opportunities' && request.method === 'GET') {
    return handleGetInvestmentOpportunities(request, sql, url, corsHeaders);
  }

  // Get investor portfolio summary
  if (url.pathname === '/api/investor/portfolio' && request.method === 'GET') {
    return handleGetInvestorPortfolio(request, sql, env, corsHeaders);
  }

  // Investor watchlist management
  if (url.pathname === '/api/investor/watchlist' && request.method === 'GET') {
    return handleGetWatchlist(request, sql, env, corsHeaders);
  }

  if (url.pathname.match(/^\/api\/investor\/watchlist\/\d+$/) && request.method === 'POST') {
    const pitchId = url.pathname.split('/').pop();
    return handleAddToWatchlist(request, pitchId!, sql, env, redis, corsHeaders);
  }

  if (url.pathname.match(/^\/api\/investor\/watchlist\/\d+$/) && request.method === 'DELETE') {
    const pitchId = url.pathname.split('/').pop();
    return handleRemoveFromWatchlist(request, pitchId!, sql, env, corsHeaders);
  }

  // ============= CREATOR ENDPOINTS =============

  // Get creator's pitches
  if (url.pathname === '/api/creator/pitches' && request.method === 'GET') {
    return handleGetCreatorPitches(request, sql, env, url, corsHeaders);
  }

  // Creator analytics
  if (url.pathname === '/api/creator/analytics' && request.method === 'GET') {
    return handleCreatorAnalytics(request, sql, env, url, redis, corsHeaders);
  }

  // Creator followers
  if (url.pathname === '/api/creator/followers' && request.method === 'GET') {
    return handleGetCreatorFollowers(request, sql, env, url, corsHeaders);
  }

  // Creator earnings (tracked interest, not actual payments)
  if (url.pathname === '/api/creator/earnings' && request.method === 'GET') {
    return handleGetCreatorEarnings(request, sql, env, url, corsHeaders);
  }

  // Creator activities/feed
  if (url.pathname === '/api/creator/activities' && request.method === 'GET') {
    return handleGetCreatorActivities(request, sql, env, url, corsHeaders);
  }

  // ============= INFO REQUESTS WORKFLOW =============

  // Create info request
  if (url.pathname === '/api/info-requests' && request.method === 'POST') {
    return handleCreateInfoRequest(request, sql, env, redis, corsHeaders);
  }

  // Get info requests
  if (url.pathname === '/api/info-requests' && request.method === 'GET') {
    return handleGetInfoRequests(request, sql, env, url, corsHeaders);
  }

  // Respond to info request
  if (url.pathname.match(/^\/api\/info-requests\/\d+\/respond$/) && request.method === 'POST') {
    const requestId = url.pathname.split('/')[3];
    return handleRespondToInfoRequest(request, requestId, sql, env, redis, corsHeaders);
  }

  // Update info request status
  if (url.pathname.match(/^\/api\/info-requests\/\d+\/status$/) && request.method === 'PUT') {
    const requestId = url.pathname.split('/')[3];
    return handleUpdateInfoRequestStatus(request, requestId, sql, env, corsHeaders);
  }

  // ============= ANALYTICS ENDPOINTS =============

  // Pitch analytics
  if (url.pathname.match(/^\/api\/analytics\/pitch\/\d+$/) && request.method === 'GET') {
    const pitchId = url.pathname.split('/').pop();
    return handlePitchAnalytics(request, pitchId!, sql, url, redis, corsHeaders);
  }

  // User analytics
  if (url.pathname === '/api/analytics/user' && request.method === 'GET') {
    return handleUserAnalytics(request, sql, env, url, redis, corsHeaders);
  }

  // Trending content
  if (url.pathname === '/api/analytics/trending' && request.method === 'GET') {
    return handleTrendingAnalytics(request, sql, url, redis, corsHeaders);
  }

  // Real-time analytics
  if (url.pathname === '/api/analytics/realtime' && request.method === 'GET') {
    return handleRealtimeAnalytics(request, redis, corsHeaders);
  }

  // ============= PRODUCTION COMPANY ENDPOINTS =============

  // Production projects
  if (url.pathname === '/api/production/projects' && request.method === 'GET') {
    return handleGetProductionProjects(request, sql, env, url, corsHeaders);
  }

  // Production analytics
  if (url.pathname === '/api/production/analytics' && request.method === 'GET') {
    return handleProductionAnalytics(request, sql, env, url, corsHeaders);
  }

  // ============= FOLLOW SYSTEM ENHANCEMENTS =============

  // Follow user/creator
  if (url.pathname === '/api/follows/follow' && request.method === 'POST') {
    return handleFollowUser(request, sql, env, redis, corsHeaders);
  }

  // Unfollow user/creator
  if (url.pathname === '/api/follows/unfollow' && request.method === 'POST') {
    return handleUnfollowUser(request, sql, env, redis, corsHeaders);
  }

  // Get follow suggestions
  if (url.pathname === '/api/follows/suggestions' && request.method === 'GET') {
    return handleGetFollowSuggestions(request, sql, env, url, corsHeaders);
  }

  // Check follow status
  if (url.pathname === '/api/follows/check' && request.method === 'GET') {
    return handleCheckFollowStatus(request, sql, env, url, corsHeaders);
  }

  return null;
}

// ============= HANDLER IMPLEMENTATIONS =============

async function handleTrackInvestmentInterest(request: Request, sql: any, env: Env, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user || user.userType !== 'investor') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized - investor access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { pitchId, amount, notes } = await request.json() as any;

    // Track investment interest (not actual payment)
    const interest = await sql`
      INSERT INTO investment_interests (
        investor_id, pitch_id, amount, notes, created_at
      ) VALUES (
        ${user.id}, ${pitchId}, ${amount}, ${notes || null}, NOW()
      ) RETURNING *
    `;

    // Cache for analytics
    if (redis) {
      await redis.incr(`pitch:${pitchId}:interest_count`);
      await redis.publish('investment-interest', JSON.stringify({
        type: 'new_interest',
        data: interest[0]
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      interest: interest[0],
      message: 'Investment interest recorded'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to track investment interest'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetInvestmentOpportunities(request: Request, sql: any, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const minBudget = url.searchParams.get('minBudget');
    const maxBudget = url.searchParams.get('maxBudget');
    const genre = url.searchParams.get('genre');

    // Build query based on filters
    let opportunities;
    if (genre) {
      opportunities = await sql`
        SELECT 
          p.*,
          u.username as creator_name,
          u.company_name,
          COALESCE(COUNT(ii.id), 0) as interest_count,
          COALESCE(SUM(ii.amount), 0) as total_interest
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN investment_interests ii ON p.id = ii.pitch_id
        WHERE p.status = 'active' AND p.genre = ${genre}
        GROUP BY p.id, u.username, u.company_name
        ORDER BY interest_count DESC, p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      opportunities = await sql`
        SELECT 
          p.*,
          u.username as creator_name,
          u.company_name,
          COALESCE(COUNT(ii.id), 0) as interest_count,
          COALESCE(SUM(ii.amount), 0) as total_interest
        FROM pitches p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN investment_interests ii ON p.id = ii.pitch_id
        WHERE p.status = 'active'
        GROUP BY p.id, u.username, u.company_name
        ORDER BY interest_count DESC, p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return new Response(JSON.stringify({
      success: true,
      opportunities,
      total: opportunities.length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch investment opportunities'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetInvestorPortfolio(request: Request, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const portfolio = await sql`
      SELECT 
        p.id,
        p.title,
        p.genre,
        p.status,
        ii.amount as interest_amount,
        ii.created_at as interest_date,
        u.username as creator_name
      FROM investment_interests ii
      LEFT JOIN pitches p ON ii.pitch_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE ii.investor_id = ${user.id}
      ORDER BY ii.created_at DESC
    `;

    const summary = await sql`
      SELECT 
        COUNT(*) as total_interests,
        SUM(amount) as total_amount,
        COUNT(DISTINCT pitch_id) as unique_pitches
      FROM investment_interests
      WHERE investor_id = ${user.id}
    `;

    return new Response(JSON.stringify({
      success: true,
      portfolio,
      summary: summary[0] || { total_interests: 0, total_amount: 0, unique_pitches: 0 }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch portfolio'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetWatchlist(request: Request, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const watchlist = await sql`
      SELECT 
        p.*,
        u.username as creator_name,
        w.added_at
      FROM watchlist w
      LEFT JOIN pitches p ON w.pitch_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE w.user_id = ${user.id}
      ORDER BY w.added_at DESC
    `;

    return new Response(JSON.stringify({
      success: true,
      watchlist
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch watchlist'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleAddToWatchlist(request: Request, pitchId: string, sql: any, env: Env, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await sql`
      INSERT INTO watchlist (user_id, pitch_id, added_at)
      VALUES (${user.id}, ${pitchId}, NOW())
      ON CONFLICT (user_id, pitch_id) DO NOTHING
    `;

    // Update cache
    if (redis) {
      await redis.sadd(`watchlist:${user.id}`, pitchId);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Added to watchlist'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to add to watchlist'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleRemoveFromWatchlist(request: Request, pitchId: string, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    await sql`
      DELETE FROM watchlist 
      WHERE user_id = ${user.id} AND pitch_id = ${pitchId}
    `;

    return new Response(JSON.stringify({
      success: true,
      message: 'Removed from watchlist'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to remove from watchlist'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetCreatorPitches(request: Request, sql: any, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const status = url.searchParams.get('status') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build the query with proper SQL composition
    let pitches;
    if (status === 'all') {
      pitches = await sql`
        SELECT 
          p.*,
          COALESCE(COUNT(ii.id), 0) as interest_count,
          COALESCE(SUM(ii.amount), 0) as total_interest,
          COALESCE(COUNT(w.id), 0) as watchlist_count
        FROM pitches p
        LEFT JOIN investment_interests ii ON p.id = ii.pitch_id
        LEFT JOIN watchlist w ON p.id = w.pitch_id
        WHERE p.user_id = ${user.id}
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      pitches = await sql`
        SELECT 
          p.*,
          COALESCE(COUNT(ii.id), 0) as interest_count,
          COALESCE(SUM(ii.amount), 0) as total_interest,
          COALESCE(COUNT(w.id), 0) as watchlist_count
        FROM pitches p
        LEFT JOIN investment_interests ii ON p.id = ii.pitch_id
        LEFT JOIN watchlist w ON p.id = w.pitch_id
        WHERE p.user_id = ${user.id} AND p.status = ${status}
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return new Response(JSON.stringify({
      success: true,
      pitches,
      total: pitches.length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch creator pitches'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleCreatorAnalytics(request: Request, sql: any, env: Env, url: URL, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const timeRange = url.searchParams.get('timeRange') || '30d';
    
    // Cache key for analytics
    const cacheKey = `analytics:creator:${user.id}:${timeRange}`;
    
    // Try cache first
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return new Response(JSON.stringify({
          success: true,
          analytics: cached,
          fromCache: true
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    const analytics = await sql`
      SELECT 
        COUNT(DISTINCT p.id) as total_pitches,
        SUM(p.view_count) as total_views,
        SUM(p.like_count) as total_likes,
        COUNT(DISTINCT ii.id) as total_interests,
        SUM(ii.amount) as total_interest_amount,
        COUNT(DISTINCT f.id) as follower_count
      FROM pitches p
      LEFT JOIN investment_interests ii ON p.id = ii.pitch_id
      LEFT JOIN follows f ON f.creator_id = p.user_id
      WHERE p.user_id = ${user.id}
    `;

    // Cache for 5 minutes
    if (redis && analytics.length > 0) {
      await redis.setex(cacheKey, 300, JSON.stringify(analytics[0]));
    }

    return new Response(JSON.stringify({
      success: true,
      analytics: analytics[0] || {}
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch creator analytics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetCreatorFollowers(request: Request, sql: any, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const followers = await sql`
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.profile_image_url,
        u.user_type,
        f.followed_at
      FROM follows f
      LEFT JOIN users u ON f.follower_id = u.id
      WHERE f.creator_id = ${user.id}
      ORDER BY f.followed_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return new Response(JSON.stringify({
      success: true,
      followers,
      total: followers.length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch followers'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Continue with remaining handlers...
async function handleGetCreatorEarnings(request: Request, sql: any, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Track interest amounts (not actual payments)
    const earnings = await sql`
      SELECT 
        DATE_TRUNC('month', ii.created_at) as month,
        COUNT(*) as interest_count,
        SUM(ii.amount) as potential_earnings,
        COUNT(DISTINCT ii.investor_id) as unique_investors
      FROM investment_interests ii
      LEFT JOIN pitches p ON ii.pitch_id = p.id
      WHERE p.user_id = ${user.id}
      GROUP BY DATE_TRUNC('month', ii.created_at)
      ORDER BY month DESC
      LIMIT 12
    `;

    return new Response(JSON.stringify({
      success: true,
      earnings,
      note: 'These are tracked interest amounts, not actual payments'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch earnings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleCreateInfoRequest(request: Request, sql: any, env: Env, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { pitchId, requestType, message, urgency } = await request.json() as any;

    const infoRequest = await sql`
      INSERT INTO info_requests (
        requester_id, pitch_id, request_type, message, 
        urgency, status, created_at
      ) VALUES (
        ${user.id}, ${pitchId}, ${requestType}, ${message},
        ${urgency || 'normal'}, 'pending', NOW()
      ) RETURNING *
    `;

    // Notify via Redis
    if (redis) {
      await redis.publish('info-requests', JSON.stringify({
        type: 'new_info_request',
        data: infoRequest[0]
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      request: infoRequest[0]
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create info request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Placeholder implementations for remaining handlers
async function handleGetInfoRequests(request: Request, sql: any, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  // Implementation for getting info requests
  return new Response(JSON.stringify({ success: true, requests: [] }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleRespondToInfoRequest(request: Request, requestId: string, sql: any, env: Env, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  // Implementation for responding to info requests
  return new Response(JSON.stringify({ success: true, message: 'Response sent' }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleUpdateInfoRequestStatus(request: Request, requestId: string, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Implementation for updating info request status
  return new Response(JSON.stringify({ success: true, message: 'Status updated' }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handlePitchAnalytics(request: Request, pitchId: string, sql: any, url: URL, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  // Implementation for pitch analytics
  return new Response(JSON.stringify({ success: true, analytics: {} }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleUserAnalytics(request: Request, sql: any, env: Env, url: URL, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  // Implementation for user analytics
  return new Response(JSON.stringify({ success: true, analytics: {} }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleTrendingAnalytics(request: Request, sql: any, url: URL, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  // Implementation for trending analytics
  return new Response(JSON.stringify({ success: true, trending: [] }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleRealtimeAnalytics(request: Request, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  // Implementation for real-time analytics from Redis
  return new Response(JSON.stringify({ success: true, realtime: {} }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleGetProductionProjects(request: Request, sql: any, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  // Implementation for production projects
  return new Response(JSON.stringify({ success: true, projects: [] }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleProductionAnalytics(request: Request, sql: any, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  // Implementation for production analytics
  return new Response(JSON.stringify({ success: true, analytics: {} }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function handleFollowUser(request: Request, sql: any, env: Env, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { creatorId } = await request.json() as any;

    await sql`
      INSERT INTO follows (follower_id, creator_id, followed_at)
      VALUES (${user.id}, ${creatorId}, NOW())
      ON CONFLICT (follower_id, creator_id) DO NOTHING
    `;

    // Update cache
    if (redis) {
      await redis.sadd(`following:${user.id}`, creatorId);
      await redis.incr(`followers:${creatorId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Successfully followed user'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to follow user'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleUnfollowUser(request: Request, sql: any, env: Env, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { creatorId } = await request.json() as any;

    await sql`
      DELETE FROM follows 
      WHERE follower_id = ${user.id} AND creator_id = ${creatorId}
    `;

    // Update cache
    if (redis) {
      await redis.srem(`following:${user.id}`, creatorId);
      await redis.decr(`followers:${creatorId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Successfully unfollowed user'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to unfollow user'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetFollowSuggestions(request: Request, sql: any, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Get suggested creators based on activity
    const suggestions = await sql`
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.profile_image_url,
        COUNT(p.id) as pitch_count,
        SUM(p.view_count) as total_views
      FROM users u
      LEFT JOIN pitches p ON u.id = p.user_id
      WHERE u.user_type = 'creator' 
        AND u.id != ${user.id}
        AND u.id NOT IN (
          SELECT creator_id FROM follows WHERE follower_id = ${user.id}
        )
      GROUP BY u.id
      ORDER BY total_views DESC, pitch_count DESC
      LIMIT ${limit}
    `;

    return new Response(JSON.stringify({
      success: true,
      suggestions
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get follow suggestions'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleCheckFollowStatus(request: Request, sql: any, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const creatorId = url.searchParams.get('creatorId');
    if (!creatorId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Creator ID required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const isFollowing = await sql`
      SELECT EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = ${user.id} AND creator_id = ${creatorId}
      ) as is_following
    `;

    return new Response(JSON.stringify({
      success: true,
      isFollowing: isFollowing[0]?.is_following || false
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to check follow status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetCreatorActivities(request: Request, sql: any, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const user = await getUserFromAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Get recent activities related to the creator's pitches
    const activities = await sql`
      SELECT 
        'pitch_view' as activity_type,
        p.title as pitch_title,
        p.id as pitch_id,
        p.view_count,
        p.updated_at as activity_date
      FROM pitches p
      WHERE p.user_id = ${user.id}
      
      UNION ALL
      
      SELECT 
        'investment_interest' as activity_type,
        p.title as pitch_title,
        p.id as pitch_id,
        ii.amount::text as details,
        ii.created_at as activity_date
      FROM investment_interests ii
      LEFT JOIN pitches p ON ii.pitch_id = p.id
      WHERE p.user_id = ${user.id}
      
      UNION ALL
      
      SELECT 
        'new_follower' as activity_type,
        u.username as details,
        f.creator_id as related_id,
        NULL as extra_data,
        f.followed_at as activity_date
      FROM follows f
      LEFT JOIN users u ON f.follower_id = u.id
      WHERE f.creator_id = ${user.id}
      
      ORDER BY activity_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return new Response(JSON.stringify({
      success: true,
      activities
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch activities'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}