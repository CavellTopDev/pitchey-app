/**
 * Calendar Events Handler — POST /api/calendar
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(
  data: unknown,
  origin: string | null,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

export async function createCalendarEvent(
  request: Request,
  env: Env
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!sql || !userId) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, origin, 401);
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return jsonResponse({ success: false, error: 'Title is required' }, origin, 400);
    }

    const type = typeof body.type === 'string' ? body.type : 'meeting';
    const startTime = typeof body.start === 'string' ? body.start : null;
    if (!startTime) {
      return jsonResponse({ success: false, error: 'Start time is required' }, origin, 400);
    }

    const endTime = typeof body.end === 'string' ? body.end : null;
    const location = typeof body.location === 'string' ? body.location : null;
    const description = typeof body.description === 'string' ? body.description : null;
    const attendees = Array.isArray(body.attendees) ? body.attendees.filter((a): a is string => typeof a === 'string') : [];
    const color = typeof body.color === 'string' ? body.color : '#8b5cf6';
    const reminder = typeof body.reminder === 'string' ? body.reminder : null;

    const attendeesJson = JSON.stringify(attendees);

    const result = await sql`
      INSERT INTO calendar_events (user_id, title, type, start_date, end_date, location, description, attendees, color, reminder)
      VALUES (${userId}, ${title}, ${type}, ${startTime}, ${endTime}, ${location}, ${description}, ${attendeesJson}::jsonb, ${color}, ${reminder})
      RETURNING *
    `;

    const row = result[0];
    const event = {
      id: row.id,
      title: row.title,
      type: row.type,
      date: new Date(row.start_date).toISOString().split('T')[0],
      start: row.start_date,
      end: row.end_date,
      location: row.location,
      description: row.description,
      attendees: row.attendees,
      color: row.color,
      reminder: row.reminder,
    };

    return jsonResponse({ success: true, event }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('createCalendarEvent error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to create event' }, origin, 500);
  }
}
