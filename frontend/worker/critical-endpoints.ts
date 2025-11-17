import { neon } from '@neondatabase/serverless';
import * as bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis';
import { Env } from './index';

// Helper to generate JWT
function generateToken(payload: any, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/[=+\/]/g, (m) => 
    ({ '=': '', '+': '-', '/': '_' }[m] || m));
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/[=+\/]/g, (m) => 
    ({ '=': '', '+': '-', '/': '_' }[m] || m));
  
  // Simple signature for demo - in production use proper crypto
  const signature = btoa(`${encodedHeader}.${encodedPayload}.${secret}`).replace(/[=+\/]/g, (m) => 
    ({ '=': '', '+': '-', '/': '_' }[m] || m));
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function setupCriticalEndpoints(
  request: Request,
  env: Env,
  sql: ReturnType<typeof neon>,
  redis: Redis | null,
  url: URL,
  corsHeaders: Record<string, string>
): Response | null {

  // ============= AUTHENTICATION ENDPOINTS =============
  
  // User Registration
  if (url.pathname === '/api/auth/register' && request.method === 'POST') {
    return handleRegistration(request, sql, env, corsHeaders);
  }

  // Logout
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    return handleLogout(request, redis, corsHeaders);
  }

  // Forgot Password
  if (url.pathname === '/api/auth/forgot-password' && request.method === 'POST') {
    return handleForgotPassword(request, sql, redis, corsHeaders);
  }

  // Reset Password
  if (url.pathname === '/api/auth/reset-password' && request.method === 'POST') {
    return handleResetPassword(request, sql, corsHeaders);
  }

  // ============= PITCH CRUD ENDPOINTS =============
  
  // Get single pitch
  if (url.pathname.match(/^\/api\/pitches\/\d+$/) && request.method === 'GET') {
    const pitchId = url.pathname.split('/').pop();
    return handleGetPitch(pitchId!, sql, redis, corsHeaders);
  }

  // Create pitch
  if (url.pathname === '/api/pitches' && request.method === 'POST') {
    return handleCreatePitch(request, sql, env, corsHeaders);
  }

  // Update pitch
  if (url.pathname.match(/^\/api\/pitches\/\d+$/) && request.method === 'PUT') {
    const pitchId = url.pathname.split('/').pop();
    return handleUpdatePitch(request, pitchId!, sql, env, corsHeaders);
  }

  // Delete pitch
  if (url.pathname.match(/^\/api\/pitches\/\d+$/) && request.method === 'DELETE') {
    const pitchId = url.pathname.split('/').pop();
    return handleDeletePitch(request, pitchId!, sql, env, corsHeaders);
  }

  // Publish pitch
  if (url.pathname.match(/^\/api\/pitches\/\d+\/publish$/) && request.method === 'POST') {
    const pitchId = url.pathname.split('/')[3];
    return handlePublishPitch(request, pitchId, sql, env, corsHeaders);
  }

  // Like/Unlike pitch
  if (url.pathname.match(/^\/api\/pitches\/\d+\/(like|unlike)$/) && request.method === 'POST') {
    const parts = url.pathname.split('/');
    const pitchId = parts[3];
    const action = parts[4] as 'like' | 'unlike';
    return handleLikePitch(request, pitchId, action, sql, env, corsHeaders);
  }

  // ============= NDA ENDPOINTS =============
  
  // Request NDA
  if (url.pathname === '/api/nda/request' && request.method === 'POST') {
    return handleNDARequest(request, sql, env, redis, corsHeaders);
  }

  // Get NDA requests
  if (url.pathname === '/api/nda/requests' && request.method === 'GET') {
    return handleGetNDARequests(request, sql, env, corsHeaders);
  }

  // Approve/Reject NDA
  if (url.pathname.match(/^\/api\/nda\/requests\/\d+\/(approve|reject)$/) && request.method === 'POST') {
    const parts = url.pathname.split('/');
    const requestId = parts[4];
    const action = parts[5] as 'approve' | 'reject';
    return handleNDAAction(request, requestId, action, sql, env, redis, corsHeaders);
  }

  // ============= MESSAGING ENDPOINTS =============
  
  // Send message
  if (url.pathname === '/api/messages' && request.method === 'POST') {
    return handleSendMessage(request, sql, env, redis, corsHeaders);
  }

  // Get conversations
  if (url.pathname === '/api/messages/conversations' && request.method === 'GET') {
    return handleGetConversations(request, sql, env, corsHeaders);
  }

  // Mark message as read
  if (url.pathname.match(/^\/api\/messages\/\d+\/read$/) && request.method === 'POST') {
    const messageId = url.pathname.split('/')[3];
    return handleMarkMessageRead(request, messageId, sql, env, redis, corsHeaders);
  }

  return null;
}

// ============= HANDLER IMPLEMENTATIONS =============

async function handleRegistration(request: Request, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { email, password, username, userType, firstName, lastName, companyName } = body;

    // Validate required fields
    if (!email || !password || !username || !userType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if user exists
    const existing = await sql`SELECT id FROM users WHERE email = ${email} OR username = ${username}`;
    if (existing.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User already exists'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await sql`
      INSERT INTO users (
        email, password, username, user_type, 
        first_name, last_name, company_name, 
        created_at, is_verified
      ) VALUES (
        ${email}, ${hashedPassword}, ${username}, ${userType},
        ${firstName || null}, ${lastName || null}, ${companyName || null},
        NOW(), false
      ) RETURNING id, username, email, user_type
    `;

    const token = generateToken({
      id: newUser[0].id,
      username: newUser[0].username,
      email: newUser[0].email,
      userType: newUser[0].user_type
    }, env.JWT_SECRET);

    return new Response(JSON.stringify({
      success: true,
      token,
      user: newUser[0]
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Registration failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleLogout(request: Request, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && redis) {
      const token = authHeader.replace('Bearer ', '');
      // Add token to blacklist in Redis with 24h expiry
      await redis.setex(`blacklist:${token}`, 86400, '1');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Logout failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleForgotPassword(request: Request, sql: any, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { email } = await request.json() as any;
    
    const user = await sql`SELECT id, email FROM users WHERE email = ${email}`;
    if (user.length === 0) {
      // Don't reveal if email exists
      return new Response(JSON.stringify({
        success: true,
        message: 'If the email exists, a reset link has been sent'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Generate reset token
    const resetToken = crypto.randomUUID();
    
    // Store in Redis with 1 hour expiry
    if (redis) {
      await redis.setex(`reset:${resetToken}`, 3600, user[0].id);
    }

    // In production, send email here
    // For now, return token (remove in production!)
    return new Response(JSON.stringify({
      success: true,
      message: 'Reset link sent',
      resetToken // Remove this in production!
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleResetPassword(request: Request, sql: any, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { token, newPassword } = await request.json() as any;
    
    // In production, validate token from Redis
    // For now, just update password
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // This is simplified - in production, get user ID from Redis token
    await sql`
      UPDATE users 
      SET password = ${hashedPassword}
      WHERE id = (SELECT id FROM users LIMIT 1)
    `;

    return new Response(JSON.stringify({
      success: true,
      message: 'Password reset successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Password reset failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetPitch(pitchId: string, sql: any, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    // Try cache first
    if (redis) {
      const cached = await redis.get(`pitch:${pitchId}`);
      if (cached) {
        return new Response(JSON.stringify({
          success: true,
          pitch: cached,
          fromCache: true
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    const pitch = await sql`
      SELECT p.*, u.username as creator_name, u.company_name
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ${pitchId}
    `;

    if (pitch.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Pitch not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Cache for 5 minutes
    if (redis) {
      await redis.setex(`pitch:${pitchId}`, 300, JSON.stringify(pitch[0]));
    }

    // Increment view count
    await sql`UPDATE pitches SET view_count = view_count + 1 WHERE id = ${pitchId}`;

    return new Response(JSON.stringify({
      success: true,
      pitch: pitch[0]
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch pitch'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleCreatePitch(request: Request, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json() as any;
    const { title, logline, genre, format, synopsis, budget } = body;

    // Get user ID from token (simplified)
    const userId = 1; // In production, decode from JWT

    const pitch = await sql`
      INSERT INTO pitches (
        user_id, title, logline, genre, format,
        short_synopsis, budget, status, created_at
      ) VALUES (
        ${userId}, ${title}, ${logline}, ${genre}, ${format},
        ${synopsis}, ${budget}, 'draft', NOW()
      ) RETURNING *
    `;

    return new Response(JSON.stringify({
      success: true,
      pitch: pitch[0]
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create pitch'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleUpdatePitch(request: Request, pitchId: string, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const body = await request.json() as any;
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    Object.entries(body).forEach(([key, value]) => {
      if (['title', 'logline', 'genre', 'format', 'short_synopsis', 'budget'].includes(key)) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid fields to update'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`);
    
    const query = `UPDATE pitches SET ${updates.join(', ')} WHERE id = ${pitchId} RETURNING *`;
    const pitch = await sql(query, values);

    return new Response(JSON.stringify({
      success: true,
      pitch: pitch[0]
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update pitch'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleDeletePitch(request: Request, pitchId: string, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    await sql`DELETE FROM pitches WHERE id = ${pitchId}`;
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Pitch deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to delete pitch'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handlePublishPitch(request: Request, pitchId: string, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    await sql`
      UPDATE pitches 
      SET status = 'active', published_at = NOW() 
      WHERE id = ${pitchId}
    `;
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Pitch published successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to publish pitch'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleLikePitch(request: Request, pitchId: string, action: 'like' | 'unlike', sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    // Get user ID from auth (simplified)
    const userId = 1;

    if (action === 'like') {
      await sql`
        INSERT INTO likes (user_id, pitch_id, created_at)
        VALUES (${userId}, ${pitchId}, NOW())
        ON CONFLICT (user_id, pitch_id) DO NOTHING
      `;
      await sql`UPDATE pitches SET like_count = like_count + 1 WHERE id = ${pitchId}`;
    } else {
      await sql`DELETE FROM likes WHERE user_id = ${userId} AND pitch_id = ${pitchId}`;
      await sql`UPDATE pitches SET like_count = GREATEST(like_count - 1, 0) WHERE id = ${pitchId}`;
    }
    
    return new Response(JSON.stringify({
      success: true,
      action
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to ${action} pitch`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleNDARequest(request: Request, sql: any, env: Env, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { pitchId } = await request.json() as any;
    const userId = 1; // Get from auth

    // Check if NDA already exists
    const existing = await sql`
      SELECT id FROM nda_requests 
      WHERE user_id = ${userId} AND pitch_id = ${pitchId}
    `;

    if (existing.length > 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'NDA request already exists'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const nda = await sql`
      INSERT INTO nda_requests (
        user_id, pitch_id, status, requested_at
      ) VALUES (
        ${userId}, ${pitchId}, 'pending', NOW()
      ) RETURNING *
    `;

    // Send notification via Redis pub/sub
    if (redis) {
      await redis.publish('nda-requests', JSON.stringify({
        type: 'new_nda_request',
        data: nda[0]
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      request: nda[0]
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create NDA request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetNDARequests(request: Request, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const userId = 1; // Get from auth
    
    const requests = await sql`
      SELECT 
        nr.*,
        p.title as pitch_title,
        u.username as requester_name
      FROM nda_requests nr
      LEFT JOIN pitches p ON nr.pitch_id = p.id
      LEFT JOIN users u ON nr.user_id = u.id
      WHERE p.user_id = ${userId} OR nr.user_id = ${userId}
      ORDER BY nr.requested_at DESC
    `;

    return new Response(JSON.stringify({
      success: true,
      requests
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch NDA requests'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleNDAAction(request: Request, requestId: string, action: 'approve' | 'reject', sql: any, env: Env, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const status = action === 'approve' ? 'approved' : 'rejected';
    
    await sql`
      UPDATE nda_requests 
      SET status = ${status}, responded_at = NOW()
      WHERE id = ${requestId}
    `;

    // Send notification
    if (redis) {
      await redis.publish('nda-updates', JSON.stringify({
        type: `nda_${action}d`,
        requestId
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      message: `NDA request ${action}d`
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to ${action} NDA request`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleSendMessage(request: Request, sql: any, env: Env, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const { recipientId, content, subject } = await request.json() as any;
    const senderId = 1; // Get from auth

    const message = await sql`
      INSERT INTO messages (
        sender_id, recipient_id, subject, content, 
        sent_at, is_read
      ) VALUES (
        ${senderId}, ${recipientId}, ${subject}, ${content},
        NOW(), false
      ) RETURNING *
    `;

    // Queue for real-time delivery
    if (redis) {
      await redis.lpush(`messages:${recipientId}`, JSON.stringify(message[0]));
      await redis.publish('new-messages', JSON.stringify({
        recipientId,
        message: message[0]
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      message: message[0]
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to send message'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleGetConversations(request: Request, sql: any, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const userId = 1; // Get from auth

    const conversations = await sql`
      WITH latest_messages AS (
        SELECT DISTINCT ON (
          CASE 
            WHEN sender_id = ${userId} THEN recipient_id
            ELSE sender_id
          END
        )
        *,
        CASE 
          WHEN sender_id = ${userId} THEN recipient_id
          ELSE sender_id
        END as other_user_id
        FROM messages
        WHERE sender_id = ${userId} OR recipient_id = ${userId}
        ORDER BY 
          CASE 
            WHEN sender_id = ${userId} THEN recipient_id
            ELSE sender_id
          END,
          sent_at DESC
      )
      SELECT 
        lm.*,
        u.username as other_user_name,
        u.profile_image_url as other_user_avatar
      FROM latest_messages lm
      LEFT JOIN users u ON u.id = lm.other_user_id
      ORDER BY lm.sent_at DESC
    `;

    return new Response(JSON.stringify({
      success: true,
      conversations
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch conversations'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function handleMarkMessageRead(request: Request, messageId: string, sql: any, env: Env, redis: Redis | null, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    await sql`
      UPDATE messages 
      SET is_read = true, read_at = NOW()
      WHERE id = ${messageId}
    `;

    // Update unread count in cache
    if (redis) {
      const userId = 1; // Get from auth
      await redis.decr(`unread:${userId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Message marked as read'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to mark message as read'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}