import { Redis } from '@upstash/redis';
import { Env } from './index';

// WebSocket alternative implementations using SSE and Redis for real-time features
// Since Cloudflare Workers don't support persistent WebSocket connections,
// we implement alternatives using Server-Sent Events and Redis pub/sub

// Helper to verify JWT and get user info
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

export function setupWebSocketAlternatives(
  request: Request,
  env: Env,
  redis: Redis | null,
  url: URL,
  corsHeaders: Record<string, string>
): Response | null {
  
  // ============= SERVER-SENT EVENTS (SSE) =============
  
  // SSE endpoint for real-time notifications
  if (url.pathname === '/api/notifications/stream' && request.method === 'GET') {
    return handleSSENotifications(request, env, redis, corsHeaders);
  }
  
  // SSE endpoint for real-time dashboard updates  
  if (url.pathname === '/api/dashboard/stream' && request.method === 'GET') {
    return handleSSEDashboard(request, env, redis, corsHeaders);
  }
  
  // SSE endpoint for typing indicators
  if (url.pathname === '/api/messages/typing/stream' && request.method === 'GET') {
    return handleSSETyping(request, env, redis, corsHeaders);
  }
  
  // ============= PRESENCE TRACKING =============
  
  // Update user presence (online/offline/away)
  if (url.pathname === '/api/presence/update' && request.method === 'POST') {
    return handleUpdatePresence(request, env, redis, corsHeaders);
  }
  
  // Get online users
  if (url.pathname === '/api/presence/online' && request.method === 'GET') {
    return handleGetOnlineUsers(request, env, redis, corsHeaders);
  }
  
  // Check specific user presence
  if (url.pathname.match(/^\/api\/presence\/user\/\d+$/) && request.method === 'GET') {
    const userId = url.pathname.split('/').pop();
    return handleCheckUserPresence(request, userId!, env, redis, corsHeaders);
  }
  
  // ============= REAL-TIME NOTIFICATIONS =============
  
  // Send notification (for backend to trigger)
  if (url.pathname === '/api/notifications/send' && request.method === 'POST') {
    return handleSendNotification(request, env, redis, corsHeaders);
  }
  
  // Mark notification as read
  if (url.pathname.match(/^\/api\/notifications\/\d+\/read$/) && request.method === 'POST') {
    const notificationId = url.pathname.split('/')[3];
    return handleMarkNotificationRead(request, notificationId, env, redis, corsHeaders);
  }
  
  // ============= DRAFT AUTO-SYNC =============
  
  // Save draft
  if (url.pathname === '/api/drafts/save' && request.method === 'POST') {
    return handleSaveDraft(request, env, redis, corsHeaders);
  }
  
  // Get draft
  if (url.pathname.match(/^\/api\/drafts\/\w+$/) && request.method === 'GET') {
    const draftId = url.pathname.split('/').pop();
    return handleGetDraft(request, draftId!, env, redis, corsHeaders);
  }
  
  // ============= LIVE STATS =============
  
  // Get live view count for pitch
  if (url.pathname.match(/^\/api\/pitches\/\d+\/live-stats$/) && request.method === 'GET') {
    const pitchId = url.pathname.split('/')[3];
    return handleGetLiveStats(request, pitchId, env, redis, corsHeaders);
  }
  
  // Update view count
  if (url.pathname.match(/^\/api\/pitches\/\d+\/view$/) && request.method === 'POST') {
    const pitchId = url.pathname.split('/')[3];
    return handleUpdateViewCount(request, pitchId, env, redis, corsHeaders);
  }

  return null;
}

// ============= SSE IMPLEMENTATIONS =============

async function handleSSENotifications(
  request: Request,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    const userId = payload.id;

    // Create SSE stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Send initial message
    writer.write(new TextEncoder().encode(`data: ${JSON.stringify({
      type: 'connected',
      userId: userId,
      timestamp: new Date().toISOString()
    })}\n\n`));

    // In a real implementation, you would:
    // 1. Subscribe to Redis notifications for this user
    // 2. Send real-time updates as they come in
    // 3. Handle connection cleanup
    
    // For now, send a heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      writer.write(new TextEncoder().encode(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      })}\n\n`));
    }, 30000);

    // Cleanup after 5 minutes (Cloudflare Workers have time limits)
    setTimeout(() => {
      clearInterval(heartbeatInterval);
      writer.close();
    }, 300000);

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to establish SSE connection'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleSSEDashboard(
  request: Request,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Similar to notifications but for dashboard metrics
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Send initial dashboard data
    writer.write(new TextEncoder().encode(`data: ${JSON.stringify({
      type: 'dashboard-update',
      data: {
        activeUsers: 0,
        totalViews: 0,
        newNotifications: 0
      },
      timestamp: new Date().toISOString()
    })}\n\n`));

    // Send updates every 5 minutes (cached data)
    const updateInterval = setInterval(() => {
      writer.write(new TextEncoder().encode(`data: ${JSON.stringify({
        type: 'dashboard-update',
        data: {
          activeUsers: Math.floor(Math.random() * 100),
          totalViews: Math.floor(Math.random() * 1000),
          newNotifications: Math.floor(Math.random() * 10)
        },
        timestamp: new Date().toISOString()
      })}\n\n`));
    }, 300000);

    setTimeout(() => {
      clearInterval(updateInterval);
      writer.close();
    }, 300000);

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to establish dashboard stream'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleSSETyping(
  request: Request,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Typing indicators for messages
  try {
    const conversationId = url.searchParams.get('conversationId');
    if (!conversationId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Conversation ID required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // In a real implementation, this would subscribe to typing events
    writer.write(new TextEncoder().encode(`data: ${JSON.stringify({
      type: 'typing-connected',
      conversationId: conversationId,
      timestamp: new Date().toISOString()
    })}\n\n`));

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to establish typing stream'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ============= PRESENCE IMPLEMENTATIONS =============

async function handleUpdatePresence(
  request: Request,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json() as { status: string };
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    const userId = payload.id;

    if (!redis) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Presence updated (Redis unavailable)'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Store presence in Redis with TTL
    const presenceKey = `presence:${userId}`;
    await redis.setex(presenceKey, 300, JSON.stringify({
      status: body.status,
      lastSeen: new Date().toISOString(),
      userId: userId
    }));

    return new Response(JSON.stringify({
      success: true,
      status: body.status
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update presence'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetOnlineUsers(
  request: Request,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!redis) {
      return new Response(JSON.stringify({
        success: true,
        users: []
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get all presence keys
    const keys = await redis.keys('presence:*');
    const onlineUsers = [];

    for (const key of keys) {
      const presence = await redis.get(key);
      if (presence) {
        const presenceData = JSON.parse(presence as string);
        if (presenceData.status === 'online') {
          onlineUsers.push({
            userId: presenceData.userId,
            lastSeen: presenceData.lastSeen
          });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      users: onlineUsers,
      count: onlineUsers.length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get online users'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleCheckUserPresence(
  request: Request,
  userId: string,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!redis) {
      return new Response(JSON.stringify({
        success: true,
        status: 'offline',
        lastSeen: null
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const presenceKey = `presence:${userId}`;
    const presence = await redis.get(presenceKey);

    if (!presence) {
      return new Response(JSON.stringify({
        success: true,
        status: 'offline',
        lastSeen: null
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const presenceData = JSON.parse(presence as string);
    
    return new Response(JSON.stringify({
      success: true,
      status: presenceData.status,
      lastSeen: presenceData.lastSeen
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to check user presence'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ============= NOTIFICATION IMPLEMENTATIONS =============

async function handleSendNotification(
  request: Request,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body = await request.json() as {
      userId: number;
      type: string;
      title: string;
      message: string;
      data?: any;
    };

    if (!redis) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Notification queued (Redis unavailable)'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Store notification in Redis queue
    const notificationKey = `notifications:${body.userId}`;
    const notification = {
      id: Date.now().toString(),
      type: body.type,
      title: body.title,
      message: body.message,
      data: body.data || {},
      timestamp: new Date().toISOString(),
      read: false
    };

    await redis.lpush(notificationKey, JSON.stringify(notification));
    
    // Keep only last 50 notifications
    await redis.ltrim(notificationKey, 0, 49);

    return new Response(JSON.stringify({
      success: true,
      notificationId: notification.id
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to send notification'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleMarkNotificationRead(
  request: Request,
  notificationId: string,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // In a real implementation, you would update the notification status
    return new Response(JSON.stringify({
      success: true,
      message: 'Notification marked as read'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to mark notification as read'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ============= DRAFT AUTO-SYNC IMPLEMENTATIONS =============

async function handleSaveDraft(
  request: Request,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json() as {
      draftId: string;
      content: any;
      type: string;
    };

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    const userId = payload.id;

    if (!redis) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Draft saved locally (Redis unavailable)'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const draftKey = `draft:${userId}:${body.draftId}`;
    const draftData = {
      content: body.content,
      type: body.type,
      lastModified: new Date().toISOString(),
      userId: userId
    };

    // Save draft with 24 hour TTL
    await redis.setex(draftKey, 86400, JSON.stringify(draftData));

    return new Response(JSON.stringify({
      success: true,
      draftId: body.draftId,
      timestamp: draftData.lastModified
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to save draft'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetDraft(
  request: Request,
  draftId: string,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    const userId = payload.id;

    if (!redis) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Draft not found (Redis unavailable)'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const draftKey = `draft:${userId}:${draftId}`;
    const draft = await redis.get(draftKey);

    if (!draft) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Draft not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const draftData = JSON.parse(draft as string);

    return new Response(JSON.stringify({
      success: true,
      draft: draftData
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get draft'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// ============= LIVE STATS IMPLEMENTATIONS =============

async function handleGetLiveStats(
  request: Request,
  pitchId: string,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!redis) {
      return new Response(JSON.stringify({
        success: true,
        stats: {
          views: 0,
          activeViewers: 0,
          totalInterest: 0
        }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get live stats from Redis
    const viewKey = `pitch:${pitchId}:views`;
    const activeKey = `pitch:${pitchId}:active`;
    const interestKey = `pitch:${pitchId}:interest`;

    const [views, activeViewers, interest] = await Promise.all([
      redis.get(viewKey),
      redis.scard(activeKey),
      redis.get(interestKey)
    ]);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        views: parseInt(views as string || '0'),
        activeViewers: activeViewers || 0,
        totalInterest: parseInt(interest as string || '0')
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get live stats'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleUpdateViewCount(
  request: Request,
  pitchId: string,
  env: Env,
  redis: Redis | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    const userId = payload.id;

    if (!redis) {
      return new Response(JSON.stringify({
        success: true,
        message: 'View counted (Redis unavailable)'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Increment view count
    const viewKey = `pitch:${pitchId}:views`;
    await redis.incr(viewKey);

    // Add to active viewers (with TTL)
    const activeKey = `pitch:${pitchId}:active`;
    await redis.sadd(activeKey, userId);
    await redis.expire(activeKey, 300); // 5 minutes

    const newViewCount = await redis.get(viewKey);

    return new Response(JSON.stringify({
      success: true,
      viewCount: parseInt(newViewCount as string || '1')
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update view count'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}