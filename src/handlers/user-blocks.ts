/**
 * User Blocks Handler
 * Manages blocking/unblocking users and listing blocked users
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
  });
}

/**
 * Block a user - POST /api/users/:id/block
 */
export async function blockUserHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, 401, origin);
  }

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const blockedId = parts[parts.length - 2];

  if (!blockedId || isNaN(Number(blockedId))) {
    return jsonResponse({ success: false, error: 'Invalid user ID' }, 400, origin);
  }

  if (String(userId) === String(blockedId)) {
    return jsonResponse({ success: false, error: 'Cannot block yourself' }, 400, origin);
  }

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, data: { blocked: true } }, 200, origin);
  }

  try {
    let reason: string | null = null;
    try {
      const body = await request.json() as { reason?: string };
      reason = body.reason || null;
    } catch {
      // No body or invalid JSON - reason remains null
    }

    await sql`
      INSERT INTO user_blocks (blocker_id, blocked_id, reason, created_at)
      VALUES (${userId}, ${blockedId}, ${reason}, NOW())
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `;

    return jsonResponse({ success: true, data: { blocked: true } }, 200, origin);
  } catch (error) {
    console.error('Block user error:', error);
    return jsonResponse({ success: false, error: 'Failed to block user' }, 500, origin);
  }
}

/**
 * Unblock a user - DELETE /api/users/:id/block
 */
export async function unblockUserHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, 401, origin);
  }

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const blockedId = parts[parts.length - 2];

  if (!blockedId || isNaN(Number(blockedId))) {
    return jsonResponse({ success: false, error: 'Invalid user ID' }, 400, origin);
  }

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, data: { blocked: false } }, 200, origin);
  }

  try {
    await sql`
      DELETE FROM user_blocks
      WHERE blocker_id = ${userId} AND blocked_id = ${blockedId}
    `;

    return jsonResponse({ success: true, data: { blocked: false } }, 200, origin);
  } catch (error) {
    console.error('Unblock user error:', error);
    return jsonResponse({ success: false, error: 'Failed to unblock user' }, 500, origin);
  }
}

/**
 * Get blocked users list - GET /api/users/blocked
 */
export async function getBlockedUsersHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, 401, origin);
  }

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse({ success: true, data: { blockedUsers: [], total: 0 } }, 200, origin);
  }

  try {
    const rows = await sql`
      SELECT ub.id, ub.blocked_id, ub.reason, ub.created_at,
             u.username, u.name, u.profile_image
      FROM user_blocks ub
      JOIN users u ON ub.blocked_id = u.id
      WHERE ub.blocker_id = ${userId}
      ORDER BY ub.created_at DESC
    `;

    return jsonResponse({ success: true, data: { blockedUsers: rows, total: rows.length } }, 200, origin);
  } catch (error) {
    console.error('Get blocked users error:', error);
    return jsonResponse({ success: true, data: { blockedUsers: [], total: 0 } }, 200, origin);
  }
}
