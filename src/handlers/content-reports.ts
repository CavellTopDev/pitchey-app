/**
 * Content Reports Handler
 * Allows authenticated users to report content (pitches, users, comments, messages)
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

const VALID_CONTENT_TYPES = ['pitch', 'user', 'comment', 'message'] as const;
const VALID_REASONS = ['spam', 'inappropriate', 'harassment', 'copyright', 'misinformation', 'other'] as const;

/**
 * POST /api/reports
 * Create a new content report
 */
export async function createReportHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);

  if (!userId) {
    return jsonResponse(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      401,
      origin
    );
  }

  const sql = getDb(env);
  if (!sql) {
    return jsonResponse(
      { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' } },
      503,
      origin
    );
  }

  let body: { contentType?: string; contentId?: number; reason?: string; details?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
      400,
      origin
    );
  }

  const { contentType, contentId, reason, details } = body;

  // Validate required fields
  if (!contentType || contentId == null || !reason) {
    return jsonResponse(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Missing required fields: contentType, contentId, reason' } },
      400,
      origin
    );
  }

  // Validate contentType
  if (!VALID_CONTENT_TYPES.includes(contentType as typeof VALID_CONTENT_TYPES[number])) {
    return jsonResponse(
      { success: false, error: { code: 'BAD_REQUEST', message: `Invalid contentType. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}` } },
      400,
      origin
    );
  }

  // Validate reason
  if (!VALID_REASONS.includes(reason as typeof VALID_REASONS[number])) {
    return jsonResponse(
      { success: false, error: { code: 'BAD_REQUEST', message: `Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}` } },
      400,
      origin
    );
  }

  try {
    const result = await sql`
      INSERT INTO content_reports (reporter_id, content_type, content_id, reason, details, status, created_at)
      VALUES (${userId}, ${contentType}, ${contentId}, ${reason}, ${details || null}, 'pending', NOW())
      RETURNING id, content_type, content_id, reason, status, created_at
    `;

    return jsonResponse(
      { success: true, data: { report: result[0] } },
      201,
      origin
    );
  } catch (error) {
    console.error('Failed to create content report:', error);
    return jsonResponse(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create report' } },
      500,
      origin
    );
  }
}
